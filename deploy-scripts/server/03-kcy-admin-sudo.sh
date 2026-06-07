#!/bin/bash
# Version: 1.0093
##############################################################################
# KCY Ecosystem - Limited sudo за deploy потребителя
#
# Дава на 'deploy' user-а правото да изпълнява САМО следните неща със sudo
# (без парола, без други повишения):
#
#   • 05-server-install.sh / 06-setup-wizard.sh / 07-setup-database.sh /
#     08-setup-domain.sh — install и setup скриптове
#   • systemctl restart/reload/status за kcy-chat, kcy-eco3, nginx
#
# deploy НЕ може да run-не sudo с други команди (не може sudo rm, sudo cat,
# не може general shell escalation).
#
# Usage: sudo bash 03-kcy-admin-sudo.sh
#
# ⚠ SECURITY WARNING ⚠
# Тъй като /var/www/deploy/deploy-scripts/ е owned от 'deploy' (за да може
# 04-deploy.sh да качва нови версии), теоретично deploy може да замени
# 05-server-install.sh с малициозно съдържание и да го run-не със sudo →
# root escalation.
#
# Това е приемлив trade-off за single-developer setup (твоя случай).
# За multi-tenant production setup препоръчвам install скриптовете да са
# в root-owned директория (напр. /opt/kcy/scripts/) и deploy да ги копира
# там при upload (тогава root проверява чексуми и т.н.).
##############################################################################

set -e

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: този скрипт трябва да се run-не като root"
    echo "       sudo bash $0"
    exit 1
fi

# Проверка че deploy user-ът съществува
if ! id "deploy" &>/dev/null; then
    echo "ERROR: user 'deploy' не съществува"
    echo "       Първо пусни 09-server-prepare-DEPRECATED.sh за да го създаде"
    exit 1
fi

SUDOERS_FILE="/etc/sudoers.d/kcy-deploy"
TMP_FILE="$(mktemp)"
trap "rm -f $TMP_FILE" EXIT

echo "KCY Ecosystem - Limited sudo за 'deploy'"
echo "========================================"
echo ""

# Записва sudoers entry във временен файл
cat > "$TMP_FILE" << 'SUDOERS_EOF'
# KCY Ecosystem — limited sudo за deploy потребителя
# Файлът е управляван от 03-kcy-admin-sudo.sh — не редактирай ръчно.

# Install / setup скриптове - приема и двата начина на извикване:
#   sudo /path/to/script.sh     (директно, ако е executable)
#   sudo bash /path/to/script.sh (с bash prefix - често по навик)
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/05-server-install.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/05-server-install.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/05-server-install.sh

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/06-setup-wizard.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/06-setup-wizard.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/06-setup-wizard.sh

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/07-setup-database.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/07-setup-database.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/07-setup-database.sh

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/08-setup-domain.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/08-setup-domain.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/08-setup-domain.sh

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/09-server-prepare-DEPRECATED.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/09-server-prepare-DEPRECATED.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/09-server-prepare-DEPRECATED.sh

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/03-kcy-admin-sudo.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/03-kcy-admin-sudo.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/03-kcy-admin-sudo.sh
deploy ALL=(root) NOPASSWD: /var/www/kcy-ecosystem/deploy-scripts/server/03-kcy-admin-sudo.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/kcy-ecosystem/deploy-scripts/server/03-kcy-admin-sudo.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/kcy-ecosystem/deploy-scripts/server/03-kcy-admin-sudo.sh

# Леки трансфери (sync само сорс / само асети) — overlay, без full install.
# Пускат се от STAGING (/var/www/deploy) — същия път като 05-server-install.sh.
# deploy owns /var/www/deploy и сам разархивира deploy-scripts там преди да викне скрипта.
# Завършващото "" = позволено с КАКВИТО И ДА Е аргументи (пътя до архива).
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/14-sync-source.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/14-sync-source.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/14-sync-source.sh *

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/15-sync-assets.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/15-sync-assets.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/15-sync-assets.sh *

# Нови приложения — setup на отделните PostgreSQL бази (House-Look-Book / WhereNoBiz).
# 16 приема аргумент (houselookbook|wherenobiz|all [--reset]); 17 е без аргумент (или --reset).
# Затова има и bare форма (без аргумент), и форма с "*" (с аргументи).
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/16-setup-app-databases.sh
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/16-setup-app-databases.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/16-setup-app-databases.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/16-setup-app-databases.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/16-setup-app-databases.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/16-setup-app-databases.sh *

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/17-setup-wherenobiz-database.sh
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/17-setup-wherenobiz-database.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/17-setup-wherenobiz-database.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/17-setup-wherenobiz-database.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/17-setup-wherenobiz-database.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/17-setup-wherenobiz-database.sh *

