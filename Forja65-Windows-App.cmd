@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto :offline
if not exist "%~dp0tools\gui-server.js" goto :offline
echo Forja65 REV193 - Consolidado CPU CFG PPU SPC
 echo Este console mantem o Forja em funcionamento. Para encerrar, pressione Ctrl+C.
node "%~dp0tools\gui-server.js" --open
if errorlevel 1 pause
exit /b %errorlevel%
:offline
echo ATENCAO: Node.js nao encontrado. O modo HTML offline nao salva memoria global.
echo Instale Node.js para habilitar o Knowledge Vault pela interface Windows.
set "HTML=%CD%\Forja65-Portable.html"
start "" "%HTML%"
exit /b 0
