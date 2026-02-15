<!-- Version: 1.0056 -->
# 1. Създай user 'ams-chat'
sudo adduser --system --group --no-create-home ams-chat

# 2. Промени ownership на проекта
sudo chown -R ams-chat:ams-chat /var/www/ams-chat-web

# 3. Спри стария PM2
pm2 delete ams-chat
pm2 save
pm2 unstartup

# 4. Switch към новия user
sudo su - ams-chat -s /bin/bash

# 5. Start PM2 като ams-chat user
cd /var/www/ams-chat-web
pm2 start server.js --name ams-chat
pm2 save
pm2 startup systemd -u ams-chat --hp /home/ams-chat
# Копирай и изпълни командата която дава

# 6. Exit от ams-chat user
exit



# 1. Провери че deploy НЯМА sudo
sudo -l -U deploy
# Трябва да каже: User deploy is not allowed to run sudo

# 2. Ако ИМА sudo - премахни го
sudo deluser deploy sudo
```

---

## 📋 ТЕКУЩО СЪСТОЯНИЕ (Добро!):
```
User: deploy
Process: PM2 ams-chat
Files: /var/www/ams-chat-web (owned by deploy)
Database: amschat.db (owned by deploy)
Git: Works as deploy user


------------------------------
# ❌ ПРОБЛЕМ: PM2 иска да използва `/nonexistent/`

Това означава че `ams-chat` user **няма home directory**!

---

## ✅ РЕШЕНИЕ - СЪЗДАЙ HOME DIRECTORY:

```bash
# Exit от ams-chat (ако си в него)
exit

# Създай home directory
sudo mkdir -p /var/ams-chat
sudo chown ams-chat:ams-chat /var/ams-chat

# Set home directory за user
sudo usermod -d /var/ams-chat ams-chat

# Провери
id ams-chat
grep ams-chat /etc/passwd
# Трябва да видиш: ams-chat:x:XXX:XXX::/var/ams-chat:/usr/sbin/nologin
```

---

## 🚀 СЕГА СТАРТИРАЙ PM2:

```bash
# Switch към ams-chat С указване на home
sudo -u ams-chat HOME=/var/ams-chat bash

# Провери че HOME е правилен
echo $HOME
# Трябва: /var/ams-chat

# Отиди в проекта
cd /var/www/ams-chat-web

# Стартирай PM2
pm2 start server.js --name ams-chat

# Save
pm2 save

# Setup startup
pm2 startup systemd
# КОПИРАЙ командата!

# Exit
exit
```

---

## 📝 ИЛИ ПЪЛНО ПРЕСЪЗДАВАНЕ НА USER:

```bash
# Изтрий стария user
sudo userdel ams-chat

--------------------------------
# Виж какво е процеса
ps aux | grep 26723

# Убий го
sudo kill -9 26723

# Виж всички процеси на ams-chat
ps -u ams-chat

# Убий всички процеси на този user
sudo pkill -u ams-chat

# Сега изтрий user-а
sudo userdel ams-chat
--------------------------------


# Създай НAНОВО с home
sudo useradd -r -m -d /var/ams-chat -s /usr/sbin/nologin ams-chat

# Провери
id ams-chat
grep ams-chat /etc/passwd

# Смени ownership
sudo chown -R ams-chat:ams-chat /var/www/ams-chat-web
sudo chown -R ams-chat:ams-chat /var/ams-chat

# Стартирай PM2
sudo -u ams-chat HOME=/var/ams-chat bash
cd /var/www/ams-chat-web
pm2 start server.js --name ams-chat
pm2 save
pm2 startup systemd
exit

# Изпълни startup командата (която PM2 показва)
```

---

## 🎯 КРАТКО:

```bash
# 1. Създай home
sudo mkdir -p /var/ams-chat
sudo chown ams-chat:ams-chat /var/ams-chat
sudo usermod -d /var/ams-chat ams-chat

# 2. Стартирай
sudo -u ams-chat HOME=/var/ams-chat bash
cd /var/www/ams-chat-web
pm2 start server.js --name ams-chat
pm2 save
pm2 startup systemd
exit

# 3. Изпълни командата от pm2 startup (като root)
```

**System users СЪЩО имат нужда от home directory за PM2!** 👍

