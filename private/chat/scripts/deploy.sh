# Version: 1.0056
#!/bin/bash

# KCY Chat Deployment Script
# Usage: ./deploy.sh [server_ip] [ssh_user]

set -e

SERVER_IP=$1
SSH_USER=${2:-root}
APP_NAME="ams-chat"
APP_DIR="/var/www/$APP_NAME"
REPO_URL="YOUR_GIT_REPO_URL"  # Update this!

if [ -z "$SERVER_IP" ]; then
    echo "❌ Error: Server IP required"
    echo "Usage: ./deploy.sh [server_ip] [ssh_user]"
    exit 1
fi

echo "🚀 Deploying KCY Chat to $SERVER_IP"
echo "=================================="

# Function to run commands on remote server
remote_exec() {
    ssh $SSH_USER@$SERVER_IP "$@"
}

# 1. Install dependencies on server
echo "📦 Installing dependencies..."
remote_exec "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs postgresql postgresql-contrib nginx certbot python3-certbot-nginx && \
    npm install -g pm2"

# 2. Setup PostgreSQL
echo "🗄️  Setting up PostgreSQL..."
remote_exec "sudo -u postgres psql -c \"CREATE DATABASE amschat;\" || true"

# 3. Clone or pull repository
echo "📥 Cloning/updating repository..."
remote_exec "if [ -d $APP_DIR ]; then \
    cd $APP_DIR && git pull; \
else \
    git clone $REPO_URL $APP_DIR; \
fi"

# 4. Install npm packages
echo "📦 Installing npm packages..."
remote_exec "cd $APP_DIR && npm install --production"

# 5. Setup database
echo "🗄️  Setting up database schema..."
remote_exec "cd $APP_DIR && sudo -u postgres psql -d amschat -f database/db_setup.sql"

# 6. Check .env file
echo "⚙️  Checking .env configuration..."
remote_exec "cd $APP_DIR && if [ ! -f .env ]; then \
    cp .env.example .env; \
    echo '⚠️  .env file created from example. Please edit it!'; \
    echo '⚠️  SSH to server and run: nano $APP_DIR/.env'; \
fi"

# 7. Start/restart with PM2
echo "🔄 Starting application with PM2..."
remote_exec "cd $APP_DIR && pm2 delete $APP_NAME || true && \
    pm2 start server.js --name $APP_NAME && \
    pm2 save && \
    pm2 startup | grep 'sudo' | bash"

# 8. Setup Nginx (basic config)
echo "🌐 Setting up Nginx..."
remote_exec "cat > /etc/nginx/sites-available/$APP_NAME <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF"

remote_exec "ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/ && \
    nginx -t && \
    systemctl restart nginx"

# 9. Setup firewall
echo "🔥 Configuring firewall..."
remote_exec "ufw allow 22 && \
    ufw allow 80 && \
    ufw allow 443 && \
    ufw --force enable"

echo ""
echo "✅ Deployment complete!"
echo "=================================="
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. SSH to server: ssh $SSH_USER@$SERVER_IP"
echo "2. Edit .env file: nano $APP_DIR/.env"
echo "3. Add your Stripe keys and database credentials"
echo "4. Restart app: pm2 restart $APP_NAME"
echo "5. Setup SSL: certbot --nginx -d yourdomain.com"
echo ""
echo "📊 Monitor app:"
echo "   pm2 logs $APP_NAME"
echo "   pm2 monit"
echo ""
echo "🌐 Access app: http://$SERVER_IP"
echo ""
