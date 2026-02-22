#!/bin/bash
# Version: 1.0085
##############################################################################
# KCY Ecosystem - Server Install Script
# sudo bash server-install.sh
#
# Маппинг проект → сървър (1:1):
#   public/          → /var/www/html/
#   private/         → /var/www/kcy-ecosystem/private/
#   deploy-scripts/  → /var/www/kcy-ecosystem/deploy-scripts/
#   docs/            → /var/www/kcy-ecosystem/docs/
#   tests/           → /var/www/kcy-ecosystem/tests/
#   *.js, *.json     → /var/www/kcy-ecosystem/
#
# .env: /var/www/kcy-ecosystem/private/configs/.env (глобален, един за всички)
#
# Логика:
#   - Няма файлове в целевите директории → инсталира без въпроси
#   - Има файлове → пита: изтрий наново или презаписвай
#   - Проверява за .env в staging, ако няма → пита откъде
##############################################################################

set -e

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: sudo bash $0"
    exit 1
fi

# ═══ CONFIG ═══
SVC_USER="kcy"
SVC_GROUP="kcy"
STAGING="/var/www/deploy"
WEB_ROOT="/var/www/html"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
DOMAIN="alsec.strangled.net"
EMAIL="admin@alsec.strangled.net"
CHAT_PORT=3000
ECO3_PORT=3001

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; NC='\033[0m'

print_step() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   KCY Ecosystem - Server Install v1.0085      ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Service user: ${GREEN}${SVC_USER}${NC}"
echo -e "  Staging:      ${GREEN}${STAGING}${NC}"
echo -e "  Web root:     ${GREEN}${WEB_ROOT}${NC}"
echo -e "  Project:      ${GREEN}${PROJECT_DIR}${NC}"
echo -e "  Private:      ${GREEN}${PRIVATE_DIR}${NC}"
echo -e "  Global .env:  ${GREEN}${GLOBAL_ENV}${NC}"
echo -e "  Domain:       ${GREEN}${DOMAIN}${NC}"
echo ""

# ═══ Verify staging ═══
if [ ! -d "$STAGING/public" ] || [ ! -d "$STAGING/private" ]; then
    echo -e "${RED}✗ Staging is empty! Run deploy.sh first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Staging files found${NC}"

# ═══ Domain override ═══
read -p "Domain [$DOMAIN]: " NEW_DOMAIN
[ -n "$NEW_DOMAIN" ] && DOMAIN="$NEW_DOMAIN"
read -p "Email for SSL [$EMAIL]: " NEW_EMAIL
[ -n "$NEW_EMAIL" ] && EMAIL="$NEW_EMAIL"

##############################################################################
# STEP 1: Create system user
##############################################################################
print_step "STEP 1/8: System user '${SVC_USER}'"

if id "$SVC_USER" &>/dev/null; then
    echo -e "${GREEN}  ✓ User '${SVC_USER}' exists${NC}"
else
    useradd --system --no-create-home --shell /usr/sbin/nologin \
        --comment "KCY Ecosystem Service" "$SVC_USER"
    echo -e "${GREEN}  ✓ User '${SVC_USER}' created${NC}"
fi
usermod -aG "$SVC_GROUP" deploy 2>/dev/null || true

##############################################################################
# STEP 2: Check target directories & decide install mode
##############################################################################
print_step "STEP 2/8: Check existing files"

WEB_HAS_FILES=false
PROJECT_HAS_FILES=false
INSTALL_MODE="clean"

if [ -d "$WEB_ROOT" ] && [ "$(ls -A $WEB_ROOT 2>/dev/null)" ]; then
    WEB_HAS_FILES=true
fi
if [ -d "$PRIVATE_DIR" ] && [ "$(ls -A $PRIVATE_DIR 2>/dev/null)" ]; then
    PROJECT_HAS_FILES=true
fi

