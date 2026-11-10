#!/usr/bin/env python3
"""Run the existing standalone JS tests with isolated logs and explicit limits.
Usage: python3 tools/run-rie-regressions.py --timeout 600 --workers 2 --out reports/local-rie
This does not classify known failures as passes. Compare result files explicitly.
"""
import argparse,concurrent.futures,json,os,pathlib,signal,subprocess,time
p=argparse.ArgumentParser();p.add_argument('--timeout',type=int,default=600);p.add_argument('--workers',type=int,default=2);p.add_argument('--out',default='reports/local-rie');a=p.parse_args()
if not 1<=a.workers<=8 or a.timeout<1:p.error('workers must be 1..8 and timeout positive')
root=pathlib.Path(__file__).resolve().parent.parent;folder=(root/a.out).resolve();folder.mkdir(parents=True,exist_ok=True);logs=folder/'logs';logs.mkdir(exist_ok=True)
def run(test):
 start=time.monotonic();q=subprocess.Popen(['node',str(test)],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
 try:output,_=q.communicate(timeout=a.timeout);code=q.returncode
 except subprocess.TimeoutExpired:
  if os.name=='nt':subprocess.run(['taskkill','/PID',str(q.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  else:os.killpg(q.pid,signal.SIGKILL)
  output,_=q.communicate();code='timeout';output+='\nTIMEOUT '+str(a.timeout)+'s'
 (logs/(test.name+'.log')).write_text(output,encoding='utf8');return {'test':test.name,'exit':code,'seconds':time.monotonic()-start}
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers)as pool:
 futures=[pool.submit(run,test)for test in sorted((root/'tests').glob('*.js'))]
 for future in concurrent.futures.as_completed(futures):
  rows.append(future.result());(folder/'results.json').write_text(json.dumps(sorted(rows,key=lambda x:x['test']),indent=2)+'\n',encoding='utf8')
print(str(sum(row['exit']==0 for row in rows))+'/'+str(len(rows))+' passed')
raise SystemExit(0 if all(row['exit']==0 for row in rows)else 1)
