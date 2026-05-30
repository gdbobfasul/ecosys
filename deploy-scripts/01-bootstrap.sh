#!/bin/bash
# Version: 1.0093
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

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

# SSH keepalive — пази връзката жива при дълги операции (apt install и т.н.)
SSH_KEEPALIVE="-o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o TCPKeepAlive=yes"

# ═══ FREEZE флаг — да не пипаме .deploy-targets ═══
# Set to 1 ако потребителят казва "използвай .deploy-targets както е".
# Тогава auto-detection и auto-update на файла се пропускат.
DEPLOY_FREEZE_TARGETS=0

# ═══ ARGS ═══
# Логика:
#   1) Ако са подадени аргументи на CLI — ползваме ги директно
#   2) Иначе ако има .deploy-targets — питаме "да го пипам ли?"
#       a) НЕ → питаме само "кой target?" и взимаме стойностите от файла без промени
#       b) ДА → питаме vm/prod/custom (стария поток) — auto-detection ще може да обнови файла
#   3) Иначе → vm/prod/custom default
TARGETS_FILE="${PROJECT_ROOT}/.deploy-targets"

load_target_from_file() {
    # Зарежда стойностите от .deploy-targets за зададено име
    local name="$1"
    [ -f "$TARGETS_FILE" ] || return 1
    # Source-вай файла в subshell за да хванем стойностите
    . "$TARGETS_FILE"
    local s_var="TARGET_${name}_SERVER"
    local u_var="TARGET_${name}_USER"
    local p_var="TARGET_${name}_PORT"
    SERVER="${!s_var}"
    USER="${!u_var}"
    PORT="${!p_var}"
    [ -n "$SERVER" ] && [ -n "$USER" ] && [ -n "$PORT" ]
}

list_targets_in_file() {
    [ -f "$TARGETS_FILE" ] || return
    grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" "$TARGETS_FILE" | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u
}

if [ -n "$1" ]; then
    # CLI args mode
    SERVER="$1"
    USER="${2:-kcyecosys}"
    PORT="${3:-22}"

elif [ -t 0 ] && [ -f "$TARGETS_FILE" ]; then
    # .deploy-targets съществува — питай дали да го пипаме
    AVAILABLE=$(list_targets_in_file)
    echo ""
    echo "Намерих .deploy-targets с следните targets:"
    for t in $AVAILABLE; do
        . "$TARGETS_FILE"
        s_var="TARGET_${t}_SERVER"; u_var="TARGET_${t}_USER"; p_var="TARGET_${t}_PORT"
        echo "  • ${GREEN}${t}${NC} → ${!u_var}@${!s_var}:${!p_var}"
    done
    echo ""
    read -p "Ще променяме ли .deploy-targets? [y/N]: " CHANGE_TARGETS
    CHANGE_TARGETS="${CHANGE_TARGETS:-n}"

    if [ "$CHANGE_TARGETS" != "y" ] && [ "$CHANGE_TARGETS" != "Y" ]; then
        # ─── ПОЛЗВАЙ КАКТО Е ───
        DEPLOY_FREEZE_TARGETS=1
        echo ""
        echo "  ${GREEN}✓${NC} Ползвам .deploy-targets без промени (auto-detection изключен)"
        echo ""
        echo "Кой target?"
        IDX=1
        TARGETS_ARR=()
        for t in $AVAILABLE; do
            echo "  $IDX) $t"
            TARGETS_ARR+=("$t")
            IDX=$((IDX+1))
        done
        echo ""
        read -p "Избери [1-${#TARGETS_ARR[@]}]: " PICK
        if [[ "$PICK" =~ ^[0-9]+$ ]] && [ "$PICK" -ge 1 ] && [ "$PICK" -le ${#TARGETS_ARR[@]} ]; then
            CHOSEN="${TARGETS_ARR[$((PICK-1))]}"
            if ! load_target_from_file "$CHOSEN"; then
                echo -e "  ${RED}✗${NC} Грешка при зареждане на target '$CHOSEN'"
                exit 1
            fi
        else
            echo "Невалиден избор."
            exit 1
        fi
    else
        # ─── РЕЖИМ "ще променяме" — стария интерактивен flow ───
        echo ""
        echo "Каква машина да bootstrap-неш?"
        echo "  1) vm     — локална VM (192.168.0.108)"
        echo "  2) prod   — production VPS (alsec.strangled.net)"
        echo "  3) custom — ще те питам server/user/port"
        echo ""
        read -p "Избери [1-3, default=1]: " TARGET_PICK
        TARGET_PICK="${TARGET_PICK:-1}"
        case "$TARGET_PICK" in
            1) SERVER="192.168.0.108"; USER="kcyecosys"; PORT="22" ;;
            2) SERVER="alsec.strangled.net"; USER="root"; PORT="2222" ;;
            3) read -p "  Server: " SERVER; read -p "  User: " USER; read -p "  Port: " PORT ;;
            *) SERVER="192.168.0.108"; USER="kcyecosys"; PORT="22" ;;
        esac
    fi

