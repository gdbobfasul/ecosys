#!/bin/bash
# Version: 1.0090
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
#   8. SSH порт промяна (накрая, ако е нужно)
#
# Потребители които съществуват СЛЕД скрипта (и НИЩО ПОВЕЧЕ):
#   • deploy    — качва файлове, run-ва install скриптовете (limited sudo)
#   • kcy-chat  — systemd service user за chat (no shell, no home)
#   • kcy-eco3  — systemd service user за eco-3 (no shell, no home)
#   • kcy       — group, обединяваща kcy-chat, kcy-eco3, deploy, www-data
##############################################################################

set -e

# ═══ COLORS ═══
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

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

# ═══ TARGET INFO (от 01-bootstrap.sh) ═══
TARGET_NAME=""
TARGET_SERVER=""
if [ -f /tmp/deploy_target_info ]; then
    . /tmp/deploy_target_info
    # НЕ изтриваме файла — 05-server-install.sh също го ползва
fi

# Fallback: auto-detect ако bootstrap.sh не е подал info (за директен sudo bash)
if [ -z "$TARGET_NAME" ]; then
    MY_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [[ "$MY_IP" =~ ^192\.168\.|^10\.|^172\.16\.|^172\.17\.|^172\.18\.|^172\.19\.|^172\.2[0-9]\.|^172\.3[0-1]\. ]]; then
        TARGET_NAME="vm"
    else
        TARGET_NAME="prod"
    fi
fi

case "$TARGET_NAME" in
    vm)   echo -e "  ${CYAN}► Target: VM (локална, private IP)${NC}" ;;
    prod) echo -e "  ${CYAN}► Target: Production (public сървър)${NC}" ;;
    *)    echo -e "  ${CYAN}► Target: ${TARGET_NAME}${NC}" ;;
esac
echo ""

# ═══ MODE SELECTION ═══
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Bootstrap mode?${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  1) ${YELLOW}ПЪЛНА ПРЕИНСТАЛАЦИЯ${NC} — преинсталира всичко без питане"
echo "     apt --reinstall на ВСИЧКИ packages, Node, PostgreSQL, certbot."
echo "     Без интерактивни въпроси за packages. SSH key/firewall/sudoers"
echo "     се пренаписват."
echo ""
echo "  2) ${GREEN}ИЗБОР ПО ПАКЕТИ${NC} — пита за всяка група дали да преинсталира"
echo "     Минава през base packages, Node, PostgreSQL, certbot — за всяка"
echo "     пита 'reinstall? y/N'. Удобно за частичен update."
echo ""
echo "  3) ${CYAN}ПРОПУСНИ ПРЕИНСТАЛАЦИЯ${NC} — само config промени"
echo "     Не пипа packages изобщо. Прави: SSH key copy, потребители,"
echo "     директории, sudoers, firewall, SSH порт промяна."
echo ""
read -p "  Избери [1-3, default=2]: " MODE_CHOICE
MODE_CHOICE="${MODE_CHOICE:-2}"

case "$MODE_CHOICE" in
    1) INSTALL_MODE="full" ;;
    2) INSTALL_MODE="selective" ;;
    3) INSTALL_MODE="skip" ;;
    *) INSTALL_MODE="selective" ;;
esac

echo ""
case "$INSTALL_MODE" in
    full)      echo -e "  ${YELLOW}► Mode: ПЪЛНА ПРЕИНСТАЛАЦИЯ${NC}" ;;
    selective) echo -e "  ${GREEN}► Mode: ИЗБОР ПО ПАКЕТИ${NC}" ;;
    skip)      echo -e "  ${CYAN}► Mode: ПРОПУСНИ ПРЕИНСТАЛАЦИЯ (само config)${NC}" ;;
esac
echo ""

# ═══ STEP 1: SYSTEM UPDATE ═══
print_step "STEP 1: System update"
if [ "$INSTALL_MODE" = "skip" ]; then
    apt-get update -qq
    print_skip "Update само на apt cache. Без upgrade (skip mode)."
else
    apt-get update -qq
    apt-get upgrade -y -qq
    print_ok "Системата е up-to-date"
fi

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

