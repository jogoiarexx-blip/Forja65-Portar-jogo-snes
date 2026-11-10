#!/usr/bin/env python3
"""Select independent timer-like changes and input-divergent WRAM changes.

These are diagnostic watch lists, never proof of a real game timer.
"""
import argparse
import collections
import json
from pathlib import Path
from importlib.machinery import SourceFileLoader

BASE = Path(__file__).resolve().parent
_diff = SourceFileLoader('wram_diff_tool', str(BASE / 'wram-diff-analyze.py')).load_module()
_sel = SourceFileLoader('watch_selector', str(BASE / 'select-get-ready-watches.py')).load_module()


def autonomous_candidates(frames, min_transitions=2, limit=16):
    seq = collections.defaultdict(list)
    for frame, state in sorted(frames.items()):
        if not state['summary'] or state['summary'][2]:
            continue
        for addr, old, new in state['events']:
            if old != new:
                seq[addr].append((frame, old, new))
    ranked = []
    for addr, changes in seq.items():
        if len(changes) < min_transitions:
            continue
        decrements = sum(1 for _, old, new in changes if new == (old - 1) % 256)
        zeros = sum(1 for _, _, new in changes if new == 0)
        # Score only provides investigative priority. Not causal proof.
        score = decrements * 4 + min(len(changes), 20) + zeros * 2
        ranked.append((score, decrements, len(changes), addr))
    ranked.sort(key=lambda x: (-x[0], -x[1], -x[2], x[3]))
    return [f'{a:06X}' for _, _, _, a in ranked[:limit]]


def build(neutral, differential, timer_limit=16, input_limit=16):
    timers = autonomous_candidates(_diff.read_log(neutral), limit=timer_limit)
    inputs = _sel.select(differential, limit=input_limit) if differential.get('candidates') and not differential.get('insufficient_evidence') else []
    combined = list(dict.fromkeys(timers + inputs))
    if not combined:
        raise ValueError('No observed WRAM address; do not run unfiltered capture')
    return {'schema':'forja65.get-ready-dual-watch.v1',
            'autonomous_candidates': timers, 'input_differential_candidates':inputs,
            'all_addresses':combined,
            'limitations':'Heuristics only. End-of-frame transitions cannot establish screen digit, original SNES parity, or gameplay.'}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('neutral_csv', type=Path)
    ap.add_argument('differential_json', type=Path)
    ap.add_argument('--out', type=Path, required=True)
    args=ap.parse_args()
    result=build(args.neutral_csv,json.loads(args.differential_json.read_text(encoding='utf-8')))
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(','.join(result['all_addresses']))

if __name__=='__main__': main()
