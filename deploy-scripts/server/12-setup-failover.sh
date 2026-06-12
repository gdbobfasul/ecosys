#!/bin/bash
# Version: 1.0095
##############################################################################
# KCY Ecosystem — Failover configuration (МНОГО-ДОМЕЙНЕН)
#
# Прехвърля КЪМ VM (primary) с локален backup, за ГЛАВНИЯ домейн И за всички
# приложни домейни (find.jwork.ru, look.myhousesetup.com, my.girl.place,
# kaji.kak.si — от domains.conf APP_DOMAIN_MAP).
#
# ДВА РЕЖИМА:
#   1) VPS режим (default) — на production VPS-а:
#        sudo bash 12-setup-failover.sh [vm-tailscale-ip]
#      VPS:443 (SSL терминация) → proxy plain HTTP към:
#        upstream { primary VM:8080 ; backup 127.0.0.1:8080 }
#      И главният, и приложните домейни минават през този upstream.
#
#   2) VM-prep режим — на VM-а:
#        sudo bash 12-setup-failover.sh --vm-prep
#      Кара VM nginx да сервира ВСИЧКИ домейни (главен + приложни) и на
#      plain HTTP :8080 БЕЗ https redirect (за да е failover target).
#
#   3) Revert:
#        sudo bash 12-setup-failover.sh --revert
#
# КЛЮЧОВО: SSL терминацията е САМО на VPS:443. И VM, и VPS-backup сервират
# plain HTTP на 8080 БЕЗ redirect → няма redirect loop. Рутирането е по Host.
#
# ⚠ ВНИМАНИЕ: всеки пълен деплой (опция 2 / 05-server-install) ИЗТРИВА
# kcy-failover + kcy-backup. Ред: деплой ПЪРВО, този скрипт ПОСЛЕДНО.
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: трябва root. sudo bash $0"
    exit 1
fi

# ── Единна конфигурация (домейни/портове) ──
DOMAINS_CONF="/var/www/kcy-ecosystem/private/configs/domains.conf"
[ -f "$DOMAINS_CONF" ] && . "$DOMAINS_CONF"
APP_CONF="/etc/nginx/sites-available/kcy-app-domains.conf"

