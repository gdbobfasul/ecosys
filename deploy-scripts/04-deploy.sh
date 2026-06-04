#!/bin/bash
# Version: 1.0172
##############################################################################
# KCY Ecosystem - Deploy Script (Client-side)
#
# Архивира проекта → качва 1 файл → разархивира на сървъра.
# Логва всичко в deploy.log.
#
# Usage: ./deploy-scripts/04-deploy.sh [server] [user] [port]
#
# Файлът живее в deploy-scripts/04-deploy.sh — автоматично cd-ва към root-а
# на проекта, така че работи както от root, така и от deploy-scripts/.
##############################################################################

# НЕ ползваме set -e — искаме прозорецът да остане отворен при грешка
# Всяка команда проверяваме ръчно

# Прозорецът ВИНАГИ остава отворен
trap 'echo ""; echo "Натисни Enter за затваряне..."; read DUMMY' EXIT

# Cd към root-а на проекта (parent на deploy-scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ═══ DEPLOY TARGETS ═══
# Дефинирай таргетите тук. Може и от .deploy-targets файл (override).
# Формат: TARGET_<name>_(SERVER|USER|PORT)
TARGET_prod_SERVER="alsec.strangled.net"
TARGET_prod_USER="deploy"
TARGET_prod_PORT="2222"
TARGET_prod_LABEL="Production (VPS)"

TARGET_vm_SERVER="192.168.0.108"      # IP на твоята VM
TARGET_vm_USER="deploy"
TARGET_vm_PORT="22"
TARGET_vm_LABEL="Local VM"

# Зареди custom targets ако има .deploy-targets файл (overrides defaults)
if [ -f ".deploy-targets" ]; then
    source ".deploy-targets"
fi

# Първи аргумент може да бъде име на target от .deploy-targets.
# Преди беше hardcoded prod|vm. Сега приема всяко име което съществува във файла.
TARGET_NAME=""
if [ -n "$1" ]; then
    if [ -f .deploy-targets ] && grep -q "^TARGET_${1}_SERVER=" .deploy-targets; then
        TARGET_NAME="$1"
    elif [ "$1" = "prod" ] || [ "$1" = "vm" ]; then
        # Backward compat — приемаме prod/vm дори без .deploy-targets
        TARGET_NAME="$1"
    fi
fi

# ═══ FREEZE флаг — пропуска auto-detection и не пипа .deploy-targets ═══
DEPLOY_FREEZE_TARGETS=0

# Helper — извлича всички target имена от .deploy-targets
list_targets() {
    [ -f .deploy-targets ] || return
    grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u
}

# Ако няма таргет нито от аргумент, нито от env — попитай (interactive)
if [ -z "$TARGET_NAME" ] && [ -z "$1" ] && [ -t 0 ] && [ "${DEPLOY_NO_PAUSE:-0}" != "1" ]; then
    TARGETS_FILE_DEPLOY=".deploy-targets"

    if [ -f "$TARGETS_FILE_DEPLOY" ]; then
        AVAILABLE=$(list_targets)
        echo ""
        echo "  Намерих .deploy-targets:"
        for t in $AVAILABLE; do
            s_var="TARGET_${t}_SERVER"; u_var="TARGET_${t}_USER"; p_var="TARGET_${t}_PORT"
            echo "    • $t → ${!u_var}@${!s_var}:${!p_var}"
        done
        echo ""
        read -p "  Ще променяме ли .deploy-targets? [y/N]: " CHANGE_TARGETS
        CHANGE_TARGETS="${CHANGE_TARGETS:-n}"
        if [ "$CHANGE_TARGETS" != "y" ] && [ "$CHANGE_TARGETS" != "Y" ]; then
            DEPLOY_FREEZE_TARGETS=1
            echo "  ${GREEN}✓${NC} Ползвам .deploy-targets без промени (auto-detection изключен)"
        fi
    fi

    # Изброй динамично всички targets от файла
    echo ""
    echo "  Избери deploy target:"
    IDX=1
    declare -a TARGET_ARR=()
    for t in $(list_targets); do
        s_var="TARGET_${t}_SERVER"; p_var="TARGET_${t}_PORT"; l_var="TARGET_${t}_LABEL"
        echo "    $IDX) $t — ${!l_var:-$t} (${!s_var}:${!p_var})"
        TARGET_ARR[$IDX]="$t"
        IDX=$((IDX+1))
    done
    echo "    $IDX) custom — ръчно server/user/port"
    CUSTOM_IDX=$IDX
    echo ""
    read -p "  [1-${IDX}, default=1]: " CHOICE
    CHOICE="${CHOICE:-1}"
    if [ "$CHOICE" = "$CUSTOM_IDX" ]; then
        TARGET_NAME=""  # custom — ще пита по-долу
    elif [ -n "${TARGET_ARR[$CHOICE]}" ]; then
        TARGET_NAME="${TARGET_ARR[$CHOICE]}"
    else
        # Невалиден избор — fallback на първия target
        TARGET_NAME="${TARGET_ARR[1]:-prod}"
    fi
fi

