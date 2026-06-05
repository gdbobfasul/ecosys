#!/bin/bash
# Version: 1.0173
##############################################################################
# KCY — Инсталиране на тест робота (Playwright + Chromium) на сървъра.
#
# Роботът се пуска от админ страницата (/shared/robot.html) през kcy-diag.
# Този скрипт подготвя зависимостите:
#   1) npm install в private/robot  (сваля playwright)
#   2) npx playwright install --with-deps chromium  (браузър + системни libs)
#   3) папка за репортите: /var/www/html/last-errors/robot
#   4) рестарт на kcy-diag (за новите /robot/* ендпойнти)
#
# kcy-diag върви като root → пуска робота като root (затова --no-sandbox в кода).
# Внимание: Chromium яде RAM. На малък сървър пускай по едно обхождане.
#
# Употреба: sudo ./32-setup-robot.sh
##############################################################################
set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

PROJECT_DIR="/var/www/kcy-ecosystem"
ROBOT_DIR="$PROJECT_DIR/private/robot"
REPORTS_DIR="/var/www/html/last-errors/robot"

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0${NC}" && exit 1
[ ! -d "$ROBOT_DIR" ] && echo -e "${RED}✗ Няма $ROBOT_DIR — първо деплойни сорса (точка 2 или 5).${NC}" && exit 1
command -v node >/dev/null 2>&1 || { echo -e "${RED}✗ node липсва${NC}"; exit 1; }

echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Тест робот — инсталация${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

cd "$ROBOT_DIR"

echo -e "${GREEN}[1/4] npm install (playwright)...${NC}"
npm install --no-audit --no-fund 2>&1 | tail -4

echo -e "${GREEN}[2/4] Chromium + системни зависимости (може да отнеме минута)...${NC}"
# --with-deps дърпа нужните apt libs; браузърът отива в кеша на root (този, който пуска робота).
if npx --yes playwright install --with-deps chromium 2>&1 | tail -6; then
  echo -e "  ${GREEN}✓ Chromium готов${NC}"
else
  echo -e "  ${YELLOW}! playwright install върна грешка — провери изхода по-горе${NC}"
fi

echo -e "${GREEN}[3/4] Папки за репорти + робот логове${NC}"
mkdir -p "$REPORTS_DIR" "$REPORTS_DIR/../robot-logs"
chown -R root:www-data "$REPORTS_DIR" "$REPORTS_DIR/../robot-logs" 2>/dev/null || true
chmod -R 2775 "$REPORTS_DIR" "$REPORTS_DIR/../robot-logs" 2>/dev/null || true

echo -e "${GREEN}[4/4] Рестарт на kcy-diag (новите /robot/* ендпойнти)...${NC}"
if systemctl restart kcy-diag 2>/dev/null; then
  echo -e "  ${GREEN}✓ kcy-diag рестартиран${NC}"
else
  echo -e "  ${YELLOW}! kcy-diag не е рестартиран (провери услугата)${NC}"
fi

echo ""
echo -e "${GREEN}  Готово. Пусни робота от: /shared/robot.html (админ дропдаун → 🤖 Робот).${NC}"
echo -e "${CYAN}  Бележка: ако роботът не достига собствения публичен адрес (hairpin NAT),${NC}"
echo -e "${CYAN}  задай ROBOT_PROD_URL за услугата kcy-diag към работещ адрес.${NC}"
