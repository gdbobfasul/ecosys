#!/bin/bash
# Version: 1.0172
##############################################################################
# KCY Ecosystem — ПЪЛНА ИНСТАЛАЦИЯ на нов сървър (едно действие)
#
# Последователност:
#   1) deploy (код + .env [+ асети по избор]) през 04-deploy → 05-server-install
#      (вдига chat/eco3/portals; npm install автоматично — БЕЗ питане)
#   2) бази House-Look-Book + WhereNoBiz (по избор DROP — трие и създава от 0)
#   3) услуги House-Look-Book + WhereNoBiz (systemd + nginx)
#   4) токен монитори (token / brch1 / multisig)
#
# Пита само 2 неща:
#   • "Да кача и асети?"      (дефолт Enter = НЕ)
#   • "Drop Databases?"       (дефолт Enter = НЕ изтрива базите)
#
# Стартира се от менюто (опция 2) или ръчно:
#   ./deploy-scripts/02-full-install.sh [target]
##############################################################################

# Прозорецът винаги остава отворен при грешка
trap 'echo ""; echo "Натисни Enter за затваряне..."; read _DUMMY' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; NC=$'\033[0m'

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   ПЪЛНА ИНСТАЛАЦИЯ на нов сървър              ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "  Качва кода + .env, прави npm install, създава базите,"
echo "  вдига всички услуги (chat/eco3/portals + HLB/WNB) и токен мониторите."
echo ""

# ── Избор на target (от .deploy-targets или ръчно) ──
[ -f .deploy-targets ] && . .deploy-targets
SRV=""; USR=""; PRT=""
declare -a DT=(); IDX=1
if [ -f .deploy-targets ]; then
    for t in $(grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u); do
        s_var="TARGET_${t}_SERVER"; u_var="TARGET_${t}_USER"; p_var="TARGET_${t}_PORT"
        echo -e "    $IDX) ${GREEN}$t${NC}  (${!u_var:-deploy}@${!s_var}:${!p_var:-22})"
        DT[$IDX]="$t"; IDX=$((IDX+1))
    done
fi
echo -e "    $IDX) ${GREEN}custom${NC} — ръчно server / user / port"
CUSTOM_IDX=$IDX
echo ""

# Ако е подаден target като аргумент — ползвай го директно
if [ -n "$1" ] && [ -n "$(eval echo \${TARGET_${1}_SERVER:-})" ]; then
    t="$1"; s_var="TARGET_${t}_SERVER"; u_var="TARGET_${t}_USER"; p_var="TARGET_${t}_PORT"
    SRV="${!s_var}"; USR="${!u_var:-deploy}"; PRT="${!p_var:-22}"
else
    read -p "  Избери сървър [1-${IDX}]: " PICK
    [ -z "$PICK" ] && { echo "  Отказано."; exit 1; }
    if [ "$PICK" = "$CUSTOM_IDX" ]; then
        read -p "  Server (IP/hostname): " SRV
        read -p "  Username: " USR
        read -p "  SSH port: " PRT
    elif [ -n "${DT[$PICK]}" ]; then
        t="${DT[$PICK]}"; s_var="TARGET_${t}_SERVER"; u_var="TARGET_${t}_USER"; p_var="TARGET_${t}_PORT"
        SRV="${!s_var}"; USR="${!u_var:-deploy}"; PRT="${!p_var:-22}"
    else
        echo "  Невалиден избор."; exit 1
    fi
fi
[ -z "$USR" ] && USR=deploy
[ -z "$PRT" ] && PRT=22
[ -z "$SRV" ] && { echo "  Няма сървър."; exit 1; }

echo ""
echo -e "  Цел: ${GREEN}${USR}@${SRV}:${PRT}${NC}"
echo ""

# ── Двата въпроса ──
read -p "  Да кача и асети (видеа/картинки)? [y/N, Enter = НЕ]: " A_ASSETS
read -p "  Drop Databases — трия ВСИЧКИ бази (chat/portals/eco3/HLB/WNB) и създавам от 0? [y/N, Enter = НЕ изтрива]: " A_DROP

WITH_ASSETS=0; case "${A_ASSETS,,}" in y|yes|да|д) WITH_ASSETS=1;; esac
DROP_DB=0; RESET=""; case "${A_DROP,,}" in y|yes|да|д) DROP_DB=1; RESET=" --reset";; esac

echo ""
echo -e "  ${YELLOW}Асети: $([ "$WITH_ASSETS" = 1 ] && echo 'ДА (качват се с кода)' || echo 'не')   ·   Drop бази: $([ "$DROP_DB" = 1 ] && echo 'ДА (всички, от 0)' || echo 'НЕ (запазва данните)')${NC}"