# Зареди стойностите от избрания target
if [ -n "$TARGET_NAME" ]; then
    server_var="TARGET_${TARGET_NAME}_SERVER"
    user_var="TARGET_${TARGET_NAME}_USER"
    port_var="TARGET_${TARGET_NAME}_PORT"
    label_var="TARGET_${TARGET_NAME}_LABEL"
    SERVER="${!server_var}"
    USER="${!user_var}"
    PORT="${!port_var}"
    TARGET_LABEL="${!label_var}"
else
    SERVER="${1:-alsec.strangled.net}"
    USER="${2:-deploy}"
    PORT="${3:-2222}"
    TARGET_LABEL="custom"
fi

STAGING="/var/www/deploy"
LOG_FILE="${HOME}/kcy-deploy.log"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

# ═══ LOGGING ═══
# Записва всичко във файл. На екрана се показва нормално.
: > "$LOG_FILE"  # изчисти стар лог
log() {
    echo -e "$@"
    # Запиши без ANSI цветове във файла
    echo -e "$@" | sed 's/\x1b\[[0-9;]*m//g' >> "$LOG_FILE"
}

log ""
log "═══════════════════════════════════════════════════════"
log "  Deploy started: $(date '+%Y-%m-%d %H:%M:%S')"
log "═══════════════════════════════════════════════════════"

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat << 'EOF'
KCY Ecosystem - Deploy v1.0093

Usage:
  ./deploy-scripts/04-deploy.sh                              # пита кой target (prod/vm)
  ./deploy-scripts/04-deploy.sh prod                         # бързо към production VPS
  ./deploy-scripts/04-deploy.sh vm                           # бързо към локалната VM
  ./deploy-scripts/04-deploy.sh <server> <user> <port>       # custom

Targets (промени в началото на 04-deploy.sh, или в .deploy-targets):
  prod = alsec.strangled.net : 2222 (deploy)
  vm   = 192.168.0.150       : 22   (deploy)

Архивира проекта → качва 1 файл → разархивира на сървъра →
автоматично извиква 05-server-install.sh.
Логва в ~/kcy-deploy.log.

По default НЕ показва съдържанието на docs/ENV-EXAMPLE.env.
За да го изпише и да попита дали да го копира на сървъра:
  DEPLOY_SHOW_ENV=1 ./deploy-scripts/04-deploy.sh

За изключване на финалното питане "Пусни 05-server-install.sh?" (CI):
  DEPLOY_NO_PAUSE=1 ./deploy-scripts/04-deploy.sh

Преди първо ползване:
  1. Генерирай SSH ключ (Git Bash):
     ssh-keygen -t ed25519

  2. Копирай ключа на сървъра:
     ssh-copy-id -p 2222 -i ~/.ssh/id_ed25519.pub deploy@alsec.strangled.net

  3. Пусни: ./deploy-scripts/04-deploy.sh
EOF
    exit 0
fi

die() {
    log ""
    log "${RED}╔══════════════════════════════════════════════════╗${NC}"
    log "${RED}║  ГРЕШКА: $1${NC}"
    log "${RED}╚══════════════════════════════════════════════════╝${NC}"
    log ""
    log "${YELLOW}Логът е в: ${LOG_FILE}${NC}"
    log ""
    exit 1
}

# Пауза между стъпки — натисни Enter за следваща, или 'q' за изключване на паузите.
# Може да бъде изключена с DEPLOY_NO_PAUSE=1 (за CI/автоматизирани runs).
# Питане дали да покаже дълъг блок текст. Натискаш 'q' да го пропуснеш,
# всякакъв друг клавиш за да го изпишеш.
# Връща 0 (show) ако трябва да изпише, 1 (skip) ако да пропусне.
ask_show_block() {
    local prompt="${1:-Натисни клавиш да покажеш блока, q за пропускане...}"
    [ "${DEPLOY_NO_PAUSE:-0}" = "1" ] && return 0  # show by default in no-pause mode
    [ ! -t 0 ] && return 0  # няма TTY → show
    echo ""
    echo -en "  ${CYAN}${prompt}${NC} "
    local REPLY
    read -n 1 -r REPLY </dev/tty 2>/dev/null || return 0
    echo ""
    if [ "$REPLY" = "q" ] || [ "$REPLY" = "Q" ]; then
        log "  ${YELLOW}(блокът пропуснат)${NC}"
        return 1
    fi
    return 0
}

log "${CYAN}╔═══════════════════════════════════════════╗${NC}"
log "${CYAN}║     KCY Ecosystem - Deploy v1.0093        ║${NC}"
log "${CYAN}╚═══════════════════════════════════════════╝${NC}"
log ""
log "  Target:  ${GREEN}${TARGET_LABEL}${NC}"
log "  Server:  ${GREEN}${SERVER}${NC}"
log "  User:    ${GREEN}${USER}${NC}"
log "  Port:    ${GREEN}${PORT}${NC}"
log "  Staging: ${GREEN}${STAGING}${NC}"
log "  Log:     ${GREEN}${LOG_FILE}${NC}"
log ""

