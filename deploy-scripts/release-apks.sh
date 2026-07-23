#!/usr/bin/env bash
# Version: 1.0220
# Release билд на мобилните апове: ключ по ап + подписан APK за rustore И huawei.
#
# Какво прави за ВСЕКИ ап:
#   1) Осигурява release ключ: keystores/<ап>-release.jks (+ .cred с паролите).
#      Ако липсва — генерира нов (RSA 2048, 10000 дни, DAI GROUP OOD). ПАЗИ папката keystores/!
#      Загубен ключ = невъзможен ъпдейт на публикувано приложение.
#   2) Пуска нормалния билд (deploy-scripts/build-mobile-apps.sh <ап>) — web + cap sync +
#      версия + debug APK, за ДВАТА магазина.
#   3) Вгражда signing конфигурация в android/app/build.gradle (inject-signing.mjs, идемпотентно).
#   4) gradlew assembleRelease с ключа от средата → apk/<ап>-<магазин>-release.apk.
#
# Употреба:
#   deploy-scripts/release-apks.sh                        # всички апове
#   deploy-scripts/release-apks.sh newslator              # само един (двата магазина)
#   deploy-scripts/release-apks.sh newslator monitor-bot  # няколко наведнъж
#
# ПРАВИЛО (изрично искане): при ЧАСТИЧЕН билд (изброени апове, не всички) папката apk/
# се ИЗЧИСТВА от APK/EXE на невключените апове — в нея остават САМО билдваните сега
# („какво качвам/тествам сега"). KCY_KEEP_OTHERS=1 запазва чуждите (за съзнателно
# допълване на пълен комплект). Изтритото се възстановява с пълен билд (без аргумент).
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
is_app() { [ -f "$1/package.json" ] && [ -f "$1/capacitor.config.json" ]; }

# Име на APK файла = МАГАЗИННОТО име на приложението, slug-нато до ASCII (напр. Pupikes-Toolkit-PDF,
# Huntline-3D, Godfist-Arena), а не по вътрешната папка (kcy-toolkit-pdf…). Източникът е ЕДИНЕН —
# deploy-scripts/apk-slug.mjs (каталожното "name" → index.html <title> → името на папката) — за да
# съвпада ТОЧНО с каталозите (update-apk-naming.mjs ползва същия резолвер).
store_slug() {
  local s; s="$(node deploy-scripts/apk-slug.mjs "$1" 2>/dev/null)"
  [ -n "$s" ] && printf '%s' "$s" || printf '%s' "$1"
}

DNAME="CN=DAI GROUP OOD, OU=Mobile, O=DAI GROUP OOD, L=Bishkek, ST=Chuy, C=KG"
mkdir -p keystores apk

# ── списък апове (уникални имена от rustore/ + huawei/) ──
declare -a NAMES=()
if [ -n "${1:-}" ]; then
  for a in "$@"; do NAMES+=("${a%/}"); done      # един ИЛИ няколко апа като аргументи
else
  for store in rustore huawei; do
    [ -d "$store" ] || continue
    for d in "$store"/*/; do
      d="${d%/}"; is_app "$d" || continue
      n="$(basename "$d")"; seen=0
      for x in "${NAMES[@]:-}"; do [ "$x" = "$n" ] && { seen=1; break; }; done
      [ "$seen" = 0 ] && NAMES+=("$n")
    done
  done
fi
[ "${#NAMES[@]}" -eq 0 ] && { echo -e "${RED}✗ Няма апове за билд.${NC}"; exit 1; }

echo -e "${BOLD}${CYAN}━━━ Release билд: ${#NAMES[@]} апа × (rustore + huawei) ━━━${NC}"

# ЧАСТИЧЕН билд → изчисти apk/ от невключените апове (правилото по-горе).
if [ -n "${1:-}" ] && [ "${KCY_KEEP_OTHERS:-0}" != "1" ]; then
  shopt -s nullglob
  for f in apk/*.apk apk/*.exe; do
    base="$(basename "$f")"; keep=0
    # Пази файла, ако е на ИЗБРАН ап — по МАГАЗИННОТО (slug) ИЛИ по старото име на папката
    # (за да не изтрием легитимен файл по време на прехода към новото именуване).
    for n in "${NAMES[@]}"; do s="$(store_slug "$n")"; case "$base" in "${s}-"*|"${n}-"*) keep=1; break;; esac; done
    if [ "$keep" = 0 ]; then rm -f "$f"; echo -e "  ${YELLOW}− изтрит (не е в избора): ${base}${NC}"; fi
  done
  shopt -u nullglob
fi
# Вътрешните извиквания на build-mobile-apps.sh са ап-по-ап → те НЕ бива да трият
# резултатите на другите апове от СЪЩИЯ билд (чистенето вече стана тук).
export KCY_KEEP_OTHERS=1

# ── ключ по ап: съществуващ или нов ──
ensure_key() {
  local app="$1" jks="keystores/${app}-release.jks" cred="keystores/${app}-release.cred" pw
  if [ ! -f "$jks" ]; then
    # НОВ ключ се прави САМО ако апът никога не е билдван release. Ако вече има release APK
    # (т.е. апът може да е КАЧЕН в магазин), нов ключ = невъзможен ъпдейт → спираме шумно.
    if ls "apk/$(store_slug "$app")-"*"-release.apk" "apk/${app}-"*"-release.apk" >/dev/null 2>&1; then
      echo -e "${RED}✗ $app: има съществуващ release APK, но ЛИПСВА ключът $jks!${NC}"
      echo -e "${RED}  НЕ правя нов ключ (с нов подпис ъпдейтът в магазина е невъзможен).${NC}"
      echo -e "${RED}  Върни ключа от резервно копие в keystores/ и пусни пак.${NC}"
      return 1
    fi
    pw="$(openssl rand -hex 20)"
    keytool -genkeypair -v -keystore "$jks" -alias "$app" -keyalg RSA -keysize 2048 \
      -validity 10000 -storepass "$pw" -keypass "$pw" -dname "$DNAME" >/dev/null 2>&1 \
      || { echo -e "${RED}✗ keytool не успя за $app${NC}"; return 1; }
    { echo "# Release ключ за $app — ПАЗИ ГО! Загуба = невъзможен ъпдейт в магазина."
      echo "keystore: $jks"
      echo "alias: $app"
      echo "storePassword: $pw"
      echo "keyPassword: $pw"
      echo "created: $(date)"; } > "$cred"
    echo -e "  ${YELLOW}${BOLD}⚠ НОВ ключ: $jks — ако апът вече е публикуван с друг подпис, СПРИ и върни стария ключ!${NC}"
  fi
  KS_PW="$(grep '^storePassword:' "$cred" | awk '{print $2}')"
  [ -n "$KS_PW" ] || { echo -e "${RED}✗ няма парола в $cred${NC}"; return 1; }
}

# ── защита на ъпдейтите: новият APK трябва да носи СЪЩИЯ подпис като предишния release ──
APKSIGNER="$(ls "${ANDROID_HOME:-C:/Android/Sdk}"/build-tools/*/apksigner.bat 2>/dev/null | sort -V | tail -1)"
cert_of() { [ -n "$APKSIGNER" ] || return 0; "$APKSIGNER" verify --print-certs "$1" 2>/dev/null | grep -m1 'SHA-256' | awk '{print $NF}'; }

