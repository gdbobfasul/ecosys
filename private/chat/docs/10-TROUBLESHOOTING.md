<!-- Version: 1.0056 -->
# 10 - Troubleshooting (Решения на проблеми)

## 🔧 Често срещани проблеми и решения

---

## 🚫 Приложението не стартира

### **"Cannot find module 'express'"**

**Причина:** Dependencies не са инсталирани

**Решение:**
```bash
npm install
```

---

### **"EADDRINUSE: address already in use"**

**Причина:** Порт 3000 вече е зает

**Решение 1:** Убий процеса
```bash
lsof -ti:3000 | xargs kill -9
```

**Решение 2:** Смени порта
```env
# .env
PORT=3001
```

---

### **"Database is locked"**

**Причина:** Друг процес държи lock на database

**Решение:**
```bash
# Find process
lsof chat.db

# Kill it
kill -9 <PID>

# Or restart app
pm2 restart ams-chat
```

---

## 💳 Плащания не работят

### **"Invalid API key"**

**Причина:** Грешен или липсващ Stripe key

**Решение:**
```bash
# Check .env
cat .env | grep STRIPE

# Verify keys at:
# https://dashboard.stripe.com/test/apikeys
```

---

### **"No such payment_intent"**

**Причина:** Test/Live mode mismatch

**Решение:**
- Test keys (`sk_test_`) → Test mode
- Live keys (`sk_live_`) → Live mode
- Don't mix!

---

### **Webhook не работи**

**Причина:** Webhook secret грешен или endpoint не е достъпен

**Решение:**
```bash
# Check webhook secret
echo $STRIPE_WEBHOOK_SECRET

# Test endpoint
curl https://alsec.strangled.net/api/payment/webhook

# Check Stripe dashboard:
# https://dashboard.stripe.com/webhooks
```

---

## 🔐 Login проблеми

### **"Invalid credentials"**

**Причина:** Грешна парола или user не съществува

**Решение:**
```sql
-- Check if user exists
sqlite3 chat.db
SELECT * FROM users WHERE phone = '0888123456';

-- Reset password if needed
-- (generate hash first with bcrypt)
UPDATE users SET password_hash = '<NEW_HASH>' WHERE phone = '0888123456';
```

---

### **"Account is blocked"**

**Причина:** Admin е блокирал акаунта

**Решение:**
```sql
-- Check block status
SELECT is_blocked, blocked_reason FROM users WHERE phone = '0888123456';

-- Unblock
UPDATE users SET is_blocked = 0, blocked_reason = NULL WHERE phone = '0888123456';
```

---

### **"Payment required"**

**Причина:** `paid_until` е изтекъл

**Решение:**
```sql
-- Check payment status
SELECT paid_until FROM users WHERE phone = '0888123456';

-- Extend (add 1 month)
UPDATE users 
SET paid_until = datetime(paid_until, '+1 month') 
WHERE phone = '0888123456';
```

---

## 📍 Location не работи

### **"Geolocation не е поддържан"**

**Причина:** Browser не поддържа или HTTPS липсва

**Решение:**
- Geolocation изисква HTTPS на production!
- На localhost работи без HTTPS
- Check: `navigator.geolocation` in browser console

---

### **"User denied location permission"**

**Причина:** User е отказал разрешение

**Решение:**
- User трябва да разреши в browser settings
- Chrome: Settings → Privacy → Site Settings → Location

---

### **"Nominatim rate limit exceeded"**

**Причина:** Повече от 1 request/sec

**Решение:**
- Кеширай резултати
- Показвай само GPS ако fails
- Използвай fallback API

---

## 📁 File Upload проблеми

### **"File too large"**

**Причина:** Файл > 100MB

**Решение:**
```env
# .env
MAX_FILE_SIZE=104857600  # 100MB in bytes
```

Или промени в `routes/messages.js`:
```javascript
const upload = multer({
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});
```

---

### **"ENOENT: no such file or directory"**

**Причина:** `uploads/` директория не съществува

**Решение:**
```bash
mkdir -p uploads
chmod 755 uploads
```

---

### **"Permission denied"**

