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

# Икона на приложението: генерира launcher иконите от store/icon.svg в android/res (СЛЕД cap
# sync, защото android/ се пресъздава всеки билд → ръчна икона там не оцелява, затова е тук, в
# кода). Ползва sharp (libvips) за SVG→PNG в 5-те плътности. Маха adaptive XML (anydpi-v26),
# за да ползва Android директно нашето PNG навсякъде. Без store/icon.svg или без sharp —
# тихо пропуска (остава дефолтната икона), НЕ чупи билда.
inject_app_icon() {
  local src="store/icon.svg"
  [ -f "$src" ] || { echo -e "  ${GRAY}↷ икона: няма store/icon.svg — оставям дефолтната${NC}"; return 0; }
  local resdir="android/app/src/main/res"
  [ -d "$resdir" ] || return 0
  node -e '
    const fs=require("fs"), path=require("path");
    let sharp; try{ sharp=require("sharp"); }catch(e){ process.exit(42); }
    const src=process.argv[1], res=process.argv[2];
    const dens={ "mipmap-mdpi":48,"mipmap-hdpi":72,"mipmap-xhdpi":96,"mipmap-xxhdpi":144,"mipmap-xxxhdpi":192 };
    (async()=>{
      const svg=fs.readFileSync(src);
      for(const dir of Object.keys(dens)){
        const size=dens[dir];
        const out=path.join(res,dir); fs.mkdirSync(out,{recursive:true});
        const png=await sharp(svg,{density:512}).resize(size,size).png().toBuffer();
        fs.writeFileSync(path.join(out,"ic_launcher.png"),png);
        fs.writeFileSync(path.join(out,"ic_launcher_round.png"),png);
        fs.writeFileSync(path.join(out,"ic_launcher_foreground.png"),png);
      }
      try{ fs.rmSync(path.join(res,"mipmap-anydpi-v26"),{recursive:true,force:true}); }catch(e){}
      process.exit(0);
    })().catch(()=>process.exit(43));
  ' "$src" "$resdir"
  local rc=$?
  if [ "$rc" = 0 ]; then echo -e "  ${GREEN}✓ икона генерирана от store/icon.svg (5 плътности)${NC}"
  elif [ "$rc" = 42 ]; then echo -e "  ${YELLOW}↷ икона: sharp липсва — оставям дефолтната${NC}"
  else echo -e "  ${YELLOW}! икона: грешка при генериране — оставям дефолтната${NC}"; fi
  return 0
}

# Заздравяване на gradle веригата за инструментите (СЛЕД cap sync, защото android/ се пресъздава):
#  1) Някои Capacitor плъгини (напр. @aparajita/capacitor-secure-storage) декларират Java 21 в
#     своя android/build.gradle. Билд средата е JDK 17 → „invalid source release: 21". Сваляме
#     ВСЕКИ subproject до Java 17 (17 е базата на екосистемата; плъгините са тънки обвивки).
#  2) Зависимости като bcprov-jdk18on:1.79 носят Java 21 класове (multi-release jar). Gradle 8.2.1
#     ги инструментира със стар ASM → „Unsupported class file major version 65". Вдигаме wrapper-а
#     на 8.7 (нов ASM, чете Java 21 класове; съвместим с AGP 8.2.1).
harden_gradle_toolchain() {
  local wrap="android/gradle/wrapper/gradle-wrapper.properties"
  [ -f "$wrap" ] && sed -i 's#gradle-8\.2\.1-all\.zip#gradle-8.7-all.zip#' "$wrap"
  local root="android/build.gradle"
  if [ -f "$root" ] && ! grep -q "FORCE_JAVA_17" "$root"; then
    cat >> "$root" <<'GRADLE'

// FORCE_JAVA_17 (build-mobile-apps.sh) — плъгини, декларирали Java 21, се свалят до 17 (JDK 17 среда).
subprojects {
    afterEvaluate { p ->
        if (p.hasProperty('android')) {
            p.android.compileOptions {
                sourceCompatibility JavaVersion.VERSION_17
                targetCompatibility JavaVersion.VERSION_17
            }
        }
    }
}
GRADLE
  fi
  echo -e "  ${GREEN}✓ gradle верига: wrapper 8.7 + Java 17 за всички subprojects${NC}"
}

