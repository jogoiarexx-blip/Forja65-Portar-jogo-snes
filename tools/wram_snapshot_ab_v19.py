#!/usr/bin/env python3
"""Validate exact 128 KiB end-of-frame WRAM snapshots from two real input replays.

Outputs *hypotheses*, never certifies collision, scoring, board clear or next level.
Pre-fork equality, missing frames, malformed manifests and same-ROM QA are hard gates.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import csv
import hashlib
import json
from pathlib import Path
import re

SIZE=131072
SCHEMA='forja65.wram.snapshot-ab/1'
REQUIRED=['frame','file','pc','joy1','bytes']


def load_snapshots(folder: Path):
    manifest=folder/'snapshots.csv'
    if not manifest.is_file():raise ValueError(f'{manifest}: missing')
    frames={};meta={}
    with manifest.open(newline='',encoding='utf-8-sig') as f:
        reader=csv.DictReader(f)
        if reader.fieldnames!=REQUIRED:raise ValueError('bad snapshot manifest columns')
        last=-1
        for row in reader:
            frame=int(row['frame'])
            if frame<=last or frame<0 or not re.fullmatch(r'wram-\d{8,}.bin',row['file']):
                raise ValueError('manifest frames unordered/invalid')
            if int(row['bytes'])!=SIZE:raise ValueError('incomplete snapshot')
            if row['file']!=f'wram-{frame:08d}.bin':raise ValueError('snapshot filename does not match frame')
            blob=(folder/row['file']).read_bytes()
            if len(blob)!=SIZE:raise ValueError('missing, partial or overlong WRAM image')
            frames[frame]=blob
            meta[frame]={'sha256':hashlib.sha256(blob).hexdigest(),'pc':row['pc'],'joy1':row['joy1']}
            last=frame
    if len(frames)<3 or len(frames)>64:raise ValueError('expected 3..64 snapshots')
    return frames,meta


def parse_qa(folder:Path):
    p=folder/'forja65-qa-status.txt'
    content=p.read_text()
    fields=dict(re.findall(r'^([a-z][a-z0-9_]*)=(\S+)$',content,re.M))
    for name in ('rom','frames','runtime_started'):
        if name not in fields:raise ValueError(f'QA missing {name}')
    if fields['runtime_started']!='PASS':raise ValueError('runtime not started')
    return fields


def analyze(base:Path,attack:Path,fork:int,writer_map:Path|None=None,limit:int=60):
    if fork<1 or not 1<=limit<=1000:raise ValueError('invalid fork/limit')
    b, bm=load_snapshots(base);a,am=load_snapshots(attack)
    if set(a)!=set(b):raise ValueError('A/B snapshot frames do not match')
    frames=sorted(b)
    if frames[0]>=fork or frames[-1]<=fork:raise ValueError('snapshots do not span input fork')
    # Strict pre-fork control: entire WRAM matches, not just selected candidates.
    prefix=[f for f in frames if f<fork]
    if not prefix:raise ValueError('missing pre-fork WRAM evidence')
    if any(b[f]!=a[f] for f in prefix):raise ValueError('WRAM mismatch before input fork')
    qa_a,qa_b=parse_qa(base),parse_qa(attack)
    if qa_a['rom']!=qa_b['rom']:raise ValueError('different ROM fingerprints')
    if int(qa_a['frames'])<=frames[-1] or int(qa_b['frames'])<=frames[-1]:
        raise ValueError('QA frames do not cover last snapshot')
    by_addr=defaultdict(list); totals=[]
    for frame in frames:
        mismatch=0
        if frame>=fork:
            left,right=b[frame],a[frame]
            for off,(bv,av) in enumerate(zip(left,right)):
                if bv!=av:
                    mismatch+=1
                    by_addr[off].append([frame,bv,av])
        totals.append({'frame':frame,'different_wram_bytes':mismatch,'baseline_sha256':bm[frame]['sha256'],'attack_sha256':am[frame]['sha256']})
    known=defaultdict(set)
    if writer_map:
        attr=json.loads(writer_map.read_text())
        if attr.get('schema')!='forja65.wram.writer-attribution/1':raise ValueError('bad writer attribution schema')
        for item in attr['addresses']:
            addr=int(item['address'],16)-0x7e0000
            for mode in ('attack','baseline'):
                known[addr].update(item['writer_pcs'][mode])
    # Across many snapshots, persistent differences rank above one-frame oscillations.
    last=frames[-1];rows=[]
    for off,events in by_addr.items():
        address=f'{0x7e0000+off:06X}'
        late=(events[-1][0]==last)
        writer=sorted(known.get(off,set()))
        excluded='scheduler/context likely' if 0x1c60<=off<=0x1c80 else None
        rows.append({'address':address,'different_snapshots':len(events),
          'first_difference_frame':events[0][0], 'last_difference_frame':events[-1][0],
          'persists_at_final_snapshot':late,'writer_pcs_from_previous_audit':writer,
          'classification':'CANDIDATE_ONLY', 'known_scheduler_region':bool(excluded),
          'samples': [{'frame':x,'baseline':y,'attack':z} for x,y,z in events[:4]]})
    rows.sort(key=lambda x:(x['known_scheduler_region'],-int(x['persists_at_final_snapshot']),
      -len(x['writer_pcs_from_previous_audit']),-x['different_snapshots'],x['first_difference_frame'],x['address']))
    # Contiguous changed-memory ranges aid identifying tables/arrays rather than counters.
    offsets=sorted(by_addr)
    ranges=[]
    for off in offsets:
        if ranges and off==ranges[-1][1]+1:ranges[-1][1]=off
        else:ranges.append([off,off])
    clusters=[{'start':f'{0x7e0000+x:06X}','end':f'{0x7e0000+y:06X}','length':y-x+1}
        for x,y in ranges if y-x+1>=4]
    clusters.sort(key=lambda x:(-x['length'],x['start']))
    return {'schema':SCHEMA,'status':'CAUSAL_DIFFERENCES_CONFIRMED' if by_addr else 'NO_DIFFERENCE',
      'board_clear':'NOT_PROVEN','collision':'NOT_PROVEN','score':'NOT_PROVEN','next_stage':'NOT_PROVEN',
      'reference_validation':'NOT_PROVIDED','rom_fingerprint':qa_a['rom'],
      'fork_frame':fork,'snapshot_frames':frames,'pre_fork_full_wram_equal':True,
      'baseline_final_frames':int(qa_b['frames']),'attack_final_frames':int(qa_a['frames']),
      'total_different_addresses':len(rows),'frame_evidence':totals,
      'ranked_candidates':rows[:limit],'contiguous_changed_ranges':clusters[:40],
      'warning':'A/B differences show input causality, not game-rule semantics. No independent reference-oracle/winning replay.'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--baseline',required=True,type=Path);p.add_argument('--attack',required=True,type=Path)
    p.add_argument('--fork',required=True,type=int);p.add_argument('--writer-map',type=Path)
    p.add_argument('--limit',type=int,default=60);p.add_argument('--out',type=Path)
    args=p.parse_args()
    try:r=analyze(args.baseline,args.attack,args.fork,args.writer_map,args.limit)
    except (OSError,ValueError,KeyError,TypeError) as e:p.error(str(e))
    s=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    if args.out:args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(s,encoding='utf-8')
    print(json.dumps({'status':r['status'],'pre_fork_full_wram_equal':r['pre_fork_full_wram_equal'],
      'total_different_addresses':r['total_different_addresses'],
      'top_candidates':r['ranked_candidates'][:10]},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
