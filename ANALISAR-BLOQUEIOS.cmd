@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
 echo Uso: ANALISAR-BLOQUEIOS.cmd "C:\Pasta\Do\Port"
 exit /b 2
)
where node >nul 2>nul
if errorlevel 1 (echo ERRO: Node.js nao encontrado. & exit /b 2)
node "%~dp0tools\forja65.js" recovery-advice "%~1" --limit 10
exit /b %ERRORLEVEL%
