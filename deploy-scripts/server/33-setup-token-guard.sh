#!/usr/bin/env bash
# Version: 1.0000
# 33-setup-token-guard.sh — денонощен Guard за токените на Pupikes (systemd kcy-token-guard).
#   node private/pupikes-metamask-coin-creator/bot.js guard all  — цикъл на 15 мин: проверява публикуваните токени и
#   предприема САМО защитни действия (block / freeze / pause), никога необратими. Известия в личния Telegram чат.
#
# СИГУРНОСТ: сървърът НИКОГА не получава сийда/трезора. Guard подписва с ОТДЕЛЕН ОГРАНИЧЕН ключ „ОПЕРАТОР“
#   (TOKEN_GUARD_OPERATOR_KEY в private/configs/.env — самостоятелен секрет, роля само block/freeze/pause в договора).
#   Ако ключът липсва → услугата пише в дневника „няма operator ключ — само чета/известявам“ и НЕ действа (не пада).
#
#   sudo $0                → инсталира/обновява unit-а + (пре)стартира
#   sudo $0 --status       → само статус
#   sudo $0 --stop         → спира и disable-ва услугата
#   sudo $0 --restart      → рестарт
set -e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
SVC="kcy-token-guard"
PROJECT_DIR="/var/www/kcy-ecosystem"; PRIVATE_DIR="$PROJECT_DIR/private"
APP_DIR="$PRIVATE_DIR/pupikes-metamask-coin-creator"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
LOG_DIR="/var/log/kcy-ecosystem"; SVC_USER="kcy-eco3"; SVC_GROUP="kcy"
ACTION="install"; GROLE="primary"
while [ $# -gt 0 ]; do case "$1" in --status) ACTION="status" ;; --stop) ACTION="stop" ;; --restart) ACTION="restart" ;; --role) GROLE="$2"; shift ;; esac; shift; done
case "$GROLE" in primary|backup) ;; *) GROLE="primary" ;; esac
GTG="1"; [ "$GROLE" = "backup" ] && GTG="0"   # само основният (primary) чете Telegram команди; резервният е чист failover
[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1

read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "\r" | xargs; }
have_operator() { local k; k="$(read_env TOKEN_GUARD_OPERATOR_KEY)"; case "$k" in 0x*) [ ${#k} -ge 66 ] && return 0 ;; esac; return 1; }

show_status() {
  echo -e "\n${CYAN}── Статус: ${SVC} ──${NC}"
  echo -e "  systemctl: $(systemctl is-active ${SVC}.service 2>/dev/null || echo n/a) / $(systemctl is-enabled ${SVC}.service 2>/dev/null || echo n/a)"
  if have_operator; then echo -e "  Операторски ключ: ${GREEN}има${NC} (TOKEN_GUARD_OPERATOR_KEY) — Guard ДЕЙСТВА (block/freeze/pause)"
  else echo -e "  Операторски ключ: ${YELLOW}няма${NC} — Guard само чете/известява (сложи TOKEN_GUARD_OPERATOR_KEY в ${GLOBAL_ENV})"; fi
  echo -e "  Роля: ${GROLE} ($([ "$GTG" = "1" ] && echo "основен · чете Telegram команди" || echo "резервен · failover, без Telegram"))"
  echo -e "  Дневник: journalctl -u ${SVC} -n 40   ·   wallet/guard.log"
  journalctl -u ${SVC} -n 6 --no-pager 2>/dev/null | sed 's/^/    /' || true
}

case "$ACTION" in
  status) show_status; exit 0 ;;
  stop) systemctl stop ${SVC}.service 2>/dev/null || true; systemctl disable ${SVC}.service 2>/dev/null || true; echo -e "  ${GREEN}✓ ${SVC} спрян и disable-нат${NC}"; exit 0 ;;
  restart) systemctl restart ${SVC}.service 2>/dev/null || true; sleep 2; show_status; exit 0 ;;
esac

# ── инсталация ──
echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup услуга: ${SVC}  (денонощен Guard за токените — само block/freeze/pause)${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

[ -f "$APP_DIR/bot.js" ] || { echo -e "${RED}✗ $APP_DIR/bot.js липсва — качи проекта първо (опция 2/4).${NC}"; exit 1; }
if ! id "$SVC_USER" &>/dev/null; then echo -e "${YELLOW}  ! Потребител $SVC_USER липсва → root${NC}"; SVC_USER="root"; fi
getent group "$SVC_GROUP" >/dev/null || SVC_GROUP="$SVC_USER"
mkdir -p "$LOG_DIR" "$APP_DIR/wallet"
# wallet/ на сървъра е САМО за дневника/pid на Guard — сийдът НИКОГА не се качва тук (изключен от деплоя).
chown -R "$SVC_USER":"$SVC_GROUP" "$APP_DIR/wallet" 2>/dev/null || true; chmod 750 "$APP_DIR/wallet" 2>/dev/null || true

if have_operator; then echo -e "  ${GREEN}✓ Операторски ключ намерен (TOKEN_GUARD_OPERATOR_KEY) — Guard ще действа защитно.${NC}"
else echo -e "  ${YELLOW}! Няма TOKEN_GUARD_OPERATOR_KEY в ${GLOBAL_ENV} — Guard ще стартира в режим „само чета/известявам“.${NC}"
     echo -e "  ${YELLOW}  Добави го (самостоятелен секрет; НЕ е сийдът): nano ${GLOBAL_ENV}  →  TOKEN_GUARD_OPERATOR_KEY=0x...${NC}"; fi

ENVFILE_LINE=""; [ -f "$GLOBAL_ENV" ] && ENVFILE_LINE="EnvironmentFile=-${GLOBAL_ENV}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY Pupikes Token Guard (24/7 protective watch: block/freeze/pause only; operator key, never the seed)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
${ENVFILE_LINE}
Environment=NODE_ENV=production
Environment=BOT_GUARD_KEY=operator
Environment=GUARD_ROLE=${GROLE}
Environment=GUARD_TG=${GTG}
ExecStart=/usr/bin/node bot.js guard all
Restart=always
RestartSec=15
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload; systemctl enable ${SVC}.service 2>/dev/null || true; systemctl restart ${SVC}.service 2>/dev/null || true
sleep 2
if systemctl is-active --quiet ${SVC}.service; then echo -e "  ${GREEN}✓ ${SVC} работи (Guard all, цикъл 15 мин)${NC}"; else echo -e "  ${RED}✗ ${SVC} не тръгна: journalctl -u ${SVC} -n 30${NC}"; journalctl -u ${SVC} -n 15 --no-pager 2>/dev/null || true; fi
show_status
echo -e "\n${GREEN}  Готово: ${SVC}. Статус: sudo $0 --status  ·  спиране: sudo $0 --stop${NC}"
echo -e "  ${CYAN}Guard действа само защитно (block/freeze/pause). Одобрения/теглене/unpause остават само от трезора (локално).${NC}"
