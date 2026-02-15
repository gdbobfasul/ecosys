# 📚 KCY ECOSYSTEM - DOCUMENTATION INDEX

**Archive:** kcy-unified.zip (1.1MB)  
**Domain:** https://alsec.strangled.net  
**Version:** 1.0.0 - Production Ready

---

## 🚀 QUICK START

**For impatient people:** [QUICK-START-3-STEPS.md](QUICK-START-3-STEPS.md)

**Time:** 30 minutes from ZIP to working website!

---

## 📖 MAIN DOCUMENTATION

### 1. **README.md** - Project Overview
   - Project structure
   - Technologies used
   - Quick commands
   - **Start here** if you want to understand the project

### 2. **DEPLOYMENT-CHECKLIST.md** - Complete Deployment Guide ⭐
   - Step-by-step deployment
   - Pre-deployment checklist
   - Post-deployment tasks
   - Security hardening
   - **Use this** for production deployment

### 3. **deploy-scripts/README.md** - Scripts Documentation
   - Windows deployment scripts
   - Linux server setup scripts
   - Admin commands
   - Troubleshooting
   - **Reference** for all automation scripts

---

## 🛠️ DEPLOYMENT SCRIPTS

### Windows (Local Machine):

**Location:** `deploy-scripts/windows/`

| Script | Purpose | Usage |
|--------|---------|-------|
| **deploy.ps1** | PowerShell deploy | `.\deploy-scripts\windows\deploy.ps1` |
| **deploy.bat** | Batch deploy | `deploy-scripts\windows\deploy.bat` |

**What they do:**
- Upload public files to `/var/www/html/`
- Upload private files to `/var/www/kcy-ecosystem/`
- Verify uploads
- Display next steps

### Linux Server (Production):

**Location:** `deploy-scripts/server/`

| Script | Purpose | When to Run | Time |
|--------|---------|-------------|------|
| **01-setup-database.sh** | PostgreSQL setup | First deployment | 10 min |
| **02-setup-domain.sh** | Nginx + SSL + Services | After database | 15 min |

**What they do:**
- Install and configure all services
- Set up database and users
- Configure Nginx with SSL
- Create systemd services
- Set permissions
- Create admin commands

---

## 📋 GUIDES & REFERENCES

### Deployment Guides:

1. **QUICK-START-3-STEPS.md** - Ultra-fast guide (3 commands)
2. **DEPLOYMENT-CHECKLIST.md** - Complete checklist with all steps
3. **DEPLOYMENT-AUTOMATION-SUMMARY.md** - Detailed automation docs
4. **deploy-scripts/README.md** - Scripts reference manual

### Configuration Guides:

1. **CONFIG-QUICK-REF.md** - Config.js quick reference
2. **MOBILE-APP-PUBLISHING-GUIDE.md** - App publishing guide

### Integration Guides:

1. **ALL-LINKS-FIXED.md** - Cross-project links documentation

### Examples:

1. **SCRIPTS-EXAMPLES.txt** - Command examples and workflows

---

## 🗂️ PROJECT STRUCTURE

```
kcy-unified/
├── 📄 README.md                           ← Start here
├── 📄 DEPLOYMENT-CHECKLIST.md             ← Complete guide
├── 📄 QUICK-START-3-STEPS.md              ← Fast start
│
├── 📁 public/                             → /var/www/html/
│   ├── index.html                         Landing page
│   ├── token/                             Token project
│   │   ├── index.html
│   │   └── admin/scripts.html
│   ├── multisig/                          Multi-Sig project
│   │   ├── index.html
│   │   └── admin/index.html
│   ├── chat/                              Chat project
│   │   ├── index.html
│   │   ├── download/index.html            ⭐ App download page
│   │   ├── admin/index.html
│   │   └── public/                        Web app
│   └── shared/
│       ├── css/common.css
│       └── js/
│           ├── config.js                  ⭐ Main config file
│           └── navigation.js
│
├── 📁 private/                            → /var/www/kcy-ecosystem/
│   ├── token/                             Token backend
│   │   ├── contracts/
│   │   ├── scripts/
│   │   ├── admin/deploy-scripts/                 ⭐ 19 admin scripts
│   │   └── hardhat.config.js
│   ├── multisig/                          Multi-Sig backend
│   │   ├── contracts/
│   │   └── scripts/
│   └── chat/                              Chat backend
│       ├── server.js
│       ├── .env                           ⭐ DB credentials (auto-created)
│       ├── database/
│       └── routes/
│
├── 📁 tests/                              All tests (41 files)
│   ├── token/                             10 test files
│   ├── multisig/                          2 test files
│   └── chat/                              27 test files
│
├── 📁 scripts/                            ⭐ Deployment automation
│   ├── README.md                          Scripts documentation
│   ├── windows/
│   │   ├── deploy.ps1                     PowerShell deploy
│   │   └── deploy.bat                     Batch deploy
│   └── server/
│       ├── 01-setup-database.sh           PostgreSQL setup
│       └── 02-setup-domain.sh             Nginx + SSL + services
│
├── package.json                           Root dependencies
├── hardhat.config.js                      Hardhat config
└── jest.config.js                         Jest config
```

