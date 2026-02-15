#!/bin/bash
# Version: 1.0057
# KCY Ecosystem - Deploy Script for Linux/Mac
# Uploads project to server via rsync with proper exclusions

set -e

# Configuration
SERVER_IP="${1:-alsec.strangled.net}"
SERVER_USER="${2:-root}"
SERVER_PORT="${3:-22}"
LOCAL_PATH="."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Help
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat << EOF
KCY Ecosystem - Deploy Script for Linux/Mac

Usage:
    ./deploy.sh [server_ip] [user] [port]

Arguments:
    server_ip   Server hostname or IP (default: alsec.strangled.net)
    user        SSH username (default: root)
    port        SSH port (default: 22)

Examples:
    ./deploy.sh
    ./deploy.sh 192.168.1.100 admin 2222

Requirements:
    - rsync installed (usually pre-installed)
    - SSH access to server
    - .deployignore file (auto-created if missing)

EOF
    exit 0
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  KCY Ecosystem - Deploy to Server${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check for rsync
echo -e "${GREEN}[1/6] Checking prerequisites...${NC}"
if ! command -v rsync &> /dev/null; then
    echo -e "${RED}  ✗ rsync not found!${NC}"
    echo -e "${YELLOW}  Install it with: sudo apt install rsync (Ubuntu/Debian)${NC}"
    echo -e "${YELLOW}  or: brew install rsync (Mac)${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ rsync found${NC}"

# Check for .deployignore
if [ ! -f ".deployignore" ]; then
    echo -e "${YELLOW}  ! .deployignore not found, using defaults${NC}"
    # Create basic .deployignore
    cat > .deployignore << 'IGNORE'
node_modules/
.git/
.env
*.log
coverage/
dist/
build/
.cache/
tmp/
IGNORE
fi

echo ""
echo -e "${GREEN}[2/6] Testing connection...${NC}"
echo -e "  Server: ${CYAN}${SERVER_USER}@${SERVER_IP}:${SERVER_PORT}${NC}"

# Test SSH connection
if ! ssh -p "$SERVER_PORT" -o ConnectTimeout=10 -o BatchMode=yes "${SERVER_USER}@${SERVER_IP}" exit 2>/dev/null; then
    echo -e "${YELLOW}  ! Could not verify SSH connection${NC}"
    echo -e "${YELLOW}  Proceeding anyway... You may be prompted for password${NC}"
fi

echo ""
echo -e "${GREEN}[3/6] Creating remote directories...${NC}"

ssh -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" "mkdir -p /var/www/html /var/www/kcy-ecosystem" || {
    echo -e "${RED}  ✗ Failed to create directories!${NC}"
    exit 1
}
echo -e "${GREEN}  ✓ Directories created${NC}"

echo ""
echo -e "${GREEN}[4/6] Uploading PUBLIC files...${NC}"

# Upload public directory
rsync -avz --progress \
    -e "ssh -p ${SERVER_PORT}" \
    --exclude-from='.deployignore' \
    public/ \
    "${SERVER_USER}@${SERVER_IP}:/var/www/html/" || {
    echo -e "${RED}  ✗ Failed to upload public files!${NC}"
    exit 1
}
echo -e "${GREEN}  ✓ Public files uploaded${NC}"

echo ""
echo -e "${GREEN}[5/6] Uploading PRIVATE files...${NC}"

# Upload private directory
rsync -avz --progress \
    -e "ssh -p ${SERVER_PORT}" \
    --exclude-from='.deployignore' \
    private/ \
    "${SERVER_USER}@${SERVER_IP}:/var/www/kcy-ecosystem/" || {
    echo -e "${RED}  ✗ Failed to upload private files!${NC}"
    exit 1
}
echo -e "${GREEN}  ✓ Private files uploaded${NC}"

echo ""
echo -e "${GREEN}[6/6] Uploading configuration files...${NC}"

# Upload root files (excluding sensitive ones)
rsync -avz --progress \
    -e "ssh -p ${SERVER_PORT}" \
    --include='package.json' \
    --include='hardhat.config.js' \
    --include='jest.config.js' \
    --include='.env.example' \
    --include='README.md' \
    --exclude='*' \
    ./ \
    "${SERVER_USER}@${SERVER_IP}:/var/www/kcy-ecosystem/" || {
    echo -e "${YELLOW}  ! Some root files may not have uploaded${NC}"
}

# Upload deploy scripts
rsync -avz --progress \
    -e "ssh -p ${SERVER_PORT}" \
    --exclude-from='.deployignore' \
    deploy-scripts/ \
    "${SERVER_USER}@${SERVER_IP}:/var/www/kcy-ecosystem/deploy-scripts/" || {
    echo -e "${YELLOW}  ! Deploy scripts may not have uploaded${NC}"
}

echo -e "${GREEN}  ✓ Configuration files uploaded${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  1. SSH to server: ${YELLOW}ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP}${NC}"
echo -e "  2. Navigate: ${YELLOW}cd /var/www/kcy-ecosystem${NC}"
echo -e "  3. Install dependencies: ${YELLOW}npm install --production${NC}"
echo -e "  4. Run setup scripts:"
echo -e "     ${YELLOW}cd deploy-scripts/server${NC}"
echo -e "     ${YELLOW}chmod +x *.sh${NC}"
echo -e "     ${YELLOW}./01-setup-database.sh${NC}"
echo -e "     ${YELLOW}./02-setup-domain.sh${NC}"
echo ""
echo -e "${CYAN}Files excluded from deployment:${NC}"
echo -e "  ${YELLOW}• node_modules/${NC}"
echo -e "  ${YELLOW}• .git/${NC}"
echo -e "  ${YELLOW}• .env files${NC}"
echo -e "  ${YELLOW}• See .deployignore for full list${NC}"
echo ""
