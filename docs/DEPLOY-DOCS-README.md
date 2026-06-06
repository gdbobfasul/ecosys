<!-- Version: 1.0056 -->
# 🚀 KCY Ecosystem - Deployment Scripts

## 📁 Структура:

```
scripts/
├── windows/           ← Windows deploy скриптове
│   ├── deploy.ps1    ← PowerShell скрипт (препоръчително)
│   └── deploy.bat    ← Batch скрипт (прост)
└── server/            ← Linux server setup скриптове
    ├── 07-setup-database.sh   ← PostgreSQL setup
    └── 08-setup-domain.sh     ← Nginx, SSL, services
```

---

## 🖥️ Windows Deployment

### Опция 1: PowerShell (Препоръчително)

```powershell
# Navigate to project
cd C:\path\to\extracted\kcy-unified

# Run deploy script
.\deploy-scripts\windows\deploy.ps1
```

**Customization:**
```powershell
# Custom server
.\deploy-scripts\windows\deploy.ps1 -ServerIP "192.168.1.100"

# Custom user
.\deploy-scripts\windows\deploy.ps1 -ServerUser "admin"

# Help
.\deploy-scripts\windows\deploy.ps1 -Help
```

### Опция 2: Batch File

```batch
# Double-click or run:
deploy-scripts\windows\deploy.bat
```

**Requirements:**
- PuTTY (includes pscp.exe) - https://www.putty.org/
- SSH access to server

---

## 🐧 Server Setup

### Prerequisites:

1. SSH into server:
```bash
ssh root@${MAIN_DOMAIN}
```

2. Navigate to scripts:
```bash
cd /var/www/kcy-ecosystem/deploy-scripts/server
```

3. Make executable:
```bash
chmod +x *.sh
```

---

### Step 1: Database Setup

```bash
sudo ./07-setup-database.sh
```

**What it does:**
- ✅ Installs PostgreSQL
- ✅ Creates database `ams_chat_db`
- ✅ Creates user `ams_chat_user`
- ✅ Migrates data from SQLite (if exists)
- ✅ Installs Node.js pg driver
- ✅ Creates .env file with credentials
- ✅ Configures PostgreSQL access

**Output:**
- Credentials saved to: `/var/www/kcy-ecosystem/database-credentials.txt`
- .env file created: `/var/www/kcy-ecosystem/private/chat/.env`

**⚠️ IMPORTANT:**
- Save database credentials securely!
- Delete `database-credentials.txt` after saving
- Keep `.env` file secure (already chmod 600)

---

### Step 2: Domain & Services Setup

```bash
sudo ./08-setup-domain.sh
```

