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

# Версия на APK: пише versionCode (МОНОТОНЕН → Android вижда всеки билд като ЪПДЕЙТ, а не
# „вече инсталирано", затова не се налага ръчна деинсталация) и versionName (от глобалния
# брояч 00047.version). Прави се СЛЕД cap sync, защото то пресъздава build.gradle.
inject_version() {
  local gradle="android/app/build.gradle"
  [ -f "$gradle" ] || return 0
  sed -i -E "s/versionCode[[:space:]]+[0-9]+/versionCode ${APK_VERSION_CODE}/" "$gradle"
  sed -i -E "s/versionName[[:space:]]+\"[^\"]*\"/versionName \"${APK_VERSION_NAME}\"/" "$gradle"
  echo -e "  ${GREEN}✓ версия: versionCode ${APK_VERSION_CODE} · versionName ${APK_VERSION_NAME}${NC}"
}

# Една версия за целия билд: code = epoch секунди (винаги расте), name = брояча 00047.version.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK_VERSION_NAME="$(tr -d ' \r\n' < "$REPO_ROOT/00047.version" 2>/dev/null)"; [ -z "$APK_VERSION_NAME" ] && APK_VERSION_NAME="1.0"
APK_VERSION_CODE="$(date +%s)"

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

# Добавя ЕДИН апп по ИМЕ за ДВАТА магазина (rustore + huawei), ако съществува там.
add_app_both() { local n="$1" s; for s in rustore huawei; do is_app "$s/$n" && APPS+=("$s/$n"); done; }

if [ -n "$ARG" ]; then
  ARG="${ARG%/}"
  if is_app "$ARG"; then
    APPS+=("$ARG")                                   # точен път на апп (само този)
  elif [ "$ARG" = "rustore" ] || [ "$ARG" = "huawei" ]; then
    for d in "$ARG"/*/; do d="${d%/}"; is_app "$d" && APPS+=("$d"); done   # цял магазин
  elif [[ "$ARG" != */* ]] && { is_app "rustore/$ARG" || is_app "huawei/$ARG"; }; then
    add_app_both "$ARG"                              # само ИМЕ → двата магазина
  else
    echo -e "  ${RED}✗ Няма такъв път/апп/име: $ARG${NC}"; exit 1
  fi