**Причина:** Няма права за запис в `uploads/`

**Решение:**
```bash
sudo chown -R $USER:$USER uploads
chmod 755 uploads
```

---

## 🌐 WebSocket проблеми

### **Messages не се получават в real-time**

**Причина:** WebSocket connection failed

**Решение:**
```javascript
// Check in browser console
const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => console.log('Connected');
ws.onerror = (err) => console.error(err);
```

**Nginx config за WebSocket:**
```nginx
location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
}
```

---

## 🗄️ Database проблеми

### **"Database disk image is malformed"**

**Причина:** Corrupted database

**Решение:**
```bash
# Try to recover
sqlite3 chat.db ".recover" | sqlite3 chat-recovered.db

# Or restore from backup
cp /backup/ams-chat/chat-20241105.db chat.db

# Restart app
pm2 restart ams-chat
```

---

### **Database растe много бързо**

**Причина:** Старите съобщения не се трият

**Решение:**
```bash
# Vacuum database
sqlite3 chat.db "VACUUM;"

# Delete old messages
sqlite3 chat.db "DELETE FROM messages WHERE created_at < datetime('now', '-30 days');"

# Delete old files
find uploads/ -mtime +7 -delete
```

---

## 🔥 Performance проблеми

### **Сървърът е бавен**

**Причина:** Високо CPU/RAM usage

**Решение:**
```bash
# Check resources
htop
pm2 monit

# Check logs for errors
pm2 logs ams-chat --lines 100

# Restart if needed
pm2 restart ams-chat
```

---

### **Database queries бавни**

**Причина:** Липсват indexes или database е голяма

**Решение:**
```sql
-- Vacuum
VACUUM;

-- Analyze
ANALYZE;

-- Check indexes
.indexes users

-- Add missing indexes (already in db_setup.sql)
CREATE INDEX IF NOT EXISTS idx_messages_from_to 
ON messages(from_user_id, to_user_id, created_at DESC);
```

---

## 🌍 CORS проблеми

### **"CORS policy: No 'Access-Control-Allow-Origin' header"**

**Причина:** Frontend е на друг домейн

**Решение:**
```javascript
// server.js
const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
```

---

## 🔐 Admin панел недостъпен

### **"Access denied"**

**Причина:** IP не е в whitelist

**Решение:**
```env
# .env
ADMIN_ALLOWED_IPS=127.0.0.1,::1,Your.IP.Address

# Or allow all (NOT recommended for production!)
ADMIN_ALLOWED_IPS=*
```

---

### **"Invalid admin credentials"**

**Причина:** Грешна парола

**Решение:**
```bash
# Reset admin password
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('NewPassword', 10, (e, h) => console.log(h));"

sqlite3 chat.db
```

```sql
UPDATE admin_users SET password_hash = '<NEW_HASH>' WHERE username = 'admin';
```

---

## 📱 Mobile App проблеми

### **"Network request failed"**

**Причина:** API_URL грешен или server недостъпен

**Решение:**
```env
# .env (mobile app)
API_URL=http://YOUR_SERVER_IP:3000

# NOT localhost! Use actual IP
```

---

### **"Location permission denied"**

**Причина:** App няма разрешение

**Решение:**
```javascript
// Request permission first
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') {
  Alert.alert('Permission denied');
}
```

---

## 🔍 Debug Tips

### **Enable debug logging:**

```env
# .env
NODE_ENV=development
LOG_LEVEL=debug
```

### **Check logs:**

```bash
# PM2 logs
pm2 logs ams-chat --lines 100

# Or file logs
tail -f logs/app.log
```

### **Test endpoints:**

```bash
# Health check
curl http://localhost:3000/api/health

# Test auth
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"0888123456","password":"test123"}'
```

---

## 📞 Все още не работи?

1. **Check logs:** `pm2 logs ams-chat`
2. **Check database:** `sqlite3 chat.db .tables`
3. **Check .env:** `cat .env`
4. **Restart:** `pm2 restart ams-chat`
5. **Contact support:** support@alsec.strangled.net

---

**Следващо:** [11-API-REFERENCE.md](./11-API-REFERENCE.md) - API документация