# ═══ PORT AUTO-DETECT ═══
# Опитва конфигурирания порт. Ако не работи — пробва познати fallback-ове
# (22, 2222) и автоматично update-ва .deploy-targets с правилния.
detect_ssh_port() {
    local server="$1"
    local user="$2"
    local configured_port="$3"

    # Тествай конфигурирания порт първо чрез прост TCP test (bypass-ва SSH auth)
    if timeout 3 bash -c "exec 3<>/dev/tcp/${server}/${configured_port}" 2>/dev/null; then
        echo "$configured_port"
        return 0
    fi

    # Пробвай fallback портове
    local candidates=(22 2222)
    # Добави и портове от .deploy-targets (различни от конфигурирания)
    if [ -f .deploy-targets ]; then
        while IFS= read -r p; do
            candidates+=("$p")
        done < <(grep -E "^TARGET_.*_PORT=" .deploy-targets | sed -E 's/.*"([0-9]+)".*/\1/' | sort -u)
    fi

    # De-duplicate и пропусни конфигурирания (вече пробван)
    local tried="$configured_port"
    for p in "${candidates[@]}"; do
        [[ " $tried " == *" $p "* ]] && continue
        tried="$tried $p"

        if timeout 3 bash -c "exec 3<>/dev/tcp/${server}/${p}" 2>/dev/null; then
            echo "$p"
            return 0
        fi
    done

    return 1
}

# Намери работещ порт
if [ "$DEPLOY_FREEZE_TARGETS" = "1" ]; then
    log "  ${YELLOW}↷${NC} Auto-detect на порт пропуснат (freeze targets). Ползвам ${PORT}"
else
    log "  ${YELLOW}Auto-detect на SSH порт...${NC}"
    DETECTED_PORT=$(detect_ssh_port "$SERVER" "$USER" "$PORT")

    if [ -z "$DETECTED_PORT" ]; then
        log "  ${RED}✗ Нито един порт не работи. Опитах: ${PORT}, 22, 2222${NC}"
        log "  ${YELLOW}Проверки:${NC}"
        log "    • Сървърът включен ли е?           ping ${SERVER}"
        log "    • SSH ключът работи ли?            ssh -p ${PORT} ${USER}@${SERVER}"
        log "    • Правилен ли е USER (${USER})?"
        die "Не мога да открия работещ SSH порт"
    fi

    if [ "$DETECTED_PORT" != "$PORT" ]; then
        log "  ${YELLOW}⚠ Конфигуриран порт ${PORT} НЕ работи. Намерих че порт ${DETECTED_PORT} работи.${NC}"
        PORT="$DETECTED_PORT"

        # Auto-update .deploy-targets ако target името е известно
        if [ -n "$TARGET_NAME" ] && [ -f .deploy-targets ]; then
            BACKUP=".deploy-targets.bak-$(date +%s)"
            cp .deploy-targets "$BACKUP"
            sed -i "s|^TARGET_${TARGET_NAME}_PORT=.*|TARGET_${TARGET_NAME}_PORT=\"${PORT}\"|" .deploy-targets
            log "  ${GREEN}✓${NC} .deploy-targets обновен (TARGET_${TARGET_NAME}_PORT=${PORT}). Backup: ${BACKUP}"
        elif [ -n "$TARGET_NAME" ] && [ ! -f .deploy-targets ]; then
            # Няма .deploy-targets — създай го
            cat > .deploy-targets << EOF
# Auto-generated by 04-deploy.sh port detection on $(date)
TARGET_${TARGET_NAME}_SERVER="${SERVER}"
TARGET_${TARGET_NAME}_USER="${USER}"
TARGET_${TARGET_NAME}_PORT="${PORT}"
TARGET_${TARGET_NAME}_LABEL="Auto-detected"
EOF
            log "  ${GREEN}✓${NC} Създаден .deploy-targets с порт ${PORT}"
        fi
    else
        log "  ${GREEN}✓${NC} Конфигуриран порт ${PORT} работи"
    fi
fi
log ""

# ═══ SSH CONFIG ═══
# SSH keepalive — пази връзката жива при дълги операции (apt install, rsync, и т.н.)
# ConnectTimeout=15 — ако сървърът не отговори за 15 сек, fail-ва вместо да виси безкрайно
SSH_KEEPALIVE="-o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o TCPKeepAlive=yes -o ConnectTimeout=15"

# Windows (Git Bash/MSYS) doesn't support Unix sockets for ControlMaster
if [ -n "$MSYSTEM" ] || [ -n "$WINDIR" ]; then
    SSH_OPTS="$SSH_KEEPALIVE -p ${PORT}"
    SCP_OPTS="$SSH_KEEPALIVE -P ${PORT}"
    log "  ${YELLOW}[debug] Windows detected — SSH без ControlMaster${NC}"
