#!/bin/bash
# Version: 1.0215
##############################################################################
# KCY — Инсталация на ЛОКАЛНА мобилна среда (Android) за тест на мобилните
# приложения от /rustore и /huawei. Работи на ТАЗИ Windows машина (НЕ сървъра).
#
#   1) Проверка на версии (choco / node / npm / git / JDK / Android Studio / SDK)
#   2) Визуализация на дисковете + свободно място (с лента), нужно ~20 GB
#   3) ТВОЙ избор: на кой диск и в коя директория да е Android SDK (тежката част)
#   4) Инсталация (елевиран PowerShell през UAC): JDK 17 + Android Studio,
#      задава ANDROID_HOME към избраната папка, тегли SDK + създава емулатор (AVD)
#
# Стартира се от менюто (опция 38) или ръчно: ./deploy-scripts/install-mobile-env.sh
##############################################################################
set +e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; NC=$'\033[0m'

# рисува лента за заетост на диск: $1=заето_GB $2=общо_GB
bar() {
  local used=$1 total=$2 width=24 filled j out=""
  if [ "$total" -le 0 ]; then filled=0; else filled=$(( used * width / total )); fi
  [ "$filled" -gt "$width" ] && filled=$width
  [ "$filled" -lt 0 ] && filled=0
  for ((j=0; j<width; j++)); do
    if [ "$j" -lt "$filled" ]; then out+="#"; else out+="."; fi
  done
  printf "[%s]" "$out"
}

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Мобилна среда (Android) — ЛОКАЛНА инсталация         ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo -e "  ${YELLOW}Инсталира на ТАЗИ машина (Windows), НЕ на сървъра.${NC}"
echo ""

# само Windows (нужен е powershell.exe)
if ! command -v powershell.exe >/dev/null 2>&1; then
  echo -e "  ${RED}✗ powershell.exe липсва — тази опция е само за Windows.${NC}"
  exit 1
fi

# ── 1/4  Проверка на наличното ──
echo -e "${BOLD}${CYAN}━━━ 1/4  Проверка на наличното ━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
printf "  choco:          "; if command -v choco >/dev/null 2>&1; then echo -e "${GREEN}$(choco --version 2>/dev/null)${NC}"; else echo -e "${RED}липсва — инсталирай Chocolatey първо${NC}"; fi
printf "  node:           "; if command -v node >/dev/null 2>&1; then echo -e "${GREEN}$(node -v)${NC}"; else echo -e "${YELLOW}липсва${NC}"; fi
printf "  npm:            "; if command -v npm >/dev/null 2>&1; then echo -e "${GREEN}$(npm -v)${NC}"; else echo -e "${YELLOW}липсва${NC}"; fi
printf "  git:            "; if command -v git >/dev/null 2>&1; then echo -e "${GREEN}$(git --version 2>/dev/null | awk '{print $3}')${NC}"; else echo -e "${YELLOW}липсва${NC}"; fi
printf "  JDK (java):     "; if command -v java >/dev/null 2>&1; then echo -e "${GREEN}$(java -version 2>&1 | head -1)${NC}"; else echo -e "${YELLOW}липсва (ще се инсталира)${NC}"; fi
AS=$(powershell.exe -NoProfile -Command "if(Test-Path 'C:\Program Files\Android\Android Studio\bin\studio64.exe'){'yes'}else{'no'}" 2>/dev/null | tr -d '\r')
printf "  Android Studio: "; [ "$AS" = "yes" ] && echo -e "${GREEN}инсталиран${NC}" || echo -e "${YELLOW}липсва (ще се инсталира)${NC}"
SDKENV=$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('ANDROID_HOME','Machine')" 2>/dev/null | tr -d '\r')
printf "  ANDROID_HOME:   "; [ -n "$SDKENV" ] && echo -e "${GREEN}$SDKENV${NC}" || echo -e "${YELLOW}не е зададен${NC}"
echo ""

