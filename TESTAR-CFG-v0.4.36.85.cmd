@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (echo ERRO: instale Node.js para executar os testes de CFG. & exit /b 2)
where python >nul 2>&1
if errorlevel 1 (echo ERRO: instale Python 3 para verificar a recuperacao de logs. & exit /b 2)
node tests\cfg-frontier-dedup-v043685-regression.js || exit /b 1
node tests\cfg-v84-parity-golden-v043685-regression.js || exit /b 1
node tests\cfg-pc-width-v043616-regression.js || exit /b 1
node tests\cfg-cache-v0436-regression.js || exit /b 1
node tests\cfg-monotonic-growth-regression.js || exit /b 1
node tests\cfg-budget-retry-regression.js || exit /b 1
node tests\cfg-fallthrough-v0363-regression.js || exit /b 1
node tests\status-stack-cfg-regression.js || exit /b 1
python tools\test_recover_observed_flow_v85.py || exit /b 1
python tools\test_recover_observed_flow_v37.py || exit /b 1
echo CFG v0.4.36.85: testes locais aprovados (nao substituem teste com ROM real).
exit /b 0
