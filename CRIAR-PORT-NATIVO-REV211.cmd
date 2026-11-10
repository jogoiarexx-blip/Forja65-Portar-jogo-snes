@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROM=%~1"
set "PORT=%~2"
if "%ROM%"=="" (
  echo Use: CRIAR-PORT-NATIVO-REV211.cmd "C:\ROMs\jogo.sfc" "C:\Ports\meu-port"
  echo Execute no Developer Command Prompt/PowerShell do Visual Studio com C++ Desktop, Python, Node, CMake e Ninja.
  exit /b 2
)
if "%PORT%"=="" (
  echo Informe a pasta do port como segundo argumento. Nao sobrescrevemos portas antigas.
  exit /b 2
)
where python >nul 2>&1 || (echo ERRO: Python nao encontrado & exit /b 2)
where node >nul 2>&1 || (echo ERRO: Node.js nao encontrado & exit /b 2)
where cmake >nul 2>&1 || (echo ERRO: CMake nao encontrado & exit /b 2)
where ninja >nul 2>&1 || (echo ERRO: Ninja nao encontrado & exit /b 2)
python "%~dp0tools\rev211_native_workflow.py" --rom "%ROM%" --port "%PORT%" --frames 600 --hash-every 60 --package
exit /b %ERRORLEVEL%