elif [ -t 0 ]; then
    # Няма .deploy-targets — стандартен interactive prompt
    echo ""
    echo "Каква машина да bootstrap-неш?"
    echo "  1) vm     — локална VM (192.168.0.108)"
    echo "  2) prod   — production VPS (alsec.strangled.net)"
    echo "  3) custom — ще те питам server/user/port"
    echo ""
    read -p "Избери [1-3, default=1]: " TARGET_PICK
    TARGET_PICK="${TARGET_PICK:-1}"
    case "$TARGET_PICK" in
        1) SERVER="192.168.0.108"; USER="kcyecosys"; PORT="22" ;;
        2) SERVER="alsec.strangled.net"; USER="root"; PORT="2222" ;;
        3) read -p "  Server: " SERVER; read -p "  User: " USER; read -p "  Port: " PORT ;;
        *) SERVER="192.168.0.108"; USER="kcyecosys"; PORT="22" ;;
    esac
else
    # Non-interactive без args — defaults
    SERVER="192.168.0.108"; USER="kcyecosys"; PORT="22"
fi

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
echo -e "${CYAN}[0/7] SSH порт${NC}"

if [ "$DEPLOY_FREEZE_TARGETS" = "1" ]; then
    # Freeze режим — доверяваме се на стойностите от .deploy-targets
    echo -e "  ${YELLOW}↷${NC} Auto-detection пропуснат (freeze targets). Ползвам порт ${GREEN}${PORT}${NC}"
else
    echo "  Тествам кой TCP порт е отворен..."

    DETECTED_PORT=""
    # Опитай зададения порт + стандартните fallback-и
    for try_port in "$PORT" 22 2222; do
        [ -z "$try_port" ] && continue
        # Прост TCP test — отваря ли се сокет на този порт?
        # /dev/tcp е bash builtin, не нужни външни инструменти.
        if timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${try_port}" 2>/dev/null; then
            DETECTED_PORT="$try_port"
            echo "  ${GREEN}✓${NC} Порт ${try_port} отговаря (TCP)"
            break
        else
            echo "  ${YELLOW}-${NC} Порт ${try_port} не отговаря"
        fi
    done

    if [ -z "$DETECTED_PORT" ]; then
        echo ""
        echo -e "  ${RED}✗${NC} Не мога да достигна ${SERVER} на нито един от: ${PORT}, 22, 2222"
        echo ""
        echo "  Възможни причини:"
        echo "    • Сървърът е изключен          → ping ${SERVER}"
        echo "    • Грешен hostname/IP            → провери .deploy-targets"
        echo "    • Local firewall блокира        → провери Windows firewall"
        echo "    • Fail2ban те е банвал          → провери от друга мрежа"
        echo "    • SSH е на различен порт        → ръчно: ssh -p XXXX user@server"
        echo ""
        echo "  Тест ръчно: ${CYAN}ssh -p ${PORT} ${USER}@${SERVER}${NC}"
        exit 1
    fi

    PORT="$DETECTED_PORT"
    echo -e "  ${GREEN}✓${NC} Текущ SSH порт на сървъра: ${GREEN}${PORT}${NC}"
fi
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
# ВАЖНО: -i forces specific identity file, IdentitiesOnly=yes игнорира всички
# други ключове в ssh-agent (за да не trial-error-ваме и да не активираме fail2ban).
KEY_ALREADY_THERE=0
if ssh -o BatchMode=yes \
       -o ConnectTimeout=3 \
       -o ServerAliveInterval=30 \
       -o StrictHostKeyChecking=no \
       -o IdentitiesOnly=yes \
       -o PreferredAuthentications=publickey \
       -i "$KEY_PATH" \
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
        ssh-copy-id -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" -p "$PORT" -i "$PUB_PATH" "${USER}@${SERVER}"
    else
        # fallback ако ssh-copy-id липсва
        cat "$PUB_PATH" | ssh $SSH_KEEPALIVE -p "$PORT" "${USER}@${SERVER}" \
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
    fi

    # Provери че работи
    if ssh -o BatchMode=yes -o ConnectTimeout=5 -o ServerAliveInterval=30 -p "$PORT" "${USER}@${SERVER}" 'echo OK' 2>/dev/null | grep -q OK; then
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

