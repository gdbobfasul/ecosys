#!/bin/bash
# Version: 1.0171
##############################################################################
# KCY — Обнови ЕДНО приложение (самостоятелно):
#   • базата данни (схема/настройка)
#   • неговите админи/модератори от .env (само за това приложение — при старта си)
#   • рестарт на услугата му (ако има)
#
# Всяко приложение е самостоятелно — пипа САМО своето. .env се чете оттам
# (промени в .env идват с опция 2).
#
# Употреба:  sudo 30-update-app.sh <hlb|wnb|portals|chat|eco3>
##############################################################################
set +e
GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; RED=$'\033[0;31m'; NC=$'\033[0m'

DIR="/var/www/kcy-ecosystem/deploy-scripts/server"
APP="$1"

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo${NC}" && exit 1

restart_one() {
  if systemctl restart "$1" 2>/dev/null; then
    echo -e "${GREEN}  ✓ $1 рестартиран (при старта си обновява схемата + своите админи/модератори от .env)${NC}"
  else
    echo -e "${YELLOW}  ! $1 не е рестартиран (услугата може да липсва — настрой я първо)${NC}"
  fi
}

case "$APP" in
  hlb)
    # House-Look-Book: PostgreSQL база + рестарт kcy-hlb (старта попълва HLB админите).
    bash "$DIR/16-setup-app-databases.sh" houselookbook
    ;;
  wnb)
    # WhereNoBiz: PostgreSQL база + рестарт kcy-wnb (старта попълва WNB админите).
    bash "$DIR/17-setup-wherenobiz-database.sh"
    ;;
  portals)
    echo -e "${CYAN}Portals — рестарт (SQLite схемата + админите се попълват при старта):${NC}"
    restart_one kcy-portals
    ;;
  chat)
    echo -e "${CYAN}Chat — рестарт (схемата + админите се попълват при старта):${NC}"
    restart_one kcy-chat
    ;;
  eco3)
    echo -e "${CYAN}ECO-3 — рестарт (схемата се прилага при старта; админ = portals потребител, без попълване):${NC}"
    restart_one kcy-eco3
    ;;
  *)
    echo "Употреба: $0 <hlb|wnb|portals|chat|eco3>"
    exit 1
    ;;
esac
echo -e "${CYAN}Готово — обновено само приложение '${APP}'.${NC}"
