#!/bin/bash
# Version: 1.0218
##############################################################################
# KCY — СВЪРЗВАНЕ (линк) на Selflearning Friend робот към ТОЗИ сървър.
#
# Прави ПРОВЕРКИ „що за сървър ни дадоха" ПРЕДИ деплой, налага правилото
# „1 сървър = МАКСИМУМ 1 робот", по избор вдига relay-а и накрая показва точните
# данни за връзка (URL + token), които се въвеждат в роботчето.
#
# ПРАВИЛО (важно):
#   • Към 1 сървър се връзва МАКСИМУМ 1 Selflearning робот (1 token namespace).
#   • Десктоп + телефон на СЪЩИЯ робот = СЪЩИЯ token: десктопът се обучава (учащ),
#     телефонът само ПРЕДАВА знанието си (не учи). Това е един и същ робот.
#   • Различен робот (напр. при продажба) → само с --transfer (трие стария).
#
# Употреба (обикновено през меню опция 39):
#   sudo ./23-link-selflearning-robot.sh              # САМО проверки + verdict + връзка-инфо
#   sudo ./23-link-selflearning-robot.sh --deploy     # проверки → (ако GO) вдига relay-а
#   sudo ./23-link-selflearning-robot.sh --deploy --transfer  # смяна на робот (ТРИЕ стария!)
##############################################################################

set +e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; GRAY=$'\033[0;90m'; NC=$'\033[0m'

APP_NAME="selflearning-server"
SVC="kcy-selflearning"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
APP_DIR="$PRIVATE_DIR/$APP_NAME"
# Базата е ИЗВЪН проекта (/var/lib) → НИКОЙ деплой не я трие. Трие се САМО оттук с --transfer.
DATA_DIR="/var/lib/kcy-selflearning/data"
DB_FILE="$DATA_DIR/selflearning.db"
TOKEN_FILE="$DATA_DIR/owner-token"   # token-ът се пази тук → СТАБИЛЕН (нов само при --transfer)
PORT_DEFAULT="3013"
SETUP_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/22-setup-selflearning-server.sh"
[ -f "$PRIVATE_DIR/configs/domains.conf" ] && . "$PRIVATE_DIR/configs/domains.conf" 2>/dev/null
[ -n "${APP_selflearning_PORT:-}" ] && PORT_DEFAULT="$APP_selflearning_PORT"
# Каноничен домейн на робота (от domains.conf). Без nginx-скрейп (хващаше чужд vhost).
SELF_DOMAIN="${APP_selflearning_PUBLIC:-selflearning.bot.nu}"

DO_DEPLOY=false; DO_TRANSFER=false
for a in "$@"; do case "$a" in
  --deploy)   DO_DEPLOY=true ;;
  --transfer) DO_TRANSFER=true ;;
esac; done

[ "$EUID" -ne 0 ] && { echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}"; exit 1; }

read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }
PORT=$(read_env "SELFLEARNING_PORT"); PORT="${PORT:-$PORT_DEFAULT}"

##############################################################################
# Пълно описание (показва се при СТАРТА на процеса — по-подробно от менюто)
##############################################################################
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   Свързване на Selflearning Friend робот към ТОЗИ сървър          ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Какво прави роботът със сървъра:${NC}"
echo -e "  Сървърът е ЛЕК relay (kcy-selflearning, node :$PORT) — държи опашката за"
echo -e "  режим „Слушай\" + knowledge snapshot, namespace-нати по token. ${BOLD}Знанието на"
echo -e "  робота ВИНАГИ живее ЛОКАЛНО (на телефона/компютъра)${NC}; сървърът е само за sync и"
echo -e "  за да мога аз да бутам уроци. БЕЗ контакти, БЕЗ крипто, БЕЗ tracking."
echo ""
echo -e "${BOLD}${YELLOW}ПРАВИЛО: 1 сървър = МАКСИМУМ 1 робот.${NC}"
echo -e "  ${GRAY}• Десктоп + телефон на СЪЩИЯ робот ползват СЪЩИЯ token (десктопът учи,${NC}"
echo -e "  ${GRAY}  телефонът само предава знанието си) — това е един робот.${NC}"
echo -e "  ${GRAY}• Различен робот (продажба/прехвърляне) → само с --transfer (трие стария).${NC}"
echo ""
echo -e "${BOLD}Най-важни параметри на сървър-машината, която става за връзка:${NC}"
echo -e "  ${GRAY}• Linux (Debian/Ubuntu предпочитан), 64-bit; root/sudo достъп.${NC}"
echo -e "  ${GRAY}• Node.js ≥ 18 (за better-sqlite3 prebuilt) + npm.${NC}"
echo -e "  ${GRAY}• RAM: ≥ 512 MB свободни (релеят е лек; ≥1 GB е комфортно).${NC}"
echo -e "  ${GRAY}• Диск: ≥ 1 GB свободни за код + snapshot данни.${NC}"
echo -e "  ${GRAY}• Публичен достъп: домейн + nginx + SSL, за да го стига телефонът зад NAT${NC}"
echo -e "  ${GRAY}  (порт 443 → /api/selflearning/...). Без домейн работи само в локална мрежа.${NC}"
echo -e "  ${GRAY}• Свободен порт ${PORT} (или вече нашата услуга на него).${NC}"
echo ""

