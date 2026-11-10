@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul || ( echo ERRO: Python 3 nao encontrado & exit /b 2 )
if "%~1"=="" (
 echo Uso: COMPARAR-PPU-v0.4.36.80.cmd "C:\capturas\manifest.json" "C:\relatorios"
 echo Capture PNG/PPM de fontes diferentes, com mesmo ROM, replay e frame.
 exit /b 2
)
if "%~2"=="" (
 echo ERRO: informe a pasta de relatorios.
 exit /b 2
)
python tools\ppu-reference-suite-v043680.py verify --manifest "%~1" --output-dir "%~2" --require-external
exit /b %errorlevel%
