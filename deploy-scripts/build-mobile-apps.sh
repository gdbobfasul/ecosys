#!/bin/bash
# Version: 1.0218
##############################################################################
# KCY — Билд/компилация на мобилните апове от /rustore и /huawei.
#
#   • Подаваш път (папка на магазин ИЛИ на конкретен апп), ИЛИ избираш интерактивно.
#   • За всеки апп:  npm install → npm run build (web) → cap add/sync android → APK (gradle)
#   • Грациозно: ако няма Android SDK/JDK, прави поне web билда и казва какво липсва
#     (Android средата се слага с опция 56 от менюто; preflight проверява всеки компонент).
#
# Употреба:
#   ./deploy-scripts/build-mobile-apps.sh                       # интерактивно
#   ./deploy-scripts/build-mobile-apps.sh rustore               # всички апове в rustore
#   ./deploy-scripts/build-mobile-apps.sh huawei                # всички апове в huawei
#   ./deploy-scripts/build-mobile-apps.sh rustore/plane-shooter # само този апп
##############################################################################
set +e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; NC=$'\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

is_app() { [ -f "$1/package.json" ] && [ -f "$1/capacitor.config.json" ]; }

# Android разрешения: android/ се пресъздава при всеки билд (cap add/sync), затова
# инжектираме нужните <uses-permission> в генерирания AndroidManifest.xml СЛЕД cap sync.
# Източник: по избор файл `android-permissions.txt` в папката на апа (по едно разрешение
# на ред, напр. android.permission.CAMERA). Без файл → нищо не се добавя.
inject_android_permissions() {
  local manifest="android/app/src/main/AndroidManifest.xml"
  local permfile="android-permissions.txt"
  [ -f "$manifest" ] || return 0
  [ -f "$permfile" ] || return 0
  local perm
  while IFS= read -r perm; do
    perm="$(echo "$perm" | tr -d '\r' | sed 's/[[:space:]]//g')"
    [ -z "$perm" ] && continue
    case "$perm" in \#*) continue ;; esac
    if grep -q "android:name=\"$perm\"" "$manifest"; then continue; fi
    sed -i "s|<application|    <uses-permission android:name=\"$perm\" />\n    <application|" "$manifest"
    echo -e "  ${GREEN}✓ разрешение добавено в манифеста: $perm${NC}"
  done < "$permfile"
}

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Билд на мобилни апове (rustore / huawei)            ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Preflight: ПЪЛНА проверка на средата (всичко, което слага опция 56) ──
# Проверяваме НЕ само наличие, а и че реално работи (java версия, и че SDK има
# platform-tools + platforms;android-XX + build-tools — без тях gradle НЕ прави APK).
echo -e "${BOLD}${CYAN}━━━ Проверка на средата (компонентите от опция 56) ━━━━━━${NC}"
declare -a MISSING=()
okln()   { echo -e "  ${GREEN}✓${NC} $1"; }
badln()  { echo -e "  ${RED}✗${NC} $1"; MISSING+=("$2"); }
warnln() { echo -e "  ${YELLOW}!${NC} $1"; }

# 1) node/npm — критично за ВСЕКИ билд
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  okln "node/npm: $(node -v) / $(npm -v)"
else
  echo -e "  ${RED}✗ node/npm липсва — без Node не може нищо. Инсталирай Node.js и пробвай пак.${NC}"; exit 1
fi

# 2) JDK (java) ≥ 17 — функционална проверка (gradle иска JDK 17). PATH или машинния JAVA_HOME.
JAVA_OK=0
if ! command -v java >/dev/null 2>&1; then
  JH=$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('JAVA_HOME','Machine')" 2>/dev/null | tr -d '\r')
  if [ -n "$JH" ]; then
    JHU="$(cygpath -u "$JH" 2>/dev/null || echo "$JH")"
    if [ -x "$JHU/bin/java.exe" ] || [ -x "$JHU/bin/java" ]; then export JAVA_HOME="$JH"; export PATH="$JHU/bin:$PATH"; fi
  fi
fi
if command -v java >/dev/null 2>&1; then
  JV=$(java -version 2>&1 | head -1)
  JMAJ=$(echo "$JV" | grep -oE '[0-9]+' | head -1)
  [ "$JMAJ" = "1" ] && JMAJ=$(echo "$JV" | grep -oE '[0-9]+' | sed -n 2p)
  if [ "${JMAJ:-0}" -ge 17 ]; then JAVA_OK=1; okln "JDK: ${JV}"
  else warnln "JDK версия ${JMAJ} < 17 (gradle иска JDK 17)"; MISSING+=("JDK 17 (намерено: ${JMAJ})"); fi
else
  badln "JDK (java) липсва или не се стартира" "JDK 17 (Temurin)"
fi

