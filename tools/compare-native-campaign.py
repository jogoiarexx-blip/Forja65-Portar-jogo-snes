#!/usr/bin/env python3
"""REV183: compare equivalent CPU-native campaigns, detecting first WRAM/video divergence.

Never compare unrelated ROMs, traces, frame limits, or runtime profiles.
AOT coverage evidence is valid only for replayed frames, not the whole ROM.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys


def read_campaign(root):
    manifest = json.loads((root / 'manifest.json').read_text())
    audit = json.loads((root / 'audit.json').read_text())
    if manifest['status'] != 'complete' or not audit['all_segments_verified']:
        raise ValueError(f'incomplete campaign: {root}')
    return manifest, audit


def iter_hashes(root, manifest):
    for step in manifest['segments']:
        filename = root / step['folder'] / 'frame-hashes.txt'
        for line in filename.read_text().splitlines():
            if not line.startswith('frame='):
                raise ValueError(f'invalid hash line in {filename}')
            parts = dict(part.split('=', 1) for part in line.split())
            yield int(parts['frame']), parts['framebuffer'], parts['wram']


def compare(a, b):
    ma, aa = read_campaign(a)
    mb, ab = read_campaign(b)
    required = ('profile', 'trace_sha256', 'rom_sha256', 'frames')
    different = [k for k in required if ma['settings'][k] != mb['settings'][k]]
    if different:
        raise ValueError('comparison refused: different ' + ', '.join(different))
    # Different CPU binary hashes are allowed for before/after regressions.
    # The same ROM and exactly the same input trace/profile must still match.
    ha = list(iter_hashes(a, ma))
    hb = list(iter_hashes(b, mb))
    expected = ma['settings']['frames']
    if len(ha) != expected or len(hb) != expected:
        raise ValueError(f'incomplete hash coverage: {len(ha)}/{len(hb)} != {expected}')
    for i, (left, right) in enumerate(zip(ha, hb)):
        if left[0] != i or right[0] != i:
            raise ValueError('missing/duplicate frame sequence')
        if left != right:
            return {'equal': False, 'first_mismatch_frame': i, 'before': left, 'after': right,
                    'verified_frames': i, 'aot_fallback_before': aa['interpreted_instructions'],
                    'aot_fallback_after': ab['interpreted_instructions']}
    return {'equal': True, 'verified_frames': len(ha),
            'cpu_instructions_before': aa['cpu_instructions'],
            'cpu_instructions_after': ab['cpu_instructions'],
            'aot_fallback_before': aa['interpreted_instructions'],
            'aot_fallback_after': ab['interpreted_instructions'],
            'first_mismatch_frame': None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before', type=Path)
    parser.add_argument('after', type=Path)
    parser.add_argument('--json-out', type=Path)
    args = parser.parse_args()
    try:
        result = compare(args.before.resolve(), args.after.resolve())
        data = json.dumps(result, indent=2) + '\n'
        print(data, end='')
        if args.json_out:
            args.json_out.write_text(data)
        return 0 if result['equal'] else 1
    except (ValueError, KeyError, OSError, json.JSONDecodeError) as exc:
        print(f'Campanhas nao comparaveis: {exc}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
