<!-- Version: 1.0056 -->

# 🚀 СЛЕДВАЩИ СТЪПКИ ЗА PRODUCTION

## ✅ ИМАШ:
- Server ✓
- Домейн сочи към него ✓
- Код deployed ✓
- Тестове минават ✓

---

## 📋 КАКВО СЛЕДВА:

### **1. Конфигурирай .env файла**

```bash
cd /var/www/ams-chat-web
nano .env
```

**Попълни:**
```env
# Stripe LIVE keys
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY

# Домейн
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Твоя IP (намери на: https://whatismyipaddress.com/)
ADMIN_ALLOWED_IPS=127.0.0.1,::1,YOUR_IP
```

**Save:** `Ctrl+X` → `Y` → `Enter`

---

### **2. Стартирай Backend с PM2**

```bash
cd /var/www/ams-chat-web

# Инсталирай PM2 глобално (ако го няма)
sudo npm install -g pm2

# Стартирай
pm2 start server.js --name ams-chat

# Save config
pm2 save

# Auto-start при reboot
pm2 startup systemd
# Копирай и изпълни командата която PM2 показва!

# Провери статус
pm2 status
pm2 logs ams-chat
```

**Test:**
```bash
curl http://localhost:3000/api/health
# Трябва: {"status":"ok"}
```

---

### **3. Конфигурирай Nginx**

```bash
# Създай config
sudo nano /etc/nginx/sites-available/ams-chat
```

**Paste (ПРОМЕНИ yourdomain.com):**
```nginx
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
```

**Активирай:**
```bash
# Symbolic link
sudo ln -s /etc/nginx/sites-available/ams-chat /etc/nginx/sites-enabled/

# Премахни default (опционално)
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

**Test:**
```bash
# Отвори в браузър
http://yourdomain.com
# Трябва да видиш login страница!
```

---

### **4. Инсталирай SSL (HTTPS) - ЗАДЪЛЖИТЕЛНО!**

```bash
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
```

**Test:**
```bash
# Отвори в браузър
https://yourdomain.com
# Трябва да видиш зелен катинар! 🔒
```

---

### **5. Firewall (Ако не е настроен)**

```bash
# Allow ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# Enable
sudo ufw enable

# Check status
sudo ufw status
```

---

## ✅ ФИНАЛНА ПРОВЕРКА:

```bash
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
```

**Трябва да видиш:**
- ✅ Login страница
- ✅ Зелен катинар (SSL)
- ✅ Без грешки в конзолата

---

## 📝 КОМАНДИ ЗА УПРАВЛЕНИЕ:

```bash
# Restart backend
pm2 restart ams-chat

# Виж logs
pm2 logs ams-chat

# Restart Nginx
sudo systemctl restart nginx

# Виж Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 ЗА UPDATES:

```bash
cd /var/www/ams-chat-web
git pull
npm install --production
pm2 restart ams-chat
cat *.version  # Провери версията
```

---

**Готов си! Сайтът е deployed на production! 🎉**

Следва да тестваш:
1. Регистрация на user
2. Login
3. Stripe payment
4. Search функционалност
5. Emergency button


# 1. Pull промените
cd /var/www/ams-chat-web
git pull

# 2. Restart
pm2 flush
pm2 restart ams-chat

# 3. Check
pm2 status
# Should show: online ✅

# 4. Test
curl http://localhost:3000/api/health
# Should show: {"status":"ok"}

# 5. Check version
cat *.version
# Should show: 00003.version

pm2 logs ams-chat
# Не трябва да има errors
pm2 logs ams-chat --lines 50
# Или виж само ERROR лога
tail -f /root/.pm2/logs/ams-chat-error.log



-------------------------------

# Виж PM2 процесите
pm2 list

# Виж какъв е startup
pm2 startup


# Спри всички процеси (ако има)
pm2 kill

# Изчисти startup
pm2 unstartup systemd

# Виж дали има systemd service
systemctl status pm2-root
systemctl status pm2-deploy

-----------------------

# Switch към ams-chat
sudo -u ams-chat -s

# Отиди в проекта
cd /var/www/ams-chat-web

# Стартирай
pm2 start server.js --name ams-chat

# Save
pm2 save

# Setup startup
pm2 startup systemd
# КОПИРАЙ командата която показва!

# Exit
exit