# 3) ANDROID_HOME — текущ env или машинния (от опция 56)
[ -z "$ANDROID_HOME" ] && ANDROID_HOME=$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('ANDROID_HOME','Machine')" 2>/dev/null | tr -d '\r')
ASDK=""; SDK_DIR_OK=0
[ -n "$ANDROID_HOME" ] && ASDK="$(cygpath -u "$ANDROID_HOME" 2>/dev/null || echo "$ANDROID_HOME")"
if [ -n "$ASDK" ] && [ -d "$ASDK" ]; then
  SDK_DIR_OK=1; export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"; okln "ANDROID_HOME: ${ANDROID_HOME}"
else
  badln "ANDROID_HOME не е зададен/папката липсва" "Android SDK (ANDROID_HOME)"
fi

# 4–7) SDK компоненти (само ако имаме SDK папка) — критични за APK: platforms + build-tools
PLAT_OK=0; BT_OK=0
if [ "$SDK_DIR_OK" = 1 ]; then
  if [ -e "$ASDK/platform-tools/adb.exe" ] || [ -e "$ASDK/platform-tools/adb" ]; then okln "platform-tools (adb)"; else warnln "platform-tools (adb) липсва (не спира билда, но опция 56 го слага)"; fi
  if [ -d "$ASDK/platforms" ] && ls "$ASDK/platforms"/android-* >/dev/null 2>&1; then PLAT_OK=1; okln "platforms: $(ls "$ASDK/platforms" 2>/dev/null | tr '\n' ' ')"; else badln "platforms;android-XX липсва (нужно за compile)" "platforms;android-34"; fi
  if [ -d "$ASDK/build-tools" ] && [ -n "$(ls -A "$ASDK/build-tools" 2>/dev/null)" ]; then BT_OK=1; okln "build-tools: $(ls "$ASDK/build-tools" 2>/dev/null | tr '\n' ' ')"; else badln "build-tools липсва (нужно за APK)" "build-tools;34.0.0"; fi
  if [ -e "$ASDK/cmdline-tools/latest/bin/sdkmanager.bat" ] || [ -e "$ASDK/cmdline-tools/latest/bin/sdkmanager" ]; then okln "cmdline-tools (sdkmanager)"; else warnln "cmdline-tools липсва (не е критично за билд)"; fi
fi

# Готовност за APK: JDK 17 + SDK папка + поне една платформа + build-tools.
ANDROID_READY=0
[ "$JAVA_OK" = 1 ] && [ "$SDK_DIR_OK" = 1 ] && [ "$PLAT_OK" = 1 ] && [ "$BT_OK" = 1 ] && ANDROID_READY=1
echo ""
if [ "$ANDROID_READY" = 1 ]; then
  echo -e "  ${GREEN}${BOLD}✓ Android средата е пълна и работеща → ще правя и APK.${NC}"
  echo ""
else
  echo -e "  ${YELLOW}${BOLD}⚠ Android средата НЕ е пълна → мога само WEB билд (dist/), APK ще пропусна.${NC}"
  if [ "${#MISSING[@]}" -gt 0 ]; then
    echo -e "  ${YELLOW}Липсва/не работи:${NC}"
    for m in "${MISSING[@]}"; do echo -e "      ${RED}•${NC} ${m}"; done
  fi
  echo -e "  ${YELLOW}→ Пусни ${BOLD}ОПЦИЯ 56${NC}${YELLOW} (Инсталирай мобилна среда), изчакай 'DONE' в елевирания прозорец,${NC}"
  echo -e "  ${YELLOW}  ОТВОРИ НОВ ТЕРМИНАЛ (за да хване ANDROID_HOME/JAVA_HOME) и пусни 57 пак.${NC}"
  echo ""
  read -p "  Да продължа САМО с web билд (без APK)? [Y/n]: " CONT_WEB
  case "${CONT_WEB,,}" in n|no|не|нет) echo "  Отказано — иди пусни опция 56."; exit 0 ;; esac
  echo ""
fi