##############################################################################
# Helper: намери основния site config (не failover, не backup, не default)
##############################################################################
find_main_site() {
    for f in /etc/nginx/sites-enabled/*; do
        [ -e "$f" ] || continue
        local base=$(basename "$f")
        [ "$base" = "kcy-failover" ] && continue
        [ "$base" = "kcy-backup" ] && continue
        [ "$base" = "kcy-app-domains.conf" ] && continue
        [ "$base" = "default" ] && continue
        echo "$(readlink -f "$f" 2>/dev/null || echo "$f")"
        return 0
    done
    return 1
}

##############################################################################
# Helper: списък приложни домейни "dom key" от APP_DOMAIN_MAP
##############################################################################
app_pairs() {
    printf '%s\n' "${APP_DOMAIN_MAP:-}" | while read -r dom key; do
        [ -z "$dom" ] && continue
        echo "$dom $key"
    done
}

##############################################################################
# Helper: извлечи ГЛАВНИЯ HTTPS блок → plain HTTP на 127.0.0.1:8080 (без ssl/redirect)
##############################################################################
build_main_backup() {
    local src="$1" dst="$2"
    awk '
        /^[[:space:]]*server[[:space:]]*{/ { buf=""; in_block=1; braces=0 }
        in_block { buf = buf $0 "\n" }
        in_block && /\{/ && !/server[[:space:]]*{/ { braces++ }
        in_block && /\}/ {
            if (braces > 0) { braces--; next }
            in_block=0
            if (buf ~ /listen[^;]*443/) { print buf }
            buf=""
        }
    ' "$src" > "${dst}.raw"
    [ ! -s "${dst}.raw" ] && cp "$src" "${dst}.raw"

    sed -E \
        -e '/listen[[:space:]]+\[::\]:(443|80)/d' \
        -e 's/listen[[:space:]]+443[^;]*;/listen 127.0.0.1:8080;/g' \
        -e 's/listen[[:space:]]+80[[:space:]]*;/listen 127.0.0.1:8080;/g' \
        -e '/ssl_certificate/d' -e '/ssl_protocols/d' -e '/ssl_ciphers/d' \
        -e '/ssl_prefer_server_ciphers/d' -e '/ssl_session/d' -e '/ssl_dhparam/d' \
        -e '/include.*letsencrypt/d' \
        -e 's#return[[:space:]]+301[[:space:]]+https://[^;]*;#return 200 "backup-ok";#g' \
        "${dst}.raw" > "$dst"
    rm -f "${dst}.raw"
}

##############################################################################
# Helper: 8080 backup блок за ПРИЛОЖЕН домейн (локален апп), рутиране по Host.
# Регенерира се от domains.conf (надеждно, не парсва nginx).
##############################################################################
gen_app_8080_block() {
    local dom="$1" key="$2"
    local DIR PORT API FS SERVE ROOTDIR NESTED
    DIR=$(eval "echo \${APP_${key}_DIR}")
    PORT=$(eval "echo \${APP_${key}_PORT}")
    API=$(eval "echo \${APP_${key}_API}")
    FS=$(eval "echo \${APP_${key}_FS}")
    if [ -z "$DIR" ] || [ -z "$PORT" ] || [ -z "$API" ] || [ -z "$FS" ]; then
        echo "  ! непознат ключ '$key' за $dom — пропускам" >&2; return 0
    fi
    ROOTDIR="/var/www/html/${FS%/}"
    SERVE="${DIR%public/}"
    case "$DIR" in */public/) NESTED=1 ;; *) NESTED=0 ;; esac
    {
        echo "server {"
        echo "    listen 127.0.0.1:8080;"
        echo "    server_name $dom;"
        echo "    root $ROOTDIR;"
        echo "    index index.html;"
        echo "    add_header X-Served-By \"PROD\" always;"
        printf '    location ^~ %s { proxy_pass http://127.0.0.1:%s; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 86400; }\n' "$API" "$PORT"
        if [ "$NESTED" = "1" ]; then
            printf '    location ^~ /socket.io/ { proxy_pass http://127.0.0.1:%s; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }\n' "$PORT"
            printf '    location ^~ /uploads/ { proxy_pass http://127.0.0.1:%s; proxy_set_header Host $host; }\n' "$PORT"
            printf '    location ^~ %s { root /var/www/html; }\n' "$SERVE"
        else
            printf '    location ^~ /uploads/ { proxy_pass http://127.0.0.1:%s; proxy_set_header Host $host; }\n' "$PORT"
        fi
        echo '    location ^~ /shared/       { root /var/www/html; }'
        echo '    location ^~ /translations/ { root /var/www/html; }'
        echo '    location ^~ /assets/       { root /var/www/html; }'
        echo '    location ^~ /downloads/    { root /var/www/html; }'
        echo '    location / { try_files $uri $uri/ /index.html; }'
        echo "}"
    }
}

