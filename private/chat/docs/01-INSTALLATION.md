<!-- Version: 1.0056 -->
# 01 - Инсталация (Production Server)

## 📦 Системни изисквания

- **Node.js:** >= 18.x (препоръчвам 18.20.8)
- **npm:** >= 8.x
- **SQLite3:** >= 3.45.x
- **Git:** Последна версия
- **PM2:** За process management
- **Nginx:** За reverse proxy
- **OS:** Linux (Ubuntu 20.04+ / Debian)

---

## 🔧 Стъпка 1: Клониране на проекта

### **Препоръчван метод: Git Clone**

```bash
# SSH към сървъра
ssh user@your-server

# Отиди в /var/www
cd /var/www

# Clone проекта
sudo git clone https://github.com/YOUR_USERNAME/web.git ams-chat-web

# Промени ownership
sudo chown -R $USER:$USER ams-chat-web

# Влез в проекта
cd ams-chat-web
```

### **Алтернатива: Архив upload**

```bash
# На локалния компютър
scp AMS-Chat.rar user@server:/tmp/

# На сървъра
cd /tmp
unrar x AMS-Chat.rar
sudo mv 2026-01-21-AMS-chat-web /var/www/ams-chat-web
sudo chown -R $USER:$USER /var/www/ams-chat-web
```

---

## 📥 Стъпка 2: Инсталация на зависимости

```bash
cd /var/www/ams-chat-web
npm install --production
```

**Основни пакети:**
- `express` - Web framework
- `better-sqlite3` - SQLite database
- `bcrypt` - Password hashing
- `multer` - File uploads
- `stripe` - Payments
- `ws` - WebSocket за real-time chat
- `uuid` - Unique IDs
- `geoip-lite` - IP geolocation
- `helmet` - Security headers
- `cors` - Cross-origin requests
- `dotenv` - Environment variables

---

## 🗄️ Стъпка 3: Инициализиране на базата

```bash
# Създай базата данни
sqlite3 database/amschat.db < db_setup.sql

# Seed emergency contacts
sqlite3 database/amschat.db < emergency_contacts_seed.sql

# Провери таблиците
sqlite3 database/amschat.db "SELECT name FROM sqlite_master WHERE type='table';"
```

**Очакван резултат:**
```
users
sessions
friends
messages
temp_files
payment_logs
critical_words
flagged_conversations
reports
admin_users
emergency_contacts
help_requests
```

**Провери emergency contacts:**
```bash
sqlite3 database/amschat.db "SELECT COUNT(*) FROM emergency_contacts;"
# Трябва да покаже ~74 записа
```

**Set permissions:**
```bash
chmod 644 amschat.db
```

---

## ⚙️ Стъпка 4: Конфигурация (.env файл)

```bash
# Копирай template
cp scripts/.env.example .env

# Редактирай
nano .env
```

**Production конфигурация:**
```env
# Stripe (ВАЖНО: live keys за production!)
STRIPE_SECRET_KEY=sk_live_YOUR_REAL_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_REAL_KEY

# Server
PORT=3000
NODE_ENV=production

# CORS (добави твоя домейн!)
ALLOWED_ORIGINS=https://alsec.strangled.net,https://www.alsec.strangled.net

# Admin IP Protection (добави твоя IP!)
# Намери IP: https://whatismyipaddress.com/
ADMIN_ALLOWED_IPS=127.0.0.1,::1,YOUR_IP_ADDRESS
```

**Save:** `Ctrl+X` → `Y` → `Enter`

**Set permissions:**
```bash
chmod 600 .env
```

**Виж [03-ENVIRONMENT.md](./03-ENVIRONMENT.md) за пълен списък.**

---

## 📁 Стъпка 5: Създай uploads директория

```bash
mkdir -p uploads
chmod 777 uploads
```

---

## 🚀 Стъпка 6: Стартиране с PM2

### **Install PM2:**
```bash
sudo npm install -g pm2
```

### **Start server:**
```bash
cd /var/www/ams-chat-web

# Start
pm2 start server.js --name ams-chat

# Save PM2 config
pm2 save

# Setup auto-start при reboot
pm2 startup systemd
# Копирай и изпълни командата която PM2 ти даде!
```

