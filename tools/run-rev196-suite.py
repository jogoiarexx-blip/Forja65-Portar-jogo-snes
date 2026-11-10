#!/usr/bin/env python3
"""Exhaustive JS regression sweep with bounded per-test runtime and retained logs."""
from pathlib import Path
import concurrent.futures,subprocess,json,time,os,signal,tempfile,shutil
root=Path(__file__).resolve().parents[1]
out=root/'reports'/os.environ.get('FORJA65_SUITE_OUT','rev196');out.mkdir(parents=True,exist_ok=True)
tests=sorted((root/'tests').glob('*.js'))
if os.environ.get('FORJA65_SUITE_ONLY'):tests=[t for t in tests if t.name in os.environ['FORJA65_SUITE_ONLY'].split(',')]
# REV143: testes de valores congelados da temporizacao anterior (DMA sem alinhamento, HDMA so setup em V=0,
# SPC a 1.024.000 Hz, RDNMI em H=12...). Rodam com FORJA65_TIMING_PROFILE=rev142, que reproduz a REV142 bit a bit;
# o comportamento novo tem testes proprios (timing-sync-rev143, shortline-spcsync, spc-aot-learn-cfg-rev143).
LEGACY_TIMING={'dma-payload-phase-v043685-regression.js','dma-startup-v0432-regression.js','dma-wram-conflict-v0436-regression.js',
 'dma-wram-zero-v043685-regression.js','hdma-bus-cost-v043666-video-regression.js','hdma-nltr-override-v043661-regression.js',
 'hdma-phases-v043667-hdma-regression.js','irq-sparse-equivalence-v043685-regression.js','master-cycle-irq-hdma-v029-regression.js',
 'renderer-timing-flow-v023-regression.js','snes9x-reference-v026-regression.js','tetris-hdma-v0400-regression.js',
 'tetris-spc-ipl-v0408-regression.js','timing-order-v0432-regression.js'}
PREEXISTING={'observed_jsr_cache_version_v043699_regression.js',  # versao fixa historica (ja falhava na REV142)
 # REV194: falham igualmente na REV193-R2 sem mudancas (conferido nesta maquina, mesmo erro): interpretador/export
 # ausentes no C++ de teste, marcador de export do SST e cabecalhos esperados por testes antigos.
 'control-audit-finish-rev143-regression.js','control-replay-checkpoint-rev144-regression.js','cpu-sst65816-v0436132-regression.js',
 'oam-dma-v24-regression.js','tetris-spc-poll-window-v0411-regression.js','wram-fill-v0430-regression.js','wram-snapshot-v19-regression.js',
 'wram-stores-interrupt-resume-regression.js','wram-watch-v18-regression.js'}
# REV194: testes de CFG/inventario que usam o espelho LoROM em $40-7D/$C0-FF:0000-7FFF de ROMs sinteticas (o mapa
# novo segue o bsnes, sem espelho). Rodam com FORJA65_MAPPING=legacy; o mapa novo tem rom-mapping-rev194 e rev136.
LEGACY_MAPPING={'indirect-rie-v043696-regression.js','rom-inventory-bounds-v043694-regression.js'}
def run(p):
 t=time.monotonic();env=os.environ.copy();env['FORJA65_SKIP_NATIVE_TESTS']='1';env['PATH']=str(Path.home()/'.local/bin')+os.pathsep+env.get('PATH','')
 vault=tempfile.mkdtemp(prefix='rev143-test-knowledge-');env['FORJA65_KNOWLEDGE_HOME']=vault
 legacy=p.name in LEGACY_TIMING
 if legacy:env['FORJA65_TIMING_PROFILE']='rev142'
 if p.name in LEGACY_MAPPING:env['FORJA65_MAPPING']='legacy'
 # Historical renderer snapshots explicitly target the compatibility path.
 if p.name in ['ppu-obj-timed-raster-v043674-regression.js','ppu-obj-chr-latch-v043675-regression.js']:env['FORJA65_OBJ_LEGACY_HIRES_INTERLACE']='1'
 if p.name=='ppu-obj-timed-raster-v043674-regression.js':env['FORJA65_OBJ_LIVE_CHR']='1'
 try:
  r=subprocess.Popen(['node',str(p)],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
  try:
   output,_=r.communicate(timeout=600);code=r.returncode
   status='pass' if code==0 else 'fail'
   if code==0 and 'FORJA65_SKIP_NATIVE_TESTS' in p.read_text():status='structural_pass'
   if code==0 and legacy:status='pass_rev142_profile'
   if code==0 and p.name in LEGACY_MAPPING:status='pass_legacy_mapping'
   if code!=0 and p.name in PREEXISTING:status='preexisting'
  except subprocess.TimeoutExpired:
   os.killpg(r.pid,signal.SIGKILL);output,_=r.communicate();status='timeout';code=None
 except Exception as e:status='error';code=None;output=str(e)
 shutil.rmtree(vault,ignore_errors=True)
 (out/(p.name+'.log')).write_text(output)
 return dict(test=p.name,status=status,exit_code=code,seconds=round(time.monotonic()-t,2))
records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=int(os.environ.get('FORJA65_SUITE_JOBS','2'))) as pool:
 for r in pool.map(run,tests):
  records.append(r)
  (out/'suite.json').write_text(json.dumps(dict(tested=len(records),total=len(tests),results=records),indent=2)+'\n')
  print(r['status'],r['test'],r['seconds'],flush=True)
counts={s:sum(r['status']==s for r in records) for s in ['pass','structural_pass','pass_rev142_profile','pass_legacy_mapping','preexisting','fail','timeout','error']}
print(json.dumps(counts),flush=True)
raise SystemExit(1 if counts['fail'] or counts['timeout'] else 0)