if [ "$WEB_HAS_FILES" = true ] || [ "$PROJECT_HAS_FILES" = true ]; then
    echo -e "${YELLOW}  Намерени са съществуващи файлове:${NC}"
    [ "$WEB_HAS_FILES" = true ] && echo -e "    ${WEB_ROOT}/ — $(ls -1 $WEB_ROOT | wc -l) items"
    [ "$PROJECT_HAS_FILES" = true ] && echo -e "    ${PRIVATE_DIR}/ — $(ls -1 $PRIVATE_DIR | wc -l) items"
    echo ""
    echo -e "${CYAN}  Какво да направя?${NC}"
    echo -e "    ${GREEN}1)${NC} Изтрий всичко и инсталирай наново (clean install)"
    echo -e "    ${GREEN}2)${NC} Остави и презаписвай (overwrite/merge)"
    echo ""
    read -p "  Избор [1/2]: " CHOICE

    case "$CHOICE" in
        1)
            INSTALL_MODE="clean"
            echo ""
            echo -e "${RED}  ⚠️  Това ще изтрие ВСИЧКО в:${NC}"
            echo -e "${RED}    ${WEB_ROOT}/${NC}"
            echo -e "${RED}    ${PROJECT_DIR}/${NC}"
            echo ""
            read -p "  Сигурен ли си? (yes/no): " CONFIRM
            if [ "$CONFIRM" != "yes" ]; then
                echo "  Отменено."
                exit 0
            fi
            echo -e "  ${YELLOW}Изтриване...${NC}"
            rm -rf "${WEB_ROOT:?}"/*
            rm -rf "${PROJECT_DIR:?}"/*
            echo -e "  ${GREEN}✓ Изчистено${NC}"
            ;;
        2)
            INSTALL_MODE="overwrite"
            echo -e "  ${GREEN}✓ Overwrite mode${NC}"
            ;;
        *)
            echo "  Невалиден избор."
            exit 1
            ;;
    esac
else
    echo -e "${GREEN}  ✓ Целевите директории са празни — инсталиране без въпроси${NC}"
fi

##############################################################################
# STEP 3: Check .env in staging
##############################################################################
print_step "STEP 3/8: Check .env"

STAGING_ENV="$STAGING/private/configs/.env"

if [ -f "$GLOBAL_ENV" ]; then
    echo -e "  ${GREEN}✓ .env вече е на сървъра: ${GLOBAL_ENV}${NC}"
elif [ -f "$STAGING_ENV" ]; then
    echo -e "  ${GREEN}✓ .env намерен в staging — ще се копира${NC}"
else
    echo -e "  ${YELLOW}! .env НЯМА в staging и няма на сървъра${NC}"
    echo ""
    echo -e "  ${CYAN}Откъде да взема .env?${NC}"
    echo -e "    ${GREEN}1)${NC} Подай път до .env файл или директория с .env"
    echo -e "    ${GREEN}2)${NC} Пропусни (ще го създадеш ръчно по-късно)"
    echo ""
    read -p "  Избор [1/2]: " ENV_CHOICE

    case "$ENV_CHOICE" in
        1)
            read -p "  Път: " ENV_PATH
            if [ -f "$ENV_PATH/.env" ]; then
                mkdir -p "$STAGING/private/configs"
                cp "$ENV_PATH/.env" "$STAGING_ENV"
                echo -e "  ${GREEN}✓ Копиран от ${ENV_PATH}/.env${NC}"
            elif [ -f "$ENV_PATH" ]; then
                mkdir -p "$STAGING/private/configs"
                cp "$ENV_PATH" "$STAGING_ENV"
                echo -e "  ${GREEN}✓ Копиран от ${ENV_PATH}${NC}"
            else
                echo -e "  ${RED}✗ Не е намерен${NC}"
            fi
            ;;
        2)
            echo -e "  ${YELLOW}  Пропуснато. Създай ръчно: nano ${GLOBAL_ENV}${NC}"
            ;;
    esac
fi

##############################################################################
# STEP 4: Copy files from staging (1:1)
##############################################################################
print_step "STEP 4/8: Copying files (1:1 mapping)"

mkdir -p "$WEB_ROOT" "$PROJECT_DIR" "$PRIVATE_DIR" /var/log/kcy-ecosystem

# public/ → /var/www/html/
echo -e "  ${YELLOW}public/ → ${WEB_ROOT}${NC}"
rsync -a "$STAGING/public/" "$WEB_ROOT/"

# private/ → /var/www/kcy-ecosystem/private/
echo -e "  ${YELLOW}private/ → ${PRIVATE_DIR}${NC}"
rsync -a \
    --exclude='node_modules/' \
    --exclude='database/*.sqlite' \
    --exclude='database/*.db' \
    --exclude='uploads/*' \
    --exclude='logs/*.log' \
    "$STAGING/private/" "$PRIVATE_DIR/"

# .env — copy only if in staging AND not already on server
if [ -f "$STAGING_ENV" ] && [ ! -f "$GLOBAL_ENV" ]; then
    mkdir -p "$(dirname "$GLOBAL_ENV")"
    cp "$STAGING_ENV" "$GLOBAL_ENV"
    chmod 600 "$GLOBAL_ENV"
    echo -e "  ${GREEN}✓ .env → ${GLOBAL_ENV}${NC}"
elif [ -f "$GLOBAL_ENV" ]; then
    echo -e "  ${YELLOW}  .env вече съществува — НЕ се презаписва${NC}"
fi

# Symlinks: chat/configs/.env → ../../configs/.env
for svc in chat eco-3; do
    svc_configs="$PRIVATE_DIR/$svc/configs"
    mkdir -p "$svc_configs"
    # Remove old .env file if it's not a symlink
    [ -f "$svc_configs/.env" ] && [ ! -L "$svc_configs/.env" ] && \
        mv "$svc_configs/.env" "$svc_configs/.env.old.$(date +%s)"
    ln -sf "../../configs/.env" "$svc_configs/.env"
    echo -e "  ${GREEN}✓ $svc/configs/.env → ../../configs/.env${NC}"
done

# deploy-scripts/ → /var/www/kcy-ecosystem/deploy-scripts/
[ -d "$STAGING/deploy-scripts" ] && {
    echo -e "  ${YELLOW}deploy-scripts/ → ${PROJECT_DIR}/deploy-scripts/${NC}"
    rsync -a "$STAGING/deploy-scripts/" "$PROJECT_DIR/deploy-scripts/"
}

# docs/ → /var/www/kcy-ecosystem/docs/
[ -d "$STAGING/docs" ] && {
    echo -e "  ${YELLOW}docs/ → ${PROJECT_DIR}/docs/${NC}"
    rsync -a "$STAGING/docs/" "$PROJECT_DIR/docs/"
}

# tests/ → /var/www/kcy-ecosystem/tests/
[ -d "$STAGING/tests" ] && {
    echo -e "  ${YELLOW}tests/ → ${PROJECT_DIR}/tests/${NC}"
    rsync -a "$STAGING/tests/" "$PROJECT_DIR/tests/"
}

# Root config files
for f in package.json package-lock.json hardhat.config.js jest.config.js \
         jest.mobile.config.js jest.setup.js 00032.version .deployignore; do
    [ -f "$STAGING/$f" ] && cp "$STAGING/$f" "$PROJECT_DIR/$f"
done
echo -e "  ${GREEN}✓ Root config files copied${NC}"

echo -e "${GREEN}  ✓ All files copied${NC}"

##############################################################################
# STEP 5: Permissions
##############################################################################
print_step "STEP 5/8: Permissions (owner: ${SVC_USER})"

chown -R "${SVC_USER}:${SVC_GROUP}" "$WEB_ROOT"
chown -R "${SVC_USER}:${SVC_GROUP}" "$PROJECT_DIR"
chown -R "${SVC_USER}:${SVC_GROUP}" /var/log/kcy-ecosystem

# Public = readable
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

# Private = restricted
find "$PRIVATE_DIR" -type d -exec chmod 750 {} \;
find "$PRIVATE_DIR" -type f -exec chmod 640 {} \;
find "$PROJECT_DIR" -type f -name "*.sh" -exec chmod 750 {} \;

# .env = only kcy
[ -f "$GLOBAL_ENV" ] && chmod 600 "$GLOBAL_ENV"

# Writable dirs for services
for dir in "$PRIVATE_DIR/chat/uploads" "$PRIVATE_DIR/chat/database" \
           "$PRIVATE_DIR/eco-3/logs" /var/log/kcy-ecosystem; do
    mkdir -p "$dir"
    chown -R "${SVC_USER}:${SVC_GROUP}" "$dir"
    chmod 770 "$dir"
done

echo -e "${GREEN}  ✓ Permissions set${NC}"

##############################################################################
# STEP 6: Dependencies
##############################################################################
print_step "STEP 6/8: Dependencies"

apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx 2>/dev/null || true

if ! command -v node &>/dev/null; then
    echo -e "  ${YELLOW}Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi

echo -e "  ${GREEN}✓ Node $(node --version), npm $(npm --version)${NC}"

# npm install for each backend
for svc_dir in "$PRIVATE_DIR/chat" "$PRIVATE_DIR/eco-3"; do
    if [ -f "$svc_dir/package.json" ]; then
        svc_name=$(basename "$svc_dir")
        echo -e "  ${YELLOW}npm install: ${svc_name}...${NC}"
        cd "$svc_dir"
        sudo -u "$SVC_USER" npm install --production 2>&1 | tail -3
        echo -e "  ${GREEN}✓ ${svc_name}${NC}"
    fi
done

##############################################################################
# STEP 7: Nginx
##############################################################################
print_step "STEP 7/8: Nginx"

[ -f /etc/nginx/sites-enabled/default ] && \
    mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak 2>/dev/null || true

cat > /etc/nginx/sites-available/kcy-ecosystem << NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root ${WEB_ROOT}; }
    location / { return 301 https://\$server_name\$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    access_log /var/log/nginx/kcy-access.log;
    error_log /var/log/nginx/kcy-error.log;

    root ${WEB_ROOT};
    index index.html;
    client_max_body_size 100M;

    location / { try_files \$uri \$uri/ =404; }

    location /api/chat/ {
        proxy_pass http://127.0.0.1:${CHAT_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    location /api/eco3/ {
        proxy_pass http://127.0.0.1:${ECO3_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120;
    }

    location /shared/ {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        if (\$request_method = 'OPTIONS') { return 204; }
    }

    location ~ /\. { deny all; }
    location ~ \.(env|sql|sqlite|db)$ { deny all; }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/kcy-ecosystem /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo -e "${GREEN}  ✓ Nginx configured${NC}"

##############################################################################
# STEP 8: Systemd + SSL + Firewall
##############################################################################
print_step "STEP 8/8: Services, SSL, Firewall"

# ── Chat service ──
cat > /etc/systemd/system/kcy-chat.service << SVCEOF
[Unit]
Description=KCY Chat Backend
After=network.target postgresql.service

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${PRIVATE_DIR}/chat
EnvironmentFile=${GLOBAL_ENV}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kcy-chat
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
SVCEOF

# ── ECO-3 service ──
cat > /etc/systemd/system/kcy-eco3.service << SVCEOF
[Unit]
Description=KCY ECO-3 AI Studio Backend
After=network.target

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${PRIVATE_DIR}/eco-3
EnvironmentFile=${GLOBAL_ENV}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kcy-eco3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable kcy-chat.service kcy-eco3.service

echo -e "  ${YELLOW}Starting kcy-chat...${NC}"
systemctl restart kcy-chat.service 2>/dev/null || true
if systemctl is-active --quiet kcy-chat.service; then
    echo -e "  ${GREEN}✓ kcy-chat running${NC}"
else
    echo -e "  ${YELLOW}! kcy-chat не тръгна — journalctl -u kcy-chat -n 20${NC}"
fi

echo -e "  ${YELLOW}Starting kcy-eco3...${NC}"
systemctl restart kcy-eco3.service 2>/dev/null || true
if systemctl is-active --quiet kcy-eco3.service; then
    echo -e "  ${GREEN}✓ kcy-eco3 running${NC}"
else
    echo -e "  ${YELLOW}! kcy-eco3 не тръгна — journalctl -u kcy-eco3 -n 20${NC}"
fi

# ── SSL ──
if host "$DOMAIN" > /dev/null 2>&1; then
    echo -e "  ${YELLOW}SSL...${NC}"
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" 2>/dev/null || {
        echo -e "  ${YELLOW}! SSL failed — certbot --nginx -d ${DOMAIN}${NC}"
    }
    systemctl enable certbot.timer 2>/dev/null || true
fi

# ── Firewall ──
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    echo "y" | ufw enable 2>/dev/null || true
    echo -e "  ${GREEN}✓ Firewall: 22, 80, 443${NC}"
fi

# ── Helper scripts ──
cat > /usr/local/bin/kcy-status << 'HELPEREOF'
#!/bin/bash
echo "KCY Ecosystem Status"
echo "===================="
echo "Chat:     $(systemctl is-active kcy-chat.service)"
echo "ECO-3:    $(systemctl is-active kcy-eco3.service)"
echo "Nginx:    $(systemctl is-active nginx)"
echo "Postgres: $(systemctl is-active postgresql 2>/dev/null || echo 'n/a')"
echo ""
echo "Disk: $(df -h /var/www | tail -1 | awk '{print $3"/"$2" ("$5")"}')"
HELPEREOF
chmod +x /usr/local/bin/kcy-status

cat > /usr/local/bin/kcy-restart << 'HELPEREOF'
#!/bin/bash
echo "Restarting..."
systemctl restart kcy-chat.service kcy-eco3.service
systemctl reload nginx
echo "Done"
HELPEREOF
chmod +x /usr/local/bin/kcy-restart

##############################################################################
# DONE
##############################################################################
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ INSTALLATION COMPLETE${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Domain:   ${GREEN}https://${DOMAIN}${NC}"
echo -e "  User:     ${GREEN}${SVC_USER}${NC}"
echo -e "  Chat:     $(systemctl is-active kcy-chat.service) → :${CHAT_PORT}"
echo -e "  ECO-3:    $(systemctl is-active kcy-eco3.service) → :${ECO3_PORT}"
echo -e "  Nginx:    $(systemctl is-active nginx)"
echo ""
echo -e "${CYAN}Полезни команди:${NC}"
echo -e "  kcy-status                       Статус на всичко"
echo -e "  kcy-restart                      Рестарт на всичко"
echo -e "  journalctl -u kcy-chat -f        Chat логове (live)"
echo -e "  journalctl -u kcy-eco3 -f        ECO-3 логове (live)"
echo -e "  Global .env: ${YELLOW}nano ${GLOBAL_ENV}${NC}"
echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  СЛЕДВАЩА СТЪПКА: Инсталация на база данни за Chat${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Chat backend-ът изисква база данни (SQLite или PostgreSQL)."
echo -e "  Без нея Chat service-ът няма да тръгне."
echo -e "  ECO-3 НЕ изисква база — вече работи."
echo ""
echo -e "  ${YELLOW}cd ${PROJECT_DIR}/deploy-scripts/server${NC}"
echo -e "  ${YELLOW}sudo bash 01-setup-database.sh${NC}"
echo ""
echo -e "  Опции:"
echo -e "    без аргументи          Автоматичен избор (PostgreSQL ако е наличен, иначе SQLite)"
echo -e "    --force-sqlite         Принудително SQLite"
echo -e "    --force-postgresql     Принудително PostgreSQL"
echo -e "    --reset ?              Покажи help за reset на базата"
echo ""
