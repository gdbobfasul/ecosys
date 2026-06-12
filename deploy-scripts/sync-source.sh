#!/bin/bash
# Version: 1.0171
##############################################################################
# KCY — Прехвърли САМО СОРС (без видеа/картинки, без node_modules/.env/бази).
# Един скрипт: пита сървър → качва архив → overlay на живите папки → рестарт
# на node сървисите. БЕЗ npm install, БЕЗ реконфигурация.
#   ./deploy-scripts/sync-source.sh [target]
##############################################################################
trap 'echo ""; echo "Натисни Enter за затваряне..."; read DUMMY' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
STAGING="/var/www/deploy"
PROJECT_DIR="/var/www/kcy-ecosystem"
REMOTE_SCRIPT="${PROJECT_DIR}/deploy-scripts/server/14-sync-source.sh"

# ── избор на target ──
[ -f .deploy-targets ] && source .deploy-targets
list_targets() { [ -f .deploy-targets ] && grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u; }

SERVER=""; USER=""; PORT=""
TNAME="$1"
if [ -z "$TNAME" ]; then
    echo ""; echo "  На кой сървър да прехвърля СОРСА?"
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
# лилав завършващ надпис при успех (prod→production, vm→virtual machine, друго→IP/хоста)
source "$(dirname "$0")/lib/banner.sh" 2>/dev/null && arm_done_banner "$TNAME" "$SERVER"

# бърз порт-чек (конфигуриран → 22 → 2222)
if ! timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${PORT}" 2>/dev/null; then
    for p in 22 2222; do timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${p}" 2>/dev/null && { PORT="$p"; break; }; done
fi
SSH="ssh -o ConnectTimeout=15 -o ServerAliveInterval=30 -p ${PORT}"
SCP="scp -o ConnectTimeout=15 -P ${PORT}"

echo ""; echo -e "  Target:  ${GREEN}${USER}@${SERVER}:${PORT}${NC}"
echo -e "  Режим:   ${GREEN}само СОРС${NC} (без assets/данни), overlay + рестарт"
echo ""

# ── архив само със сорс (БЕЗ public/assets...), С водеща папка — точно като Deploy (04) ──
TAR="${HOME}/kcy-source-$(date +%Y%m%d-%H%M%S).tar.gz"
echo -e "${YELLOW}[1/3] Архивиране на сорса...${NC}"
tar -czf "$TAR" \
    --exclude='public/assets' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' --exclude='.cache' --exclude='tmp' \
    --exclude='*.zip' --exclude='*.tar' --exclude='*.gz' --exclude='*.rar' \
    --exclude='.env' --exclude='*.env' \
    --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' --exclude='*.sqlite' \
    --exclude='private/configs/.env' \
    --exclude='*/uploads' --exclude='*/logs' \
    --exclude='private/*/cache' --exclude='private/*/artifacts' \
    -C "$(dirname "$PROJECT_ROOT")" "$(basename "$PROJECT_ROOT")" 2>/dev/null \
    || { echo -e "${RED}tar се провали${NC}"; exit 1; }
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
# 14-sync-source.sh вече е инсталиран на сървъра (Deploy го слага в kcy-ecosystem)
# и е whitelist-нат. Просто му подаваме качения архив — той сам разархивира и прави overlay.
echo -e "${YELLOW}[3/3] Прилагане на сървъра (overlay + рестарт)...${NC}"
ssh -t -o ConnectTimeout=15 -p ${PORT} "${USER}@${SERVER}" "sudo ${REMOTE_SCRIPT} '${REMOTE_TAR}'"
RC=$?
rm -f "$TAR"
echo ""
if [ $RC -eq 0 ]; then
    echo -e "${GREEN}✓ ГОТОВО — сорсът е прехвърлен и сървисите рестартирани.${NC}"
    echo ""
    echo -e "${YELLOW}⚠ .env НЕ се синхронизира с тази опция (изключен е нарочно).${NC}"
    echo -e "${YELLOW}  Ако си променил .env (админ/модератори, пароли, ключове, DB настройки)${NC}"
    echo -e "${YELLOW}  тези промени НЕ са влезли. Пусни от менюто ${GREEN}опция 4 (Deploy проекта)${NC}${YELLOW} — носи .env,${NC}"
    echo -e "${YELLOW}  после пак ${GREEN}опция 5 (Прехвърли само СОРС)${NC}${YELLOW} за рестарт. Само код-промени → нищо повече.${NC}"
else
    echo -e "${RED}✗ Сървърната стъпка върна грешка (${RC}).${NC}"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Ако грешката е 'sudo: a password is required' — нормално е${NC}"
    echo -e "${YELLOW}  при ПЪРВО ползване: опция 5 още не е разрешена без парола на${NC}"
    echo -e "${YELLOW}  сървъра. Направи това ВЕДНЪЖ от менюто:${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Пусни ${GREEN}опция 4 — Deploy проекта → prod${NC}"
    echo -e "     Това качва обновените деплой-настройки на сървъра."
    echo ""
    echo -e "  ${CYAN}2)${NC} После пусни ${GREEN}опция 30 — Update sudoers на сървъра${NC}."
    echo ""
    echo -e "  ${CYAN}3)${NC} След това пусни пак ${GREEN}опция 5 — Прехвърли само СОРС${NC} — вече без парола."
    echo ""
fi
