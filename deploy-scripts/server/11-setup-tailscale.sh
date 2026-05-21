#!/bin/bash
# Version: 1.0093
##############################################################################
# KCY Ecosystem — Tailscale setup
#
# Инсталира и активира Tailscale за VPN между VPS и VM.
# Безплатно за лична употреба (до 100 устройства).
#
# Изпълнява се ВЕДНЪЖ на всяка машина (VPS и VM).
#
# Usage:
#   sudo bash 11-setup-tailscale.sh [auth-key]
#
# Ако подадеш auth-key — non-interactive. Ако не — отваря browser
# (или показва URL за authenticate).
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: трябва root. sudo bash $0"
    exit 1
fi

AUTH_KEY="${1:-}"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Tailscale setup (VPN между VPS и VM)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# ═══ STEP 1: INSTALL ═══
if command -v tailscale >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Tailscale вече инсталиран: $(tailscale version | head -1)"
else
    echo "  Инсталирам Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
    echo -e "  ${GREEN}✓${NC} Tailscale инсталиран"
fi

# ═══ STEP 2: AUTHENTICATE ═══
echo ""
if tailscale status >/dev/null 2>&1; then
    TS_IP=$(tailscale ip -4 2>/dev/null | head -1)
    echo -e "  ${GREEN}✓${NC} Tailscale вече свързан. IP: ${TS_IP}"
else
    echo "  Свързвам към Tailscale мрежата..."
    if [ -n "$AUTH_KEY" ]; then
        tailscale up --auth-key="$AUTH_KEY" --accept-routes --ssh
    else
        echo ""
        echo "  ${YELLOW}Tailscale ще покаже URL за authenticate. Отвори го в browser,${NC}"
        echo "  ${YELLOW}логни се с Google/GitHub/email, и това устройство ще се добави${NC}"
        echo "  ${YELLOW}към твоята Tailscale мрежа.${NC}"
        echo ""
        tailscale up --accept-routes --ssh
    fi

    TS_IP=$(tailscale ip -4 2>/dev/null | head -1)
    echo ""
    echo -e "  ${GREEN}✓${NC} Tailscale свързан. IP: ${TS_IP}"
fi

# ═══ STEP 3: SHOW STATUS ═══
echo ""
echo -e "${CYAN}Други устройства в Tailscale мрежата:${NC}"
tailscale status 2>/dev/null | grep -v "^$(hostname)" | head -10 || echo "  (само това устройство)"

# ═══ STEP 4: РАЗДЕЛИТЕЛ ═══
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Tailscale е активен                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Tailscale IP на това устройство: ${GREEN}${TS_IP}${NC}"
echo ""
echo -e "${CYAN}Следваща стъпка:${NC}"
echo "  Изпълни този скрипт на ДРУГАТА машина (VPS ако сме на VM, или обратно)."
echo "  След това можеш да настроиш failover чрез скрипт 12-setup-failover.sh"
echo ""
