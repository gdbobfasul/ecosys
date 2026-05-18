<!-- Version: 1.0056 -->
# 📋 KCY ECOSYSTEM - COMPLETE DEPLOYMENT CHECKLIST

**Domain:** https://alsec.strangled.net  
**Deployment Time:** ~30 minutes  
**Archive:** kcy-unified.zip (1.1MB)

---

## 🎯 PRE-DEPLOYMENT CHECKLIST

### Requirements:
- [ ] Windows PC with PowerShell or PuTTY installed
- [ ] Linux server with Ubuntu 20.04+ (root access)
- [ ] Domain DNS pointed to server IP
- [ ] SSH key or password for server access
- [ ] Email for SSL certificates

### Optional:
- [ ] Mobile app ready for publishing
- [ ] Contract addresses deployed on BSC
- [ ] API keys for services (Stripe, etc.)

---

## 📦 STEP 1: EXTRACT & PREPARE (2 min)

```powershell
# On Windows
# 1. Download kcy-unified.zip
# 2. Extract to C:\kcy-unified
# 3. Open PowerShell in that directory
```

**Verify extraction:**
```
kcy-unified/
├── public/
├── private/
├── tests/
├── scripts/
│   ├── windows/
│   │   ├── deploy.ps1      ← Deploy script
│   │   └── deploy.bat
│   └── server/
│       ├── 01-setup-database.sh
│       └── 02-setup-domain.sh
└── README.md
```

---

## 🚀 STEP 2: DEPLOY TO SERVER (5 min)

### Option A: PowerShell (Recommended)
```powershell
.\deploy-scripts\windows\deploy.ps1
```

### Option B: Batch File
```batch
deploy-scripts\windows\deploy.bat
```

### Option C: Manual SCP
```bash
# Public files
scp -r public/* root@alsec.strangled.net:/var/www/html/

# Private files
ssh root@alsec.strangled.net "mkdir -p /var/www/kcy-ecosystem"
scp -r private/* root@alsec.strangled.net:/var/www/kcy-ecosystem/

# Root files
scp package.json hardhat.config.js jest.config.js root@alsec.strangled.net:/var/www/kcy-ecosystem/
```

**Expected output:**
```
✓ Public files uploaded
✓ Private files uploaded
✓ Root files uploaded
✓ DEPLOYMENT COMPLETE!
```

---

## 🗄️ STEP 3: DATABASE SETUP (10 min)

```bash
# SSH to server
ssh root@alsec.strangled.net

# Navigate to scripts
cd /var/www/kcy-ecosystem/deploy-scripts/server

# Make executable
chmod +x *.sh

# Run database setup
./01-setup-database.sh
```

### What it does:
1. ✅ Updates system packages
2. ✅ Installs PostgreSQL 14+
3. ✅ Creates database: `ams_chat_db`
4. ✅ Creates user: `ams_chat_user` (random password)
5. ✅ Runs schema from `postgresql_setup.sql`
6. ✅ Migrates data from SQLite (if exists)
7. ✅ Installs `pg` Node.js driver
8. ✅ Creates `/var/www/kcy-ecosystem/private/chat/.env`
9. ✅ Configures PostgreSQL access

### Output files:
- `/var/www/kcy-ecosystem/database-credentials.txt` ← **SAVE THIS!**
- `/var/www/kcy-ecosystem/private/chat/.env` ← Auto-configured

### ⚠️ IMPORTANT:
```bash
# 1. View credentials
cat /var/www/kcy-ecosystem/database-credentials.txt

# 2. Save to password manager

# 3. Delete the file
rm /var/www/kcy-ecosystem/database-credentials.txt
```

---

## 🌐 STEP 4: DOMAIN & SERVICES SETUP (15 min)

```bash
# Still on server
./02-setup-domain.sh
```

### Interactive prompts:
```
Current domain: alsec.strangled.net
Press Enter to use this domain, or type new domain: [PRESS ENTER]

Email for SSL certificates: your@email.com
```

### What it does:
1. ✅ Installs Nginx
2. ✅ Creates virtual host config
3. ✅ Installs Let's Encrypt SSL certificate
4. ✅ Sets up SSL auto-renewal
5. ✅ Creates systemd service: `kcy-chat.service`
6. ✅ Installs PM2 for Node.js apps
7. ✅ Installs all Node.js dependencies
8. ✅ Configures firewall (UFW)
9. ✅ Sets permissions (www-data user)
10. ✅ Creates admin commands

### Created files:
- `/etc/nginx/sites-available/kcy-ecosystem` ← Nginx config
- `/etc/systemd/system/kcy-chat.service` ← Systemd service
- `/usr/local/bin/kcy-status` ← Status command
- `/usr/local/bin/kcy-restart` ← Restart command

### Services started:
```
✓ kcy-chat.service (Node.js backend)
✓ nginx (web server)
✓ postgresql (database)
```

---

## ✅ STEP 5: VERIFICATION (5 min)

### 1. Check services status:
```bash
kcy-status
```

