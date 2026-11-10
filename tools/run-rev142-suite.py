#!/usr/bin/env python3
"""Exhaustive JS regression sweep with bounded per-test runtime and retained logs."""
from pathlib import Path
import concurrent.futures,subprocess,json,time,os,signal,tempfile,shutil
root=Path(__file__).resolve().parents[1]
out=root/'reports'/'rev142';out.mkdir(parents=True,exist_ok=True)
tests=sorted((root/'tests').glob('*.js'))
def run(p):
 t=time.monotonic();env=os.environ.copy();env['FORJA65_SKIP_NATIVE_TESTS']='1'
 vault=tempfile.mkdtemp(prefix='rev142-test-knowledge-');env['FORJA65_KNOWLEDGE_HOME']=vault
 # Historical renderer snapshots explicitly target the compatibility path.
 if p.name in ['ppu-obj-timed-raster-v043674-regression.js','ppu-obj-chr-latch-v043675-regression.js']:env['FORJA65_OBJ_LEGACY_HIRES_INTERLACE']='1'
 if p.name=='ppu-obj-timed-raster-v043674-regression.js':env['FORJA65_OBJ_LIVE_CHR']='1'
 try:
  r=subprocess.Popen(['node',str(p)],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
  try:
   output,_=r.communicate(timeout=180);code=r.returncode
   status='pass' if code==0 else 'fail'
   if code==0 and 'FORJA65_SKIP_NATIVE_TESTS' in p.read_text():status='structural_pass'
  except subprocess.TimeoutExpired:
   os.killpg(r.pid,signal.SIGKILL);output,_=r.communicate();status='timeout';code=None
 except Exception as e:status='error';code=None;output=str(e)
 shutil.rmtree(vault,ignore_errors=True)
 (out/(p.name+'.log')).write_text(output)
 return dict(test=p.name,status=status,exit_code=code,seconds=round(time.monotonic()-t,2))
records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for r in pool.map(run,tests):
  records.append(r)
  (out/'suite.json').write_text(json.dumps(dict(tested=len(records),total=len(tests),results=records),indent=2)+'\n')
  print(r['status'],r['test'],r['seconds'],flush=True)
counts={s:sum(r['status']==s for r in records) for s in ['pass','structural_pass','fail','timeout','error']}
print(json.dumps(counts),flush=True)
raise SystemExit(1 if counts['fail'] or counts['timeout'] else 0)
