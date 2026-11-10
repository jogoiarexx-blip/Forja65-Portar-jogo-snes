#!/usr/bin/env python3
"""Game-independent read-only WRAM record writer A/B audit.

A validated byte-write/snapshot chain is required. Output has no unearned
collision/score/board-stage assertions, even when a writer only occurs after a shot.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path
from wram_trace_core_v23 import compare_pair
from wram_snapshot_ab_v19 import load_snapshots

SCHEMA = 'forja65.wram.record-writer-chain/1'

def analyze(control:Path, attack:Path, targets:list[str], start:int, count:int,
            stride:int, window_start:int, window_end:int, requested_frames:int,
            fork:int, cap:int=500000, expected_rom:str|None=None, rom:bytes|None=None):
    if not (0 <= start < 131072 and 1 <= count <= 8192 and 2 <= stride <= 64
            and start+count*stride <= 131072):
        raise ValueError('invalid WRAM record layout')
    if not targets or len(set(targets)) != len(targets):
        raise ValueError('missing or duplicate targets')
    if any(not (start <= int(addr,16)-0x7e0000 < start+count*stride)
           for addr in targets):
        raise ValueError('target outside selected record structure')
    pair=compare_pair(control,attack,targets,window_start,window_end,cap,requested_frames,fork)
    if expected_rom and pair['attack']['rom_qa']!=expected_rom:
        raise ValueError('ROM differs from earlier record probe')
    sheets={};pc_data=defaultdict(lambda:{'baseline':Counter(),'attack':Counter(),
                                      'first_frame':None,'last_frame':None,'records':set(),
                                      'fields':Counter(),'addresses':set()})
    def to_record(address):
        off=int(address,16)-0x7e0000-start
        return off//stride, off%stride
    for side,folder in [('baseline',control),('attack',attack)]:
        n=0
        with (folder/'writers.csv').open(newline='',encoding='utf-8-sig') as file:
            reader=csv.DictReader(file)
            for row in reader:
                pc=row['writer_pc'].upper().zfill(6);addr=row['address'].upper().zfill(6)
                frame=int(row['frame']);idx,offset=to_record(addr)
                item=pc_data[pc];item[side][frame]+=1
                item['records'].add(idx);item['fields'][offset//2]+=1
                item['addresses'].add(addr)
                item['first_frame']=frame if item['first_frame'] is None else min(frame,item['first_frame'])
                item['last_frame']=frame if item['last_frame'] is None else max(frame,item['last_frame'])
                n+=1
        if n!=pair[side if side=='attack' else 'control']['event_count']:
            raise ValueError('trace events changed after verification')
        sheets[side]={'sha256':hashlib.sha256((folder/'writers.csv').read_bytes()).hexdigest(),
                     'events':n}
    baseline,_=load_snapshots(control);attack_frames,_=load_snapshots(attack)
    timeline=[];first_ab=None
    for frame in sorted(baseline):
        a=attack_frames[frame];b=baseline[frame]
        differing=[i for i in range(count) if a[start+i*stride:start+(i+1)*stride]!=
                   b[start+i*stride:start+(i+1)*stride]]
        if frame>=fork and differing and first_ab is None:first_ab=frame
        timeline.append({'frame':frame,'different_records':len(differing),
                         'example_indices':differing[:16]})
    pcs=[]
    for pc,item in sorted(pc_data.items(),key=lambda t:(-sum(t[1]['attack'].values()),t[0])):
        pcs.append({'pc':pc,'baseline_events':sum(item['baseline'].values()),
                    'attack_events':sum(item['attack'].values()),
                    'first_frame':item['first_frame'],'last_frame':item['last_frame'],
                    'records_touched':len(item['records']),
                    'record_indices':sorted(item['records']),
                    'word_slots_affected':sorted(item['fields']),
                    'distinct_address_count':len(item['addresses']),
                    'attack_frame_sample':sorted(item['attack'].items())[:16]})
    # The trace PC is not always a STA: PHA and JSR write to the SNES stack.
    # Resolve real ROM opcodes before claiming this region is game-board data.
    stack_ops={0x48:'PHA',0x20:'JSR',0x22:'JSL',0x08:'PHP',0x0B:'PHD',
               0xDA:'PHX',0x5A:'PHY',0xF4:'PEA',0xD4:'PEI',0x62:'PER'}
    stack_totals={'baseline':0,'attack':0}
    unresolved=[]
    for item in pcs:
        n=int(item['pc'],16); bank=(n>>16)&0xff
        offset=(bank&0x7f)*0x8000+(n&0x7fff)
        opcode=rom[offset] if rom is not None and (n&0x8000) and offset<len(rom) else None
        item['rom_opcode']=f'{opcode:02X}' if opcode is not None else None
        item['rom_mnemonic']=stack_ops.get(opcode,'UNKNOWN_OR_NONSTACK')
        item['is_stack_push_opcode']=opcode in stack_ops
        if opcode is None:unresolved.append(item['pc'])
        if item['is_stack_push_opcode']:
            for side in stack_totals:stack_totals[side]+=item[side+'_events']
    event_totals={side:sheets[side]['events'] for side in sheets}
    all_stack=(rom is not None and sum(event_totals.values())>0 and
               all(event_totals[s]==stack_totals[s] for s in event_totals))
    interpretation={'stack_opcode_events':stack_totals,
      'total_events':event_totals,
      'stack_opcode_ratio':{side:(stack_totals[side]/event_totals[side] if event_totals[side] else None)
                             for side in event_totals},
      'classification':'ALL_WRITES_FROM_STACK_PUSH_OPCODES' if all_stack
                        else 'UNCLASSIFIED_OR_MIXED',
      'can_use_as_board_evidence':False,
      'rom_mapping':'LoROM, verified only for high-half PCs',
      'unmapped_pcs':unresolved}
    return {'schema':SCHEMA,'status':'RECONCILED_RECORD_WRITERS_ONLY',
       'rom':pair['attack']['rom_qa'], 'records':{'start':f'{0x7e0000+start:06X}',
         'count':count,'stride':stride,'target_bytes':len(targets)},
       'captured':sheets, 'pre_fork_full_wram_equal':pair['pre_fork_full_wram_equal'],
       'opcode_audit':interpretation,
       'snapshot_checks':{'baseline':pair['control']['snapshot_checks'],
                          'attack':pair['attack']['snapshot_checks']},
       'first_observed_ab_change':first_ab,'timeline':timeline,'writers':pcs,
       'validated':{'writer_snapshot_chain':True,'record_mutation':first_ab is not None,
                    'board_cells':False,'collision':False,'score':False,
                    'board_clear':False,'next_stage':False},
       'limitations':['PC and write value are observed; gameplay role is not established.',
         'Only selected addresses and checkpoints are covered.',
         'A/B divergence can be motion, sorting, graphics, or general state.',
         'Not a successful-level replay or proof of portable Windows build.']}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--baseline',required=True,type=Path)
    p.add_argument('--attack',required=True,type=Path)
    p.add_argument('--targets',required=True,help='Comma-separated canonical WRAM addresses')
    p.add_argument('--record-start',required=True,help='Canonical WRAM address')
    p.add_argument('--count',required=True,type=int)
    p.add_argument('--stride',default=6,type=int)
    p.add_argument('--window-start',default=2100,type=int)
    p.add_argument('--window-end',default=2999,type=int)
    p.add_argument('--frames',default=3000,type=int)
    p.add_argument('--fork',default=2100,type=int)
    p.add_argument('--expected-rom',default=None)
    p.add_argument('--rom',type=Path,help='Raw LoROM bytes; optional stack-opcode audit')
    p.add_argument('--out',type=Path)
    args=p.parse_args()
    try:
        r=analyze(args.baseline,args.attack,args.targets.split(','),
                  int(args.record_start,16)-0x7e0000,args.count,args.stride,
                  args.window_start,args.window_end,args.frames,args.fork,
                  expected_rom=args.expected_rom,rom=args.rom.read_bytes() if args.rom else None)
    except (ValueError,OSError,KeyError,TypeError) as exc:p.error(str(exc))
    raw=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    if args.out:args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(raw,encoding='utf-8')
    print(json.dumps({'status':r['status'],'writers':len(r['writers']),
        'baseline_events':r['captured']['baseline']['events'],
        'attack_events':r['captured']['attack']['events'],
        'first_observed_ab_change':r['first_observed_ab_change'],
        'opcode_audit':r['opcode_audit']['classification']},indent=2))
if __name__=='__main__':main()
