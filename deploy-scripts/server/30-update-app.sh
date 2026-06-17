#!/bin/bash
# Version: 1.0206
##############################################################################
# KCY — Обнови ЕДНО приложение (самостоятелно):
#   • базата данни (схема/настройка)
#   • неговите админи/модератори от .env (попълват се ТУК при деплоя — НЕ в server.js)
#   • рестарт на услугата му (ако има)
#
# Всяко приложение е самостоятелно — пипа САМО своето. .env се чете оттам
# (промени в .env идват с опция 2).
#
# Употреба:  sudo 30-update-app.sh <hlb|wnb|fbp|portals|chat|eco3>
##############################################################################
set +e
GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; RED=$'\033[0;31m'; NC=$'\033[0m'

DIR="/var/www/kcy-ecosystem/deploy-scripts/server"
APP="$1"

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo${NC}" && exit 1

restart_one() {
  if systemctl restart "$1" 2>/dev/null; then
    echo -e "${GREEN}  ✓ $1 рестартиран${NC}"
  else
    echo -e "${YELLOW}  ! $1 не е рестартиран (услугата може да липсва — настрой я първо)${NC}"
  fi
}

# Попълва админи/модератори от .env за апове с локален admins.js (идемпотентно: създава
# липсващ / обновява паролата). Това е РАБОТА С БАЗАТА → НЕ е в server.js. $1=път, $2=service потребител.
fill_admins() {
  local app_dir="$1" svc_user="$2"
  if [ ! -f "$app_dir/admins.js" ]; then
    echo -e "${YELLOW}  ⚠ $app_dir/admins.js липсва — пропускам попълването (качи кода)${NC}"; return
  fi
  if ( cd "$app_dir" && sudo -u "$svc_user" node admins.js ); then
    echo -e "${GREEN}  ✓ админи/модератори попълнени/обновени от .env${NC}"
  else
    echo -e "${YELLOW}  ⚠ попълването на админи не мина — провери .env${NC}"
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
  fbp)
    # Find Best Price: PostgreSQL база + рестарт kcy-fbp (старта попълва FBP админите).
    bash "$DIR/16-setup-app-databases.sh" findbestprice
    ;;
  portals)
    echo -e "${CYAN}Portals — попълвам админи/модератори от .env (portal_users), после рестарт:${NC}"
    fill_admins /var/www/kcy-ecosystem/private/portals kcy-eco3
    restart_one kcy-portals
    ;;
  chat)
    echo -e "${CYAN}Chat — попълвам админи/модератори от .env (admin_users), после рестарт:${NC}"
    fill_admins /var/www/kcy-ecosystem/private/chat kcy-chat
    restart_one kcy-chat
    ;;
  eco3)
    # ECO-3: създава базата (PG/SQLite по ECO3_DB_TYPE) → попълва админи/модератори от .env → рестарт.
    bash "$DIR/20-setup-eco3-database.sh"
    ;;
  *)
    echo "Употреба: $0 <hlb|wnb|fbp|portals|chat|eco3>"
    exit 1
    ;;
esac
echo -e "${CYAN}Готово — обновено само приложение '${APP}'.${NC}"
