#!/bin/bash
# Version: 1.0085
##############################################################################
# KCY Ecosystem - Deploy Script (Client-side)
# Изтрива staging, качва ЦЕЛИЯ проект 1:1.
# SSH multiplexing — една връзка за всичко.
#
# Usage: ./deploy.sh [server] [user] [port]
##############################################################################

set -e

SERVER="${1:-alsec.strangled.net}"
USER="${2:-deploy}"
PORT="${3:-22}"
STAGING="/var/www/deploy"

RED='\033[0;31m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat << 'EOF'
KCY Ecosystem - Deploy v1.0085

Usage:  ./deploy.sh [server] [user] [port]
Default: alsec.strangled.net deploy 22

Изтрива staging, качва целия проект 1:1.
След това на сървъра: sudo bash server-install.sh
EOF
    exit 0
fi

echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     KCY Ecosystem - Deploy v1.0085        ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Server:  ${GREEN}${SERVER}${NC}"
echo -e "  User:    ${GREEN}${USER}${NC}"
echo -e "  Staging: ${GREEN}${STAGING}${NC}"
echo ""

# ═══ SSH MULTIPLEXING ═══
SOCK_DIR=$(mktemp -d 2>/dev/null || echo "/tmp")
SSH_SOCK="${SOCK_DIR}/kcy-deploy-$$"
SSH_OPTS="-o ControlMaster=auto -o ControlPath=${SSH_SOCK} -o ControlPersist=120 -p ${PORT}"

cleanup() {
    ssh -O exit -o ControlPath="${SSH_SOCK}" "${USER}@${SERVER}" 2>/dev/null || true
    rm -f "${SSH_SOCK}" 2>/dev/null || true
    rmdir "${SOCK_DIR}" 2>/dev/null || true
}
trap cleanup EXIT

# rsync or scp
USE_RSYNC=false
if command -v rsync &> /dev/null; then
    USE_RSYNC=true
    echo -e "${GREEN}✓ rsync${NC}"
elif command -v scp &> /dev/null; then
    echo -e "${GREEN}✓ scp${NC}"
else
    echo -e "${RED}✗ Need rsync or scp${NC}"
    read -p "Enter to close..."; exit 1
fi

# .deployignore
[ ! -f ".deployignore" ] && cat > .deployignore << 'IGN'
node_modules/
.git/
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
IGN

# ═══ CONNECT ═══
echo ""
echo -e "${GREEN}[0/5] Connecting...${NC}"
ssh ${SSH_OPTS} "${USER}@${SERVER}" "echo '  ✓ Connected as ${USER}'" || {
    echo -e "${RED}✗ Cannot connect to ${USER}@${SERVER}:${PORT}${NC}"
    echo ""
    echo -e "${YELLOW}Провери:${NC}"
    echo -e "  1. SSH ключ: ${CYAN}ssh-copy-id -p ${PORT} ${USER}@${SERVER}${NC}"
    echo -e "  2. Парола: потребител '${USER}' има ли парола?"
    echo -e "  3. Порт: правилен ли е ${PORT}?"
    read -p "Enter to close..."; exit 1
}

# ═══ CLEAN STAGING ═══
echo -e "${GREEN}[1/5] Cleaning staging...${NC}"
ssh ${SSH_OPTS} "${USER}@${SERVER}" "rm -rf ${STAGING}/* && mkdir -p ${STAGING}"
echo -e "${GREEN}  ✓ ${STAGING}/ изчистена${NC}"

# ═══ UPLOAD EVERYTHING 1:1 ═══
echo -e "${GREEN}[2/5] Uploading public/...${NC}"
if [ "$USE_RSYNC" = true ]; then
    rsync -az -e "ssh ${SSH_OPTS}" --exclude-from='.deployignore' \
        public/ "${USER}@${SERVER}:${STAGING}/public/"
else
    scp ${SSH_OPTS} -r public "${USER}@${SERVER}:${STAGING}/"
fi

