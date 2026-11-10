#!/usr/bin/env python3
"""Compare native runtime scheduler-clock bus captures without claiming hardware-cycle accuracy.

Only emitted events are compared. Missing/dummy bus cycles cannot be inferred.
Emits the first differing event and the associated PC/frame when available.
"""
import argparse
import csv
import json
from pathlib import Path

REQUIRED = {'seq','master_cycle','frame','pc','kind','source','address','value','dummy'}


def load(path, origins=('CPU',)):
    rows = []
    last_seq = -1
    last_cycle = -1
    with Path(path).open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(line for line in stream if line.strip() and not line.startswith('#'))
        if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
            raise ValueError('Expected captured native bus-clock CSV with PC, frame and scheduler master_cycle')
        for lineno, row in enumerate(reader,2):
            try:
                seq=int(row['seq'],0)
                cycle=int(row['master_cycle'],0)
                frame=int(row['frame'],0)
                pc=int(row['pc'],0)
                address=int(row['address'],0)
                value=int(row['value'],0)
                source=row['source'].strip().upper()
                kind=row['kind'].strip().lower()
                dummy=row['dummy'].strip().lower()
            except (TypeError, ValueError, AttributeError) as exc:
                raise ValueError(f'Malformed bus record at {path}:{lineno}') from exc
            if (seq<=last_seq or cycle<last_cycle or frame<0 or not 0<=pc<=0xffffff or
                not 0<=address<=0xffffff or not 0<=value<=255 or
                kind not in ('read','write') or dummy not in ('unknown','true','false')):
                raise ValueError(f'Invalid bus record at {path}:{lineno}')
            last_seq,last_cycle=seq,cycle
            if source not in origins:
                continue
            rows.append({'seq':seq,'master_cycle':cycle,'frame':frame,'pc':pc,
                         'kind':kind,'source':source,'address':address,'value':value,
                         'dummy':dummy})
    return rows


def compare(a,b,check_clock=True):
    keys=['kind','address','value','dummy']
    if check_clock:
        keys.append('master_cycle')
    for i in range(max(len(a),len(b))):
        left=a[i] if i<len(a) else None
        right=b[i] if i<len(b) else None
        if left is None or right is None or any(left[key]!=right[key] for key in keys):
            return {'match':False,'first_divergence':i,'reference':left,'candidate':right,
                    'reference_events':len(a),'candidate_events':len(b)}
    return {'match':True,'first_divergence':None,'reference_events':len(a),'candidate_events':len(b)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference',type=Path)
    parser.add_argument('candidate',type=Path)
    parser.add_argument('--ignore-clock',action='store_true',help='Compare event order/values without scheduler-clock timestamps')
    parser.add_argument('--source',action='append',default=None,help='Origin filter; default CPU')
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    sources=tuple(x.upper() for x in (args.source or ['CPU']))
    try:
        result=compare(load(args.reference,sources),load(args.candidate,sources),not args.ignore_clock)
    except (ValueError,OSError) as exc:
        result={'match':False,'error':str(exc)}
    result['timing_basis']='runtime_scheduler_clock'
    result['bus_microcycle_accurate']=False
    result['dummy_status']='unclassified unless source explicitly annotates it'
    result['comparison_mode']='event_order_only' if args.ignore_clock else 'scheduler_clock_and_events'
    output=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    print(output,end='')
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(output,encoding='utf-8')
    return 0 if result['match'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