case "$INSTALL_MODE" in
    full)
        echo "  Преинсталирам всички ${#PACKAGES[@]} packages..."
        apt-get install -y -qq --reinstall "${PACKAGES[@]}" >/dev/null
        print_ok "Всички packages преинсталирани"

        echo "  Инсталирам PostgreSQL..."
        apt-get install -y -qq --reinstall postgresql postgresql-contrib >/dev/null
        print_ok "PostgreSQL инсталиран"

        # certbot — само за production (VM-овете с private IP нямат смисъл от Let's Encrypt)
        if [ "$TARGET_NAME" = "vm" ]; then
            print_skip "certbot пропуснат (VM target — private IP, без публичен SSL)"
        else
            echo "  Инсталирам certbot..."
            apt-get install -y -qq --reinstall certbot python3-certbot-nginx >/dev/null
            print_ok "certbot инсталиран"
        fi
        ;;

    selective)
        # Питай за base packages
        BASE_INSTALLED=true
        for pkg in "${PACKAGES[@]}"; do
            if ! dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
                BASE_INSTALLED=false
                break
            fi
        done

        if $BASE_INSTALLED; then
            echo ""
            read -p "  Base packages са инсталирани. Преинсталирай? [y/N]: " R
            if [ "$R" = "y" ] || [ "$R" = "Y" ]; then
                apt-get install -y -qq --reinstall "${PACKAGES[@]}" >/dev/null
                print_ok "Base packages преинсталирани"
            else
                print_skip "Base packages пропуснати"
            fi
        else
            # Намери липсващите
            MISSING=()
            for pkg in "${PACKAGES[@]}"; do
                dpkg -l "$pkg" 2>/dev/null | grep -q "^ii" || MISSING+=("$pkg")
            done
            echo "  Липсват: ${MISSING[*]}"
            apt-get install -y -qq "${MISSING[@]}" >/dev/null
            print_ok "Инсталирани ${#MISSING[@]} липсващи packages"
        fi

        # PostgreSQL
        if dpkg -l postgresql 2>/dev/null | grep -q "^ii"; then
            echo ""
            read -p "  PostgreSQL е инсталиран. Преинсталирай? [y/N]: " R
            if [ "$R" = "y" ] || [ "$R" = "Y" ]; then
                apt-get install -y -qq --reinstall postgresql postgresql-contrib >/dev/null
                print_ok "PostgreSQL преинсталиран"
            else
                print_skip "PostgreSQL остава"
            fi
        else
            echo ""
            read -p "  PostgreSQL не е инсталиран. Инсталирай? [y/N]: " R
            if [ "$R" = "y" ] || [ "$R" = "Y" ]; then
                apt-get install -y -qq postgresql postgresql-contrib >/dev/null
                print_ok "PostgreSQL инсталиран"
            else
                print_skip "PostgreSQL пропуснат"
            fi
        fi

        # certbot — само за production
        if [ "$TARGET_NAME" = "vm" ]; then
            print_skip "certbot пропуснат (VM — private IP)"
        elif dpkg -l certbot 2>/dev/null | grep -q "^ii"; then
            echo ""
            read -p "  certbot е инсталиран. Преинсталирай? [y/N]: " R
            if [ "$R" = "y" ] || [ "$R" = "Y" ]; then
                apt-get install -y -qq --reinstall certbot python3-certbot-nginx >/dev/null
                print_ok "certbot преинсталиран"
            else
                print_skip "certbot остава"
            fi
        else
            echo ""
            read -p "  certbot не е инсталиран. Инсталирай? [Y/n]: " R
            R="${R:-y}"
            if [ "$R" = "y" ] || [ "$R" = "Y" ]; then
                apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
                print_ok "certbot инсталиран"
            else
                print_skip "certbot пропуснат"
            fi
        fi
        ;;

    skip)
        print_skip "Skip mode — не пипам packages изобщо"
        ;;
esac

# ═══ STEP 3: NODE.JS 20 LTS ═══
print_step "STEP 3: Node.js 20 LTS"

CURRENT_NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    CURRENT_NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
fi

case "$INSTALL_MODE" in
    full)
        echo "  Преинсталирам Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
        apt-get install -y -qq --reinstall nodejs >/dev/null
        print_ok "Node $(node -v) преинсталиран"
        ;;
    selective)
        if [ "$CURRENT_NODE_MAJOR" -ge 20 ]; then
            echo ""
            read -p "  Node $(node -v) е инсталиран. Преинсталирай? [y/N]: " R
            if [ "$R" = "y" ] || [ "$R" = "Y" ]; then
                curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
                apt-get install -y -qq --reinstall nodejs >/dev/null
                print_ok "Node $(node -v) преинсталиран"
            else
                print_skip "Node $(node -v) остава"
            fi
        else
            echo "  Node липсва или е стар (v${CURRENT_NODE_MAJOR}). Добавям NodeSource repo..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            apt-get install -y -qq nodejs >/dev/null
            print_ok "Node $(node -v) инсталиран"
        fi
        ;;
    skip)
        if [ "$CURRENT_NODE_MAJOR" -ge 20 ]; then
            print_skip "Node $(node -v) — skip mode"
        else
            print_err "Node не е >=20, но si в skip mode. Деплоят ще се счупи!"
        fi
        ;;