else
    SOCK_DIR=$(mktemp -d 2>/dev/null || echo "/tmp")
    SSH_SOCK="${SOCK_DIR}/kcy-deploy-$$"
    SSH_OPTS="$SSH_KEEPALIVE -o ControlMaster=auto -o ControlPath=${SSH_SOCK} -o ControlPersist=120 -p ${PORT}"
    SCP_OPTS="$SSH_KEEPALIVE -o ControlMaster=auto -o ControlPath=${SSH_SOCK} -o ControlPersist=120 -P ${PORT}"
    log "  ${YELLOW}[debug] Linux/Mac — SSH с ControlMaster${NC}"
    trap "ssh -O exit -o ControlPath=\"${SSH_SOCK}\" \"${USER}@${SERVER}\" 2>/dev/null; rm -f \"${SSH_SOCK}\" 2>/dev/null; rmdir \"${SOCK_DIR}\" 2>/dev/null; echo ''; echo 'Натисни Enter за затваряне...'; read DUMMY" EXIT
fi

# ═══ CHECK TOOLS ═══
log ""
log "${YELLOW}[debug] Checking tools...${NC}"
for tool in ssh scp tar; do
    if command -v $tool &>/dev/null; then
        log "  ${GREEN}✓ $tool${NC} — $(command -v $tool)"
    else
        die "$tool не е намерен! Инсталирай го."
    fi
done

USE_RSYNC=false
if command -v rsync &>/dev/null; then
    USE_RSYNC=true
    log "  ${GREEN}✓ rsync${NC} — $(command -v rsync)"
else
    log "  ${YELLOW}! rsync липсва — ще ползваме scp${NC}"
fi

# ═══ .deployignore ═══
[ ! -f ".deployignore" ] && cat > .deployignore << 'IGN'
node_modules/
.env
.env.*
!.env.example
*.log
coverage/
dist/
build/
.cache/
tmp/
*.swp
.DS_Store
*.pem
*.key
*.zip
*.tar
*.gz
*.rar
04-deploy.sh
private/token/cache/
private/multisig/cache/
private/token/artifacts/
private/multisig/artifacts/
IGN

# ═══ SSH KEY CHECK ═══
log ""
log "${YELLOW}[debug] Проверка на SSH ключ...${NC}"

# Търси ключ на стандартните места
SSH_KEY=""
for key in "$HOME/.ssh/id_ed25519" "$HOME/.ssh/id_rsa" "$HOME/.ssh/id_ecdsa"; do
    if [ -f "$key" ]; then
        SSH_KEY="$key"
        break
    fi
done

if [ -n "$SSH_KEY" ]; then
    log "  ${GREEN}✓ SSH ключ: ${SSH_KEY}${NC}"
    if [ -f "${SSH_KEY}.pub" ]; then
        log "  ${GREEN}✓ Публичен: ${SSH_KEY}.pub${NC}"
    fi
else
    log ""
    log "  ${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    log "  ${RED}║  SSH КЛЮЧ НЕ Е НАМЕРЕН!                                    ║${NC}"
    log "  ${RED}╠══════════════════════════════════════════════════════════════╣${NC}"
    log "  ${RED}║${NC}                                                              ${RED}║${NC}"
    log "  ${RED}║${NC}  Без SSH ключ deploy няма да работи.                         ${RED}║${NC}"
    log "  ${RED}║${NC}                                                              ${RED}║${NC}"
    log "  ${RED}║${NC}  ${CYAN}Стъпка 1: Генерирай ключ${NC}                                   ${RED}║${NC}"
    log "  ${RED}║${NC}  Отвори PowerShell и пусни:                                  ${RED}║${NC}"
    log "  ${RED}║${NC}  ${GREEN}ssh-keygen -t ed25519${NC}                                       ${RED}║${NC}"
    log "  ${RED}║${NC}  Натисни Enter 3 пъти за defaults.                            ${RED}║${NC}"
    log "  ${RED}║${NC}                                                              ${RED}║${NC}"
    log "  ${RED}║${NC}  ${CYAN}Стъпка 2: Копирай ключа на сървъра${NC}                          ${RED}║${NC}"
    log "  ${RED}║${NC}  От PowerShell:                                              ${RED}║${NC}"
    log "  ${RED}║${NC}  ${GREEN}type \$env:USERPROFILE\\.ssh\\id_ed25519.pub | ssh -p ${PORT}${NC}  ${RED}║${NC}"
    log "  ${RED}║${NC}  ${GREEN}${USER}@${SERVER} \"mkdir -p ~/.ssh &&${NC}              ${RED}║${NC}"
    log "  ${RED}║${NC}  ${GREEN}cat >> ~/.ssh/authorized_keys &&${NC}                            ${RED}║${NC}"
    log "  ${RED}║${NC}  ${GREEN}chmod 600 ~/.ssh/authorized_keys\"${NC}                           ${RED}║${NC}"
    log "  ${RED}║${NC}                                                              ${RED}║${NC}"
    log "  ${RED}║${NC}  ${CYAN}Стъпка 3: Пусни 04-deploy.sh отново${NC}                            ${RED}║${NC}"
    log "  ${RED}║${NC}                                                              ${RED}║${NC}"
    log "  ${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    log ""
    die "SSH ключ не е намерен в ~/.ssh/"
fi

