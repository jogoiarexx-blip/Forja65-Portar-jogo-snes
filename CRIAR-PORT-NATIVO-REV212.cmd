@echo off
setlocal
cd /d "%~dp0"
if "%~2"=="" (
  echo Uso: CRIAR-PORT-NATIVO-REV212.cmd "C:\ROMs\jogo.sfc" "C:\Ports\jogo" [C:\Plans\jogo\rotas.json]
  echo Execute no Developer Command Prompt do Visual Studio com Python, Node, CMake e Ninja.
  exit /b 2
)
if "%~3"=="" (
  python "tools\rev211_native_workflow.py" --rom "%~1" --port "%~2" --frames 600 --hash-every 60 --max-iter 8
) else (
  python "tools\rev211_native_workflow.py" --rom "%~1" --port "%~2" --contract "%~3" --max-iter 8
)
exit /b %errorlevel%
