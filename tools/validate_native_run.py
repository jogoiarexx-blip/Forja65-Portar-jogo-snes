from pathlib import Path
import hashlib,json,os,resource,struct,subprocess,sys,time
here=Path(__file__).resolve().parent;root=next((p for p in [here,*here.parents] if (p/'final-fight3-rev144/src/runtime.hpp').is_file()),None);assert root is not None,'Place this helper beside the final-fight3-rev144 folder or within the extracted workspace';r=root/'final-fight3-rev144';name,binary,trace,n,timing=sys.argv[1:];n=int(n);out=r/name;out.mkdir(exist_ok=False);(out/'assets').symlink_to(r/'assets',target_is_directory=True)
env={k:v for k,v in os.environ.items() if not k.startswith('FORJA65_')};env.update(FORJA65_HEADLESS='1',FORJA65_HEADLESS_FRAMES=str(n),FORJA65_UNCAPPED='1',FORJA65_INPUT_REPLAY=str(r/trace),FORJA65_SPC_PROFILE='reference',FORJA65_TIMING_PROFILE=timing,FORJA65_AUDIO_MODE='native',FORJA65_AUDIO_DUMP='1',FORJA65_SPC_AOT_LEARN='spc-learn',FORJA65_FRAME_HASHES='1',FORJA65_FRAME_PROGRESS_CSV='progress.csv',FORJA65_FRAME_PROGRESS_EVERY='300',FORJA65_CHECKPOINT_SAVE_AT=str(n-1000),FORJA65_CHECKPOINT_PATH=str(out/'near-end.f65s'))
exe=r/'build-linux'/binary;exe.chmod(exe.stat().st_mode|0o111);binary_sha_at_launch=hashlib.sha256(exe.read_bytes()).hexdigest();(out/'launch.json').write_text(json.dumps({'binary':str(exe),'sha256':binary_sha_at_launch},indent=2)+'\n');start=time.monotonic()
(out/'environment.json').write_text(json.dumps({k:v for k,v in env.items() if k.startswith('FORJA65_')},indent=2)+'\n')
with (out/'stdout.log').open('w') as log:p=subprocess.run([str(exe)],cwd=out,env=env,stdout=log,stderr=subprocess.STDOUT,preexec_fn=lambda:resource.setrlimit(resource.RLIMIT_STACK,(1024**3,1024**3)))
assert p.returncode==0,(p.returncode,(out/'stdout.log').read_text()[-2500:])
kv=lambda f:dict(l.split('=',1) for l in (out/f).read_text().splitlines() if '=' in l and not l.startswith('#'))
qa=kv('forja65-qa-status.txt');audit=kv('forja65-native-dependency-report.txt');audio=kv('forja65-audio-report.txt');wav=(out/'forja65-native-audio.wav').read_bytes()
assert struct.unpack_from('<I',wav,4)[0]==len(wav)-8 and struct.unpack_from('<I',wav,40)[0]==len(wav)-44
assert (len(wav)-44)//4==int(audio['wav_frames'])==int(qa['dsp_native_samples']);assert int(qa['frames'])==n
frames=hashlib.sha256((out/'forja65-frame-hashes.txt').read_bytes()).hexdigest();fallback=int(audit['cpu_interpreter_instructions'])
if n==5000:
 assert fallback==0 and int(qa['apu_aot_misses'])==0
 assert int(qa['apu_aot_instructions'])>0 and audit['APU_FULLY_NATIVE']=='YES','SPC AOT backend not fully active'
 assert kv('forja65-spc-upload.txt')['spc_backend']=='aot_instruction'
 assert frames=='7ed5725c27d05a89a385a8d42d365c33695f1d4a40ac3484cd8064799acf4532'
 assert hashlib.sha256(wav).hexdigest()=='7a6c9ae84e252664df9f87aefbd855e34647e37a0c8ea2c9b4ebe5e9b3cee412'
if n==72064 and timing=='rev142':
 assert frames=='f8607371843a9dae32537147ff2332a989600a6f89cb7606ba9c9e1f8ab90d41'
 assert hashlib.sha256(wav[44:]).hexdigest()=='504faad043751050bcf1341a10be8582c746267c4bcc2db591ff4d332082aa6a'
result={'status':'PASS','frames':n,'timing':timing,'binary':binary,'cpu_instructions':int(qa['instructions']),'cpu_interpreted':fallback,'cpu_aot_percent':100*(1-fallback/int(qa['instructions'])),'spc_aot_misses':int(qa['apu_aot_misses']),'spc_aot_instructions':int(qa['apu_aot_instructions']),'spc_backend_reported':kv('forja65-spc-upload.txt')['spc_backend'],'apu_fully_native':audit['APU_FULLY_NATIVE'],'frame_hashes_sha256':frames,'wav_sha256':hashlib.sha256(wav).hexdigest(),'pcm_sha256':hashlib.sha256(wav[44:]).hexdigest(),'binary_sha256':binary_sha_at_launch,'seconds':time.monotonic()-start}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
