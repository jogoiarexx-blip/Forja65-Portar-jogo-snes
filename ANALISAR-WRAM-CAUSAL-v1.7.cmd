@echo off
setlocal
if "%~3"=="" (
  echo Uso: %~nx0 base-wram.csv teste-wram.csv frame-do-primeiro-comando
  exit /b 2
)
py -3 "%~dp0tools\wram_causality_v17.py" --base "%~1" --test "%~2" --fork %~3 --out "%~dp0wram-causal-v17.json"
exit /b %ERRORLEVEL%
