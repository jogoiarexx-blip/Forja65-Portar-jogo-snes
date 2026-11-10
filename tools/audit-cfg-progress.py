#!/usr/bin/env python3
"""Compare ROM port CFG failures without mistaking CPU coverage for playable progress.

Usage: audit-cfg-progress.py baseline-failure.txt candidate-failure.txt
Expects the runtime's forja65-cpu-failure.txt records (frames, instructions, last_cpu_pc).
Does not claim gameplay or hardware equivalence.
"""
import argparse
import json
import re
from pathlib import Path


def read_failure(path):
    fields = {}
    for raw in Path(path).read_text(encoding='utf8').splitlines():
        if '=' not in raw:
            continue
        name, val = raw.split('=', 1)
        if name.strip() in ('frames', 'instructions', 'last_cpu_pc'):
            key = name.strip()
            if key in fields:
                raise ValueError('duplicate failure field: '+key)
            val = val.strip()
            if not re.fullmatch(r'0x[0-9a-fA-F]+|\d+', val):
                raise ValueError('invalid failure field: '+key)
            fields[key] = int(val, 0) if val.lower().startswith('0x') else int(val)
    if set(fields) != {'frames', 'instructions', 'last_cpu_pc'}:
        raise ValueError('incomplete CPU failure record')
    if fields['frames'] < 0 or fields['instructions'] < 0 or fields['last_cpu_pc'] > 0xffffff:
        raise ValueError('CPU failure values out of range')
    return fields


def compare(before, after):
    a, b = read_failure(before), read_failure(after)
    delta_frames = b['frames'] - a['frames']
    delta_instructions = b['instructions'] - a['instructions']
    return {
        'baseline': a, 'candidate': b, 'delta_frames': delta_frames,
        'delta_instructions': delta_instructions,
        'runtime_advanced': delta_frames > 0 or (delta_frames == 0 and delta_instructions > 0),
        'status': 'more_frames' if delta_frames > 0 else ('more_instructions_same_frame' if delta_instructions > 0 and delta_frames == 0 else ('regression_or_incomparable' if delta_frames < 0 or delta_instructions < 0 else 'no_measured_advance')),
        'gameplay_validated': False,
        'note': 'Instruction counts document CPU/CFG coverage only, not graphics, controls or level completion.'
    }


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('baseline', type=Path)
    p.add_argument('candidate', type=Path)
    p.add_argument('--out', type=Path)
    a=p.parse_args()
    try:
        result=compare(a.baseline,a.candidate)
        payload=json.dumps(result,indent=2)+'\n'
        if a.out:
            a.out.write_text(payload,encoding='utf8')
        print(payload,end='')
    except (OSError,ValueError) as exc:
        p.exit(2,'CFG progress audit rejected: '+str(exc)+'\n')

if __name__=='__main__': main()
