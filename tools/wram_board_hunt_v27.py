#!/usr/bin/env python3
"""Read-only WRAM triage after excluding proven stack and OAM shadow regions.

This is a region-prioritization tool, NOT a board, collision, score or stage oracle.
Full 128 KiB snapshots, QA, fork equality, optional fire-only input isolation,
and explicit provenance are mandatory for any input-causal claim.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import csv
import hashlib
import json
from pathlib import Path
from wram_snapshot_ab_v19 import load_snapshots, parse_qa
from wram_isolated_shot_v21 import input_isolation

SCHEMA='forja65.wram.board-hunt/1'
SIZE=131072
# Game-specific exclusions are supplied by caller, never hardcoded into Forja65.


def normalize_ranges(ranges):
    clean=[]
    for it in ranges:
        if isinstance(it,str):
            x,y=it.split('-',1)
            lo,hi=int(x,16)-0x7e0000,int(y,16)-0x7e0000
            why='caller-specified'
        else:
            lo,hi=int(it['start'],16)-0x7e0000,int(it['end'],16)-0x7e0000
            why=str(it['reason'])
        if not(0<=lo<=hi<SIZE):raise ValueError('exclusion outside WRAM')
        clean.append((lo,hi,why))
    for i,(lo,hi,_) in enumerate(clean):
        if any(lo<=b and a<=hi for a,b,_ in clean[:i]):
            raise ValueError('overlapping exclusions')
    return clean


def analyze(baseline:Path,attack:Path,fork:int, horizon:int, excluded:list,
            baseline_trace:Path|None=None,attack_trace:Path|None=None,
            tile:int=32,top:int=30,writer_cap:int=96):
    if not 0<fork<horizon or not (tile in (16,32,64,128,256)) or not(1<=top<=200) or not(1<=writer_cap<=256):
        raise ValueError('invalid fork/horizon/tile/top')
    if (baseline_trace is None)!=(attack_trace is None):
        raise ValueError('both replay traces required together')
    isolation=None
    if baseline_trace:
        isolation=input_isolation(baseline_trace,attack_trace,fork,horizon)
    exc=normalize_ranges(excluded)
    b,_=load_snapshots(baseline);a,_=load_snapshots(attack)
    if sorted(a)!=sorted(b):raise ValueError('mismatched snapshot frames')
    frames=sorted(a);prefix=[f for f in frames if f<fork];post=[f for f in frames if fork<=f<horizon]
    if not prefix or fork not in post or len(post)<3:raise ValueError('insufficient frame checkpoints')
    if any(a[f]!=b[f] for f in prefix):raise ValueError('pre-fork full WRAM mismatch')
    qb=parse_qa(baseline);qa=parse_qa(attack)
    if qa['rom']!=qb['rom']:raise ValueError('different ROM fingerprints')
    if any(q['runtime_started']!='PASS' or not q['frames'].isdecimal() or int(q['frames'])<=frames[-1]
           for q in (qa,qb)):
        raise ValueError('incomplete or failed run QA')
    pre=a[prefix[-1]];last=post[-1]
    exlookup=[None]*SIZE
    for lo,hi,why in exc:
        exlookup[lo:hi+1]=[why]*(hi-lo+1)
    regions=defaultdict(lambda: {'ab':0,'late':0,'attack_only':0,'baseline_stable':0,
                                  'persistent':0,'delayed':0,'early':0,'readable':0,
                                  'addresses':[], 'observed_frames':set()})
    excluded_counts=defaultdict(int)
    timeline=[]
    for f in post:
        timeline.append({'frame':f,'different_total':sum(x!=y for x,y in zip(a[f],b[f])),
                         'different_7E':sum(x!=y for x,y in zip(a[f][:65536],b[f][:65536]))})
    for i in range(SIZE):
        diff=[f for f in post if a[f][i]!=b[f][i]]
        if not diff:continue
        if exlookup[i]:
            excluded_counts[exlookup[i]]+=1
            continue
        attack_only=a[last][i]!=pre[i] and b[last][i]==pre[i]
        baseline_stable=all(b[f][i]==pre[i] for f in post)
        bucket=i//tile
        reg=regions[bucket]
        reg['ab']+=1
        reg['late']+=int(last in diff)
        reg['persistent']+=int(len(diff)>=3)
        reg['attack_only']+=int(attack_only)
        reg['baseline_stable']+=int(baseline_stable)
        reg['delayed']+=int(diff[0]>fork)
        reg['early']+=int(diff[0]==fork)
        reg['observed_frames'].update(diff)
        reg['addresses'].append((i, diff[0],len(diff),attack_only,baseline_stable, last in diff))
    ranked=[]
    for bucket,rg in regions.items():
        start=bucket*tile
        # Two-tier ranking: graphics-heavy $7F is kept in a separate lower-priority
        # queue, rather than incorrectly discarded as evidence of any one role.
        bank='7F' if start>=65536 else '7E'
        score=(rg['attack_only']*7+rg['late']*3+rg['baseline_stable']*2+
               rg['persistent']+rg['delayed']+min(len(rg['observed_frames']),12))
        ranked.append({'start':f'{0x7e0000+start:06X}',
            'end':f'{0x7e0000+start+tile-1:06X}', 'bank':bank,
            'different_offsets':rg['ab'], 'persistent_offsets':rg['persistent'],
            'last_checkpoint_offsets':rg['late'], 'attack_only_final_offsets':rg['attack_only'],
            'baseline_stable_offsets':rg['baseline_stable'],
            'delayed_offsets':rg['delayed'], 'immediate_offsets':rg['early'],
            'ranking_score':score,'role':'UNIDENTIFIED',
            'examples':[{'address':f'{0x7e0000+i:06X}','first_diff_frame':startf,
                         'checkpoints_different':n,'attack_only_final':bool(ao),
                         'baseline_stable':bool(bs),'different_at_end':bool(le)}
                        for i,startf,n,ao,bs,le in sorted(rg['addresses'],key=lambda x:(not x[3],not x[5],x[0]))[:8]]})
    ranked.sort(key=lambda r:(r['bank']!='7E',-r['ranking_score'],r['start']))
    primary=[r for r in ranked if r['bank']=='7E']
    # Writer capture plans must fit existing runtime's <=256-address filter and
    # avoid capturing unbounded graphics banks as a gameplay assertion.
    selected=[]
    for r in primary:
        start=int(r['start'],16)-0x7e0000
        for i in range(start,start+tile):
            if exlookup[i] is None and any(a[f][i]!=b[f][i] for f in post):
                selected.append(f'{0x7e0000+i:06X}')
            if len(selected)>=writer_cap:break
        if len(selected)>=writer_cap:break
    return {'schema':SCHEMA,'status':'OBSERVATIONAL_RANKING_ONLY',
        'rom_fingerprint':qa['rom'], 'checkpoint_frames':frames,
        'fork_frame':fork,'horizon_exclusive':horizon,
        'pre_fork_wram_equal':True,'fire_only_inputs_verified':bool(isolation),
        'input_isolation':isolation,
        'exclusions':[{'start':f'{0x7e0000+lo:06X}','end':f'{0x7e0000+hi:06X}','reason':why}
                      for lo,hi,why in exc],
        'excluded_divergent_bytes_by_reason':dict(sorted(excluded_counts.items())),
        'candidate_region_count':len(ranked),
        'bank_7e_region_count':len(primary),
        'bank_7f_region_count':len(ranked)-len(primary),
        'ranked_7e_regions':primary[:top],
        'ranked_7f_regions':[r for r in ranked if r['bank']=='7F'][:min(top,12)],
        'selected_writer_addresses':selected,
        'frames':timeline,
        'provenance':{'baseline_manifest_sha256':hashlib.sha256((baseline/'snapshots.csv').read_bytes()).hexdigest(),
                      'attack_manifest_sha256':hashlib.sha256((attack/'snapshots.csv').read_bytes()).hexdigest()},
        'validated':{'memory_differences':bool(ranked),'board':False,'collision':False,'score':False,
                     'board_cleared':False,'next_stage':False,'windows_executable':False},
        'limitations':['Ranking is based on WRAM values, not gameplay semantics.',
          'Excluded regions may contain gameplay information; exclusions are conservative triage.',
          'Bank $7F is retained separately, not proven to be graphics.',
          'Selected writer addresses have NOT been freshly captured.',
          'No portable Windows executable or winning replay is validated.']}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--baseline',type=Path,required=True)
    p.add_argument('--attack',type=Path,required=True)
    p.add_argument('--baseline-trace',type=Path)
    p.add_argument('--attack-trace',type=Path)
    p.add_argument('--exclusions',type=Path,required=True,help='JSON list of start/end/reason intervals')
    p.add_argument('--fork',type=int,default=2100)
    p.add_argument('--horizon',type=int,default=3000)
    p.add_argument('--tile',type=int,default=32)
    p.add_argument('--top',type=int,default=30)
    p.add_argument('--writer-cap',type=int,default=96)
    p.add_argument('--out',type=Path)
    p.add_argument('--csv',type=Path)
    p.add_argument('--targets',type=Path)
    args=p.parse_args()
    try:
        excl=json.loads(args.exclusions.read_text(encoding='utf-8'))
        result=analyze(args.baseline,args.attack,args.fork,args.horizon,excl,
              args.baseline_trace,args.attack_trace,args.tile,args.top,args.writer_cap)
    except (OSError,ValueError,KeyError,TypeError,json.JSONDecodeError) as exc:
        p.error(str(exc))
    if args.out:
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.csv:
        args.csv.parent.mkdir(parents=True,exist_ok=True)
        with args.csv.open('w',newline='',encoding='utf-8') as fd:
            w=csv.DictWriter(fd,fieldnames=['start','end','bank','ranking_score','different_offsets','persistent_offsets','last_checkpoint_offsets','attack_only_final_offsets','baseline_stable_offsets','delayed_offsets','immediate_offsets','role'])
            w.writeheader()
            for row in result['ranked_7e_regions']+result['ranked_7f_regions']:
                w.writerow({key:row[key] for key in w.fieldnames})
    if args.targets:
        args.targets.parent.mkdir(parents=True,exist_ok=True)
        args.targets.write_text(','.join(result['selected_writer_addresses'])+'\n',encoding='utf-8')
    print(json.dumps({'status':result['status'],'ranked_7e':result['bank_7e_region_count'],
        'ranked_7f':result['bank_7f_region_count'],'writer_targets':len(result['selected_writer_addresses']),
        'top_7e':result['ranked_7e_regions'][:3]},indent=2))
if __name__=='__main__':main()
