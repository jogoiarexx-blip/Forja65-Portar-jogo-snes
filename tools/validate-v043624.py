#!/usr/bin/env python3
"""Forja65 v0.4.36.24: bounded, reproducible regression gate with isolated logs."""
import argparse
import datetime
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
TESTS = {
    'rmw_bus_order': ['node', 'tests/rmw-bus-order-v043622-regression.js'],
    'hardware_fast': [sys.executable, 'tools/test-hardware-fast.py'],
    'python_suite': [sys.executable, 'tools/test-python.py'],
    'javascript_suite': ['node', 'tools/test.js'],
}

def run(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--timeout', type=int, default=120, help='Seconds per suite')
    parser.add_argument('--output', default='reports/validation-v043624')
    parser.add_argument('--only', choices=sorted(TESTS))
    parser.add_argument('--list', action='store_true', help='Show suite names')
    args = parser.parse_args(argv)
    if args.list:
        print('\n'.join(TESTS))
        return 0
    if args.timeout < 1:
        parser.error('--timeout must be at least 1 second')
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT):
        parser.error('--output must remain inside the project directory')
    output.mkdir(parents=True, exist_ok=True)
    results = []
    for name, command in TESTS.items():
        if args.only and args.only != name:
            continue
        start = time.monotonic()
        log_path = output / (name + '.log')
        status, returncode = 'error', None
        missing = shutil.which(command[0]) is None if not pathlib.Path(command[0]).is_absolute() else not pathlib.Path(command[0]).exists()
        if missing:
            log_path.write_text('Executable unavailable: ' + command[0] + '\n', encoding='utf-8')
            status = 'unavailable'
        else:
            try:
                with log_path.open('wb') as log:
                    proc = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=args.timeout, check=False)
                returncode = proc.returncode
                status = 'pass' if returncode == 0 else 'fail'
            except subprocess.TimeoutExpired:
                status = 'timeout'
                with log_path.open('ab') as log:
                    log.write(b'\n[VALIDATOR] Per-suite timeout exceeded\n')
            except OSError as exc:
                log_path.write_text(str(exc) + '\n', encoding='utf-8')
        results.append({'suite': name, 'status': status, 'exit_code': returncode,
                        'duration_seconds': round(time.monotonic() - start, 3),
                        'command': command, 'log': log_path.name,
                        'log_sha256': hashlib.sha256(log_path.read_bytes()).hexdigest()})
        print(f'{name}: {status}', flush=True)
    summary = {'version': '0.4.36.24', 'generated_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'all_passed': bool(results) and all(r['status'] == 'pass' for r in results), 'suites': results}
    (output / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return 0 if summary['all_passed'] else 1

if __name__ == '__main__':
    sys.exit(run())