# ═══ STEP 0: CONNECT ═══
log ""
log "${GREEN}[0/5] Connecting to ${SERVER}...${NC}"
log "  ${YELLOW}[debug] ssh ${SSH_OPTS} ${USER}@${SERVER}${NC}"

MAX_SSH_ATTEMPTS=4
SSH_OK=1
for ATTEMPT in $(seq 1 ${MAX_SSH_ATTEMPTS}); do
    if [ $ATTEMPT -gt 1 ]; then
        log "  ${YELLOW}Опит ${ATTEMPT}/${MAX_SSH_ATTEMPTS} след 5 секунди...${NC}"
        sleep 5
    fi
    ssh ${SSH_OPTS} "${USER}@${SERVER}" 'echo "  ✓ Connected as $(whoami) on $(hostname)"'
    SSH_OK=$?
    if [ $SSH_OK -eq 0 ]; then break; fi
    if [ $ATTEMPT -eq 1 ]; then
        log "  ${YELLOW}Първият опит неуспешен.${NC}"
    fi
done

if [ $SSH_OK -ne 0 ]; then
    die "Не мога да се свържа с ${USER}@${SERVER}:${PORT} след ${MAX_SSH_ATTEMPTS} опита

  Провери:
    1. SSH ключ копиран ли е на сървъра? От PowerShell:
       type \$env:USERPROFILE\\.ssh\\id_ed25519.pub | ssh -p ${PORT}
       ${USER}@${SERVER} \"mkdir -p ~/.ssh &&
       cat >> ~/.ssh/authorized_keys &&
       chmod 600 ~/.ssh/authorized_keys\"
    2. Мрежа: ping ${SERVER}
    3. Порт: правилен ли е ${PORT}?
    4. Потребител: ${USER} съществува ли на сървъра?"
fi

# ═══ STEP 1: CREATE LOCAL ARCHIVE ═══
log ""
log "${GREEN}[1/5] Архивиране на проекта...${NC}"
ARCHIVE_NAME="${HOME}/kcy-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"

# KCY_WITH_ASSETS=1 (от пълната инсталация) → НЕ изключвай public/assets, качи ги с кода.
ASSET_EXCLUDE="--exclude=public/assets"
if [ "${KCY_WITH_ASSETS:-0}" = "1" ]; then
    ASSET_EXCLUDE=""
    log "  ${YELLOW}[debug] Изключени: node_modules, .git, кеш, логове — АСЕТИ ВКЛЮЧЕНИ (.env ВКЛЮЧЕН)${NC}"
else
    log "  ${YELLOW}[debug] Изключени: node_modules, .git, public/assets (→ опция 6), кеш, логове (.env ВКЛЮЧЕН)${NC}"
fi
log "  ${YELLOW}[debug] Създаване на ${ARCHIVE_NAME}...${NC}"

START_TIME=$SECONDS

# ЗАБЕЛЕЖКА: .env файловете СЕ включват — те са нужни на сървъра (конфигурация).
# Архивът пътува криптирано по SSH до твоя сървър, не отива публично.
tar -czf "$ARCHIVE_NAME" \
    --exclude='node_modules' \
    --exclude='.git' \
    ${ASSET_EXCLUDE} \
    --exclude='*.log' \
    --exclude='coverage' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.cache' \
    --exclude='tmp' \
    --exclude='*.swp' \
    --exclude='.DS_Store' \
    --exclude='*.zip' \
    --exclude='*.tar' \
    --exclude='*.gz' \
    --exclude='*.rar' \
    --exclude='04-deploy.sh' \
    --exclude='deploy.log' \
    --exclude='private/token/cache' \
    --exclude='private/multisig/cache' \
    --exclude='private/brch1/cache' \
    --exclude='private/token/artifacts' \
    --exclude='private/multisig/artifacts' \
    --exclude='private/brch1/artifacts' \
    -C "$(dirname "$(pwd)")" "$(basename "$(pwd)")" 2>&1 || die "tar не успя да архивира"

ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
TAR_TIME=$((SECONDS - START_TIME))
log "  ${GREEN}✓ ${ARCHIVE_NAME} (${ARCHIVE_SIZE}) — ${TAR_TIME}s${NC}"

# ═══ STEP 2: UPLOAD ARCHIVE ═══
log ""
log "${GREEN}[2/5] Качване на архива на сървъра...${NC}"
log "  ${YELLOW}[debug] scp ${SCP_OPTS} ${ARCHIVE_NAME} → ${STAGING}/${NC}"

# Ensure staging dir exists
# Ensure staging dir exists (with retry)
for ATTEMPT in 1 2 3 4; do
    ssh ${SSH_OPTS} "${USER}@${SERVER}" "mkdir -p ${STAGING}" && break
    [ "$ATTEMPT" -lt 4 ] && sleep 5
done || die "Не мога да създам ${STAGING}"

START_TIME=$SECONDS
SCP_OK=false
for ATTEMPT in 1 2 3 4; do
    log "  ${YELLOW}[опит ${ATTEMPT}/4]${NC}"
    if scp ${SCP_OPTS} "$ARCHIVE_NAME" "${USER}@${SERVER}:${STAGING}/"; then
        SCP_OK=true
        break
    else
        log "  ${RED}  ✗ Неуспешно${NC}"
        if [ "$ATTEMPT" -lt 4 ]; then
            log "  ${YELLOW}  Изчакване 5 секунди...${NC}"
            sleep 5
        fi
    fi
