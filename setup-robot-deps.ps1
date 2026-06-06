# ─────────────────────────────────────────────────────────────────────────────
# Възстановява общата node_modules2 (ethers + playwright) + junction-ите за
# трите робота-инструмента (token-creator, token-protector, robot).
#
# Пусни ГО след разархивиране на проекта (когато node_modules2 липсва):
#     powershell -ExecutionPolicy Bypass -File .\setup-robot-deps.ps1
#
# Изисква: Node.js + npm. Не пипа монорепо root-а. Безопасно за повторно пускане.
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$nm2  = Join-Path $root 'node_modules2'

Write-Host '[1/3] Инсталирам ethers + playwright (във временна папка)...' -ForegroundColor Cyan
$tmp = Join-Path $env:TEMP 'kcy-robotdeps'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
Push-Location $tmp
try {
    & npm init -y | Out-Null
    & npm install 'ethers@^6.0.0' 'playwright@^1.48.0' --no-audit --no-fund
} finally { Pop-Location }

Write-Host '[2/3] Слагам ги в node_modules2/ ...' -ForegroundColor Cyan
if (Test-Path $nm2) { Remove-Item $nm2 -Recurse -Force }
Move-Item (Join-Path $tmp 'node_modules') $nm2
Remove-Item $tmp -Recurse -Force

Write-Host '[3/3] Връзвам junction-ите...' -ForegroundColor Cyan
foreach ($t in @('token-creator','token-protector','robot')) {
    $link = Join-Path $root "private\$t\node_modules"
    if (Test-Path $link) { Remove-Item $link -Recurse -Force }
    New-Item -ItemType Junction -Path $link -Target $nm2 | Out-Null
    Write-Host "    private\$t\node_modules -> node_modules2"
}

Write-Host ''
Write-Host 'Готово ✓  node_modules2 + junction-ите са възстановени.' -ForegroundColor Green
Write-Host 'За браузъра на робота (ако трябва):  cd private\robot ; npx playwright install chromium' -ForegroundColor DarkGray
