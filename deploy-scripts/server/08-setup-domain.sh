#!/bin/bash
# Version: 1.0197
##############################################################################
# KCY — Отделните приложни домейни + SSL (чете private/configs/domains.conf).
#
# Главният домейн (take.offbitch.com) + неговият nginx/SSL се правят от
# 05-server-install (опция 4/2). ТУК са САМО допълнителните домейни:
#   find.jwork.ru → wnb · look.myhousesetup.com → hlb · my.girl.place/kaji → chat
# Всеки показва САМО своето приложение (другите пътища → index) + по 1 SSL.
#
# SSL през WEBROOT (НЕ --nginx): challenge-ът се сервира от
# /var/www/html/.well-known/acme-challenge/ → имунен на HTTP→HTTPS редиректи
# (старият --nginx --redirect редиректваше challenge-а към 443 → 404).
# 2 паса: (1) HTTP блокове → webroot certonly → (2) добавяме 443 блокове.
# generate_conf регенерира файла от 0 при ВСЯКО пускане → чисти счупени стари
# certbot записи. НЕ пипа главния nginx конфиг и НЕ инсталира node/npm.
# Usage: sudo ./08-setup-domain.sh
##############################################################################
set -u
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

echo -e "${CYAN}========================================"
echo "  KCY — Приложни домейни + SSL (webroot)"
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

# certbot (БЕЗ node/npm — конфликтват с NodeSource nodejs). Webroot не иска nginx-плъгина.
if ! command -v certbot >/dev/null 2>&1; then
    echo -e "${CYAN}Инсталирам certbot...${NC}"
    apt-get update -qq && apt-get install -y certbot >/dev/null 2>&1 || true
fi

# Папката, от която nginx сервира ACME challenge-а (общ webroot за всички домейни).
mkdir -p /var/www/html/.well-known/acme-challenge
chmod -R 755 /var/www/html/.well-known 2>/dev/null || true

APP_CONF="/etc/nginx/sites-available/kcy-app-domains.conf"

# Роля на машината за X-Served-By: PROD (живия ams-chat) или VM (всичко друго)
case "$(hostname)" in ams-chat*) KCY_ROLE="PROD" ;; *) KCY_ROLE="VM" ;; esac

# Вътрешните локации на приложението (printf + единични кавички → nginx променливите
# като $host остават литерални; разширяват се само %s = API/PORT/SERVE).
build_locations() {  # ползва $API $PORT $SERVE $NESTED от извикващия
    printf '    location ^~ %s { proxy_pass http://127.0.0.1:%s; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 86400; }\n' "$API" "$PORT"
    # PORTALS (порт 3002) на ВСЕКИ приложен домейн — споделеният админ вход + системното
    # меню (system-nav.js вика /api/portals/ip-admin и /api/portals/me на ВСЯКА страница)
    # + /shared/admin-status.html. Без тези блокове /portals/login.html и /api/portals/*
    # падаха в SPA fallback-а (location /) → връщаха index.html на чата (="връща ме на
    # главната"). `^~` + най-дълъг префикс → /api/portals/ печели пред /api/ на чата.
    printf '    location ^~ /api/portals/ { proxy_pass http://127.0.0.1:3002; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 86400; }\n'
    printf '    location ^~ /portals/ { proxy_pass http://127.0.0.1:3002; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 86400; }\n'
    if [ "$NESTED" = "1" ]; then
        printf '    location ^~ /socket.io/ { proxy_pass http://127.0.0.1:%s; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }\n' "$PORT"
        printf '    location ^~ /uploads/ { proxy_pass http://127.0.0.1:%s; proxy_set_header Host $host; }\n' "$PORT"
        printf '    location ^~ %s { root /var/www/html; }\n' "$SERVE"
    else
        printf '    location ^~ /uploads/ { proxy_pass http://127.0.0.1:%s; proxy_set_header Host $host; }\n' "$PORT"
    fi
    printf '    location ^~ /shared/       { root /var/www/html; }\n'
    printf '    location ^~ /translations/ { root /var/www/html; }\n'
    printf '    location ^~ /assets/       { root /var/www/html; }\n'
    printf '    location ^~ /downloads/    { root /var/www/html; }\n'
    # /privacy/ — статични страници за поверителност на приложенията (за магазините).
    # Адресите са ПОСТОЯННИ, докато приложението е активно (не се сменят):
    #   /privacy/newslator/hw-privacy.html  (Huawei AppGallery)
    #   /privacy/newslator/ru-privacy.html  (RuStore)
    # Сервира се от /var/www/html/privacy/ на ВСЕКИ приложен домейн (вкл. selflearning.bot.nu).
    printf '    location ^~ /privacy/      { root /var/www/html; }\n'
    printf '    location / { try_files $uri $uri/ /index.html; }\n'
}

# Генерирай целия kcy-app-domains.conf от 0. За домейн със сертификат → 80(redirect)+443;
# без сертификат → само 80 (за да работи преди SSL и да мине ACME).
generate_conf() {
    : > "$APP_CONF"
    printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
        [ -z "$dom" ] && continue
        DIR=$(eval "echo \${APP_${key}_DIR}")
        PORT=$(eval "echo \${APP_${key}_PORT}")
        API=$(eval "echo \${APP_${key}_API}")
        if [ -z "$DIR" ] || [ -z "$PORT" ] || [ -z "$API" ]; then
            echo -e "  ${YELLOW}! непознат ключ '$key' за $dom — пропускам${NC}"; continue
        fi
        SERVE="${DIR%public/}"
        FS=$(eval "echo \${APP_${key}_FS}"); [ -z "$FS" ] && FS="${DIR#/}"
        ROOTDIR="/var/www/html/${FS%/}"
        case "$DIR" in */public/) NESTED=1 ;; *) NESTED=0 ;; esac
        LOC="$(build_locations)"
        CERT="/etc/letsencrypt/live/$dom/fullchain.pem"
        if [ -f "$CERT" ]; then
            cat >> "$APP_CONF" <<EOF