Expected output:
```
Services:
● kcy-chat.service - active (running)
Nginx: active (running)
PostgreSQL: active (running)
SSL Certificates: Expiry Date: 2026-05-14
```

### 2. Test website:
```bash
# From server
curl -I https://alsec.strangled.net

# Expected: HTTP/2 200 OK
```

### 3. Open in browser:
```
https://alsec.strangled.net/             ← Landing page
https://alsec.strangled.net/token/       ← Token page
https://alsec.strangled.net/multisig/    ← Multi-Sig page
https://alsec.strangled.net/chat/        ← Chat page
https://alsec.strangled.net/chat/download/ ← App download
```

### 4. Check logs:
```bash
# Chat service logs
journalctl -u kcy-chat.service -n 20

# Nginx access log
tail -f /var/log/nginx/kcy-ecosystem-access.log

# Nginx error log
tail -f /var/log/nginx/kcy-ecosystem-error.log
```

---

## ⚙️ STEP 6: CONFIGURATION (5 min)

### 1. Update config.js with real addresses:
```bash
nano /var/www/html/shared/js/config.js
```

Change:
```javascript
BASE_URL: "https://alsec.strangled.net",  // ✓ Already correct

contracts: {
    token: "0xYOUR_REAL_TOKEN_ADDRESS",      // ← UPDATE THIS
    multisig: "0xYOUR_REAL_MULTISIG_ADDRESS" // ← UPDATE THIS
},

mobileApp: {
    android: {
        playStore: "https://play.google.com/store/apps/details?id=com.amschat.app", // ← UPDATE LATER
        apkDirect: "https://alsec.strangled.net/downloads/ams-chat.apk"  // ✓ Correct
    },
    ios: {
        appStore: "https://apps.apple.com/app/ams-chat/idXXXXXXX" // ← UPDATE LATER
    }
}
```

Save: `Ctrl+X, Y, Enter`

### 2. Test config update:
```bash
# Clear browser cache
# Open: https://alsec.strangled.net
# Press: Ctrl+F5
```

---

## 📱 STEP 7: MOBILE APP (Optional)

### Build app:
```bash
# On development machine
cd /path/to/2026-02-07-AMS-chat-app

# Build Android APK
expo build:android

# Or using EAS
eas build --platform android
```

### Upload APK:
```bash
# From Windows
pscp.exe ams-chat.apk root@alsec.strangled.net:/var/www/html/downloads/

# Or from Linux
scp ams-chat.apk root@alsec.strangled.net:/var/www/html/downloads/
```

### Set permissions:
```bash
# On server
chmod 644 /var/www/html/downloads/ams-chat.apk
chown www-data:www-data /var/www/html/downloads/ams-chat.apk
```

### Test download:
```
https://alsec.strangled.net/downloads/ams-chat.apk
```

### Update app links (after publishing to stores):
```bash
nano /var/www/html/shared/js/config.js

# Update:
playStore: "REAL_PLAY_STORE_LINK"
appStore: "REAL_APP_STORE_LINK"
```

---

## 🔐 STEP 8: SECURITY HARDENING (10 min)

### 1. Secure admin pages with htpasswd:
```bash
# Install apache2-utils
apt-get install -y apache2-utils

# Create password file
htpasswd -c /etc/nginx/.htpasswd admin

# Enter password when prompted
```

### Add to Nginx config:
```bash
nano /etc/nginx/sites-available/kcy-ecosystem

# Add to admin locations:
location /token/admin/ {
    auth_basic "Admin Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
}

location /multisig/admin/ {
    auth_basic "Admin Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
}

location /chat/admin/ {
    auth_basic "Admin Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
}

# Reload
nginx -t && systemctl reload nginx
```

### 2. Enable fail2ban:
```bash
apt-get install -y fail2ban

# Create jail for SSH
cat > /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

### 3. Set up automatic backups:
```bash
# Create backup script
cat > /usr/local/bin/kcy-backup << 'BACKUPEOF'
#!/bin/bash
BACKUP_DIR="/var/backups/kcy-ecosystem"
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR

# Database backup
sudo -u postgres pg_dump ams_chat_db > $BACKUP_DIR/db-$DATE.sql

# Files backup
tar -czf $BACKUP_DIR/files-$DATE.tar.gz /var/www/kcy-ecosystem/private/chat/uploads

# Keep last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
BACKUPEOF

chmod +x /usr/local/bin/kcy-backup

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/kcy-backup") | crontab -
```

### 4. Review firewall:
```bash
ufw status verbose

# Expected:
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                    ALLOW       Anywhere
```

---

## 📊 STEP 9: MONITORING SETUP (Optional)

### 1. Install monitoring tools:
```bash
apt-get install -y htop iotop nethogs

