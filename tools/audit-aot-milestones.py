#!/usr/bin/env python3
"""Validate gameplay milestones from completed CPU-AOT replay frame hashes.

The golden file specifies expected WRAM signatures and annotated milestones. A
match is evidence only for the same trace/profile/ROM; it is not by itself a
proof of full playability or AOT support on untaken control paths.
"""
import argparse
import csv
import json
import re
from pathlib import Path

EXPECTED = re.compile(r'^frame=(\d+)\s+wram=([0-9a-f]{1,16})\s*(?:#\s*(.*))?$')
OBSERVED = re.compile(r'^frame=(\d+)\s+framebuffer=([0-9a-f]+)\s+wram=([0-9a-f]{1,16})\s+pc=([0-9a-f]+)$')

def audit(golden: Path, hashes: Path, progress: Path | None = None) -> dict:
    reference = []
    for ln in golden.read_text().splitlines():
        s = ln.strip()
        if not s or s.startswith('#'):
            continue
        m = EXPECTED.fullmatch(s)
        if not m:
            raise ValueError('invalid golden line: ' + s[:90])
        reference.append(dict(frame=int(m[1]), expected_wram=m[2].zfill(16), milestone=m[3] or ''))
    if not reference or any(b['frame'] <= a['frame'] for a, b in zip(reference, reference[1:])):
        raise ValueError('reference frames must be increasing and nonempty')
    lookup = {e['frame']: e for e in reference}
    last = -1
    count = 0
    for line in hashes.open():
        m = OBSERVED.fullmatch(line.strip())
        if not m:
            raise ValueError('invalid hash line: ' + line[:90])
        n = int(m[1])
        if n != last + 1:
            raise ValueError(f'frame discontinuity: previous {last}, found {n}')
        last = n
        count += 1
        if n in lookup:
            e = lookup[n]
            e['observed_wram'] = m[3].zfill(16)
            e['match'] = e['expected_wram'] == m[3].zfill(16)
    progress_last = None
    if progress and progress.is_file():
        with progress.open(newline='') as f:
            for row in csv.DictReader(f):
                progress_last = int(row['frame'])
    checked = [e for e in reference if 'match' in e]
    missing = [e for e in reference if 'match' not in e]
    return {'frames_hash_recorded': count, 'last_hashed_frame': last,
            'last_progress_frame': progress_last,
            'checked_milestones': len(checked),
            'matching_milestones': sum(1 for e in checked if e['match']),
            'mismatched_milestones': sum(1 for e in checked if not e['match']),
            'pending_future_milestones': len(missing),
            'all_observed_milestones_match': all(e['match'] for e in checked),
            'milestones': reference}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('golden', type=Path)
    p.add_argument('hashes', type=Path)
    p.add_argument('--progress', type=Path)
    p.add_argument('--out', type=Path)
    args = p.parse_args()
    result = audit(args.golden, args.hashes, args.progress)
    data = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(data)
    print(data)

if __name__ == '__main__':
    main()
