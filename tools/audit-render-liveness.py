#!/usr/bin/env python3
"""Correlate frame progress with read-only framebuffer/WRAM hashes.

This is a forensic aid, not a patch to gameplay or a proof of a PPU bug.
The runtime emits FORJA65_FRAME_HASHES before incrementing frameCounter,
whereas FORJA65_FRAME_PROGRESS_CSV is emitted after incrementing it. Hence
frame-hash record N corresponds to progress record N+1.
"""
import argparse
import csv
import json
import re
from pathlib import Path

HASH_LINE = re.compile(r'^frame=(\d+)\s+framebuffer=([0-9a-fA-F]+)\s+wram=([0-9a-fA-F]+)\s+pc=([0-9a-fA-F]+)$')
REQUIRED = {'frame', 'pc', 'instructions', 'nmi', 'fb_fnv1a64'}


def diagnose(progress_csv, hash_file=None, start=0, end=None, min_span=180):
    if min_span < 1 or start < 0 or (end is not None and end < start):
        raise ValueError('Invalid window or minimum span')
    with Path(progress_csv).open(newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
            raise ValueError('Missing required progress columns')
        progress = []
        prev = -1
        prev_nmi, prev_instructions = -1, -1
        for r in reader:
            fr = int(r['frame'])
            nmi, instructions = int(r['nmi']), int(r['instructions'])
            if fr <= prev:
                raise ValueError('Frame identifiers must increase strictly')
            if nmi < prev_nmi or instructions < prev_instructions:
                raise ValueError('Counters must be monotonic')
            prev, prev_nmi, prev_instructions = fr, nmi, instructions
            if fr >= start and (end is None or fr <= end):
                progress.append({'frame': fr, 'hash': r['fb_fnv1a64'].lower(),
                                 'nmi': nmi, 'instructions': instructions, 'pc': r['pc']})
    if len(progress) < 2:
        return {'status': 'insufficient_samples', 'samples': len(progress)}

    # Dense framebuffer/WRAM records make it possible to detect a plateau
    # even when the progress CSV has sparse or incomplete checkpoints.
    snapshots = []
    if hash_file:
        seen = set()
        previous = -1
        for ln in Path(hash_file).read_text(encoding='utf-8-sig').splitlines():
            match = HASH_LINE.fullmatch(ln.strip())
            if not match:
                raise ValueError('Malformed frame hash line')
            fr = int(match.group(1)) + 1  # appendFrameHash() precedes frameCounter++
            if fr in seen:
                raise ValueError('Duplicate frame hash entry')
            if fr <= previous:
                raise ValueError('Frame hash entries must increase strictly')
            previous = fr
            seen.add(fr)
            if fr >= start and (end is None or fr <= end):
                snapshots.append({'frame': fr, 'hash': match.group(2).lower(), 'wram': match.group(3).lower()})

    samples = snapshots if len(snapshots) >= 2 else progress
    groups = [[samples[0]]]
    for r in samples[1:]:
        if r['hash'] == groups[-1][-1]['hash']:
            groups[-1].append(r)
        else:
            groups.append([r])
    longest = max(groups, key=lambda g: g[-1]['frame'] - g[0]['frame'])
    first, last = longest[0], longest[-1]
    span = last['frame'] - first['frame']
    relevant = [r for r in progress if first['frame'] <= r['frame'] <= last['frame']]
    nmi_delta = relevant[-1]['nmi']-relevant[0]['nmi'] if len(relevant) >= 2 else None
    instruction_delta = relevant[-1]['instructions']-relevant[0]['instructions'] if len(relevant) >= 2 else None
    result = {'first_frame': first['frame'], 'last_frame': last['frame'], 'span_frames': span,
              'samples': len(longest), 'framebuffer_hash': first['hash'],
              'nmi_delta': nmi_delta, 'instructions_delta': instruction_delta,
              'last_pc': relevant[-1]['pc'] if relevant else None,
              'wram_evidence': 'unavailable'}
    if span < min_span:
        result['status'] = 'no_long_visual_plateau'
        return result
    within = [r['wram'] for r in longest if 'wram' in r]
    if len(within) >= 2:
        result['wram_samples'] = len(within)
        result['wram_unique_hashes'] = len(set(within))
        result['wram_evidence'] = ('changed_during_static_image' if len(set(within)) > 1
                                   else 'unchanged_during_static_image')
    if nmi_delta is None or instruction_delta is None:
        result['status'] = 'static_image_missing_cpu_sample_coverage'
    elif nmi_delta <= 0 or instruction_delta <= 0:
        result['status'] = 'possible_cpu_or_interrupt_stall'
    elif result['wram_evidence'] == 'changed_during_static_image':
        result['status'] = 'static_image_but_wram_changed'
    elif result['wram_evidence'] == 'unchanged_during_static_image':
        result['status'] = 'static_image_and_wram_unchanged'
    else:
        result['status'] = 'static_image_with_active_cpu_no_wram_evidence'
    result['interpretation'] = ('Frame hashes and WRAM hashes alone cannot prove cause, '
                                'playability or fidelity; compare original SNES CPU/PPU trace.')
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('progress_csv', type=Path)
    p.add_argument('--frame-hashes', type=Path)
    p.add_argument('--start', type=int, default=0)
    p.add_argument('--end', type=int)
    p.add_argument('--min-span', type=int, default=180)
    p.add_argument('--output', type=Path)
    args = p.parse_args()
    try:
        result = diagnose(args.progress_csv, args.frame_hashes, args.start, args.end, args.min_span)
    except (ValueError, OSError) as e:
        p.exit(2, f'audit-render-liveness: {e}\n')
    doc = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(doc, encoding='utf-8')
    print(doc, end='')


if __name__ == '__main__':
    main()
