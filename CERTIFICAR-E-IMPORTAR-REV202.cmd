@echo off
setlocal
cd /d "%~dp0"
if "%~4"=="" (
 echo Uso: CERTIFICAR-E-IMPORTAR-REV202.cmd "ROM.sfc" "PASTA_PORT" "ROTA.logic" "PASTA_RELATORIO" [FRAMES]
 exit /b 2
)
set "NFRAMES=%~5"
if "%NFRAMES%"=="" set "NFRAMES=30000"
py -3 tools\rev200-certify-route.py run --project "%~f2" --logic "%~f3" --out "%~f4" --frames %NFRAMES% --apply-verified
if errorlevel 1 exit /b %ERRORLEVEL%
node tools\forja65.js certify-import "%~f4\certification.json" --rom "%~f1" --label "%~nx3"
exit /b %ERRORLEVEL%