# Качваме в ЛИЧНАТА папка на потребителя (~/.kcy-bootstrap), а НЕ в споделения /tmp.
# /tmp/02-bootstrap-server.sh може вече да съществува, собственост на друг user
# (root/предишен deploy) → "Permission denied" при презапис. Домашната папка винаги е наша.
REMOTE_DIR=".kcy-bootstrap"
ssh $SSH_KEEPALIVE -p "$PORT" "${USER}@${SERVER}" "rm -rf ~/${REMOTE_DIR}; mkdir -p ~/${REMOTE_DIR}" 2>/dev/null

# Качи скрипта
scp $SSH_KEEPALIVE -P "$PORT" -q "$BOOTSTRAP_SH" "${USER}@${SERVER}:${REMOTE_DIR}/02-bootstrap-server.sh"
echo -e "  ${GREEN}✓${NC} Качен в ~/${REMOTE_DIR}/02-bootstrap-server.sh"

# Качи и pubkey-я като отделен файл (02-bootstrap-server.sh го чете автоматично)
scp $SSH_KEEPALIVE -P "$PORT" -q "$PUB_PATH" "${USER}@${SERVER}:${REMOTE_DIR}/deploy_pubkey"
echo -e "  ${GREEN}✓${NC} Public key качен в ~/${REMOTE_DIR}/deploy_pubkey"

# Качи и желания SSH порт (02-bootstrap-server.sh ще го прочете и приложи)
echo "$NEW_SSH_PORT" | ssh $SSH_KEEPALIVE -p "$PORT" "${USER}@${SERVER}" "cat > ~/${REMOTE_DIR}/desired_ssh_port" 2>/dev/null
echo -e "  ${GREEN}✓${NC} Желан SSH порт (${NEW_SSH_PORT}) подаден на сървъра"

# Подай target info — за да знае 02-bootstrap-server.sh дали е VM или prod
# (важно за: certbot prompt, SSL логика, и т.н.)
# Откриваме target името от SERVER
DETECTED_TARGET="custom"
if [ "$SERVER" = "192.168.0.108" ] || [[ "$SERVER" =~ ^192\.168\.|^10\.|^172\.16\.|^172\.17\.|^172\.18\.|^172\.19\.|^172\.2[0-9]\.|^172\.3[0-1]\. ]]; then
    DETECTED_TARGET="vm"
elif [ "$SERVER" = "alsec.strangled.net" ]; then
    DETECTED_TARGET="prod"
fi
ssh $SSH_KEEPALIVE -p "$PORT" "${USER}@${SERVER}" "cat > ~/${REMOTE_DIR}/deploy_target_info << TARGETINFO
TARGET_NAME=${DETECTED_TARGET}
TARGET_SERVER=${SERVER}
TARGETINFO
" 2>/dev/null
echo -e "  ${GREEN}✓${NC} Target info (${DETECTED_TARGET}) подаден"

# Нормализирай и на сървъра (за всеки случай)
ssh $SSH_KEEPALIVE -p "$PORT" "${USER}@${SERVER}" "
    command -v dos2unix >/dev/null 2>&1 && dos2unix -q ~/${REMOTE_DIR}/02-bootstrap-server.sh 2>/dev/null || sed -i 's/\\r\$//' ~/${REMOTE_DIR}/02-bootstrap-server.sh
    chmod +x ~/${REMOTE_DIR}/02-bootstrap-server.sh
" 2>/dev/null || true
echo ""

# ═══ STEP 5: RUN BOOTSTRAP-SERVER.SH НА СЪРВЪРА ═══
echo -e "${CYAN}[6/7] Изпълнение на 02-bootstrap-server.sh${NC}"
echo "  Ще те пита паролата на ${USER} за sudo (ако не сте sudo NOPASSWD)..."
echo ""

