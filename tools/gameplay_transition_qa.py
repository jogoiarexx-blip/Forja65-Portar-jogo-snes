#!/usr/bin/env python3
"""Compare two deterministic Forja65 scene timelines (standard-library only).

This is a *visual-state* regression test, not an emulator accuracy oracle.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys


def read_ppm(path):
    # Our scene exporter writes P6 RGB; reject malformed and truncated captures.
    data = path.read_bytes()
    if not data.startswith(b'P6\n'):
        raise ValueError(f'{path}: expected binary P6 PPM')
    offset = 3
    tokens = []
    while len(tokens) < 3:
        while offset < len(data) and data[offset] in b' \t\r\n':
            offset += 1
        if offset < len(data) and data[offset] == 35:  # # comment
            while offset < len(data) and data[offset] != 10:
                offset += 1
            continue
        end = offset
        while end < len(data) and data[end] not in b' \t\r\n':
            end += 1
        if end == offset:
            raise ValueError(f'{path}: missing image dimension')
        tokens.append(int(data[offset:end]))
        offset = end
    width, height, max_value = tokens
    if width <= 0 or height <= 0 or width > 8192 or height > 8192 or max_value != 255:
        raise ValueError(f'{path}: unsupported PPM dimensions or max sample')
    if offset >= len(data) or data[offset] not in b' \t\r\n':
        raise ValueError(f'{path}: bad raster separator')
    if data[offset:offset+2] == b'\r\n':
        offset += 2
    else:
        offset += 1
    rgb = data[offset:]
    if len(rgb) != width * height * 3:
        raise ValueError(f'{path}: wrong RGB byte count {len(rgb)}')
    return width, height, rgb


def compare(a, b):
    ia, ib = read_ppm(a), read_ppm(b)
    if ia[:2] != ib[:2]:
        raise ValueError(f'frame size mismatch {a} / {b}')
    xa, xb = ia[2], ib[2]
    delta = sum(xa[i:i+3] != xb[i:i+3] for i in range(0, len(xa), 3))
    return {'different_pixels': delta, 'total_pixels': ia[0]*ia[1],
            'first_sha256': hashlib.sha256(xa).hexdigest(),
            'second_sha256': hashlib.sha256(xb).hexdigest()}


def evaluate(base, variant, rules):
    results = []
    allowed = {'same_across', 'different_across', 'frozen_variant', 'changed_variant'}
    for rule in rules:
        action = rule['type']
        frames = rule['frames']
        if action not in allowed or not isinstance(frames, list) or not frames:
            raise ValueError('invalid rule type or frames')
        if action in ('frozen_variant', 'changed_variant') and len(frames) != 2:
            raise ValueError(f'{action} requires exactly two frames')
        if any(not isinstance(n, int) or isinstance(n, bool) or n <= 0 for n in frames):
            raise ValueError('frames must be positive integers')
        comparisons = []
        if action.endswith('_across'):
            pairs = [(base / f'frame-{n}' / 'preview.ppm',
                      variant / f'frame-{n}' / 'preview.ppm') for n in frames]
        else:
            pairs = [(variant / f'frame-{frames[0]}' / 'preview.ppm',
                      variant / f'frame-{frames[1]}' / 'preview.ppm')]
        for a, b in pairs:
            comparisons.append(compare(a, b))
        expected_same = action in ('same_across', 'frozen_variant')
        passed = all((entry['different_pixels'] == 0) == expected_same for entry in comparisons)
        results.append({'type': action, 'frames': frames, 'pass': passed,
                        'compared_pixels': [p['different_pixels'] for p in comparisons]})
    return {'pass': all(x['pass'] for x in results), 'rules': results,
            'warning': 'Visual regression only; not proof of SNES hardware equivalence or game completion'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', required=True, type=Path)
    parser.add_argument('--variant', required=True, type=Path)
    parser.add_argument('--rules', required=True, type=Path, help='JSON list of assertions')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    try:
        rules = json.loads(args.rules.read_text(encoding='utf-8'))
        report = evaluate(args.baseline, args.variant, rules)
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        for entry in report['rules']:
            print(('PASS' if entry['pass'] else 'FAIL'), entry['type'], entry['frames'], entry['compared_pixels'])
        return 0 if report['pass'] else 1
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print('GAMEPLAY_QA_ERROR:', exc, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
