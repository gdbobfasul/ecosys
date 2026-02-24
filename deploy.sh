#!/bin/bash
# Version: 1.0085
##############################################################################
# KCY Ecosystem - Deploy Script (Client-side)
#
# Архивира проекта → качва 1 файл → разархивира на сървъра.
# Логва всичко в deploy.log.
#
# Usage: ./deploy.sh [server] [user] [port]
##############################################################################

# НЕ ползваме set -e — искаме прозорецът да остане отворен при грешка
# Всяка команда проверяваме ръчно

# Прозорецът ВИНАГИ остава отворен
trap 'echo ""; echo "Натисни Enter за затваряне..."; read DUMMY' EXIT

SERVER="${1:-alsec.strangled.net}"
USER="${2:-deploy}"
PORT="${3:-22}"
STAGING="/var/www/deploy"
LOG_FILE="${HOME}/kcy-deploy.log"

RED='\033[0;31m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

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
KCY Ecosystem - Deploy v1.0085

Usage:  ./deploy.sh [server] [user] [port]
Default: alsec.strangled.net deploy 22

Архивира проекта → качва 1 файл → разархивира на сървъра.
Всичко се логва в deploy.log.
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

log "${CYAN}╔═══════════════════════════════════════════╗${NC}"
log "${CYAN}║     KCY Ecosystem - Deploy v1.0085        ║${NC}"
log "${CYAN}╚═══════════════════════════════════════════╝${NC}"
log ""
log "  Server:  ${GREEN}${SERVER}${NC}"
log "  User:    ${GREEN}${USER}${NC}"
log "  Port:    ${GREEN}${PORT}${NC}"
log "  Staging: ${GREEN}${STAGING}${NC}"
log "  Log:     ${GREEN}${LOG_FILE}${NC}"
log ""

# ═══ SSH CONFIG ═══
# Windows (Git Bash/MSYS) doesn't support Unix sockets for ControlMaster
if [ -n "$MSYSTEM" ] || [ -n "$WINDIR" ]; then
    SSH_OPTS="-p ${PORT}"
    SCP_OPTS="-P ${PORT}"
    log "  ${YELLOW}[debug] Windows detected — SSH без ControlMaster${NC}"
else
    SOCK_DIR=$(mktemp -d 2>/dev/null || echo "/tmp")
    SSH_SOCK="${SOCK_DIR}/kcy-deploy-$$"
    SSH_OPTS="-o ControlMaster=auto -o ControlPath=${SSH_SOCK} -o ControlPersist=120 -p ${PORT}"
    SCP_OPTS="-o ControlMaster=auto -o ControlPath=${SSH_SOCK} -o ControlPersist=120 -P ${PORT}"
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
deploy.sh
private/token/cache/
private/multisig/cache/
private/token/artifacts/
private/multisig/artifacts/
IGN

# ═══ STEP 0: CONNECT ═══
log ""
log "${GREEN}[0/4] Connecting to ${SERVER}...${NC}"
log "  ${YELLOW}[debug] ssh ${SSH_OPTS} ${USER}@${SERVER}${NC}"

ssh ${SSH_OPTS} "${USER}@${SERVER}" 'echo "  ✓ Connected as $(whoami) on $(hostname)"' || {
    die "Не мога да се свържа с ${USER}@${SERVER}:${PORT}

  Провери:
    1. SSH ключ: ssh-copy-id -p ${PORT} ${USER}@${SERVER}
    2. Парола: потребител '${USER}' има ли парола?
    3. Порт: правилен ли е ${PORT}?
    4. Мрежа: ping ${SERVER}"
}

# ═══ STEP 1: CREATE LOCAL ARCHIVE ═══
log ""
log "${GREEN}[1/4] Архивиране на проекта...${NC}"
ARCHIVE_NAME="${HOME}/kcy-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"

log "  ${YELLOW}[debug] Изключени: node_modules, .env, кеш, логове (.git ВКЛЮЧЕН)${NC}"
log "  ${YELLOW}[debug] Създаване на ${ARCHIVE_NAME}...${NC}"

START_TIME=$SECONDS

tar -czf "$ARCHIVE_NAME" \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='*.log' \
    --exclude='coverage' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.cache' \
    --exclude='tmp' \
    --exclude='*.swp' \
    --exclude='.DS_Store' \
    --exclude='*.pem' \
    --exclude='*.key' \
    --exclude='*.zip' \
    --exclude='*.tar' \
    --exclude='*.gz' \
    --exclude='*.rar' \
    --exclude='deploy.sh' \
    --exclude='deploy.log' \
    --exclude='private/token/cache' \
    --exclude='private/multisig/cache' \
    --exclude='private/token/artifacts' \
    --exclude='private/multisig/artifacts' \
    -C "$(dirname "$(pwd)")" "$(basename "$(pwd)")" 2>&1 || die "tar не успя да архивира"

ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
TAR_TIME=$((SECONDS - START_TIME))
log "  ${GREEN}✓ ${ARCHIVE_NAME} (${ARCHIVE_SIZE}) — ${TAR_TIME}s${NC}"

