#!/usr/bin/env python3
"""Run all standalone Python regressions; preserve failure output and exit status."""
import concurrent.futures, pathlib, subprocess, sys, time
root=pathlib.Path(__file__).resolve().parents[1]
def run(path):
 start=time.monotonic()
 try:
  q=subprocess.run([sys.executable,str(path)],cwd=root,capture_output=True,text=True,timeout=360)
  return path.name,q.returncode==0,q.stdout+q.stderr,time.monotonic()-start
 except subprocess.TimeoutExpired:
  return path.name,False,'TIMEOUT after 360 seconds',time.monotonic()-start
failures=0;tests=sorted((root/'tests').glob('*.py'))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for name,passed,output,seconds in pool.map(run,tests):
  print(f'{"PASS" if passed else "FAIL"} {name} ({seconds:.2f}s)',flush=True)
  if not passed:failures+=1;print(output,file=sys.stderr,flush=True)
print(f'{len(tests)-failures}/{len(tests)} passed')
sys.exit(bool(failures))