esac

command -v node >/dev/null && print_ok "NPM $(npm -v)"

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
touch "$DEPLOY_SSH/authorized_keys"

# Прочети ключа който се опитваме да добавим
NEW_KEY=""
if [ -s /tmp/deploy_pubkey ]; then
    NEW_KEY=$(cat /tmp/deploy_pubkey)
    rm -f /tmp/deploy_pubkey
elif [ ! -s "$DEPLOY_SSH/authorized_keys" ]; then
    # Файлът е празен и няма pubkey за зареждане — питай интерактивно
    echo ""
    echo "  Постави съдържанието на твоя public key (id_ed25519.pub или id_rsa.pub):"
    echo "  Започва с 'ssh-ed25519' или 'ssh-rsa'. След paste — Enter + Ctrl+D:"
    echo ""
    NEW_KEY=$(cat)
fi

# Дедупликирай съществуващи ключове по type+body (без коментара)
# Така ключ с различен коментар (mucy@home vs mucy@laptop) се разпознава като дубликат.
if [ -s "$DEPLOY_SSH/authorized_keys" ]; then
    BEFORE=$(grep -c "^ssh-" "$DEPLOY_SSH/authorized_keys" 2>/dev/null || echo 0)

    # awk: ключ за дедуп = type + body (първите 2 полета); пази целия ред (с коментара)
    awk '
        /^[[:space:]]*$/ { next }                    # skip празни редове
        /^#/ { print; next }                         # запази коментари (ако случайно има)
        {
            fp = $1 " " $2                           # fingerprint = type + key body
            if (!seen[fp]++) print                   # първото срещане — печатай
        }
    ' "$DEPLOY_SSH/authorized_keys" > "$DEPLOY_SSH/authorized_keys.new"
    mv "$DEPLOY_SSH/authorized_keys.new" "$DEPLOY_SSH/authorized_keys"

    AFTER=$(grep -c "^ssh-" "$DEPLOY_SSH/authorized_keys" 2>/dev/null || echo 0)
    if [ "$BEFORE" != "$AFTER" ]; then
        print_ok "Премахнати $((BEFORE - AFTER)) дубликата от authorized_keys (имаше $BEFORE, остават $AFTER)"
    fi
fi

# Добави новия ключ САМО ако още не съществува
if [ -n "$NEW_KEY" ]; then
    # Извлечи "fingerprint" частта (key type + key body, без коментара)
    NEW_KEY_BODY=$(echo "$NEW_KEY" | awk '{print $1" "$2}')

    if [ -s "$DEPLOY_SSH/authorized_keys" ] && grep -qF "$NEW_KEY_BODY" "$DEPLOY_SSH/authorized_keys"; then
        print_skip "Ключът вече съществува в authorized_keys (skip)"
    else
        echo "$NEW_KEY" >> "$DEPLOY_SSH/authorized_keys"
        print_ok "Нов ключ добавен"
    fi
fi

KEY_COUNT=$(grep -c "^ssh-" "$DEPLOY_SSH/authorized_keys" 2>/dev/null || echo 0)
print_ok "deploy има ${KEY_COUNT} SSH ключ(а)"

chmod 700 "$DEPLOY_SSH"
chmod 600 "$DEPLOY_SSH/authorized_keys"
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

# В smart mode: ако файлът съществува и е валиден, пропусни
if [ -f "$SUDOERS_FILE" ] && [ "$INSTALL_MODE" != "full" ]; then
    if visudo -c -f "$SUDOERS_FILE" >/dev/null 2>&1; then
        print_skip "Sudoers entry вече инсталиран и валиден ($SUDOERS_FILE)"
        SKIP_SUDOERS=true
    else
        echo "  ${YELLOW}Sudoers entry съществува но е invalid — преинсталирам${NC}"
        SKIP_SUDOERS=false
    fi
else
    SKIP_SUDOERS=false
fi

if ! $SKIP_SUDOERS; then
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

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/10-disable-ssh-password.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/10-disable-ssh-password.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/10-disable-ssh-password.sh

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/11-setup-tailscale.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/11-setup-tailscale.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/11-setup-tailscale.sh

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/12-setup-failover.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/12-setup-failover.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/12-setup-failover.sh

