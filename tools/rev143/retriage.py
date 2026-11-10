#!/usr/bin/env python3
"""REV143: retriagem dos testes que falharam/estouraram na suite. Roda cada um sozinho (limite 900 s) no padrao e,
se falhar, com FORJA65_TIMING_PROFILE=rev142 (valores congelados da temporizacao anterior)."""
import json,subprocess,sys,os,time,tempfile,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[2];suite=json.loads((root/'reports'/'rev143'/'suite.json').read_text())
bad=[r['test'] for r in suite['results'] if r['status'] in ('fail','timeout','error')]
out=[]
def run(t,extra):
    env=os.environ.copy();env['FORJA65_SKIP_NATIVE_TESTS']='';env.pop('FORJA65_SKIP_NATIVE_TESTS');env.update(extra)
    v=tempfile.mkdtemp();env['FORJA65_KNOWLEDGE_HOME']=v;t0=time.monotonic()
    try:r=subprocess.run(['node',str(root/'tests'/t)],cwd=root,env=env,capture_output=True,text=True,timeout=900);st='pass' if r.returncode==0 else 'fail';log=r.stdout+r.stderr
    except subprocess.TimeoutExpired:st='timeout';log=''
    shutil.rmtree(v,ignore_errors=True);return st,round(time.monotonic()-t0,1),log
for t in bad:
    st,s,log=run(t,{})
    rec={'test':t,'default':st,'seconds':s}
    if st!='pass':
        st2,s2,log2=run(t,{'FORJA65_TIMING_PROFILE':'rev142'});rec['rev142_profile']=st2
        rec['tail']=(log2 if st2!='pass' else log)[-600:]
    out.append(rec);print(json.dumps({k:v for k,v in rec.items() if k!='tail'}),flush=True)
(root/'reports'/'rev143'/'retriage.json').write_text(json.dumps(out,indent=1))
