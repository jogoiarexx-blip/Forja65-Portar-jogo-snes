@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "FORJA=%~dp0..\Forja65-v0.3.59"
if not "%FORJA65_HOME%"=="" set "FORJA=%FORJA65_HOME%"
if not exist reports mkdir reports
set "ROUNDS=%~1"
if "%ROUNDS%"=="" set "ROUNDS=5"
cmake -S . -B build-fast -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_CXX_FLAGS_DEBUG=/Od || exit /b 1
for /L %%I in (1,1,%ROUNDS%) do (
  echo === Cycle %%I ===
  cmake --build build-fast --target game --parallel 4 || exit /b 1
  set FORJA65_HEADLESS=1
  set FORJA65_HEADLESS_FRAMES=120
  set FORJA65_WATCHDOG_INSTRUCTIONS=15000000
  build-fast\game.exe > reports\cycle-%%I-execution.log 2>&1
  if !errorlevel! EQU 0 (echo Game returned successfully & exit /b 0)
  node "%FORJA%\tools\forja65.js" learn-crash "%CD%" --from "%CD%" --max 4096 > reports\cycle-%%I-learn.log || exit /b 1
  findstr /R /C:"Learned [1-9][0-9]* verified" reports\cycle-%%I-learn.log >nul || exit /b 2
)
