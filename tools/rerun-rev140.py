#!/usr/bin/env python3
from pathlib import Path
import concurrent.futures,subprocess,json,time,os,signal,tempfile,shutil
root=Path(__file__).resolve().parents[1];out=root/'reports/rev140';first=json.loads((out/'suite.json').read_text())
names=[r['test'] for r in first['results'] if r['status']=='timeout']
names+=['cpu-sst65816-v0436132-regression.js','irq-horizontal-v043685-regression.js','smw-supervised-cfg-migration-v043612-regression.js']
def run(name):
 t=time.monotonic();env=os.environ.copy();env.pop('FORJA65_SKIP_NATIVE_TESTS',None)
 vault=tempfile.mkdtemp(prefix='rev140-rerun-');env['FORJA65_KNOWLEDGE_HOME']=vault
 if name in ['ppu-obj-timed-raster-v043674-regression.js','ppu-obj-chr-latch-v043675-regression.js']:env['FORJA65_OBJ_LEGACY_HIRES_INTERLACE']='1'
 if name=='ppu-obj-timed-raster-v043674-regression.js':env['FORJA65_OBJ_LIVE_CHR']='1'
 p=subprocess.Popen(['node',str(root/'tests'/name)],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
 try:
  text,_=p.communicate(timeout=240);code=p.returncode;status='pass' if code==0 else 'fail'
 except subprocess.TimeoutExpired:
  os.killpg(p.pid,signal.SIGKILL);text,_=p.communicate();code=None;status='timeout'
 shutil.rmtree(vault,ignore_errors=True);(out/(name+'.rerun.log')).write_text(text)
 return dict(test=name,status=status,exit_code=code,seconds=round(time.monotonic()-t,2))
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for item in pool.map(run,names):
  results.append(item);(out/'rerun.json').write_text(json.dumps({'results':results,'total':len(names)},indent=2)+'\n');print(item,flush=True)
print('RERUN_COMPLETE',len(results),flush=True)
