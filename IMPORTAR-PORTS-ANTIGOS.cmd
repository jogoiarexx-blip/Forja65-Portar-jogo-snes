@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" goto help
if "%~2"=="" goto help
echo [Forja65] Previa dos ports antigos ...
node "%~dp0tools\forja65.js" legacy-import "%~1" --rom "%~2"
if errorlevel 1 exit /b %errorlevel%
echo.
choice /M "Guardar estas versoes como historico NAO VALIDADO no Knowledge Vault"
if errorlevel 2 exit /b 0
node "%~dp0tools\forja65.js" legacy-import "%~1" --rom "%~2" --apply
exit /b %errorlevel%
:help
echo Uso: IMPORTAR-PORTS-ANTIGOS.cmd "C:\Pasta com ZIPs antigos" "C:\ROM\jogo.sfc"
exit /b 2
