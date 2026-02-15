REM Version: 1.0057
@echo off
REM KCY Ecosystem - Windows Deploy Script (Batch)
REM WARNING: This simple version may upload ALL files including node_modules!
REM For proper exclusions, use deploy.ps1 (PowerShell version) instead!

setlocal enabledelayedexpansion

echo ========================================
echo   KCY Ecosystem - Deploy to Server
echo ========================================
echo.
echo [WARNING] This batch script uploads ALL files!
echo For proper exclusions (node_modules, .git, .env),
echo please use PowerShell version: deploy.ps1
echo.
echo Press Ctrl+C to cancel, or
pause
echo.

REM Configuration
set SERVER=alsec.strangled.net
set USER=root
set PORT=22
set LOCAL_PATH=kcy-unified

echo ========================================
echo   KCY Ecosystem - Deploy to Server
echo ========================================
echo.

REM Check if project exists
if not exist "%LOCAL_PATH%" (
    echo [ERROR] Project not found: %LOCAL_PATH%
    echo Please extract kcy-unified.zip first!
    pause
    exit /b 1
)

REM Check for pscp.exe
where pscp.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pscp.exe not found!
    echo.
    echo Please install PuTTY from: https://www.putty.org/
    echo.
    pause
    exit /b 1
)

echo [1/5] Checking connection...
echo   Server: %USER%@%SERVER%:%PORT%
echo.

echo [2/5] Uploading PUBLIC files...
pscp.exe -r -P %PORT% "%LOCAL_PATH%\public\*" %USER%@%SERVER%:/var/www/html/
if %errorlevel% neq 0 (
    echo [ERROR] Failed to upload public files!
    pause
    exit /b 1
)
echo   OK: Public files uploaded
echo.

echo [3/5] Creating PRIVATE directory...
plink.exe -batch -P %PORT% %USER%@%SERVER% "mkdir -p /var/www/kcy-ecosystem"
echo.

echo [4/5] Uploading PRIVATE files...
pscp.exe -r -P %PORT% "%LOCAL_PATH%\private\*" %USER%@%SERVER%:/var/www/kcy-ecosystem/
if %errorlevel% neq 0 (
    echo [ERROR] Failed to upload private files!
    pause
    exit /b 1
)
echo   OK: Private files uploaded
echo.

echo [5/5] Uploading ROOT files...
if exist "%LOCAL_PATH%\package.json" pscp.exe -P %PORT% "%LOCAL_PATH%\package.json" %USER%@%SERVER%:/var/www/kcy-ecosystem/
if exist "%LOCAL_PATH%\hardhat.config.js" pscp.exe -P %PORT% "%LOCAL_PATH%\hardhat.config.js" %USER%@%SERVER%:/var/www/kcy-ecosystem/
if exist "%LOCAL_PATH%\jest.config.js" pscp.exe -P %PORT% "%LOCAL_PATH%\jest.config.js" %USER%@%SERVER%:/var/www/kcy-ecosystem/
if exist "%LOCAL_PATH%\README.md" pscp.exe -P %PORT% "%LOCAL_PATH%\README.md" %USER%@%SERVER%:/var/www/kcy-ecosystem/
echo   OK: Root files uploaded
echo.

echo ========================================
echo   DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Next steps:
echo   1. SSH to server: putty.exe %USER%@%SERVER%
echo   2. Run: cd /var/www/kcy-ecosystem/deploy-scripts/server
echo   3. Run: chmod +x *.sh
echo   4. Run: ./01-setup-database.sh
echo   5. Run: ./02-setup-domain.sh
echo.
pause