##############################################################################
# ПРОВЕРКИ — „що за сървър ни дадоха"
##############################################################################
echo -e "${BOLD}${CYAN}━━━ Проверки на сървъра ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
GO=true        # пада на false при блокиращ проблем
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
bad()  { echo -e "  ${RED}✗${NC} $1"; GO=false; }

# OS / архитектура
OS_PRETTY=$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-$(uname -s)}")
ARCH=$(uname -m)
echo -e "  ${GRAY}ОС: ${OS_PRETTY} · арх: ${ARCH} · ядро: $(uname -r)${NC}"
case "$ARCH" in x86_64|amd64|aarch64|arm64) ok "Архитектура поддържана (${ARCH})";; *) warn "Необичайна архитектура (${ARCH}) — better-sqlite3 може да иска компилация";; esac

# RAM
MEM_TOTAL=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
MEM_FREE=$(free -m 2>/dev/null | awk '/^Mem:/{print $7? $7:$4}')
if [ -n "$MEM_TOTAL" ]; then
  echo -e "  ${GRAY}RAM: общо ${MEM_TOTAL} MB · свободни ~${MEM_FREE:-?} MB${NC}"
  if [ "${MEM_FREE:-0}" -lt 256 ]; then warn "Малко свободна памет (${MEM_FREE} MB) — релеят е лек, но внимавай"
  else ok "Достатъчно памет"; fi
else warn "Не разчетох паметта (free липсва)"; fi

# Диск
DISK_AVAIL_MB=$(df -Pm "$PRIVATE_DIR" 2>/dev/null | awk 'NR==2{print $4}')
[ -z "$DISK_AVAIL_MB" ] && DISK_AVAIL_MB=$(df -Pm / 2>/dev/null | awk 'NR==2{print $4}')
if [ -n "$DISK_AVAIL_MB" ]; then
  echo -e "  ${GRAY}Диск свободен: ${DISK_AVAIL_MB} MB${NC}"
  if [ "$DISK_AVAIL_MB" -lt 1024 ]; then warn "Под 1 GB свободни — следи мястото"; else ok "Достатъчно диск"; fi
else warn "Не разчетох диска"; fi

# CPU
echo -e "  ${GRAY}CPU ядра: $(nproc 2>/dev/null || echo '?')${NC}"

# Node
if command -v node >/dev/null 2>&1; then
  NODE_V=$(node -v 2>/dev/null); NODE_MAJ=$(echo "$NODE_V" | sed -E 's/^v?([0-9]+).*/\1/')
  if [ "${NODE_MAJ:-0}" -ge 18 ]; then ok "Node ${NODE_V} (≥18)"; else warn "Node ${NODE_V} е под 18 — better-sqlite3 може да не тръгне"; fi
else bad "Node.js липсва — без него релеят не работи (инсталирай Node ≥18)"; fi

# Проект качен?
if [ -f "$APP_DIR/server.js" ]; then ok "Проектът е качен ($APP_DIR/server.js)"
else bad "Липсва $APP_DIR/server.js — качи проекта първо (опция 2/4), после линквай"; fi

# better-sqlite3 наличен?
if [ -d "$APP_DIR/node_modules/better-sqlite3" ]; then ok "better-sqlite3 е инсталиран"
else warn "better-sqlite3 липсва — деплоят/опция 2 трябва да пусне npm install в $APP_DIR"; fi

