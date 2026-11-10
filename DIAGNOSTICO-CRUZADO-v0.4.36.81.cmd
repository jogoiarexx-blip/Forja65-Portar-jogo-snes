@echo off
setlocal
cd /d "%~dp0"
set "PY=python"
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"
set "INPUT=%~dp0DIAGNOSTICOS-JOGOS"
set "MANIFEST=%INPUT%\manifest.json"
set "REPORT=%~dp0reports\crossgame-v043681"
echo.
echo Forja65 v0.4.36.81 - Diagnostico cruzado de ports
echo Organize os logs em DIAGNOSTICOS-JOGOS\NOME-DO-JOGO\RODADA-001\
echo.
%PY% "tools\crossgame-make-manifest-v043681.py" --root "%INPUT%" --out "%MANIFEST%"
if errorlevel 1 goto fail
%PY% "tools\crossgame-diagnostics-v043681.py" --manifest "%MANIFEST%" --out "%REPORT%"
if errorlevel 1 goto fail
echo.
echo Relatorios em: %REPORT%
echo crossgame-summary.md e crossgame-summary.json
pause
exit /b 0
:fail
echo.
echo O diagnostico nao concluiu. Confira a mensagem acima.
pause
exit /b 2
