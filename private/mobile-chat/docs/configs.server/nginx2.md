<!-- Version: 1.0056 -->
# 1. Редактирай конфигурацията
sudo nano /etc/nginx/sites-available/ams-chat

# 2. Копирай ЦЯЛАТА конфигурация отгоре
# (Ctrl+K за изтриване на стари редове, после paste новата)

# 3. Save (Ctrl+X → Y → Enter)

# 4. Test config
sudo nginx -t

# 5. Reload Nginx
sudo systemctl reload nginx

# 6. Test API
curl https://alsec.strangled.net/api/health
# Трябва: {"status":"ok"}

CONFIG:
-----------------------------------------


# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name alsec.strangled.net;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS site
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name alsec.strangled.net;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/alsec-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/alsec-selfsigned.key;
    
    # SSL Security (optional but recommended)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # File upload limit
    client_max_body_size 10M;
    
    # Frontend (Static Files)
    location / {
        root /var/www/ams-chat-web/public;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API (ВАЖНО - БЕЗ ТОВА API НЕ РАБОТИ!)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket Support (ВАЖНО - БЕЗ ТОВА CHAT НЕ РАБОТИ!)
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}