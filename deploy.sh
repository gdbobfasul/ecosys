#!/bin/bash
# Version: 1.0062
##############################################################################
# KCY Ecosystem - Universal Deploy Script
# Works on: Windows (Git Bash/WSL), Linux, Mac
# 
# Usage: ./deploy.sh [server] [user] [port]
##############################################################################

set -e

# Default config
SERVER="${1:-alsec.strangled.net}"
USER="${2:-root}"
PORT="${3:-22}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat << 'EOF'
KCY Ecosystem - Deploy

Usage:
    ./deploy.sh [server] [user] [port]

Examples:
    ./deploy.sh
    ./deploy.sh 192.168.1.100 admin 2222

EOF
    exit 0
fi

echo -e "${CYAN}╔═══════════════════════════════════╗${NC}"
echo -e "${CYAN}║    KCY Ecosystem - Deploy         ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════╝${NC}"
echo ""

# Check for rsync or scp
USE_RSYNC=false
if command -v rsync &> /dev/null; then
    USE_RSYNC=true
    echo -e "${GREEN}Using: rsync${NC}"
elif command -v scp &> /dev/null; then
    echo -e "${GREEN}Using: scp${NC}"
else
    echo -e "${RED}ERROR: Need rsync or scp${NC}"
    exit 1
fi

# Create .deployignore if missing
if [ ! -f ".deployignore" ]; then
    cat > .deployignore << 'IGNORE'
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
IGNORE
fi

echo ""
echo -e "${GREEN}[1/3] Creating directories...${NC}"
ssh -p "$PORT" "${USER}@${SERVER}" "mkdir -p /var/www/html /var/www/kcy-ecosystem" || exit 1

echo -e "${GREEN}[2/3] Uploading PUBLIC...${NC}"
if [ "$USE_RSYNC" = true ]; then
    rsync -az -e "ssh -p ${PORT}" --exclude-from='.deployignore' public/ "${USER}@${SERVER}:/var/www/html/" || exit 1
else
    scp -r -P "$PORT" public/* "${USER}@${SERVER}:/var/www/html/" || exit 1
fi

echo -e "${GREEN}[3/3] Uploading PRIVATE...${NC}"
if [ "$USE_RSYNC" = true ]; then
    rsync -az -e "ssh -p ${PORT}" --exclude-from='.deployignore' private/ "${USER}@${SERVER}:/var/www/kcy-ecosystem/" || exit 1
    rsync -az -e "ssh -p ${PORT}" --exclude-from='.deployignore' deploy-scripts/ "${USER}@${SERVER}:/var/www/kcy-ecosystem/deploy-scripts/" 2>/dev/null || true
else
    scp -r -P "$PORT" private/* "${USER}@${SERVER}:/var/www/kcy-ecosystem/" || exit 1
    scp -r -P "$PORT" deploy-scripts "${USER}@${SERVER}:/var/www/kcy-ecosystem/" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}✓ DEPLOY COMPLETE${NC}"
echo ""
echo -e "${CYAN}Next:${NC} ssh -p ${PORT} ${USER}@${SERVER}"
echo -e "${CYAN}Then:${NC} cd /var/www/kcy-ecosystem/deploy-scripts/server && sudo ./setup-wizard.sh"
echo ""
