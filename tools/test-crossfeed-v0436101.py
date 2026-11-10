"""Run every root JS and Python test, retaining exact status and logs."""
from pathlib import Path
import concurrent.futures,json,os,subprocess,time,sys,argparse
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--only');a=p.parse_args();out=ROOT/'reports/crossfeed-v0436101/suite';out.mkdir(parents=True,exist_ok=True)
 tasks=[(f.name,['node',str(f)])for f in sorted((ROOT/'tests').glob('*.js'))]+[(f.name,[sys.executable,str(f)])for f in sorted((ROOT/'tests').glob('*.py')) if 'singlestep'not in f.name]
 if a.only:
  names=set(a.only.split(','));tasks=[t for t in tasks if t[0]in names];assert {n for n,c in tasks}==names
 env=os.environ.copy();cmake='/workspace/scratch/e2933529b67a/tooling-cmake/cmake/data/bin';env['PATH']=cmake+os.pathsep+env['PATH'];env.setdefault('CMAKE_BUILD_PARALLEL_LEVEL','2')
 def run(t):
  name,cmd=t;start=time.monotonic()
  try:r=subprocess.run(cmd,cwd=ROOT,env=env,capture_output=True,text=True,timeout=600);code=r.returncode;log=r.stdout+r.stderr
  except subprocess.TimeoutExpired as e:code=-999;log=str(e)
  (out/(name+'.log')).write_text(log);return {'test':name,'exit':code,'seconds':round(time.monotonic()-start,3)}
 rows=[];start=time.monotonic()
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
  for i,future in enumerate(concurrent.futures.as_completed([pool.submit(run,t)for t in tasks]),1):
   row=future.result()
   rows.append(row)
   (out/('retest-partial.json'if a.only else'partial.json')).write_text(json.dumps(rows,indent=2)+'\n')
   if row['exit']or i%20==0:print(i,len(tasks),row,flush=True)
 name='retest.json'if a.only else'results.json';(out/name).write_text(json.dumps(rows,indent=2)+'\n');print('FINISHED',len(rows),sum(r['exit']==0 for r in rows),'seconds',time.monotonic()-start,flush=True)
 return int(any(r['exit']for r in rows))
if __name__=='__main__':raise SystemExit(main())
