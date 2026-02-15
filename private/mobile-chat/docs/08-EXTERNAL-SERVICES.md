<!-- Version: 1.0056 -->
# 08 - External Services (Външни услуги)

## 🌐 Всички външни API-та и услуги

AMS Chat използва САМО БЕЗПЛАТНИ услуги!

---

## 💳 Stripe (Payments)

**URL:** https://stripe.com  
**Цена:** FREE (transaction fees apply)  
**Fees:** 2.9% + €0.30 per transaction  
**Setup:** [07-STRIPE.md](./07-STRIPE.md)

**Нужни:**
- Account
- API keys (test & live)
- Webhook endpoint

---

## 🗺️ Location Services

### **1. Nominatim (OpenStreetMap)**

**URL:** https://nominatim.openstreetmap.org  
**Цена:** FREE  
**Usage:** Reverse Geocoding (GPS → Address)  
**Limit:** 1 request/sec  
**Policy:** https://operations.osmfoundation.org/policies/nominatim/

**Usage:**
```javascript
const url = `https://nominatim.openstreetmap.org/reverse?` +
  `lat=${latitude}&lon=${longitude}&format=json`;

const response = await fetch(url, {
  headers: { 'User-Agent': 'AMS-Chat/1.0 (your@email.com)' }
});
```

**No API key needed!**

---

### **2. ipapi.co (IP Geolocation)**

**URL:** https://ipapi.co  
**Цена:** FREE  
**Limit:** 1000 requests/день  
**Setup:** No registration needed

**Usage:**
```javascript
const response = await fetch('https://ipapi.co/json/');
const data = await response.json();
// { ip, city, region, country, country_code, ... }
```

**Fallback** (if limit exceeded):
```javascript
const response = await fetch('https://api.ipify.org?format=json');
const { ip } = await response.json();
```

---

### **3. Google Maps (Links Only)**

**URL:** https://maps.google.com  
**Цена:** FREE (links only, no API)  
**Usage:** Direct links to maps

```javascript
const googleMapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
```

---

### **4. Yandex Maps (Links Only)**

**URL:** https://yandex.com/maps  
**Цена:** FREE (links only)

```javascript
const yandexLink = `https://yandex.com/maps/?ll=${lng},${lat}&z=16&pt=${lng},${lat}`;
```

---

### **5. 2GIS (Links Only)**

**URL:** https://2gis.com  
**Цена:** FREE (links only)

```javascript
const twoGisLink = `https://2gis.com/?m=${lng},${lat}/16`;
```

---

## 📡 WebSocket (Real-time Chat)

**Built-in:** Node.js `ws` library  
**Цена:** FREE  
**Setup:** Included in `server.js`

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3001 });
```

**No external service needed!**

---

## 📧 Email (Optional)

### **SMTP (Gmail)**

**Setup:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
```

**App Password:** https://myaccount.google.com/apppasswords

**Цена:** FREE (Gmail daily limits apply)

### **SendGrid (Alternative)**

**URL:** https://sendgrid.com  
**Free tier:** 100 emails/day

---

## 🔐 SSL/TLS Certificates

### **Let's Encrypt (Recommended)**

**URL:** https://letsencrypt.org  
**Цена:** FREE  
**Setup:** With Certbot

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

**Auto-renewal:**
```bash
sudo crontab -e
# Add:
0 3 * * * certbot renew --quiet
```

---

### **Cloudflare (Alternative)**

**URL:** https://cloudflare.com  
**Цена:** FREE  
**Features:**
- Free SSL/TLS
- DDoS protection
- CDN

**Setup:**
1. Add domain
2. Change nameservers
3. SSL/TLS mode: Full

---

## 🗄️ Database Backups

### **Local Backups:**

```bash
# Cron job
0 2 * * * sqlite3 /path/to/chat.db ".backup /backup/chat-$(date +\%Y\%m\%d).db"
```

### **Cloud Backups (Optional):**

**AWS S3:**
```bash
aws s3 cp chat-backup.db s3://your-bucket/backups/
```

**Free tier:** 5GB storage

**Google Cloud Storage:**  
**Free tier:** 5GB storage

---

## 📊 Monitoring (Optional)

### **PM2 (Process Manager)**

**URL:** https://pm2.keymetrics.io  
**Цена:** FREE  
**Install:**
```bash
npm install -g pm2
pm2 start server.js --name ams-chat
pm2 startup
pm2 save
```

### **UptimeRobot (Uptime Monitoring)**

**URL:** https://uptimerobot.com  
**Free tier:** 50 monitors, 5-min interval

---

## 🔍 Analytics (Optional)

### **Plausible (Privacy-focused)**

**URL:** https://plausible.io  
**Цена:** $9/месец (or self-host for FREE)

### **Matomo (Self-hosted)**

**URL:** https://matomo.org  
**Цена:** FREE (self-hosted)

---

## 📂 File Storage

### **Local Storage (Default)**

Files stored in `./uploads/`  
**Цена:** FREE (uses disk space)

### **AWS S3 (Optional)**

**Free tier:** 5GB, 20,000 GET, 2,000 PUT/month  
**After:** ~$0.023/GB/month

---

## 🌍 CDN (Optional)

### **Cloudflare CDN**

**URL:** https://cloudflare.com  
**Цена:** FREE

**Features:**
- Caches static files
- Reduces server load
- DDoS protection

---

## 📝 Summary

| Service | Purpose | Cost | Required |
|---------|---------|------|----------|
| **Stripe** | Payments | 2.9% + €0.30/tx | ✅ Yes |
| **Nominatim** | Geocoding | FREE | ✅ Yes (location) |
| **ipapi.co** | IP location | FREE (1000/day) | ✅ Yes (location) |
| **Google Maps** | Map links | FREE | ✅ Yes (location) |
| **Let's Encrypt** | SSL | FREE | ✅ Yes (HTTPS) |
| **PM2** | Process mgmt | FREE | ⚠️ Recommended |
| **Cloudflare** | CDN/SSL/DDoS | FREE | ⚠️ Recommended |
| **Email SMTP** | Notifications | FREE | ❌ Optional |
| **S3/Cloud** | File storage | ~$0.023/GB | ❌ Optional |

---

## 💰 Total Monthly Cost

**Минимум (all free services):** €0/месец  
**+ Stripe fees:** 2.9% + €0.30 per payment  
**+ Server hosting:** Depends on provider

**Example:**  
100 users × €5 = €500 revenue  
Stripe fees: ~€17  
Net: €483/месец

---

**Следващо:** [09-DEPLOYMENT.md](./09-DEPLOYMENT.md) - Production deployment
