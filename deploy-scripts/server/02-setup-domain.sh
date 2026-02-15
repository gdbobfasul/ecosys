# Version: 1.0056
#!/bin/bash

##############################################################################
# KCY Ecosystem - Domain & Services Setup
# 
# Този скрипт:
# - Настройва Nginx
# - Конфигурира SSL (Let's Encrypt)
# - Създава systemd services
# - Настройва PM2 за Node.js apps
# - Конфигурира permissions
#
# Usage: sudo ./02-setup-domain.sh
##############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="alsec.strangled.net"
EMAIL="admin@alsec.strangled.net"  # For Let's Encrypt
PROJECT_DIR="/var/www/kcy-ecosystem"
WEB_ROOT="/var/www/html"
CHAT_DIR="$PROJECT_DIR/private/chat"
CHAT_PORT=3000

echo -e "${CYAN}========================================"
echo "  KCY Ecosystem - Domain & Services"
echo -e "========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}[ERROR] Please run as root (sudo)${NC}"
    exit 1
fi

# Prompt for domain (allow override)
echo -e "${YELLOW}Current domain: $DOMAIN${NC}"
read -p "Press Enter to use this domain, or type new domain: " NEW_DOMAIN
if [ ! -z "$NEW_DOMAIN" ]; then
    DOMAIN="$NEW_DOMAIN"
    echo -e "${GREEN}  Using domain: $DOMAIN${NC}"
fi

# Prompt for email
read -p "Email for SSL certificates [$EMAIL]: " NEW_EMAIL
if [ ! -z "$NEW_EMAIL" ]; then
    EMAIL="$NEW_EMAIL"
fi

echo ""
echo -e "${GREEN}[1/10] Installing required packages...${NC}"

apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx nodejs npm

echo -e "${GREEN}  ✓ Packages installed${NC}"

echo ""
echo -e "${GREEN}[2/10] Installing PM2 (Node.js process manager)...${NC}"

npm install -g pm2
pm2 startup systemd -u www-data --hp /var/www
echo -e "${GREEN}  ✓ PM2 installed${NC}"

echo ""
echo -e "${GREEN}[3/10] Setting up directories and permissions...${NC}"

# Create necessary directories
mkdir -p /var/www/html/downloads
mkdir -p /var/log/kcy-ecosystem
mkdir -p /var/run/kcy-ecosystem

# Set ownership
chown -R www-data:www-data /var/www/html
chown -R www-data:www-data $PROJECT_DIR
chown -R www-data:www-data /var/log/kcy-ecosystem

# Set permissions
find /var/www/html -type d -exec chmod 755 {} \;
find /var/www/html -type f -exec chmod 644 {} \;
find $PROJECT_DIR -type d -exec chmod 750 {} \;
find $PROJECT_DIR -type f -exec chmod 640 {} \;

# Make scripts executable
find $PROJECT_DIR -type f -name "*.sh" -exec chmod 750 {} \;

echo -e "${GREEN}  ✓ Permissions set${NC}"

echo ""
echo -e "${GREEN}[4/10] Configuring Nginx...${NC}"

# Backup default config
if [ -f /etc/nginx/sites-enabled/default ]; then
    mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup
fi

