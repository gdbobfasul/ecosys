#!/bin/bash
# Version: 1.0202
##############################################################################
# KCY Ecosystem — Tailscale health-check (ADVISORY, ниско ниво)
#
# Проверява при ВСЕКИ деплой дали Tailscale:
#   1) е ИНСТАЛИРАН  (command -v tailscale)
#   2) РАБОТИ        (tailscale status → backend Running + logged in)
#   3) има IP        (tailscale ip -4)
#   4) вижда peer-а  (по избор: ping на подаден peer IP/host)
#
# НИКОГА не чупи деплоя — винаги връща 0. Само ПЕЧАТА ясен доклад + еднолинейна
# команда за поправка, ако нещо липсва. Закача се в края на сървърните деплой
# стъпки (14-sync-source.sh, 05-server-install.sh) — за да виждаш на всеки деплой
# дали failover линкът е жив.
#
# Usage (на сървъра):
#   bash tailscale-check.sh [peer_ip_or_host]
##############################################################################

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
PEER="${1:-}"
SETUP="sudo /var/www/kcy-ecosystem/deploy-scripts/server/11-setup-tailscale.sh"

echo ""
echo -e "${CYAN}─── Tailscale проверка (failover линк) ───────────────────────${NC}"

# 1) ИНСТАЛИРАН ли е?
if ! command -v tailscale >/dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠ Tailscale НЕ е инсталиран на тази машина.${NC}"
    echo -e "    Без него failover-ът (опция 37) и частният път между VM↔VPS не работят."
    echo -e "    Инсталирай го веднъж: ${CYAN}${SETUP}${NC}"
    echo -e "${CYAN}──────────────────────────────────────────────────────────────${NC}"
    exit 0
fi
echo -e "  ${GREEN}✓${NC} инсталиран: $(tailscale version 2>/dev/null | head -1)"

# 2) РАБОТИ ли (backend Running + влязъл)?
if ! tailscale status >/dev/null 2>&1; then
    # status дава ненулев код, когато демонът е спрян ИЛИ устройството е logged out
    STATE="$(tailscale status 2>&1 | head -1)"
    echo -e "  ${YELLOW}⚠ Tailscale е инсталиран, но НЕ е свързан${NC} (${STATE})."
    echo -e "    Вдигни/влез наново: ${CYAN}sudo tailscale up --accept-routes --ssh${NC}"
    echo -e "    (или цялата настройка: ${CYAN}${SETUP}${NC})"
    echo -e "${CYAN}──────────────────────────────────────────────────────────────${NC}"
    exit 0
fi

# 3) IP на това устройство
TS_IP="$(tailscale ip -4 2>/dev/null | head -1)"
if [ -n "$TS_IP" ]; then
    echo -e "  ${GREEN}✓${NC} свързан · this-IP: ${GREEN}${TS_IP}${NC}"
else
    echo -e "  ${YELLOW}⚠ свързан, но без IPv4 адрес — провери: ${CYAN}tailscale status${NC}"
fi

# Брой видими peer-и (други машини в твоята tailnet)
PEERS="$(tailscale status 2>/dev/null | grep -vc '^#')"
echo -e "  ${GREEN}✓${NC} видими редове в tailnet: ${PEERS}"

# 4) Достъп до конкретния peer (по избор) — другата машина за failover
if [ -n "$PEER" ]; then
    if tailscale ping -c 1 "$PEER" >/dev/null 2>&1 || ping -c 1 -W 2 "$PEER" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} peer ${PEER} е ДОСТЪПЕН през Tailscale"
    else
        echo -e "  ${YELLOW}⚠ peer ${PEER} НЕ отговаря${NC} — другата машина включена ли е и в tailnet?"
    fi
fi

echo -e "${CYAN}──────────────────────────────────────────────────────────────${NC}"
exit 0
