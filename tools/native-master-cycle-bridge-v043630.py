#!/usr/bin/env python3
"""Bridge native traces containing captured master_cycle to timing differential format.

Never estimates cycles from event ordinals. Refuses traces lacking real timestamps.
"""
import argparse
import csv
import json
from pathlib import Path

REQUIRED = {'seq', 'master_cycle', 'kind', 'source', 'address', 'value'}

def convert(source, destination, origins=('CPU',)):
    events = []
    previous_seq = -1
    previous_cycle = -1
    with Path(source).open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(line for line in f if line.strip() and not line.startswith('#'))
        if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
            raise ValueError('Native trace must contain captured master_cycle and required event fields; synthetic seq is not timing')
        for line, row in enumerate(reader, 2):
            seq = int(row['seq'], 0)
            if seq <= previous_seq:
                raise ValueError(f'Nonmonotonic event sequence at line {line}')
            previous_seq = seq
            kind = row['kind'].strip().lower()
            if kind not in ('read', 'write') or row['source'].strip().upper() not in origins:
                continue
            cycle = int(row['master_cycle'], 0)
            address = int(row['address'], 0)
            value = int(row['value'], 0)
            dummy = (row.get('dummy') or 'false').strip().lower()
            if cycle < previous_cycle or cycle < 0 or not 0 <= address <= 0xffffff or not 0 <= value <= 255 or dummy not in ('true','false','0','1'):
                raise ValueError(f'Invalid timed bus event at line {line}')
            previous_cycle = cycle
            events.append({'master_cycle':cycle,'address':address,'operation':kind,'value':value,'dummy':dummy in ('true','1')})
    dest = Path(destination)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=('master_cycle','address','operation','value','dummy'))
        writer.writeheader()
        writer.writerows(events)
    return {'events':len(events), 'timing_basis':'captured_master_cycle', 'clock_accuracy':'source-provided; not independently verified'}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('native_csv', type=Path)
    p.add_argument('output_csv', type=Path)
    p.add_argument('--source', action='append')
    a = p.parse_args()
    try:
        print(json.dumps(convert(a.native_csv, a.output_csv, tuple(x.upper() for x in (a.source or ['CPU']))), indent=2))
    except (ValueError, OSError) as exc:
        print(json.dumps({'error':str(exc)}))
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