# ── 2/4  Дискове и свободно място ──
echo -e "${BOLD}${CYAN}━━━ 2/4  Дискове и свободно място ━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${YELLOW}Нужно: ~20 GB (Android Studio ~4 + SDK/емулатор ~12–16).${NC}"
echo ""
declare -a DLET=() DFREE=()
i=1
while IFS= read -r line; do
  line=${line%$'\r'}
  [ -z "$line" ] && continue
  letter=${line%%|*}; rest=${line#*|}; size=${rest%%|*}; free=${rest#*|}
  [ -z "$size" ] && continue
  tgb=$(( size / 1073741824 )); fgb=$(( free / 1073741824 )); ugb=$(( tgb - fgb ))
  DLET[$i]="$letter"; DFREE[$i]="$fgb"
  printf "    %d) %-3s " "$i" "$letter"; bar "$ugb" "$tgb"
  printf "  свободно: ${GREEN}%d GB${NC} / %d GB" "$fgb" "$tgb"
  [ "$fgb" -lt 20 ] && printf "  ${RED}(под 20 GB!)${NC}"
  echo ""
  i=$((i+1))
done < <(powershell.exe -NoProfile -Command "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object { \$_.DeviceID + '|' + \$_.Size + '|' + \$_.FreeSpace }" 2>/dev/null)
DCOUNT=$((i-1))
[ "$DCOUNT" -lt 1 ] && { echo -e "  ${RED}✗ Не намерих локални дискове.${NC}"; exit 1; }
echo ""

# ── 3/4  Къде да е Android SDK ──
echo -e "${BOLD}${CYAN}━━━ 3/4  Къде да е Android SDK (тежката част — твой избор) ━${NC}"
read -p "  Избери диск [1-${DCOUNT}]: " pick
sel="${DLET[$pick]}"
[ -z "$sel" ] && { echo -e "  ${RED}Невалиден избор.${NC}"; exit 1; }
selfree="${DFREE[$pick]}"
if [ "${selfree:-0}" -lt 20 ]; then
  echo -e "  ${RED}⚠ На ${sel} има само ${selfree} GB — под препоръчаните 20 GB.${NC}"
  read -p "  Да продължа въпреки това? [y/N]: " sp
  [ "$sp" = "y" ] || [ "$sp" = "Y" ] || { echo "  Отказано."; exit 0; }
fi
defdir="${sel}\\Android\\Sdk"
read -p "  Директория за SDK [Enter = ${defdir}]: " sdkdir
sdkdir="${sdkdir:-$defdir}"
echo ""
echo -e "  ${BOLD}План:${NC}"
echo -e "    • JDK 17 → Program Files (Android Studio IDE е по избор — не е нужен за билд)"
echo -e "    • Android SDK + емулатор (headless) → ${GREEN}${sdkdir}${NC}  (диск ${sel})"
echo ""
read -p "  Потвърждаваш? Ще изскочи UAC — цъкни ДА. [y/N]: " conf
[ "$conf" = "y" ] || [ "$conf" = "Y" ] || { echo "  Отказано."; exit 0; }

# ── 4/4  Генерирай елевиран PS (ASCII) и пусни ──
echo -e "${BOLD}${CYAN}━━━ 4/4  Инсталация (елевиран прозорец) ━━━━━━━━━━━━━━━━━━${NC}"
PS1="$HOME/kcy-install-mobile.ps1"
# ASCII-only съдържание — Windows PowerShell 5.1 чете .ps1 като ANSI, кирилица би се счупила.
cat > "$PS1" <<'PSEOF'
param([string]$SdkDir)
$ErrorActionPreference='Continue'
$ProgressPreference='SilentlyContinue'
function Log($m){ Write-Host $m -ForegroundColor Cyan }
$log = "$env:USERPROFILE\kcy-mobile-install.log"
Start-Transcript -Path $log -Append | Out-Null
Log "=== KCY mobile env install ==="
Log ("SDK target: " + $SdkDir)

if(-not (Get-Command choco -ErrorAction SilentlyContinue)){
  Write-Host "Chocolatey (choco) missing. Install it first: https://chocolatey.org/install" -ForegroundColor Red
  Stop-Transcript | Out-Null; Read-Host "Enter to close"; exit 1
}

Log "[1/5] Installing JDK 17 via choco (Android Studio IDE is NOT required for APK builds)..."
choco install -y temurin17
# Android Studio IDE is optional: the choco 'androidstudio' package often points to a dead
# download URL (404). It is NOT needed here - JDK + the headless SDK + emulator installed
# below cover both building and running APKs. For the GUI, install it manually from
# https://developer.android.com/studio

Log "[2/5] Setting ANDROID_HOME / ANDROID_SDK_ROOT (machine)..."
New-Item -ItemType Directory -Force -Path $SdkDir | Out-Null
[Environment]::SetEnvironmentVariable('ANDROID_HOME',$SdkDir,'Machine')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT',$SdkDir,'Machine')
$env:ANDROID_HOME=$SdkDir; $env:ANDROID_SDK_ROOT=$SdkDir

# locate JDK 17 for JAVA_HOME (sdkmanager/avdmanager need it)
$jdk = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'jdk-17*' } | Select-Object -First 1
if($jdk){ $env:JAVA_HOME=$jdk.FullName; [Environment]::SetEnvironmentVariable('JAVA_HOME',$jdk.FullName,'Machine'); Log ("JAVA_HOME=" + $jdk.FullName) }