---

## 🌐 URL STRUCTURE (alsec.strangled.net)

### Public URLs:

| Type | URL | Description |
|------|-----|-------------|
| **Landing** | `/` | Main landing page |
| **Token** | `/token/` | Token information |
| **Token Admin** | `/token/admin/scripts.html` | Token admin panel |
| **Multi-Sig** | `/multisig/` | Multi-Sig information |
| **Multi-Sig Admin** | `/multisig/admin/` | Multi-Sig control |
| **Chat** | `/chat/` | Chat information |
| **Chat Download** | `/chat/download/` | Mobile app download ⭐ |
| **Chat App** | `/chat/public/` | Web chat application |
| **Chat Admin** | `/chat/admin/` | Chat admin hub |

### API Endpoints:

| Endpoint | Purpose | Port |
|----------|---------|------|
| `/api/chat/` | Chat backend API | Proxied from :3000 |

### Downloads:

| File | URL |
|------|-----|
| **Android APK** | `/downloads/ams-chat.apk` |

---

## ⚙️ CONFIGURATION FILES

### Main Config: `/var/www/html/shared/js/config.js`

**Central configuration for everything:**
```javascript
BASE_URL: "https://alsec.strangled.net"  // ← Change domain here
contracts: {
    token: "0x...",                        // ← Update after deploy
    multisig: "0x..."                      // ← Update after deploy
}
mobileApp: {
    android: {
        playStore: "...",                  // ← Update after publishing
        apkDirect: "https://alsec.strangled.net/downloads/ams-chat.apk"
    },
    ios: {
        appStore: "..."                    // ← Update after publishing
    }
}
```

### Database Config: `/var/www/kcy-ecosystem/private/chat/.env`

**Auto-generated by `01-setup-database.sh`:**
```bash
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_NAME=ams_chat_db
DATABASE_USER=ams_chat_user
DATABASE_PASSWORD=***           # Auto-generated
JWT_SECRET=***                  # Auto-generated
BASE_URL=https://alsec.strangled.net
```

### Nginx Config: `/etc/nginx/sites-available/kcy-ecosystem`

**Auto-generated by `02-setup-domain.sh`:**
- Virtual host for alsec.strangled.net
- SSL configuration
- Reverse proxy for chat API
- Security headers
- Static file caching

---

## 🔐 CREDENTIALS & SECURITY

### Database Credentials:

**Location (temporary):** `/var/www/kcy-ecosystem/database-credentials.txt`

⚠️ **IMPORTANT:**
1. Save credentials to password manager
2. Delete `database-credentials.txt` after saving
3. Never commit `.env` files to git

### Admin Access:

**Recommended:** Protect admin pages with HTTP Basic Auth

```bash
# Create password
htpasswd -c /etc/nginx/.htpasswd admin

# Add to nginx config for /*/admin/ locations
```

### SSL Certificates:

**Auto-installed by Let's Encrypt**
- Auto-renewal every 90 days
- Monitored by certbot.timer

---

## 🛠️ ADMIN COMMANDS

After deployment, these commands are available:

### `kcy-status` - System Status
```bash
kcy-status
```
Shows: Services, SSL, disk usage

### `kcy-restart` - Restart Services
```bash
kcy-restart
```
Restarts: chat service, nginx

### `kcy-backup` - Manual Backup
```bash
kcy-backup
```
Backs up: Database + uploads

### View Logs:
```bash
# Chat service
journalctl -u kcy-chat.service -f

# Nginx errors
tail -f /var/log/nginx/kcy-ecosystem-error.log

# Nginx access
tail -f /var/log/nginx/kcy-ecosystem-access.log
```

---

## 📱 MOBILE APP

### App Information:

- **Name:** AMS Chat
- **Package:** com.amschat.app
- **Framework:** React Native + Expo
- **Platforms:** Android 8.0+, iOS 13.4+

### Publishing Platforms:

