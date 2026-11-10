from pathlib import Path
import ast,concurrent.futures,json,os,subprocess,tempfile,time
root=Path(__file__).resolve().parents[1];out=root/'reports/rev144-cmake-rechecks';out.mkdir(exist_ok=True)
suite=json.loads((root/'reports/rev144/suite.json').read_text())
assert suite['tested']==suite['total'],'Wait until broad sweep finishes'
tree=ast.parse((root/'tools/run-rev144-suite.py').read_text());legacy=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='LEGACY_TIMING' for t in n.targets))
tests=[r['test'] for r in suite['results'] if r['status']=='fail' and ('cmake' in (root/'reports/rev144'/(r['test']+'.log')).read_text().lower())]
def run(name):
 start=time.monotonic();env=os.environ.copy();env['PATH']=str(Path.home()/'.local/bin')+os.pathsep+env.get('PATH','');env['FORJA65_SKIP_NATIVE_TESTS']='1'
 if name in legacy:env['FORJA65_TIMING_PROFILE']='rev142'
 with tempfile.TemporaryDirectory(prefix='cmake-recheck-') as vault:
  env['FORJA65_KNOWLEDGE_HOME']=vault
  p=subprocess.run(['node',str(root/'tests'/name)],cwd=root,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=900)
 (out/(name+'.log')).write_text(p.stdout);result={'test':name,'status':'pass' if p.returncode==0 else 'fail','exit_code':p.returncode,'seconds':time.monotonic()-start};print(json.dumps(result),flush=True);return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:records=list(ex.map(run,tests))
(out/'summary.json').write_text(json.dumps(records,indent=2)+'\n');assert all(r['status']=='pass' for r in records)
