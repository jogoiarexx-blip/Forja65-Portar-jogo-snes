#!/usr/bin/env python3
"""Read-only per-address WRAM sampling analysis for Forja65 v0.4.19.

Comparisons are between end-of-frame samples, NOT every CPU write. The output
never equates WRAM change to a countdown, movement, shooting or gameplay.
"""
import argparse
from collections import Counter, defaultdict
import csv
import json
from pathlib import Path

COLUMNS={'frame','address','old','new','changed_total','shown','baseline'}


def load(path):
    frames={}
    last=-1
    with Path(path).open(newline='',encoding='utf-8-sig') as stream:
        reader=csv.DictReader(stream)
        if not reader.fieldnames or not COLUMNS.issubset(reader.fieldnames):
            raise ValueError('WRAM CSV missing required columns')
        for row in reader:
            frame=int(row['frame'])
            if frame<0 or frame<last:raise ValueError('Frames not sorted')
            last=frame
            total=int(row['changed_total']);shown=int(row['shown']);base=int(row['baseline'])
            if total<0 or shown<0 or shown>total or base not in (0,1):raise ValueError('Invalid counts')
            rec=frames.setdefault(frame,{'total':total,'shown':shown,'baseline':bool(base),'changes':{}})
            if (rec['total'],rec['shown'],rec['baseline']) != (total,shown,bool(base)):
                raise ValueError('Inconsistent sample summary')
            if row['address']:
                address=int(row['address'],16)
                if not (0x7e0000<=address<=0x7fffff):raise ValueError('Invalid WRAM address')
                old=int(row['old'],16);new=int(row['new'],16)
                if not (0<=old<=255 and 0<=new<=255) or old==new or base:raise ValueError('Invalid changed byte')
                if address in rec['changes']:raise ValueError('Duplicate address in frame')
                rec['changes'][address]=(old,new)
            elif row['old'] or row['new'] or shown:raise ValueError('Malformed empty sample')
    if not frames:raise ValueError('No WRAM snapshots')
    for frame,rec in frames.items():
        if len(rec['changes'])!=rec['shown']:
            raise ValueError(f'Incomplete WRAM sample at frame {frame}')
        if rec['baseline'] and (rec['total'] or rec['shown']):raise ValueError('Baseline is not a delta')
    return frames


def analyze(path_a,path_b=None):
    a=load(path_a)
    b=load(path_b) if path_b is not None else None
    frequency=Counter();first={};truncated=[]
    for frame,record in a.items():
        if record['total']>record['shown']:truncated.append(frame)
        for addr in record['changes']:
            frequency[addr]+=1;first.setdefault(addr,frame)
    hot=[{'address':f'{addr:06X}','observed_samples_changed':n,'first_sample':first[addr]} for addr,n in frequency.most_common(32)]
    result={'schema':'forja65.wram-delta-audit.v1','samples_a':len(a),
            'truncated_samples_a':len(truncated),'truncation_frames':truncated[:20],
            'hot_addresses_a':hot,'gameplay_verified':False,
            'limits':['End-of-frame differences are not individual writes or proof of a counter variable.',
                      'Capped records omit other changing addresses; raise FORJA65_WRAM_DELTA_LIMIT for full sampling.']}
    if b is not None:
        common=sorted(set(a)&set(b));differences=[]
        for frame in common:
            ra=a[frame];rb=b[frame]
            if ra['baseline'] or rb['baseline']:continue
            keys=set(ra['changes'])|set(rb['changes'])
            changed=[k for k in keys if ra['changes'].get(k)!=rb['changes'].get(k)]
            if changed:
                differences.append({'frame':frame,'addresses':[f'{k:06X}' for k in sorted(changed)[:32]],
                                    'comparison_complete':ra['total']==ra['shown'] and rb['total']==rb['shown']})
        result['samples_b']=len(b)
        result['shared_frames']=len(common)
        result['first_observed_delta_difference']=differences[0] if differences else None
        result['differing_sample_count']=len(differences)
        result['truncated_samples_b']=sum(x['total']>x['shown'] for x in b.values())
        result['limits'].append('Different delta lists do not prove different absolute WRAM values; first sampled frame is only a baseline.')
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('trace_a',type=Path)
    parser.add_argument('--trace-b',type=Path)
    parser.add_argument('--out',type=Path)
    args=parser.parse_args()
    try:r=analyze(args.trace_a,args.trace_b)
    except (ValueError,OSError) as e:parser.error(str(e))
    output=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    if args.out:args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(output)
    print(output,end='')

if __name__=='__main__':main()
