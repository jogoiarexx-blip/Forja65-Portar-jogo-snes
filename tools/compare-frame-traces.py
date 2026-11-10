#!/usr/bin/env python3
"""Compare deterministic Forja65 frame CSVs before/after a conversion change.

Strict on timeline and missing checkpoints, so an interrupted run cannot appear
as a successful match merely because its first few frames coincide.
"""
import argparse
import csv
import json
import sys
from pathlib import Path

DEFAULT_FIELDS = ('pc', 'joy1', 'joy2', 'autojoy1', 'autojoy2', 'instructions', 'nmi', 'fb_fnv1a64')


def load(path):
    with path.open(newline='', encoding='utf-8-sig') as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or 'frame' not in reader.fieldnames:
            raise ValueError(f'{path}: missing frame CSV header')
        rows = {}
        prev = -1
        for row in reader:
            if not row.get('frame', '').isdigit():
                raise ValueError(f'{path}: invalid frame value')
            frame = int(row['frame'])
            if frame <= prev:
                raise ValueError(f'{path}: duplicate or non-increasing frame {frame}')
            prev = frame
            rows[frame] = row
        if not rows:
            raise ValueError(f'{path}: no frame checkpoints')
    return rows


def compare(reference, candidate, fields=DEFAULT_FIELDS, through_frame=None):
    for key in fields:
        if key == 'frame':
            raise ValueError('frame is timeline key, not a comparison field')
    a = load(Path(reference))
    b = load(Path(candidate))
    if through_frame is None:
        through_frame = min(max(a), max(b))
    if through_frame <= 0 or max(a) < through_frame or max(b) < through_frame:
        raise ValueError('both logs must reach the requested frame')
    frames_a = {v for v in a if v <= through_frame}
    frames_b = {v for v in b if v <= through_frame}
    missing_in_candidate = sorted(frames_a - frames_b)
    extra_in_candidate = sorted(frames_b - frames_a)
    checked = sorted(frames_a & frames_b)
    if not checked:
        raise ValueError('no shared frame checkpoints')
    differences = []
    for frame in checked:
        for key in fields:
            if key not in a[frame] or key not in b[frame]:
                raise ValueError(f'CSV field absent: {key}')
            if a[frame][key] != b[frame][key]:
                differences.append({'frame': frame, 'field': key,
                                    'reference': a[frame][key], 'candidate': b[frame][key]})
                break
    return {'match': not differences and not missing_in_candidate and not extra_in_candidate,
            'through_frame': through_frame, 'checked_frames': len(checked),
            'reference_checkpoints': len(frames_a), 'candidate_checkpoints': len(frames_b),
            'missing_in_candidate': missing_in_candidate[:10],
            'extra_in_candidate': extra_in_candidate[:10],
            'first_difference': differences[0] if differences else None,
            'compared_fields': list(fields)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference', type=Path)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('--through-frame', type=int)
    parser.add_argument('--fields', default=','.join(DEFAULT_FIELDS))
    args = parser.parse_args()
    try:
        fields = tuple(key.strip() for key in args.fields.split(',') if key.strip())
        if not fields:
            raise ValueError('choose at least one field')
        result = compare(args.reference, args.candidate, fields, args.through_frame)
    except (OSError, ValueError) as exc:
        parser.exit(2, f'Invalid frame comparison: {exc}\n')
    print(json.dumps(result, indent=2))
    return 0 if result['match'] else 1


if __name__ == '__main__':
    sys.exit(main())
