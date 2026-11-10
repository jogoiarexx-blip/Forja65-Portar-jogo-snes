#!/usr/bin/env python3
"""Forja65 v2.2: evidence-linked WRAM structure triage (read-only).

Identifies *candidate arrays* and verifies ROM/AOT write sites. It deliberately
cannot label a buffer as board, collision, score or stage without an oracle.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
from wram_snapshot_ab_v19 import SIZE,load_snapshots,parse_qa
from wram_isolated_shot_v21 import scan as isolated_scan

SCHEMA='forja65.wram.structure-triage/2'
TARGETS=('80E530','80E38A','80E392','80E387','80EB12','80EB00')

def _runs(offsets):
    spans=[]
    for x in sorted(offsets):
        if spans and x==spans[-1][1]+1 and (x//65536)==(spans[-1][1]//65536):spans[-1][1]=x
        else:spans.append([x,x])
    return spans

def _motif(block):
    # Alignment-independent: the blob is already a contiguous divergent interval.
    if len(block)<12 or len(block)%4:return None
    chunks=[block[i:i+4] for i in range(0,len(block),4)]
    common,count=Counter(chunks).most_common(1)[0]
    if count<3:return None
    return {'word_bytes':4,'pattern_hex':common.hex().upper(),
            'repeats':count,'total_words':len(chunks),
            'all_words_equal':count==len(chunks)}

def _pc_evidence(opcodes,rom,source_dir,targets):
    if opcodes.get('schema')!='forja65.wram.writer-opcodes/1':
        raise ValueError('bad opcode report schema')
    if opcodes['rom_bytes']!=len(rom):raise ValueError('ROM length differs from opcode audit')
    reports={entry['pc']:entry for entry in opcodes['pcs']}
    # Read only source files that are part of the generated AOT translation.
    sources=[(p,p.read_text(encoding='utf-8')) for p in sorted(source_dir.glob('forja_learned*.cpp'))]
    results=[]
    for pc in targets:
        if pc not in reports:raise ValueError(f'{pc}: absent from writer opcode audit')
        item=reports[pc]
        n=int(pc,16)
        if (n&0x8000)==0:raise ValueError(f'{pc}: invalid LoROM address')
        off=((n>>16)&0x7f)*0x8000+(n&0x7fff)
        raw=rom[off:off+4]
        if len(raw)<4:raise ValueError(f'{pc}: truncated ROM')
        if raw.hex(' ').upper()!=item['bytes'] or f'{off:06X}'!=item['rom_offset']:
            raise ValueError(f'{pc}: ROM opcode evidence mismatch')
        if not item.get('direct_write_opcode') or item.get('mnemonic')!='STA':
            raise ValueError(f'{pc}: unexpected non-STA instruction')
        operand=int(item['operand'],16)
        if raw[0]!=0x99 or int.from_bytes(raw[1:3],'little')!=operand:
            raise ValueError(f'{pc}: unexpected non-indexed writer')
        anchor=f'// ${pc} STA'
        matches=[]
        for path,src in sources:
            at=src.find(anchor)
            if at<0:continue
            # Within this instruction's code block, ensure same effective operand
            # from generated AOT as from original ROM (case and zero-padding agnostic).
            snippet=src[at:src.find('goto L_',at) if src.find('goto L_',at)>at else at+400]
            mo=re.search(r'hw\.write\(cpu\.address\("absy",\s*0x([0-9a-fA-F]+)u\)',snippet)
            if mo and int(mo.group(1),16)==operand:matches.append(path.name)
        results.append({'pc':pc,'rom_offset':f'{off:06X}',
           'rom_bytes':raw.hex(' ').upper(),'instruction':'STA abs,Y',
           'base_operand':f'{operand:04X}',
           'observed_addresses':item['addresses'],
           'aot_confirmed':bool(matches),'aot_files':matches,
           'meaning':'CONFIRMED_INDEXED_WRAM_WRITE_NOT_GAME_SEMANTICS' if matches else 'ROM_VERIFIED_AOT_UNCONFIRMED'})
    return results

def analyze(baseline:Path,attack:Path,baseline_trace:Path,attack_trace:Path,
            writer_map:Path,opcodes_path:Path,rom_path:Path,source_dir:Path,
            fork:int=2100,horizon:int=2220):
    # Reuse v2.1's strict guards for input differences, ROM QA, pre-fork RAM,
    # snapshots and writer report schema. Never silently ignore failed gates.
    isolation=isolated_scan(baseline,attack,baseline_trace,attack_trace,fork,horizon,writer_map,1)
    b,bm=load_snapshots(baseline);a,am=load_snapshots(attack)
    frames=[f for f in sorted(a) if fork<=f<horizon]
    prefix=max(f for f in b if f<fork)
    last=frames[-1]
    rom=rom_path.read_bytes()
    if len(rom)!=524288:raise ValueError('unexpected cartridge ROM size')
    pcs=_pc_evidence(json.loads(opcodes_path.read_text(encoding='utf-8')),rom,source_dir,TARGETS)
    # Persistent diffs have higher priority, but a repeated signature must not
    # be interpreted as bubble removal; it can be a sprite or staging buffer.
    divergent={i for i in range(SIZE) if any(a[f][i]!=b[f][i] for f in frames)}
    persistent={i for i in divergent if a[last][i]!=b[last][i]}
    attack_only={i for i in persistent if a[last][i]!=a[prefix][i] and b[last][i]==b[prefix][i]}
    runs=[]
    for start,end in _runs(persistent):
        n=end-start+1
        if n<8:continue
        before_a=a[prefix][start:end+1];after_a=a[last][start:end+1]
        before_b=b[prefix][start:end+1];after_b=b[last][start:end+1]
        rows={'start':f'{0x7e0000+start:06X}','end':f'{0x7e0000+end:06X}',
              'length':n,'bank':'7E' if start<65536 else '7F',
              'attack_only_bytes':sum(i in attack_only for i in range(start,end+1)),
              'baseline_changed_bytes':sum(x!=y for x,y in zip(before_b,after_b)),
              'attack_changed_bytes':sum(x!=y for x,y in zip(before_a,after_a)),
              'last_checkpoint':last,
              'attack_final_first_32_hex':after_a[:32].hex(' ').upper(),
              'baseline_final_first_32_hex':after_b[:32].hex(' ').upper(),
              'repeated_4byte_signature':_motif(after_a),
              'classification':'CANDIDATE_ARRAY_OR_BUFFER_ONLY'}
        runs.append(rows)
    runs.sort(key=lambda row:(row['bank']!='7E',-bool(row['repeated_4byte_signature']),
               -row['attack_only_bytes'],-row['length'],row['start']))
    # Directly preserve byte-level temporal evidence for the three key writers
    # and for one contiguous array found in the real replay.
    probes=[]
    for start,end in ((0x22e,0x23d),(0x258,0x259),(0x910,0x911),(0x91c,0x91d),(0x928,0x929)):
        if end>=SIZE:raise AssertionError('bad probe')
        samples=[]
        for f in [prefix]+frames:
            x=a[f][start:end+1];y=b[f][start:end+1]
            samples.append({'frame':f,'attack_hex':x.hex(' ').upper(),
                            'baseline_hex':y.hex(' ').upper(),
                            'equal':x==y})
        probes.append({'start':f'{0x7e0000+start:06X}',
                       'end':f'{0x7e0000+end:06X}', 'samples':samples})
    writer_meta=json.loads(writer_map.read_text(encoding='utf-8'))
    return {'schema':SCHEMA,'status':'STRUCTURAL_CANDIDATES_ONLY',
      'rom_fingerprint_qa':parse_qa(attack)['rom'],
      'provenance_sha256':{k:hashlib.sha256(p.read_bytes()).hexdigest() for k,p in
           [('rom',rom_path),('opcodes',opcodes_path),('writers',writer_map),
            ('attack_trace',attack_trace),('baseline_trace',baseline_trace),
            ('attack_snapshots_csv',attack/'snapshots.csv'),('baseline_snapshots_csv',baseline/'snapshots.csv')]},
      'input_isolation_confirmed':isolation['input_isolation']['all_nonfire_inputs_equal'],
      'fork_frame':fork,'observed_frames':frames,'prefork_frame':prefix,
      'candidate_counts':{'ever_divergent':len(divergent),'persistent_at_last':len(persistent),
                          'attack_only_at_last':len(attack_only),
                          'persistent_bank_7e':sum(o<65536 for o in persistent),
                          'persistent_bank_7f':sum(o>=65536 for o in persistent)},
      'persistent_contiguous_runs_ge_8':runs[:60],
      'priority_byte_probes':probes,'pc_opcode_and_aot_crosscheck':pcs,
      'writer_audit_limitations':{'writer_event_counts':writer_meta.get('writer_event_counts',{}),
        'writer_log_cap_reached_or_unknown':any(v>=500000 for v in writer_meta.get('writer_event_counts',{}).values()),
        'absence_of_writer_not_evidence_of_no_write':True},
      'new_targeted_writer_plan':{
          'addresses':[f'{0x7e0000+x:06X}' for x in list(range(0x22e,0x23e))+[0x258,0x259,0x910,0x911,0x91c,0x91d,0x928,0x929]],
          'frames_start':2095,'frames_end':2210,'max_records':500000,
          'changes_only':True,'run_separate_control_and_attack':True,
          'must_fail_if_log_truncated':True},
      'validated':{'input_effect':True,'rom_writer_opcodes':True,
                   'aot_opcode_crosscheck':all(p['aot_confirmed'] for p in pcs),
                   'board_cells':False,'collision':False,'score':False,'board_clear':False,
                   'next_stage':False,'portable_windows':False},
      'caveats':['Snapshots observe state at sparse checkpoints; effects may occur between checkpoints.',
        'Repeated 4-byte signatures may be temporary objects or graphical buffers, not cleared bubbles.',
        'Indexed STA effective addresses require runtime DBR/Y; the static operand alone cannot label a field.',
        'No reference emulator oracle, winning replay, or Windows portable binary was validated.']}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for x in ('baseline','attack','baseline-trace','attack-trace','writer-map',
              'opcodes','rom','source-dir'):
        p.add_argument('--'+x,required=True,type=Path)
    p.add_argument('--fork',type=int,default=2100)
    p.add_argument('--horizon',type=int,default=2220)
    p.add_argument('--out',type=Path)
    args=p.parse_args()
    try:r=analyze(args.baseline,args.attack,args.baseline_trace,args.attack_trace,
          args.writer_map,args.opcodes,args.rom,args.source_dir,args.fork,args.horizon)
    except (OSError,ValueError,TypeError,KeyError) as exc:p.error(str(exc))
    content=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    if args.out:args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(content,encoding='utf-8')
    print(json.dumps({'status':r['status'],'candidate_counts':r['candidate_counts'],
          'pcs':r['pc_opcode_and_aot_crosscheck']},indent=2))
if __name__=='__main__':main()
