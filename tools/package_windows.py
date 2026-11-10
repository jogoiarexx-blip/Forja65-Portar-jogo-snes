from pathlib import Path
import hashlib,json,zipfile,shutil,subprocess
r=Path('final-fight3-rev144');out=Path('Final-Fight-3-REV144-WINDOWS-PORTATIL');out.mkdir(exist_ok=True)
(out/'assets').mkdir(exist_ok=True)
shutil.copy2(r/'build-windows-cross/Final-Fight-3.exe',out/'Final-Fight-3.exe');shutil.copy2(r/'assets/cart-data.bin',out/'assets/cart-data.bin');shutil.copy2(r/'replay-5000.trace',out/'replay-5000.trace')
def write(name,s):(out/name).write_bytes(s.replace('\n','\r\n').encode('utf-8'))
write('JOGAR.cmd','''@echo off
setlocal
cd /d "%~dp0"
set FORJA65_HEADLESS=0
set FORJA65_HEADLESS_FRAMES=0
set FORJA65_UNCAPPED=0
set FORJA65_CONTROL=0
set FORJA65_CHECKPOINT_LOAD=
set FORJA65_INPUT_REPLAY=
set FORJA65_CPU_BACKEND=
set FORJA65_CPU_INTERPRETER=1
set FORJA65_TIMING_PROFILE=rev143
set FORJA65_SPC_PROFILE=reference
set FORJA65_AUDIO_MODE=native
set FORJA65_AUDIO_GAIN=100
set FORJA65_AUDIO_DUMP=0
Final-Fight-3.exe
if errorlevel 1 (
 echo O jogo encerrou com erro. Guarde os arquivos forja65-last-error.txt e forja65-crash-trace.txt, se existirem.
 pause
)
''')
write('VALIDAR-5000.cmd','''@echo off
setlocal
cd /d "%~dp0"
set "OUT=validacao-5000-%RANDOM%"
mkdir "%OUT%\\assets"
copy /y assets\\cart-data.bin "%OUT%\\assets\\cart-data.bin" >nul
set "FORJA65_INPUT_REPLAY=%~dp0replay-5000.trace"
set FORJA65_HEADLESS=1
set FORJA65_HEADLESS_FRAMES=5000
set FORJA65_UNCAPPED=1
set FORJA65_CONTROL=0
set FORJA65_CHECKPOINT_LOAD=
set FORJA65_CPU_BACKEND=
set FORJA65_CPU_INTERPRETER=1
set FORJA65_TIMING_PROFILE=rev143
set FORJA65_SPC_PROFILE=reference
set FORJA65_AUDIO_MODE=native
set FORJA65_AUDIO_DUMP=1
set FORJA65_FRAME_HASHES=1
pushd "%OUT%"
..\\Final-Fight-3.exe >execucao.txt 2>&1
set CODE=%ERRORLEVEL%
popd
echo Codigo de saida: %CODE%. Relatorios em %OUT%.
pause
exit /b %CODE%
''')
write('LEIA-ME.txt','''Final Fight 3 / Forja65 REV144 - Windows x64

Extraia a pasta inteira e abra JOGAR.cmd. Windows 10/11 x64; nao exige instalar compilador. Mantenha assets junto do executavel.

Enter: Start / iniciar / continuar. Setas: mover. Z: atacar. X: pular. A: especial. Shift: Select. Controles XInput sao reconhecidos pelo runtime.

Port experimental em validacao de campanha. A cobertura nativa medida no replay de 5.000 frames nao comprova o jogo inteiro 100% portado. O fallback de CPU permanece disponivel para rotas ainda nao cobertas. O PPU virtual e os dados originais do cartucho continuam em uso.

VALIDAR-5000.cmd executa o replay de teste e grava imagem, audio e auditorias. O encerramento programado apos 5.000 frames e normal. Consulte VALIDACAO.json para a evidencia exata desta compilacao; um build Windows nao comprova desempenho, audio ao vivo e controles em seu PC.

Nao use checkpoints Linux/REV143 neste executavel: o formato e especifico da ABI e runtime. Esta pasta inicia uma partida nova.
''')
manifest={'platform':'Windows x86_64 PE32+','status':'compiled; interactive Windows hardware testing pending','compiler':json.loads(Path('toolchains/compiler-source.json').read_text()),'source_core_sha256':hashlib.sha256(Path('work144/forja65-core.js').read_bytes()).hexdigest(),'sources':{str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((r/'src').iterdir()) if p.suffix in ('.cpp','.hpp','.h')},'executable_sha256':hashlib.sha256((out/'Final-Fight-3.exe').read_bytes()).hexdigest(),'matrix':json.loads((r/'matrix-latest.json').read_text()) if (r/'matrix-latest.json').exists() else None,'long_replay_linux':json.loads((r/'native-complete147-72064/result.json').read_text()) if (r/'native-complete147-72064/result.json').exists() else {'status':'RUNNING'},'long_parity_linux':json.loads((r/'long-spc147-comparison.json').read_text()) if (r/'long-spc147-comparison.json').exists() else None,'windows_execution':{'status':'NOT_RUN_CURRENT_BUILD','interactive_graphics_audio_controls_performance':'pending','previous_attempt':json.loads(Path('validation147/previous-windows-execution.json').read_text())},'imports':subprocess.check_output(['objdump','-p',str(out/'Final-Fight-3.exe')],text=True).split('The Import Tables')[1].split('The Function Table')[0]}
(out/'VALIDACAO.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
name=Path(str(out)+'.zip');rows=[]
with zipfile.ZipFile(name,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(out.rglob('*')):
  if p.is_file() and p.name!='MANIFEST.sha256':data=p.read_bytes();z.writestr(str(p),data);rows.append(hashlib.sha256(data).hexdigest()+'  '+str(p))
 manifest_text='\n'.join(rows)+'\n';(out/'MANIFEST.sha256').write_text(manifest_text)
 z.writestr(str(out)+'/MANIFEST.sha256',manifest_text)
with zipfile.ZipFile(name) as z:
 assert z.testzip() is None
 assert len(z.namelist())==len(set(z.namelist()))
 for row in rows:
  h,n=row.split('  ',1);assert hashlib.sha256(z.read(n)).hexdigest()==h
print(name,name.stat().st_size,hashlib.sha256(name.read_bytes()).hexdigest())
