#!/bin/bash
# Version: 1.0215
##############################################################################
# KCY — „ТЕСТ-РОБОТ" за мобилните апове: пуска всеки апп в безглав Chromium
# (Playwright от private/bug-bot) и проверява дали СТАРТИРА/„играе" без грешки + скрийншот.
# Допълва test-mobile-apps.sh (статичните проверки).
# Употреба:  ./deploy-scripts/test-mobile-play.sh [rustore|huawei|път/до/апп]
##############################################################################
set +e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; NC=$'\033[0m'
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT" || exit 1
HELPER="$ROOT/deploy-scripts/_mobile-play-check.cjs"
PWDIR="$ROOT/private/bug-bot/node_modules/playwright"
TARGET="${1%/}"

if [ ! -d "$PWDIR" ]; then
  echo -e "${YELLOW}Playwright липсва в private/bug-bot. Инсталирай:${NC}"
  echo -e "  ${CYAN}(cd private/bug-bot && npm i -D playwright && npx playwright install chromium)${NC}"
  exit 1
fi

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

REPORTS="$ROOT/deploy-scripts/play-reports"; mkdir -p "$REPORTS"
echo ""
echo -e "${BOLD}${CYAN}═══ Тест-робот (безглав браузър) — ${#APPS[@]} апа ═══${NC}"
echo -e "  ${YELLOW}билдва (ако трябва) → preview сървър → зарежда в Chromium → лови грешки + скрийншот${NC}"
echo ""

PORT=4180; FAILS=0
kill_port() { powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort $1 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1; }

play_one() {
  local d="$1" rc up i sv shot
  echo -e "${BOLD}── $d${NC}"
  if [ ! -d "$d/dist" ]; then
    echo -e "  ${CYAN}→ npm run build…${NC}"
    ( cd "$d" && { [ -d node_modules ] || npm install >/dev/null 2>&1; } && npm run build >/dev/null 2>&1 )
  fi
  if [ ! -d "$d/dist" ]; then echo -e "  ${RED}✗ няма dist (билдът падна)${NC}"; FAILS=$((FAILS+1)); echo ""; return; fi
  PORT=$((PORT+1))
  ( cd "$d" && npx vite preview --port "$PORT" --strictPort >/dev/null 2>&1 ) &
  sv=$!
  up=0
  for i in $(seq 1 40); do curl -s "http://localhost:$PORT/" >/dev/null 2>&1 && { up=1; break; }; sleep 0.5; done
  if [ "$up" = 0 ]; then echo -e "  ${RED}✗ preview сървърът не вдигна на :$PORT${NC}"; FAILS=$((FAILS+1)); kill "$sv" 2>/dev/null; kill_port "$PORT"; echo ""; return; fi
  shot="$REPORTS/$(echo "$d" | tr '/' '_').png"
  node "$HELPER" "http://localhost:$PORT/" "$shot"
  rc=$?
  kill "$sv" 2>/dev/null; kill_port "$PORT"
  if [ "$rc" = 0 ]; then echo -e "  ${GREEN}✓ стартира чисто · скрийншот: ${shot#$ROOT/}${NC}"
  else echo -e "  ${RED}✗ грешки/не зарежда (виж горе)${NC}"; FAILS=$((FAILS+1)); fi
  echo ""
}

for d in "${APPS[@]}"; do play_one "$d"; done
echo -e "${BOLD}${CYAN}═══ Резултат: ${#APPS[@]} апа · провалени: ${FAILS} ═══${NC}"
echo -e "  Скрийншоти: ${CYAN}${REPORTS#$ROOT/}/${NC}"
[ "$FAILS" = 0 ] && exit 0 || exit 1
