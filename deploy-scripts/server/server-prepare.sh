#!/bin/bash
# Version: 1.0085
##############################################################################
# KCY Ecosystem - First-Time Server Preparation
# Пуска се ВЕДНЪЖ като root за да подготви сървъра
#
# Какво прави:
#   1. Създава deploy потребител (само качва)
#   2. Създава kcy-admin потребител (инсталира, sudo)
#   3. Създава системни потребители kcy-chat, kcy-eco3
#   4. Създава нужните директории с правилни права
#
# Usage: sudo bash server-prepare.sh
##############################################################################

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: sudo bash $0"
    exit 1
fi

echo "KCY Ecosystem - Server Preparation"
echo "==================================="
echo ""

# 1. Create kcy group
if getent group "kcy" &>/dev/null; then
    echo "✓ Group 'kcy' already exists"
else
    groupadd --system kcy
    echo "✓ Group 'kcy' created"
fi

# 2. Create deploy user (само качване, БЕЗ sudo)
if id "deploy" &>/dev/null; then
    echo "✓ User 'deploy' already exists"
else
    useradd -m -s /bin/bash -c "KCY Deploy (upload only)" deploy
    passwd deploy
    echo "✓ User 'deploy' created"
fi

# 3. Create kcy-admin user (инсталация, sudo)
if id "kcy-admin" &>/dev/null; then
    echo "✓ User 'kcy-admin' already exists"
else
    useradd -m -s /bin/bash -c "KCY Admin (install/manage)" kcy-admin
    usermod -aG sudo kcy-admin
    echo "✓ User 'kcy-admin' created (с sudo)"
    echo "  Set password:"
    passwd kcy-admin
fi

# 4. Create service users (system, no login, no password)
for SVC_USER in kcy-chat kcy-eco3; do
    if id "$SVC_USER" &>/dev/null; then
        echo "✓ User '$SVC_USER' already exists"
    else
        useradd --system --no-create-home --shell /usr/sbin/nologin --gid kcy --comment "KCY Service" "$SVC_USER"
        echo "✓ User '$SVC_USER' created (system, no login)"
    fi
done

# 5. Create staging directory (deploy owns it)
mkdir -p /var/www/deploy
chown deploy:deploy /var/www/deploy
chmod 755 /var/www/deploy
echo "✓ /var/www/deploy/ → deploy:deploy"

# 6. Create final directories
mkdir -p /var/www/html
mkdir -p /var/www/kcy-ecosystem/private/chat
mkdir -p /var/www/kcy-ecosystem/private/eco-3
chown root:kcy /var/www/html /var/www/kcy-ecosystem
chown -R kcy-chat:kcy /var/www/kcy-ecosystem/private/chat
chown -R kcy-eco3:kcy /var/www/kcy-ecosystem/private/eco-3
echo "✓ /var/www/html/ → root:kcy"
echo "✓ private/chat/ → kcy-chat:kcy"
echo "✓ private/eco-3/ → kcy-eco3:kcy"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Подготовката завърши!"
echo "═══════════════════════════════════════════════"
echo ""
echo "Потребители:"
echo "  deploy     — качва файлове (БЕЗ sudo)"
echo "  kcy-admin  — инсталира (sudo, премахва се след инсталация)"
echo "  kcy-chat   — Chat сървис (system, no login)"
echo "  kcy-eco3   — ECO-3 сървис (system, no login)"
echo ""
echo "Следващи стъпки:"
echo "  1. От Windows PowerShell копирай SSH ключа:"
echo "     type \$env:USERPROFILE\.ssh\id_ed25519.pub | ssh deploy@$(hostname)"
echo "     \"mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys\""
echo ""
echo "  2. Пусни deploy: ./deploy.sh"
echo "  3. ssh deploy@$(hostname)"
echo "     su - kcy-admin"
echo "     cd /var/www/deploy/deploy-scripts/server"
echo "     sudo bash server-install.sh"
echo ""
