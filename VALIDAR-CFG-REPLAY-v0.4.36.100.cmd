@echo off
setlocal
cd /d "%~dp0"
if "%~2"=="" (
 echo Uso: %~nx0 baseline\frame-hashes.txt candidato\frame-hashes.txt [opcoes]
 exit /b 2
)
py -3 tools\validate-cfg-replay-gate.py %*
exit /b %ERRORLEVEL%