server {
    listen 80;
    server_name $dom;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl;
    server_name $dom;
    root $ROOTDIR;
    index index.html;
    ssl_certificate     /etc/letsencrypt/live/$dom/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$dom/privkey.pem;
    add_header X-Served-By "${KCY_ROLE}" always;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
$LOC
}
EOF
            echo -e "  ${GREEN}✓ $dom → $key  (HTTPS, root=$ROOTDIR :$PORT)${NC}"
        else
            cat >> "$APP_CONF" <<EOF
server {
    listen 80;
    server_name $dom;
    root $ROOTDIR;
    index index.html;
    add_header X-Served-By "${KCY_ROLE}" always;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
$LOC
}
EOF
            echo -e "  ${GREEN}✓ $dom → $key  (HTTP само — чака SSL, root=$ROOTDIR :$PORT)${NC}"
        fi
    done
    ln -sf "$APP_CONF" /etc/nginx/sites-enabled/kcy-app-domains.conf
}

# Публикува статичните правни страници: копира */publish/*-privacy.html И */publish/*-terms.html
# от репото в /var/www/html/privacy/<приложение>/, откъдето nginx ги сервира (изискване на
# магазините — Huawei 7.2/7.1 privacy + Общи условия за legal-gate „екран 3"; RuStore). No-op с
# предупреждение, ако липсват.
sync_privacy_pages() {
    local dest_root="/var/www/html/privacy" n=0 f pubdir appdir app
    mkdir -p "$dest_root"
    while IFS= read -r f; do
        [ -f "$f" ] || continue
        pubdir="$(dirname "$f")"          # .../<приложение>/publish
        appdir="$(dirname "$pubdir")"     # .../<приложение>
        app="$(basename "$appdir")"
        mkdir -p "$dest_root/$app"
        cp -f "$f" "$dest_root/$app/" && n=$((n+1))
    done <<EOF
$(find "$PROJECT_DIR" -type f \( -name '*-privacy.html' -o -name '*-terms.html' \) -path '*/publish/*' 2>/dev/null)
EOF
    chmod -R 755 "$dest_root" 2>/dev/null || true
    if [ "$n" -gt 0 ]; then
        echo -e "  ${GREEN}✓ публикувани $n правни страници (privacy + terms) в $dest_root${NC}"
    else
        echo -e "  ${YELLOW}! няма *-privacy.html / *-terms.html под $PROJECT_DIR — качи ги ръчно в $dest_root/<приложение>/${NC}"
    fi
}

# ── Публикувай правните страници (privacy + terms) за магазините ──
echo -e "${CYAN}Публикувам правни страници (privacy + terms)...${NC}"
sync_privacy_pages

# ── Пас 1: HTTP блокове (за да тръгне ACME webroot) ──
echo -e "${CYAN}nginx блокове — пас 1 (HTTP)...${NC}"
generate_conf
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓ nginx презареден${NC}"
else
    echo -e "  ${RED}✗ nginx -t се провали:${NC}"; nginx -t; exit 1
fi

# ── SSL през WEBROOT (token от /var/www/html/.well-known — имунен на редиректи) ──
echo -e "${CYAN}SSL сертификати (webroot)...${NC}"
printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
    [ -z "$dom" ] && continue
    if getent hosts "$dom" >/dev/null 2>&1 || host "$dom" >/dev/null 2>&1; then
        if certbot certonly --webroot -w /var/www/html -d "$dom" \
                --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring; then
            echo -e "  ${GREEN}✓ сертификат $dom${NC}"
        else
            echo -e "  ${YELLOW}! SSL $dom не мина — провери: A-запис към тази машина + порт 80 отворен${NC}"
        fi
    else
        echo -e "  ${YELLOW}! $dom не резолвва още — пусни пак след DNS${NC}"
    fi
done

# ── Пас 2: добави 443 блокове за домейните със сертификат ──
echo -e "${CYAN}nginx блокове — пас 2 (HTTPS)...${NC}"
generate_conf
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓ nginx презареден (HTTPS активен)${NC}"
else
    echo -e "  ${RED}✗ nginx -t се провали след пас 2:${NC}"; nginx -t
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Приложните домейни са настроени${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
    [ -z "$dom" ] && continue
    if [ -f "/etc/letsencrypt/live/$dom/fullchain.pem" ]; then
        echo -e "  ${CYAN}https://$dom${NC} → $key"
    else
        echo -e "  ${YELLOW}http://$dom${NC} → $key (още без SSL — провери DNS и пусни пак)"
    fi
done
echo -e "  ${YELLOW}(главният ${MAIN_DOMAIN} е от 05 — не се пипа тук)${NC}"

# ── Failover авто-възстановяване: 08 пресъздаде kcy-app-domains.conf и го пусна
# пак → ако failover е бил активен, връщаме го (иначе app-домейните конфликтват
# с failover front-а). No-op ако failover не е бил активен (няма маркер). ──
FAILOVER_SH="$(dirname "$0")/12-setup-failover.sh"
if [ -f "$FAILOVER_SH" ] && [ -f /etc/kcy-failover.conf ]; then
    echo ""
    echo -e "${CYAN}  Failover е бил активен — възстановявам след пресъздаването...${NC}"
    bash "$FAILOVER_SH" --auto-restore || echo -e "  ${YELLOW}! Failover restore не мина — пусни ръчно опция 37${NC}"
fi
