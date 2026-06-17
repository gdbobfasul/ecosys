#!/bin/bash
# Version: 1.0204
##############################################################################
# KCY — Приложи/обнови sudoers whitelist на сървъра.
# Пита кой сървър → изпълнява 03-kcy-admin-sudo.sh (вече инсталиран от Deploy).
# 03 е whitelist-нат за deploy → не иска парола.
#   ./deploy-scripts/update-sudoers.sh [target]
##############################################################################
trap 'echo ""; echo "Натисни Enter за затваряне..."; read DUMMY' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
STAGING="/var/www/deploy"
# 03 живее в staging (deploy го owns; пуска се със sudo оттам — whitelist-нат път)
REMOTE_SCRIPT="${STAGING}/deploy-scripts/server/03-kcy-admin-sudo.sh"

[ -f .deploy-targets ] && source .deploy-targets
list_targets() { [ -f .deploy-targets ] && grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u; }

SERVER=""; USER=""; PORT=""
TNAME="$1"
if [ -z "$TNAME" ]; then
    echo ""; echo "  На кой сървър да приложа sudoers whitelist-а?"
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

echo ""; echo -e "  Target:  ${GREEN}${USER}@${SERVER}:${PORT}${NC}"
echo -e "  Действие: прилагам sudoers whitelist (03-kcy-admin-sudo.sh)"
echo ""
echo ""

# deploy owns /var/www/deploy → качваме актуалните deploy-scripts там (без sudo),
# после пускаме 03 от staging (whitelist-нат път). Един път, без гадаене.
TARN="kcy-ds-$(date +%Y%m%d-%H%M%S).tar.gz"
TAR="${HOME}/${TARN}"
tar -czf "$TAR" deploy-scripts 2>/dev/null
ssh -o ConnectTimeout=90 -p ${PORT} "${USER}@${SERVER}" "mkdir -p ${STAGING}" 2>/dev/null
scp -o ConnectTimeout=90 -P ${PORT} -q "$TAR" "${USER}@${SERVER}:${STAGING}/${TARN}"
ssh -t -o ConnectTimeout=90 -p ${PORT} "${USER}@${SERVER}" "
    set -e
    cd ${STAGING}
    tar -xzf '${TARN}' deploy-scripts 2>/dev/null || tar -xzf '${TARN}'
    rm -f '${TARN}'
    find deploy-scripts -name '*.sh' -exec sed -i 's/\r\$//' {} + 2>/dev/null || true
    chmod +x deploy-scripts/server/*.sh 2>/dev/null || true
    sudo ${REMOTE_SCRIPT}
"
RC=$?
rm -f "$TAR"
echo ""
if [ $RC -eq 0 ]; then
    echo -e "${GREEN}✓ ГОТОВО — sudoers whitelist приложен. Опции 3 и 4 вече работят без парола.${NC}"
else
    echo -e "${RED}✗ Грешка (${RC}).${NC}"
    echo -e "${YELLOW}  Ако иска и отказва парола: deploy няма sudo за 03 → нужен е първоначален пълен sudo (kcy-admin).${NC}"
fi
