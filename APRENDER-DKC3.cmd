@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (echo Uso: APRENDER-DKC3.cmd "C:\caminho\DKC3-ZERO" & exit /b 2)
set "PROJECT=%~1"
set "SOURCE=%~2"
if "%SOURCE%"=="" set "SOURCE=%PROJECT%\build-debug-fast"
node tools\forja65.js learn-crash "%PROJECT%" --from "%SOURCE%" --max 4096 || exit /b 1
echo CFG atualizado. Recompile com BUILD-DEBUG-FAST-WINDOWS.cmd no projeto.
