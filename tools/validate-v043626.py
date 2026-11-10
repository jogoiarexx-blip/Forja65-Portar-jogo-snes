#!/usr/bin/env python3
"""v0.4.36.26: isolated regression runner with per-suite timings and optional artifact reuse."""
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
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--timeout', type=int, default=120)
    p.add_argument('--output', default='reports/validation-v043626')
    p.add_argument('--only', choices=sorted(TESTS))
    p.add_argument('--list', action='store_true')
    p.add_argument('--reuse-passed', action='store_true', help='Reuse previous passing result only if command and source fingerprint match')
    args = p.parse_args(argv)
    if args.list:
        print('\n'.join(TESTS)); return 0
    if args.timeout < 1: p.error('--timeout must be at least 1')
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT): p.error('--output must be inside project')
    output.mkdir(parents=True, exist_ok=True)
    summary_path = output / 'summary.json'
    previous = {}
    if args.reuse_passed and summary_path.exists():
        try:
            previous = {r['suite']: r for r in json.loads(summary_path.read_text())['suites']}
        except (ValueError, KeyError, TypeError): previous = {}
    # Compute the same conservative fingerprint once per run, rather than once per suite.
    # Include runner and test code; exclude reports and historical copies.
    digest = hashlib.sha256()
    source_count = 0
    for folder in ('tools', 'tests'):
        for f in sorted((ROOT / folder).rglob('*')):
            if f.is_file() and f.suffix in ('.py', '.js', '.cpp', '.hpp', '.h'):
                digest.update(str(f.relative_to(ROOT)).encode())
                digest.update(hashlib.sha256(f.read_bytes()).digest())
                source_count += 1
    for f in (ROOT / 'forja65-core.js', ROOT / 'package.json'):
        if f.exists():
            digest.update(f.name.encode())
            digest.update(hashlib.sha256(f.read_bytes()).digest())
            source_count += 1
    fingerprint = digest.hexdigest()
    results = []
    for name, command in TESTS.items():
        if args.only and name != args.only: continue
        log = output / (name + '.log')
        old = previous.get(name, {})
        if (args.reuse_passed and old.get('status') == 'pass' and old.get('fingerprint') == fingerprint
                and old.get('command') == command and log.exists()
                and old.get('log_sha256') == hashlib.sha256(log.read_bytes()).hexdigest()):
            results.append({**old, 'reused': True}); print(name + ': reused pass', flush=True); continue
        started = time.monotonic(); code = None
        executable = command[0]
        missing = not pathlib.Path(executable).exists() if pathlib.Path(executable).is_absolute() else shutil.which(executable) is None
        if missing:
            status = 'unavailable'; log.write_text('Executable unavailable: '+executable+'\n')
        else:
            try:
                with log.open('wb') as handle:
                    proc = subprocess.run(command, cwd=ROOT, stdout=handle, stderr=subprocess.STDOUT, timeout=args.timeout, check=False)
                code = proc.returncode; status = 'pass' if code == 0 else 'fail'
            except subprocess.TimeoutExpired:
                status = 'timeout'
                with log.open('ab') as handle: handle.write(b'\n[VALIDATOR] Timeout exceeded\n')
            except OSError as exc:
                status = 'error'; log.write_text(str(exc)+'\n')
        results.append({'suite': name, 'status': status, 'exit_code': code, 'duration_seconds': round(time.monotonic()-started, 3), 'command': command, 'log': log.name, 'log_sha256': hashlib.sha256(log.read_bytes()).hexdigest(), 'fingerprint': fingerprint, 'reused': False})
        print(name + ': ' + status, flush=True)
    summary = {'version':'0.4.36.26','fingerprinted_sources':source_count,'generated_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'all_passed':bool(results) and all(x['status']=='pass' for x in results),'suites':results}
    summary_path.write_text(json.dumps(summary, indent=2)+'\n')
    return 0 if summary['all_passed'] else 1

if __name__ == '__main__': sys.exit(run())
