#!/bin/bash
# Version: 1.0088
##############################################################################
# KCY Ecosystem - Bootstrap on fresh server
#
# Превръща чисто инсталиран Ubuntu (24.04 / 26.04) в готов за deploy сървър.
# Изпълнява се ВЕДНЪЖ — при първоначална настройка на нов сървър или VM.
#
# Usage:
#   На сървъра като root:
#     wget https://raw.githubusercontent.com/.../02-bootstrap-server.sh
#     sudo bash 02-bootstrap-server.sh
#
#   Или ако е копиран през scp:
#     sudo bash /tmp/02-bootstrap-server.sh
#
# Какво прави (всичко идемпотентно — безопасно за повторно run):
#   1. Update на системата
#   2. Инсталиране на base packages (nginx, nodejs 20, postgresql, sqlite, ...)
#   3. Създаване на нужните потребители (deploy, kcy-chat, kcy-eco3) + group (kcy)
#   4. SSH ключ за deploy
#   5. Директории и permissions
#   6. Limited sudo за deploy (за да може да run-ва 05-server-install.sh)
#   7. Firewall (ufw) с базови правила
#   8. SSH hardening (опционално — disable password auth)
#
# Потребители които съществуват СЛЕД скрипта (и НИЩО ПОВЕЧЕ):
#   • deploy    — качва файлове, run-ва install скриптовете (limited sudo)
#   • kcy-chat  — systemd service user за chat (no shell, no home)
#   • kcy-eco3  — systemd service user за eco-3 (no shell, no home)
#   • kcy       — group, обединяваща kcy-chat, kcy-eco3, deploy, www-data
##############################################################################

set -e

# ═══ COLORS ═══
RED='\033[0;31m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

print_step() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
}

print_ok() { echo -e "  ${GREEN}✓${NC} $1"; }
print_skip() { echo -e "  ${YELLOW}↷${NC} $1"; }
print_err() { echo -e "  ${RED}✗${NC} $1"; }

# ═══ PREFLIGHT ═══
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: този скрипт трябва да се run-не като root"
    echo "       sudo bash $0"
    exit 1
fi

if [ ! -f /etc/os-release ]; then
    echo "ERROR: не мога да определя ОС-а"
    exit 1
fi

. /etc/os-release
if [ "$ID" != "ubuntu" ] && [ "$ID" != "debian" ]; then
    echo "ERROR: този скрипт е тестван на Ubuntu/Debian. Намерих: $PRETTY_NAME"
    read -p "Продължи на собствен риск? [y/N]: " CONT
    [ "$CONT" != "y" ] && [ "$CONT" != "Y" ] && exit 1
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  KCY Ecosystem — Bootstrap a fresh server         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo "  OS:       $PRETTY_NAME"
echo "  Kernel:   $(uname -r)"
echo "  Hostname: $(hostname)"
echo "  Date:     $(date)"
echo ""

# ═══ STEP 1: SYSTEM UPDATE ═══
print_step "STEP 1: System update"
apt-get update -qq
apt-get upgrade -y -qq
print_ok "Системата е up-to-date"

