#!/bin/bash
# Version: 1.0094
##############################################################################
# KCY — Прехвърли САМО АСЕТИ (public/assets: видеа, картинки, css).
# Един скрипт: пита сървър → качва архив → overlay на /var/www/html/assets.
# БЕЗ рестарт (nginx сервира статично), БЕЗ реконфигурация.
#   ./deploy-scripts/sync-assets.sh [target]
##############################################################################
trap 'echo ""; echo "Натисни Enter за затваряне..."; read DUMMY' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
STAGING="/var/www/deploy"
REMOTE_SCRIPT="${STAGING}/deploy-scripts/server/15-sync-assets.sh"

[ -d public/assets ] || { echo -e "${RED}Няма public/assets в проекта${NC}"; exit 1; }

# ── избор на target ──
[ -f .deploy-targets ] && source .deploy-targets
list_targets() { [ -f .deploy-targets ] && grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u; }

SERVER=""; USER=""; PORT=""
TNAME="$1"
if [ -z "$TNAME" ]; then
    echo ""; echo "  На кой сървър да прехвърля АСЕТИТЕ (видеа/картинки/css)?"
    IDX=1; declare -a ARR=()
    for t in $(list_targets); do
        sv="TARGET_${t}_SERVER"; lv="TARGET_${t}_LABEL"; pv="TARGET_${t}_PORT"
        echo "    $IDX) $t — ${!lv:-$t} (${!sv}:${!pv})"; ARR[$IDX]="$t"; IDX=$((IDX+1))
    done
    echo "    $IDX) custom (ръчно server/user/port)"; CI=$IDX
    echo ""; read -p "  Избери [1-${IDX}]: " PICK
    if [ "$PICK" = "$CI" ]; then
        read -p "  Server: " SERVER; read -p "  User: " USER; read -p "  Port: " PORT
    elif [ -n "${ARR[$PICK]}" ]; then TNAME="${ARR[$PICK]}"
    else echo "Отказано"; exit 0; fi
fi
if [ -n "$TNAME" ] && [ -z "$SERVER" ]; then
    sv="TARGET_${TNAME}_SERVER"; uv="TARGET_${TNAME}_USER"; pv="TARGET_${TNAME}_PORT"
    SERVER="${!sv}"; USER="${!uv}"; PORT="${!pv}"
fi
[ -z "$SERVER" ] && { echo "Няма сървър"; exit 1; }
USER="${USER:-deploy}"; PORT="${PORT:-2222}"

if ! timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${PORT}" 2>/dev/null; then
    for p in 22 2222; do timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${p}" 2>/dev/null && { PORT="$p"; break; }; done
fi
SSH="ssh -o ConnectTimeout=15 -o ServerAliveInterval=30 -p ${PORT}"
SCP="scp -o ConnectTimeout=15 -P ${PORT}"

echo ""; echo -e "  Target:  ${GREEN}${USER}@${SERVER}:${PORT}${NC}"
echo -e "  Режим:   ${GREEN}само АСЕТИ${NC} (public/assets), overlay, без рестарт"
echo ""

# ── архив с public/assets + deploy-scripts (последното е малко, нужно за staging на 15) ──
TAR="${HOME}/kcy-assets-$(date +%Y%m%d-%H%M%S).tar.gz"
echo -e "${YELLOW}[1/3] Архивиране на public/assets ($(du -sh public/assets | cut -f1))...${NC}"
tar -czf "$TAR" public/assets deploy-scripts || { echo -e "${RED}tar се провали${NC}"; exit 1; }
echo -e "  ${GREEN}✓ $(du -h "$TAR" | cut -f1)${NC}"

# ── качване ──
echo -e "${YELLOW}[2/3] Качване...${NC}"
$SSH "${USER}@${SERVER}" "mkdir -p ${STAGING}" || { echo -e "${RED}няма достъп до ${STAGING}${NC}"; rm -f "$TAR"; exit 1; }
REMOTE_TAR="${STAGING}/$(basename "$TAR")"
OK=false
for a in 1 2 3 4; do $SCP "$TAR" "${USER}@${SERVER}:${REMOTE_TAR}" && { OK=true; break; }; echo "  опит $a неуспешен, чакам 5с..."; sleep 5; done
$OK || { echo -e "${RED}scp се провали${NC}"; rm -f "$TAR"; exit 1; }
echo -e "  ${GREEN}✓ Качено${NC}"

# ── активиране ──
# deploy owns /var/www/deploy → разархивираме deploy-scripts там БЕЗ sudo (за да е наличен
# 15-sync-assets.sh — staging пътя, който е whitelist-нат). После го пускаме със sudo.
echo -e "${YELLOW}[3/3] Прилагане на сървъра (overlay в /var/www/html/assets)...${NC}"
ssh -t -o ConnectTimeout=15 -p ${PORT} "${USER}@${SERVER}" "
    set -e
    cd ${STAGING}
    rm -rf _extract; mkdir -p _extract
    tar -xzf '${REMOTE_TAR}' -C _extract deploy-scripts 2>/dev/null || true
    [ -d _extract/deploy-scripts ] && { rm -rf deploy-scripts; mv _extract/deploy-scripts deploy-scripts; }
    rm -rf _extract
    find deploy-scripts -name '*.sh' -exec sed -i 's/\r\$//' {} + 2>/dev/null || true
    chmod +x deploy-scripts/server/*.sh 2>/dev/null || true
    sudo ${REMOTE_SCRIPT} '${REMOTE_TAR}'
"
RC=$?
rm -f "$TAR"
echo ""
if [ $RC -eq 0 ]; then
    echo -e "${GREEN}✓ ГОТОВО — асетите са прехвърлени. Рестарт не е нужен.${NC}"
else
    echo -e "${RED}✗ Сървърната стъпка върна грешка (${RC}).${NC}"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Ако грешката е 'sudo: a password is required' — нормално е${NC}"
    echo -e "${YELLOW}  при ПЪРВО ползване. Този скрипт (15-sync-assets.sh) още не е${NC}"
    echo -e "${YELLOW}  разрешен без парола на сървъра. Направи това ВЕДНЪЖ:${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Пусни ${GREEN}2) Deploy проекта → prod${NC}"
    echo -e "     Това качва новите deploy-scripts/ на сървъра"
    echo -e "     (вкл. 14-sync-source.sh, 15-sync-assets.sh и обновения"
    echo -e "      03-kcy-admin-sudo.sh)."
    echo ""
    echo -e "  ${CYAN}2)${NC} После пусни ${GREEN}update на sudoers на сървъра${NC}"
    echo -e "     (в СТАРТ менюто е № ${GREEN}28${NC} — „Update sudoers на сървъра\")."
    echo ""
    echo -e "  ${CYAN}3)${NC} След това пусни пак ${GREEN}4) Прехвърли само АСЕТИ${NC} — вече без парола."
    echo ""
fi