try{
  Log "[3/5] Downloading Android command-line tools..."
  $cltZip = "$env:TEMP\cmdline-tools.zip"
  $cltUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
  Invoke-WebRequest -Uri $cltUrl -OutFile $cltZip -UseBasicParsing
  $dest = Join-Path $SdkDir 'cmdline-tools'
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Expand-Archive -Path $cltZip -DestinationPath $dest -Force
  # normalize to cmdline-tools\latest\bin
  if(Test-Path (Join-Path $dest 'cmdline-tools')){
    $latest = Join-Path $dest 'latest'
    New-Item -ItemType Directory -Force -Path $latest | Out-Null
    Move-Item (Join-Path $dest 'cmdline-tools\*') $latest -Force
    Remove-Item (Join-Path $dest 'cmdline-tools') -Recurse -Force
  }
  $sdkm = Join-Path $SdkDir 'cmdline-tools\latest\bin\sdkmanager.bat'
  $avdm = Join-Path $SdkDir 'cmdline-tools\latest\bin\avdmanager.bat'

  Log "[4/5] Accepting licenses + installing SDK packages (this downloads several GB)..."
  cmd /c "echo y| `"$sdkm`" --sdk_root=`"$SdkDir`" --licenses"
  & $sdkm --sdk_root="$SdkDir" "platform-tools" "platforms;android-34" "build-tools;34.0.0" "emulator" "system-images;android-34;google_apis;x86_64"

  Log "[5/5] Creating emulator (AVD 'kcy_phone')..."
  cmd /c "echo no| `"$avdm`" create avd -n kcy_phone -k `"system-images;android-34;google_apis;x86_64`" -d pixel_6"
  Log "SDK + emulator ready in $SdkDir"
}catch{
  Write-Host ("Headless SDK install step failed: " + $_.Exception.Message) -ForegroundColor Yellow
  Write-Host "Fallback: open Android Studio once - its wizard will install the SDK to ANDROID_HOME ($SdkDir) and you can create an emulator from Device Manager." -ForegroundColor Yellow
}

Log "=== DONE ==="
Write-Host ("Log: " + $log) -ForegroundColor Green
Stop-Transcript | Out-Null
Read-Host "Press Enter to close"
PSEOF

WINPS=$(cygpath -w "$PS1" 2>/dev/null || echo "$PS1")
echo -e "  ${CYAN}→ Пускам елевиран инсталатор… одобри UAC прозореца.${NC}"
echo -e "  ${YELLOW}  (тегли няколко GB — остави прозореца отворен до 'DONE')${NC}"
powershell.exe -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File','$WINPS','$sdkdir'"
echo ""
echo -e "  ${GREEN}✓ Инсталаторът е стартиран в отделен елевиран прозорец.${NC}"
echo -e "    Лог: ${CYAN}%USERPROFILE%\\kcy-mobile-install.log${NC}"
echo ""
echo -e "  ${BOLD}След като приключи (нужно е НОВ терминал, за да хване ANDROID_HOME):${NC}"
echo -e "    в папката на апа →  ${CYAN}npm install${NC}"
echo -e "                        ${CYAN}npm run build${NC}"
echo -e "                        ${CYAN}npx cap add android && npx cap sync${NC}"
echo -e "                        ${CYAN}(cd android && ./gradlew assembleDebug)${NC}  → APK"
echo -e "    после пусни емулатора и инсталирай APK-то, или: ${CYAN}npx cap run android${NC}"
