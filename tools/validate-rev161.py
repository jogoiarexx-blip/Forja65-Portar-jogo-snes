#!/usr/bin/env python3
"""Reproducible selected regression matrix. Scores measure suites, not game compatibility."""
import argparse,concurrent.futures,json,os,pathlib,signal,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
CATEGORIES={
 'CPU':['cpu-5a22-math-v0436128','cpu-bank0-word-wrap-v0436131','cpu-bank0-generated-v0436131','cpu-fetch-mdr-rev141','cpu-bus-boundary-rev140','cpu-io-openbus-v0436122','cpu-internal-mdr-v0436129','cpu-unmapped-openbus-v0436130','cpu-sst65816-v0436132','cpu-interpreter-sst-rev161','arithmetic-decimal-v043620','stack-boundary-v043619','blockmove-v043621','rmw-bus-order-v043622'],
 'PPU':[],
 'APU_DSP':['spc700-sst-v0436132','spc-halted-timers-v043639','spc-timer-fast-forward-v043682','spc-test-ram-control-v043685','dsp-reference-v043666','dsp-echo-feedback-v043644','dsp-final-mix-v043645','dsp-zero-delay-echo-v043647','dsp-release-endx-v043667','dsp-voice-mix-saturation-v043642','dsp-envelope-output-scaling-v043683','audio-dsp-brr-v025','audio-dsp-gaussian-v022','audio-dsp-key-timing-v024'],
 'DMA_HDMA':['dma-address-step','dma-register-decode-v043685','dma-hdma-preemption-v0436123','dma-hdma-indirect-das-v0436124','hdma-bus-cost-v043666-video','hdma-nltr-override-v043661','hdma-phases-v043667-hdma','hdma-raster-idle-rev160','color-hdma-v0392'],
 'ROM_BUS':['hardware-bus-sram-v0436127','native-hardware-migration-v0328','interpreter-rom-identity-rev137'],
 'SRAM':['sram-replay-isolation-v0382','sram-save-v0436','cartridge-flow-sram-v033'],
 'CFG':['cfg-cache-compatible-v0369','cfg-cache-lineage-audit-v043611','cfg-cpu-bank-execution-v043616','stack-trampoline-summary-v0310'],
 'TIMING_TEST_ROMS':['timing-sync-rev143','clock-region-rev140']}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--jobs',type=int,default=3);p.add_argument('--timeout',type=int,default=300);p.add_argument('--json',default='reports/REV161-matrix.json');p.add_argument('--category',choices=CATEGORIES);a=p.parse_args()
 categories={k:[n+'-regression.js' for n in v] for k,v in CATEGORIES.items()}
 categories['PPU']=[f.name for f in sorted((ROOT/'tests').glob('ppu*regression.js'))]
 if a.category:categories={a.category:categories[a.category]}
 jobs=[(cat,n) for cat,names in categories.items() for n in names]
 def run(item):
  cat,name=item;t=time.monotonic();f=ROOT/'tests'/name
  if not f.exists():return dict(category=cat,test=name,status='missing',seconds=0,output='Test file unavailable')
  proc=subprocess.Popen(['node',str(f)],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
  try:
   output,_=proc.communicate(timeout=a.timeout);status='passed' if proc.returncode==0 else 'failed'
   if proc.returncode and ('cmake ENOENT' in output or 'spawnSync cmake' in output):status='blocked_dependency'
  except subprocess.TimeoutExpired:
   os.killpg(proc.pid,signal.SIGKILL);output,_=proc.communicate();status='timeout'
  return dict(category=cat,test=name,status=status,exit_code=proc.returncode,seconds=round(time.monotonic()-t,2),output=output)
 results=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,a.jobs)) as pool:
  for r in pool.map(run,jobs):results.append(r);print(r['category'],r['test'],r['status'],flush=True)
 scores={}
 for cat in categories:
  rows=[r for r in results if r['category']==cat];passed=sum(r['status']=='passed' for r in rows)
  scores[cat]={'passed':passed,'selected':len(rows),'score_0_10':round(10*passed/len(rows),3) if rows else None,'nonpass':[r['test'] for r in rows if r['status']!='passed']}
 report={'schema':'forja65.selected-regression-matrix.v1','scope':'Selected executable suites only. Equal weight per suite; not an estimate of hardware accuracy or game compatibility. Nonpassing/blocked suites stay in the denominator.','scores':scores,'items':results}
 out=ROOT/a.json;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps(scores,ensure_ascii=False),flush=True)
 return 0 if all(r['status']=='passed' for r in results) else 1
if __name__=='__main__':raise SystemExit(main())
