@echo off
setlocal
cd /d "%~dp0"
set "PROJECT=%~1"
if "%PROJECT%"=="" set /p "PROJECT=Cole o caminho da pasta do projeto C++: "
if "%PROJECT%"=="" exit /b 2
set "FRAMES=%~2"
if "%FRAMES%"=="" set "FRAMES=1200"
call forja65.cmd converge "%PROJECT%" --frames %FRAMES% --rounds 32
set "CODE=%ERRORLEVEL%"
echo Relatorio: reports\convergence-report.json na pasta do projeto.
pause
exit /b %CODE%
