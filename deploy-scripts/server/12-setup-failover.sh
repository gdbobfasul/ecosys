#!/bin/bash
# Version: 1.0089
##############################################################################
# KCY Ecosystem — Failover configuration на production VPS
#
# Преобразува production nginx от обикновен сайт в reverse proxy с failover:
#   - Primary: VM през Tailscale (ако работи)
#   - Backup:  локалният nginx на VPS-а (винаги работи)
#
# Изисквания:
#   • Изпълнява се САМО на production VPS-а (не на VM-а)
#   • Tailscale е активен (11-setup-tailscale.sh е run-нат)
#   • VM-ът също е настроен (има Tailscale + работещ сайт)
#
# Логика:
#   Browser → DNS → VPS → nginx → upstream {
#                                   primary: VM Tailscale IP (3s timeout)
#                                   backup:  127.0.0.1:8080 (local)
#                                 }
#
#   Local nginx сайтът се мести на порт 8080.
#   Public nginx (80/443) става reverse proxy.
#
# Usage: sudo bash 12-setup-failover.sh [vm-tailscale-ip]
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: трябва root. sudo bash $0"
    exit 1
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  KCY Failover Setup (VPS reverse proxy)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# ═══ STEP 1: Tailscale проверка ═══
if ! command -v tailscale >/dev/null 2>&1; then
    echo -e "${RED}✗ Tailscale не е инсталиран!${NC}"
    echo "  Първо пусни: sudo bash 11-setup-tailscale.sh"
    exit 1
fi

if ! tailscale status >/dev/null 2>&1; then
    echo -e "${RED}✗ Tailscale не е свързан!${NC}"
    echo "  Първо пусни: sudo tailscale up"
    exit 1
fi

VPS_TS_IP=$(tailscale ip -4 2>/dev/null | head -1)
echo -e "  ${GREEN}✓${NC} VPS Tailscale IP: ${VPS_TS_IP}"

# ═══ STEP 2: VM Tailscale IP ═══
VM_TS_IP="${1:-}"

if [ -z "$VM_TS_IP" ]; then
    echo ""
    echo "  Намирам VM Tailscale IP-та в мрежата..."
    echo ""
    # Покажи всички peers които не са VPS-а
    tailscale status --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    peers = data.get('Peer', {})
    if not peers:
        print('  (няма други Tailscale peers)')
    for k, p in peers.items():
        host = p.get('HostName', '?')
        ip = (p.get('TailscaleIPs') or ['?'])[0]
        online = '✓ online' if p.get('Online') else '✗ offline'
        print(f'    {host:25} {ip:18} {online}')
except Exception as e:
    print(f'  (грешка: {e})')
" 2>/dev/null || tailscale status

    echo ""
    read -p "  Въведи Tailscale IP на VM-а (примерно 100.64.0.5): " VM_TS_IP
fi

if [[ ! "$VM_TS_IP" =~ ^100\. ]]; then
    echo -e "${RED}✗ Невалиден Tailscale IP (трябва да започва с 100.):${NC} $VM_TS_IP"
    exit 1
fi

echo -e "  ${GREEN}✓${NC} VM Tailscale IP: ${VM_TS_IP}"

# Тест дали VM-а отговаря
echo ""
echo "  Тествам връзка към VM-а..."
if timeout 3 bash -c "echo > /dev/tcp/${VM_TS_IP}/80" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} VM отговаря на порт 80"
else
    echo -e "  ${YELLOW}!${NC} VM не отговаря на порт 80 в момента — продължавам, но failover ще е винаги на backup докато VM-а заработи"
fi

