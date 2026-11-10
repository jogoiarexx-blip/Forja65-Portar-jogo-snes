@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (echo Node.js nao encontrado.& exit /b 2)
set "AUDIT_DIR=reports"
if not "%~1"=="" set "AUDIT_DIR=%~1"
if not "%~2"=="" goto :withrom
node tools\cfg-evidence-audit-v043688.js --input "%AUDIT_DIR%" --json "reports\cfg-v043689-user-audit.json" --md "reports\cfg-v043689-user-audit.md"
goto :done
:withrom
node tools\cfg-evidence-audit-v043688.js --input "%AUDIT_DIR%" --rom "%~2" --json "reports\cfg-v043689-user-audit.json" --md "reports\cfg-v043689-user-audit.md"
:done
if errorlevel 1 (echo FALHA na auditoria.& exit /b 1)
echo Relatorios escritos em reports.
exit /b 0
