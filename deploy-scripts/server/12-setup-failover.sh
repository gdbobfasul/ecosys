#!/bin/bash
# Version: 1.0091
##############################################################################
# KCY Ecosystem — Failover configuration
#
# ДВА РЕЖИМА:
#
#   1) VPS режим (default) — на production VPS-а:
#      sudo bash 12-setup-failover.sh [vm-tailscale-ip]
#      Превръща VPS nginx в SSL-terminating reverse proxy с upstream:
#        primary: VM:8080 (plain HTTP през Tailscale)
#        backup:  127.0.0.1:8080 (локален nginx, винаги работи)
#
#   2) VM-prep режим — на VM-а:
#      sudo bash 12-setup-failover.sh --vm-prep
#      Превръща VM nginx да сервира plain HTTP на 8080 БЕЗ https redirect.
#      Нужно само ако искаш VM-ът да е primary failover target.
#
# КЛЮЧОВО: SSL терминацията е САМО на VPS:443. И VM, и VPS-backup
# сервират plain HTTP на 8080 БЕЗ redirect → няма redirect loop.
#
# Архитектура:
#   Browser → https://domain → VPS:443 (SSL) → proxy plain HTTP →
#       upstream { primary VM:8080 ; backup 127.0.0.1:8080 }
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: трябва root. sudo bash $0"
    exit 1
fi

