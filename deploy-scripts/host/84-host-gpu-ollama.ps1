# 84-host-gpu-ollama.ps1 — подготвя Ollama на ХОСТА (локалния компютър) да ползва ИЗБРАНА
# видеокарта и да слуша по мрежата, за да го ползва виртуалната машина (relay-ят).
#
# Защо: VirtualBox/VMware Workstation НЕ могат да подадат картата на госта за смятане. Затова
# моделът върви на хоста (на 3090), а relay-ят във виртуалката само сочи към него (вариант 1).
#
# Какво прави:
#   1. Проверява, че Ollama е инсталиран на хоста.
#   2. Показва видеокартите (nvidia-smi) и записва ИЗБОРА коя да се ползва (CUDA_VISIBLE_DEVICES).
#   3. Кара Ollama да слуша навън (OLLAMA_HOST=0.0.0.0:<порт>), не само локално.
#   4. Отваря входящо правило за порта в защитната стена (с повишение/UAC, ако трябва).
#   5. Рестартира Ollama, за да хване новите променливи; проверява модела и достъпа по LAN.
#
# Употреба (от Git Bash през менюто, опция 84 — или ръчно):
#   powershell.exe -ExecutionPolicy Bypass -File 84-host-gpu-ollama.ps1 -Model qwen3.5:9b -Gpu 0
#   -Gpu -1  → пита коя карта (или „всички"); -Port по подразбиране 11434.

param(
  [string]$Model = "qwen3.5:9b",
  [int]$Gpu = -1,
  [int]$Port = 11434
)

$ErrorActionPreference = "Stop"
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Err($m){ Write-Host $m -ForegroundColor Red }

# 1) Ollama инсталиран?
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  Err "НЯМА ollama в PATH. Инсталирай от https://ollama.com (Windows), после пусни пак."
  exit 1
}
$ollamaDir = Split-Path $ollama.Source
Info "Ollama: $($ollama.Source)"

# 2) Видеокарти + избор коя да се ползва.
$nvsmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($nvsmi) {
  Info "`nВидеокарти (NVIDIA):"
  $list = & nvidia-smi --query-gpu=index,name,memory.total --format=csv,noheader
  $list | ForEach-Object { Write-Host "    $_" }
  if ($Gpu -lt 0) {
    $ans = Read-Host "`nКоя карта да ползва моделът? (индекс напр. 0, или 'all' за всички) [0]"
    if ([string]::IsNullOrWhiteSpace($ans)) { $ans = "0" }
    if ($ans -match '^(all|всички)$') { $Gpu = -1 } else { $Gpu = [int]$ans }
  }
} else {
  Warn "nvidia-smi не е намерен — няма NVIDIA драйвер? Моделът ще върви на CPU (бавно)."
}

# 3) OLLAMA_HOST = слушай навън (по подразбиране Ollama слуша само локално → виртуалката не го стига).
[Environment]::SetEnvironmentVariable("OLLAMA_HOST", "0.0.0.0:$Port", "User")
Ok "OLLAMA_HOST = 0.0.0.0:$Port (записано за потребителя)"

# Коя видеокарта (CUDA_VISIBLE_DEVICES): конкретен индекс, или махаме променливата = всички карти.
if ($Gpu -ge 0) {
  [Environment]::SetEnvironmentVariable("CUDA_VISIBLE_DEVICES", "$Gpu", "User")
  Ok "CUDA_VISIBLE_DEVICES = $Gpu (моделът ще ползва САМО тази карта)"
} else {
  [Environment]::SetEnvironmentVariable("CUDA_VISIBLE_DEVICES", $null, "User")
  Ok "CUDA_VISIBLE_DEVICES изчистено (моделът ще ползва ВСИЧКИ карти)"
}

# 4) Защитна стена — входящо правило за порта (иначе виртуалката се блокира).
$ruleName = "Ollama $Port"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($rule) {
  Ok "Защитна стена: правило „$ruleName" вече съществува."
} else {
  Info "Добавям правило в защитната стена за порт $Port…"
  try {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any -ErrorAction Stop | Out-Null
    Ok "Защитна стена: правилото е добавено."
  } catch {
    Warn "Няма админ права — пускам повишен прозорец (UAC) само за правилото…"
    $cmd = "New-NetFirewallRule -DisplayName '$ruleName' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any"
    try {
      Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile","-Command",$cmd -Wait
      Ok "Защитна стена: опитът за добавяне с повишение приключи (потвърди UAC)."
    } catch {
      Err "Не успях да добавя правилото. Пусни РЪЧНО като администратор:"
      Err "    $cmd"
    }
  }
}

# 5) Рестарт на Ollama, за да хване новите променливи (setx важи само за НОВИ процеси).
Info "`nРестартирам Ollama, за да влязат настройките…"
# ВАЖНО: setx пише в регистъра, но НОВ процес през Start-Process наследява средата на
# ТЕКУЩАТА сесия. Затова задаваме променливите и в текущата сесия — иначе рестартираният
# Ollama пак ще се върже само на 127.0.0.1 (старата среда без OLLAMA_HOST).
$env:OLLAMA_HOST = "0.0.0.0:$Port"
if ($Gpu -ge 0) { $env:CUDA_VISIBLE_DEVICES = "$Gpu" }
else { Remove-Item Env:CUDA_VISIBLE_DEVICES -ErrorAction SilentlyContinue }
Get-Process "ollama","ollama app" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$app = Join-Path $ollamaDir "ollama app.exe"
if (Test-Path $app) { Start-Process $app } else { Start-Process -WindowStyle Hidden ollama -ArgumentList "serve" }
Start-Sleep -Seconds 6

# Моделът наличен ли е? Ако не — тегли го.
Info "Проверявам модела „$Model"…"
$have = (& ollama list) -join "`n"
if ($have -notmatch [Regex]::Escape($Model)) {
  Warn "Моделът „$Model" липсва — тегля го (еднократно)…"
  & ollama pull $Model
} else {
  Ok "Моделът „$Model" е наличен."
}

# LAN адрес на хоста (този, който виртуалката ще ползва).
$lan = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq "Up" } |
        Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress
if (-not $lan) { $lan = "192.168.0.133" }

# Проверка, че отговаря на LAN адреса.
Info "`nПроверка: отговаря ли на http://${lan}:$Port …"
try {
  Invoke-WebRequest -Uri "http://${lan}:$Port/api/tags" -TimeoutSec 6 -UseBasicParsing | Out-Null
  Ok "✓ Хостът отговаря на http://${lan}:$Port"
} catch {
  Warn "Не отговори на LAN адреса (възможно е защитната стена още да блокира, или OLLAMA_HOST да не е хванал). Изход: $($_.Exception.Message)"
}

Write-Host ""
Ok "════════════════════════════════════════════════════════════"
Ok "  ХОСТЪТ е готов. За стъпката на виртуалната машина ползвай:"
Write-Host "    IP на хоста : $lan" -ForegroundColor White
Write-Host "    Порт        : $Port" -ForegroundColor White
Write-Host "    Модел       : $Model" -ForegroundColor White
if ($Gpu -ge 0) { Write-Host "    Видеокарта  : индекс $Gpu" -ForegroundColor White }
else { Write-Host "    Видеокарта  : всички" -ForegroundColor White }
Ok "════════════════════════════════════════════════════════════"
