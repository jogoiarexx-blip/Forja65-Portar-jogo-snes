import concurrent.futures,os,pathlib,json,subprocess,time,re,hashlib,sys
root=pathlib.Path('work/Super-Bomberman-2-v0.59-FONTE').resolve()
exe=pathlib.Path(sys.argv[1]).resolve()
out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(exist_ok=True)
mode=sys.argv[3] if len(sys.argv)>3 else 'native'
routes=[('1-1','4361'),('2-1','6442'),('3-1','3903'),('4-1','9564'),('5-1','7735'),('1-7','1753'),('2-7','2764'),('3-7','3764'),('4-7','4764'),('5-7','5764')]
if mode.endswith('long'):routes=[('original-24000',None)]
def kv(path):
 return dict(l.split('=',1) for l in path.read_text().splitlines() if '=' in l) if path.exists() else {}
def run(route):
 name,code=route;d=out/name;d.mkdir(exist_ok=True)
 if not (d/'assets').exists():(d/'assets').symlink_to(root/'assets',target_is_directory=True)
 replay=root/'reports/v0.59/routes/inputs'/f'{code}.txt' if code else root/'reports/v0.57-inputs/partida-replay(7).txt'
 env={k:v for k,v in os.environ.items() if not k.startswith('FORJA65_')}
 env.update(FORJA65_HEADLESS='1',FORJA65_HEADLESS_FRAMES='6000' if code else '24000',FORJA65_UNCAPPED='1',FORJA65_INPUT_REPLAY=str(replay),FORJA65_INPUT_REPLAY_ONCE='0',FORJA65_CPU_INTERPRETER='1' if mode.startswith('reference') else '0',FORJA65_SPC_PROFILE=str(d/'spc-profile.json'),FORJA65_AUDIO_MODE='native',FORJA65_DSP_PROFILE='v16',FORJA65_DSP_CLOCK='fractional',FORJA65_SPC_CLOCK='accurate',FORJA65_AUDIO_DUMP='1' if name in ('1-1','5-7') else '0',FORJA65_PROGRESS_EVERY='2000')
 if 'instruction' in mode:env['FORJA65_CPU_INSTRUCTION_PROFILE']=str(d/'cpu-executed-profile.json')
 start=time.time()
 with (d/'run.log').open('w') as f:p=subprocess.run([str(exe)],cwd=d,env=env,stdout=f,stderr=subprocess.STDOUT)
 q=kv(d/'forja65-qa-status.txt');i=kv(d/'forja65-cpu-interpreter.txt');wav=d/'forja65-native-audio.wav'
 r=dict(stage=name,code=code,exit=p.returncode,seconds=round(time.time()-start,2),qa=q,interpreter=i,wav_sha256=hashlib.sha256(wav.read_bytes()).hexdigest() if wav.exists() else None)
 (d/'result.json').write_text(json.dumps(r,indent=2));print(name,p.returncode,q.get('frames'),i.get('instructions'),q.get('apu_fallback_master_cycles'),flush=True)
 return r
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(run,routes))
(out/'summary.json').write_text(json.dumps(results,indent=2))
assert all(x['exit']==0 for x in results)
