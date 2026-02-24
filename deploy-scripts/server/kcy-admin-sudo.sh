#!/bin/bash
# Version: 1.0085
##############################################################################
# KCY Ecosystem - kcy-admin sudo управление
#
# Usage:
#   sudo bash kcy-admin-sudo.sh grant    — дава sudo на kcy-admin
#   sudo bash kcy-admin-sudo.sh revoke   — премахва sudo от kcy-admin
#   sudo bash kcy-admin-sudo.sh status   — показва текущо състояние
##############################################################################

RED='\033[0;31m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}ГРЕШКА: Стартирай с root права!${NC}"
    echo "  sudo bash $0 $1"
    exit 1
fi

if ! id "kcy-admin" &>/dev/null; then
    echo -e "${RED}ГРЕШКА: Потребител kcy-admin не съществува!${NC}"
    echo ""
    echo -e "Създай го:"
    echo -e "  ${GREEN}useradd -m -s /bin/bash kcy-admin${NC}"
    echo -e "  ${GREEN}passwd kcy-admin${NC}"
    exit 1
fi

show_status() {
    if groups kcy-admin 2>/dev/null | grep -qw sudo; then
        echo -e "  kcy-admin: ${RED}● sudo АКТИВЕН${NC}"
    else
        echo -e "  kcy-admin: ${GREEN}● sudo ПРЕМАХНАТ (безопасно)${NC}"
    fi
}

case "${1:-status}" in
    grant)
        usermod -aG sudo kcy-admin
        echo -e "${GREEN}✓ sudo ДАДЕН на kcy-admin${NC}"
        echo ""
        echo -e "${YELLOW}Не забравяй да го премахнеш след инсталация:${NC}"
        echo -e "  ${CYAN}sudo bash $0 revoke${NC}"
        echo ""
        show_status
        ;;
    revoke)
        gpasswd -d kcy-admin sudo 2>/dev/null || true
        echo -e "${GREEN}✓ sudo ПРЕМАХНАТ от kcy-admin${NC}"
        echo ""
        echo -e "За да го върнеш:"
        echo -e "  ${CYAN}sudo bash $0 grant${NC}"
        echo ""
        show_status
        ;;
    status)
        echo -e "${CYAN}KCY Admin sudo статус:${NC}"
        echo ""
        show_status
        echo ""
        echo -e "Групи: $(groups kcy-admin 2>/dev/null)"
        echo ""
        echo -e "Команди:"
        echo -e "  ${GREEN}sudo bash $0 grant${NC}    — дай sudo"
        echo -e "  ${GREEN}sudo bash $0 revoke${NC}   — премахни sudo"
        ;;
    *)
        echo "Usage: sudo bash $0 {grant|revoke|status}"
        exit 1
        ;;
esac
