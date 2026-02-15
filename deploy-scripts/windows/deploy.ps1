# Version: 1.0056
## KCY Ecosystem - Windows Deploy Script
## Качва проекта на сървъра през SCP

param(
    [string]$ServerIP = "alsec.strangled.net",
    [string]$ServerUser = "root",
    [int]$ServerPort = 22,
    [string]$LocalPath = ".\kcy-unified",
    [switch]$Help
)

if ($Help) {
    Write-Host @"
KCY Ecosystem - Deploy Script for Windows

Usage:
    .\deploy.ps1 [-ServerIP <IP>] [-ServerUser <user>] [-ServerPort <port>]

Parameters:
    -ServerIP     Server hostname or IP (default: alsec.strangled.net)
    -ServerUser   SSH username (default: root)
    -ServerPort   SSH port (default: 22)
    -LocalPath    Local project path (default: .\kcy-unified)
    -Help         Show this help

Examples:
    .\deploy.ps1
    .\deploy.ps1 -ServerIP "192.168.1.100" -ServerUser "admin"

Requirements:
    - WinSCP or pscp.exe (PuTTY) installed
    - SSH access to server
    - Project extracted in current directory

"@
    exit 0
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KCY Ecosystem - Deploy to Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if project exists
if (-not (Test-Path $LocalPath)) {
    Write-Host "[ERROR] Project not found at: $LocalPath" -ForegroundColor Red
    Write-Host "Please extract kcy-unified.zip first!" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Green

# Check for WinSCP or pscp
$useWinSCP = $false
$usePSCP = $false

if (Get-Command "winscp.com" -ErrorAction SilentlyContinue) {
    $useWinSCP = $true
    Write-Host "  ✓ WinSCP found" -ForegroundColor Green
} elseif (Get-Command "pscp.exe" -ErrorAction SilentlyContinue) {
    $usePSCP = $true
    Write-Host "  ✓ PuTTY pscp found" -ForegroundColor Green
} else {
    Write-Host "  ✗ No SCP tool found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install one of:" -ForegroundColor Yellow
    Write-Host "  1. WinSCP - https://winscp.net/eng/download.php" -ForegroundColor Yellow
    Write-Host "  2. PuTTY (includes pscp) - https://www.putty.org/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After installation, run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[2/5] Connecting to server..." -ForegroundColor Green
Write-Host "  Server: $ServerUser@$ServerIP:$ServerPort" -ForegroundColor Cyan

# Test SSH connection
$testSSH = "plink.exe -batch -pw test $ServerUser@$ServerIP -P $ServerPort exit"
if (-not (Get-Command "plink.exe" -ErrorAction SilentlyContinue)) {
    Write-Host "  ! Cannot test connection (plink not found)" -ForegroundColor Yellow
    Write-Host "  Proceeding anyway..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/5] Uploading PUBLIC files..." -ForegroundColor Green

# Upload public files
$publicSource = Join-Path $LocalPath "public"
$publicDest = "/var/www/html/"

if ($useWinSCP) {
    winscp.com /command `
        "open scp://${ServerUser}@${ServerIP}:${ServerPort}" `
        "put `"$publicSource\*`" $publicDest -transfer=binary" `
        "exit"
} elseif ($usePSCP) {
    pscp.exe -r -P $ServerPort "$publicSource\*" "${ServerUser}@${ServerIP}:${publicDest}"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to upload public files!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Public files uploaded" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] Uploading PRIVATE files..." -ForegroundColor Green

# Upload private files
$privateSource = Join-Path $LocalPath "private"
$privateDest = "/var/www/kcy-ecosystem/"

# Create private directory first
if ($useWinSCP) {
    winscp.com /command `
        "open scp://${ServerUser}@${ServerIP}:${ServerPort}" `
        "mkdir $privateDest" `
        "put `"$privateSource\*`" $privateDest -transfer=binary" `
        "exit"
} elseif ($usePSCP) {
    # Create directory via SSH
    plink.exe -batch $ServerUser@$ServerIP -P $ServerPort "mkdir -p $privateDest"
    # Upload
    pscp.exe -r -P $ServerPort "$privateSource\*" "${ServerUser}@${ServerIP}:${privateDest}"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to upload private files!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Private files uploaded" -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Uploading ROOT files..." -ForegroundColor Green

# Upload root files (package.json, etc.)
$rootFiles = @("package.json", "hardhat.config.js", "jest.config.js", ".env.example", "README.md")

foreach ($file in $rootFiles) {
    $filePath = Join-Path $LocalPath $file
    if (Test-Path $filePath) {
        if ($useWinSCP) {
            winscp.com /command `
                "open scp://${ServerUser}@${ServerIP}:${ServerPort}" `
                "put `"$filePath`" $privateDest" `
                "exit"
        } elseif ($usePSCP) {
            pscp.exe -P $ServerPort "$filePath" "${ServerUser}@${ServerIP}:${privateDest}"
        }
    }
}

Write-Host "  ✓ Root files uploaded" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. SSH to server: ssh $ServerUser@$ServerIP" -ForegroundColor White
Write-Host "  2. Run setup scripts:" -ForegroundColor White
Write-Host "     - cd /var/www/kcy-ecosystem/deploy-scripts/server" -ForegroundColor White
Write-Host "     - chmod +x *.sh" -ForegroundColor White
Write-Host "     - ./01-setup-database.sh" -ForegroundColor White
Write-Host "     - ./02-setup-domain.sh" -ForegroundColor White
Write-Host ""
