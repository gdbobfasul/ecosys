#!/bin/bash
# Version: 1.0177
##############################################################################
# KCY — Отделните приложни домейни + SSL (чете private/configs/domains.conf).
#
# Главният домейн (take.offbitch.com) + неговият nginx/SSL се правят от
# 05-server-install (опция 4/2). ТУК са САМО допълнителните домейни:
#   find.jwork.ru → wnb · look.myhousesetup.com → hlb · kaji/gofor → chat
# Всеки показва САМО своето приложение (другите пътища → 404) + по 1 SSL.
#
# НЕ пипа главния nginx конфиг и НЕ инсталира node/npm (за да не конфликтва).
# Usage: sudo ./08-setup-domain.sh
##############################################################################
set -u
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

echo -e "${CYAN}========================================"
echo "  KCY — Приложни домейни + SSL"
echo -e "========================================${NC}"

[ "$(id -u)" -eq 0 ] || { echo -e "${RED}Пусни като root (sudo).${NC}"; exit 1; }

PROJECT_DIR="/var/www/kcy-ecosystem"
DOMAINS_CONF="$PROJECT_DIR/private/configs/domains.conf"
[ -f "$DOMAINS_CONF" ] || { echo -e "${RED}Липсва $DOMAINS_CONF — пусни деплой (опция 4) първо.${NC}"; exit 1; }
. "$DOMAINS_CONF"
EMAIL="${SSL_EMAIL:-admin@${MAIN_DOMAIN:-localhost}}"

if [ -z "${APP_DOMAIN_MAP:-}" ]; then
    echo -e "${YELLOW}Няма APP_DOMAIN_MAP в конфига — нищо за правене.${NC}"; exit 0
fi

echo -e "  Главен домейн (от 05): ${GREEN}${MAIN_DOMAIN}${NC}"
echo -e "  Имейл за Let's Encrypt: ${GREEN}${EMAIL}${NC}"
read -p "  Enter за този имейл, или нов: " NE
[ -n "$NE" ] && EMAIL="$NE"

# certbot + nginx plugin (БЕЗ node/npm — те конфликтват с NodeSource nodejs)
if ! command -v certbot >/dev/null 2>&1; then
    echo -e "${CYAN}Инсталирам certbot...${NC}"
    apt-get update -qq && apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || true
fi

# ── Генерирай nginx блоковете за приложните домейни (отделен файл, НЕ главния конфиг) ──
echo -e "${CYAN}Генерирам nginx блокове...${NC}"
APP_CONF="/etc/nginx/sites-available/kcy-app-domains.conf"
: > "$APP_CONF"
printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
    [ -z "$dom" ] && continue
    DIR=$(eval "echo \${APP_${key}_DIR}")
    PORT=$(eval "echo \${APP_${key}_PORT}")
    API=$(eval "echo \${APP_${key}_API}")
    if [ -z "$DIR" ] || [ -z "$PORT" ] || [ -z "$API" ]; then
        echo -e "  ${YELLOW}! непознат ключ '$key' за $dom — пропускам${NC}"; continue
    fi
    SERVE="${DIR%public/}"            # chat: /chat/public/ → /chat/ ; wnb: /wherenobiz/
    FS=$(eval "echo \${APP_${key}_FS}")   # ДИСКОВАТА папка (House-Look-Book, WhereNoBiz, chat/public…)
    [ -z "$FS" ] && FS="${DIR#/}"         # резерва: URL пътят без водещ /
    ROOTDIR="/var/www/html/${FS%/}"       # реалната папка на диска
    # ВСИЧКИ апове се сервират на КОРЕНА (чист URL, без redirect). Чатът (вложен в
    # /public/ + абсолютни /chat/ линкове) получава доп. локации: socket.io + /chat/.
    case "$DIR" in */public/) NESTED=1 ;; *) NESTED=0 ;; esac
    if [ "$NESTED" = "0" ]; then
        cat >> "$APP_CONF" <<APPEOF
server {
    listen 80;
    server_name $dom;
    root $ROOTDIR;
    index index.html;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; }
    location ^~ $API { proxy_pass http://127.0.0.1:$PORT; proxy_http_version 1.1; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; proxy_read_timeout 86400; }
    location ^~ /uploads/ { proxy_pass http://127.0.0.1:$PORT; proxy_set_header Host \$host; }
    # Споделени коренови ресурси (живеят в /var/www/html, не в папката на апа):
    # преводи, общи асети, сваляния. Без тях преводите/иконите дават 404 на този домейн.
    location ^~ /shared/       { root /var/www/html; }
    location ^~ /translations/ { root /var/www/html; }
    location ^~ /assets/       { root /var/www/html; }
    location ^~ /downloads/    { root /var/www/html; }
    location / { try_files \$uri \$uri/ /index.html; }
}
APPEOF
    else
        cat >> "$APP_CONF" <<APPEOF
server {
    listen 80;
    server_name $dom;
    root $ROOTDIR;
    index index.html;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; }
    location ^~ $API { proxy_pass http://127.0.0.1:$PORT; proxy_http_version 1.1; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; proxy_read_timeout 86400; }
    location ^~ /socket.io/ { proxy_pass http://127.0.0.1:$PORT; proxy_http_version 1.1; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host \$host; }
    location ^~ /uploads/ { proxy_pass http://127.0.0.1:$PORT; proxy_set_header Host \$host; }
    location ^~ $SERVE { root /var/www/html; }
    location ^~ /shared/ { root /var/www/html; }
    location / { try_files \$uri \$uri/ /index.html; }
}
APPEOF
    fi
    echo -e "  ${GREEN}✓ $dom → $key  (root=$ROOTDIR :$PORT)${NC}"
done
ln -sf "$APP_CONF" /etc/nginx/sites-enabled/kcy-app-domains.conf

if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓ nginx презареден (HTTP блоковете са активни)${NC}"
else
    echo -e "  ${RED}✗ nginx -t се провали:${NC}"; nginx -t; exit 1
fi

# ── SSL за всеки приложен домейн (certbot добавя 443 + redirect) ──
echo -e "${CYAN}SSL сертификати...${NC}"
printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
    [ -z "$dom" ] && continue
    if host "$dom" >/dev/null 2>&1; then
        if certbot --nginx -d "$dom" --non-interactive --agree-tos -m "$EMAIL" --redirect; then
            echo -e "  ${GREEN}✓ SSL $dom${NC}"
        else
            echo -e "  ${YELLOW}! SSL $dom не мина (провери DNS/порт 80)${NC}"
        fi
    else
        echo -e "  ${YELLOW}! $dom не резолвва още — пусни пак след DNS${NC}"
    fi
done
nginx -t 2>/dev/null && systemctl reload nginx

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Приложните домейни са настроени${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
    [ -n "$dom" ] && echo -e "  ${CYAN}https://$dom${NC} → $key (само това приложение)"
done
echo -e "  ${YELLOW}(главният ${MAIN_DOMAIN} е от 05 — не се пипа тук)${NC}"