# Определи дали ще променяме SSH порта
# /tmp/desired_ssh_port се поставя от 01-bootstrap.sh launcher-а на Windows.
# Ако файлът липсва — оставяме текущия порт.
CURRENT_SSH_PORT=$(grep -E "^Port\s" /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' | head -1)
CURRENT_SSH_PORT="${CURRENT_SSH_PORT:-22}"

NEW_SSH_PORT="$CURRENT_SSH_PORT"
if [ -s /tmp/desired_ssh_port ]; then
    REQUESTED_PORT=$(cat /tmp/desired_ssh_port | tr -d '[:space:]')
    if [[ "$REQUESTED_PORT" =~ ^[0-9]+$ ]] && [ "$REQUESTED_PORT" -ge 1 ] && [ "$REQUESTED_PORT" -le 65535 ]; then
        NEW_SSH_PORT="$REQUESTED_PORT"
        rm -f /tmp/desired_ssh_port
        if [ "$NEW_SSH_PORT" != "$CURRENT_SSH_PORT" ]; then
            print_ok "Ще променя SSH порт ${CURRENT_SSH_PORT} → ${NEW_SSH_PORT} (накрая на bootstrap-а)"
        else
            print_ok "SSH порт остава ${NEW_SSH_PORT}"
        fi
    fi
fi

# ═══ STEP 2: BASE PACKAGES ═══
print_step "STEP 2: Base packages"

PACKAGES=(
    curl wget gnupg git
    nginx
    sqlite3
    ufw fail2ban
    tmux
    dos2unix
    build-essential python3
    htop
    ca-certificates
)

echo "  Инсталирам: ${PACKAGES[*]}"
apt-get install -y -qq "${PACKAGES[@]}" >/dev/null
print_ok "Base packages инсталирани"

# Опционално PostgreSQL — питай
echo ""
read -p "  Да инсталирам PostgreSQL? [y/N]: " INSTALL_PG
if [ "$INSTALL_PG" = "y" ] || [ "$INSTALL_PG" = "Y" ]; then
    apt-get install -y -qq postgresql postgresql-contrib >/dev/null
    print_ok "PostgreSQL инсталиран"
else
    print_skip "PostgreSQL пропуснат (SQLite-only setup)"
fi

# Опционално certbot (за SSL) — питай
echo ""
read -p "  Да инсталирам certbot (за Let's Encrypt SSL)? [Y/n]: " INSTALL_CB
INSTALL_CB="${INSTALL_CB:-y}"
if [ "$INSTALL_CB" = "y" ] || [ "$INSTALL_CB" = "Y" ]; then
    apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
    print_ok "certbot инсталиран"
fi

# ═══ STEP 3: NODE.JS 20 LTS ═══
print_step "STEP 3: Node.js 20 LTS"

CURRENT_NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    CURRENT_NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
fi

if [ "$CURRENT_NODE_MAJOR" -ge 20 ]; then
    print_ok "Node $(node -v) — вече подходящ"
else
    echo "  Добавям NodeSource repo..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs >/dev/null
    print_ok "Node $(node -v) инсталиран"
fi
print_ok "NPM $(npm -v)"

# ═══ STEP 4: GROUP AND USERS ═══
print_step "STEP 4: Users and group"

# kcy group
if ! getent group kcy >/dev/null; then
    groupadd kcy
    print_ok "Group 'kcy' създадена"
else
    print_skip "Group 'kcy' вече съществува"
fi

# deploy user
if ! id deploy &>/dev/null; then
    useradd -m -s /bin/bash -c "KCY Deploy (upload + limited sudo)" deploy
    print_ok "User 'deploy' създаден"
else
    print_skip "User 'deploy' вече съществува"
fi
usermod -aG kcy deploy

# Сетни парола за deploy ако още няма (нужна за първоначално влизане ако SSH key не е добавен)
if ! passwd -S deploy 2>/dev/null | grep -qE " P "; then
    echo ""
    echo "  ${YELLOW}deploy няма парола. Задай я сега (нужна само за първоначално SSH влизане):${NC}"
    passwd deploy
fi

# kcy-chat system user
if ! id kcy-chat &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin --gid kcy -c "KCY Chat Service" kcy-chat
    print_ok "User 'kcy-chat' създаден (system, no shell)"
else
    print_skip "User 'kcy-chat' вече съществува"
fi

# kcy-eco3 system user
if ! id kcy-eco3 &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin --gid kcy -c "KCY ECO-3 Service" kcy-eco3
    print_ok "User 'kcy-eco3' създаден (system, no shell)"
else
    print_skip "User 'kcy-eco3' вече съществува"
fi

# www-data в kcy group (за nginx да може да чете shared файлове)
usermod -aG kcy www-data
print_ok "www-data добавен към група 'kcy'"

# Премахни 'kcy-admin' ако съществува от стар setup (вече не е нужен — deploy има limited sudo)
if id kcy-admin &>/dev/null; then
    echo ""
    echo "  ${YELLOW}Намерих user 'kcy-admin' от стар setup. Премахни ли го? [y/N]:${NC}"
    read REMOVE_OLD
    if [ "$REMOVE_OLD" = "y" ] || [ "$REMOVE_OLD" = "Y" ]; then
        userdel -r kcy-admin 2>/dev/null || userdel kcy-admin
        print_ok "kcy-admin премахнат"
    fi
fi

# ═══ STEP 5: SSH KEY ЗА DEPLOY ═══
print_step "STEP 5: SSH ключ за deploy"

DEPLOY_SSH="/home/deploy/.ssh"
mkdir -p "$DEPLOY_SSH"

if [ -s "$DEPLOY_SSH/authorized_keys" ]; then
    print_skip "deploy вече има authorized_keys ($(wc -l < $DEPLOY_SSH/authorized_keys) ключа)"
    echo ""
    read -p "  Да добавя нов ключ отгоре? [y/N]: " ADD_KEY
    APPEND_MODE="$ADD_KEY"
else
    APPEND_MODE="y"
fi

if [ "$APPEND_MODE" = "y" ] || [ "$APPEND_MODE" = "Y" ]; then
    NEW_KEY=""

    # Non-interactive mode — pubkey се чете от /tmp/deploy_pubkey
    # (използва се от 01-bootstrap.sh launcher-а на Windows)
    if [ -s /tmp/deploy_pubkey ]; then
        NEW_KEY=$(cat /tmp/deploy_pubkey)
        rm -f /tmp/deploy_pubkey
        print_ok "Public key прочетен от /tmp/deploy_pubkey"
    else
        # Interactive prompt
        echo ""
        echo "  Постави съдържанието на твоя public key (id_ed25519.pub или id_rsa.pub):"
        echo "  Започва с 'ssh-ed25519' или 'ssh-rsa', завършва с email/коментар."
        echo "  След като paste-неш — натисни Enter, после Ctrl+D:"
        echo ""
        NEW_KEY=$(cat)
    fi

    if [ -n "$NEW_KEY" ]; then
        echo "$NEW_KEY" >> "$DEPLOY_SSH/authorized_keys"
        print_ok "Ключ добавен"
    else
        print_skip "Не въведе ключ. Можеш да го добавиш по-късно в $DEPLOY_SSH/authorized_keys"
    fi
fi

chmod 700 "$DEPLOY_SSH"
[ -f "$DEPLOY_SSH/authorized_keys" ] && chmod 600 "$DEPLOY_SSH/authorized_keys"
chown -R deploy:deploy "$DEPLOY_SSH"
print_ok "Permissions на $DEPLOY_SSH настроени"

# ═══ STEP 6: ДИРЕКТОРИИ ═══
print_step "STEP 6: Директории"

# /var/www/deploy — staging area където 04-deploy.sh качва
mkdir -p /var/www/deploy
chown -R deploy:kcy /var/www/deploy
chmod 750 /var/www/deploy
print_ok "/var/www/deploy (owner: deploy:kcy)"

# /var/www/kcy-ecosystem — production location
mkdir -p /var/www/kcy-ecosystem
chown -R deploy:kcy /var/www/kcy-ecosystem
chmod 750 /var/www/kcy-ecosystem
print_ok "/var/www/kcy-ecosystem (owner: deploy:kcy)"

# ═══ STEP 7: LIMITED SUDO ЗА DEPLOY ═══
print_step "STEP 7: Limited sudo за deploy"

SUDOERS_FILE="/etc/sudoers.d/kcy-deploy"
TMP_SUDOERS="$(mktemp)"

cat > "$TMP_SUDOERS" << 'SUDO_EOF'
# KCY Ecosystem — limited sudo за deploy user.
# Управлява се от 02-bootstrap-server.sh + 03-kcy-admin-sudo.sh. Не редактирай ръчно.

# Install / setup скриптове (директно + bash + /usr/bin/bash + /bin/bash вариант)
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

# Systemd service management
deploy ALL=(root) NOPASSWD: /bin/systemctl restart kcy-chat
deploy ALL=(root) NOPASSWD: /bin/systemctl restart kcy-eco3
deploy ALL=(root) NOPASSWD: /bin/systemctl start kcy-chat
deploy ALL=(root) NOPASSWD: /bin/systemctl start kcy-eco3
deploy ALL=(root) NOPASSWD: /bin/systemctl stop kcy-chat
deploy ALL=(root) NOPASSWD: /bin/systemctl stop kcy-eco3
deploy ALL=(root) NOPASSWD: /bin/systemctl status kcy-chat
deploy ALL=(root) NOPASSWD: /bin/systemctl status kcy-eco3
deploy ALL=(root) NOPASSWD: /bin/systemctl reload nginx
deploy ALL=(root) NOPASSWD: /bin/systemctl restart nginx
deploy ALL=(root) NOPASSWD: /bin/systemctl status nginx
deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t
deploy ALL=(root) NOPASSWD: /usr/bin/journalctl -u kcy-chat *
deploy ALL=(root) NOPASSWD: /usr/bin/journalctl -u kcy-eco3 *

Defaults:deploy !requiretty
SUDO_EOF

if visudo -c -f "$TMP_SUDOERS" >/dev/null 2>&1; then
    install -m 0440 -o root -g root "$TMP_SUDOERS" "$SUDOERS_FILE"
    rm -f "$TMP_SUDOERS"
    print_ok "Sudoers entry инсталиран в $SUDOERS_FILE"
else
    print_err "Sudoers syntax error — пропускам"
    rm -f "$TMP_SUDOERS"
fi

# Финална проверка
if visudo -c >/dev/null 2>&1; then
    print_ok "Цялата sudo конфигурация е валидна"
else
    print_err "ВНИМАНИЕ: sudo има проблеми! Провери с 'visudo -c'"
fi

# ═══ STEP 8: FIREWALL ═══
print_step "STEP 8: Firewall (ufw)"

ufw --force reset >/dev/null 2>&1
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null

# Текущ SSH порт (за да не загубим връзката по време на bootstrap-а)
ufw allow "$CURRENT_SSH_PORT/tcp" comment "SSH (current)" >/dev/null
print_ok "SSH порт $CURRENT_SSH_PORT отворен (текущ)"

# Ако ще променяме SSH порт — отвори и новия
if [ "$NEW_SSH_PORT" != "$CURRENT_SSH_PORT" ]; then
    ufw allow "$NEW_SSH_PORT/tcp" comment "SSH (new)" >/dev/null
    print_ok "SSH порт $NEW_SSH_PORT отворен (нов)"
fi

# HTTP / HTTPS
ufw allow 80/tcp comment "HTTP" >/dev/null
ufw allow 443/tcp comment "HTTPS" >/dev/null
print_ok "HTTP (80) / HTTPS (443) отворени"

# Активирай
ufw --force enable >/dev/null
print_ok "Firewall активиран"

# ═══ STEP 9: SSH HARDENING (опционално) ═══
print_step "STEP 9: SSH hardening"

if [ -s "$DEPLOY_SSH/authorized_keys" ]; then
    echo ""
    echo "  deploy вече има SSH ключ. Може да изключим парола за SSH?"
    echo "  ${YELLOW}ВАЖНО: преди да изключиш, тествай ssh от друга машина за да си сигурен!${NC}"
    read -p "  Изключи password authentication за SSH? [y/N]: " DISABLE_PW
    if [ "$DISABLE_PW" = "y" ] || [ "$DISABLE_PW" = "Y" ]; then
        cp /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%s)"
        sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
        sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
        systemctl reload ssh 2>/dev/null || systemctl reload sshd
        print_ok "Password auth изключен. Само SSH ключове."
    else
        print_skip "Password auth остава активен"
    fi
