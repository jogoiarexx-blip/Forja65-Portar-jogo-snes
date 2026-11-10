#!/usr/bin/env python3
"""Convert native FORJA_TRACE CSV to ordered bus events for differential comparison.

The native trace sequence is an event ordinal, NOT a hardware cycle count.
"""
import argparse
import csv
import json
from pathlib import Path

FIELDS = ('seq','frame','routine','pc','kind','space','address','value','source')

def convert(source, destination, origins=('CPU',), strict=True):
    count = 0
    selected = 0
    with Path(source).open(encoding='utf-8-sig', newline='') as inp, Path(destination).open('w', encoding='utf-8', newline='') as out:
        lines = (line for line in inp if line.strip() and not line.startswith('#'))
        reader = csv.DictReader(lines)
        if not reader.fieldnames or not set(FIELDS).issubset(reader.fieldnames):
            raise ValueError('Native trace missing required columns')
        writer = csv.DictWriter(out, fieldnames=('cycle','address','operation','value'))
        writer.writeheader()
        previous = -1
        for row in reader:
            seq = int(row['seq'])
            if seq <= previous:
                raise ValueError(f'Non-monotonic native event sequence: {seq}')
            previous = seq
            count += 1
            kind = row['kind'].strip().lower()
            if kind not in ('read','write') or row['source'].strip().upper() not in origins:
                continue
            address = int(row['address'], 0)
            value = int(row['value'], 0)
            if strict and not (0 <= address <= 0xffffff and 0 <= value <= 255):
                raise ValueError(f'Invalid bus event at seq {seq}')
            writer.writerow({'cycle': selected, 'address': address, 'operation': kind, 'value': value})
            selected += 1
    return {'native_events': count, 'bus_events': selected, 'clock_accuracy': False,
            'note': 'cycle column is a consecutive bus-event index, not SNES master cycles'}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('native_csv', type=Path)
    p.add_argument('output_csv', type=Path)
    p.add_argument('--source', action='append', default=None, help='Origin (default CPU); repeatable')
    p.add_argument('--allow-wide-values', action='store_true')
    a = p.parse_args()
    a.output_csv.parent.mkdir(parents=True, exist_ok=True)
    print(json.dumps(convert(a.native_csv, a.output_csv,
                             tuple(s.upper() for s in (a.source or ['CPU'])),
                             not a.allow_wide_values), ensure_ascii=False, indent=2))
if __name__ == '__main__':
    main()
