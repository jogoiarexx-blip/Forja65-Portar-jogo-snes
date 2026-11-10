#!/usr/bin/env python3
"""Portable, game-agnostic read-only 65C816 WRAM trace/snapshot verifier.

No game addresses, controller buttons, frame numbers or ROM files hardcoded.
It catches dropped writes by reconstructing every watched byte at checkpoints.
"""
from __future__ import annotations
from collections import Counter,defaultdict
import csv,hashlib,json
from pathlib import Path
from wram_snapshot_ab_v19 import SIZE,load_snapshots,parse_qa

HEADER=['frame','address','old','new','writer_pc','bus','joy1','nmi']
SCHEMA='forja65.wram.generic-writer-verifier/1'


def verify_session(folder:Path,addresses,window_start:int,window_end:int,cap:int,requested_frames:int):
    addresses=list(addresses)
    if not addresses or len(addresses)>256 or len(set(addresses))!=len(addresses):
        raise ValueError('need 1..256 unique addresses')
    if any(not isinstance(a,str) or len(a)!=6 or any(c not in '0123456789ABCDEF' for c in a) or
           not 0x7e0000<=int(a,16)<=0x7fffff for a in addresses):
        raise ValueError('all addresses must be canonical 7E/7F hex')
    if not 0<=window_start<=window_end<requested_frames or not 1<=cap<=1000000:
        raise ValueError('invalid observation window/cap')
    qa=parse_qa(folder)
    if int(qa['frames'])<requested_frames:raise ValueError('incomplete runtime QA')
    images,meta=load_snapshots(folder)
    available=sorted(images)
    # The writer log starts at window_start, while the snapshot manifest may
    # contain multiple earlier checkpoints used to prove the common A/B fork.
    # Anchor reconstruction at the *last* pre-window state: intervening earlier
    # WRAM changes cannot be required from a trace that intentionally starts
    # later. compare_pair still checks all pre-fork snapshots byte for byte.
    anchors=[frame for frame in available if frame<window_start]
    if not anchors or available[-1]!=window_end:
        raise ValueError('a pre-window snapshot and final observed frame are required')
    anchor=anchors[-1]
    checkpoints=[frame for frame in available if frame>=anchor]
    path=folder/'writers.csv'
    if not path.is_file():raise ValueError('writer CSV missing (zero writes still need explicit header)')
    current={a:images[checkpoints[0]][int(a,16)-0x7e0000] for a in addresses}
    events=[];pc_counts=Counter();addr_pc=defaultdict(Counter)
    with path.open(newline='',encoding='utf-8-sig') as fd:
        reader=csv.DictReader(fd)
        if reader.fieldnames!=HEADER:raise ValueError('writer CSV schema mismatch')
        last_frame=-1
        for lineno,row in enumerate(reader,2):
            try:
                frame=int(row['frame']);address=row['address'].upper().zfill(6)
                old,new=int(row['old']),int(row['new']);pc=row['writer_pc'].upper().zfill(6)
                if not window_start<=frame<=window_end or frame<last_frame:raise ValueError('frame ordering/window mismatch')
                if address not in current:raise ValueError('non-target address found')
                if not (0<=old<=255 and 0<=new<=255 and old!=new):raise ValueError('invalid/idempotent write')
                if len(pc)!=6 or any(c not in '0123456789ABCDEF' for c in pc):raise ValueError('invalid PC')
                if row['bus'] not in ('bus','2180'):raise ValueError('unknown write bus')
                int(row['joy1']);int(row['nmi'])
                events.append((frame,address,old,new,pc));last_frame=frame
                pc_counts[pc]+=1;addr_pc[address][pc]+=1
            except (KeyError,ValueError,TypeError) as exc:
                raise ValueError(f'{path}:{lineno}: {exc}') from exc
    if len(events)>=cap:raise ValueError('writer trace cap reached')
    idx=0;checks=0;previous=checkpoints[0]
    for frame in checkpoints[1:]:
        while idx<len(events) and events[idx][0]<=frame:
            when,addr,old,new,pc=events[idx]
            if when<=previous or current[addr]!=old:
                raise ValueError(f'missing or inconsistent write: {when} {addr} {pc}')
            current[addr]=new;idx+=1
        img=images[frame]
        for addr,value in current.items():
            checks+=1
            if img[int(addr,16)-0x7e0000]!=value:
                raise ValueError(f'writer log cannot explain snapshot {frame} {addr}')
        previous=frame
    if idx!=len(events):raise ValueError('writer log has unchecked later records')
    return {'schema':SCHEMA,'status':'TARGETS_RECONCILED','rom_qa':qa['rom'],
       'checkpoints':checkpoints,'anchor_frame':anchor,'pre_window_snapshots_excluded_from_reconstruction':len(anchors)-1,'target_bytes':len(addresses),'event_count':len(events),
       'snapshot_checks':checks,'pcs':dict(sorted(pc_counts.items())),
       'address_writer_pcs':{a:dict(sorted(addr_pc[a].items())) for a in addresses},
       'sha256':{'csv':hashlib.sha256(path.read_bytes()).hexdigest(),
                 'snapshots_manifest':hashlib.sha256((folder/'snapshots.csv').read_bytes()).hexdigest()},
       'validated':{'writer_chain':True,'score':False,'collision':False,'board':False,'next_stage':False}}


def compare_pair(control:Path,attack:Path,addresses,window_start:int,window_end:int,cap:int,frames:int,fork_frame:int):
    b=verify_session(control,addresses,window_start,window_end,cap,frames)
    a=verify_session(attack,addresses,window_start,window_end,cap,frames)
    if b['rom_qa']!=a['rom_qa'] or b['checkpoints']!=a['checkpoints']:
        raise ValueError('A/B ROM or checkpoint mismatch')
    left,_=load_snapshots(control);right,_=load_snapshots(attack)
    if set(left)!=set(right):raise ValueError('A/B full snapshot frame set mismatch')
    if not any(f<fork_frame for f in left):raise ValueError('missing pre-fork snapshot')
    for f in left:
        if f<fork_frame and left[f]!=right[f]:raise ValueError('pre-fork 128KiB WRAM mismatch')
    return {'schema':SCHEMA,'status':'PAIR_RECONCILED_WRITERS_ONLY',
       'control':b,'attack':a,'pre_fork_full_wram_equal':True,
       'caveat':'A/B writer correlation alone does not establish gameplay semantics.'}

if __name__=='__main__':
    import argparse,sys
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--control',required=True,type=Path)
    p.add_argument('--attack',required=True,type=Path)
    p.add_argument('--addresses',required=True,help='comma-separated uppercase WRAM addresses, e.g. 7E0910,7E091C')
    p.add_argument('--start',required=True,type=int)
    p.add_argument('--end',required=True,type=int)
    p.add_argument('--cap',default=500000,type=int)
    p.add_argument('--frames',required=True,type=int)
    p.add_argument('--fork',required=True,type=int)
    p.add_argument('--out',type=Path)
    args=p.parse_args()
    try:
        report=compare_pair(args.control,args.attack,args.addresses.split(','),
                 args.start,args.end,args.cap,args.frames,args.fork)
        content=json.dumps(report,indent=2)+'\n'
        if args.out:
            args.out.parent.mkdir(parents=True,exist_ok=True)
            args.out.write_text(content,encoding='utf-8')
        print(json.dumps({'status':report['status'],
            'control_writes':report['control']['event_count'],
            'attack_writes':report['attack']['event_count']},indent=2))
    except (OSError,ValueError,KeyError) as exc:
        print('NOT_VALIDATED:',exc,file=sys.stderr)
        raise SystemExit(2)