deploy ALL=(root) NOPASSWD: /var/www/deploy/deploy-scripts/server/13-kcy-admin-sudo-toggle.sh
deploy ALL=(root) NOPASSWD: /usr/bin/bash /var/www/deploy/deploy-scripts/server/13-kcy-admin-sudo-toggle.sh
deploy ALL=(root) NOPASSWD: /bin/bash /var/www/deploy/deploy-scripts/server/13-kcy-admin-sudo-toggle.sh

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
        [ -f "$SUDOERS_FILE" ] && cp "$SUDOERS_FILE" "${SUDOERS_FILE}.bak-$(date +%s)"
        install -m 0440 -o root -g root "$TMP_SUDOERS" "$SUDOERS_FILE"
        rm -f "$TMP_SUDOERS"
        print_ok "Sudoers entry инсталиран в $SUDOERS_FILE"
    else
        print_err "Sudoers syntax error — пропускам"
        rm -f "$TMP_SUDOERS"
    fi
fi

# Финална проверка
if visudo -c >/dev/null 2>&1; then
    print_ok "Цялата sudo конфигурация е валидна"
else
    print_err "ВНИМАНИЕ: sudo има проблеми! Провери с 'visudo -c'"
fi

# ═══ STEP 8: FIREWALL ═══
print_step "STEP 8: Firewall (ufw)"

# Проверка дали ufw вече има конфигурирани правила
UFW_HAS_RULES=false
if ufw status 2>/dev/null | grep -qE "^${CURRENT_SSH_PORT}/tcp|^80/tcp|^443/tcp"; then
    UFW_HAS_RULES=true
fi

if [ "$INSTALL_MODE" = "full" ] || ! $UFW_HAS_RULES; then
    if $UFW_HAS_RULES; then
        echo "  ${YELLOW}Force reset на firewall правилата${NC}"
    fi
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
else
    print_skip "Firewall вече има правила (skip reset). За пълен reset → mode 2."
    # Все пак гарантирай че нужните портове са отворени
    ufw allow "$CURRENT_SSH_PORT/tcp" comment "SSH (current)" >/dev/null 2>&1
    [ "$NEW_SSH_PORT" != "$CURRENT_SSH_PORT" ] && ufw allow "$NEW_SSH_PORT/tcp" comment "SSH (new)" >/dev/null 2>&1
    ufw allow 80/tcp comment "HTTP" >/dev/null 2>&1
    ufw allow 443/tcp comment "HTTPS" >/dev/null 2>&1
    # Гарантирай активиран
    ufw --force enable >/dev/null 2>&1
    print_ok "Допълнени липсващи правила (ако имаше)"
fi

# ═══ STEP 9: TAILSCALE (за failover между VPS и VM) ═══
if [ "$INSTALL_MODE" != "skip" ]; then
    print_step "STEP 9: Tailscale VPN"

    if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
        TS_IP=$(tailscale ip -4 2>/dev/null | head -1)
        print_skip "Tailscale вече активен (IP: ${TS_IP})"
    else
        if ! command -v tailscale >/dev/null 2>&1; then
            echo "  Инсталирам Tailscale..."
            curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1
            print_ok "Tailscale инсталиран"
        fi

        echo ""
        echo "  ${YELLOW}Tailscale auth — какво се случва сега:${NC}"
        echo ""
        echo "    1) tailscale ще покаже URL в следващите 5 секунди"
        echo "    2) Отвори URL-а в browser на твоя Windows"
        echo "    3) Логни се с Google/GitHub/email"
        echo "    4) ${RED}ВАЖНО:${NC} ползвай същия Tailscale акаунт за VPS и VM!"
        echo "    5) Тази машина се появява в мрежата → продължава bootstrap-ът"
        echo ""
        echo "  ${YELLOW}Ако искаш да пропуснеш сега (без failover):${NC} натисни Ctrl+C → пропусни"
        echo "  ${YELLOW}Можеш да го направиш по-късно с:${NC} sudo tailscale up"
        echo ""
        sleep 3

        if [ -n "$TAILSCALE_AUTH_KEY" ]; then
            # Non-interactive с auth key (за CI)
            tailscale up --auth-key="$TAILSCALE_AUTH_KEY" --accept-routes --ssh
        else
            # Interactive — без timeout. Чакаме потребителят да направи auth.
            # Ctrl+C прекъсва и продължава bootstrap-а без Tailscale.
            tailscale up --accept-routes --ssh || {
                echo ""
                echo "  ${YELLOW}!${NC} Tailscale auth прекъснат или провален. Продължавам без него."
                echo "  ${YELLOW}!${NC} Failover няма да работи докато не пуснеш: sudo tailscale up"
            }
        fi

        if tailscale status >/dev/null 2>&1; then
            TS_IP=$(tailscale ip -4 2>/dev/null | head -1)
            print_ok "Tailscale свързан. IP: ${TS_IP}"
        fi
    fi
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

# ═══ STEP 10: SSH PORT CHANGE (ако е нужно) ═══
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