done
if [ "$SCP_OK" = false ]; then
    die "scp не успя след 4 опита"
fi
UPLOAD_TIME=$((SECONDS - START_TIME))
log "  ${GREEN}✓ Качен за ${UPLOAD_TIME}s${NC}"

# ═══ STEP 3: EXTRACT ON SERVER ═══
log ""
log "${GREEN}[3/5] Разархивиране на сървъра...${NC}"
log "  ${YELLOW}[debug] Изтриване на старите файлове в ${STAGING} и разархивиране...${NC}"

ARCHIVE_BASENAME=$(basename "$ARCHIVE_NAME")
ssh ${SSH_OPTS} "${USER}@${SERVER}" "
    set -e
    cd ${STAGING}
    echo '  [server] Изтриване на стари файлове (без архива)...'
    find ${STAGING} -mindepth 1 -maxdepth 1 ! -name '${ARCHIVE_BASENAME}' -exec rm -rf {} + 2>/dev/null || true
    echo '  [server] Разархивиране (strip top dir)...'
    tar -xzf ${ARCHIVE_BASENAME} --strip-components=1 2>&1
    rm -f ${ARCHIVE_BASENAME}

    # Safety net: нормализирай line endings (за случай че някой файл е CRLF).
    # Bash на Linux чупи скриптове с \r\n → '\$\\r': command not found.
    if command -v dos2unix >/dev/null 2>&1; then
        echo '  [server] Нормализиране на line endings в .sh файлове...'
        find ${STAGING}/deploy-scripts -name '*.sh' -exec dos2unix -q {} + 2>/dev/null || true
        echo '  [server] ✓ Готово'
    else
        # fallback със sed (по-бавен но винаги работи)
        echo '  [server] Нормализиране на line endings (sed fallback)...'
        find ${STAGING}/deploy-scripts -name '*.sh' -exec sed -i 's/\\r\$//' {} + 2>/dev/null || true
    fi
    # Направи всички shell скриптове изпълними
    find ${STAGING}/deploy-scripts -name '*.sh' -exec chmod +x {} + 2>/dev/null || true

    echo \"  [server] .git: \$([ -d .git ] && echo 'ДА — git pull е възможен' || echo 'НЯМА')\"
    echo '  [server] Готово.'
" || die "Разархивирането на сървъра не успя"

log "  ${GREEN}✓ Разархивирано${NC}"

