@echo off
setlocal
cd /d "%~dp0"
if "%~3"=="" (
 echo Uso: CERTIFICAR-ROTA-AOT-REV200.cmd "PASTA_PORT" "ARQUIVO.logic" "PASTA_RELATORIO" [FRAMES]
 exit /b 2
)
set "NFRAMES=%~4"
if "%NFRAMES%"=="" set "NFRAMES=30000"
py -3 tools\rev200-certify-route.py run --project "%~f1" --logic "%~f2" --out "%~f3" --frames %NFRAMES% --apply-verified
exit /b %ERRORLEVEL%
