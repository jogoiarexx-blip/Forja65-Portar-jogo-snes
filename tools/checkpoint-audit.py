#!/usr/bin/env python3
"""Capture deterministic checkpoints in isolated runs; never infer game completion."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def parse_frames(text):
    values = [int(v) for v in text.split(',')]
    if not values or any(v < 1 or v > 1000000 for v in values):
        raise ValueError('frames must be integers from 1 to 1000000')
    return sorted(set(values))


def classify_run(code, qa_text, target, capture_present):
    qa = dict(line.split('=', 1) for line in qa_text.splitlines() if '=' in line)
    try:
        reached = int(qa.get('frames', '0'))
    except ValueError:
        reached = 0
    return {'exit_code': code, 'requested_frames': target, 'frames': reached,
            'execution_passed': code == 0 and qa.get('runtime_started') == 'PASS' and reached >= target,
            'capture_present': capture_present, 'first_stage_complete': None,
            'qa': qa}


def audit(project, executable, frames, replay=None, timeout=120, output=None):
    project, executable = Path(project).resolve(), Path(executable).resolve()
    cart = project / 'assets/cart-data.bin'
    if not executable.is_file() or not cart.is_file():
        raise ValueError('project assets or executable missing')
    replay = Path(replay).resolve() if replay else None
    if replay and not replay.is_file():
        raise ValueError('replay missing')
    if timeout <= 0:
        raise ValueError('timeout must be positive')
    parent = Path(output).resolve() if output else project / 'reports/checkpoints'
    parent.mkdir(parents=True, exist_ok=True)
    session = Path(tempfile.mkdtemp(prefix='session-', dir=parent))
    report = {'schema': 'forja65.checkpoint-audit.v1',
              'rom_sha256': hashlib.sha256(cart.read_bytes()).hexdigest(),
              'executable_sha256': hashlib.sha256(executable.read_bytes()).hexdigest(),
              'replay_sha256': hashlib.sha256(replay.read_bytes()).hexdigest() if replay else None,
              'first_stage_complete': None,
              'limit': 'Frame budgets and images require game-specific review; no stage completion inferred.',
              'checkpoints': []}
    for frame in frames:
        run = session / ('frame-' + str(frame))
        run.mkdir()
        shutil.copytree(project / 'assets', run / 'assets')
        # Neutralize inherited observers/migration settings for a reproducible reference run.
        env = {k: v for k, v in os.environ.items() if not k.startswith('FORJA65_')}
        env.update(FORJA65_HEADLESS='1', FORJA65_HEADLESS_FRAMES=str(frame),
                   FORJA65_CAPTURE_FRAME=str(frame), FORJA65_CAPTURE_DIR='capture',
                   FORJA65_FRAME_HASHES='1', FORJA65_PPU_TRACE='1',
                   FORJA65_EXECUTION='reference', FORJA65_ROM_MODE='cart',
                   FORJA65_WATCHDOG_INSTRUCTIONS='1000000000')
        if replay:
            env['FORJA65_INPUT_REPLAY'] = str(replay)
        try:
            result = subprocess.run([str(executable)], cwd=run, env=env,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    timeout=timeout)
            code, stdout, error = result.returncode, result.stdout, None
        except subprocess.TimeoutExpired as exc:
            code, stdout, error = None, exc.stdout or b'', 'execution timeout'
        (run / 'stdout.log').write_bytes(stdout)
        qa_path = run / 'forja65-qa-status.txt'
        qa = qa_path.read_text(errors='replace') if qa_path.exists() else ''
        item = classify_run(code, qa, frame, (run / 'capture/preview.ppm').is_file())
        item.update(directory=run.name, timeout_error=error)
        report['checkpoints'].append(item)
        (session / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        print(f'frame={frame} execution={item["execution_passed"]} capture={item["capture_present"]}', flush=True)
        if not item['execution_passed']:
            break
    return session, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project')
    parser.add_argument('--exe', required=True)
    parser.add_argument('--frames', default='120,300,900')
    parser.add_argument('--replay')
    parser.add_argument('--timeout', type=int, default=120)
    parser.add_argument('--out')
    args = parser.parse_args()
    try:
        session, report = audit(args.project, args.exe, parse_frames(args.frames), args.replay, args.timeout, args.out)
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    print(session / 'report.json')
    return 0 if all(c['execution_passed'] and c['capture_present'] for c in report['checkpoints']) else 3


if __name__ == '__main__':
    raise SystemExit(main())