##############################################################################
# Helper: намери основния site config (не failover, не backup, не default)
##############################################################################
find_main_site() {
    for f in /etc/nginx/sites-enabled/*; do
        [ -e "$f" ] || continue
        local base=$(basename "$f")
        [ "$base" = "kcy-failover" ] && continue
        [ "$base" = "kcy-backup" ] && continue
        [ "$base" = "default" ] && continue
        echo "$(readlink -f "$f" 2>/dev/null || echo "$f")"
        return 0
    done
    return 1
}

##############################################################################
# Helper: извлечи HTTPS server блока, преобразуван за plain HTTP на 8080
# Премахва: ssl директиви, listen 443/80, прави listen 127.0.0.1:8080.
# Резултатът сервира съдържанието без никакъв https redirect.
##############################################################################
build_backup_site() {
    local src="$1"
    local dst="$2"
    # Извади САМО HTTPS server блока (от "listen 443" до неговото затварящо })
    awk '
        /^[[:space:]]*server[[:space:]]*{/ { depth++; buf=""; in_block=1 }
        in_block { buf = buf $0 "\n" }
        in_block && /\{/ && !/server[[:space:]]*{/ { braces++ }
        in_block && /\}/ {
            if (braces > 0) { braces--; next }
            # затваряне на server блока
            in_block=0
            if (buf ~ /listen[^;]*443/) { print buf }
            buf=""
        }
    ' "$src" > "${dst}.raw"

    # Ако awk не хвана нищо (различна структура) — fallback: целия файл
    if [ ! -s "${dst}.raw" ]; then
        cp "$src" "${dst}.raw"
    fi

    # Преобразувай: listen → 8080 plain, махни ssl, махни redirect
    # IPv6 listen редове се трият (за локален backup стига един IPv4 listen).
    sed -E \
        -e '/listen[[:space:]]+\[::\]:(443|80)/d' \
        -e 's/listen[[:space:]]+443[^;]*;/listen 127.0.0.1:8080;/g' \
        -e 's/listen[[:space:]]+80[[:space:]]*;/listen 127.0.0.1:8080;/g' \
        -e '/ssl_certificate/d' \
        -e '/ssl_protocols/d' \
        -e '/ssl_ciphers/d' \
        -e '/ssl_prefer_server_ciphers/d' \
        -e '/ssl_session/d' \
        -e '/ssl_dhparam/d' \
        -e '/include.*letsencrypt/d' \
        -e 's#return[[:space:]]+301[[:space:]]+https://[^;]*;#return 200 "backup-ok";#g' \
        "${dst}.raw" > "${dst}.step1"

    # Премахни дублирани "listen 127.0.0.1:8080;" — остави само първия
    awk '
        /listen 127\.0\.0\.1:8080;/ {
            if (seen) next
            seen=1
        }
        { print }
    ' "${dst}.step1" > "$dst"
    rm -f "${dst}.raw" "${dst}.step1"

    # Премахни дублирани listen 127.0.0.1:8080 (ако HTTP+HTTPS блок са се слели)
    # Оставяме само първия server блок ако има два
    :
}

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
        echo "  Ръчно: премахни kcy-failover + kcy-backup symlinks, върни оригиналния site."
        exit 1
    fi
    echo -e "  Restore от: ${GREEN}${BACKUP}${NC}"

    rm -rf /etc/nginx/sites-available /etc/nginx/sites-enabled
    cp -r "$BACKUP/sites-available" /etc/nginx/
    cp -r "$BACKUP/sites-enabled" /etc/nginx/

    rm -f /etc/nginx/sites-enabled/kcy-failover /etc/nginx/sites-available/kcy-failover
    rm -f /etc/nginx/sites-enabled/kcy-backup /etc/nginx/sites-available/kcy-backup

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
# VM-PREP режим
##############################################################################
if [ "$1" = "--vm-prep" ]; then
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  KCY Failover — VM-prep (plain HTTP на 8080)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo ""

    MAIN_SITE=$(find_main_site)
    if [ -z "$MAIN_SITE" ]; then
        echo -e "${RED}✗ Не намерих nginx site на VM-а. Първо deploy.${NC}"
        exit 1
    fi
    echo -e "  Site: ${GREEN}${MAIN_SITE}${NC}"

    # Backup
    cp "$MAIN_SITE" "${MAIN_SITE}.pre-vmprep"

    # Добави listen 127.0.0.1:8080 към HTTPS блока + remove redirect
    # VM-ът ще слуша на 8080 plain (за VPS proxy) + остава си нормалния сайт
    if ! grep -q "listen.*8080" "$MAIN_SITE"; then
        # Вмъкни 8080 listen в HTTPS блока след listen 443
        sed -i -E '/listen[^;]*443/a\    listen 0.0.0.0:8080;' "$MAIN_SITE"
        echo -e "  ${GREEN}✓${NC} VM nginx сега слуша и на 0.0.0.0:8080 (plain HTTP)"
    else
        echo -e "  ${YELLOW}↷${NC} 8080 listen вече съществува"
    fi

    if nginx -t 2>&1; then
        systemctl reload nginx
        echo -e "  ${GREEN}✓${NC} VM готов като failover target (8080)"
    else
        echo -e "${RED}✗ nginx грешка — връщам backup${NC}"
        cp "${MAIN_SITE}.pre-vmprep" "$MAIN_SITE"
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
echo -e "${CYAN}  KCY Failover Setup (VPS reverse proxy)${NC}"
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

# ── Намери домейн и main site ──
MAIN_SITE=$(find_main_site)
if [ -z "$MAIN_SITE" ]; then
    echo -e "${RED}✗ Не намерих nginx site. Първо изпълни deploy.${NC}"
    exit 1
fi
DOMAIN=$(grep -m1 'server_name' "$MAIN_SITE" 2>/dev/null | awk '{print $2}' | tr -d ';')
[ -z "$DOMAIN" ] && DOMAIN="$(hostname -f 2>/dev/null || hostname)"
echo -e "  Домейн: ${GREEN}${DOMAIN}${NC}"
echo -e "  Main site: ${GREEN}${MAIN_SITE}${NC}"

# ── SSL cert ──
SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
if [ ! -f "$SSL_CERT" ]; then
    echo -e "${RED}✗ Няма SSL сертификат за ${DOMAIN}.${NC}"
    echo "  Failover изисква SSL. Първо: sudo certbot --nginx -d ${DOMAIN}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} SSL: ${SSL_CERT}"

# ── Backup на цялата конфигурация ──
BACKUP_DIR="/var/backups/nginx-pre-failover-$(date +%s)"
mkdir -p "$BACKUP_DIR"
cp -r /etc/nginx/sites-available "$BACKUP_DIR/"
cp -r /etc/nginx/sites-enabled "$BACKUP_DIR/"
echo -e "  ${GREEN}✓${NC} Backup: ${BACKUP_DIR}"

# ── СТЪПКА 1: Build backup site (plain HTTP на 8080, БЕЗ redirect) ──
echo ""
echo "  Създавам backup site (локален, plain HTTP 8080)..."
build_backup_site "$MAIN_SITE" "/etc/nginx/sites-available/kcy-backup"
echo -e "  ${GREEN}✓${NC} kcy-backup създаден"

# ── СТЪПКА 2: Build failover reverse proxy ──
echo ""
echo "  Създавам failover reverse proxy (80/443)..."

# Build upstream блока.
# nginx НЕ приема upstream само от "backup" сървъри — трябва поне един primary.
if [ -n "$VM_TS_IP" ]; then
    # VM е primary, локалният е backup
    UPSTREAM_SERVERS="    server ${VM_TS_IP}:8080 max_fails=2 fail_timeout=10s;
    server 127.0.0.1:8080 backup;"
else
    # Няма VM — локалният е единственият (без 'backup' keyword)
    UPSTREAM_SERVERS="    server 127.0.0.1:8080;"
fi

cat > /etc/nginx/sites-available/kcy-failover << NGINX_EOF
# KCY Ecosystem — Failover reverse proxy (генериран от 12-setup-failover.sh)
# SSL терминация тук. Upstream сервира plain HTTP.

upstream kcy_backend {
${UPSTREAM_SERVERS}
    keepalive 16;
}

# HTTP — само ACME + redirect към HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS — SSL терминация + proxy към upstream
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://kcy_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_connect_timeout 3s;
        proxy_send_timeout 15s;
        proxy_read_timeout 30s;
        proxy_next_upstream error timeout http_502 http_503 http_504;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_EOF
echo -e "  ${GREEN}✓${NC} kcy-failover създаден"

# ── СТЪПКА 3: Активирай — изключи main site, включи backup + failover ──
echo ""
echo "  Активирам failover..."

# Изключи оригиналния main site (премахни symlink, не файла)
for l in /etc/nginx/sites-enabled/*; do
    [ -e "$l" ] || [ -L "$l" ] || continue
    real=$(readlink -f "$l" 2>/dev/null || echo "$l")
    if [ "$real" = "$MAIN_SITE" ]; then
        rm -f "$l"
        echo -e "  ${GREEN}✓${NC} Оригиналният site изключен (файлът остава в sites-available)"
    fi
done

# Включи backup + failover
ln -sf /etc/nginx/sites-available/kcy-backup /etc/nginx/sites-enabled/kcy-backup
ln -sf /etc/nginx/sites-available/kcy-failover /etc/nginx/sites-enabled/kcy-failover

# Почисти счупени symlinks
for l in /etc/nginx/sites-enabled/*; do
    [ -L "$l" ] && [ ! -e "$l" ] && rm -f "$l"
done

# ── СТЪПКА 4: Test + reload ──
echo ""
if nginx -t 2>&1; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓${NC} nginx reloaded"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ FAILOVER АКТИВЕН${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Browser → https://${DOMAIN} → VPS:443 (SSL) → proxy:"
    [ -n "$VM_TS_IP" ] && echo "    primary: ${VM_TS_IP}:8080 (VM)"
    echo "    backup:  127.0.0.1:8080 (VPS local)"
    echo ""
    echo "  Backup: ${BACKUP_DIR}"
    echo ""
    echo -e "  ${CYAN}За да върнеш без failover:${NC}"
    echo "    sudo bash 12-setup-failover.sh --revert"
else
    echo -e "${RED}✗ nginx config грешка! Връщам backup.${NC}"
    rm -rf /etc/nginx/sites-available /etc/nginx/sites-enabled
    cp -r "$BACKUP_DIR/sites-available" /etc/nginx/
    cp -r "$BACKUP_DIR/sites-enabled" /etc/nginx/
    nginx -t && systemctl reload nginx
    echo -e "  ${YELLOW}Backup възстановен.${NC}"
    exit 1
fi