##############################################################################
# Helper: 443 failover-front блок за домейн (proxy към upstream kcy_backend)
##############################################################################
gen_failover_front() {
    local dom="$1"
    local CERT="/etc/letsencrypt/live/$dom/fullchain.pem"
    if [ ! -f "$CERT" ]; then
        echo "  ! няма сертификат за $dom — пропускам от front" >&2; return 0
    fi
    cat <<EOF
server {
    listen 80;
    server_name $dom;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name $dom;
    ssl_certificate /etc/letsencrypt/live/$dom/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$dom/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    location / {
        proxy_pass http://kcy_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 3s;
        proxy_send_timeout 15s;
        proxy_read_timeout 86400;
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
}

# Маркер: помни дали failover е бил активен (за авто-възстановяване след деплой)
FAILOVER_MARKER="/etc/kcy-failover.conf"

##############################################################################
# AUTO-RESTORE режим — извиква се накрая на деплоя (02/04).
# Ако failover е бил активен (има маркер) → пуска се пак със запазените настройки.
##############################################################################
if [ "$1" = "--auto-restore" ]; then
    if [ ! -f "$FAILOVER_MARKER" ]; then
        echo -e "  ${YELLOW}↷${NC} Failover не е бил активен — нищо за възстановяване."
        exit 0
    fi
    . "$FAILOVER_MARKER"
    echo -e "${CYAN}  Failover е бил активен преди деплоя — възстановявам...${NC}"
    if [ "${MODE:-}" = "vm-prep" ]; then
        exec "$0" --vm-prep
    else
        exec "$0" ${VM_TS_IP:-}
    fi
fi

##############################################################################
# REVERT режим — върни без failover
##############################################################################
if [ "$1" = "--revert" ]; then
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  KCY Failover — Revert (връщане без failover)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo ""

    BACKUP=$(ls -dt /var/backups/nginx-pre-failover-* 2>/dev/null | head -1)
    if [ -z "$BACKUP" ]; then
        echo -e "${RED}✗ Няма backup в /var/backups/nginx-pre-failover-*${NC}"
        echo "  Ръчно: премахни kcy-failover + kcy-backup symlinks, върни оригиналните sites."
        exit 1
    fi
    echo -e "  Restore от: ${GREEN}${BACKUP}${NC}"

    rm -rf /etc/nginx/sites-available /etc/nginx/sites-enabled
    cp -r "$BACKUP/sites-available" /etc/nginx/
    cp -r "$BACKUP/sites-enabled" /etc/nginx/

    rm -f /etc/nginx/sites-enabled/kcy-failover /etc/nginx/sites-available/kcy-failover
    rm -f /etc/nginx/sites-enabled/kcy-backup /etc/nginx/sites-available/kcy-backup
    rm -f "$FAILOVER_MARKER"

    for l in /etc/nginx/sites-enabled/*; do
        [ -L "$l" ] && [ ! -e "$l" ] && rm -f "$l"
    done

    if nginx -t 2>&1; then
        systemctl reload nginx
        echo -e "  ${GREEN}✓${NC} Failover премахнат — сайтът работи нормално"
    else
        echo -e "${RED}✗ nginx грешка след revert — провери: nginx -t${NC}"
        exit 1
    fi
    exit 0
fi

##############################################################################
# VM-PREP режим — добави listen 8080 към ВСИЧКИ 443 блокове (главен + приложни)
##############################################################################
if [ "$1" = "--vm-prep" ]; then
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  KCY Failover — VM-prep (plain HTTP на 8080, всички домейни)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo ""

    PREP_FILES=()
    MAIN_SITE=$(find_main_site) && [ -n "$MAIN_SITE" ] && PREP_FILES+=("$MAIN_SITE")
    [ -f "$APP_CONF" ] && PREP_FILES+=("$APP_CONF")

    if [ ${#PREP_FILES[@]} -eq 0 ]; then
        echo -e "${RED}✗ Не намерих nginx sites на VM-а. Първо пусни опция 4 (Deploy проекта).${NC}"
        exit 1
    fi

    for f in "${PREP_FILES[@]}"; do
        cp "$f" "${f}.pre-vmprep"
        if grep -q "listen.*8080" "$f"; then
            echo -e "  ${YELLOW}↷${NC} $(basename "$f"): 8080 listen вече съществува"
        else
            # Добави 'listen 0.0.0.0:8080;' само след IPv4 'listen 443 …' (НЕ след
            # 'listen [::]:443' — иначе два 8080 в един блок → nginx duplicate listen).
            sed -i -E '/listen[[:space:]]+443([[:space:]]|;)/a\    listen 0.0.0.0:8080;' "$f"
            echo -e "  ${GREEN}✓${NC} $(basename "$f"): добавен listen 0.0.0.0:8080"
        fi
    done

    if nginx -t 2>&1; then
        systemctl reload nginx
        echo "MODE=vm-prep" > "$FAILOVER_MARKER"
        echo -e "  ${GREEN}✓${NC} VM готов като failover target (8080) за всички домейни"
    else
        echo -e "${RED}✗ nginx грешка — връщам backup${NC}"
        for f in "${PREP_FILES[@]}"; do cp "${f}.pre-vmprep" "$f"; done
        systemctl reload nginx
        exit 1
    fi
    exit 0
fi

##############################################################################
# VPS режим (default)
##############################################################################
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  KCY Failover Setup (VPS reverse proxy, много-домейнен)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# ── VM Tailscale IP (опционален аргумент) ──
VM_TS_IP="${1:-}"
if [ -n "$VM_TS_IP" ] && [[ ! "$VM_TS_IP" =~ ^100\. ]]; then
    echo -e "${YELLOW}!${NC} '$VM_TS_IP' не прилича на Tailscale IP — игнорирам, само backup."
    VM_TS_IP=""
fi
if [ -n "$VM_TS_IP" ]; then
    echo -e "  VM primary: ${GREEN}${VM_TS_IP}:8080${NC}"
    if timeout 3 bash -c "echo > /dev/tcp/${VM_TS_IP}/8080" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} VM отговаря на 8080"
    else
        echo -e "  ${YELLOW}!${NC} VM не отговаря на 8080 (спрян или не е prep-нат) — failover ще ползва backup"
    fi
else
    echo -e "  ${YELLOW}↷${NC} Без VM — само локален backup на VPS-а"
fi

# ── Главен домейн + main site ──
MAIN_SITE=$(find_main_site)
if [ -z "$MAIN_SITE" ]; then
    echo -e "${RED}✗ Не намерих nginx site. Първо пусни опция 4 (Deploy проекта).${NC}"
    exit 1
fi
MAIN_DOM="${MAIN_DOMAIN:-$(grep -m1 'server_name' "$MAIN_SITE" 2>/dev/null | awk '{print $2}' | tr -d ';')}"
echo -e "  Главен домейн: ${GREEN}${MAIN_DOM}${NC}"
echo -e "  Main site: ${GREEN}${MAIN_SITE}${NC}"
echo -e "  Приложни домейни:"
app_pairs | while read -r d k; do echo "    - $d → $k"; done

# ── SSL cert за главния ──
if [ ! -f "/etc/letsencrypt/live/${MAIN_DOM}/fullchain.pem" ]; then
    echo -e "${RED}✗ Няма SSL сертификат за ${MAIN_DOM}. Първо: certbot.${NC}"
    exit 1
fi

# ── Backup на цялата конфигурация ──
BACKUP_DIR="/var/backups/nginx-pre-failover-$(date +%s)"
mkdir -p "$BACKUP_DIR"
cp -r /etc/nginx/sites-available "$BACKUP_DIR/"
cp -r /etc/nginx/sites-enabled "$BACKUP_DIR/"
echo -e "  ${GREEN}✓${NC} Backup: ${BACKUP_DIR}"

# ── СТЪПКА 1: kcy-backup (8080 локално, всички домейни) ──
echo ""
echo "  Създавам kcy-backup (локален plain HTTP 8080, всички домейни)..."
BK="/etc/nginx/sites-available/kcy-backup"
build_main_backup "$MAIN_SITE" "$BK"
app_pairs | while read -r d k; do
    gen_app_8080_block "$d" "$k" >> "$BK"
done
echo -e "  ${GREEN}✓${NC} kcy-backup създаден (главен + $(app_pairs | grep -c . ) приложни)"

# ── СТЪПКА 2: kcy-failover (upstream + 443 front за всеки домейн) ──
echo ""
echo "  Създавам kcy-failover (443 front за всеки домейн)..."
if [ -n "$VM_TS_IP" ]; then
    UPSTREAM_SERVERS="    server ${VM_TS_IP}:8080 max_fails=2 fail_timeout=10s;
    server 127.0.0.1:8080 backup;"
else
    UPSTREAM_SERVERS="    server 127.0.0.1:8080;"
fi

FO="/etc/nginx/sites-available/kcy-failover"
cat > "$FO" <<NGINX_EOF
# KCY Ecosystem — Failover reverse proxy (генериран от 12-setup-failover.sh)
# SSL терминация тук. Upstream сервира plain HTTP (рутиране по Host).

upstream kcy_backend {
${UPSTREAM_SERVERS}
    keepalive 16;
}
NGINX_EOF

# Diag snippet (ако има) — bundle URL директно от VPS-а
if [ -f /etc/nginx/snippets/kcy-diag-proxy.conf ]; then
    echo -e "  ${GREEN}✓${NC} Diag snippet наличен (не се пипа тук)"
fi

# Front за главния + всеки приложен домейн
gen_failover_front "$MAIN_DOM" >> "$FO"
app_pairs | while read -r d k; do
    gen_failover_front "$d" >> "$FO"
done
echo -e "  ${GREEN}✓${NC} kcy-failover създаден"

# ── СТЪПКА 3: изключи оригиналните 443 (главен сайт + app-domains), включи backup+failover ──
echo ""
echo "  Активирам failover..."
for l in /etc/nginx/sites-enabled/*; do
    [ -e "$l" ] || [ -L "$l" ] || continue
    real=$(readlink -f "$l" 2>/dev/null || echo "$l")
    base=$(basename "$l")
    if [ "$real" = "$MAIN_SITE" ] || [ "$base" = "kcy-app-domains.conf" ]; then
        rm -f "$l"
        echo -e "  ${GREEN}✓${NC} изключен: $base (файлът остава в sites-available)"
    fi
done

ln -sf /etc/nginx/sites-available/kcy-backup   /etc/nginx/sites-enabled/kcy-backup
ln -sf /etc/nginx/sites-available/kcy-failover /etc/nginx/sites-enabled/kcy-failover

for l in /etc/nginx/sites-enabled/*; do
    [ -L "$l" ] && [ ! -e "$l" ] && rm -f "$l"
done

# ── СТЪПКА 4: Test + reload (авто-revert при грешка) ──
echo ""
if nginx -t 2>&1; then
    systemctl reload nginx
    echo "VM_TS_IP=${VM_TS_IP}" > "$FAILOVER_MARKER"
    echo -e "  ${GREEN}✓${NC} nginx reloaded"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ FAILOVER АКТИВЕН (главен + приложни домейни)${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Browser → https://<домейн> → VPS:443 (SSL) → upstream:"
    [ -n "$VM_TS_IP" ] && echo "    primary: ${VM_TS_IP}:8080 (VM)"
    echo "    backup:  127.0.0.1:8080 (VPS local)"
    echo ""
    echo "  Проверка коя машина обслужва:  curl -sI https://<домейн> | grep -i served-by"
    echo "    X-Served-By: VM    → обслужва VM-ката"
    echo "    X-Served-By: PROD  → обслужва локалният VPS (backup)"
    echo ""
    echo "  Backup: ${BACKUP_DIR}"
    echo -e "  ${CYAN}За връщане без failover:${NC} sudo bash $0 --revert"
else
    echo -e "${RED}✗ nginx config грешка! Връщам backup.${NC}"
    rm -rf /etc/nginx/sites-available /etc/nginx/sites-enabled
    cp -r "$BACKUP_DIR/sites-available" /etc/nginx/
    cp -r "$BACKUP_DIR/sites-enabled" /etc/nginx/
    nginx -t && systemctl reload nginx
    echo -e "  ${YELLOW}Backup възстановен.${NC}"
    exit 1
fi