# ── Събери списък с апове за билд ──
declare -a APPS=()
ARG="$1"
if [ -n "$ARG" ]; then
  ARG="${ARG%/}"
  if is_app "$ARG"; then
    APPS+=("$ARG")
  elif [ -d "$ARG" ]; then
    for d in "$ARG"/*/; do d="${d%/}"; is_app "$d" && APPS+=("$d"); done
  else
    echo -e "  ${RED}✗ Няма такъв път/апп: $ARG${NC}"; exit 1
  fi
else
  # интерактивно — изброй всички апове под rustore/ и huawei/
  declare -a ALL=()
  for store in rustore huawei; do
    [ -d "$store" ] || continue
    for d in "$store"/*/; do d="${d%/}"; is_app "$d" && ALL+=("$d"); done
  done
  [ "${#ALL[@]}" -eq 0 ] && { echo -e "  ${RED}✗ Не намерих апове в rustore/ или huawei/.${NC}"; exit 1; }
  echo -e "${BOLD}${CYAN}━━━ Кой да билдна? ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  i=1
  for d in "${ALL[@]}"; do echo -e "    $i) $d"; i=$((i+1)); done
  echo -e "    a) ВСИЧКИ (${#ALL[@]})"
  echo ""
  read -p "  Избери [1-$((i-1)) / a]: " pick
  if [ "$pick" = "a" ] || [ "$pick" = "A" ]; then
    APPS=("${ALL[@]}")
  elif [[ "$pick" =~ ^[0-9]+$ ]] && [ "$pick" -ge 1 ] && [ "$pick" -lt "$i" ]; then
    APPS+=("${ALL[$((pick-1))]}")
  else
    echo "  Отказано."; exit 0
  fi
fi

echo ""
echo -e "  За билд: ${GREEN}${#APPS[@]}${NC} апп(а)"
echo ""

# ── Билд на един апп ──
declare -a RESULTS=()
build_one() {
  local d="$1" name="$1"
  echo -e "${BOLD}${CYAN}━━━ $name ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  (
    cd "$d" || exit 1
    if [ ! -d node_modules ]; then
      echo -e "  ${CYAN}→ npm install…${NC}"; npm install || { echo -e "  ${RED}✗ npm install се провали${NC}"; exit 2; }
    fi
    echo -e "  ${CYAN}→ npm run build (web)…${NC}"
    npm run build || { echo -e "  ${RED}✗ web билдът се провали${NC}"; exit 3; }
    echo -e "  ${GREEN}✓ web билд готов → $d/dist${NC}"
    # Capacitor WebView (вкл. Xiaomi/MIUI) понякога НЕ зарежда модулен скрипт с crossorigin
    # на https://localhost схемата → черен екран. Махаме crossorigin от index.html (безопасно).
    [ -f dist/index.html ] && sed -i 's/ crossorigin//g' dist/index.html 2>/dev/null || true

    if [ "$ANDROID_READY" = 1 ]; then
      # Осигуряваме Capacitor Android платформата (апповете обявяват core/cli, но често НЕ android).
      echo -e "  ${CYAN}→ осигурявам @capacitor/android…${NC}"; npm i @capacitor/core@^6 @capacitor/cli@^6 @capacitor/android@^6 >/dev/null 2>&1 || true
      [ -d android ] || { echo -e "  ${CYAN}→ npx cap add android…${NC}"; npx cap add android || { echo -e "  ${RED}✗ cap add android се провали${NC}"; exit 4; }; }
      echo -e "  ${CYAN}→ npx cap sync android…${NC}"; npx cap sync android || { echo -e "  ${RED}✗ cap sync се провали${NC}"; exit 5; }
      inject_android_permissions   # добавя CAMERA/RECORD_AUDIO и т.н. от android-permissions.txt
      echo -e "  ${CYAN}→ gradle assembleDebug (APK)…${NC}"
      (
        cd android || exit 6
        if [ -f gradlew ]; then ./gradlew assembleDebug; else exit 7; fi
      )
      # CWD е $d (subshell-ът вече cd-на в апа) → APK-ът е спрямо текущата папка.
      APK="android/app/build/outputs/apk/debug/app-debug.apk"
      if [ -f "$APK" ]; then
        mkdir -p "$ROOT/apk"
        OUT="$ROOT/apk/$(basename "$d")-${d%%/*}-debug.apk"
        if cp -f "$APK" "$OUT"; then echo -e "  ${GREEN}✓ APK → apk/$(basename "$OUT")${NC}"; else echo -e "  ${YELLOW}! не копирах APK в /apk${NC}"; fi
      else echo -e "  ${YELLOW}! APK не е намерен — виж изхода на gradle горе${NC}"; fi
    else
      echo -e "  ${YELLOW}↷ APK пропуснат (няма Android SDK/JDK)${NC}"
    fi
  )
  local rc=$?
  [ "$rc" -eq 0 ] && RESULTS+=("${GREEN}✓${NC} $name") || RESULTS+=("${RED}✗${NC} $name (код $rc)")
  echo ""
}

for d in "${APPS[@]}"; do build_one "$d"; done

# ── Обобщение ──
echo -e "${BOLD}${CYAN}━━━ Обобщение ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
for r in "${RESULTS[@]}"; do echo -e "  $r"; done
echo ""
[ "$ANDROID_READY" = 1 ] && echo -e "  APK-тата са в: ${CYAN}/apk/<апп>-<магазин>-debug.apk${NC}" \
  || echo -e "  ${YELLOW}Само web билд (dist/). За APK → опция 38 + нов терминал.${NC}"