declare -a OK=() FAIL=()
for app in "${NAMES[@]}"; do
  echo -e "\n${BOLD}${CYAN}━━━ $app ━━━${NC}"
  ensure_key "$app" || { FAIL+=("$app (ключ)"); continue; }

  # пълната подготовка (web билд, cap sync, версия, debug APK за двата магазина)
  if ! bash deploy-scripts/build-mobile-apps.sh "$app" </dev/null; then
    FAIL+=("$app (подготвителен билд)"); continue
  fi

  slug="$(store_slug "$app")"                         # магазинното име за файла (напр. Huntline-3D)
  for store in rustore huawei; do
    d="$store/$app"
    is_app "$d" || continue
    [ -d "$d/android" ] || { FAIL+=("$app-$store (няма android/)"); continue; }
    node deploy-scripts/inject-signing.mjs "$d/android/app/build.gradle" || { FAIL+=("$app-$store (инжекция)"); continue; }
    ( cd "$d/android" && \
      KCY_KS="$ROOT/keystores/${app}-release.jks" KCY_KS_PW="$KS_PW" KCY_KS_ALIAS="$app" \
      ./gradlew assembleRelease -q ) || { FAIL+=("$app-$store (assembleRelease)"); continue; }
    out="$d/android/app/build/outputs/apk/release/app-release.apk"
    if [ -f "$out" ]; then
      dest="apk/${slug}-${store}-release.apk"
      # Подписът на новия APK трябва да СЪВПАДА с предишния release (иначе магазинът отказва
      # ъпдейта). Търсим предишния по новото ИЛИ старото (по папка) име — за прехода.
      prev="$dest"; [ -f "$prev" ] || prev="apk/${app}-${store}-release.apk"
      if [ -f "$prev" ] && [ -n "$APKSIGNER" ]; then
        oldc="$(cert_of "$prev")"; newc="$(cert_of "$out")"
        if [ -n "$oldc" ] && [ -n "$newc" ] && [ "$oldc" != "$newc" ]; then
          echo -e "  ${RED}✗ $app-$store: подписът се РАЗМИНАВА с предишния release APK — ъпдейтът в магазина би бил отказан. Не презаписвам.${NC}"
          FAIL+=("$app-$store (сменен подпис!)"); continue
        fi
      fi
      cp "$out" "$dest"
      # Изчисти старото (по папка) име, ако е различно от новото — за да не остават дубли.
      [ "$slug" != "$app" ] && rm -f "apk/${app}-${store}-release.apk"
      echo -e "  ${GREEN}✓ ${dest}${NC}"
      OK+=("${slug}-${store}")
    else
      FAIL+=("$app-$store (няма изходен APK)")
    fi
  done
done

echo -e "\n${BOLD}${CYAN}━━━ Обобщение (release) ━━━${NC}"
echo -e "  ${GREEN}✓ успешни: ${#OK[@]}${NC}"
for o in "${OK[@]:-}"; do [ -n "$o" ] && echo -e "    ${GREEN}✓${NC} $o"; done
if [ "${#FAIL[@]}" -gt 0 ]; then
  echo -e "  ${RED}✗ провали: ${#FAIL[@]}${NC}"
  for f in "${FAIL[@]}"; do echo -e "    ${RED}✗${NC} $f"; done
fi
echo -e "\n  Подписаните APK-та са в: ${BOLD}apk/<Магазинно-Име>-<магазин>-release.apk${NC}"
echo -e "  Ключовете и паролите: ${BOLD}keystores/${NC} (влизат в резервните копия — НЕ ги губи)"
[ "${#FAIL[@]}" -eq 0 ]
