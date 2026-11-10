#!/usr/bin/env python3
"""Audit one controlled shot using two complete WRAM snapshot replays.

This is an input-isolation and temporal-correlation tool, NOT a game-state oracle.
No memory writes or game modifications. Board/score/stage never inferred.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
from wram_snapshot_ab_v19 import SIZE, load_snapshots, parse_qa

SCHEMA = 'forja65.wram.isolated-shot/1'
TRACE = re.compile(r'frame=(\d+)\s+joy1=([0-9a-fA-F]{1,4})\s+joy2=([0-9a-fA-F]{1,4})')


def trace_events(path: Path, horizon: int):
    events=[];prev=-1
    for lineno,line in enumerate(path.read_text(encoding='utf-8').splitlines(),1):
        line=line.strip()
        if not line or line.startswith(('#',';')): continue
        m=TRACE.fullmatch(line)
        if not m:raise ValueError(f'{path}:{lineno}: invalid trace row')
        frame=int(m[1]);joy1=int(m[2],16);joy2=int(m[3],16)
        if frame<=prev:raise ValueError(f'{path}:{lineno}: unordered/duplicate input frame')
        prev=frame
        if frame<horizon:events.append((frame,joy1,joy2))
    return events


def input_isolation(baseline:Path,attack:Path,fork:int,horizon:int,fire_mask:int=0x8000):
    if not 0<fork<horizon or not 0<fire_mask<=65535 or fire_mask&(fire_mask-1):
        raise ValueError('invalid fork/horizon/fire bit')
    a=trace_events(attack,horizon);b=trace_events(baseline,horizon)
    def expanded(events):
        result=[];i=0;state=(0,0)
        for frame in range(horizon):
            while i<len(events) and events[i][0]<=frame:
                state=(events[i][1],events[i][2]);i+=1
            result.append(state)
        return result
    aa=expanded(a);bb=expanded(b);fire_frames=[]
    for f,(va,vb) in enumerate(zip(aa,bb)):
        # Both controllers must be otherwise identical in EVERY frame.
        if va[1]!=vb[1] or (va[0]&~fire_mask)!=(vb[0]&~fire_mask):
            raise ValueError(f'non-fire input divergence at frame {f}')
        if f<fork and va!=vb:raise ValueError(f'input divergence before fork frame {f}')
        if (va[0]^vb[0])&fire_mask:
            if not (va[0]&fire_mask) or (vb[0]&fire_mask):
                raise ValueError(f'attack is not a fire-only addition at frame {f}')
            fire_frames.append(f)
    if aa[fork-1][0]&fire_mask or bb[fork-1][0]&fire_mask:
        raise ValueError('no rising fire edge: button already pressed at fork-1')
    if not fire_frames or fire_frames[0]!=fork:
        raise ValueError('first isolated fire press not at fork')
    if any(f>=fork and (bb[f][0]&fire_mask) for f in range(horizon)):
        raise ValueError('baseline fires inside isolated window')
    return {'fire_button':f'{fire_mask:04X}','extra_fire_frames':fire_frames,
        'all_nonfire_inputs_equal':True,'pre_fork_inputs_equal':True,
        'baseline_trace_sha256':hashlib.sha256(baseline.read_bytes()).hexdigest(),
        'attack_trace_sha256':hashlib.sha256(attack.read_bytes()).hexdigest()}


def scan(baseline:Path,attack:Path,baseline_trace:Path,attack_trace:Path,
         fork:int,horizon:int,writer_map:Path|None=None,limit:int=150):
    if not 1<=limit<=2000:raise ValueError('invalid report limit')
    isolation=input_isolation(baseline_trace,attack_trace,fork,horizon)
    b,bm=load_snapshots(baseline);a,am=load_snapshots(attack)
    if set(a)!=set(b):raise ValueError('mismatched A/B frames')
    frames=sorted(a);prefix=[f for f in frames if f<fork]
    timeline=[f for f in frames if fork<=f<horizon]
    if not prefix or fork not in timeline or len(timeline)<3:
        raise ValueError('missing pre-shot, immediate or delayed checkpoints')
    # Any future-shot observations are excluded: no cross-shot contamination.
    if any(a[f]!=b[f] for f in prefix):raise ValueError('full WRAM mismatch before fork')
    qa_b=parse_qa(baseline);qa_a=parse_qa(attack)
    if qa_b['rom']!=qa_a['rom']:raise ValueError('ROM fingerprint mismatch')
    if any(qa['runtime_started']!='PASS' or int(qa['frames'])<=max(timeline)
           for qa in [qa_a,qa_b]):raise ValueError('incomplete runtime QA')
    # The exact first frame and all other checkpoints must be in the declared window.
    pcmap={}
    if writer_map:
        obj=json.loads(writer_map.read_text(encoding='utf-8'))
        if obj.get('schema')!='forja65.wram.writer-attribution/1':
            raise ValueError('invalid previous writer report schema')
        for item in obj['addresses']:
            addr=int(item['address'],16)
            if not 0x7e0000<=addr<=0x7fffff:raise ValueError('writer address out of range')
            pcmap[addr]=item
    last=timeline[-1]
    outcomes=[];regions=defaultdict(lambda:Counter())
    total_by_frame=[{'frame':f,'different_bytes':sum(x!=y for x,y in zip(a[f],b[f])),
        'different_7E':sum(x!=y for x,y in zip(a[f][:65536],b[f][:65536])),
        'different_7F':sum(x!=y for x,y in zip(a[f][65536:],b[f][65536:]))} for f in timeline]
    for off in range(SIZE):
        differing=[f for f in timeline if a[f][off]!=b[f][off]]
        if not differing:continue
        onset=differing[0];persist=last in differing
        ac=a[last][off]!=a[prefix[-1]][off]
        bc=b[last][off]!=b[prefix[-1]][off]
        attack_only=ac and not bc
        address=0x7e0000+off
        zone='7F' if off>=65536 else '7E'
        rg=f'{(address&0xffff00):06X}-{(address&0xffff00)+255:06X}'
        info=regions[rg]
        info['total_divergent_offsets']+=1
        info['bank7f' if zone=='7F' else 'bank7e']+=1
        if onset==fork:info['immediate']+=1
        else:info['delayed']+=1
        if persist:info['persistent_at_last_checkpoint']+=1
        if attack_only:info['attack_only_temporal_change']+=1
        writer=pcmap.get(address)
        if writer:info['previously_attributed_writer_offsets']+=1
        # Fixed low-level filters are triage, not semantic evidence.
        likely_scheduling=0x7e1c60<=address<=0x7e1c80
        score=(20 if attack_only else 0)+(12 if persist else 0)+min(len(differing),9)*2
        score+=(12 if writer else 0)+(6 if onset>fork else 0)
        score-=(26 if zone=='7F' else 0)+(22 if likely_scheduling else 0)
        outcomes.append({'address':f'{address:06X}','first_divergence_frame':onset,
            'divergent_checkpoints':len(differing), 'persistent_at_last_checkpoint':persist,
            'changed_attack_pre_to_last':ac,'changed_control_pre_to_last':bc,
            'attack_only_temporal_change':attack_only,
            'bank':zone,'scheduler_context_region':likely_scheduling,
            'writer_pcs_from_earlier_partial_audit':writer['writer_pcs']['attack'] if writer else {},
            'ranking_score':score,'classification':'UNVERIFIED_INPUT_EFFECT'})
    outcomes.sort(key=lambda x:(-x['ranking_score'],x['address']))
    region_rows=[dict(region=k,**v) for k,v in regions.items()]
    region_rows.sort(key=lambda r:(-r.get('previously_attributed_writer_offsets',0),
          -r.get('attack_only_temporal_change',0),r['region']))
    return {'schema':SCHEMA,'status':'ISOLATED_SHOT_WRAM_EFFECT_CONFIRMED' if outcomes else 'NO_OBSERVED_EFFECT',
       'rom_fingerprint':qa_a['rom'],'fork_frame':fork,'horizon_exclusive':horizon,
       'pre_fork_complete_wram_equal':True,'input_isolation':isolation,
       'checkpoint_frames_in_window':timeline,
       'frame_differences':total_by_frame,'candidate_address_count':len(outcomes),
       'candidate_regions':region_rows[:80],'ranked_addresses':outcomes[:limit],
       'summary':{'immediate_at_fork':sum(o['first_divergence_frame']==fork for o in outcomes),
                  'delayed_first_divergence':sum(o['first_divergence_frame']>fork for o in outcomes),
                  'persistent_at_last_checkpoint':sum(o['persistent_at_last_checkpoint'] for o in outcomes),
                  '7e_candidates':sum(o['bank']=='7E' for o in outcomes),
                  '7f_candidates':sum(o['bank']=='7F' for o in outcomes),
                  'attack_only_temporal':sum(o['attack_only_temporal_change'] for o in outcomes),
                  'with_earlier_partial_writer_evidence':sum(bool(o['writer_pcs_from_earlier_partial_audit']) for o in outcomes)},
       'validated':{'fire_only_input_fork':True,'shot_caused_a_b_wram_differences':bool(outcomes),
          'board_cells':False,'collision':False,'score':False,'clear':False,'next_stage':False},
       'provenance':{'baseline_manifest_sha256':hashlib.sha256((baseline/'snapshots.csv').read_bytes()).hexdigest(),
                     'attack_manifest_sha256':hashlib.sha256((attack/'snapshots.csv').read_bytes()).hexdigest(),
                     'writer_map_sha256':hashlib.sha256(writer_map.read_bytes()).hexdigest() if writer_map else None},
       'caveat':'Only the first isolated shot is causal. WRAM differences and earlier (possibly saturated) PC writer audits do NOT prove collision, bubbles, points or stage transition.'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for key in ('baseline','attack','baseline_trace','attack_trace'):
        p.add_argument('--'+key.replace('_','-'),type=Path,required=True)
    p.add_argument('--fork',type=int,required=True)
    p.add_argument('--horizon',type=int,required=True,help='exclusive; strictly before next shot')
    p.add_argument('--writer-map',type=Path)
    p.add_argument('--limit',type=int,default=150)
    p.add_argument('--out',type=Path)
    args=p.parse_args()
    try:
        result=scan(args.baseline,args.attack,args.baseline_trace,args.attack_trace,
           args.fork,args.horizon,args.writer_map,args.limit)
    except (ValueError,OSError,KeyError,TypeError) as exc:
        p.error(str(exc))
    serialized=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if args.out:
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(serialized,encoding='utf-8')
    print(json.dumps({'status':result['status'],'summary':result['summary'],
        'top_regions':result['candidate_regions'][:8],'top_candidates':result['ranked_addresses'][:8]},indent=2))

if __name__=='__main__':main()
