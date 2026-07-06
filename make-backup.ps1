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

# ── 1) МЕДИЯ (само SOURCE — raw + различните папки; БЕЗ обработените HMM/Duel) ──
# Анимациите съществуват 3-4 пъти (БАЙТ-ИДЕНТИЧНИ копия): source в public\assets\animations\raw,
# обработените в animations\HMM и animations\Duel, и копия в игрите (rustore|huawei\*\public).
# В бекъпа пазим САМО SOURCE-а: raw\ (вкл. raw\HMM, raw\Duel) + другите папки (static-280x340…).
# Обработените animations\HMM / animations\Duel и копията в игрите се РЕГЕНЕРИРАТ от raw → НЕ ги пазим.
# Маската `*\animations\HMM\*` изключва само animations\HMM, НЕ animations\raw\HMM (raw остава).
if (Test-Path "$assetsRar") { Remove-Item "$assetsRar" -Force }
Write-Host "[1/2] Архивирам медията (raw + различните; БЕЗ обработените HMM/Duel) ..." -ForegroundColor Cyan
if (Test-Path 'public\assets') {
    & $rar a -r -idq "$assetsRar" "public\assets" '-x*\animations\HMM\*' '-x*\animations\Duel\*'
    if ($LASTEXITCODE -gt 1) { Write-Error "rar върна грешка ($LASTEXITCODE) при медийния архив"; exit 1 }
    Write-Host "   ✓ $assetsRar  ($(Size-MB $assetsRar) MB)" -ForegroundColor Green
} else {
    Write-Host '   (public\assets липсва — пропускам медийния архив)' -ForegroundColor Yellow
}

# ── 2) ПРОЕКТ (без големите папки И без билд артефактите) ─────────────────────
# -x<име> без път се прилага за ВСЯКА папка (рекурсивно) → маха всички node_modules,
# node_modules2 и junction-ите на всяко ниво. public\assets е с път → само него.
# ВАЖНО: изключваме и БИЛД АРТЕФАКТИТЕ (android build, dist, dist-exe, apk…). Те се
# РЕГЕНЕРИРАТ от кода и подуваха този архив от ~50 MB на ~8 GB. Без тях пак е ~50 MB.
Write-Host "[2/2] Архивирам проекта (без node_modules / билдове / apk / public\assets) ..." -ForegroundColor Cyan
# ВАЖНО за RAR маските: за да се изключи папка НА ВСЯКО НИВО (напр. huawei\hmm\android\app\build),
# маската трябва да е `-x*\ИМЕ\*` (с `*\` отпред). `-xИМЕ\*` хваща само корена и НЕ работи в
# дълбочина (проверено: `-x*\build\*` → изключва, `-xbuild\*` → не). За коренните папки (apk\)
# добавяме и варианта без префикс.
$excludes = @(
    '-x*\node_modules\*',  '-xnode_modules\*',
    '-x*\node_modules2\*', '-xnode_modules2\*',
    # ── АНИМАЦИИ: source-ът (raw) е в -vids; тук изключваме ВСИЧКИ animations папки навсякъде
    #    (public\assets\animations + обработените + копията в игрите) → регенерират се от raw ──
    '-x*\assets\animations\*', '-xpublic\assets\*',
    '-x*.webm', '-x*.mp4',                   # всяка медия — извън кода
    # ── билд артефакти (регенерират се от кода) ──
    '-x*\build\*',                           # android\app\build (Gradle изход, ~4 GB)
    '-x*\.gradle\*', '-x*\.cxx\*', '-x*\captures\*',
    '-x*\dist\*',                            # уеб билд изход (~0.8 GB)
    '-x*\dist-exe\*',                        # Electron .exe (~0.9 GB)
    '-x*\dist-electron\*', '-x*\dist-ssr\*', '-x*\.vite\*',
    '-x*\apk\*', '-xapk\*',                  # готови APK/EXE (~1 GB) — корен + дълбоко
    '-x*\main\assets\public\*',              # вграденото копие на dist в APK-а
    '-x*.log', '-x*.apk', '-x*.aab', '-x*.keystore'
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
Write-Host '   • разархивирай ДВАТА на едно място (project + media се сливат)' -ForegroundColor DarkGray
Write-Host '   • обработените анимации (animations\HMM, animations\Duel) и копията им в игрите' -ForegroundColor DarkGray
Write-Host '     (rustore|huawei\*\public) НЕ са в бекъпа — регенерирай ги от animations\raw' -ForegroundColor DarkGray
Write-Host '   • после:  .\setup-robot-deps.ps1   (връща node_modules2 + junction-ите)' -ForegroundColor DarkGray
Write-Host '   • за приложенията (chat/portals/eco3…):  npm install в съответната папка' -ForegroundColor DarkGray

