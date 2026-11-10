@echo off
setlocal
cd /d "%~dp0"
if "%~3"=="" (
 echo Uso: COMPARAR-FRAMES-PPU-v0.4.36.77.cmd pasta_referencia pasta_forja pasta_relatorio
 echo As capturas devem ter os mesmos nomes-base: exemplo frame0001.png e frame0001.ppm.
 exit /b 2
)
where python >nul 2>nul || (
 echo ERRO: Python 3 nao encontrado no PATH
 exit /b 2
)
python tools\ppu-frame-compare-v043677.py --reference "%~1" --actual "%~2" --output-dir "%~3" --reference-origin "Referencias externas fornecidas pelo usuario; origem nao verificada automaticamente"
exit /b %errorlevel%
