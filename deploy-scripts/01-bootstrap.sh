#!/bin/bash
# Version: 1.0088
##############################################################################
# KCY Ecosystem — Bootstrap launcher (от Windows Git Bash)
#
# Прави всичко нужно за да превърне чист Ubuntu сървър/VM в готов за deploy:
#   1. Генерира SSH ключ на твоя Windows ако още няма
#   2. Копира public key на сървъра (ssh-copy-id) — пита парола ВЕДНЪЖ
#   3. Качва 02-bootstrap-server.sh + твоя pubkey
#   4. Изпълнява 02-bootstrap-server.sh на сървъра с sudo
#   5. След завършване — тества SSH като deploy user
#
# Usage:
#   ./deploy-scripts/01-bootstrap.sh                                    # използва default
#   ./deploy-scripts/01-bootstrap.sh <server> [user] [port]
#
# Default: 192.168.0.108 kcyecosys 22
#
# Изисквания:
#   • Git Bash на Windows (с ssh, scp, ssh-keygen, ssh-copy-id)
#   • SSH достъп до сървъра (с парола или вече с ключ)
#   • Sudoer user на сървъра (за да run-не 02-bootstrap-server.sh)
##############################################################################

set -e

# Cd към root-а на проекта (parent на deploy-scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ═══ ARGS ═══
SERVER="${1:-192.168.0.108}"
USER="${2:-kcyecosys}"
PORT="${3:-22}"

RED='\033[0;31m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# ═══ HELP ═══
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat << EOF
KCY Ecosystem - Bootstrap launcher

Usage:
  ./deploy-scripts/01-bootstrap.sh                                  # 192.168.0.108 kcyecosys 22
  ./deploy-scripts/01-bootstrap.sh <server>                         # custom server, kcyecosys 22
  ./deploy-scripts/01-bootstrap.sh <server> <user> <port>           # full custom

Какво прави:
  • Генерира SSH ключ на Windows (id_ed25519) ако още няма
  • Копира public key на сървъра — пита парола еднократно
  • Качва 02-bootstrap-server.sh и pubkey
  • Изпълнява 02-bootstrap-server.sh със sudo на сървъра
  • Bootstrap-ът сам инсталира всички пакети, прави потребители и т.н.

В края на bootstrap-а сървърът е готов за './deploy-scripts/04-deploy.sh vm'.
EOF
    exit 0
fi

# ═══ BANNER ═══
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  KCY Ecosystem — Bootstrap a new server           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Server:  ${GREEN}${SERVER}${NC}"
echo "  User:    ${GREEN}${USER}${NC}"
echo "  Port:    ${GREEN}${PORT}${NC} (текущ)"
echo ""

# ═══ STEP 0: ИЗБОР НА НОВ SSH ПОРТ ═══
echo -e "${CYAN}[0/6] SSH порт след bootstrap${NC}"

NEW_SSH_PORT=""
if [ "$PORT" = "2222" ]; then
    echo -e "  SSH вече е на 2222 — оставям както е."
    NEW_SSH_PORT="$PORT"
else
    echo "  Текущ SSH порт: ${PORT}"
    echo "  Опции:"
    echo "    1) Промени на ${GREEN}2222${NC} (препоръчвано — стандарт за non-default SSH)"
    echo "    2) Custom порт"
    echo "    3) Остави ${PORT}"
    echo ""
    read -p "  Избери [1-3, default=1]: " PORT_CHOICE
    PORT_CHOICE="${PORT_CHOICE:-1}"
    case "$PORT_CHOICE" in
        1) NEW_SSH_PORT="2222" ;;
        2)
            while true; do
                read -p "  Въведи нов порт (1024-65535): " NEW_SSH_PORT
                if [[ "$NEW_SSH_PORT" =~ ^[0-9]+$ ]] && [ "$NEW_SSH_PORT" -ge 1024 ] && [ "$NEW_SSH_PORT" -le 65535 ]; then
                    break
                fi
                echo -e "  ${RED}Невалиден порт. Опитай пак.${NC}"
            done
            ;;
        3) NEW_SSH_PORT="$PORT" ;;
        *) NEW_SSH_PORT="2222" ;;
    esac

    if [ "$NEW_SSH_PORT" != "$PORT" ]; then
        echo -e "  ${GREEN}✓${NC} След bootstrap SSH ще бъде на порт ${NEW_SSH_PORT}"
    else
        echo -e "  ${YELLOW}↷${NC} Запазвам текущ порт ${PORT}"
    fi
fi
echo ""

# ═══ STEP 1: SSH KEY НА WINDOWS ═══
echo -e "${CYAN}[1/6] SSH ключ${NC}"

