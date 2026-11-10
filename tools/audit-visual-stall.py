#!/usr/bin/env python3
"""Audit a native port's frame progress without mistaking CPU activity for gameplay.

Read-only; no gameplay state, timing, input or translated CPU code is modified.
A constant framebuffer is *suspicious*, not proof of a bug: a paused game or
intentional splash can have the same signature. Use a captured screenshot too.
"""
import argparse
import csv
import json
import sys
from pathlib import Path

COLUMNS = {'frame','pc','joy1','joy2','autojoy1','autojoy2','instructions','nmi','fb_fnv1a64'}


def audit(path, start=0, end=None, min_span=180):
    if min_span < 1 or start < 0 or (end is not None and end < start):
        raise ValueError('Invalid frame window')
    with Path(path).open(newline='', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames or not COLUMNS.issubset(reader.fieldnames):
            raise ValueError('Missing progress CSV columns')
        rows = []
        all_last = -1
        for r in reader:
            frame = int(r['frame'])
            if frame <= all_last:
                raise ValueError('Frames must increase monotonically and uniquely')
            all_last = frame
            if frame < start or (end is not None and frame > end):
                continue
            rows.append({'frame': frame, 'hash': r['fb_fnv1a64'].strip().lower(),
                         'nmi': int(r['nmi']), 'instructions': int(r['instructions']),
                         'joy1': int(r['joy1'],16), 'joy2': int(r['joy2'],16),
                         'autojoy1': int(r['autojoy1'],16), 'autojoy2': int(r['autojoy2'],16),
                         'pc': r['pc']})
    if len(rows) < 2:
        return {'status':'insufficient_samples','samples':len(rows),'start':start,'end':end}
    for i in range(1,len(rows)):
        if rows[i]['nmi'] < rows[i-1]['nmi'] or rows[i]['instructions'] < rows[i-1]['instructions']:
            raise ValueError('NMI/instructions counters must be nondecreasing')
    groups = []
    for r in rows:
        if not groups or groups[-1][-1]['hash'] != r['hash']:
            groups.append([r])
        else:
            groups[-1].append(r)
    best = max(groups, key=lambda g:(g[-1]['frame']-g[0]['frame'],len(g)))
    first,last = best[0],best[-1]
    span = last['frame']-first['frame']
    active_nmi = last['nmi']>first['nmi']
    active_cpu = last['instructions']>first['instructions']
    saw_input = any(r['joy1'] or r['joy2'] for r in best)
    result = {'status': 'static_visual_with_active_cpu' if span>=min_span and active_nmi and active_cpu else 'no_confirmed_long_static_window',
              'first_frame':first['frame'],'last_frame':last['frame'],'span_frames':span,
              'samples_in_run':len(best),'total_samples':len(rows),'hash':first['hash'],
              'nmi_delta':last['nmi']-first['nmi'],'instruction_delta':last['instructions']-first['instructions'],
              'input_during_static_window':saw_input,
              'last_pc':last['pc'],
              'interpretation':'Constant output pixels do not by themselves prove frozen gameplay or a faulty PPU.'}
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv',type=Path)
    parser.add_argument('--start',type=int,default=0)
    parser.add_argument('--end',type=int)
    parser.add_argument('--min-span',type=int,default=180)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    try:
        result=audit(args.csv,args.start,args.end,args.min_span)
    except (ValueError,OSError) as exc:
        parser.exit(2,'Visual-stall audit rejected: '+str(exc)+'\n')
    text=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(text,encoding='utf8')
    print(text,end='')

if __name__ == '__main__':main()