# Порт свободен / наша услуга?
if ss -ltnp 2>/dev/null | grep -q ":${PORT} " ; then
  if systemctl is-active --quiet ${SVC}.service 2>/dev/null; then ok "Порт ${PORT} се ползва от нашата услуга ${SVC}"
  else warn "Порт ${PORT} е зает от ДРУГ процес — смени SELFLEARNING_PORT в .env или освободи порта"; fi
else ok "Порт ${PORT} е свободен"; fi

# nginx + публичен маршрут (за достъп от телефона)
if command -v nginx >/dev/null 2>&1; then
  if nginx -T 2>/dev/null | grep -q 'kcy-apps/selflearning'; then ok "nginx маршрутът /api/selflearning/ е активен (публичен достъп)"
  else warn "nginx маршрутът не е активен още — пусни ВЕДНЪЖ опция 2 (иначе телефонът няма да стига сървъра)"; fi
else warn "nginx липсва — без него няма публичен HTTPS достъп за телефона"; fi

# Домейнът е каноничен (SELF_DOMAIN от domains.conf) — НЕ скрейпваме nginx (хващаше чужд vhost).

# Health (ако услугата върви)
if command -v curl >/dev/null 2>&1; then
  H=$(curl -s -m 4 "http://127.0.0.1:${PORT}/api/selflearning/health" 2>/dev/null)
  [ -n "$H" ] && echo -e "  ${GRAY}health(localhost:${PORT}): ${H}${NC}"
fi

##############################################################################
# 1 СЪРВЪР = 1 РОБОТ — има ли вече вързан робот?
##############################################################################
echo ""
echo -e "${BOLD}${CYAN}━━━ Правило „1 сървър = 1 робот\" ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
ROBOTS="0"
if [ -f "$DB_FILE" ] && [ -d "$APP_DIR/node_modules/better-sqlite3" ]; then
  ROBOTS=$(cd "$APP_DIR" && SELFLEARNING_DATA_DIR="$DATA_DIR" node -e '
    try {
      const Database=require("better-sqlite3");
      const path=require("path"), fs=require("fs");
      const p=path.join(process.env.SELFLEARNING_DATA_DIR,"selflearning.db");
      if(!fs.existsSync(p)){console.log(0);process.exit(0);}
      const db=new Database(p,{readonly:true});
      const r=db.prepare("SELECT COUNT(*) c FROM (SELECT token FROM snapshot UNION SELECT token FROM queue)").get();
      console.log(r&&r.c?r.c:0);
    } catch(e){ console.log("ERR"); }
  ' 2>/dev/null)
elif [ -f "$DB_FILE" ]; then
  ROBOTS="?"   # има база, но не можем да преброим без better-sqlite3
fi

if [ "$ROBOTS" = "0" ]; then
  ok "Няма вързан робот — сървърът е свободен за 1 нов робот."
elif [ "$ROBOTS" = "ERR" ] || [ "$ROBOTS" = "?" ]; then
  warn "Има данни за Selflearning, но не можах да преброя роботите (липсва better-sqlite3). Приеми, че МОЖЕ да има вързан робот."
  if [ "$DO_DEPLOY" = true ] && [ "$DO_TRANSFER" != true ]; then warn "Деплоят НЕ трие данни — стар робот (ако има) остава. За смяна ползвай --transfer."; fi
else
  warn "Вече има ВЪРЗАН робот (${ROBOTS} token namespace(s) с данни на този сървър)."
  echo -e "    ${GRAY}• Ако това е СЪЩИЯ робот (друга инстанция — десктоп/телефон): ползвай СЪЩИЯ token.${NC}"
  echo -e "    ${GRAY}• Ако линкваш ДРУГ робот (продажба): пусни с --transfer, за да изтрия стария.${NC}"
  if [ "$DO_TRANSFER" = true ]; then
    echo ""
    echo -e "  ${RED}${BOLD}--transfer: ще ИЗТРИЯ знанието на стария робот от сървъра (необратимо).${NC}"
    read -r -p "  Сигурен ли си? Напиши точно TRANSFER: " CONF
    if [ "$CONF" = "TRANSFER" ]; then
      systemctl stop ${SVC}.service 2>/dev/null
      rm -f "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm" "$TOKEN_FILE"
      ok "Старите данни + token са изтрити — сървърът е свободен за новия робот (нов token)."
      ROBOTS="0"
    else
      echo -e "  ${YELLOW}Отказан --transfer. Старият робот остава.${NC}"
    fi
  fi
fi

##############################################################################
# VERDICT
##############################################################################
echo ""
echo -e "${BOLD}${CYAN}━━━ Заключение ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$GO" = true ]; then
  echo -e "  ${GREEN}${BOLD}GO — сървърът става за свързване на робот.${NC}"
