@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul || ( echo ERRO: Python 3 nao encontrado & exit /b 2 )
if "%~1"=="" (
 echo Uso: CRIAR-MANIFESTO-PPU-v0.4.36.80.cmd "C:\capturas"
 echo Crie pastas reference e actual com frames correspondentes antes de executar.
 exit /b 2
)
python tools\ppu-reference-suite-v043680.py init --bundle "%~1"
exit /b %errorlevel%
