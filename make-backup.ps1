# ─────────────────────────────────────────────────────────────────────────────
# Прави 2 RAR архива на проекта (име по дата, формат YYYY-MM-DD):
#   1) YYYY-MM-DD-toks-vids.rar  — САМО public\assets (видеата/анимациите, ~600 MB)
#   2) YYYY-MM-DD-toks.rar       — ВСИЧКО останало, БЕЗ големите папки:
#                                   node_modules, node_modules2, public\assets
#
# Пускане:   powershell -ExecutionPolicy Bypass -File .\make-backup.ps1
#            (по избор)  ... .\make-backup.ps1 -OutDir D:\backups
#
# Изисква: WinRAR (rar.exe). Архивите се пишат в G:\wrk по подразбиране.
# Възстановяване: разархивирай и двата на едно място → после .\setup-robot-deps.ps1
# ─────────────────────────────────────────────────────────────────────────────
param(
    [string]$OutDir = 'G:\wrk'   # по подразбиране архивите отиват в G:\wrk
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

# ── намери rar.exe (PATH или стандартните WinRAR пътища) ──
$rar = (Get-Command rar.exe -ErrorAction SilentlyContinue).Source
if (-not $rar) {
    foreach ($p in @("$env:ProgramFiles\WinRAR\rar.exe", "${env:ProgramFiles(x86)}\WinRAR\rar.exe")) {
        if (Test-Path $p) { $rar = $p; break }
    }
}
if (-not $rar) {
    Write-Error 'rar.exe не е намерен. Инсталирай WinRAR или сложи rar.exe в PATH.'
    exit 1
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$date        = Get-Date -Format 'yyyy-MM-dd'
$projectRar  = Join-Path $OutDir "$date-toks.rar"        # проектът (без големите папки)
$assetsRar   = Join-Path $OutDir "$date-toks-vids.rar"   # видеата/анимациите (public\assets)

function Size-MB($path) { if (Test-Path $path) { [math]::Round((Get-Item $path).Length / 1MB, 1) } else { 0 } }

# ── 1) АСЕТИ (само public\assets) ────────────────────────────────────────────
if (Test-Path 'public\assets') {
    Write-Host "[1/2] Архивирам public\assets ..." -ForegroundColor Cyan
    & $rar a -r -idq "$assetsRar" "public\assets"
    if ($LASTEXITCODE -ne 0) { Write-Error "rar върна грешка ($LASTEXITCODE) при асет архива"; exit 1 }
    Write-Host "   ✓ $assetsRar  ($(Size-MB $assetsRar) MB)" -ForegroundColor Green
} else {
    Write-Host '   (public\assets липсва — пропускам асет архива)' -ForegroundColor Yellow
}

# ── 2) ПРОЕКТ (без големите папки) ───────────────────────────────────────────
# -x<име> без път се прилага за ВСЯКА папка (рекурсивно) → маха всички node_modules,
# node_modules2 и junction-ите на всяко ниво. public\assets е с път → само него.
Write-Host "[2/2] Архивирам проекта (без node_modules / node_modules2 / public\assets) ..." -ForegroundColor Cyan
$excludes = @(
    '-xnode_modules',  '-xnode_modules\*',
    '-xnode_modules2', '-xnode_modules2\*',
    '-xpublic\assets', '-xpublic\assets\*'
)
& $rar a -r -idq @excludes "$projectRar" "."
if ($LASTEXITCODE -ne 0) { Write-Error "rar върна грешка ($LASTEXITCODE) при проектния архив"; exit 1 }
Write-Host "   ✓ $projectRar  ($(Size-MB $projectRar) MB)" -ForegroundColor Green

Write-Host ''
Write-Host 'Готово ✓  Два архива:' -ForegroundColor Green
Write-Host "   1) $assetsRar"
Write-Host "   2) $projectRar"
Write-Host ''
Write-Host 'Възстановяване:' -ForegroundColor DarkGray
Write-Host '   • разархивирай ДВАТА на едно място (project + assets се сливат)' -ForegroundColor DarkGray
Write-Host '   • после:  .\setup-robot-deps.ps1   (връща node_modules2 + junction-ите)' -ForegroundColor DarkGray
Write-Host '   • за приложенията (chat/portals/eco3…):  npm install в съответната папка' -ForegroundColor DarkGray