KEY_PATH="$HOME/.ssh/id_ed25519"
PUB_PATH="${KEY_PATH}.pub"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ -f "$KEY_PATH" ] && [ -f "$PUB_PATH" ]; then
    echo -e "  ${GREEN}✓${NC} Вече имаш SSH ключ: ${KEY_PATH}"
else
    echo "  Не намерих SSH ключ — генерирам нов..."
    ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "kcy-ecosystem-$(hostname)"
    chmod 600 "$KEY_PATH"
    chmod 644 "$PUB_PATH"
    echo -e "  ${GREEN}✓${NC} Ключ генериран без passphrase"
fi
echo "  Public key:"
echo -e "  ${YELLOW}$(cat "$PUB_PATH")${NC}"
echo ""

# ═══ STEP 2: ТЕСТ SSH ═══
echo -e "${CYAN}[2/6] Тест SSH връзка${NC}"

# Първо опитай с ключ — ако работи, ssh-copy-id не е нужен
if ssh -o BatchMode=yes -o ConnectTimeout=5 -p "$PORT" "${USER}@${SERVER}" 'echo OK' 2>/dev/null | grep -q OK; then
    echo -e "  ${GREEN}✓${NC} SSH ключ вече работи — пропускам ssh-copy-id"
    KEY_ALREADY_THERE=1
else
    echo -e "  ${YELLOW}!${NC} SSH ключ още не работи — ще го копирам с парола"
    KEY_ALREADY_THERE=0
fi
echo ""

# ═══ STEP 3: COPY KEY (ако нужно) ═══
if [ "$KEY_ALREADY_THERE" -eq 0 ]; then
    echo -e "${CYAN}[3/6] Копиране на ключа на сървъра${NC}"
    echo "  Ще ви попита паролата на ${USER}@${SERVER} (само ВЕДНЪЖ)..."
    echo ""

    if command -v ssh-copy-id >/dev/null 2>&1; then
        ssh-copy-id -p "$PORT" -i "$PUB_PATH" "${USER}@${SERVER}"
    else
        # fallback ако ssh-copy-id липсва
        cat "$PUB_PATH" | ssh -p "$PORT" "${USER}@${SERVER}" \
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
    fi

    # Provери че работи
    if ssh -o BatchMode=yes -o ConnectTimeout=5 -p "$PORT" "${USER}@${SERVER}" 'echo OK' 2>/dev/null | grep -q OK; then
        echo -e "  ${GREEN}✓${NC} Ключ копиран, SSH вече работи без парола"
    else
        echo -e "  ${RED}✗${NC} SSH ключът не работи. Спирам тук."
        exit 1
    fi
else
    echo -e "${CYAN}[3/6] Skip — ключът вече е там${NC}"
fi
echo ""

# ═══ STEP 4: НАМЕРИ И КАЧИ BOOTSTRAP-SERVER.SH ═══
echo -e "${CYAN}[4/6] Качване на 02-bootstrap-server.sh${NC}"

# Намери скрипта
BOOTSTRAP_SH=""
# Преди 01-bootstrap.sh беше в root-а, сега е в deploy-scripts/.
# Затова 02-bootstrap-server.sh се намира в server/ subpath-а на същата папка.
for path in \
    "${SCRIPT_DIR}/server/02-bootstrap-server.sh" \
    "$(dirname "$0")/server/02-bootstrap-server.sh" \
    "./deploy-scripts/server/02-bootstrap-server.sh" \
    "../server/02-bootstrap-server.sh" \
    "./server/02-bootstrap-server.sh"
do
    if [ -f "$path" ]; then
        BOOTSTRAP_SH="$path"
        break
    fi
done

if [ -z "$BOOTSTRAP_SH" ]; then
    echo -e "  ${RED}✗${NC} Не намерих 02-bootstrap-server.sh"
    echo "    Очаквам го в: deploy-scripts/server/02-bootstrap-server.sh"
    exit 1
fi

echo "  Скрипт: $BOOTSTRAP_SH"

# Нормализирай line endings (CRLF → LF) преди upload
if command -v dos2unix >/dev/null 2>&1; then
    dos2unix -q "$BOOTSTRAP_SH" 2>/dev/null || true
fi

# Качи скрипта
scp -P "$PORT" -q "$BOOTSTRAP_SH" "${USER}@${SERVER}:/tmp/02-bootstrap-server.sh"
echo -e "  ${GREEN}✓${NC} Качен в /tmp/02-bootstrap-server.sh"

# Качи и pubkey-я като отделен файл (02-bootstrap-server.sh го чете автоматично)
scp -P "$PORT" -q "$PUB_PATH" "${USER}@${SERVER}:/tmp/deploy_pubkey"
echo -e "  ${GREEN}✓${NC} Public key качен в /tmp/deploy_pubkey"

