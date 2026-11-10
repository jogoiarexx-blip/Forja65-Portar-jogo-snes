#!/usr/bin/env python3
"""Select bounded WRAM write watches from an actual differential capture.

Selection is investigative only: a ranked address is not a proven timer.
"""
import argparse
import json
import re
from pathlib import Path

ADDR = re.compile(r'^\$?(7[EF][0-9A-Fa-f]{4})$')

def select(data, limit=24):
    if data.get('schema') != 'forja65.wram-differential.v1':
        raise ValueError('Unexpected WRAM differential schema')
    if data.get('insufficient_evidence'):
        raise ValueError('Differential capture reports insufficient evidence')
    rows = data.get('candidates', [])
    found = []
    for row in rows:
        raw = str(row.get('snes_address', ''))
        match = ADDR.fullmatch(raw)
        if not match:
            raise ValueError('Invalid candidate address: ' + raw)
        addr = match.group(1).upper()
        if addr not in found:
            found.append(addr)
        if len(found) == limit:
            break
    if not found:
        raise ValueError('No candidate addresses; do not run unfiltered write capture')
    return found

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('candidates', type=Path)
    p.add_argument('--limit', type=int, default=24)
    p.add_argument('--out', type=Path)
    a = p.parse_args()
    if not 1 <= a.limit <= 128:
        p.error('Limit must be from 1 to 128')
    data = json.loads(a.candidates.read_text(encoding='utf-8'))
    addresses = select(data, a.limit)
    if a.out:
        a.out.parent.mkdir(parents=True, exist_ok=True)
        a.out.write_text('\n'.join(addresses) + '\n', encoding='ascii')
    print(','.join(addresses))

if __name__ == '__main__':
    main()