else
  echo -e "  ${RED}${BOLD}NO-GO — има блокиращ проблем (виж ✗ по-горе). Поправи и пусни пак.${NC}"
fi

##############################################################################
# ДЕПЛОЙ (по избор)
##############################################################################
if [ "$DO_DEPLOY" = true ]; then
  if [ "$GO" != true ]; then
    echo -e "\n  ${RED}Деплоят е спрян — сървърът е NO-GO.${NC}"
    exit 2
  fi
  echo ""
  echo -e "${BOLD}${CYAN}━━━ Деплой на relay-а (22-setup-selflearning-server.sh) ━━━━━━━━━${NC}"
  if [ -x "$SETUP_SCRIPT" ] || [ -f "$SETUP_SCRIPT" ]; then
    bash "$SETUP_SCRIPT"
    DRC=$?
    [ "$DRC" -ne 0 ] && { echo -e "  ${RED}✗ Setup-ът върна грешка (${DRC}).${NC}"; exit "$DRC"; }
  else
    echo -e "  ${RED}✗ Не намерих $SETUP_SCRIPT — пусни ръчно опция 38.${NC}"; exit 3
  fi
fi

##############################################################################
# ВРЪЗКА-ИНФО — какво да въведеш в роботчето
##############################################################################
# Token — СТАБИЛЕН: чете се от файл. Нов се генерира САМО ако липсва (т.е. първи път
# или след --transfer, който го трие). Ъпдейт на домейн/каквото и да е НЕ сменя token-а.
TOKEN=""
[ -f "$TOKEN_FILE" ] && TOKEN="$(tr -d ' \r\n' < "$TOKEN_FILE" 2>/dev/null)"
TOKEN_IS_NEW=0
if [ -z "$TOKEN" ]; then
  TOKEN=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
  mkdir -p "$DATA_DIR"
  printf '%s\n' "$TOKEN" > "$TOKEN_FILE" 2>/dev/null && chmod 600 "$TOKEN_FILE" 2>/dev/null
  TOKEN_IS_NEW=1
fi
BASE="https://${SELF_DOMAIN}/api/selflearning"
echo ""
echo -e "${BOLD}${YELLOW}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  КАК ДА СВЪРЖЕШ РОБОТЧЕТО (лесно — само 2 неща):${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════════════════${NC}"
echo -e "  В апа отвори:  ${CYAN}Настройки → „Източници на знание\" → 🔗 Свържи към сървър${NC}"
echo -e "  и въведи САМО тези две полета:"
echo ""
echo -e "    ${BOLD}1) Домейн:${NC}  ${GREEN}${SELF_DOMAIN}${NC}   ${GRAY}(само домейна — без https://, без път)${NC}"
echo -e "    ${BOLD}2) Token:${NC}   ${GREEN}${TOKEN}${NC}"
if [ "$TOKEN_IS_NEW" = 1 ]; then
  echo -e "       ${GRAY}(нов token — пази го; СЪЩИЯТ върви за десктоп И телефон на ЕДИН робот)${NC}"
else
  echo -e "       ${GRAY}(СЪЩИЯТ token като предишния път — стабилен е; сменя се само при --transfer)${NC}"
fi
echo ""
echo -e "  ${BOLD}Натискаш „Запази връзката\" — това е всичко.${NC}"
echo -e "  Апът сам сглобява пълните адреси (не ги пишеш ти):"
echo -e "    ${GRAY}• sync:     ${BASE}/sync/<token>${NC}"
echo -e "    ${GRAY}• слушай:   ${BASE}/listen/<token>${NC}"
echo -e "    ${GRAY}• проверка: ${BASE}/health${NC}"
echo ""
echo -e "  ${GRAY}Базата на робота е в /var/lib/kcy-selflearning — НИКОЙ деплой не я трие.${NC}"
echo -e "  ${GRAY}Изтрива се САМО оттук с --transfer (ресет). Десктопът учи; телефонът само предава.${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Ако ${SELF_DOMAIN} още не отваря: насочи DNS (A запис) към сървъра и пусни${NC}"
echo -e "  ${YELLOW}опция 33 (домейни + SSL) — domains.conf вече знае за ${SELF_DOMAIN}.${NC}"

exit 0
