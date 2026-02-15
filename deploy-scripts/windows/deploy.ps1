# Version: 1.0057
## KCY Ecosystem - Windows Deploy Script
## Качва проекта на сървъра през SCP (с изключения за чувствителни файлове)

param(
    [string]$ServerIP = "alsec.strangled.net",
    [string]$ServerUser = "root",
    [int]$ServerPort = 22,
    [string]$LocalPath = ".",
    [switch]$Help
)

# Files/dirs to exclude (matches .deployignore)
$ExcludePatterns = @(
    "node_modules",
    ".git",
    ".env",
    ".env.*",
    "*.log",
    "coverage",
    "dist",
    "build",
    ".cache",
    "tmp",
    "temp",
    ".vscode",
    ".idea",
    "*.swp",
    ".DS_Store",
    "Thumbs.db",
    "*.pem",
    "*.key",
    "cache",
    "artifacts",
    "typechain",
    "*.zip",
    "*.tar",
    "*.gz"
)

function Test-ShouldExclude {
    param([string]$Path)
    
    foreach ($pattern in $ExcludePatterns) {
        if ($Path -like "*$pattern*") {
            return $true
        }
    }
    return $false
}

if ($Help) {
    Write-Host @"
KCY Ecosystem - Deploy Script for Windows

Usage:
    .\deploy.ps1 [-ServerIP <IP>] [-ServerUser <user>] [-ServerPort <port>]

Parameters:
    -ServerIP     Server hostname or IP (default: alsec.strangled.net)
    -ServerUser   SSH username (default: root)
    -ServerPort   SSH port (default: 22)
    -LocalPath    Local project path (default: current directory)
    -Help         Show this help

Examples:
    .\deploy.ps1
    .\deploy.ps1 -ServerIP "192.168.1.100" -ServerUser "admin"

Requirements:
    - WinSCP or pscp.exe (PuTTY) installed
    - SSH access to server

Excluded from deployment:
    - node_modules/
    - .git/
    - .env files
    - Build artifacts
    - See .deployignore for full list

"@
    exit 0
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KCY Ecosystem - Deploy to Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ask for project root directory
Write-Host "Where is your KCY ecosystem located?" -ForegroundColor Cyan
Write-Host "  Example: C:\Users\peshо\kcy-ecosystem" -ForegroundColor Yellow
Write-Host "  Example: .\kcy-complete-v3.0-matchmaking" -ForegroundColor Yellow
Write-Host ""

if (-not $LocalPath -or $LocalPath -eq ".") {
    $LocalPath = Read-Host "Enter project root directory"
    
    # Trim quotes if present
    $LocalPath = $LocalPath.Trim('"', "'")
}

# Check if project exists
if (-not (Test-Path $LocalPath)) {
    Write-Host "[ERROR] Project not found at: $LocalPath" -ForegroundColor Red
    Write-Host "Please check the path and try again!" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Project root: $LocalPath" -ForegroundColor Green
Write-Host ""

# Verify it's a KCY ecosystem (check for key directories)
$requiredDirs = @("public", "private")
$missingDirs = @()

foreach ($dir in $requiredDirs) {
    $dirPath = Join-Path $LocalPath $dir
    if (-not (Test-Path $dirPath)) {
        $missingDirs += $dir
    }
}

if ($missingDirs.Count -gt 0) {
    Write-Host "[WARNING] Missing directories: $($missingDirs -join ', ')" -ForegroundColor Yellow
    Write-Host "This might not be a valid KCY ecosystem directory." -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""

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

# Create WinSCP exclude file list
$excludeFile = Join-Path $env:TEMP "winscp_exclude.txt"
$ExcludePatterns | ForEach-Object { 
    "*/$_/*" 
    "*/$_" 
} | Out-File -FilePath $excludeFile -Encoding ASCII

# Upload public files
$publicSource = Join-Path $LocalPath "public"
$publicDest = "/var/www/html/"

if ($useWinSCP) {
    $excludeArgs = $ExcludePatterns | ForEach-Object { "-filemask=|*/$_;*/$_/*" }
    winscp.com /command `
        "open scp://${ServerUser}@${ServerIP}:${ServerPort}" `
        "option batch abort" `
        "option confirm off" `
        "synchronize remote `"$publicSource`" $publicDest -delete -criteria=time $excludeArgs" `
        "exit"
} elseif ($usePSCP) {
    # PSCP doesn't support exclude, so we need to copy selectively
    # Get all files/dirs except excluded ones
    $items = Get-ChildItem -Path $publicSource -Recurse | Where-Object {
        $itemPath = $_.FullName
        $shouldInclude = $true
        foreach ($pattern in $ExcludePatterns) {
            if ($itemPath -like "*$pattern*") {
                $shouldInclude = $false
                break
            }
        }
        $shouldInclude
    }
    
    # Create temp directory with filtered content
    $tempDir = Join-Path $env:TEMP "kcy_deploy_public"
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    
    foreach ($item in $items) {
        $relativePath = $item.FullName.Substring($publicSource.Length + 1)
        $destPath = Join-Path $tempDir $relativePath
        $destDir = Split-Path $destPath -Parent
        
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        if ($item.PSIsContainer) {
            New-Item -ItemType Directory -Path $destPath -Force | Out-Null
        } else {
            Copy-Item $item.FullName $destPath
        }
    }
    
    # Upload temp directory
    pscp.exe -r -P $ServerPort "$tempDir\*" "${ServerUser}@${ServerIP}:${publicDest}"
    
    # Cleanup
    Remove-Item -Path $tempDir -Recurse -Force
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to upload public files!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Public files uploaded (excluded: node_modules, .git, .env, etc.)" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] Uploading PRIVATE files..." -ForegroundColor Green

# Upload private files with exclusions
$privateSource = Join-Path $LocalPath "private"
$privateDest = "/var/www/kcy-ecosystem/"

# Create private directory first
if ($useWinSCP) {
    $excludeArgs = $ExcludePatterns | ForEach-Object { "-filemask=|*/$_;*/$_/*" }
    winscp.com /command `
        "open scp://${ServerUser}@${ServerIP}:${ServerPort}" `
        "option batch abort" `
        "option confirm off" `
        "mkdir $privateDest" `
        "synchronize remote `"$privateSource`" $privateDest -delete -criteria=time $excludeArgs" `
        "exit"
} elseif ($usePSCP) {
    # Create directory via SSH
    plink.exe -batch $ServerUser@$ServerIP -P $ServerPort "mkdir -p $privateDest"
    
    # Filter and upload like public
    $items = Get-ChildItem -Path $privateSource -Recurse | Where-Object {
        $itemPath = $_.FullName
        $shouldInclude = $true
        foreach ($pattern in $ExcludePatterns) {
            if ($itemPath -like "*$pattern*") {
                $shouldInclude = $false
                break
            }
        }
        $shouldInclude
    }
    
    $tempDir = Join-Path $env:TEMP "kcy_deploy_private"
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    
    foreach ($item in $items) {
        $relativePath = $item.FullName.Substring($privateSource.Length + 1)
        $destPath = Join-Path $tempDir $relativePath
        $destDir = Split-Path $destPath -Parent
        
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        if ($item.PSIsContainer) {
            New-Item -ItemType Directory -Path $destPath -Force | Out-Null
        } else {
            Copy-Item $item.FullName $destPath
        }
    }
    
    pscp.exe -r -P $ServerPort "$tempDir\*" "${ServerUser}@${ServerIP}:${privateDest}"
    Remove-Item -Path $tempDir -Recurse -Force
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to upload private files!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Private files uploaded (excluded: node_modules, .git, .env, etc.)" -ForegroundColor Green

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
Write-Host "Files EXCLUDED from deployment:" -ForegroundColor Cyan
Write-Host "  • node_modules/" -ForegroundColor Yellow
Write-Host "  • .git/" -ForegroundColor Yellow
Write-Host "  • .env files" -ForegroundColor Yellow
Write-Host "  • Build artifacts (dist/, build/)" -ForegroundColor Yellow
Write-Host "  • Logs and cache files" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. SSH to server: ssh $ServerUser@$ServerIP" -ForegroundColor White
Write-Host "  2. Navigate: cd /var/www/kcy-ecosystem" -ForegroundColor White
Write-Host "  3. Install dependencies: npm install --production" -ForegroundColor White
Write-Host "  4. Run setup scripts:" -ForegroundColor White
Write-Host "     - cd deploy-scripts/server" -ForegroundColor White
Write-Host "     - chmod +x *.sh" -ForegroundColor White
Write-Host "     - ./01-setup-database.sh" -ForegroundColor White
Write-Host "     - ./02-setup-domain.sh" -ForegroundColor White
Write-Host ""

# Cleanup temp files
if (Test-Path $excludeFile) { Remove-Item $excludeFile -Force }