1. **Google Play Store** - Primary
2. **Apple App Store** - Primary
3. **Direct APK** - Alternative (https://alsec.strangled.net/downloads/ams-chat.apk)
4. **F-Droid** - Open source (optional)
5. **Samsung Galaxy Store** - Optional
6. **Huawei AppGallery** - Optional

### Build Commands:

```bash
# Expo build
expo build:android
expo build:ios

# Or EAS build
eas build --platform android
eas build --platform ios
```

**See:** MOBILE-APP-PUBLISHING-GUIDE.md for detailed guide

---

## 🧪 TESTING

### Automated Tests:

**Location:** `/tests/`

- Token: 10 test files (Hardhat)
- Multi-Sig: 2 test files (Hardhat)
- Chat: 27 test files (Jest)

### Run Tests:

```bash
# All tests
npm test

# Token tests
npm run test:token

# Multi-sig tests
npm run test:multisig

# Chat tests
npm run test:chat
```

### Manual Testing:

**Checklist:** See DEPLOYMENT-CHECKLIST.md section 10

---

## 🔄 COMMON WORKFLOWS

### 1. Update Code:
```powershell
# Windows
.\deploy-scripts\windows\deploy.ps1
```
```bash
# Server
kcy-restart
```

### 2. Update Config:
```bash
nano /var/www/html/shared/js/config.js
# Edit and save
```

### 3. Upload APK:
```bash
scp ams-chat.apk root@alsec.strangled.net:/var/www/html/downloads/
```

### 4. View Logs:
```bash
journalctl -u kcy-chat.service -f
```

### 5. Backup Database:
```bash
sudo -u postgres pg_dump ams_chat_db > backup.sql
```

---

## 🆘 TROUBLESHOOTING

### Quick Fixes:

| Problem | Solution |
|---------|----------|
| Service won't start | `journalctl -u kcy-chat.service -n 50` |
| Nginx error | `nginx -t && tail -f /var/log/nginx/kcy-ecosystem-error.log` |
| Database error | `sudo -u postgres psql -d ams_chat_db` |
| Permission denied | `chown -R www-data:www-data /var/www/html` |
| SSL not working | `certbot certificates && certbot renew` |

**Full troubleshooting:** deploy-scripts/README.md

---

## 📞 SUPPORT & RESOURCES

### Documentation:

- **This File** - Documentation index
- **README.md** - Project overview
- **DEPLOYMENT-CHECKLIST.md** - Complete deployment guide
- **deploy-scripts/README.md** - Scripts reference

### Server Files:

- `/var/www/kcy-ecosystem/deployment-info.txt` - Deployment summary
- `/var/log/nginx/` - Web server logs
- `journalctl -u kcy-chat.service` - Chat service logs

### External Resources:

- Nginx docs: https://nginx.org/en/docs/
- PostgreSQL docs: https://www.postgresql.org/docs/
- Let's Encrypt: https://letsencrypt.org/
- PM2 docs: https://pm2.keymetrics.io/

---

## ✅ DEPLOYMENT SUMMARY

### ⏱️ Time Estimates:

| Task | Time |
|------|------|
| Extract & Deploy | 5 min |
| Database Setup | 10 min |
| Domain & Services | 15 min |
| Configuration | 5 min |
| Testing | 5 min |
| **Total** | **~40 min** |

### 📦 What's Included:

- ✅ Complete source code
- ✅ All documentation
- ✅ Automated deployment scripts
- ✅ Database setup automation
- ✅ Web server configuration
- ✅ SSL certificate setup
- ✅ Service management
- ✅ Admin tools
- ✅ 41 test files
- ✅ Mobile app download page

### 🎯 Production Ready:

- ✅ Security hardened
- ✅ SSL enabled
- ✅ Auto-scaling ready
- ✅ Monitoring ready
- ✅ Backup ready
- ✅ Well documented

---

## 📄 FILE MANIFEST

### Documentation (13 files):
- README.md
- DEPLOYMENT-CHECKLIST.md
- QUICK-START-3-STEPS.md
- DEPLOYMENT-AUTOMATION-SUMMARY.md
- CONFIG-QUICK-REF.md
- MOBILE-APP-PUBLISHING-GUIDE.md
- ALL-LINKS-FIXED.md
- SCRIPTS-EXAMPLES.txt
- deploy-scripts/README.md
- + Token docs (20+ files)
- + Chat docs (20+ files)
- + Multi-Sig docs (2 files)

### Scripts (4 files):
- deploy-scripts/windows/deploy.ps1
- deploy-scripts/windows/deploy.bat
- deploy-scripts/server/01-setup-database.sh
- deploy-scripts/server/02-setup-domain.sh

### Source Code:
- Public: 100+ files
- Private: 200+ files
- Tests: 41 files
- Configs: 10+ files

**Total:** 400+ files in organized structure

---

## 🎉 READY TO DEPLOY!

**Everything you need is in this archive.**

1. Read: [QUICK-START-3-STEPS.md](QUICK-START-3-STEPS.md)
2. Or read: [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md)
3. Deploy: 3 commands, 30 minutes
4. Enjoy: https://alsec.strangled.net

**Good luck! 🚀**

---

**Last Updated:** February 13, 2026  
**Version:** 1.0.0 - Production Ready  
**Domain:** https://alsec.strangled.net
