#!/usr/bin/env python3
"""Rank real PPU register accesses before attempting unsafe fast paths."""
import argparse
import csv
import json
from pathlib import Path


def analyze(path, limit=10):
    with path.open(newline='') as f:
        rows = list(csv.DictReader(line for line in f if not line.startswith('#')))
    parsed = []
    seen = set()
    for row in rows:
        key = row['register'].strip().lower()
        if key in seen: raise ValueError('duplicate register ' + key)
        seen.add(key)
        if not key.startswith('0x') or len(key) != 6: raise ValueError('invalid register')
        r,w=int(row['reads']),int(row['writes'])
        if r<0 or w<0 or int(row['total'])!=r+w: raise ValueError('inconsistent counters')
        parsed.append(dict(register=key,reads=r,writes=w,total=r+w))
    parsed.sort(key=lambda v:(-v['total'],v['register']))
    n=sum(r['total'] for r in parsed)
    return {'total_accesses':n,'registers_count':len(parsed),
            'hotspots':[{**p,'share_percent':round(100*p['total']/n,2) if n else 0} for p in parsed[:limit]]}


def main():
    p=argparse.ArgumentParser();p.add_argument('csv',type=Path)
    p.add_argument('--output',type=Path);a=p.parse_args()
    try:
        o=analyze(a.csv)
        contents=json.dumps(o,indent=2)+'\n'
        if a.output: a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(contents)
        print(contents)
    except (KeyError,ValueError,OSError) as e:
        print('PPU_HOTSPOT_FAIL',str(e));return 2
    return 0
if __name__=='__main__':raise SystemExit(main())
