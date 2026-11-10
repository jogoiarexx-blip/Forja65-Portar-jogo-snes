#!/usr/bin/env python3
"""Bounded hardware regression runner: preserves evidence and reports failures."""
import argparse, datetime, json, os, pathlib, subprocess, sys, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
TESTS = [
 ('rmw_bus_order', ['node','tests/rmw-bus-order-v043622-regression.js']),
 ('hardware_fast', [sys.executable,'tools/test-hardware-fast.py']),
 ('python_suite', [sys.executable,'tools/test-python.py']),
]
def main():
 p=argparse.ArgumentParser(); p.add_argument('--timeout',type=int,default=120); p.add_argument('--output',default='validation-v043623'); p.add_argument('--only',choices=[x[0] for x in TESTS]); args=p.parse_args()
 out=(ROOT/args.output).resolve(); out.mkdir(parents=True,exist_ok=True)
 results=[]
 for name,cmd in TESTS:
  if args.only and args.only!=name: continue
  started=time.monotonic(); status='pass'; code=None
  try:
   with (out/(name+'.log')).open('w',encoding='utf-8',errors='replace') as log:
    proc=subprocess.run(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,timeout=args.timeout,check=False)
   code=proc.returncode
   if code: status='fail'
  except subprocess.TimeoutExpired: status='timeout'
  except OSError as exc:
   status='error'; (out/(name+'.log')).write_text(str(exc),encoding='utf-8')
  results.append(dict(test=name,status=status,exit_code=code,seconds=round(time.monotonic()-started,2),log=name+'.log'))
  print(f'{name}: {status}',flush=True)
 report=dict(version='0.4.36.23-validation',utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),tests=results,all_passed=bool(results) and all(x['status']=='pass' for x in results))
 (out/'summary.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 return 0 if report['all_passed'] else 1
if __name__=='__main__': sys.exit(main())