# Or better - install netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access at: http://alsec.strangled.net:19999
```

### 2. Set up log rotation:
```bash
cat > /etc/logrotate.d/kcy-ecosystem << EOF
/var/log/nginx/kcy-ecosystem-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload nginx
    endscript
}
EOF
```

### 3. Monitor disk space:
```bash
# Add to crontab (check daily)
(crontab -l 2>/dev/null; echo "0 9 * * * df -h | mail -s 'Disk Space Report' your@email.com") | crontab -
```

---

## 🧪 STEP 10: TESTING (10 min)

### Frontend Tests:
```
✓ https://alsec.strangled.net/                 → Landing page loads
✓ https://alsec.strangled.net/token/           → Token info loads
✓ https://alsec.strangled.net/token/admin/scripts.html → Admin page (with auth)
✓ https://alsec.strangled.net/multisig/        → Multi-sig info loads
✓ https://alsec.strangled.net/multisig/admin/  → Admin page (with auth)
✓ https://alsec.strangled.net/chat/            → Chat info loads
✓ https://alsec.strangled.net/chat/download/   → Download page loads
✓ https://alsec.strangled.net/chat/public/     → Chat app loads
✓ https://alsec.strangled.net/chat/admin/      → Admin hub (with auth)
✓ https://alsec.strangled.net/shared/css/common.css → Shared resources
```

### Backend Tests:
```bash
# Test chat API
curl http://localhost:3000/api/health
# Expected: {"status":"ok"}

# Test database connection
sudo -u postgres psql -d ams_chat_db -c "SELECT COUNT(*) FROM users;"

# Test SSL certificate
openssl s_client -connect alsec.strangled.net:443 -servername alsec.strangled.net
```

### Performance Tests:
```bash
# Test page load time
curl -w "@-" -o /dev/null -s https://alsec.strangled.net/ << 'EOF'
time_total: %{time_total}s
EOF

# Test with ab (Apache Bench)
ab -n 100 -c 10 https://alsec.strangled.net/
```

---

## 📝 POST-DEPLOYMENT CHECKLIST

### Immediate:
- [ ] Database credentials saved securely
- [ ] database-credentials.txt deleted
- [ ] All URLs tested and working
- [ ] SSL certificate valid (https://www.ssllabs.com/ssltest/)
- [ ] Services auto-start on reboot (test with `reboot`)

### Configuration:
- [ ] config.js updated with real contract addresses
- [ ] Mobile app APK uploaded
- [ ] App store links updated (after publishing)
- [ ] Admin pages protected with htpasswd
- [ ] Email notifications configured

### Security:
- [ ] Firewall enabled and configured
- [ ] fail2ban installed and running
- [ ] Automatic backups scheduled
- [ ] Log rotation configured
- [ ] Strong passwords set
- [ ] SSH key authentication (disable password auth)

### Monitoring:
- [ ] Monitoring tools installed
- [ ] Alerts configured
- [ ] Uptime monitoring (e.g., UptimeRobot)
- [ ] Error logging (e.g., Sentry)

### Documentation:
- [ ] Credentials documented
- [ ] Server access documented
- [ ] Deployment process documented
- [ ] Recovery procedures documented

---

## 🔄 MAINTENANCE TASKS

### Daily:
```bash
# Check service status
kcy-status

# Check logs for errors
journalctl -u kcy-chat.service --since today | grep -i error
```

### Weekly:
```bash
# Update system packages
apt-get update && apt-get upgrade -y

# Check disk space
df -h

# Review access logs
tail -n 100 /var/log/nginx/kcy-ecosystem-access.log
```

### Monthly:
```bash
# Review SSL certificate expiry
certbot certificates

# Database maintenance
sudo -u postgres vacuumdb -d ams_chat_db --analyze

# Check backup integrity
ls -lh /var/backups/kcy-ecosystem/
```

---

## 🆘 TROUBLESHOOTING

### Service won't start:
```bash
journalctl -u kcy-chat.service -n 50
systemctl restart kcy-chat.service
```

### Database connection error:
```bash
cat /var/www/kcy-ecosystem/private/chat/.env
sudo -u postgres psql -d ams_chat_db
```

### Nginx 403/404:
```bash
nginx -t
ls -la /var/www/html/
chown -R www-data:www-data /var/www/html
```

### SSL not working:
```bash
certbot certificates
certbot renew --dry-run
```

### High CPU/Memory:
```bash
htop
systemctl status kcy-chat.service
pm2 monit
```

---

## 📞 SUPPORT CONTACTS

- **Technical Documentation:** `/var/www/kcy-ecosystem/deploy-deploy-scripts/README.md`
- **Deployment Guide:** `/var/www/kcy-ecosystem/DEPLOYMENT-AUTOMATION-SUMMARY.md`
- **Quick Start:** `QUICK-START-3-STEPS.md`
- **Server Info:** `/var/www/kcy-ecosystem/deployment-info.txt`

---

## ✅ DEPLOYMENT COMPLETE!

**Website:** https://alsec.strangled.net  
**Admin Tools:** kcy-status, kcy-restart  
**Logs:** journalctl -u kcy-chat.service -f

**Total time:** ~30-45 minutes  
**Status:** Production Ready! 🚀

---

**Remember to:**
1. Save all credentials securely
2. Set up monitoring and alerts
3. Schedule regular backups
4. Keep system updated
5. Review logs regularly

**Good luck with your deployment!** 🎉
