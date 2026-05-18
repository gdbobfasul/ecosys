@echo off
REM KCY Ecosystem - Deploy v1.0084
REM Wrapper за Git Bash

REM Try Git Bash first
where bash >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Using Git Bash...
    bash ../deploy.sh %*
    pause
    exit /b
)

REM Fall back to PowerShell
echo Using PowerShell...
powershell -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
pause
