#!/usr/bin/env python3
"""Reproduce identical controller inputs with old and REV143 SPC clocks.

A timing change often changes the game state: such divergence is expected and
MUST NOT be described as deterministically replayed old input. This tool
measures it, preserving both runs and their QA output. It does not edit ROMs.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

QA_KEYS = ('runtime_started', 'frames', 'instructions', 'framebuffer_hash',
           'wram_hash', 'spc_clock_hz', 'apu_timing_profile', 'apu_fallback_master_cycles',
           'ppu_virtual_accesses', 'rom_fallback_reads')


def parse_qa(path):
    if not path.exists():
        return {}
    return dict(line.split('=', 1) for line in path.read_text(errors='replace').splitlines()
                if '=' in line and not line.startswith('#'))


def verdict(a, b):
    if not a or not b or a.get('runtime_started') != 'PASS' or b.get('runtime_started') != 'PASS':
        return 'UNVERIFIED_EXECUTION_FAILURE'
    if a.get('frames') != b.get('frames'):
        return 'DIVERGED_FRAME_COUNT'
    keys = ['instructions', 'framebuffer_hash', 'wram_hash']
    if all(a.get(k) == b.get(k) for k in keys):
        return 'SAME_SNAPSHOT_NOT_FULL_REPLAY_PROOF'
    return 'TIMING_DIVERGENCE_REPLAY_REQUIRES_NEW_VALIDATION'


def run(label, exe, assets, trace, frames, root, timing_profile, frequency, timeout):
    directory = root / label
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / 'assets'
    target.mkdir(exist_ok=True)
    shutil.copyfile(assets, target / 'cart-data.bin')
    env = os.environ.copy()
    for key in ('FORJA65_TIMING_PROFILE', 'FORJA65_SPC_HZ', 'FORJA65_SPC_PROFILE'):
        env.pop(key, None)
    env['FORJA65_HEADLESS'] = '1'
    env['FORJA65_HEADLESS_FRAMES'] = str(frames)
    env['FORJA65_INPUT_REPLAY'] = str(trace)
    if timing_profile:
        env['FORJA65_TIMING_PROFILE'] = timing_profile
    if frequency:
        env['FORJA65_SPC_HZ'] = str(frequency)
    try:
        began = time.monotonic()
        proc = subprocess.run([str(exe)], cwd=directory, env=env,
                              capture_output=True, text=True, errors='replace', timeout=timeout)
        code, output, err = proc.returncode, proc.stdout[-12000:], proc.stderr[-12000:]
        elapsed = round(time.monotonic() - began, 2)
    except subprocess.TimeoutExpired as error:
        code, output, err, elapsed = -1, str(error.stdout)[-12000:], str(error.stderr)[-12000:], timeout
    (directory / 'stdout.txt').write_text(output, encoding='utf-8')
    (directory / 'stderr.txt').write_text(err, encoding='utf-8')
    qa = parse_qa(directory / 'forja65-qa-status.txt')
    return {'label': label, 'exit_code': code, 'seconds': elapsed,
            'qa': {k: qa.get(k) for k in QA_KEYS}, 'qa_found': bool(qa),
            'configured': {'profile': timing_profile or 'rev137-compatible', 'spc_hz_override': frequency}}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--game', type=Path, required=True)
    p.add_argument('--baseline-game', type=Path)
    p.add_argument('--assets', type=Path, required=True)
    p.add_argument('--trace', type=Path, required=True)
    p.add_argument('--frames', type=int, default=600)
    p.add_argument('--timeout', type=int, default=180)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--full', action='store_true', help='also test explicit REV143 profile')
    a = p.parse_args()
    if a.frames < 1 or a.timeout < 1:
        p.error('frames/timeout must be positive')
    game, base = a.game.resolve(), (a.baseline_game or a.game).resolve()
    assets, trace, root = a.assets.resolve(), a.trace.resolve(), a.out.resolve()
    root.mkdir(parents=True, exist_ok=True)
    runs = [run('old-binary-legacy', base, assets, trace, a.frames, root, None, None, a.timeout),
            run('new-binary-legacy', game, assets, trace, a.frames, root, None, None, a.timeout)]
    comparisons = {'baseline_vs_compatible': verdict(runs[0]['qa'], runs[1]['qa'])}
    if a.full:
        runs.append(run('new-binary-rev143', game, assets, trace, a.frames, root,
                        'rev143', None, a.timeout))
        comparisons['compatible_vs_rev143'] = verdict(runs[1]['qa'], runs[2]['qa'])
    report = {'revision': 'rev145', 'frames_requested': a.frames,
              'comparisons': comparisons, 'runs': runs,
              'warning': 'Single endpoint hashes are not proof of pixel-identical races or ranking. Revalidate 2 circuits on REV143 timing.'}
    (root / 'clock-profile-differential.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'comparisons': comparisons, 'runs': [(r['label'], r['exit_code'], r['qa'].get('frames')) for r in runs]}, indent=2))
    return 0 if all(r['exit_code'] == 0 and r['qa'].get('runtime_started') == 'PASS' for r in runs) else 1


if __name__ == '__main__':
    raise SystemExit(main())