else
    print_skip "deploy няма SSH ключ — оставям password auth активен"
fi

# ═══ STEP 10: ENABLE SERVICES ═══
print_step "STEP 10: Enable & start services"
systemctl enable --now nginx >/dev/null 2>&1
print_ok "nginx стартиран"
systemctl enable --now fail2ban >/dev/null 2>&1
print_ok "fail2ban стартиран"
if systemctl list-unit-files | grep -q "^postgresql"; then
    systemctl enable --now postgresql >/dev/null 2>&1
    print_ok "PostgreSQL стартиран"
fi

# ═══ STEP 11: SSH PORT CHANGE (ако е нужно) ═══
if [ "$NEW_SSH_PORT" != "$CURRENT_SSH_PORT" ]; then
    print_step "STEP 11: Промяна на SSH порт ${CURRENT_SSH_PORT} → ${NEW_SSH_PORT}"

    # Backup на sshd_config
    cp /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%s)"

    # Изтрий стари Port декларации
    sed -i '/^Port\s/d' /etc/ssh/sshd_config
    sed -i '/^#Port\s/d' /etc/ssh/sshd_config

    # Добави новата в началото
    sed -i "1i Port $NEW_SSH_PORT" /etc/ssh/sshd_config

    # Провери синтаксис преди restart
    if sshd -t 2>/dev/null; then
        # Reload, не restart — съществуващи сесии оцеляват
        systemctl reload ssh 2>/dev/null || systemctl reload sshd
        print_ok "sshd reloaded — нови SSH сесии вече трябва на порт ${NEW_SSH_PORT}"

        # Премахни старият порт от firewall (новият вече е отворен)
        ufw delete allow "$CURRENT_SSH_PORT/tcp" >/dev/null 2>&1 || true
        print_ok "Стар SSH порт ${CURRENT_SSH_PORT} затворен в firewall"
    else
        print_err "sshd config има грешка! Връщам backup-а."
        cp "/etc/ssh/sshd_config.bak."* /etc/ssh/sshd_config 2>/dev/null
        NEW_SSH_PORT="$CURRENT_SSH_PORT"
    fi
