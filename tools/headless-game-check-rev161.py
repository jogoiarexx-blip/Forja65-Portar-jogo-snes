#!/usr/bin/env python3
"""Build a generated Linux port with g++ and compare its slow/fast paths on identical input."""
import argparse,concurrent.futures,hashlib,json,os,pathlib,re,shutil,subprocess,time
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def fields(p):
 return dict(line.split('=',1) for line in p.read_text().splitlines() if '=' in line) if p.exists() else {}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('project',type=pathlib.Path);p.add_argument('--frames',type=int,default=300);p.add_argument('--jobs',type=int,default=2);p.add_argument('--replay',type=pathlib.Path);p.add_argument('--native-rom-pack',type=pathlib.Path);p.add_argument('--no-build',action='store_true');a=p.parse_args()
 if a.frames<1 or a.jobs<1:p.error('frames/jobs must be positive')
 d=a.project.resolve();b=d/'build-rev161';b.mkdir(exist_ok=True);exe=b/'game'
 def call(args):subprocess.run(args,check=True)
 if not a.no_build:
  flags=['-std=c++20','-O1','-g0','-DFORJA65_ENABLE_TRACE=0','-I'+str(d/'src')]
  cm=(d/'CMakeLists.txt').read_text();section=cm[cm.index('add_library(forja65_generated'):cm.index('target_include_directories(forja65_generated')]
  srcs=list(dict.fromkeys(re.findall(r'src/[a-zA-Z0-9_]+\.cpp',section)))+['src/main.cpp']
  if (d/'src/spc700_native.cpp').exists():srcs+=['src/spc700_native.cpp'];flags+=['-DFORJA65_NATIVE_SPC_LINKED=1']
  print('Building',len(srcs),'translation units',flush=True)
  header=d/'src/runtime.hpp';pch=d/'src/runtime.hpp.gch'
  try:
   call(['g++',*flags,'-x','c++-header',str(header),'-o',str(pch)])
   def compile_one(src):
    obj=b/(pathlib.Path(src).stem+'.o');call(['g++',*flags,'-c',str(d/src),'-o',str(obj)]);return str(obj)
   with concurrent.futures.ThreadPoolExecutor(max_workers=a.jobs) as pool:objects=list(pool.map(compile_one,srcs))
   call(['g++',*objects,'-o',str(exe),'-lpthread'])
  finally:pch.unlink(missing_ok=True)
 if not exe.is_file() or exe.stat().st_size<1000:raise RuntimeError('missing/empty executable')
 if a.native_rom_pack:shutil.copyfile(a.native_rom_pack.resolve(),d/'assets/native-rom-data.bin')
 runs=[]
 for label,fast in [('control','0'),('candidate','1')]:
  run=d/('check-rev161-'+label)
  if run.exists():raise RuntimeError('use a fresh output directory: '+str(run))
  run.mkdir();(run/'assets').symlink_to(d/'assets',target_is_directory=True)
  # Host settings from an earlier run must not silently change the test profile.
  env={k:v for k,v in os.environ.items() if not k.startswith('FORJA65_')}
  env.update({'FORJA65_HEADLESS':'1','FORJA65_HEADLESS_FRAMES':str(a.frames),'FORJA65_AUDIO_PACING':'0','FORJA65_AUDIO_DUMP':'1','FORJA65_FRAME_HASHES':'1','FORJA65_SRAM_PATH':str(run/'isolated.srm'),'FORJA65_PPU_FAST_DATA':fast,'FORJA65_HDMA_IDLE_SKIP':fast,'FORJA65_ROM_MODE':'native' if fast=='1' and a.native_rom_pack else 'cart','FORJA65_SPC_PROFILE':'reference','FORJA65_CAPTURE_FRAME':str(a.frames),'FORJA65_CAPTURE_DIR':str(run/'capture')})
  if a.replay:env['FORJA65_INPUT_REPLAY']=str(a.replay.resolve())
  t=time.monotonic();r=subprocess.run([str(exe)],cwd=run,env=env,capture_output=True,text=True,timeout=300)
  (run/'run.log').write_text(r.stdout+r.stderr);qa=fields(run/'forja65-qa-status.txt');cpu=fields(run/'forja65-cpu-interpreter.txt')
  row={'label':label,'exit_code':r.returncode,'seconds':round(time.monotonic()-t,3),'qa':qa,'cpu_fallback_instructions':int(cpu.get('instructions','0'))}
  for name in ['forja65-frame-hashes.txt','forja65-native-audio.wav']:
   f=run/name;row[name+'_sha256']=sha(f) if f.is_file() else None
  runs.append(row);print(label,row['exit_code'],qa.get('frames'),flush=True)
 checks={'requested_frames':all(r['exit_code']==0 and r['qa'].get('frames')==str(a.frames) for r in runs)}
 for name in ['forja65-frame-hashes.txt','forja65-native-audio.wav']:
  k=name+'_sha256';checks[name]=bool(runs[0][k]) and runs[0][k]==runs[1][k]
 report={'scope':'Same executable and input; control disables PPU data/idle HDMA fast paths, candidate enables them. Optional native ROM pack only in candidate. This is equivalence, not an independent emulator oracle.','frames':a.frames,'input':'replay' if a.replay else 'no buttons','executable_sha256':sha(exe),'runtime_sha256':sha(d/'src/runtime.hpp'),'checks':checks,'runs':runs}
 (d/'REV161-game-check.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(checks),flush=True)
 return 0 if all(checks.values()) else 1
if __name__=='__main__':raise SystemExit(main())
