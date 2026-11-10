@echo off
setlocal
cd /d "%~dp0"
node --check forja65-core.js || exit /b 1
node tools\test-cfg-wram-v0430.js || exit /b 1
echo CFG WRAM v0.4.30 PASS
pause