fi

# ═══ DONE ═══
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ BOOTSTRAP COMPLETE                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# Sumary
SERVER_IP=$(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -1)
SERVER_IP="${SERVER_IP:-(не открит)}"

echo "  Сървър IP:     ${GREEN}${SERVER_IP}${NC}"
echo "  SSH порт:      ${GREEN}${NEW_SSH_PORT}${NC}"
echo "  Deploy потр:   ${GREEN}deploy${NC}"
echo "  Услуги:        ${GREEN}nginx${NC}, ${GREEN}fail2ban${NC} (стартирани)"
echo ""
echo -e "${CYAN}СЛЕДВАЩИ СТЪПКИ:${NC}"
echo ""
echo "  1. Тествай SSH от твоя Windows (Git Bash):"
echo "     ${CYAN}ssh -p ${NEW_SSH_PORT} deploy@${SERVER_IP}${NC}"
echo ""
echo "  2. Промени .deploy-targets с IP-то на сървъра:"
echo "     ${CYAN}TARGET_vm_SERVER=\"${SERVER_IP}\"${NC}"
echo "     ${CYAN}TARGET_vm_PORT=\"${NEW_SSH_PORT}\"${NC}"
echo ""
echo "  3. Първи deploy от Windows:"
echo "     ${CYAN}./deploy-scripts/04-deploy.sh vm${NC}"
echo ""
echo "     04-deploy.sh ще извика 05-server-install.sh автоматично в края."
echo ""
echo -e "${YELLOW}Логове на този bootstrap:${NC}"
echo "  Apt history: /var/log/apt/history.log"
echo "  Sudoers:     ${SUDOERS_FILE}"
echo ""