# ═══ STEP 3: Намери production домейна ═══
DOMAIN=""
for f in /etc/nginx/sites-available/*; do
    [ -f "$f" ] || continue
    D=$(grep -m1 'server_name' "$f" 2>/dev/null | awk '{print $2}' | tr -d ';')
    if [ -n "$D" ] && [ "$D" != "_" ] && [ "$D" != "localhost" ]; then
        DOMAIN="$D"
        break
    fi
done

if [ -z "$DOMAIN" ]; then
    DOMAIN="$(hostname -f 2>/dev/null || hostname)"
fi
echo -e "  ${GREEN}✓${NC} Production домейн: ${DOMAIN}"

# ═══ STEP 4: Backup на текущата nginx config ═══
echo ""
echo "  Backup на текущата nginx конфигурация..."
BACKUP_DIR="/var/backups/nginx-pre-failover-$(date +%s)"
mkdir -p "$BACKUP_DIR"
cp -r /etc/nginx/sites-available "$BACKUP_DIR/"
cp -r /etc/nginx/sites-enabled "$BACKUP_DIR/"
echo -e "  ${GREEN}✓${NC} Backup: ${BACKUP_DIR}"

# ═══ STEP 5: Премести съществуващия сайт на порт 8080 (backup сайт) ═══
echo ""
echo "  Преконфигурирам локалния nginx сайт на порт 8080 (backup)..."

SITE_FILE=""
for f in /etc/nginx/sites-enabled/*; do
    [ -L "$f" ] || [ -f "$f" ] || continue
    # Пропусни ако вече е renamed
    [ "$(basename $f)" = "kcy-failover" ] && continue
    if grep -q "server_name.*${DOMAIN}" "$f" 2>/dev/null; then
        SITE_FILE="$f"
        break
    fi
done

if [ -z "$SITE_FILE" ]; then
    # Намери първия не-default
    for f in /etc/nginx/sites-enabled/*; do
        [ "$(basename $f)" = "default" ] && continue
        [ "$(basename $f)" = "kcy-failover" ] && continue
        if [ -f "$f" ] || [ -L "$f" ]; then
            SITE_FILE="$f"
            break
        fi
    done
fi

if [ -z "$SITE_FILE" ]; then
    echo -e "${RED}✗ Не намерих nginx сайт за конвертиране.${NC}"
    echo "  Първо изпълни обикновен deploy за да има базов site."
    exit 1
fi

REAL_SITE_FILE=$(readlink -f "$SITE_FILE" 2>/dev/null || echo "$SITE_FILE")
echo "  Site file: $REAL_SITE_FILE"

# Замени listen 80; → listen 8080;
# Замени listen 443 ssl; → нищо (backup-ът не нуждае от SSL — само за вътрешна работа)
sed -i.bak \
    -e 's/^\(\s*\)listen 80;/\1listen 127.0.0.1:8080;/' \
    -e 's/^\(\s*\)listen \[::\]:80;/\1listen [::1]:8080;/' \
    -e 's/^\(\s*\)listen 443.*ssl.*;.*$/\1listen 127.0.0.1:8443 ssl;/' \
    -e 's/^\(\s*\)listen \[::\]:443.*ssl.*;.*$/\1listen [::1]:8443 ssl;/' \
    "$REAL_SITE_FILE"

# Премахни return 301 → https (защото локалният сайт няма SSL)
sed -i 's|^\(\s*\)return 301 https://.*|\1# return 301 (disabled for failover backup);|' "$REAL_SITE_FILE"

echo -e "  ${GREEN}✓${NC} Локалният сайт сега слуша на 127.0.0.1:8080"

# ═══ STEP 6: Създай нов failover reverse proxy сайт ═══
echo ""
echo "  Създавам failover reverse proxy на порт 80/443..."

# Намери SSL certificate ако има
SSL_CERT=""
SSL_KEY=""
for cert in /etc/letsencrypt/live/${DOMAIN}/fullchain.pem; do
    if [ -f "$cert" ]; then
        SSL_CERT="$cert"
        SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
        break
    fi
done

cat > /etc/nginx/sites-available/kcy-failover << NGINX_EOF
# KCY Ecosystem — Failover reverse proxy
# Генериран от 12-setup-failover.sh.
# Маршрутизира към VM (primary) или local (backup).
#
# VM Tailscale IP:  ${VM_TS_IP}
# Local backup:     127.0.0.1:8080

upstream kcy_backend {
    # Primary — VM в домашната мрежа през Tailscale
    server ${VM_TS_IP}:80 max_fails=2 fail_timeout=10s;

    # Backup — локалният nginx на VPS-а (винаги наличен)
    server 127.0.0.1:8080 backup;

    # Кеш на връзките за по-бърз retry
    keepalive 16;
}

# HTTP — redirect към HTTPS (ако имаме SSL)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

NGINX_EOF

if [ -n "$SSL_CERT" ]; then
    cat >> /etc/nginx/sites-available/kcy-failover << 'NGINX_EOF'
    # Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
NGINX_EOF
else
    cat >> /etc/nginx/sites-available/kcy-failover << 'NGINX_EOF'
    location / {
        proxy_pass http://kcy_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Failover поведение
        proxy_connect_timeout 3s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;

        # WebSocket поддръжка
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
NGINX_EOF
fi

cat >> /etc/nginx/sites-available/kcy-failover << NGINX_EOF
}

NGINX_EOF

# HTTPS блок ако има SSL
if [ -n "$SSL_CERT" ]; then
cat >> /etc/nginx/sites-available/kcy-failover << NGINX_EOF
# HTTPS — главен proxy
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
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Failover поведение
        proxy_connect_timeout 3s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;

        # WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_EOF
fi

# Status endpoint за мониторинг
cat >> /etc/nginx/sites-available/kcy-failover << NGINX_EOF

# Internal health check endpoint (само от localhost)
server {
    listen 127.0.0.1:8090;
    server_name _;
    location /status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/kcy-failover /etc/nginx/sites-enabled/kcy-failover
echo -e "  ${GREEN}✓${NC} kcy-failover конфиг създаден"

# ═══ STEP 7: Test + Reload ═══
echo ""
echo "  Тествам nginx конфигурация..."
if nginx -t 2>&1 | tail -5; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓${NC} nginx reloaded"
else
    echo -e "  ${RED}✗${NC} nginx config грешка! Връщам backup."
    rm /etc/nginx/sites-enabled/kcy-failover
    cp "$BACKUP_DIR/sites-available/"* /etc/nginx/sites-available/
    nginx -t && systemctl reload nginx
    exit 1
fi

# ═══ FINAL ═══
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ FAILOVER АКТИВИРАН                                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Public:    ${GREEN}http://${DOMAIN}/${NC}  и  ${GREEN}https://${DOMAIN}/${NC}"
echo -e "  Primary:   ${GREEN}${VM_TS_IP}:80${NC}  (VM в домашната мрежа)"
echo -e "  Backup:    ${GREEN}127.0.0.1:8080${NC}  (локалният VPS сайт)"
echo ""
echo -e "${CYAN}Как работи:${NC}"
echo "  • Browser → DNS → VPS → reverse proxy"
echo "  • Опит към VM (3s timeout)"
echo "  • Ако работи → препраща към VM"
echo "  • Ако не работи (timeout/5xx) → backup на VPS"
echo "  • Автоматично се връща на VM когато се възстанови"
echo ""
echo -e "${CYAN}Тест:${NC}"
echo "  Спри nginx на VM-а:  ssh deploy@vm 'sudo systemctl stop nginx'"
echo "  Отвори:              ${DOMAIN} → би трябвало да виждаш backup сайта"
echo "  Пусни nginx на VM-а: ssh deploy@vm 'sudo systemctl start nginx'"
echo "  Изчакай 10s, refresh → primary е активен"
echo ""
echo -e "${CYAN}Disable failover (връщане към обикновен setup):${NC}"
echo "  sudo bash ${BASH_SOURCE[0]} --disable"
echo ""
