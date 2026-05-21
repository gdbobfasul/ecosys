#!/bin/bash
# Version: 1.0093
##############################################################################
# KCY Ecosystem — Disable SSH password authentication
#
# ⚠ ОПАСНА ОПЕРАЦИЯ — изключва парола за SSH login.
# След това можеш да влезеш САМО със SSH ключ.
# Ако загубиш ключа, нямаш достъп до сървъра.
#
# Сигурно е САМО ако:
#   • Имаш recovery console (DigitalOcean droplet console, AWS Session Manager,
#     hetzner cloud console, и т.н.)
#   • Имаш физически достъп до машината (за локални VM-та през VirtualBox/Hyper-V)
#
# Опасно е ако:
#   • Сървърът е remote и единственият достъп е SSH
#   • Имаш само един ключ и липсва backup
#
# Usage: sudo bash 03-disable-ssh-password.sh
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

# ── diag_log helper (respects "scripts" flag)
diag_log() {
    [ -d "/var/www/html/last-errors" ] || return 0
    if [ -f /var/lib/kcy/debug-flags.json ] && grep -q '"scripts"[[:space:]]*:[[:space:]]*false' /var/lib/kcy/debug-flags.json; then
        return 0
    fi
    echo "[$(date '+%Y-%m-%dT%H:%M:%S')] [SSH-DISABLE] $*" >> "/var/www/html/last-errors/$1" 2>/dev/null
}
diag_log services-errors.log "10-disable-ssh-password.sh: started"

if [ "$EUID" -ne 0 ]; then
    echo "ERROR: трябва root. sudo bash $0"
    exit 1
fi

# Намери deploy потребителя и ключовете
DEPLOY_SSH="/home/deploy/.ssh"
ROOT_SSH="/root/.ssh"

echo ""
echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  ⚠  ОПАСНА ОПЕРАЦИЯ: Изключване на парола за SSH              ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Какво ще се случи:${NC}"
echo "  • Промяна на /etc/ssh/sshd_config: PasswordAuthentication no"
echo "  • Промяна на /etc/ssh/sshd_config: PermitRootLogin prohibit-password"
echo "  • Reload на sshd"
echo ""
echo -e "${YELLOW}След това можеш да влезеш САМО със SSH ключ.${NC}"
echo ""

# Безопасностни проверки
echo -e "${CYAN}Проверки преди продължаване:${NC}"
echo ""

# 1. Има ли deploy потребителя ключ?
DEPLOY_HAS_KEY=false
if [ -s "$DEPLOY_SSH/authorized_keys" ]; then
    KEY_COUNT=$(grep -c "^ssh-" "$DEPLOY_SSH/authorized_keys" 2>/dev/null || echo 0)
    if [ "$KEY_COUNT" -gt 0 ]; then
        DEPLOY_HAS_KEY=true
        echo -e "  ${GREEN}✓${NC} deploy потребителят има ${KEY_COUNT} SSH ключ(а)"
    fi
fi

if ! $DEPLOY_HAS_KEY; then
    echo -e "  ${RED}✗${NC} deploy потребителят НЯМА SSH ключ"
    echo ""
    echo -e "${RED}СПИРАМ.${NC} Изключването на парола без ключ ще те заключи навън!"
    echo ""
    echo "  Първо настрой ключ:"
    echo "    1. На твоя Windows: ssh-copy-id -p PORT deploy@SERVER"
    echo "    2. После пусни този скрипт отново."
    exit 1
fi

# 2. Recovery достъп?
echo ""
echo -e "${YELLOW}Имаш ли recovery достъп до тази машина?${NC}"
echo ""
echo "  Recovery достъп означава:"
echo "    • DigitalOcean droplet с droplet console"
echo "    • AWS instance с Session Manager или EC2 Instance Connect"
echo "    • Hetzner Cloud console"
echo "    • Физически достъп (за локални VM-та през VirtualBox)"
echo ""
echo "  ${RED}БЕЗ recovery достъп — ако загубиш ключа, машината е загубена!${NC}"
echo ""
read -p "  Имаш ли recovery достъп? [y/N]: " HAS_RECOVERY
if [ "$HAS_RECOVERY" != "y" ] && [ "$HAS_RECOVERY" != "Y" ]; then
    echo ""
    echo -e "${RED}СПИРАМ.${NC} Без recovery достъп това е твърде рисковано."
    echo ""
    echo "  Препоръка: остави password auth включен."
    echo "  Силна парола + fail2ban + SSH порт ≠ 22 = достатъчна защита за typical use."
    exit 1
fi

# 3. Тест от друга машина
echo ""
echo -e "${YELLOW}Преди да продължа — увери се че SSH ключът работи!${NC}"
echo ""
echo "  Отвори ВТОРИ Git Bash прозорец и тествай:"
echo "    ${CYAN}ssh -p \$PORT deploy@\$SERVER 'echo TEST OK'${NC}"
echo ""
echo "  Ако върне 'TEST OK' БЕЗ да пита парола — ключът работи."
echo ""
read -p "  Тества ли успешно ключа от друга сесия? [y/N]: " TESTED
if [ "$TESTED" != "y" ] && [ "$TESTED" != "Y" ]; then
    echo ""
    echo -e "${RED}СПИРАМ.${NC} Първо тествай ключа в друга сесия!"
    exit 1
fi

# 4. Двойно потвърждение
echo ""
echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
echo -e "${RED}  ДВОЙНО ПОТВЪРЖДЕНИЕ${NC}"
echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Стъпка 1 от 2:${NC}"
read -p "  Сигурен ли си? Напиши 'yes': " CONF1
if [ "$CONF1" != "yes" ]; then
    echo "Отказано (стъпка 1). Нищо не е променено."
    exit 0
fi

echo ""
echo -e "${YELLOW}Стъпка 2 от 2 (anti-typo защита):${NC}"
echo "  Сега напиши 'no' — да, NO — за финално потвърждение."
echo "  (Това е double-check срещу случайно натискане.)"
read -p "  Напиши 'no': " CONF2
if [ "$CONF2" != "no" ]; then
    echo "Отказано (стъпка 2). Нищо не е променено."
    exit 0
fi

# Изпълни промяната
echo ""
echo -e "${CYAN}Прилагам промяната...${NC}"

BACKUP="/etc/ssh/sshd_config.bak.$(date +%s)"
cp /etc/ssh/sshd_config "$BACKUP"
echo -e "  ${GREEN}✓${NC} Backup: ${BACKUP}"

sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config

# Тест на syntax преди reload
if sshd -t 2>/dev/null; then
    systemctl reload ssh 2>/dev/null || systemctl reload sshd
    echo -e "  ${GREEN}✓${NC} sshd reloaded — password auth изключен"
else
    echo -e "  ${RED}✗${NC} sshd config грешка! Връщам backup-а."
    cp "$BACKUP" /etc/ssh/sshd_config
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Password authentication изключен                            ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║  Можеш да влизаш САМО със SSH ключ.                            ║${NC}"
echo -e "${GREEN}║  Backup на стария config: ${BACKUP}     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}За да върнеш парола обратно:${NC}"
echo "  sudo cp ${BACKUP} /etc/ssh/sshd_config"
echo "  sudo systemctl reload ssh"
echo ""