SSH_OPTS="-o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -p ${PRT}"
REMOTE_BASE="/var/www/deploy/deploy-scripts/server"
PROJECT_DIR="/var/www/kcy-ecosystem"

step()  { echo ""; echo -e "${BOLD}${CYAN}━━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo ""; }
rstep() { # дистанционна стъпка с проверка на изхода
    local label="$1"; shift
    echo -e "  ${CYAN}→ ${label}${NC}"
    if ssh -t $SSH_OPTS "${USR}@${SRV}" "$*"; then
        echo -e "  ${GREEN}✓ ${label}${NC}"
    else
        echo -e "  ${RED}✗ ${label} — грешка (виж изхода по-горе). Продължавам нататък.${NC}"
    fi
}

# ══ 1/4  DEPLOY (код+.env [+асети], npm авто, бази chat/portals/eco3 [+DROP], chat/eco3/portals услуги) ══
step "1/4  Deploy + npm + бази chat/portals/eco3${RESET:+ (DROP)} + услуги chat/eco3/portals"
if ! KCY_AUTO_NPM=1 KCY_WITH_ASSETS=$WITH_ASSETS KCY_DROP_DB=$DROP_DB DEPLOY_NO_PAUSE=1 \
        bash ./deploy-scripts/04-deploy.sh "$SRV" "$USR" "$PRT"; then
    echo -e "${RED}✗ Deploy-ът се провали — спирам пълната инсталация.${NC}"
    exit 1
fi

# ══ 2/4  БАЗИ House-Look-Book + WhereNoBiz ══
step "2/4  Бази House-Look-Book + WhereNoBiz${RESET:+   (DROP — създава от 0)}"
rstep "HLB база (houselookbook)" "sudo ${REMOTE_BASE}/16-setup-app-databases.sh houselookbook${RESET}"
rstep "WNB база (wherenobiz)"     "sudo ${REMOTE_BASE}/17-setup-wherenobiz-database.sh${RESET}"

# Веднага щом базите + таблиците са готови → СЪЗДАВАМ/ОБНОВЯВАМ админите и модераторите
# от .env. Това е работа с БАЗАТА (тук, не при старта на услугата). Извиквам директно
# съществуващата попълваща логика на всяко приложение — нищо не се копира като файл.
# HLB/WNB (PostgreSQL) → db.seedAdminsAndMods през node -e (като root, само DB достъп).
# ECO-3 (SQLite eco3.db, готова от стъпка 1) → admins.js като kcy-eco3 (за правата на файла).
rstep "HLB админи/модератори от .env" "cd ${PROJECT_DIR}/private/House-Look-Book && sudo node -e 'require(\"./db\").seedAdminsAndMods().then(()=>{console.log(\"HLB админи/модератори готови\");process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})'"
rstep "WNB админи/модератори от .env" "cd ${PROJECT_DIR}/private/WhereNoBiz && sudo node -e 'require(\"./db\").seedAdminsAndMods().then(()=>{console.log(\"WNB админи/модератори готови\");process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})'"
rstep "ECO-3 админи/модератори от .env" "cd ${PROJECT_DIR}/private/eco-3 && sudo -u kcy-eco3 node admins.js"

# ══ 3/4  УСЛУГИ House-Look-Book + WhereNoBiz ══
step "3/4  Услуги House-Look-Book + WhereNoBiz (systemd + nginx)"
rstep "HLB услуга (kcy-hlb)" "sudo ${REMOTE_BASE}/18-setup-houselookbook-service.sh"
rstep "WNB услуга (kcy-wnb)" "sudo ${REMOTE_BASE}/19-setup-wherenobiz-service.sh"

# ══ 4/4  ТОКЕН МОНИТОРИ ══
step "4/4  Токен монитори (token / brch1 / multisig)"
for k in token brch1 multisig; do
    rstep "монитор ${k} (kcy-tokmon-${k})" "sudo ${REMOTE_BASE}/31-setup-token-monitor.sh ${k}"
done

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ ПЪЛНАТА ИНСТАЛАЦИЯ ЗАВЪРШИ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Услуги:   ${CYAN}kcy-chat, kcy-eco3, kcy-portals, kcy-hlb, kcy-wnb${NC}"
echo -e "  Монитори: ${CYAN}kcy-tokmon-token, kcy-tokmon-brch1, kcy-tokmon-multisig${NC}"
echo -e "            (чакат адрес на токена в .env — бездействат докато не го впишеш)"
echo ""
echo -e "  Следва (по желание): опция 33 — домейн/SSL (nginx + Let's Encrypt)."
echo ""
