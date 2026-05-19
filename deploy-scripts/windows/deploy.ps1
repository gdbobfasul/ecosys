# Version: 1.0084
## KCY Ecosystem - Windows Deploy Script
## Качва в staging: /var/www/deploy/

param(
    [string]$Server = "alsec.strangled.net",
    [string]$User = "deploy",
    [int]$Port = 2222,
    [switch]$Help
)

if ($Help) {
    Write-Host "KCY Deploy v1.0084"
    Write-Host "Usage: .\deploy.ps1 [-Server host] [-User deploy] [-Port 22]"
    Write-Host ""
    Write-Host "Uploads to /var/www/deploy/ on server."
    Write-Host "Then run: sudo bash 05-server-install.sh"
    exit
}

$Staging = "/var/www/deploy"

Write-Host ""
Write-Host "  KCY Ecosystem - Deploy v1.0084" -ForegroundColor Cyan
Write-Host "  Server: $Server  User: $User  Staging: $Staging" -ForegroundColor Gray
Write-Host ""

# Check scp
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: scp not found. Install OpenSSH or Git Bash." -ForegroundColor Red
    Read-Host "Enter to close"
    exit 1
}

# Find project root (where public/ and private/ are)
$ProjectRoot = Get-Location
if (-not (Test-Path "$ProjectRoot\public") -or -not (Test-Path "$ProjectRoot\private")) {
    Write-Host "ERROR: Run from project root (where public/ and private/ are)" -ForegroundColor Red
    Read-Host "Enter to close"
    exit 1
}

# Create staging dirs
Write-Host "[1/4] Creating staging dirs..." -ForegroundColor Green
ssh -p $Port "${User}@${Server}" "mkdir -p ${Staging}/{public,private,deploy-scripts}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: SSH connection failed" -ForegroundColor Red
    Read-Host "Enter to close"
    exit 1
}

# Upload public
Write-Host "[2/4] Uploading public/..." -ForegroundColor Green
scp -r -P $Port "$ProjectRoot\public\*" "${User}@${Server}:${Staging}/public/"

# Upload private
Write-Host "[3/4] Uploading private/..." -ForegroundColor Green
scp -r -P $Port "$ProjectRoot\private\*" "${User}@${Server}:${Staging}/private/"

# Upload scripts
Write-Host "[4/4] Uploading deploy-scripts/..." -ForegroundColor Green
scp -r -P $Port "$ProjectRoot\deploy-scripts\*" "${User}@${Server}:${Staging}/deploy-scripts/" 2>$null
scp -P $Port "$ProjectRoot\package.json" "${User}@${Server}:${Staging}/" 2>$null
scp -P $Port "$ProjectRoot\00032.version" "${User}@${Server}:${Staging}/" 2>$null

Write-Host ""
Write-Host "  UPLOAD COMPLETE" -ForegroundColor Green
Write-Host ""
Write-Host "  Next:" -ForegroundColor Cyan
Write-Host "    ssh -p $Port ${User}@${Server}" -ForegroundColor Yellow
Write-Host "    cd ${Staging}/deploy-scripts/server" -ForegroundColor Yellow
Write-Host "    sudo bash 05-server-install.sh" -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to close"