# Нови приложения — setup на УСЛУГИТЕ (systemd + nginx) за House-Look-Book / WhereNoBiz.
# 18/19 нямат позиционни аргументи (само опц. --status); пак даваме bare + "*" форми.
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/18-setup-houselookbook-service.sh
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/18-setup-houselookbook-service.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/18-setup-houselookbook-service.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/18-setup-houselookbook-service.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/18-setup-houselookbook-service.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/18-setup-houselookbook-service.sh *

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/19-setup-wherenobiz-service.sh
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/19-setup-wherenobiz-service.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/19-setup-wherenobiz-service.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/19-setup-wherenobiz-service.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/19-setup-wherenobiz-service.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/19-setup-wherenobiz-service.sh *

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/21-setup-fbp-service.sh
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/21-setup-fbp-service.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/21-setup-fbp-service.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/21-setup-fbp-service.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/21-setup-fbp-service.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/21-setup-fbp-service.sh *

# ECO-3 база данни (SQLite/PostgreSQL) + админи/модератори + рестарт (точка 2 / точка 49).
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/20-setup-eco3-database.sh
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/20-setup-eco3-database.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/20-setup-eco3-database.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/20-setup-eco3-database.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/20-setup-eco3-database.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/20-setup-eco3-database.sh *

# Токен монитори (точка 52 / точка 2) — приема token|brch1|multisig.
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/31-setup-token-monitor.sh
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/31-setup-token-monitor.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/31-setup-token-monitor.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/31-setup-token-monitor.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/31-setup-token-monitor.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/31-setup-token-monitor.sh *

# Тест робот (точка 53) — инсталира Playwright+Chromium за робота.
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/32-setup-robot.sh
deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/32-setup-robot.sh *
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/32-setup-robot.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/32-setup-robot.sh *
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/32-setup-robot.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/32-setup-robot.sh *

# Systemd service management (само за KCY services)
deploy ALL=(root) NOPASSWD: /bin/systemctl restart kcy-chat
deploy ALL=(root) NOPASSWD: /bin/systemctl restart kcy-eco3
deploy ALL=(root) NOPASSWD: /bin/systemctl restart kcy-portals
deploy ALL=(root) NOPASSWD: /bin/systemctl restart kcy-chat.service
deploy ALL=(root) NOPASSWD: /bin/systemctl restart kcy-eco3.service
deploy ALL=(root) NOPASSWD: /bin/systemctl restart kcy-portals.service
deploy ALL=(root) NOPASSWD: /bin/systemctl status kcy-chat
deploy ALL=(root) NOPASSWD: /bin/systemctl status kcy-eco3
deploy ALL=(root) NOPASSWD: /bin/systemctl start kcy-chat
deploy ALL=(root) NOPASSWD: /bin/systemctl start kcy-eco3
deploy ALL=(root) NOPASSWD: /bin/systemctl stop kcy-chat
deploy ALL=(root) NOPASSWD: /bin/systemctl stop kcy-eco3

# Nginx management
deploy ALL=(root) NOPASSWD: /bin/systemctl reload nginx
deploy ALL=(root) NOPASSWD: /bin/systemctl restart nginx
deploy ALL=(root) NOPASSWD: /bin/systemctl status nginx
deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t

# Логове (read-only)
deploy ALL=(root) NOPASSWD: /usr/bin/journalctl -u kcy-chat *
deploy ALL=(root) NOPASSWD: /usr/bin/journalctl -u kcy-eco3 *

Defaults:deploy !requiretty
SUDOERS_EOF

echo "[1/3] Валидиране на sudoers entry..."
if ! visudo -c -f "$TMP_FILE" >/dev/null 2>&1; then
    echo "✗ Синтаксисът е invalid:"
    visudo -c -f "$TMP_FILE"
    exit 1
fi
echo "  ✓ Синтаксисът е валиден"

echo ""
echo "[2/3] Инсталиране в ${SUDOERS_FILE}..."
BACKUP=""
if [ -f "$SUDOERS_FILE" ]; then
    BACKUP="${SUDOERS_FILE}.bak-$(date +%Y%m%d-%H%M%S)"
    cp "$SUDOERS_FILE" "$BACKUP"
    echo "  ✓ Backup: $BACKUP"
fi

install -m 0440 -o root -g root "$TMP_FILE" "$SUDOERS_FILE"
echo "  ✓ Инсталирано (mode 0440, owner root:root)"

echo ""
echo "[3/3] Проверка че sudo системата е здрава..."
if ! visudo -c >/dev/null 2>&1; then
    echo "✗ sudo конфигурацията е счупена! Връщам backup..."
    if [ -n "$BACKUP" ]; then
        cp "$BACKUP" "$SUDOERS_FILE"
    else
        rm -f "$SUDOERS_FILE"
    fi
    exit 1
fi
echo "  ✓ Цялата sudo конфигурация е валидна"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ Готово!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Сега 'deploy' може да run-не БЕЗ парола:"
echo ""
echo "  sudo bash /var/www/deploy/deploy-scripts/server/05-server-install.sh"
echo "  sudo systemctl restart kcy-chat"
echo "  sudo systemctl status nginx"
echo ""
echo "Тест:"
echo "  su - deploy"
echo "  sudo bash /var/www/deploy/deploy-scripts/server/05-server-install.sh"
echo ""
echo "За премахване по-късно:"
echo "  sudo rm $SUDOERS_FILE"
echo ""