# -t = интерактивен TTY (за да виждаш цветовете и да можеш да отговаряш на промптовете)
# sudo с абсолютен път към ~/.kcy-bootstrap (sudo нулира $HOME, затова подаваме пътя явно)
ssh $SSH_KEEPALIVE -t -p "$PORT" "${USER}@${SERVER}" "sudo bash \"\$HOME/${REMOTE_DIR}/02-bootstrap-server.sh\"" || {
    echo ""
    echo -e "${RED}✗ Bootstrap се провали${NC}"
    echo ""
    echo -e "${YELLOW}  Ако видя 'user ${USER} is not allowed to execute ... 02-bootstrap-server.sh':${NC}"
    echo -e "${YELLOW}  Сървърът ВЕЧЕ Е bootstrap-нат и ${USER} е с ОГРАНИЧЕН sudo (само white-list).${NC}"
    echo -e "${YELLOW}  Това е НОРМАЛНО — bootstrap (опция 1) е само за НОВ сървър.${NC}"
    echo ""
    echo -e "  За вече работещ сървър ${GREEN}НЕ ти трябва bootstrap${NC}. Вместо това:"
    echo -e "    ${CYAN}• Обновяване на код:${NC}  опция 2 (Deploy) или опция 3 (само сорс)"
    echo -e "    ${CYAN}• Обновяване на асети:${NC} опция 4 (само видеа/картинки)"
    echo -e "    ${CYAN}• Нови sudo права:${NC}    опция 28 (Update sudoers) — пуска се без парола,"
    echo -e "      защото 03-kcy-admin-sudo.sh е whitelist-нат за ${USER}:"
    echo -e "        ${GREEN}ssh -p $PORT ${USER}@${SERVER}${NC}"
    echo -e "        ${GREEN}sudo /var/www/deploy/deploy-scripts/server/03-kcy-admin-sudo.sh${NC}"
    echo ""
    echo -e "  ${YELLOW}Истински нов сървър?${NC} Тогава ${USER} трябва да е пълен sudoer (в групата sudo),"
    echo -e "  а не ограничен. Провери на сървъра: ${GREEN}groups ${USER}${NC}"
    echo ""
    echo "  За ръчно дебъгване:"
    echo "    ssh -p $PORT ${USER}@${SERVER}"
    echo "    sudo bash ~/${REMOTE_DIR}/02-bootstrap-server.sh"
    exit 1
}
echo ""

# ═══ ТЕСТ ═══
echo -e "${CYAN}Финален тест: SSH като deploy на порт ${NEW_SSH_PORT}${NC}"

# Може да отнеме малко време за sshd да рестартира на новия порт
sleep 2

if ssh -o BatchMode=yes -o ConnectTimeout=5 -o ServerAliveInterval=30 -p "$NEW_SSH_PORT" "deploy@${SERVER}" 'echo OK' 2>/dev/null | grep -q OK; then
    echo -e "  ${GREEN}✓${NC} 'deploy' user работи с SSH ключ на порт ${NEW_SSH_PORT}"

    # Update .deploy-targets автоматично
    # След като сме cd-нати в PROJECT_ROOT, .deploy-targets е тук
    TARGETS_FILE="${PROJECT_ROOT}/.deploy-targets"

    if [ "$DEPLOY_FREEZE_TARGETS" = "1" ]; then
        echo ""
        echo -e "  ${YELLOW}↷${NC} .deploy-targets НЕ се обновява (freeze targets режим)"
    else
        echo ""
        read -p "  Да обновя .deploy-targets с този сървър като '${DETECTED_TARGET}'? [Y/n]: " UPDATE_TARGETS
        UPDATE_TARGETS="${UPDATE_TARGETS:-y}"
        if [ "$UPDATE_TARGETS" = "y" ] || [ "$UPDATE_TARGETS" = "Y" ]; then
            # Ако файлът не съществува — създай го с default-и
            if [ ! -f "$TARGETS_FILE" ]; then
                cat > "$TARGETS_FILE" << EOF
# Auto-generated by 01-bootstrap.sh on $(date)
TARGET_prod_SERVER="alsec.strangled.net"
TARGET_prod_USER="deploy"
TARGET_prod_PORT="2222"
TARGET_prod_LABEL="Production (VPS)"

TARGET_vm_SERVER="192.168.0.108"
TARGET_vm_USER="deploy"
TARGET_vm_PORT="2222"
TARGET_vm_LABEL="Local VM"
EOF
            fi

            # Update само секцията за конкретния target (не overwrite всичко)
            # Sed замени само редовете за DETECTED_TARGET
            sed -i \
                -e "s|^TARGET_${DETECTED_TARGET}_SERVER=.*|TARGET_${DETECTED_TARGET}_SERVER=\"${SERVER}\"|" \
                -e "s|^TARGET_${DETECTED_TARGET}_USER=.*|TARGET_${DETECTED_TARGET}_USER=\"deploy\"|" \
                -e "s|^TARGET_${DETECTED_TARGET}_PORT=.*|TARGET_${DETECTED_TARGET}_PORT=\"${NEW_SSH_PORT}\"|" \
                "$TARGETS_FILE"

            # Ако target-ът не съществува във файла — append
            if ! grep -q "^TARGET_${DETECTED_TARGET}_SERVER=" "$TARGETS_FILE"; then
                cat >> "$TARGETS_FILE" << EOF

TARGET_${DETECTED_TARGET}_SERVER="${SERVER}"
TARGET_${DETECTED_TARGET}_USER="deploy"
TARGET_${DETECTED_TARGET}_PORT="${NEW_SSH_PORT}"
TARGET_${DETECTED_TARGET}_LABEL="Auto-detected ${DETECTED_TARGET}"
EOF
            fi

            echo -e "  ${GREEN}✓${NC} .deploy-targets обновен (${DETECTED_TARGET}: ${SERVER}:${NEW_SSH_PORT})"
        fi
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
