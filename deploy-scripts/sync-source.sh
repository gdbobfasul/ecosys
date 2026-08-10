#!/bin/bash
# Version: 1.0204
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

# Подготви задължителните документи (генерирай + събери в public/privacy) — ЕДНО място (2/4/5/57).
# Пътуват в архива, а 14-sync-source (root) ги слага в /var/www/html/privacy при overlay.
[ -f deploy-scripts/prepare-legal-docs.sh ] && bash deploy-scripts/prepare-legal-docs.sh || true

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
# Анти-fail2ban: пинваме САМО deploy ключа (IdentitiesOnly) — иначе ssh-agent предлага
# всички ключове → "too many authentication failures" → fail2ban банва IP-то.
KEYOPT=""; [ -f "$HOME/.ssh/id_ed25519" ] && KEYOPT="-o IdentitiesOnly=yes -i $HOME/.ssh/id_ed25519"
SSH="ssh $KEYOPT -o ConnectTimeout=90 -o ServerAliveInterval=30 -p ${PORT}"
SCP="scp $KEYOPT -o ConnectTimeout=90 -P ${PORT}"

echo ""; echo -e "  Target:  ${GREEN}${USER}@${SERVER}:${PORT}${NC}"
echo -e "  Режим:   ${GREEN}само СОРС${NC} (без assets/данни), overlay + рестарт"
echo ""

# ── архив само със сорс (БЕЗ public/assets...), С водеща папка — точно като Deploy (04) ──
TAR="${HOME}/kcy-source-$(date +%Y%m%d-%H%M%S).tar.gz"
echo -e "${YELLOW}[1/3] Архивиране на сорса...${NC}"
_APPEXC=""
if [ -n "${KCY_APPS_ONLY:-}" ]; then
    _APPEXC="$(mktemp 2>/dev/null || echo "$HOME/.kcy-appexc.$$")"
    bash deploy-scripts/lib/app-excludes.sh > "$_APPEXC" 2>/dev/null || true
    echo -e "  ${CYAN}Ограничавам до приложения: ${KCY_APPS_ONLY}${NC}"
fi
tar -czf "$TAR" \
    ${_APPEXC:+--exclude-from=$_APPEXC} \
    --exclude='public/assets' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='rustore' --exclude='huawei' --exclude='desktop' \
    --exclude='node_modules2' --exclude='patch' \
    --exclude='*.apk' --exclude='*.aab' --exclude='*.exe' \
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
# Твърд таймаут на прехвърляне (портируемо за Git Bash — без `timeout` бинарника):
# ако scp „увисне", убиваме го и минаваме на следващ опит вместо да виси до безкрай.
run_with_timeout() {
    local secs="$1"; shift
    "$@" &
    local cmd_pid=$!
    ( sleep "$secs"; kill -TERM "$cmd_pid" 2>/dev/null; sleep 3; kill -KILL "$cmd_pid" 2>/dev/null ) &
    local killer=$!
    wait "$cmd_pid"; local rc=$?
    kill -TERM "$killer" 2>/dev/null; wait "$killer" 2>/dev/null
    return $rc
}
TAR_BYTES=$(wc -c < "$TAR" 2>/dev/null || echo 0)
XFER_TIMEOUT="${KCY_SCP_TIMEOUT:-$(( TAR_BYTES/50000 + 120 ))}"
[ "$XFER_TIMEOUT" -lt 240 ] && XFER_TIMEOUT=240
[ "$XFER_TIMEOUT" -gt 1200 ] && XFER_TIMEOUT=1200
OK=false
for a in 1 2 3 4; do run_with_timeout "$XFER_TIMEOUT" $SCP "$TAR" "${USER}@${SERVER}:${REMOTE_TAR}" && { OK=true; break; }; echo "  опит $a неуспешен (грешка/увисна над ${XFER_TIMEOUT}с), чакам 15с..."; sleep 15; done
$OK || { echo -e "${RED}scp се провали${NC}"; rm -f "$TAR"; exit 1; }
echo -e "  ${GREEN}✓ Качено${NC}"

# .env — качваме и него (опция 5 вече носи .env, като пълния деплой). Праща се ОТДЕЛНО от
# архива, в дедикиран staging път; сървърът (14-sync-source.sh) го прилага върху живия .env
# с бекъп на стария (source of truth). Ако липсва локално → сървърният остава непокътнат.
LOCAL_ENV="$PROJECT_ROOT/private/configs/.env"
if [ -f "$LOCAL_ENV" ]; then
    if $SCP "$LOCAL_ENV" "${USER}@${SERVER}:${STAGING}/_sync_env" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ .env качен (ще се приложи с бекъп на стария)${NC}"
    else
        echo -e "  ${YELLOW}! .env не се качи — сървърният .env остава непокътнат${NC}"
    fi
fi

# ── активиране ──
# 14-sync-source.sh вече е инсталиран на сървъра (Deploy го слага в kcy-ecosystem)
# и е whitelist-нат. Просто му подаваме качения архив — той сам разархивира и прави overlay.
echo -e "${YELLOW}[3/3] Прилагане на сървъра (overlay + рестарт)...${NC}"
ssh -t $KEYOPT -o ConnectTimeout=90 -p ${PORT} "${USER}@${SERVER}" "sudo ${REMOTE_SCRIPT} '${REMOTE_TAR}'"
RC=$?
rm -f "$TAR"
echo ""
if [ $RC -eq 0 ]; then
    echo -e "${GREEN}✓ ГОТОВО — сорсът и .env са прехвърлени, сървисите рестартирани.${NC}"
    # Проверка НАКРАЯ: правните документи важат ли ОНЛАЙН (200 + на ТОВА приложение, не чужди)?
    if [ -f deploy-scripts/check-legal-links.mjs ] && command -v node >/dev/null 2>&1; then
        echo ""
        echo -e "${CYAN}  ━━━ Правни документи (Privacy/Terms) — онлайн проверка ━━━${NC}"
        node deploy-scripts/check-legal-links.mjs || echo -e "  ${RED}⚠ правни документи с проблем — виж горе (пусни точка 4/33 и провери пак)${NC}"
    fi
    # Проверка НАКРАЯ и за сървисите на ВСИЧКИ приложения (живи ли са бекендите).
    if [ -f deploy-scripts/check-all-app-services.mjs ] && command -v node >/dev/null 2>&1; then
        echo ""
        echo -e "${CYAN}  ━━━ Сървиси на приложенията — живи ли са ━━━${NC}"
        node deploy-scripts/check-all-app-services.mjs || echo -e "  ${RED}⚠ очакван сървис е ДОЛУ — виж горе${NC}"
    fi
    echo ""
    echo -e "${CYAN}  .env също се синхронизира с тази опция (върху живия, с бекъп на стария → .replaced-*).${NC}"
    echo -e "${CYAN}  Тоест промени в ключове/пароли/DB настройки влизат и оттук — не е нужна отделна опция 4.${NC}"
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
