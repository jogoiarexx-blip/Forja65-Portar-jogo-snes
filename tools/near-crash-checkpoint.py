#!/usr/bin/env python3
"""Forja65 reusable near-crash checkpoint orchestrator.

Requires a port compiled with the Forja checkpoint hooks. A checkpoint is a
restorable emulator state (.f65s), NOT a save.srm game save or just a trace.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time


def sha256(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def parse_hashes(path):
    rows = {}
    if not path.exists():
        return rows
    for line in path.read_text(errors='replace').splitlines():
        m = re.search(r'\bframe=(\d+)\b', line)
        if m:
            rows[int(m.group(1))] = line
    return rows


def launch(args, session, mode, save_file, limit):
    if session.exists():
        raise ValueError(f'Output already exists; preserve previous results: {session}')
    session.mkdir(parents=True)
    assets = args.project / 'assets'
    if not assets.is_dir():
        raise ValueError('Project assets/ is missing')
    shutil.copytree(assets, session / 'assets')
    env = {k: v for k, v in os.environ.items() if not k.startswith('FORJA65_')}
    env.update(FORJA65_HEADLESS='1', FORJA65_HEADLESS_FRAMES=str(limit),
               FORJA65_INPUT_REPLAY=str(args.replay),
               FORJA65_EXECUTION='reference', FORJA65_SPC_PROFILE='reference',
               FORJA65_WATCHDOG_INSTRUCTIONS=str(args.watchdog),
               FORJA65_SRAM_PATH=str(session / 'save.srm'),
               FORJA65_FRAME_HASHES='1', FORJA65_FRAME_HASH_PATH=str(session / 'frame-hashes.txt'))
    if mode == 'create':
        env.update(FORJA65_CHECKPOINT_SAVE_AT=str(args.frame),
                   FORJA65_CHECKPOINT_PATH=str(save_file), FORJA65_CHECKPOINT_STOP='1')
    elif mode == 'resume':
        env['FORJA65_CHECKPOINT_LOAD'] = str(save_file)
    if args.sram:
        shutil.copy2(args.sram, session / 'save.srm')
    start = time.monotonic()
    error = None
    with (session / 'stdout.log').open('w', encoding='utf-8') as log:
        try:
            result = subprocess.run([str(args.exe)], cwd=session, env=env,
                                    stdout=log, stderr=subprocess.STDOUT,
                                    timeout=args.timeout)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = None
            error = 'timeout'
    seconds = round(time.monotonic() - start, 2)
    log = (session / 'stdout.log').read_text(encoding='utf-8', errors='replace')
    for name in ('forja65-crash-trace.txt', 'forja65-last-error.txt',
                 'forja65-runtime-hints.txt', 'forja65-unresolved-state.txt',
                 'forja65-unresolved-returns.txt', 'forja65-unresolved-targets.txt'):
        # Logs already live inside the isolated session; collect names in JSON.
        pass
    manifest = {
        'schema': 'forja65.near-crash-checkpoint.v1', 'mode': mode,
        'checkpoint': str(save_file), 'frame_requested': getattr(args, 'frame', None),
        'frame_limit': limit, 'elapsed_s': seconds, 'exit_code': code, 'error': error,
        'checkpoint_saved': 'FORJA65_CHECKPOINT_SAVED' in log,
        'checkpoint_loaded': 'FORJA65_CHECKPOINT_LOADED' in log,
        'replay_sha256': sha256(args.replay),
        'rom_sha256': sha256(session / 'assets' / 'cart-data.bin'),
        'executable_sha256': sha256(args.exe),
        'crash_logs': [n for n in ('forja65-crash-trace.txt','forja65-last-error.txt',
                                  'forja65-runtime-hints.txt','forja65-unresolved-returns.txt',
                                  'forja65-unresolved-targets.txt') if (session / n).is_file()],
        'note': 'Frame budget does not certify complete gameplay or CFG coverage.'
    }
    (session / 'report.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    return manifest


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('mode', choices=('create', 'resume', 'verify'))
    p.add_argument('--project', type=Path, required=True)
    p.add_argument('--exe', type=Path, required=True)
    p.add_argument('--replay', type=Path, required=True)
    p.add_argument('--checkpoint', type=Path)
    p.add_argument('--frame', type=int, default=14420)
    p.add_argument('--limit', type=int, default=15000)
    p.add_argument('--out', type=Path, default=Path('forja-checkpoints'))
    p.add_argument('--sram', type=Path, help='Optional baseline .srm (copy before run)')
    p.add_argument('--timeout', type=int, default=1200)
    p.add_argument('--watchdog', type=int, default=500000000)
    args = p.parse_args(argv)
    for k in ('project', 'exe', 'replay', 'sram'):
        v = getattr(args, k)
        if v is not None:
            setattr(args, k, v.resolve())
    args.out = args.out.resolve()
    args.checkpoint = args.checkpoint.resolve() if args.checkpoint else args.out / 'near-crash.f65s'
    if not (1 <= args.frame < args.limit <= 10000000):
        p.error('Require 1 <= --frame < --limit <= 10000000')
    if args.timeout < 1 or args.watchdog < 1:
        p.error('Timeout/watchdog must be positive')
    if not args.exe.is_file() or not args.replay.is_file():
        p.error('Executable or replay not found')
    try:
        if args.mode in ('create', 'verify'):
            # Ensure the output target is not an old checkpoint accidentally reused.
            if args.checkpoint.exists() and args.mode == 'create':
                raise ValueError('Checkpoint already exists: ' + str(args.checkpoint))
            run1 = launch(args, args.out / 'create', 'create', args.checkpoint, args.limit)
            print(json.dumps(run1, indent=2), flush=True)
            if run1['exit_code'] != 0 or not run1['checkpoint_saved'] or not args.checkpoint.is_file():
                return 2
        if args.mode == 'resume':
            if not args.checkpoint.is_file():
                raise ValueError('Missing checkpoint: ' + str(args.checkpoint))
            run2 = launch(args, args.out / 'resume', 'resume', args.checkpoint, args.limit)
            print(json.dumps(run2, indent=2), flush=True)
            return 0 if run2['exit_code'] == 0 and run2['checkpoint_loaded'] else 3
        if args.mode == 'verify':
            # Compare hashes in the overlapping suffix, not elapsed time or screenshots.
            run2 = launch(args, args.out / 'resume', 'resume', args.checkpoint, args.limit)
            run3 = launch(args, args.out / 'cold', 'cold', args.checkpoint, args.limit)
            a = parse_hashes(args.out / 'cold' / 'frame-hashes.txt')
            b = parse_hashes(args.out / 'resume' / 'frame-hashes.txt')
            common = sorted(set(a) & set(b))
            mismatches = [f for f in common if a[f] != b[f]]
            verdict = {'overlap_frames': len(common), 'matching_frames': len(common)-len(mismatches),
                       'first_mismatch': mismatches[0] if mismatches else None,
                       'resume_exit': run2['exit_code'], 'cold_exit': run3['exit_code'],
                       'resume_loaded': run2['checkpoint_loaded']}
            (args.out / 'verify.json').write_text(json.dumps(verdict, indent=2) + '\n')
            print(json.dumps(verdict, indent=2))
            return 0 if common and not mismatches and run2['exit_code'] == run3['exit_code'] == 0 and run2['checkpoint_loaded'] else 4
        return 0
    except (ValueError, OSError) as e:
        print('Checkpoint error:', e, file=sys.stderr)
        return 5

if __name__ == '__main__':
    raise SystemExit(main())