### **PM2 команди:**
```bash
pm2 status              # Виж статус
pm2 logs ams-chat       # Виж logs
pm2 restart ams-chat    # Рестартирай
pm2 stop ams-chat       # Спри
pm2 delete ams-chat     # Изтрий process
```

---

## ✅ Стъпка 7: Проверка

### **Test backend:**
```bash
curl http://localhost:3000/api/health
# Трябва да върне: {"status":"ok"}
```

### **Check PM2:**
```bash
pm2 status
# Трябва да видиш 'ams-chat' online
```

### **Check logs:**
```bash
pm2 logs ams-chat --lines 50
```

---

## 🌐 Стъпка 8: Nginx Setup

### **Install Nginx:**
```bash
sudo apt-get update
sudo apt-get install nginx
```

### **Create config:**
```bash
sudo nano /etc/nginx/sites-available/ams-chat
```

**Paste:**
```nginx
server {
    listen 80;
    server_name alsec.strangled.net www.alsec.strangled.net;

    # Web Frontend (Static Files)
    location / {
        root /var/www/ams-chat-web/public;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API Backend (Proxy to Node.js)
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

    # WebSocket Support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # File Uploads
    client_max_body_size 10M;
}
```

### **Activate:**
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/ams-chat /etc/nginx/sites-enabled/

# Remove default (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 🔒 Стъпка 9: SSL Setup (HTTPS)

**Geolocation API изисква HTTPS на production!**

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d alsec.strangled.net -d www.alsec.strangled.net

# Follow prompts:
# - Email: your@email.com
# - Agree to terms: Y
# - Redirect HTTP to HTTPS: 2 (Yes)

# Test auto-renewal
sudo certbot renew --dry-run
```

**Certbot автоматично:**
- Създава SSL сертификати
- Обновява Nginx config
- Setup auto-renewal

---

## 🔄 Updates (Git Pull)

```bash
# SSH към сървъра
ssh user@server

# Pull промените
cd /var/www/ams-chat-web
git pull

# Install нови dependencies (ако има)
npm install --production

# Restart backend
pm2 restart ams-chat

# Check version
cat *.version
# Ще видиш номера на версията (напр. 00002.version)
```

---

## 📂 Финална структура

```
/var/www/ams-chat-web/
├── server.js              # Backend entry point
├── package.json
├── amschat.db           # SQLite database
├── .env                  # Environment config (НЕ в Git!)
├── 00001.version         # Version tracking
├── docs/                 # Documentation
├── middleware/           # Auth, monitoring
├── public/               # Frontend HTML/CSS/JS
│   ├── index.html       # Login page (главна страница)
│   ├── chat.html
│   ├── profile.html
│   └── search.html
├── routes/               # API endpoints
├── utils/                # Helper functions
└── uploads/              # User uploads
```

**Nginx сервира:**
- Frontend: `/var/www/ams-chat-web/public/`
- Backend API: `localhost:3000` (proxy)

---

## 🐛 Troubleshooting

### **Port 3000 заet:**
```bash
sudo lsof -i :3000
# Убий процеса или промени PORT в .env
```

### **PM2 не стартира:**
```bash
cd /var/www/ams-chat-web
node server.js  # Test ръчно
```

### **Nginx error:**
```bash
sudo nginx -t              # Test config
sudo tail -f /var/log/nginx/error.log
```

### **Database locked:**
```bash
pm2 stop ams-chat
chmod 644 amschat.db
pm2 start ams-chat
```

### **Permission denied:**
```bash
sudo chown -R $USER:$USER /var/www/ams-chat-web
chmod 600 .env
chmod 644 amschat.db
chmod 777 uploads
```

---

## ✅ Production Checklist

- [ ] Git clone завършен
- [ ] Dependencies инсталирани (`npm install`)
- [ ] Database инициализирана (`amschat.db`)
- [ ] Emergency contacts seeded (~74 records)
- [ ] `.env` конфигуриран с LIVE Stripe keys
- [ ] PM2 стартиран и saved
- [ ] PM2 startup enabled
- [ ] Nginx конфигуриран
- [ ] SSL certificate installed (HTTPS)
- [ ] Firewall ports open (80, 443, 22)
- [ ] Test: https://alsec.strangled.net работи

---

**Следващо:** [02-DATABASE.md](./02-DATABASE.md) - Database schema и структура
