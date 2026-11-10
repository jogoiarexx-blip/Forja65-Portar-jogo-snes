"""Run every historical JS test; record failures without claiming all fixtures current."""
import concurrent.futures,json,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LOG=ROOT/'reports/validation-v043685/historical'
def main():
 LOG.mkdir(parents=True,exist_ok=True)
 def run(p):
  start=time.monotonic()
  try:
   out=subprocess.run(['node',str(p)],cwd=ROOT,capture_output=True,text=True,timeout=240)
   code=out.returncode;text=out.stdout+out.stderr
  except Exception as e:code=-1;text=str(e)
  (LOG/(p.stem+'.log')).write_text(text)
  return {'test':p.name,'exit_code':code,'passed':code==0,'seconds':round(time.monotonic()-start,2)}
 rows=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for f in concurrent.futures.as_completed([pool.submit(run,p) for p in sorted((ROOT/'tests').glob('*.js'))]):
   row=f.result();rows.append(row);print(('PASS ' if row['passed'] else 'FAIL ')+row['test'],flush=True)
 (LOG/'summary.json').write_text(json.dumps(rows,indent=2)+'\n')
 print(f"{sum(r['passed'] for r in rows)}/{len(rows)} historical JS tests passed")
 return 0 if all(r['passed'] for r in rows) else 1
if __name__=='__main__':raise SystemExit(main())