# Create Nginx config
cat > /etc/nginx/sites-available/kcy-ecosystem << 'NGINXEOF'
# KCY Ecosystem - Nginx Configuration

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    # SSL Configuration (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/kcy-ecosystem-access.log;
    error_log /var/log/nginx/kcy-ecosystem-error.log;

    # Root directory for static files
    root /var/www/html;
    index index.html;

    # Max upload size
    client_max_body_size 100M;

    # Static files (public directory)
    location / {
        try_files $uri $uri/ =404;
    }

    # Chat API Backend (reverse proxy to Node.js)
    location /api/chat/ {
        proxy_pass http://localhost:CHAT_PORT_PLACEHOLDER/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_read_timeout 86400;
    }

    # Shared resources CORS
    location /shared/ {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type";
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Downloads directory
    location /downloads/ {
        autoindex off;
        add_header Content-Disposition 'attachment';
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }

    # Deny access to sensitive files
    location ~ \.(env|sql|sqlite|db|config\.js|config\.json)$ {
        deny all;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

# Replace placeholders
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/kcy-ecosystem
sed -i "s/CHAT_PORT_PLACEHOLDER/$CHAT_PORT/g" /etc/nginx/sites-available/kcy-ecosystem

# Enable site
ln -sf /etc/nginx/sites-available/kcy-ecosystem /etc/nginx/sites-enabled/

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx

echo -e "${GREEN}  ✓ Nginx configured${NC}"

echo ""
echo -e "${GREEN}[5/10] Installing SSL certificates...${NC}"

# Check if domain resolves
if host $DOMAIN > /dev/null 2>&1; then
    echo -e "${CYAN}  Domain $DOMAIN resolves, installing SSL...${NC}"
    
    # Get SSL certificate
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL
    
    echo -e "${GREEN}  ✓ SSL certificate installed${NC}"
    
    # Set up auto-renewal
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    echo -e "${GREEN}  ✓ SSL auto-renewal enabled${NC}"
else
    echo -e "${YELLOW}  ! Domain $DOMAIN does not resolve yet${NC}"
    echo -e "${YELLOW}  ! SSL certificate installation skipped${NC}"
    echo -e "${YELLOW}  ! Run this after DNS is configured:${NC}"
    echo -e "${CYAN}    certbot --nginx -d $DOMAIN${NC}"
fi

echo ""
echo -e "${GREEN}[6/10] Installing Node.js dependencies...${NC}"

# Install chat dependencies
if [ -f "$CHAT_DIR/package.json" ]; then
    cd $CHAT_DIR
    sudo -u www-data npm install --production
    echo -e "${GREEN}  ✓ Chat dependencies installed${NC}"
fi

# Install root project dependencies
if [ -f "$PROJECT_DIR/package.json" ]; then
    cd $PROJECT_DIR
    sudo -u www-data npm install
    echo -e "${GREEN}  ✓ Root dependencies installed${NC}"
fi

echo ""
echo -e "${GREEN}[7/10] Creating systemd service for Chat...${NC}"

# Create systemd service
cat > /etc/systemd/system/kcy-chat.service << 'SERVICEEOF'
[Unit]
Description=KCY AMS Chat Node.js Application
Documentation=https://alsec.strangled.net/chat/
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/kcy-ecosystem/private/chat
Environment=NODE_ENV=production
EnvironmentFile=/var/www/kcy-ecosystem/private/chat/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kcy-chat

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/kcy-ecosystem/private/chat/database /var/www/kcy-ecosystem/private/chat/uploads

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable kcy-chat.service
systemctl start kcy-chat.service

# Check status
if systemctl is-active --quiet kcy-chat.service; then
    echo -e "${GREEN}  ✓ Chat service started${NC}"
else
    echo -e "${YELLOW}  ! Chat service failed to start${NC}"
    echo -e "${YELLOW}  Check logs: journalctl -u kcy-chat.service${NC}"
fi

echo ""
echo -e "${GREEN}[8/10] Setting up PM2 for additional services...${NC}"

# Save PM2 configuration
sudo -u www-data pm2 save

# Enable PM2 to start on boot
systemctl enable pm2-www-data

echo -e "${GREEN}  ✓ PM2 configured${NC}"

echo ""
echo -e "${GREEN}[9/10] Configuring firewall...${NC}"

if command -v ufw &> /dev/null; then
    # Allow SSH, HTTP, HTTPS
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable firewall (if not already)
    echo "y" | ufw enable || true
    
    echo -e "${GREEN}  ✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}  ! UFW not installed, skipping firewall${NC}"
fi

echo ""
echo -e "${GREEN}[10/10] Creating admin scripts...${NC}"

# Create quick status check script
cat > /usr/local/bin/kcy-status << 'STATUSEOF'
#!/bin/bash
echo "========================================="
echo "  KCY Ecosystem - System Status"
echo "========================================="
echo ""
echo "Services:"
systemctl status kcy-chat.service --no-pager -l | head -3
echo ""
echo "Nginx:"
systemctl status nginx --no-pager | head -3
echo ""
echo "PostgreSQL:"
systemctl status postgresql --no-pager | head -3
echo ""
echo "SSL Certificates:"
certbot certificates 2>/dev/null | grep "Expiry Date" || echo "  No certificates found"
echo ""
echo "Disk Usage:"
df -h /var/www | tail -1
echo ""
STATUSEOF

chmod +x /usr/local/bin/kcy-status

# Create restart script
cat > /usr/local/bin/kcy-restart << 'RESTARTEOF'
#!/bin/bash
echo "Restarting KCY services..."
systemctl restart kcy-chat.service
systemctl reload nginx
echo "✓ Services restarted"
RESTARTEOF

chmod +x /usr/local/bin/kcy-restart

echo -e "${GREEN}  ✓ Admin scripts created${NC}"
echo -e "${CYAN}    - kcy-status  (check system status)${NC}"
echo -e "${CYAN}    - kcy-restart (restart services)${NC}"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  ✓ SETUP COMPLETE!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Final status
echo -e "${CYAN}System Information:${NC}"
echo -e "  Domain: ${GREEN}https://$DOMAIN${NC}"
echo -e "  Web Root: $WEB_ROOT"
echo -e "  Project: $PROJECT_DIR"
echo -e "  Chat Service: $(systemctl is-active kcy-chat.service)"
echo -e "  Nginx: $(systemctl is-active nginx)"
echo -e "  PostgreSQL: $(systemctl is-active postgresql)"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Update config.js with correct contract addresses"
echo -e "  2. Upload mobile app APK to /var/www/html/downloads/"
echo -e "  3. Test website: ${GREEN}https://$DOMAIN${NC}"
echo -e "  4. Check logs: ${CYAN}journalctl -u kcy-chat.service -f${NC}"
echo -e "  5. Monitor status: ${CYAN}kcy-status${NC}"
echo ""

# Save configuration
cat > "$PROJECT_DIR/deployment-info.txt" << INFOEOF
KCY Ecosystem Deployment Information
=====================================

Domain: $DOMAIN
Deployed: $(date)

Services:
- Chat API: http://localhost:$CHAT_PORT (proxied via Nginx)
- Web: https://$DOMAIN

Directories:
- Web Root: $WEB_ROOT
- Project: $PROJECT_DIR
- Chat: $CHAT_DIR

Admin Commands:
- Check status: kcy-status
- Restart services: kcy-restart
- View chat logs: journalctl -u kcy-chat.service -f
- View nginx logs: tail -f /var/log/nginx/kcy-ecosystem-error.log

SSL Certificate:
- Domain: $DOMAIN
- Email: $EMAIL
- Renewal: Automatic (certbot.timer)

Database:
- See: $PROJECT_DIR/database-credentials.txt

=====================================
INFOEOF

echo -e "${GREEN}Deployment info saved to: $PROJECT_DIR/deployment-info.txt${NC}"
echo ""
