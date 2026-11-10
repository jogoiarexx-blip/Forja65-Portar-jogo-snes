"""Run all project JS regressions plus affected RMW/IRQ Python and SPC corpus checks."""
import argparse,concurrent.futures,json,os,shutil,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LOG=ROOT/'reports/validation-v043686/full'
def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--workers',type=int,default=4)
 parser.add_argument('--only',help='Comma-separated task names from the summary')
 args=parser.parse_args()
 if not 1<=args.workers<=8:parser.error('--workers must be between1 and8')
 required=['node','cmake']
 missing=[name for name in required if not shutil.which(name)]
 if not (shutil.which(os.environ.get('CXX','g++')) or shutil.which('c++')):missing.append('C++20 compiler (CXX/g++)')
 if missing:parser.error('Missing prerequisites: '+', '.join(missing)+'. Install them and retry; no checks have been skipped.')
 tasks=[(p.name,['node',str(p)]) for p in sorted((ROOT/'tests').glob('*.js'))]
 patterns=['test_rmw_runtime_trace_v043632.py','test_rmw_reference_oracle_v043633.py','test_rmw_intermediate_v043634.py','test_rmw_wram_port_v043635.py','test_rmw_interrupt_status_v043636.py','test_irq_open_bus_v043637.py']
 import sys
 tasks.extend((p,[sys.executable,'-m','unittest','discover','-s','tools','-p',p,'-v']) for p in patterns)
 tasks.append(('spc-single-step-corpus',[sys.executable,str(ROOT/'tests/spc-singlestep-v043666-test.py')]))
 if args.only:
  requested=set(args.only.split(','));tasks=[t for t in tasks if t[0] in requested]
  if {t[0] for t in tasks}!=requested:parser.error('Unknown --only task')
 LOG.mkdir(parents=True,exist_ok=True)
 def run(t):
  name,cmd=t;start=time.monotonic()
  try:
   env=os.environ.copy();env.setdefault('CMAKE_BUILD_PARALLEL_LEVEL','2')
   p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=600,env=env)
   code=p.returncode;output=p.stdout+p.stderr
  except Exception as e:code=-1;output=str(e)
  (LOG/(name+'.log')).write_text(output,encoding='utf8')
  return {'test':name,'passed':code==0,'exit_code':code,'seconds':round(time.monotonic()-start,2)}
 rows=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
  for f in concurrent.futures.as_completed([pool.submit(run,t) for t in tasks]):
   row=f.result();rows.append(row);print(('PASS ' if row['passed'] else 'FAIL ')+row['test'],flush=True)
 summary=LOG/'summary.json'
 if args.only and summary.exists():
  old=json.loads(summary.read_text());names={r['test'] for r in rows};rows=[r for r in old if r['test'] not in names]+rows
 summary.write_text(json.dumps(rows,indent=2)+'\n')
 print(f"{sum(r['passed'] for r in rows)}/{len(rows)} checks passed")
 return 0 if all(r['passed'] for r in rows) else 1
if __name__=='__main__':raise SystemExit(main())
