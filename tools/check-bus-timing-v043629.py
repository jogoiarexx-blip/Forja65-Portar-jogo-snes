#!/usr/bin/env python3
"""Compare real timestamped bus traces; reject synthetic event-index clocks.

Input CSV: master_cycle,address,operation,value (optional dummy column).
Timestamps must be captured by an instrumented runtime/reference, never inferred.
"""
import argparse
import csv
import json
from pathlib import Path

REQUIRED = {'master_cycle', 'address', 'operation', 'value'}

def load(path):
    with Path(path).open(newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
            raise ValueError('Requires real master_cycle,address,operation,value columns; event-index cycle is unsupported')
        rows = []
        last = -1
        for line, row in enumerate(reader, 2):
            if not any((v or '').strip() for v in row.values() if isinstance(v, str)):
                continue
            cycle = int(row['master_cycle'], 0)
            addr = int(row['address'], 0)
            value = int(row['value'], 0)
            op = row['operation'].strip().lower()
            dummy = (row.get('dummy') or 'false').strip().lower()
            if cycle < last or not 0 <= addr <= 0xffffff or not 0 <= value <= 255 or op not in ('read','write') or dummy not in ('true','false','0','1'):
                raise ValueError(f'Invalid event at line {line}')
            last = cycle
            rows.append({'master_cycle':cycle,'address':addr,'operation':op,'value':value,'dummy':dummy in ('true','1')})
    return rows

def compare(reference, candidate):
    for i in range(max(len(reference), len(candidate))):
        a = reference[i] if i < len(reference) else None
        b = candidate[i] if i < len(candidate) else None
        if a != b:
            return {'match':False,'first_divergence':i,'reference':a,'candidate':b,'reference_events':len(reference),'candidate_events':len(candidate)}
    return {'match':True,'first_divergence':None,'reference_events':len(reference),'candidate_events':len(candidate)}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('reference',type=Path)
    p.add_argument('candidate',type=Path)
    p.add_argument('--output',type=Path)
    a=p.parse_args()
    try:
        result=compare(load(a.reference),load(a.candidate))
    except (ValueError, OSError) as e:
        result={'match':False,'error':str(e)}
    result['timing_basis']='captured_master_cycle_required'
    content=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    print(content,end='')
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(content,encoding='utf-8')
    return 0 if result['match'] else 1

if __name__=='__main__':
    raise SystemExit(main())
