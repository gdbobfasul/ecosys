#!/bin/bash
# Version: 1.0084
##############################################################################
# KCY Ecosystem - First-Time Server Preparation
# Пуска се ВЕДНЪЖ като root за да подготви сървъра
#
# Какво прави:
#   1. Създава /var/www/deploy/ (staging) с права за deploy потребителя
#   2. Създава системен потребител kcy
#   3. Създава нужните директории
#
# Usage: sudo bash server-prepare.sh [deploy_username]
##############################################################################

DEPLOY_USER="${1:-deploy}"

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: sudo bash $0 [$DEPLOY_USER]"
    exit 1
fi

echo "KCY Ecosystem - Server Preparation"
echo "==================================="
echo ""

# 1. Create kcy system user
if id "kcy" &>/dev/null; then
    echo "✓ User 'kcy' already exists"
else
    useradd --system --no-create-home --shell /usr/sbin/nologin --comment "KCY Ecosystem" kcy
    echo "✓ User 'kcy' created"
fi

# 2. Create staging directory for deploy user
mkdir -p /var/www/deploy
chown "${DEPLOY_USER}:${DEPLOY_USER}" /var/www/deploy
chmod 755 /var/www/deploy
echo "✓ /var/www/deploy/ → owned by ${DEPLOY_USER}"

# 3. Create final directories
mkdir -p /var/www/html
mkdir -p /var/www/kcy-ecosystem
chown -R kcy:kcy /var/www/html /var/www/kcy-ecosystem
echo "✓ /var/www/html/ → owned by kcy"
echo "✓ /var/www/kcy-ecosystem/ → owned by kcy"

# 4. Allow deploy user to run server-install.sh with sudo
echo "✓ Done!"
echo ""
echo "Сега от Windows/Mac машината пускай:"
echo "  ./deploy.sh alsec.strangled.net ${DEPLOY_USER}"
echo ""
echo "След quality на сървъра:"
echo "  ssh ${DEPLOY_USER}@alsec.strangled.net"
echo "  cd /var/www/deploy/deploy-scripts/server"
echo "  sudo bash server-install.sh"
echo ""
