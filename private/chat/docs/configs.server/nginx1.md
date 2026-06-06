<!-- Version: 1.0093 -->
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
curl https://${MAIN_DOMAIN}/api/health
# Трябва: {"status":"ok"}

CONFIG:
-----------------------------------------

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;

    server_name ${MAIN_DOMAIN};

    # Redirect all HTTP requests to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS site
server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name ${MAIN_DOMAIN};

    root /var/www/ams-chat-web/public/;
    index index.html index.htm;

    ssl_certificate /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;

    location / {
        try_files $uri $uri/ =404;
    }
}