echo -e "${GREEN}[3/5] Uploading private/...${NC}"
if [ "$USE_RSYNC" = true ]; then
    rsync -az -e "ssh ${SSH_OPTS}" --exclude-from='.deployignore' \
        private/ "${USER}@${SERVER}:${STAGING}/private/"
else
    scp ${SSH_OPTS} -r private "${USER}@${SERVER}:${STAGING}/"
fi

echo -e "${GREEN}[4/5] Uploading deploy-scripts/, docs/, tests/...${NC}"
if [ "$USE_RSYNC" = true ]; then
    # deploy-scripts
    rsync -az -e "ssh ${SSH_OPTS}" --exclude-from='.deployignore' \
        deploy-scripts/ "${USER}@${SERVER}:${STAGING}/deploy-scripts/" 2>/dev/null || true
    # docs
    [ -d "docs" ] && rsync -az -e "ssh ${SSH_OPTS}" \
        docs/ "${USER}@${SERVER}:${STAGING}/docs/" 2>/dev/null || true
    # tests
    [ -d "tests" ] && rsync -az -e "ssh ${SSH_OPTS}" --exclude-from='.deployignore' \
        tests/ "${USER}@${SERVER}:${STAGING}/tests/" 2>/dev/null || true
else
    scp ${SSH_OPTS} -r deploy-scripts "${USER}@${SERVER}:${STAGING}/" 2>/dev/null || true
    [ -d "docs" ] && scp ${SSH_OPTS} -r docs "${USER}@${SERVER}:${STAGING}/" 2>/dev/null || true
    [ -d "tests" ] && scp ${SSH_OPTS} -r tests "${USER}@${SERVER}:${STAGING}/" 2>/dev/null || true
fi

echo -e "${GREEN}[5/5] Uploading root config files...${NC}"
if [ "$USE_RSYNC" = true ]; then
    rsync -az -e "ssh ${SSH_OPTS}" \
        --include='package.json' \
        --include='package-lock.json' \
        --include='hardhat.config.js' \
        --include='jest.config.js' \
        --include='jest.mobile.config.js' \
        --include='jest.setup.js' \
        --include='00032.version' \
        --include='.deployignore' \
        --exclude='*' \
        ./ "${USER}@${SERVER}:${STAGING}/" 2>/dev/null || true
else
    for f in package.json package-lock.json hardhat.config.js jest.config.js \
             jest.mobile.config.js jest.setup.js 00032.version .deployignore; do
        [ -f "$f" ] && scp ${SSH_OPTS} "$f" "${USER}@${SERVER}:${STAGING}/" 2>/dev/null || true
    done
fi

# ═══ VERIFY ═══
echo ""
echo -e "${GREEN}[✓] Verifying...${NC}"
ssh ${SSH_OPTS} "${USER}@${SERVER}" "
    echo '  public/:          '$(ls ${STAGING}/public/ 2>/dev/null | wc -l)' items'
    echo '  private/:         '$(ls ${STAGING}/private/ 2>/dev/null | wc -l)' items'
    echo '  deploy-scripts/:  '$(ls ${STAGING}/deploy-scripts/ 2>/dev/null | wc -l)' items'
    echo '  docs/:            '$(ls ${STAGING}/docs/ 2>/dev/null | wc -l)' items'
    echo '  tests/:           '$(ls ${STAGING}/tests/ 2>/dev/null | wc -l)' items'
    echo '  root files:       '$(ls ${STAGING}/*.js ${STAGING}/*.json 2>/dev/null | wc -l)' files'
    [ -f ${STAGING}/00032.version ] && echo '  version:          '$(cat ${STAGING}/00032.version)
"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ UPLOAD COMPLETE${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo -e "${YELLOW}  СЛЕДВАЩА СТЪПКА: Инсталация на сървъра${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}ssh -p ${PORT} ${USER}@${SERVER}${NC}"
echo -e "  ${YELLOW}cd ${STAGING}/deploy-scripts/server${NC}"
echo -e "  ${YELLOW}sudo bash server-install.sh${NC}"
echo ""

read -p "Press Enter to close..."
