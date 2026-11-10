#!/usr/bin/env python3
"""Summarize per-address WRAM deltas from a Forja65 runtime recording.

Output ranks *candidates*, not proven timer variables. Truncated frames are
reported and do not contribute to address-level absence conclusions.
"""
import argparse
import collections
import csv
import json
from pathlib import Path

REQUIRED = {'kind', 'frame', 'wram_address', 'old_value', 'new_value', 'changed', 'emitted', 'truncated', 'joy1'}


def read_log(path):
    frames = {}
    seen_addresses = collections.defaultdict(set)
    with open(path, encoding='utf-8', newline='') as inp:
        reader = csv.DictReader(inp)
        if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
            raise ValueError(f'{path}: missing required CSV fields')
        for row in reader:
            kind = row['kind']
            if kind not in ('baseline', 'summary', 'delta'):
                raise ValueError(f'{path}: unexpected row kind {kind}')
            f = int(row['frame'])
            if f < 0:
                raise ValueError('Negative frame')
            state = frames.setdefault(f, {'events': [], 'summary': None, 'baseline': False, 'joy1': None})
            joy = int(row['joy1'])
            if state['joy1'] is not None and state['joy1'] != joy:
                raise ValueError(f'{path}: inconsistent joy1 at frame {f}')
            state['joy1'] = joy
            if kind == 'baseline':
                if state['baseline'] or state['summary'] is not None:
                    raise ValueError('Duplicate baseline or baseline after summary')
                state['baseline'] = True
            elif kind == 'summary':
                if state['summary'] is not None:
                    raise ValueError(f'Duplicate summary for frame {f}')
                changed, emitted, truncated = (int(row[k]) for k in ('changed', 'emitted', 'truncated'))
                if min(changed, emitted, truncated) < 0 or emitted + truncated != changed:
                    raise ValueError('Malformed summary accounting')
                state['summary'] = (changed, emitted, truncated)
            else:
                addr = int(row['wram_address'], 16)
                old, new = int(row['old_value']), int(row['new_value'])
                if not 0x7E0000 <= addr <= 0x7FFFFF or old == new or not 0 <= old <= 255 or not 0 <= new <= 255:
                    raise ValueError(f'Invalid delta at frame {f}')
                if addr in seen_addresses[f]:raise ValueError(f'Duplicate WRAM snapshot address at frame {f}')
                seen_addresses[f].add(addr)
                state['events'].append((addr, old, new))
    if not frames:
        raise ValueError(f'{path}: empty log')
    if not any(s['baseline'] for s in frames.values()):
        raise ValueError('Missing baseline sample')
    for f, state in frames.items():
        if state['summary'] is not None and len(state['events']) != state['summary'][1]:
            raise ValueError(f'Event count mismatch at frame {f}')
        if state['summary'] is None and not state['baseline']:
            raise ValueError(f'Incomplete sample at frame {f}')
    return frames


def analyze(neutral, controlled):
    common = sorted(set(neutral) & set(controlled))
    comparable = [f for f in common if neutral[f]['summary'] and controlled[f]['summary']]
    if not comparable:
        raise ValueError('No comparable non-baseline frames')
    mismatched_inputs = [f for f in comparable if neutral[f]['joy1'] != controlled[f]['joy1']]
    if not mismatched_inputs:
        raise ValueError('No control divergence; cannot attribute any difference to input')
    first_input = mismatched_inputs[0]
    pre = [f for f in comparable if f < first_input]
    pre_mismatch = []
    for f in pre:
        a,b=neutral[f],controlled[f]
        if a['summary'] != b['summary'] or a['events'] != b['events']:
            pre_mismatch.append(f)
    if pre_mismatch:
        raise ValueError(f'Non-identical WRAM deltas before input at frame {pre_mismatch[0]}')
    safe = [f for f in comparable if f >= first_input and not neutral[f]['summary'][2] and not controlled[f]['summary'][2]]
    differences = collections.Counter()
    by_frame = []
    for f in safe:
        a = {addr: new for addr, old, new in neutral[f]['events']}
        b = {addr: new for addr, old, new in controlled[f]['events']}
        unique = sorted(addr for addr in set(a)|set(b) if a.get(addr) != b.get(addr))
        differences.update(unique)
        if unique:
            by_frame.append({'frame':f,'distinct_delta_addresses':len(unique)})
    omitted = [f for f in comparable if f >= first_input and f not in safe]
    return {
        'schema': 'forja65.wram-differential.v1', 'first_divergent_input_frame': first_input,
        'common_sampled_frames':len(comparable), 'safe_post_input_samples':len(safe),
        'truncated_post_input_frames':len(omitted), 'insufficient_evidence':len(safe)==0,
        'candidates':[{'snes_address':f'${a:06X}','distinct_frames':c} for a,c in differences.most_common(50)],
        'frame_differences':by_frame[:100],
        'limitations':'End-of-frame memory deltas are candidate locations, not proven timers, sprite motion, or shots. No SNES oracle compared.'
    }


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('neutral',type=Path)
    ap.add_argument('controlled',type=Path)
    ap.add_argument('--out',type=Path)
    args=ap.parse_args()
    result=analyze(read_log(args.neutral),read_log(args.controlled))
    data=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if args.out:
        args.out.write_text(data,encoding='utf-8')
    print(data,end='')

if __name__=='__main__':main()
