#!/usr/bin/env python3
"""Compare deterministic Forja65 traces, separating video from CPU/WRAM divergence.

Usage:
  python tools/compare_frame_traces.py old/forja65-frame-hashes.txt new/forja65-frame-hashes.txt
Exit: 0 identical or video-only (if --allow-video-differences), 1 video mismatch,
      2 state mismatch, 3 malformed or missing trace data.
"""
import argparse
import collections
import pathlib
import sys

FIELDS = ('framebuffer', 'wram', 'pc')


def read_trace(path):
    records = {}
    with open(path, encoding='utf-8') as file:
        for line_no, raw in enumerate(file, 1):
            stripped = raw.strip()
            if not stripped:
                continue
            values = {}
            for part in stripped.split():
                if '=' not in part:
                    raise ValueError(f'{path}:{line_no}: invalid token {part!r}')
                k, v = part.split('=', 1)
                values[k] = v
            if any(k not in values for k in ('frame', *FIELDS)):
                raise ValueError(f'{path}:{line_no}: missing required fields')
            try:
                frame = int(values['frame'], 10)
            except ValueError as ex:
                raise ValueError(f'{path}:{line_no}: invalid frame number') from ex
            if frame in records:
                raise ValueError(f'{path}:{line_no}: duplicate frame {frame}')
            records[frame] = {k: values[k].lower() for k in FIELDS}
    if not records:
        raise ValueError(f'{path}: empty trace')
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline', type=pathlib.Path)
    parser.add_argument('updated', type=pathlib.Path)
    parser.add_argument('--allow-video-differences', action='store_true')
    parser.add_argument('--max-frames', type=int, default=0, help='compare only the first N frame numbers')
    args = parser.parse_args()
    try:
        a = read_trace(args.baseline)
        b = read_trace(args.updated)
        if args.max_frames:
            if args.max_frames < 1:
                raise ValueError('--max-frames must be positive')
            selected = sorted(a)[:args.max_frames]
            if len(selected) != args.max_frames:
                raise ValueError('baseline has fewer frames than requested')
            a = {frame: a[frame] for frame in selected}
            b = {frame: b[frame] for frame in selected if frame in b}
        if a.keys() != b.keys():
            missing = sorted(a.keys() - b.keys())
            excess = sorted(b.keys() - a.keys())
            raise ValueError(f'nonmatching frame sets, baseline-only={missing[:5]}, updated-only={excess[:5]}')
        count = collections.Counter()
        first = {}
        for frame in sorted(a):
            for field in FIELDS:
                if a[frame][field] != b[frame][field]:
                    count[field] += 1
                    first.setdefault(field, frame)
        print(f'COMPARE frames={len(a)} video_different={count["framebuffer"]} '
              f'wram_different={count["wram"]} pc_different={count["pc"]}')
        for field in FIELDS:
            if field in first:
                frame = first[field]
                print(f'FIRST_{field.upper()}_DIFFERENCE frame={frame} '
                      f'baseline={a[frame][field]} updated={b[frame][field]}')
        if count['wram'] or count['pc']:
            print('FAIL: CPU/WRAM state changed: investigate timing/logic')
            return 2
        if count['framebuffer']:
            print('VIDEO_ONLY: state matched; verify visual differences against SNES reference')
            return 0 if args.allow_video_differences else 1
        print('PASS: video and state fully matched')
        return 0
    except (OSError, ValueError) as ex:
        print(f'TRACE_ERROR: {ex}', file=sys.stderr)
        return 3


if __name__ == '__main__':
    sys.exit(main())