**What it does:**
- ✅ Installs Nginx
- ✅ Configures virtual host for ${MAIN_DOMAIN}
- ✅ Installs SSL certificate (Let's Encrypt)
- ✅ Sets up auto-renewal
- ✅ Creates systemd service for chat
- ✅ Installs PM2 for Node.js
- ✅ Configures firewall (UFW)
- ✅ Sets correct permissions
- ✅ Creates admin scripts

**Interactive prompts:**
1. Domain name (default: ${MAIN_DOMAIN})
2. Email for SSL (for cert notifications)

**Output:**
- Nginx config: `/etc/nginx/sites-available/kcy-ecosystem`
- Systemd service: `/etc/systemd/system/kcy-chat.service`
- Admin scripts: `/usr/local/bin/kcy-*`
- Deployment info: `/var/www/kcy-ecosystem/deployment-info.txt`

---

## 🔧 Admin Commands

After setup, these commands are available:

### Check System Status
```bash
kcy-status
```

Shows:
- Service status (chat, nginx, postgresql)
- SSL certificate info
- Disk usage

### Restart Services
```bash
kcy-restart
```

Restarts:
- KCY Chat service
- Nginx

### View Logs

**Chat logs:**
```bash
journalctl -u kcy-chat.service -f
```

**Nginx error log:**
```bash
tail -f /var/log/nginx/kcy-ecosystem-error.log
```

**Nginx access log:**
```bash
tail -f /var/log/nginx/kcy-ecosystem-access.log
```

---

## 🗂️ Directory Structure After Deployment

```
/var/www/
├── html/                          ← Public web files
│   ├── index.html
│   ├── token/
│   ├── multisig/
│   ├── chat/
│   │   └── download/              ← App download page
│   ├── shared/
│   └── downloads/                 ← APK files here
│
└── kcy-ecosystem/                 ← Private files
    ├── private/
    │   ├── token/
    │   ├── multisig/
    │   └── chat/
    │       ├── server.js
    │       ├── .env               ← Database credentials
    │       └── database/
    ├── scripts/
    ├── package.json
    ├── database-credentials.txt   ← ⚠️ Delete after saving!
    └── deployment-info.txt        ← Deployment summary
```

---

## 🌐 URLs After Deployment

| Service | URL |
|---------|-----|
| **Landing** | https://${MAIN_DOMAIN}/ |
| **Token** | https://${MAIN_DOMAIN}/token/ |
| **Token Admin** | https://${MAIN_DOMAIN}/token/admin/scripts.html |
| **Multi-Sig** | https://${MAIN_DOMAIN}/multisig/ |
| **Multi-Sig Admin** | https://${MAIN_DOMAIN}/multisig/admin/ |
| **Chat** | https://${MAIN_DOMAIN}/chat/ |
| **Chat Download** | https://${MAIN_DOMAIN}/chat/download/ |
| **Chat Web App** | https://${MAIN_DOMAIN}/chat/public/ |
| **Chat Admin** | https://${MAIN_DOMAIN}/chat/admin/ |

**API:**
- Chat API: https://${MAIN_DOMAIN}/api/chat/

---

## 🔐 Security Checklist

After deployment:

- [ ] Database credentials saved securely
- [ ] Delete `/var/www/kcy-ecosystem/database-credentials.txt`
- [ ] Change default passwords
- [ ] Update `shared/js/config.js` with real contract addresses
- [ ] Set up .htaccess for admin pages
- [ ] Create admin passwords with htpasswd
- [ ] Verify firewall rules (ufw status)
- [ ] Test SSL certificate (https://www.ssllabs.com/ssltest/)
- [ ] Enable fail2ban for SSH protection
- [ ] Set up automatic backups

---

## 🔄 Common Tasks

### Update Code

```bash
# On Windows: run deploy script again
.\deploy-scripts\windows\deploy.ps1

# On Server: restart services
kcy-restart
```

### Update Config

```bash
# Edit config
nano /var/www/html/shared/js/config.js

# Update domain/contracts/etc
# Save and exit (Ctrl+X, Y, Enter)

# Clear browser cache (Ctrl+F5)
```

### Add Mobile App APK

```bash
# On Server
cd /var/www/html/downloads

# Upload APK (from local machine)
scp ams-chat.apk root@${MAIN_DOMAIN}:/var/www/html/downloads/

# Set permissions
chmod 644 /var/www/html/downloads/ams-chat.apk
chown www-data:www-data /var/www/html/downloads/ams-chat.apk

# Update config.js with real download link
```

### Database Backup

```bash
# Manual backup
sudo -u postgres pg_dump ams_chat_db > backup-$(date +%Y%m%d).sql

# Restore
sudo -u postgres psql ams_chat_db < backup-20260213.sql
```

### View Service Status

```bash
# All services
kcy-status

# Specific service
systemctl status kcy-chat.service
systemctl status nginx
systemctl status postgresql
```

---

## 🆘 Troubleshooting

### Chat service won't start

```bash
# Check logs
journalctl -u kcy-chat.service -n 50

# Check .env file
cat /var/www/kcy-ecosystem/private/chat/.env

# Test database connection
psql -U ams_chat_user -d ams_chat_db -h localhost

# Restart service
systemctl restart kcy-chat.service
```

### Nginx errors

```bash
# Test config
nginx -t

# Check error log
tail -f /var/log/nginx/kcy-ecosystem-error.log

# Restart nginx
systemctl restart nginx
```

### SSL certificate issues

```bash
# Check certificates
certbot certificates

# Renew manually
certbot renew

# Test renewal
certbot renew --dry-run
```

### Permission issues

```bash
# Fix ownership
chown -R www-data:www-data /var/www/html
chown -R www-data:www-data /var/www/kcy-ecosystem

# Fix permissions
find /var/www/html -type d -exec chmod 755 {} \;
find /var/www/html -type f -exec chmod 644 {} \;
```

---

## 📝 Notes

- All scripts are idempotent (safe to run multiple times)
- Database script will backup SQLite before migration
- Domain script will skip SSL if domain doesn't resolve yet
- Logs are stored in `/var/log/nginx/` and systemd journal
- PM2 is configured to auto-start on boot

---

## 🎯 Quick Start Summary

```bash
# === On Windows ===
# 1. Extract kcy-unified.zip
# 2. Run: .\deploy-scripts\windows\deploy.ps1

# === On Server ===
# 3. SSH: ssh root@${MAIN_DOMAIN}
# 4. Run: cd /var/www/kcy-ecosystem/deploy-scripts/server
# 5. Run: chmod +x *.sh
# 6. Run: ./07-setup-database.sh
# 7. Run: ./08-setup-domain.sh

# === Done! ===
# Visit: https://${MAIN_DOMAIN}
```

**Total time: ~15-30 minutes** ⚡

---

**Need help? Check logs or contact support!** 🚀
