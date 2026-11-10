@echo off
setlocal
cd /d "%~dp0"
if "%~2"=="" (
  echo Uso: PREPARAR-PORT-REV212.cmd "C:\ROMs\jogo.sfc" "C:\Plans\meu-jogo" [auto^|smw^|dkc2^|dkc3^|zelda3^|generic]
  exit /b 2
)
set "GAME=auto"
if not "%~3"=="" set "GAME=%~3"
python "tools\rev212_port_kit.py" --rom "%~1" --out "%~2" --game "%GAME%"
exit /b %errorlevel%