# ═══ STEP 2: UPLOAD ARCHIVE ═══
log ""
log "${GREEN}[2/4] Качване на архива на сървъра...${NC}"
log "  ${YELLOW}[debug] scp ${SCP_OPTS} ${ARCHIVE_NAME} → ${STAGING}/${NC}"

# Ensure staging dir exists
# Ensure staging dir exists (with retry)
for ATTEMPT in 1 2 3; do
    ssh ${SSH_OPTS} "${USER}@${SERVER}" "mkdir -p ${STAGING}" && break
    [ "$ATTEMPT" -lt 3 ] && sleep 5
done || die "Не мога да създам ${STAGING}"

START_TIME=$SECONDS
SCP_OK=false
for ATTEMPT in 1 2 3; do
    log "  ${YELLOW}[опит ${ATTEMPT}/3]${NC}"
    if scp ${SCP_OPTS} "$ARCHIVE_NAME" "${USER}@${SERVER}:${STAGING}/"; then
        SCP_OK=true
        break
    else
        log "  ${RED}  ✗ Неуспешно${NC}"
        if [ "$ATTEMPT" -lt 3 ]; then
            log "  ${YELLOW}  Изчакване 5 секунди...${NC}"
            sleep 5
        fi
    fi
done
if [ "$SCP_OK" = false ]; then
    die "scp не успя след 3 опита"
fi
UPLOAD_TIME=$((SECONDS - START_TIME))
log "  ${GREEN}✓ Качен за ${UPLOAD_TIME}s${NC}"

# ═══ STEP 3: EXTRACT ON SERVER ═══
log ""
log "${GREEN}[3/4] Разархивиране на сървъра...${NC}"
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
    echo \"  [server] .git: \$([ -d .git ] && echo 'ДА — git pull е възможен' || echo 'НЯМА')\"
    echo '  [server] Готово.'
" || die "Разархивирането на сървъра не успя"

log "  ${GREEN}✓ Разархивирано${NC}"

# ═══ STEP 4: VERIFY ═══
log ""
log "${GREEN}[4/4] Проверка на сървъра...${NC}"
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
log "${YELLOW}  СЛЕДВАЩА СТЪПКА: Инсталация на сървъра${NC}"
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log ""
log "  Влез като ${GREEN}deploy${NC}, превключи на ${GREEN}kcy-admin${NC}:"
log ""
log "  ${CYAN}ssh -p ${PORT} deploy@${SERVER}${NC}"
log "  ${CYAN}su - kcy-admin${NC}"
log "  ${CYAN}cd ${STAGING}/deploy-scripts/server${NC}"
log "  ${CYAN}sudo bash server-install.sh${NC}"
log ""
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log "${YELLOW}  НЕОБХОДИМИ ПОТРЕБИТЕЛИ НА СЪРВЪРА               ${NC}"
log "${YELLOW}═══════════════════════════════════════════════════${NC}"
log ""
log "  ${RED}РЪЧНО${NC} — създай преди първата инсталация:"
log ""
log "  ${CYAN}deploy${NC} — само качва файлове, без sudo"
log "     Парола: НЕ — само SSH ключ"
log "     sudo:   НЕ"
log "     ${GREEN}useradd -m -s /bin/bash deploy${NC}"
log "     ${GREEN}passwd -l deploy${NC}"
log "     ${GREEN}ssh-copy-id -p ${PORT} deploy@${SERVER}${NC}"
log ""
log "  ${CYAN}kcy-admin${NC} — инсталира и управлява production"
log "     Парола: ДА — за sudo"
log "     sudo:   ДА, премахва се след инсталация"
log "     ${GREEN}useradd -m -s /bin/bash kcy-admin${NC}"
log "     ${GREEN}passwd kcy-admin${NC}"
log "     ${GREEN}usermod -aG sudo kcy-admin${NC}"
log "     Достъп: ${CYAN}ssh deploy@... → su - kcy-admin${NC}"
log ""
log "  ${GREEN}АВТОМАТИЧНО${NC} — server-install.sh ги създава сам:"
log ""
log "  ${CYAN}kcy-chat${NC} — изпълнява Chat сървиса"
log "     Парола: НЕ, system user, без login"
log "     Владее: private/chat/ — database, uploads, logs"
log ""
log "  ${CYAN}kcy-eco3${NC} — изпълнява ECO-3 сървиса"
log "     Парола: НЕ, system user, без login"
log "     Владее: private/eco-3/ — само logs"
log "     ${RED}Изолиран${NC} — не може да чете chat/database/"
log ""
log "  ${CYAN}Група kcy${NC} — обща, .env е root:kcy 640"
log ""
log "  sudo управление:"
log "     ${GREEN}sudo bash kcy-admin-sudo.sh grant${NC}   — дай sudo"
log "     ${GREEN}sudo bash kcy-admin-sudo.sh revoke${NC}  — премахни"
log ""
log "${YELLOW}  Бърз ъпдейт (без пълен deploy):${NC}"
log "  ${CYAN}ssh -p ${PORT} deploy@${SERVER}${NC}"
log "  ${CYAN}cd ${STAGING} && git pull${NC}"
log "  ${CYAN}su - kcy-admin${NC}"
log "  ${CYAN}sudo bash ${STAGING}/deploy-scripts/server/server-install.sh${NC}"
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
