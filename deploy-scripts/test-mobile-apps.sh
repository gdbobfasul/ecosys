#!/bin/bash
# Version: 1.0215
##############################################################################
# KCY — Тест за КОНСИСТЕНТНОСТ на мобилните апове (/rustore, /huawei).
# Проверява всеки апп БЕЗ да го пуска на устройство:
#   1) структура (package.json, capacitor.config.json, index.html, src/, store/)
#   2) node --check на всеки src файл (синтаксис)
#   3) import-евристика: ползва ли Phaser./THREE. без съответния import
#      (точно този клас бъг чупеше titans-fight при boot — build/node --check НЕ го хващат)
#   4) изолация: няма ли препратки извън собствената папка (../../.., /private, /public, portals, /api)
#   5) външни/платени услуги: http(s) fetch, firebase, analytics, billing/IAP (предупреждение → вети ръчно)
#   6) (по избор --build) npm run build — доказва, че бундълът се сглобява
#
# Употреба:
#   ./deploy-scripts/test-mobile-apps.sh                       # бързи проверки (1-5) на всички
#   ./deploy-scripts/test-mobile-apps.sh --build               # + web билд на всеки (бавно)
#   ./deploy-scripts/test-mobile-apps.sh rustore/plane-shooter # само един апп
##############################################################################
set +e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; NC=$'\033[0m'
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT" || exit 1

DO_BUILD=0; TARGET=""
for a in "$@"; do case "$a" in --build) DO_BUILD=1;; *) TARGET="${a%/}";; esac; done

is_app() { [ -f "$1/package.json" ] && [ -f "$1/capacitor.config.json" ]; }

declare -a APPS=()
if [ -n "$TARGET" ]; then
  if is_app "$TARGET"; then APPS+=("$TARGET")
  elif [ -d "$TARGET" ]; then for d in "$TARGET"/*/; do d="${d%/}"; is_app "$d" && APPS+=("$d"); done
  else echo -e "${RED}Не е апп/папка: $TARGET${NC}"; exit 1; fi
else
  for s in rustore huawei; do [ -d "$s" ] || continue; for d in "$s"/*/; do d="${d%/}"; is_app "$d" && APPS+=("$d"); done; done
fi
[ "${#APPS[@]}" -eq 0 ] && { echo -e "${RED}Няма апове в '${TARGET:-rustore/huawei}'.${NC}"; exit 1; }

echo ""
echo -e "${BOLD}${CYAN}═══ Тест за консистентност — ${#APPS[@]} апа ═══${NC}"
[ "$DO_BUILD" = 1 ] && echo -e "  ${YELLOW}(с --build → ще пуска и npm run build на всеки)${NC}"
echo ""

FAILS=0; WARNS=0
check_app() {
  local d="$1" fail=0 warn=0 f iso net
  echo -e "${BOLD}── $d${NC}"

  # 1) структура
  for req in package.json capacitor.config.json index.html src; do
    [ -e "$d/$req" ] || { echo -e "  ${RED}✗ липсва $req${NC}"; fail=1; }
  done
  [ -d "$d/store" ] || { echo -e "  ${YELLOW}! няма store/ (документи за магазина)${NC}"; warn=1; }

  # 2) node --check
  while IFS= read -r f; do
    node --check "$f" 2>/dev/null || { echo -e "  ${RED}✗ синтаксис: $f${NC}"; fail=1; }
  done < <(find "$d/src" \( -name '*.js' -o -name '*.mjs' \) 2>/dev/null)

  # 3) import-евристика (Phaser./THREE. без import)
  while IFS= read -r f; do
    if grep -qE "\bPhaser\." "$f" && ! grep -qE "import .*'phaser'|import Phaser" "$f"; then echo -e "  ${RED}✗ Phaser. без import: $f${NC}"; fail=1; fi
    if grep -qE "\bTHREE\." "$f" && ! grep -qE "as THREE|from 'three'" "$f"; then echo -e "  ${RED}✗ THREE. без import: $f${NC}"; fail=1; fi
  done < <(find "$d/src" \( -name '*.js' -o -name '*.mjs' \) 2>/dev/null)

  # 4) изолация — препратки извън собствената папка
  iso=$(grep -rnoE "\.\./\.\./\.\.|/private/|/public/|/api/portals|\bportals\b" "$d/src" 2>/dev/null | grep -viE "store|comment|//")
  [ -n "$iso" ] && { echo -e "  ${RED}✗ изолация — препратки навън:${NC}"; echo "$iso" | sed 's/^/      /'; fail=1; }

  # 5) външни/платени услуги (предупреждение → вети дали е БЕЗПЛАТНО)
  net=$(grep -rnoE "firebase|googleapis|google-analytics|gtag\(|billing|inAppPurchase|\.purchase\(|fetch\(['\"]https?://|https?://api\." "$d/src" 2>/dev/null | grep -viE "w3\.org|example\.com")
  [ -n "$net" ] && { echo -e "  ${YELLOW}! външни/платени индикатори (вети дали са БЕЗПЛАТНИ):${NC}"; echo "$net" | sed 's/^/      /'; warn=1; }

  # 6) build (по избор)
  if [ "$DO_BUILD" = 1 ]; then
    ( cd "$d" || exit 1; [ -d node_modules ] || npm install >/dev/null 2>&1; npm run build >/dev/null 2>&1 ) \
      && echo -e "  ${GREEN}✓ build ок${NC}" || { echo -e "  ${RED}✗ build падна${NC}"; fail=1; }
  fi

  if [ "$fail" = 0 ]; then echo -e "  ${GREEN}✓ преминава${NC}"; else FAILS=$((FAILS+1)); fi
  [ "$warn" = 1 ] && WARNS=$((WARNS+1))
  echo ""
}

for d in "${APPS[@]}"; do check_app "$d"; done

echo -e "${BOLD}${CYAN}═══ Резултат ═══${NC}"
echo -e "  апове: ${#APPS[@]}  ·  ${RED}провалени: ${FAILS}${NC}  ·  ${YELLOW}с предупреждения: ${WARNS}${NC}"
if [ "$FAILS" = 0 ]; then echo -e "  ${GREEN}✓ всички консистентни${NC}"; exit 0; else echo -e "  ${RED}✗ има провали — виж по-горе${NC}"; exit 1; fi
