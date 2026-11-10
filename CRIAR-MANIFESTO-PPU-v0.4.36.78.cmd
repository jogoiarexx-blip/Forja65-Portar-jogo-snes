@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
 echo Uso: CRIAR-MANIFESTO-PPU-v0.4.36.78.cmd pasta_do_pacote
 echo A pasta precisa conter subpastas reference e actual com imagens PNG ou PPM do mesmo nome-base.
 exit /b 2
)
where python >nul 2>nul || ( echo ERRO: Python 3 nao encontrado no PATH & exit /b 2 )
python tools\ppu-reference-suite-v043678.py init --bundle "%~1"
exit /b %errorlevel%