# Качи и желания SSH порт (02-bootstrap-server.sh ще го прочете и приложи)
echo "$NEW_SSH_PORT" | ssh -p "$PORT" "${USER}@${SERVER}" "cat > /tmp/desired_ssh_port" 2>/dev/null
echo -e "  ${GREEN}✓${NC} Желан SSH порт (${NEW_SSH_PORT}) подаден на сървъра"

# Нормализирай и на сървъра (за всеки случай)
ssh -p "$PORT" "${USER}@${SERVER}" "
    command -v dos2unix >/dev/null 2>&1 && dos2unix -q /tmp/02-bootstrap-server.sh 2>/dev/null || sed -i 's/\\r\$//' /tmp/02-bootstrap-server.sh
    chmod +x /tmp/02-bootstrap-server.sh
" 2>/dev/null || true
echo ""

# ═══ STEP 5: RUN BOOTSTRAP-SERVER.SH НА СЪРВЪРА ═══
echo -e "${CYAN}[5/6] Изпълнение на 02-bootstrap-server.sh${NC}"
echo "  Ще те пита паролата на ${USER} за sudo (ако не сте sudo NOPASSWD)..."
echo ""

# -t = интерактивен TTY (за да виждаш цветовете и да можеш да отговаряш на промптовете)
ssh -t -p "$PORT" "${USER}@${SERVER}" "sudo bash /tmp/02-bootstrap-server.sh" || {
    echo ""
    echo -e "${RED}✗ Bootstrap се провали${NC}"
    echo ""
    echo "  Възможни причини:"
    echo "    • ${USER} не е sudoer на сървъра"
    echo "    • Подадена грешна парола"
    echo "    • Бъг в самия 02-bootstrap-server.sh"
    echo ""
    echo "  За дебъгване — SSH-ни ръчно и виж:"
    echo "    ssh -p $PORT ${USER}@${SERVER}"
    echo "    sudo bash /tmp/02-bootstrap-server.sh"
    exit 1
}
echo ""

# ═══ ТЕСТ ═══
echo -e "${CYAN}Финален тест: SSH като deploy на порт ${NEW_SSH_PORT}${NC}"

# Може да отнеме малко време за sshd да рестартира на новия порт
sleep 2

if ssh -o BatchMode=yes -o ConnectTimeout=5 -p "$NEW_SSH_PORT" "deploy@${SERVER}" 'echo OK' 2>/dev/null | grep -q OK; then
    echo -e "  ${GREEN}✓${NC} 'deploy' user работи с SSH ключ на порт ${NEW_SSH_PORT}"

    # Update .deploy-targets автоматично
    # След като сме cd-нати в PROJECT_ROOT, .deploy-targets е тук
    TARGETS_FILE="${PROJECT_ROOT}/.deploy-targets"

    echo ""
    read -p "  Да обновя .deploy-targets с този сървър като 'vm'? [Y/n]: " UPDATE_TARGETS
    UPDATE_TARGETS="${UPDATE_TARGETS:-y}"
    if [ "$UPDATE_TARGETS" = "y" ] || [ "$UPDATE_TARGETS" = "Y" ]; then
        cat > "$TARGETS_FILE" << EOF
# Auto-generated by 01-bootstrap.sh on $(date)
TARGET_prod_SERVER="alsec.strangled.net"
TARGET_prod_USER="deploy"
TARGET_prod_PORT="2222"
TARGET_prod_LABEL="Production (VPS)"

TARGET_vm_SERVER="${SERVER}"
TARGET_vm_USER="deploy"
TARGET_vm_PORT="${NEW_SSH_PORT}"
TARGET_vm_LABEL="Local VM (${SERVER})"
EOF
        echo -e "  ${GREEN}✓${NC} .deploy-targets обновен (порт: ${NEW_SSH_PORT})"
    fi
else
    echo -e "  ${YELLOW}!${NC} 'deploy' SSH тестът на порт ${NEW_SSH_PORT} не мина."
    echo "    Може sshd да не е рестартирал още. Опитай ръчно след 30 сек:"
    echo "    ${CYAN}ssh -p ${NEW_SSH_PORT} deploy@${SERVER}${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ BOOTSTRAP COMPLETE                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}СЛЕДВАЩА СТЪПКА:${NC}"
echo ""
echo "  SSH на сървъра вече е на порт ${GREEN}${NEW_SSH_PORT}${NC}"
echo ""
echo "  Първи deploy от Windows:"
echo "    ${CYAN}./deploy-scripts/04-deploy.sh vm${NC}"
echo ""
echo "  Това ще качи проекта и автоматично ще извика 05-server-install.sh."
echo ""