# ═══ STEP 4: VERIFY ═══
log ""
log "${GREEN}[4/5] Проверка на сървъра...${NC}"
ssh ${SSH_OPTS} "${USER}@${SERVER}" "
    echo ''
    echo '  Съдържание на ${STAGING}/:'
    echo '  ─────────────────────────────────'
    for dir in public private deploy-scripts docs tests; do
        if [ -d \"${STAGING}/\$dir\" ]; then
            COUNT=\$(find ${STAGING}/\$dir -type f | wc -l)
            printf '  %-20s %s файла\n' \"\$dir/\" \"\$COUNT\"
        else
            printf '  %-20s %s\n' \"\$dir/\" 'ЛИПСВА!'
        fi
    done
    ROOT_FILES=\$(ls ${STAGING}/*.js ${STAGING}/*.json 2>/dev/null | wc -l)
    printf '  %-20s %s файла\n' 'root configs' \"\$ROOT_FILES\"
    echo ''
    if ls ${STAGING}/*.version 1>/dev/null 2>&1; then
        echo \"  Version: \$(ls ${STAGING}/*.version) → \$(cat ${STAGING}/*.version)\"
    else
        echo '  Version: НЯМА .version файл!'
    fi
    echo ''
"

# ═══ STEP 5: RUN SERVER-INSTALL ═══
log ""
log "${GREEN}[5/5] Активиране — изпълнение на 05-server-install.sh...${NC}"
log ""

# Питай дали да run-ва автоматично (default: yes)
RUN_INSTALL="y"
if [ -t 0 ] && [ "${DEPLOY_NO_PAUSE:-0}" != "1" ]; then
    read -p "  Пусни 05-server-install.sh автоматично сега? [Y/n, Enter = Да]: " RUN_INSTALL
    RUN_INSTALL="${RUN_INSTALL:-y}"
fi

if [ "$RUN_INSTALL" = "y" ] || [ "$RUN_INSTALL" = "Y" ]; then
    INSTALL_PATH="${STAGING}/deploy-scripts/server/05-server-install.sh"
    log "  ${CYAN}[debug] ssh → sudo ${INSTALL_PATH}${NC}"
    log ""

    # Първо chmod +x за да гарантираме изпълнимост
    ssh ${SSH_OPTS} "${USER}@${SERVER}" "chmod +x ${INSTALL_PATH}" 2>/dev/null

    # Запиши target info в hint файл, който 05-server-install.sh ще прочете
    # за да направи правилни предложения (server_name = IP/domain/both)
    PROD_DOMAIN="${TARGET_prod_SERVER:-alsec.strangled.net}"
    ssh ${SSH_OPTS} "${USER}@${SERVER}" "cat > /tmp/deploy_target_info << TARGETINFO
TARGET_NAME=${TARGET_NAME:-custom}
TARGET_SERVER=${SERVER}
TARGET_PROD_DOMAIN=${PROD_DOMAIN}
AUTO_NPM=${KCY_AUTO_NPM:-0}
TARGETINFO
" 2>/dev/null

    # Run-ни 05-server-install.sh през sudo (без bash prefix — match-ва sudoers entry)
    # -t флагът заделя TTY за интерактивни прозорци (ако скриптът пита)
    if ssh -t ${SSH_OPTS} "${USER}@${SERVER}" "sudo ${INSTALL_PATH}"; then
        log ""
        log "${GREEN}═══════════════════════════════════════════════════${NC}"
        log "${GREEN}  ✓ INSTALL COMPLETE${NC}"
        log "${GREEN}═══════════════════════════════════════════════════${NC}"
    else
        EXIT_CODE=$?
        log ""
        log "${RED}═══════════════════════════════════════════════════${NC}"
        log "${RED}  ✗ 05-server-install.sh завърши с грешка (exit ${EXIT_CODE})${NC}"
        log "${RED}═══════════════════════════════════════════════════${NC}"
        log ""
        log "${YELLOW}Възможни причини:${NC}"
        log "  1. ${USER} още няма limited sudo за 05-server-install.sh"
        log "     → Run-ни като root: ${CYAN}sudo bash ${STAGING}/deploy-scripts/server/03-kcy-admin-sudo.sh${NC}"
        log "  2. 05-server-install.sh падна по време на изпълнение"
        log "     → SSH-ни и пусни ръчно за да видиш грешката:"
        log "        ${CYAN}ssh -p ${PORT} ${USER}@${SERVER}${NC}"
        log "        ${CYAN}sudo ${INSTALL_PATH}${NC}"
        log ""
    fi
else
    log "  ${YELLOW}Пропуснато. Активирай ръчно:${NC}"
    log "    ${CYAN}ssh -p ${PORT} ${USER}@${SERVER}${NC}"
    log "    ${CYAN}sudo ${STAGING}/deploy-scripts/server/05-server-install.sh${NC}"
fi

# ═══ CLEANUP LOCAL ═══
rm -f "$ARCHIVE_NAME"
log "  ${GREEN}✓ Локалният архив изтрит${NC}"

# ═══ DONE ═══
TOTAL_TIME=$((SECONDS))
log ""
log "${GREEN}═══════════════════════════════════════════════════${NC}"
log "${GREEN}  ✓ DEPLOY COMPLETE (${TOTAL_TIME}s)${NC}"
log "${GREEN}═══════════════════════════════════════════════════${NC}"
log ""
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log "${YELLOW}  НЕОБХОДИМИ ПОТРЕБИТЕЛИ НА СЪРВЪРА               ${NC}"
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log ""
log "  ${RED}РЪЧНО${NC} — създай преди първата инсталация:"
log ""
log "  ${CYAN}deploy${NC} — само качва файлове, без sudo"
log "     Парола: по избор — може и SSH ключ, може и парола"
log "     sudo:   НЕ"
log "     ${GREEN}useradd -m -s /bin/bash deploy${NC}"
log "     ${GREEN}passwd deploy${NC}"
log "     SSH ключ от PowerShell:"
log "     ${GREEN}type \$env:USERPROFILE\\.ssh\\id_ed25519.pub | ssh -p ${PORT}${NC}"
log "     ${GREEN}deploy@${SERVER} \"mkdir -p ~/.ssh &&${NC}"
log "     ${GREEN}cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys\"${NC}"
log ""
log "  ${CYAN}kcy-admin${NC} — инсталира и управлява production"
log "     Парола: ДА — за sudo"
log "     sudo:   ДА, премахва се след инсталация"
log "     ${GREEN}useradd -m -s /bin/bash kcy-admin${NC}"
log "     ${GREEN}passwd kcy-admin${NC}"
log "     ${GREEN}usermod -aG sudo kcy-admin${NC}"
log "     Достъп: ${CYAN}ssh deploy@... → su - kcy-admin${NC}"
log ""
log "  ${GREEN}АВТОМАТИЧНО${NC} — 05-server-install.sh ги създава сам:"
log ""
log "  ${CYAN}kcy-chat${NC} — system user за chat сървиса"
log "     Тип: system user, без shell login"
log "     Пише в: private/chat/database/, private/chat/uploads/, /var/log/kcy-ecosystem/"
log ""
log "  ${CYAN}kcy-eco3${NC} — system user за ECO-3 и Portals сървисите"
log "     Тип: system user, без shell login"
log "     Пише в: private/eco-3/database/, private/portals/database/, /var/log/kcy-ecosystem/"
log "     Не може да чете /private/chat/database/ (изолация)"
log ""
log "  ${CYAN}Група kcy${NC} — обща група, .env е root:kcy с mode 640 (read-only за services)"
log ""
log "  sudo управление:"
log "     ${GREEN}sudo bash 03-kcy-admin-sudo.sh grant${NC}   — дай sudo"
log "     ${GREEN}sudo bash 03-kcy-admin-sudo.sh revoke${NC}  — премахни"
log ""
log "${YELLOW}  Бърз ъпдейт (без пълен deploy):${NC}"
log "  ${CYAN}ssh -p ${PORT} deploy@${SERVER}${NC}"
log "  ${CYAN}cd ${STAGING} && git pull${NC}"
log "  ${CYAN}su - kcy-admin${NC}"
log "  ${CYAN}sudo bash ${STAGING}/deploy-scripts/server/05-server-install.sh${NC}"
log ""
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log "${YELLOW}  .env КОНФИГУРАЦИЯ                                ${NC}"
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log ""
log "  .env НЕ се качва с deploy — тайните не пътуват по мрежата."
log "  Трябва да съществува на сървъра преди инсталация."
log ""
log "  ${CYAN}Шаблон:${NC}  docs/ENV-EXAMPLE.env"
log "  ${CYAN}Реален:${NC}  ${STAGING}/private/configs/.env"
log "  05-server-install.sh го копира автоматично на правилното място."
log ""
log "  ${CYAN}Как:${NC}"
log "  1. Влез на сървъра: ${GREEN}ssh -p ${PORT} deploy@${SERVER}${NC}"
log "  2. Копирай шаблона: ${GREEN}cp ${STAGING}/docs/ENV-EXAMPLE.env ${STAGING}/private/configs/.env${NC}"
log "  3. Попълни:         ${GREEN}nano ${STAGING}/private/configs/.env${NC}"
log "  4. Пусни инсталация"
log ""

# ═══ ENV шаблон — опционално показване и копиране ═══
# По default: пропуска. Активирай с DEPLOY_SHOW_ENV=1 за да покаже + питай.
if [ -f "docs/ENV-EXAMPLE.env" ] && [ "${DEPLOY_SHOW_ENV:-0}" = "1" ]; then
    log "  ${CYAN}Съдържание на docs/ENV-EXAMPLE.env:${NC}"
    log ""
    while IFS= read -r line; do
        log "  ${GREEN}${line}${NC}"
    done < "docs/ENV-EXAMPLE.env"
    log ""

    read -p "  Да копирам шаблона на сървъра като .env? [y/N]: " CREATE_ENV
    if [ "$CREATE_ENV" = "y" ] || [ "$CREATE_ENV" = "Y" ]; then
        scp ${SCP_OPTS} "docs/ENV-EXAMPLE.env" "${USER}@${SERVER}:${STAGING}/private/configs/.env" && \
            log "  ${GREEN}✓ Копиран: ${STAGING}/private/configs/.env${NC}" && \
            log "" && \
            log "  ${YELLOW}Влез и попълни стойностите:${NC}" && \
            log "    ${CYAN}ssh -p ${PORT} deploy@${SERVER}${NC}" && \
            log "    ${CYAN}nano ${STAGING}/private/configs/.env${NC}" || \
            log "  ${RED}✗ Не успя да копира${NC}"
    fi
elif [ ! -f "docs/ENV-EXAMPLE.env" ]; then
    log "  ${RED}✗ docs/ENV-EXAMPLE.env не е намерен!${NC}"
else
    log "  ${YELLOW}(прескочено — за показване на шаблона: DEPLOY_SHOW_ENV=1 ./deploy-scripts/04-deploy.sh)${NC}"
fi

log ""
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log "${YELLOW}  СИГУРНОСТ: Забрани root SSH достъп               ${NC}"
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log ""
log "  ${RED}root${NC} е най-атакуваният потребител — ботове"
log "  непрекъснато пробват root+парола по SSH."
log "  Забрани директен root login след като се увериш"
log "  че deploy + kcy-admin работят."
log ""
log "  ${CYAN}Стъпки:${NC}"
log ""
log "  1. Провери че deploy SSH работи:"
log "     ${GREEN}ssh -p ${PORT} deploy@${SERVER}${NC}"
log ""
log "  2. Провери su + sudo:"
log "     ${GREEN}su - kcy-admin${NC}"
log "     ${GREEN}sudo whoami${NC}   — трябва да каже: root"
log ""
log "  3. Забрани root SSH:"
log "     ${GREEN}sudo nano /etc/ssh/sshd_config${NC}"
log "     Намери реда PermitRootLogin и го промени на:"
log "     ${RED}PermitRootLogin no${NC}"
log ""
log "  4. Рестартирай SSH:"
log "     ${GREEN}sudo systemctl restart sshd${NC}"
log ""
log "  ${YELLOW}Ако се заключиш:${NC}"
log "  DigitalOcean → Droplets → Access → Launch Droplet Console"
log "  Там влизаш като root с парола, независимо от SSH настройките."
log ""
log "  Лог: ${YELLOW}${LOG_FILE}${NC}"
log ""