# versionCode = epoch секунди (винаги расте → Android вижда ъпдейт).
# versionName е ПЕР-АП: най-високата „Version:" сред СОБСТВЕНИТЕ файлове на апа (смята се в
# build_one → compute_app_version). Екосистемният маркер 000NN.version НЕ се чете — той е само
# визуален маркер за най-високата версия някъде, не версия на конкретно приложение.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK_VERSION_NAME="1.0001"   # фолбек, ако ап без нито един „Version:" хедър
APK_VERSION_CODE="$(date +%s)"

# Версия на един ап = max „Version: 1.XXXX" сред файловете му (src + коренни html/js/css).
# Викa се ВЪТРЕ в build_one (след cd в папката на апа).
compute_app_version() {
  local max
  max="$(grep -rhoE "Version:[[:space:]]*1\.[0-9]{4}" src ./*.html ./*.js ./*.css 2>/dev/null \
        | grep -oE "1\.[0-9]{4}" | sort -t. -k2,2n | tail -1)"
  [ -z "$max" ] && max="1.0001"
  printf '%s' "$max"
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
    # Версия на ТОЗИ ап (НЕ екосистемната): max „Version:" хедър сред собствените му файлове.
    # Записва се в app.version в директорията на апа — това е версията, която апът показва/качва.
    APK_VERSION_NAME="$(compute_app_version)"
    printf '%s\n' "$APK_VERSION_NAME" > app.version
    echo -e "  ${GREEN}✓ версия на апа: ${APK_VERSION_NAME} → app.version${NC}"
    if [ ! -d node_modules ]; then
      echo -e "  ${CYAN}→ npm install…${NC}"; npm install || { echo -e "  ${RED}✗ npm install се провали${NC}"; exit 2; }
    fi
    # Версия във web бъндъла: за ВСЕКИ апп (пре)записваме src/version.js с текущата версия
    # (app.version) ПРЕДИ vite build → числото влиза в бъндъла и апът го показва на началния
    # екран (така веднага виждаш, че кодът е сменен). Преди се пишеше само при вече съществуващ
    # файл; сега се създава навсякъде, за да МОЖЕ всеки начален екран да показва версията.
    if [ -d src ]; then
      printf "// Автогенериран от build-mobile-apps.sh — НЕ редактирай ръчно.\nexport const APP_VERSION = '%s';\n" "$APK_VERSION_NAME" > src/version.js
      echo -e "  ${GREEN}✓ src/version.js → ${APK_VERSION_NAME}${NC}"
    fi
    # Домейни за падащото меню „Домейн на сървъра": впръскваме ги от private/configs/.env в
    # src/core/server-presets.js (само ако апът има този файл — т.е. selflearning-friend), за да
    # не се преписват на ръка. Липсва tailnet/vm-host → менюто показва само публичния домейн.
    if [ -f src/core/server-presets.js ]; then
      _SLF_ENV="$REPO_ROOT/private/configs/.env"
      _slf_env() { grep -E "^$1=" "$_SLF_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }
      _slf_raw() { grep -E "^$1=" "$_SLF_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r'; }
      _trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; printf '%s' "${s//\'/}"; }
      SLF_PUB="$(_slf_env SELFLEARNING_PUBLIC_DOMAIN)"; SLF_PUB="${SLF_PUB:-selflearning.bot.nu}"
      SLF_TNET="$(_slf_env SELFLEARNING_TAILNET)"
      SLF_VMH="$(_slf_env SELFLEARNING_VM_HOST)"
      SLF_EXTRA="$(_slf_raw SELFLEARNING_EXTRA_DOMAINS)"
      {
        printf "// Автогенериран от build-mobile-apps.sh от private/configs/.env — НЕ редактирай ръчно.\n"
        printf "export const SERVER_PRESETS = [\n"
        printf "  { label: 'Публичен — %s', domain: '%s' },\n" "$SLF_PUB" "$SLF_PUB"
        if [ -n "$SLF_TNET" ] && [ -n "$SLF_VMH" ]; then
          printf "  { label: 'Виртуалка по Tailscale — %s', domain: '%s.%s' },\n" "$SLF_VMH" "$SLF_VMH" "$SLF_TNET"
        fi
        # Допълнителни домейни от .env (SELFLEARNING_EXTRA_DOMAINS): формат „Етикет|домейн", разделени с „;".
        if [ -n "$SLF_EXTRA" ]; then
          _OIFS="$IFS"; IFS=';'
          for _e in $SLF_EXTRA; do
            _lbl="$(_trim "${_e%%|*}")"
            _dom="$(_trim "${_e#*|}")"; _dom="${_dom// /}"
            [ -n "$_dom" ] || continue
            [ -n "$_lbl" ] || _lbl="$_dom"
            printf "  { label: '%s', domain: '%s' },\n" "$_lbl" "$_dom"
          done
          IFS="$_OIFS"
        fi
        printf "];\n"
        printf "export const DEFAULT_PRESET_DOMAIN = '%s';\n" "$SLF_PUB"
      } > src/core/server-presets.js
      echo -e "  ${GREEN}✓ src/core/server-presets.js ← .env (${SLF_PUB}${SLF_VMH:+, ${SLF_VMH}.${SLF_TNET}}${SLF_EXTRA:+, +доп.})${NC}"
    fi
    echo -e "  ${CYAN}→ npm run build (web)…${NC}"
    npm run build || { echo -e "  ${RED}✗ web билдът се провали${NC}"; exit 3; }
    echo -e "  ${GREEN}✓ web билд готов → $d/dist${NC}"
    # Каталог „Още от KCY Ecosystem" → dist/kcy-promo.json (редактира се ЛЕСНО ПРЕДИ БИЛД в
    # app-shared/promo-catalog.json: кои апове са одобрени/публикувани, имена, store линкове).
    if [ -f "$ROOT/app-shared/promo-catalog.json" ] && [ -d dist ]; then
      cp "$ROOT/app-shared/promo-catalog.json" dist/kcy-promo.json
      echo -e "  ${GREEN}✓ каталог → dist/kcy-promo.json${NC}"
    fi
    # Capacitor WebView (вкл. Xiaomi/MIUI) понякога НЕ зарежда модулен скрипт с crossorigin
    # на https://localhost схемата → черен екран. Махаме crossorigin от index.html (безопасно).
    [ -f dist/index.html ] && sed -i 's/ crossorigin//g' dist/index.html 2>/dev/null || true

    if [ "$ANDROID_READY" = 1 ]; then
      # Осигуряваме Capacitor Android платформата (апповете обявяват core/cli, но често НЕ android).
      echo -e "  ${CYAN}→ осигурявам @capacitor/android…${NC}"; npm i @capacitor/core@^6 @capacitor/cli@^6 @capacitor/android@^6 >/dev/null 2>&1 || true
      [ -d android ] || { echo -e "  ${CYAN}→ npx cap add android…${NC}"; npx cap add android || { echo -e "  ${RED}✗ cap add android се провали${NC}"; exit 4; }; }
      echo -e "  ${CYAN}→ npx cap sync android…${NC}"; npx cap sync android || { echo -e "  ${RED}✗ cap sync се провали${NC}"; exit 5; }
      harden_gradle_toolchain      # wrapper 8.7 + Java 17 за всички subprojects (плъгини с Java 21)
      inject_android_permissions   # добавя CAMERA/RECORD_AUDIO и т.н. от android-permissions.txt
      inject_version               # versionCode (монотонен) + versionName → Android вижда ъпдейт
      inject_app_icon              # икона от store/icon.svg → android/res (sharp), ако има
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

# Чистим СТАРИТЕ APK-та в /apk — но САМО за магазините, които ще билдваме СЕГА. Така папката
# е една (/apk) и без остатъци от изтрити апове, но НЕ трием APK на ДРУГ магазин, билднат с
# отделно извикване (напр. `… huawei` после `… rustore` — да не си трият взаимно).
if [ "$ANDROID_READY" = 1 ] && [ "${#APPS[@]}" -gt 0 ]; then
  mkdir -p "$ROOT/apk"
  # Трием САМО APK-тата на апове, които ще билдваме СЕГА (точно по име) — за да няма стар
  # APK, но БЕЗ да бутаме съседните (нито друг магазин, нито други апове при единичен билд).
  for d in "${APPS[@]}"; do
    st="${d%%/*}"; nm="$(basename "$d")"
    rm -f "$ROOT/apk/${nm}-${st}-debug.apk" 2>/dev/null
  done
  echo -e "  ${CYAN}↻ изчистих старите APK само на избраните апове в /apk${NC}"
fi

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
  || echo -e "  ${YELLOW}Само web билд (dist/). За APK → опция 56 (инсталирай средата) + нов терминал.${NC}"
