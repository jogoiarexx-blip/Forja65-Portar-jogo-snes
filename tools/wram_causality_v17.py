#!/usr/bin/env python3
"""Conservative A/B WRAM evidence analyzer for SNES native ports.

Consumes FORJA65_WRAM_DIFF_CSV from two deterministic replays sampled at
exactly the same frames. Identifies *candidates* whose observed WRAM deltas
change after a known input fork. No candidate implies a validated score,
collision, bubble removal or stage transition without an external oracle.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

SCHEMA = 'forja65.wram.causality/1'
REQUIRED = ('kind','frame','wram_address','old_value','new_value','changed','emitted','truncated','joy1','nmi','pc')


def parse(path: Path) -> dict:
    result = {'events':defaultdict(dict),'summaries':{},'baselines':set(), 'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    with path.open(newline='', encoding='utf-8-sig') as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or any(k not in reader.fieldnames for k in REQUIRED):
            raise ValueError(f'{path}: incomplete WRAM diff schema')
        latest = -1
        for rowno,row in enumerate(reader, 2):
            try:
                kind = row['kind']
                frame = int(row['frame'])
                if frame < 0 or frame < latest:
                    raise ValueError('frames are not ordered')
                latest=frame
                if kind == 'baseline':
                    if frame in result['baselines'] or any(result[k].get(frame) for k in ('events','summaries')):
                        raise ValueError('duplicate/late baseline')
                    result['baselines'].add(frame)
                elif kind == 'delta':
                    addr = int(row['wram_address'],16)
                    before,after=int(row['old_value']),int(row['new_value'])
                    if not (0x7E0000 <= addr <= 0x7FFFFF and 0 <= before <= 255 and 0 <= after <= 255 and before != after):
                        raise ValueError('invalid WRAM delta')
                    if addr in result['events'][frame]:
                        raise ValueError('duplicate address in sampled frame')
                    result['events'][frame][addr]=(before,after)
                elif kind == 'summary':
                    changed, emitted, truncated=[int(row[key]) for key in ('changed','emitted','truncated')]
                    if frame in result['summaries'] or min(changed,emitted,truncated)<0 or changed != emitted+truncated:
                        raise ValueError('invalid/duplicate summary')
                    if len(result['events'][frame]) != emitted:
                        raise ValueError('summary emitted does not match recorded deltas')
                    result['summaries'][frame]=(changed,emitted,truncated)
                else:
                    raise ValueError(f'unknown kind {kind!r}')
            except (TypeError,ValueError,KeyError) as exc:
                raise ValueError(f'{path}:{rowno}: {exc}') from exc
    if len(result['baselines']) != 1 or not result['summaries']:
        raise ValueError(f'{path}: need one baseline and at least one summary')
    base=next(iter(result['baselines']))
    frames=sorted(result['summaries'])
    if base >= frames[0] or base >= frames[-1]:
        raise ValueError(f'{path}: invalid baseline/frame sequence')
    if any(k not in result['summaries'] for k in result['events']):
        raise ValueError(f'{path}: unpaired delta without summary')
    result['frames']=frames
    result['baseline']=base
    return result



def first_trace_fork(left: Path, right: Path):
    """Compare JOY inputs as held states, not merely matching event line numbers."""
    import re
    pattern=re.compile(r'^frame=(\d+)\s+joy1=([0-9A-Fa-f]{4})\s+joy2=([0-9A-Fa-f]{4})$')
    def read(path):
        frames={}
        last=-1
        for lineno,raw in enumerate(path.read_text(encoding='utf-8-sig').splitlines(),1):
            line=raw.split('#',1)[0].strip()
            if not line:continue
            match=pattern.fullmatch(line)
            if not match:raise ValueError(f'{path}:{lineno}: invalid input event')
            f=int(match.group(1))
            if f<=last:raise ValueError(f'{path}:{lineno}: unordered input frame')
            last=f
            frames[f]=(int(match.group(2),16),int(match.group(3),16))
        if not frames:raise ValueError(f'{path}: empty replay trace')
        return frames
    a,b=read(left),read(right)
    left_state=(0,0);right_state=(0,0)
    for f in sorted(a.keys()|b.keys()):
        left_state=a.get(f,left_state)
        right_state=b.get(f,right_state)
        if left_state!=right_state:return f
    return None

def compare(left: Path, right: Path, fork: int, limit: int = 30) -> dict:
    a,b=parse(left),parse(right)
    if not(a['frames']==b['frames'] and a['baseline']==b['baseline']):
        raise ValueError('sample frames or baseline frame differ; comparison invalid')
    if fork <= a['baseline'] or fork > a['frames'][-1]:
        raise ValueError('input fork is outside the observation window')
    pre=[f for f in a['frames'] if f<fork]
    if not pre:
        raise ValueError('at least one post-baseline pre-fork checkpoint required')
    pre_mismatches=[f for f in pre if a['events'][f]!=b['events'][f] or a['summaries'][f]!=b['summaries'][f]]
    if pre_mismatches:
        raise ValueError(f'pre-fork WRAM activity differs at frames {pre_mismatches[:8]}; causality unproven')
    post=[f for f in a['frames'] if f>=fork]
    truncated_frames=[f for f in a['frames'] if a['summaries'][f][2] or b['summaries'][f][2]]
    addresses=defaultdict(lambda: {'different_samples':0,'base_events':0,'test_events':0,'first_different_frame':None,'examples':[]})
    observed=0
    for frame in post:
        aa,bb=a['events'][frame],b['events'][frame]
        for addr in aa.keys()|bb.keys():
            item=addresses[addr]
            item['base_events']+=int(addr in aa)
            item['test_events']+=int(addr in bb)
            if aa.get(addr)!=bb.get(addr):
                observed+=1
                item['different_samples']+=1
                if item['first_different_frame'] is None:
                    item['first_different_frame']=frame
                if len(item['examples'])<3:
                    item['examples'].append({'frame':frame,'base':aa.get(addr),'test':bb.get(addr)})
    ordered=sorted(((addr,item) for addr,item in addresses.items() if item['different_samples']),key=lambda x:(-x[1]['different_samples'],x[1]['first_different_frame'],x[0]))
    candidates=[{'address':f'{addr:06X}',**item} for addr,item in ordered[:limit]]
    return {'schema':SCHEMA,'fork_frame':fork,'baseline_frame':a['baseline'],'pre_fork_samples':len(pre),'post_fork_samples':len(post),
            'pre_fork_equal':True,'evidence_complete':not bool(truncated_frames),'truncated_frames':truncated_frames[:30],
            'truncated_frame_count':len(truncated_frames),'candidate_count':len(ordered),'candidate_address_samples':observed,
            'candidates':candidates,'source_sha256':{'base':a['source_sha256'],'test':b['source_sha256']},
            'validated':{'input_effect_on_wram':bool(ordered) and not truncated_frames,'score':False,'collision':False,'bubble_removal':False,'stage_change':False},
            'warning':'WRAM differences are hypotheses only. Score, collision, bubble removal and stage completion require known game-state semantics or an independent reference.'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base',required=True,type=Path)
    p.add_argument('--test',required=True,type=Path)
    p.add_argument('--fork',required=True,type=int)
    p.add_argument('--out',type=Path)
    p.add_argument('--limit',type=int,default=30)
    args=p.parse_args()
    if args.limit<1 or args.limit>10000:p.error('limit must be 1..10000')
    try:result=compare(args.base,args.test,args.fork,args.limit)
    except (ValueError,OSError) as exc:p.error(str(exc))
    output=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if args.out:
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(output,encoding='utf-8')
    print(output,end='')

if __name__=='__main__':main()
