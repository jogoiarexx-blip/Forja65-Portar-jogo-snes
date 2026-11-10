#!/usr/bin/env python3
"""Compare ordered CPU bus events from CSV traces; fail on first divergence."""
import argparse
import csv
import json
from pathlib import Path

FIELDS = ('cycle', 'address', 'operation', 'value')
ALIASES = {'cycle': ('cycle','tick','step'), 'address': ('address','addr'), 'operation': ('operation','op','rw','type'), 'value': ('value','data')}

def read_trace(path):
    with open(path, newline='', encoding='utf-8-sig') as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames:
            raise ValueError(f'{path}: missing CSV header')
        cols = {}
        for field, aliases in ALIASES.items():
            cols[field] = next((c for c in reader.fieldnames if c.strip().lower() in aliases), None)
            if cols[field] is None:
                raise ValueError(f'{path}: missing {field} column')
        result = []
        for n, row in enumerate(reader, 2):
            if not any((v or '').strip() for v in row.values() if isinstance(v, str)):
                continue
            event = {key: (row[col] or '').strip().lower() for key, col in cols.items()}
            for key in ('cycle','address','value'):
                raw = event[key].removeprefix('$')
                if key == 'cycle':
                    event[key] = int(raw, 0) if raw.startswith('0x') else int(raw, 10)
                else:
                    event[key] = int(raw, 16) if raw.startswith('0x') or any(c in 'abcdef' for c in raw) else int(raw, 10)
            if event['operation'] in ('r','read'): event['operation'] = 'read'
            if event['operation'] in ('w','write'): event['operation'] = 'write'
            result.append(event)
        return result

def compare(a,b):
    for i in range(max(len(a),len(b))):
        left = a[i] if i < len(a) else None
        right = b[i] if i < len(b) else None
        if left != right:
            return {'match':False,'first_divergence':i,'reference':left,'candidate':right,'reference_events':len(a),'candidate_events':len(b)}
    return {'match':True,'first_divergence':None,'reference_events':len(a),'candidate_events':len(b)}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference',type=Path)
    parser.add_argument('candidate',type=Path)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    result=compare(read_trace(args.reference),read_trace(args.candidate))
    rendered=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    print(rendered,end='')
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(rendered,encoding='utf-8')
    return 0 if result['match'] else 1
if __name__=='__main__':
    raise SystemExit(main())
