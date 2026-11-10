#!/usr/bin/env python3
"""Evidence gate for a continuous AOT campaign and known gameplay WRAM markers.

Never treats a reference script or stage marker as proof of unobserved progress.
Reads hashes incrementally and rejects holes, mismatches, missing audit evidence,
nonzero CPU interpretation and incomplete/blocked runs.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

HASH = re.compile(r'^frame=(\d+)\s+framebuffer=([0-9a-f]+)\s+wram=([0-9a-f]{1,16})\s+pc=([0-9a-f]+)$')
GOLD = re.compile(r'^frame=(\d+)\s+wram=([0-9a-f]{1,16})\s*(?:#\s*(.*))?$')


def load_golden(path):
    entries = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        m = GOLD.fullmatch(line)
        if not m:
            raise ValueError(f'invalid golden line: {line[:100]}')
        frame = int(m[1])
        if entries and frame <= entries[-1]['frame']:
            raise ValueError('golden frame order not increasing')
        entries.append({'frame': frame, 'wram': m[2].zfill(16), 'name': m[3] or ''})
    if not entries:
        raise ValueError('empty golden')
    return entries


def read_hashes(path):
    with path.open() as file:
        for expected, line in enumerate(file):
            m = HASH.fullmatch(line.strip())
            if not m or int(m[1]) != expected:
                raise ValueError(f'hash file discontinuity or malformed entry at frame {expected}')
            yield expected, m[2], m[3].zfill(16), m[4]


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as inp:
        for data in iter(lambda: inp.read(1024 * 1024), b''):
            digest.update(data)
    return digest.hexdigest()


def read_kv(path):
    result = {}
    for line in path.read_text().splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            result[key.strip()] = value.strip()
    return result


def certify(folder, golden, baseline=None, expected_frames=None, trace=None, rom=None, baseline_required=0):
    manifest = json.loads((folder/'manifest.json').read_text())
    if manifest.get('status') != 'complete':
        reason = manifest.get('failure', {}).get('reason', 'incomplete')
        raise ValueError(f'campaign not complete: {manifest.get("status")} ({reason})')
    settings = manifest['settings']
    expected = int(expected_frames if expected_frames is not None else settings['frames'])
    if settings['mode'] != 'aot':
        raise ValueError('campaign is not in CPU AOT strict mode')
    if expected != int(settings['frames']) or expected < 1:
        raise ValueError('requested frame count disagrees with manifest')
    if trace is not None and sha(trace) != settings.get('trace_sha256'):
        raise ValueError('trace SHA-256 differs from manifest')
    if rom is not None and sha(rom) != settings.get('rom_sha256'):
        raise ValueError('ROM SHA-256 differs from manifest')
    milestones = load_golden(golden)
    ref = {entry['frame']: entry for entry in milestones}
    base_reader = iter(read_hashes(baseline)) if baseline else None
    checked = []
    baseline_compared = 0
    divergences = []
    frame_count = 0
    cpu_total = 0
    fallback_total = 0
    prior_cpu_total = 0
    if len(manifest.get('segments', [])) != 1:
        raise ValueError('strict evidence gate requires one continuous segment; checkpoint segmentation is not certified')
    segment = folder/manifest['segments'][0]['folder']
    datafile = segment/'frame-hashes.txt'
    for frame, fb, wram, pc in read_hashes(datafile):
        frame_count = frame+1
        expected_entry = ref.get(frame)
        if expected_entry:
            ok = wram == expected_entry['wram']
            checked.append({'frame': frame, 'name': expected_entry['name'], 'match': ok, 'wram': wram})
            if not ok:
                divergences.append({'type': 'golden_wram', 'frame': frame,
                                    'expected': expected_entry['wram'], 'actual': wram})
        if base_reader:
            try:
                bframe, bfb, bwram, _ = next(base_reader)
                baseline_compared += 1
                if fb != bfb or wram != bwram:
                    divergences.append({'type': 'baseline', 'frame': frame,
                                        'framebuffer_match': fb == bfb, 'wram_match': wram == bwram})
                    base_reader = None  # report first divergence only
            except StopIteration:
                base_reader = None
        if len(divergences) >= 5:
            break
    auditfile = folder/'audit.json'
    recorded = json.loads(auditfile.read_text()) if auditfile.is_file() else None
    if recorded is not None:
        cpu_total = int(recorded.get('cpu_instructions', -1))
        fallback_total = int(recorded.get('interpreted_instructions', -1))
    complete = (manifest.get('status') == 'complete'
                and recorded is not None
                and recorded.get('all_segments_verified') is True
                and recorded.get('frames') == expected
                and frame_count == expected
                and (segment/'exit-code.txt').is_file()
                and (segment/'exit-code.txt').read_text().strip() == '0')
    raw_cpu = read_kv(segment/'forja65-cpu-migration.txt')
    raw_qa = read_kv(segment/'forja65-qa-status.txt')
    if (int(raw_cpu.get('total_instructions', -1)) != cpu_total or
        int(raw_cpu.get('interpreter_instructions', -1)) != fallback_total):
        divergences.append({'type': 'raw_cpu_audit_disagreement'})
    if int(raw_qa.get('frames', -1)) != expected:
        divergences.append({'type': 'raw_qa_frame_count_disagreement'})
    if baseline_required and (not baseline or baseline_compared < baseline_required):
        divergences.append({'type': 'baseline_incomplete', 'required': baseline_required, 'compared': baseline_compared})
    # If run is blocked, a fragment of AOT frame hashes is diagnostic, never completion.
    valid = complete and cpu_total > 0 and fallback_total == 0 and not divergences
    result = {'status': 'PASSED' if valid else 'NOT_CERTIFIED',
              'target_frames': expected, 'observed_hash_frames': frame_count,
              'completed': complete, 'cpu_instructions': cpu_total,
              'interpreted_instructions': fallback_total,
              'matched_milestones': sum(m['match'] for m in checked),
              'baseline_frames_compared': baseline_compared,
              'checked_milestones': checked,
              'not_yet_observed': [m for m in milestones if m['frame'] >= frame_count],
              'divergences': divergences,
              'strict_cpu_aot_certified': valid,
              'full_hardware_native_certified': False}
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--campaign', type=Path, required=True)
    p.add_argument('--golden', type=Path, required=True)
    p.add_argument('--baseline-hashes', type=Path)
    p.add_argument('--baseline-required', type=int, default=0)
    p.add_argument('--trace', type=Path)
    p.add_argument('--rom', type=Path)
    p.add_argument('--frames', type=int)
    p.add_argument('--out', type=Path)
    a = p.parse_args()
    try:
        result = certify(a.campaign, a.golden, a.baseline_hashes, a.frames, a.trace, a.rom, a.baseline_required)
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as e:
        result = {'status': 'INVALID_EVIDENCE', 'reason': str(e), 'strict_cpu_aot_certified': False}
    report = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    if a.out:
        a.out.parent.mkdir(parents=True, exist_ok=True)
        a.out.write_text(report)
    print(report)
    return 0 if result.get('strict_cpu_aot_certified') else 1

if __name__ == '__main__':
    raise SystemExit(main())
