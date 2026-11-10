#!/usr/bin/env python3
"""Standalone JS+Python regression sweep; does not include native/Windows suite."""
import concurrent.futures,json,os,pathlib,subprocess,time,sys
root=pathlib.Path(__file__).resolve().parents[1]
files=sorted((root/'tests').glob('*regression.js'))+sorted((root/'tests').glob('*.py'))
def worker(p):
 c=['node',str(p)] if p.suffix=='.js' else [sys.executable,str(p)]
 start=time.monotonic()
 try:
  r=subprocess.run(c,cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=18,env={**os.environ,'TERM':'dumb','NO_COLOR':'1'})
  return {'file':p.name,'result':'passed' if r.returncode==0 else 'failed','exit_code':r.returncode,'seconds':round(time.monotonic()-start,2),'output_tail':r.stdout[-1200:]}
 except subprocess.TimeoutExpired as e:return {'file':p.name,'result':'timeout','seconds':round(time.monotonic()-start,2),'output_tail':str(e.stdout or b'')[-300:]}
 except Exception as e:return {'file':p.name,'result':'error','error':str(e)}
records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for record in pool.map(worker,files):
  records.append(record)
  if len(records)%40==0: print('completed',len(records),'/',len(files),flush=True)
counts={name:sum(x['result']==name for x in records) for name in ('passed','failed','timeout','error')}
out=root/'reports/test-sweep-v0436102.json';out.parent.mkdir(exist_ok=True,parents=True)
out.write_text(json.dumps({'schema':'forja65.standalone-test-sweep.v1','scope':'Standalone tests/*regression.js and tests/*.py only; no claim for Windows or native replay','tested':len(records),'counts':counts,'items':records},indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'count':len(records),'counts':counts,'nonpass':[{k:v for k,v in x.items() if k in ('file','result')} for x in records if x['result']!='passed'],'report':str(out)},ensure_ascii=False),flush=True)
