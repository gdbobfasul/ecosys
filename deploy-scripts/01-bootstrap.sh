#!/bin/bash
# Version: 1.0089
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

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

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
echo "  Port:    ${GREEN}${PORT}${NC} (зададен)"
echo ""

# ═══ STEP 0: ОТКРИЙ ТЕКУЩИЯ SSH ПОРТ НА СЪРВЪРА ═══
echo -e "${CYAN}[0/7] Откриване на текущия SSH порт${NC}"
echo "  Тествам кой порт работи (без авторизация)..."

DETECTED_PORT=""
for try_port in "$PORT" 22 2222; do
    [ -z "$try_port" ] && continue
    # Опит без autz — само провери дали SSH banner отговаря (Permission denied = порт работи)
    if ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no \
           -o PreferredAuthentications=none \
           -o NumberOfPasswordPrompts=0 \
           -p "$try_port" "${USER}@${SERVER}" 'echo' 2>&1 | \
           grep -qE "Permission denied|authentication method"; then
        DETECTED_PORT="$try_port"
        break
    fi
    # Или ако ключ работи и връща нещо
    if ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no \
           -p "$try_port" "${USER}@${SERVER}" 'echo OK' 2>/dev/null | grep -q OK; then
        DETECTED_PORT="$try_port"
        break
    fi
done

if [ -z "$DETECTED_PORT" ]; then
    echo -e "  ${RED}✗${NC} Не мога да достигна ${SERVER} на нито един от: ${PORT}, 22, 2222"
    echo "    Проверки:"
    echo "      • Сървърът включен ли е?           ping ${SERVER}"
    echo "      • Правилен ли е USER (${USER})?"
    exit 1
fi

PORT="$DETECTED_PORT"
echo -e "  ${GREEN}✓${NC} Текущ SSH порт на сървъра: ${GREEN}${PORT}${NC}"
echo ""

# ═══ STEP 1: ИЗБОР НА НОВ SSH ПОРТ ═══
echo -e "${CYAN}[1/7] SSH порт след bootstrap${NC}"

NEW_SSH_PORT=""
if [ "$PORT" = "2222" ]; then
    echo -e "  ${GREEN}✓${NC} SSH вече е на 2222 — оставям както е."
    NEW_SSH_PORT="$PORT"
else
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
echo -e "${CYAN}[2/7] SSH ключ${NC}"

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

# ═══ STEP 3: ТЕСТ ДАЛИ SSH КЛЮЧ ВЕЧЕ РАБОТИ ═══
echo -e "${CYAN}[3/7] Тест SSH ключ${NC}"

# Порта вече е открит в [0/7]. Тук само проверявам дали ключът работи без парола.
KEY_ALREADY_THERE=0
if ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no \
       -p "$PORT" "${USER}@${SERVER}" 'echo OK' 2>/dev/null | grep -q OK; then
    KEY_ALREADY_THERE=1
    echo -e "  ${GREEN}✓${NC} SSH ключ вече работи на порт ${PORT} — пропускам ssh-copy-id"
else
    echo -e "  ${YELLOW}!${NC} SSH ключ още не работи на порт ${PORT} — ще го копирам с парола"
fi
echo ""

# ═══ STEP 3: COPY KEY (ако нужно) ═══
if [ "$KEY_ALREADY_THERE" -eq 0 ]; then
    echo -e "${CYAN}[4/7] Копиране на ключа на сървъра${NC}"
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
    echo -e "${CYAN}[4/7] Skip — ключът вече е там${NC}"
fi
echo ""

# ═══ STEP 4: НАМЕРИ И КАЧИ BOOTSTRAP-SERVER.SH ═══
echo -e "${CYAN}[5/7] Качване на 02-bootstrap-server.sh${NC}"

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
echo -e "${CYAN}[6/7] Изпълнение на 02-bootstrap-server.sh${NC}"
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
echo "  SSH на сървъра вече е на порт ${GREEN}${NEW_SSH_PORT}${NC}"
echo ""

# ═══ AUTO-DEPLOY (опционално) ═══
# Bootstrap-ът подготви сървъра, но проектът още не е качен.
# Логично е сега да деплойнем.
DEPLOY_SCRIPT="${PROJECT_ROOT}/deploy-scripts/04-deploy.sh"
if [ -f "$DEPLOY_SCRIPT" ]; then
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Bootstrap-ът само подготви сървъра — проектът още${NC}"
    echo -e "${CYAN}  не е качен. Да направя ли deploy сега?${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo ""

    # Намери target по име от SERVER (за да викаме ./04-deploy.sh vm/prod)
    DEPLOY_TARGET="vm"
    if [ "$SERVER" = "alsec.strangled.net" ]; then
        DEPLOY_TARGET="prod"
    fi

    read -p "  Изпълни './deploy-scripts/04-deploy.sh ${DEPLOY_TARGET}' сега? [Y/n]: " DO_DEPLOY
    DO_DEPLOY="${DO_DEPLOY:-y}"

    if [ "$DO_DEPLOY" = "y" ] || [ "$DO_DEPLOY" = "Y" ]; then
        echo ""
        echo -e "${YELLOW}► Стартирам deploy...${NC}"
        echo ""
        bash "$DEPLOY_SCRIPT" "$DEPLOY_TARGET"
        DEPLOY_RC=$?
        echo ""
        if [ $DEPLOY_RC -eq 0 ]; then
            echo -e "${GREEN}✓ Deploy успешен — сървърът е готов!${NC}"
        else
            echo -e "${YELLOW}⚠ Deploy завърши с код ${DEPLOY_RC}.${NC}"
            echo "  Можеш да опиташ ръчно: ./deploy-scripts/04-deploy.sh ${DEPLOY_TARGET}"
        fi
    else
        echo ""
        echo -e "${CYAN}СЛЕДВАЩА СТЪПКА:${NC}"
        echo "  ${CYAN}./deploy-scripts/04-deploy.sh ${DEPLOY_TARGET}${NC}"
        echo ""
        echo "  Това ще качи проекта и автоматично ще извика 05-server-install.sh."
    fi
fi
echo ""
