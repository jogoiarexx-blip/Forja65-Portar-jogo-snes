from pathlib import Path
import hashlib,json,os,struct,subprocess,time
root=Path(__file__).resolve().parent;r=root/'toolchains/wine-local';out=root/'final-fight3-rev144'/os.environ.get('FORJA65_WINDOWS_VALIDATION_OUT','windows-validation-5000-r2');out.mkdir(exist_ok=False)
(out/'assets').symlink_to(root/'final-fight3-rev144/assets',target_is_directory=True)
env={k:v for k,v in os.environ.items() if not k.startswith('FORJA65_')}
env.update(LD_LIBRARY_PATH=str(r/'usr/lib/x86_64-linux-gnu'),WINEDLLPATH=str(r/'usr/lib/x86_64-linux-gnu/wine'),WINESERVER=str(r/'usr/lib/wine/wineserver64'),WINELOADER=str(r/'usr/lib/wine/wine64'),WINEPREFIX=str(root/'toolchains/wine-prefix'),WINEDEBUG='-all',WINEDLLOVERRIDES='mscoree,mshtml=')
env.update(FORJA65_HEADLESS='1',FORJA65_HEADLESS_FRAMES='5000',FORJA65_UNCAPPED='1',FORJA65_INPUT_REPLAY='Z:'+str(root/'final-fight3-rev144/replay-5000.trace').replace('/','\\'),FORJA65_CPU_BACKEND='native',FORJA65_SPC_PROFILE='reference',FORJA65_TIMING_PROFILE='rev143',FORJA65_AUDIO_MODE='native',FORJA65_AUDIO_DUMP='1',FORJA65_FRAME_HASHES='1')
for p in (r/'usr/lib/wine').iterdir():
 if p.is_file():p.chmod(p.stat().st_mode|0o111)
exe=root/'final-fight3-rev144/build-windows-cross/Final-Fight-3.exe';start=time.monotonic()
(out/'environment.json').write_text(json.dumps({k:v for k,v in env.items() if k.startswith(('FORJA65_','WINE'))},indent=2)+'\n')
with (out/'stdout.log').open('w') as log:p=subprocess.run([env['WINELOADER'],str(exe)],env=env,cwd=out,stdout=log,stderr=subprocess.STDOUT,timeout=240)
assert p.returncode==0,(p.returncode,(out/'stdout.log').read_text()[-3000:])
kv=lambda f:dict(l.split('=',1) for l in (out/f).read_text().splitlines() if '=' in l and not l.startswith('#'))
qa=kv('forja65-qa-status.txt');audit=kv('forja65-native-dependency-report.txt');wav=(out/'forja65-native-audio.wav').read_bytes()
assert struct.unpack_from('<I',wav,4)[0]==len(wav)-8 and struct.unpack_from('<I',wav,40)[0]==len(wav)-44
frames=hashlib.sha256((out/'forja65-frame-hashes.txt').read_bytes()).hexdigest();pcm=hashlib.sha256(wav[44:]).hexdigest()
assert int(qa['frames'])==5000 and int(audit['cpu_interpreter_instructions'])==0 and int(qa['apu_aot_misses'])==0
assert frames=='7ed5725c27d05a89a385a8d42d365c33695f1d4a40ac3484cd8064799acf4532'
assert pcm=='17b0b9c0c3a59a3c91b123813c1b68dd54fcb92b8355f9c53c153778e4148b8c'
result={'status':'PASS','execution':'Windows x64 EXE under Wine 9.0, headless; real Windows interactive audio/controller/performance not tested','frames':5000,'cpu_instructions':int(qa['instructions']),'cpu_interpreted':0,'spc_aot_misses':0,'spc_aot_instructions':int(qa['apu_aot_instructions']),'frame_hashes_sha256':frames,'pcm_sha256':pcm,'wav_sha256':hashlib.sha256(wav).hexdigest(),'exe_sha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'seconds':time.monotonic()-start}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');(root/'validation145/windows-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
