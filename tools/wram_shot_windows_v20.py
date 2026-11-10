#!/usr/bin/env python3
"""Forja65 v2.0: shot-aligned WRAM differential audit.

Aims to prioritize *candidates*, not infer board geometry or certify victory.
Reads complete A/B snapshots and the real input trace. Never edits gameplay state.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
from wram_snapshot_ab_v19 import SIZE, load_snapshots, parse_qa

SCHEMA = 'forja65.wram.shot-windows/1'
TR = re.compile(r'^frame=(\d+)\s+joy1=([0-9a-fA-F]{1,4})\s+joy2=([0-9a-fA-F]{1,4})(?:\s+(?:#.*)?)?$')


def replay_shots(trace: Path, start: int, frames: int, mask: int = 0x8000):
    """Rising edge for the fire bit, respecting controller latch until next event."""
    if not (0 < start < frames and 1 <= mask <= 0xffff and mask & (mask-1) == 0):
        raise ValueError('invalid fork/frames/fire mask')
    events=[]; prev=-1; last_state=0; shots=[]
    for number, line in enumerate(trace.read_text(encoding='utf-8').splitlines(), 1):
        line=line.strip()
        if not line or line.startswith(('#',';')):continue
        m=TR.fullmatch(line)
        if not m:raise ValueError(f'invalid input trace at line {number}')
        f=int(m.group(1)); joy=int(m.group(2),16)
        if f<=prev:raise ValueError('trace unordered')
        if f>=frames:break  # Longer input traces are legal; the engine stops at --frames.
        if f>=start and (joy & mask) and not (last_state & mask):shots.append(f)
        last_state=joy;prev=f;events.append((f,joy))
    if not events or not shots or shots[0]!=start:
        raise ValueError('no fire rising edge at the input fork; cannot assign shot windows')
    return shots


def schedule(shots: list[int], fork: int, frames: int, max_snapshots: int = 64):
    if (not shots or shots[0]!=fork or shots!=sorted(set(shots)) or
        frames<=fork+1 or max_snapshots<3):raise ValueError('invalid shot schedule')
    # Group snapshots around each shot, excluding the next press. First baseline
    # and pre-fire same-frame checkpoint are essential causality guards.
    selected={max(0,fork-50),fork-1,frames-1}
    for i,s in enumerate(shots):
        next_shot=shots[i+1] if i+1<len(shots) else frames
        for d in (-1,0,1,10,30,60,90):
            f=s+d
            if 0<=f<min(next_shot,frames) or (d==-1 and f>=0):selected.add(f)
    out=sorted(selected)
    if len(out)>max_snapshots:
        raise ValueError(f'{len(out)} snapshots exceed engine {max_snapshots} limit; shorten replay or split shot groups')
    if out[0]>=fork or out[-1]<=fork:raise ValueError('missing pre/post fork frames')
    return out


def opcode_index(path:Path|None):
    if path is None:return {}
    obj=json.loads(path.read_text(encoding='utf-8'))
    if obj.get('schema')!='forja65.wram.writer-opcodes/1':raise ValueError('invalid opcode report')
    result=defaultdict(list)
    for p in obj['pcs']:
        if not re.fullmatch('[A-Fa-f0-9]{6}', p['pc']):raise ValueError('bad writer pc')
        for address in p['addresses']:
            result[int(address,16)-0x7e0000].append({'pc':p['pc'],
                'mnemonic':p.get('mnemonic'),'operand':p.get('operand'),
                'direct_write_opcode':p.get('direct_write_opcode',False)})
    return dict(result)


def analyze(baseline:Path, attack:Path, shots:list[int], writer_opcodes:Path|None=None, limit:int=80, horizon:int|None=None):
    if not 1<=limit<=500:raise ValueError('invalid result limit')
    b,bm=load_snapshots(baseline); a,am=load_snapshots(attack)
    if set(b)!=set(a):raise ValueError('A/B frames differ')
    frames=sorted(b); fork=shots[0]
    if frames[0]>=fork or frames[-1]<=fork:raise ValueError('missing pre/post fork')
    if shots!=sorted(set(shots)) or any(s not in a or s-1 not in a for s in shots):
        raise ValueError('shot and pre-shot snapshots are mandatory')
    if not all(b[f]==a[f] for f in frames if f<fork):
        raise ValueError('whole WRAM mismatch before fork')
    bqa,aqa=parse_qa(baseline),parse_qa(attack)
    if bqa['rom']!=aqa['rom']:raise ValueError('ROM mismatch')
    if any(int(qa['frames'])<=frames[-1] for qa in (bqa,aqa)):
        raise ValueError('QA frame count insufficient')
    pcmap=opcode_index(writer_opcodes)
    aggregates=defaultdict(lambda:{'shots':[], 'post_frames':[], 'late_values':[], 'attack_only':0,
                                   'new_divergence':0,'baseline_changed':0})
    windows=[]
    for i,s in enumerate(shots):
        next_shot=shots[i+1] if i+1<len(shots) else (horizon if horizon is not None else frames[-1]+1)
        post=[f for f in frames if s+10<=f<next_shot]
        if not post:raise ValueError(f'shot {s}: missing delayed post-shot observations')
        # Choose the LAST checkpoint before another fire (captures delayed impact).
        t=post[-1]; pre=s-1
        before_a,after_a=a[pre],a[t];before_b,after_b=b[pre],b[t]
        immediate=sum(x!=y for x,y in zip(a[s],b[s]))
        only=0; novelty=0; changed_a=0; changed_b=0
        for off in range(SIZE):
            ac=before_a[off]!=after_a[off]
            bc=before_b[off]!=after_b[off]
            if ac:changed_a+=1
            if bc:changed_b+=1
            if ac and not bc:
                only+=1
                row=aggregates[off];row['attack_only']+=1;row['shots'].append(s)
                row['post_frames'].append(t);row['late_values'].append(after_a[off])
            if after_a[off]!=after_b[off] and before_a[off]==before_b[off]:
                novelty+=1
                aggregates[off]['new_divergence']+=1
            if bc and off in aggregates:aggregates[off]['baseline_changed']+=1
        windows.append({'shot_frame':s,'pre_frame':pre,'delayed_frame':t,
            'immediate_ab_different_bytes':immediate,
            'attack_temporal_changes':changed_a,'baseline_temporal_changes':changed_b,
            'attack_only_temporal_changes':only,'new_ab_divergences':novelty})
    rows=[]
    for off,row in aggregates.items():
        repeats=len(set(row['shots']))
        if not repeats:continue
        writers=pcmap.get(off,[])
        entry={'address':f'{0x7e0000+off:06X}',
          'attack_only_shot_windows':repeats,'shot_frames':row['shots'],
          'writer_pcs_from_previous_audit':writers,
          'baseline_changed_windows':row['baseline_changed'],
          'new_ab_divergences':row['new_divergence'],
          'suspicious_high_wram_bank':off>=0x10000,
          'classification':'UNVERIFIED_SHOT_RESPONSE',
          'ranking_score':repeats*10+min(len(writers),4)*2-(2 if off>=0x10000 else 0)}
        rows.append(entry)
    rows.sort(key=lambda r:(-r['ranking_score'],-r['new_ab_divergences'],r['address']))
    # Group adjacent bytes that respond to >=2 separate shots; this is still NOT
    # a proof of a grid. Do not claim the largest cluster represents bubbles.
    offsets=sorted(int(r['address'],16)-0x7e0000 for r in rows if r['attack_only_shot_windows']>=2)
    blocks=[]
    for off in offsets:
        if blocks and blocks[-1][1]+1==off:blocks[-1][1]=off
        else:blocks.append([off,off])
    clusters=[{'start':f'{x+0x7e0000:06X}','end':f'{y+0x7e0000:06X}',
        'length':y-x+1,'possible_render_buffer':x>=0x10000}
        for x,y in blocks if y-x+1>=2]
    clusters.sort(key=lambda z:(-z['length'],z['start']))
    return {'schema':SCHEMA,'status':'SHOT_CONDITIONED_CANDIDATES_ONLY',
      'rom_fingerprint':bqa['rom'],'fork_frame':fork,'shots':shots,
      'snapshot_frames':frames,'baseline_attack_identical_pre_fork':True,
      'windows':windows,'candidate_count':len(rows),'candidates':rows[:limit],
      'repeated_changed_clusters':clusters[:50],
      'validated':{'shot_timing':True,'pre_fork_wram_equality':True,
       'collision':False,'score':False,'board_cells':False,'board_clear':False,'next_stage':False},
      'last_shot_horizon_exclusive':horizon,
      'source_sha256':{'baseline_manifest':hashlib.sha256((baseline/'snapshots.csv').read_bytes()).hexdigest(),
        'attack_manifest':hashlib.sha256((attack/'snapshots.csv').read_bytes()).hexdigest()},
      'warning':'Correlative A/B changes only. Other input history differs after first shot; subsequent windows are NOT independent causal experiments. Writer PCs and board semantics require independent oracle.'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--baseline',required=True,type=Path);p.add_argument('--attack',required=True,type=Path)
    p.add_argument('--attack-trace',required=True,type=Path);p.add_argument('--fork',type=int,default=2100)
    p.add_argument('--frames',type=int,default=3000);p.add_argument('--writer-opcodes',type=Path)
    p.add_argument('--limit',type=int,default=80);p.add_argument('--out',type=Path)
    p.add_argument('--first-shot-only',action='store_true',help='Analyze existing sparse v1.9 snapshots only until the second shot')
    args=p.parse_args()
    try:
        shots=replay_shots(args.attack_trace,args.fork,args.frames)
        horizon=shots[1] if args.first_shot_only and len(shots)>1 else None
        if args.first_shot_only:shots=shots[:1]
        result=analyze(args.baseline,args.attack,shots,args.writer_opcodes,args.limit,horizon=horizon)
    except (OSError,ValueError,KeyError,TypeError) as exc:p.error(str(exc))
    output=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if args.out:args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(output,encoding='utf-8')
    print(json.dumps({'status':result['status'],'shot_windows':len(result['windows']),
                      'candidate_count':result['candidate_count'],
                      'top_candidates':result['candidates'][:10]},indent=2))
if __name__=='__main__':main()
