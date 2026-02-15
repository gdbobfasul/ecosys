<!-- Version: 1.0056 -->


# Създай config
sudo nano /etc/nginx/sites-available/ams-chat

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend (Static files)
    location / {
        root /var/www/ams-chat-web/public;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }

    client_max_body_size 10M;
}


# Symbolic link
sudo ln -s /etc/nginx/sites-available/ams-chat /etc/nginx/sites-enabled/

# Премахни default (опционално)
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart
sudo systemctl restart nginx

# Отвори в браузър
http://yourdomain.com
# Трябва да видиш login страница!

# Инсталирай Certbot (ако го няма)
sudo apt install certbot python3-certbot-nginx

# Генерирай SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Следвай prompts:
# Email: your@email.com
# Agree: Y
# Redirect HTTP to HTTPS: 2 (Yes)

# Test auto-renewal
sudo certbot renew --dry-run

# Отвори в браузър
https://yourdomain.com
# Трябва да видиш зелен катинар! 🔒



Firewall (Ако не е настроен)
# Allow ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# Enable
sudo ufw enable

# Check status
sudo ufw status

# 1. Backend работи?
pm2 status
# Should show: ams-chat | online

# 2. Nginx работи?
sudo systemctl status nginx
# Should show: active (running)

# 3. SSL работи?
curl -I https://yourdomain.com
# Should show: HTTP/2 200

# 4. API работи?
curl https://yourdomain.com/api/health
# Should show: {"status":"ok"}

# 5. Version deployed?
cat /var/www/ams-chat-web/*.version
# Should show: 00002.version
```

---

## 🎯 ГОТОВО! САЙТЪТ Е LIVE!

**Отвори в браузър:**
```
https://yourdomain.com



📝 КОМАНДИ ЗА УПРАВЛЕНИЕ:
bash# Restart backend
pm2 restart ams-chat

# Виж logs
pm2 logs ams-chat

# Restart Nginx
sudo systemctl restart nginx

# Виж Nginx logs
sudo tail -f /var/log/nginx/error.log

🔄 ЗА UPDATES:
bashcd /var/www/ams-chat-web
git pull
npm install --production
pm2 restart ams-chat
cat *.version  # Провери версията