else
  # интерактивно — УНИКАЛНИ имена на апове (обхожда rustore/ и huawei/).
  # Избор на едно име билдва за ДВАТА магазина (rustore + huawei).
  declare -a NAMES=()
  for store in rustore huawei; do
    [ -d "$store" ] || continue
    for d in "$store"/*/; do
      d="${d%/}"; is_app "$d" || continue
      n="$(basename "$d")"; seen=0
      for x in "${NAMES[@]}"; do [ "$x" = "$n" ] && { seen=1; break; }; done
      [ "$seen" = 0 ] && NAMES+=("$n")
    done
  done
  [ "${#NAMES[@]}" -eq 0 ] && { echo -e "  ${RED}✗ Не намерих апове в rustore/ или huawei/.${NC}"; exit 1; }
  echo -e "${BOLD}${CYAN}━━━ Кой апп да билдна? (избраният се прави за rustore И huawei) ━${NC}"
  i=1
  for n in "${NAMES[@]}"; do
    tags=""; is_app "rustore/$n" && tags+="rustore "; is_app "huawei/$n" && tags+="huawei "
    printf "    %2d) %-22s ${GRAY}(%s)${NC}\n" "$i" "$n" "$tags"; i=$((i+1))
  done
  echo -e "     a) ВСИЧКИ апове × двата магазина"
  echo ""
  read -p "  Избери [1-$((i-1)) / a]: " pick
  if [ "$pick" = "a" ] || [ "$pick" = "A" ]; then
    for n in "${NAMES[@]}"; do add_app_both "$n"; done
  elif [[ "$pick" =~ ^[0-9]+$ ]] && [ "$pick" -ge 1 ] && [ "$pick" -lt "$i" ]; then
    add_app_both "${NAMES[$((pick-1))]}"             # избраното име → двата магазина
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
    # Версия във web бъндъла: ако апът има src/version.js, го презаписваме с текущата
    # версия (00047.version) ПРЕДИ vite build → числото влиза в бъндъла и апът го показва
    # при старт (така веднага виждаш, че кодът е сменен). Апове без този файл се пропускат.
    if [ -f src/version.js ]; then
      printf "// Автогенериран от build-mobile-apps.sh — НЕ редактирай ръчно.\nexport const APP_VERSION = '%s';\n" "$APK_VERSION_NAME" > src/version.js
      echo -e "  ${GREEN}✓ src/version.js → ${APK_VERSION_NAME}${NC}"
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
      inject_version               # versionCode (монотонен) + versionName → Android вижда ъпдейт
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

# ── Десктоп Selflearning .exe (electron-builder) ──
# НЕ е отделно: върви ЗАЕДНО с мобилния selflearning-friend (когато е в избора).
# Electron не иска Android SDK → билдва се дори да няма Android среда. .exe → /apk.
build_desktop_slf() {
  local d="desktop/selflearning-friend"
  [ -d "$d" ] || { echo -e "  ${YELLOW}↷ десктоп selflearning липсва — пропускам${NC}"; return 0; }
  echo -e "${BOLD}${CYAN}━━━ desktop/selflearning-friend (.exe, electron) ━━━━━━━━${NC}"
  (
    cd "$d" || exit 1
    if [ ! -d node_modules ]; then
      echo -e "  ${CYAN}→ npm install…${NC}"; npm install || { echo -e "  ${RED}✗ npm install се провали${NC}"; exit 2; }
    fi
    echo -e "  ${CYAN}→ npm run dist:portable (electron-builder, ~145MB, бавно)…${NC}"
    npm run dist:portable || { echo -e "  ${RED}✗ electron-builder се провали${NC}"; exit 3; }
    EXE=$(ls -t dist-exe/*-portable.exe 2>/dev/null | head -1)
    if [ -n "$EXE" ] && [ -f "$EXE" ]; then
      mkdir -p "$ROOT/apk"
      if cp -f "$EXE" "$ROOT/apk/selflearning-friend-desktop-portable.exe"; then
        echo -e "  ${GREEN}✓ .exe → apk/selflearning-friend-desktop-portable.exe${NC}"
      else echo -e "  ${YELLOW}! не копирах .exe в /apk${NC}"; fi
    else echo -e "  ${YELLOW}! portable .exe не е намерен в dist-exe/${NC}"; fi
  )
  local rc=$?
  [ "$rc" -eq 0 ] && RESULTS+=("${GREEN}✓${NC} desktop/selflearning-friend (.exe)") || RESULTS+=("${RED}✗${NC} desktop/selflearning-friend (.exe) (код $rc)")
  echo ""
}

for d in "${APPS[@]}"; do build_one "$d"; done

# Ако в избора има selflearning-friend → билдни И десктоп .exe-то (същият апп, не отделно).
WANT_DESKTOP=0
for d in "${APPS[@]}"; do [ "$(basename "$d")" = "selflearning-friend" ] && WANT_DESKTOP=1; done
[ "$WANT_DESKTOP" = 1 ] && build_desktop_slf

# ── Обобщение ──
echo -e "${BOLD}${CYAN}━━━ Обобщение ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
for r in "${RESULTS[@]}"; do echo -e "  $r"; done
echo ""
[ "$ANDROID_READY" = 1 ] && echo -e "  APK-тата са в: ${CYAN}/apk/<апп>-<магазин>-debug.apk${NC}" \
  || echo -e "  ${YELLOW}Само web билд (dist/). За APK → опция 38 + нов терминал.${NC}"
