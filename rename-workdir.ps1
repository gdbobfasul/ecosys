# ─────────────────────────────────────────────────────────────────────────────
# rename-workdir.ps1 — преименува РАБОТНАТА папка на нова (по подразбиране днешна дата),
# КАТО ПАЗИ паметта/историята на Claude Code (те са вързани за пътя на папката) и връща
# junction-ите (node_modules2). Прави 3 неща заедно:
#   1) G:\wrk\<старо>                       → G:\wrk\<ново>
#   2) ~\.claude\projects\<кодирано-старо>  → <кодирано-ново>   (памет + история)
#   3) setup-robot-deps.ps1                  (връща node_modules2 junction-ите)
#
# ВАЖНО: папката не бива да е ЗАЕТА (затвори Claude Code, бот-браузъра, node/vite).
#   • Ръчно:      powershell -ExecutionPolicy Bypass -File .\rename-workdir.ps1
#   • Друго име:  ... .\rename-workdir.ps1 -NewName 2026-09-03-toks
#   • Изчакай папката да се освободи (за пускане от точка 20, докато затваряш):  -WaitForUnlock
#   • Само проба (нищо не пипа):  -DryRun
#   • Тест на друга папка (за проверка на логиката):  -SourceDir <път> -ClaudeProjects <път>
# ─────────────────────────────────────────────────────────────────────────────
param(
    [string]$NewName        = "$(Get-Date -Format 'yyyy-MM-dd')-toks",
    [string]$SourceDir      = $PSScriptRoot,
    [string]$ClaudeProjects = (Join-Path $env:USERPROFILE '.claude\projects'),
    [switch]$WaitForUnlock,
    [switch]$DryRun,
    [switch]$SkipRobotDeps
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }

# Кодиране на пътя както Claude Code именува папката в .claude\projects: заменя :  \  /  с  -
function Encode-ProjName([string]$p){ return ($p -replace '[:\\/]','-') }

$SourceDir = (Resolve-Path $SourceDir).Path.TrimEnd('\')
$parent    = Split-Path $SourceDir -Parent
$curName   = Split-Path $SourceDir -Leaf
$newDir    = Join-Path $parent $NewName

Info "Работна папка:  $SourceDir"
Info "Ново име:       $NewName   ($newDir)"

if ($curName -eq $NewName) { Ok "Папката вече се казва '$NewName' — нищо за правене."; exit 0 }
if (Test-Path $newDir)     { Write-Error "Целевата папка вече съществува: $newDir  (избери друго -NewName)"; exit 1 }

# Claude памет/история (кодираните имена по СТАРИЯ и НОВИЯ път)
$oldProj = Join-Path $ClaudeProjects (Encode-ProjName $SourceDir)
$newProj = Join-Path $ClaudeProjects (Encode-ProjName $newDir)
$newProjLeaf = Split-Path $newProj -Leaf
$haveMem = Test-Path $oldProj
$memState = if ($haveMem) { '(намерена)' } else { '(липсва — прескачам)' }
Info "Памет (Claude): $oldProj  ->  $newProjLeaf  $memState"

if ($DryRun) { Warn "`n[DRY-RUN] Нищо не се пипа. Горното е какво БИ станало."; exit 0 }

# ── 1) работната папка (по избор изчаква да се освободи) ──
$maxTries = if ($WaitForUnlock) { 150 } else { 1 }   # ~5 мин при изчакване
for ($i=1; $i -le $maxTries; $i++) {
    try {
        Rename-Item -LiteralPath $SourceDir -NewName $NewName -ErrorAction Stop
        Ok "[1/3] Папката преименувана → $newDir"
        break
    } catch {
        if ($i -ge $maxTries) {
            Write-Error "Папката е ЗАЕТА (затвори Claude Code, бот-браузъра, node/vite и пусни пак).`n$($_.Exception.Message)"
            exit 2
        }
        if ($i -eq 1) { Warn "Папката е заета — изчаквам да я затвориш (Claude/браузър/node)…" }
        Start-Sleep -Seconds 2
    }
}

# ── 2) паметта/историята на Claude (за да не се губи докъде е стигнал) ──
if ($haveMem) {
    if (Test-Path $newProj) { Warn "[2/3] $(Split-Path $newProj -Leaf) вече съществува — НЕ пипам паметта (провери ръчно)." }
    else {
        Rename-Item -LiteralPath $oldProj -NewName (Split-Path $newProj -Leaf) -ErrorAction Stop
        Ok "[2/3] Паметта/историята на Claude преместена → $(Split-Path $newProj -Leaf)"
    }
} else { Warn "[2/3] Няма Claude памет за този път — прескачам." }

# ── 3) junction-ите (node_modules2) ──
$robot = Join-Path $newDir 'setup-robot-deps.ps1'
if ((-not $SkipRobotDeps) -and (Test-Path $robot)) {
    Info "[3/3] Връщам node_modules2 junction-ите…"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $robot
    Ok "[3/3] Готово."
} else { Warn "[3/3] setup-robot-deps.ps1 липсва/пропуснат — пусни го ръчно ако ползваш node_modules2 junction-и." }

Write-Host ''
Ok "ГОТОВО ✓  Работната папка е '$NewName'."
Write-Host "  → Отвори Claude Code в:  $newDir   (паметта и историята са запазени)" -ForegroundColor DarkGray
