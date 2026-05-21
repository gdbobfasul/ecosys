#!/bin/bash
# Version: 1.0093
##############################################################################
# KCY Ecosystem — Toggle kcy-admin sudo privileges
#
# ⚠ ОПАСНА ОПЕРАЦИЯ — управлява пълните root права на kcy-admin.
#
# Това НЕ е същото като /etc/sudoers.d/kcy-deploy (limited sudo за deploy).
# Тук става въпрос за kcy-admin потребителя в "sudo" Unix групата —
# който има пълен root достъп без ограничения.
#
# Двойно потвърждение: първо 'yes', после 'no' за да затрие правата.
#
# Usage: sudo bash 13-kcy-admin-sudo-toggle.sh
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: трябва root. sudo bash $0"
    exit 1
fi

echo ""
echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  ⚠  ОПАСНО: Управление на sudo права на kcy-admin             ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Има ли kcy-admin изобщо
if ! id kcy-admin &>/dev/null; then
    echo -e "  ${YELLOW}kcy-admin потребител не съществува${NC}"
    echo "  (В новата архитектура deploy потребителят има limited sudo вместо kcy-admin.)"
    exit 0
fi

# Текущо състояние
HAS_SUDO=false
if groups kcy-admin 2>/dev/null | grep -qw sudo; then
    HAS_SUDO=true
fi

echo "  Текущо състояние: kcy-admin $(if $HAS_SUDO; then echo "${YELLOW}има sudo права${NC}"; else echo "${GREEN}няма sudo права${NC}"; fi)"
echo ""

# Какво искаш да направиш
if $HAS_SUDO; then
    echo "  Опции:"
    echo "    1) ${YELLOW}Премахни sudo${NC} от kcy-admin (по-сигурно)"
    echo "    2) Запази както е"
    echo ""
    read -p "  Избери [1/2, default=2]: " ACTION
    [ "$ACTION" = "1" ] || { echo "Отказано."; exit 0; }
    OPERATION="revoke"
else
    echo "  Опции:"
    echo "    1) ${YELLOW}Дай sudo${NC} на kcy-admin (по-несигурно, но удобно за recovery)"
    echo "    2) Запази както е"
    echo ""
    read -p "  Избери [1/2, default=2]: " ACTION
    [ "$ACTION" = "1" ] || { echo "Отказано."; exit 0; }
    OPERATION="grant"
fi

# DOUBLE CONFIRM: първо 'yes', после 'no'
echo ""
echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
echo -e "${RED}  ДВОЙНО ПОТВЪРЖДЕНИЕ${NC}"
echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$OPERATION" = "revoke" ]; then
    echo "  Ще премахна kcy-admin от sudo групата."
    echo "  След това kcy-admin няма да може да изпълнява sudo команди."
    echo ""
    echo "  Все още можеш да възстановиш правата с root SSH:"
    echo "    su -    (от deploy с парола)"
    echo "    usermod -aG sudo kcy-admin"
else
    echo "  Ще добавя kcy-admin към sudo групата."
    echo "  След това kcy-admin ще може да изпълнява ВСЯКА sudo команда."
fi

echo ""
echo -e "${YELLOW}Стъпка 1 от 2:${NC}"
read -p "  Сигурен ли си? Напиши 'yes': " CONF1
if [ "$CONF1" != "yes" ]; then
    echo "Отказано (стъпка 1)."
    exit 0
fi

echo ""
echo -e "${YELLOW}Стъпка 2 от 2 (anti-typo защита):${NC}"
echo "  Сега напиши 'no' — да, NO — за финално потвърждение."
echo "  (Това е double-check срещу случайно натискане на бутони.)"
read -p "  Напиши 'no': " CONF2
if [ "$CONF2" != "no" ]; then
    echo "Отказано (стъпка 2)."
    exit 0
fi

# Изпълни
echo ""
echo -e "${CYAN}Прилагам промяната...${NC}"

if [ "$OPERATION" = "revoke" ]; then
    gpasswd -d kcy-admin sudo
    echo -e "  ${GREEN}✓${NC} kcy-admin премахнат от sudo групата"
else
    usermod -aG sudo kcy-admin
    echo -e "  ${GREEN}✓${NC} kcy-admin добавен към sudo групата"
fi

# Verify
echo ""
echo "  Текущи групи на kcy-admin:"
groups kcy-admin | sed 's/^/    /'
echo ""

if [ "$OPERATION" = "revoke" ]; then
    echo -e "${GREEN}✓ kcy-admin sudo правата ПРЕМАХНАТИ${NC}"
    echo ""
    echo "  За да върнеш правата по-късно:"
    echo -e "    ${CYAN}sudo bash $(basename $0)${NC}"
else
    echo -e "${GREEN}✓ kcy-admin sudo правата ДАДЕНИ${NC}"
fi
echo ""
