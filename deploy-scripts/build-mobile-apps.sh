#!/bin/bash
# Version: 1.0216
##############################################################################
# KCY — Билд/компилация на мобилните апове от /rustore и /huawei.
#
#   • Подаваш път (папка на магазин ИЛИ на конкретен апп), ИЛИ избираш интерактивно.
#   • За всеки апп:  npm install → npm run build (web) → cap add/sync android → APK (gradle)
#   • Грациозно: ако няма Android SDK/JDK, прави поне web билда и казва какво липсва
#     (Android средата се слага с опция 38 от менюто).
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

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Билд на мобилни апове (rustore / huawei)            ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Preflight: инструменти ──
echo -e "${BOLD}${CYAN}━━━ Проверка на средата ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
NODE_OK=0; command -v node >/dev/null 2>&1 && NODE_OK=1
printf "  node/npm:     "; [ "$NODE_OK" = 1 ] && echo -e "${GREEN}$(node -v) / $(npm -v)${NC}" || { echo -e "${RED}липсва — без Node не може${NC}"; exit 1; }

# JAVA_HOME / java — машинната env от опция 38 не е в текущата сесия, затова питаме и Windows
JAVA_OK=0
if command -v java >/dev/null 2>&1; then JAVA_OK=1
else
  JH=$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('JAVA_HOME','Machine')" 2>/dev/null | tr -d '\r')
  if [ -n "$JH" ] && [ -x "$(cygpath -u "$JH" 2>/dev/null)/bin/java.exe" ]; then
    export JAVA_HOME="$JH"; export PATH="$(cygpath -u "$JH")/bin:$PATH"; JAVA_OK=1
  fi
fi
printf "  JDK (java):   "; [ "$JAVA_OK" = 1 ] && echo -e "${GREEN}налично${NC}" || echo -e "${YELLOW}липсва (web билд да; APK не)${NC}"

# ANDROID_HOME — от текущата env или от машинната (опция 38)
[ -z "$ANDROID_HOME" ] && ANDROID_HOME=$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('ANDROID_HOME','Machine')" 2>/dev/null | tr -d '\r')
SDK_OK=0
if [ -n "$ANDROID_HOME" ]; then
  ASDK_U=$(cygpath -u "$ANDROID_HOME" 2>/dev/null || echo "$ANDROID_HOME")
  [ -d "$ASDK_U" ] && { SDK_OK=1; export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"; }
fi
printf "  Android SDK:  "; [ "$SDK_OK" = 1 ] && echo -e "${GREEN}${ANDROID_HOME}${NC}" || echo -e "${YELLOW}липсва (пусни опция 38)${NC}"

ANDROID_READY=0; [ "$JAVA_OK" = 1 ] && [ "$SDK_OK" = 1 ] && ANDROID_READY=1
echo ""
if [ "$ANDROID_READY" = 0 ]; then
  echo -e "  ${YELLOW}⚠ Android средата не е пълна → ще правя само WEB билд (dist/).${NC}"
  echo -e "  ${YELLOW}  За APK: пусни опция 38 (инсталирай мобилна среда), отвори НОВ терминал, после пак тук.${NC}"
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
