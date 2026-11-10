@echo off
setlocal
cd /d "%~dp0"
if "%~2"=="" (
 echo Uso: VALIDAR-REFERENCIAS-PPU-v0.4.36.79.cmd caminho_manifest.json pasta_relatorio
 echo Requer referencia externa declarada e metadados completos.
 exit /b 2
)
where python >nul 2>nul || ( echo ERRO: Python 3 nao encontrado no PATH & exit /b 2 )
python tools\ppu-reference-suite-v043679.py verify --manifest "%~1" --output-dir "%~2" --require-external
exit /b %errorlevel%
