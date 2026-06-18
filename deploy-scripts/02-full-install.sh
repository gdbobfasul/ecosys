#!/bin/bash
# Version: 1.0218
##############################################################################
# KCY Ecosystem — ПЪЛНА ИНСТАЛАЦИЯ на нов сървър (едно действие)
#
# Последователност:
#   1) deploy (код + .env [+ асети по избор]) през 04-deploy → 05-server-install
#      (вдига chat/eco3/portals; npm install — ПИТА (дефолт Не); структурните въпроси са авто)
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
# Без EXIT-пауза — менюто (run_cmd) прави паузата накрая; не спираме между под-скриптовете.

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
# лилав завършващ надпис при успех (prod→production, vm→virtual machine, друго→IP/хоста)
source "$(dirname "$0")/lib/banner.sh" 2>/dev/null && arm_done_banner "$t" "$SRV"

echo ""
echo -e "  Цел: ${GREEN}${USR}@${SRV}:${PRT}${NC}"
echo -e "  ${CYAN}[checkpoint] Пълна инсталация започва: $(date '+%H:%M:%S') → ${SRV}${NC}"
echo ""

# ── Двата въпроса ──
read -p "  Да кача и асети (видеа/картинки)? [y/N, Enter = НЕ]: " A_ASSETS
read -p "  Drop Databases — трия ВСИЧКИ бази (chat/portals/eco3/HLB/WNB) и създавам от 0? [y/N, Enter = НЕ изтрива]: " A_DROP

WITH_ASSETS=0; case "${A_ASSETS,,}" in y|yes|да|д) WITH_ASSETS=1;; esac
DROP_DB=0; RESET=""; case "${A_DROP,,}" in y|yes|да|д) DROP_DB=1; RESET=" --reset";; esac

echo ""
A_LBL="не"; [ "$WITH_ASSETS" = 1 ] && A_LBL="ДА (качват се с кода)"
D_LBL="НЕ (запазва данните)"; [ "$DROP_DB" = 1 ] && D_LBL="ДА (всички, от 0)"
echo -e "  ${YELLOW}Асети: ${A_LBL}   ·   Drop бази: ${D_LBL}${NC}"

SSH_OPTS="-o ConnectTimeout=90 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -p ${PRT}"
# Анти-fail2ban: пинваме САМО deploy ключа (иначе agent-ът пробва всички → бан).
[ -f "$HOME/.ssh/id_ed25519" ] && SSH_OPTS="-o IdentitiesOnly=yes -i $HOME/.ssh/id_ed25519 $SSH_OPTS"
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

# ══ 1/5  DEPLOY (код+.env [+асети], npm ПИТА, бази chat/portals/eco3 [+DROP], chat/eco3/portals услуги) ══
step "1/5  Deploy + npm + бази chat/portals/eco3${RESET:+ (DROP)} + услуги chat/eco3/portals"
# KCY_IN_FULL_INSTALL=1 → 04 да НЕ възстановява failover тук (правим го накрая на 02, след услугите)
if ! KCY_AUTO_DEFAULTS=1 KCY_WITH_ASSETS=$WITH_ASSETS KCY_DROP_DB=$DROP_DB DEPLOY_NO_PAUSE=1 \
        KCY_SUPPRESS_DONE=1 KCY_IN_FULL_INSTALL=1 \
        bash ./deploy-scripts/04-deploy.sh "$SRV" "$USR" "$PRT"; then
    echo -e "${RED}✗ Deploy-ът се провали — спирам пълната инсталация.${NC}"
    exit 1
fi

# Чат админи/модератори от .env — ПАС 1/2 (веднага след качване на код+.env).
# Подсигурява акаунтите дори ако вътрешният пас в 05/07 е бил пропуснат (код/.env race).
rstep "Чат админи/модератори от .env (пас 1/2)" "sudo ${REMOTE_BASE}/07-setup-database.sh --admins-only"

# ══ 2/4  БАЗИ House-Look-Book + WhereNoBiz + Find Best Price ══
step "2/5  Бази House-Look-Book + WhereNoBiz + Find Best Price${RESET:+   (DROP — създава от 0)}"
rstep "HLB база (houselookbook)" "sudo ${REMOTE_BASE}/16-setup-app-databases.sh houselookbook${RESET}"
rstep "WNB база (wherenobiz)"     "sudo ${REMOTE_BASE}/17-setup-wherenobiz-database.sh${RESET}"
rstep "FBP база (findbestprice)"  "sudo ${REMOTE_BASE}/16-setup-app-databases.sh findbestprice${RESET}"

# Админите/модераторите от .env се попълват ВЪТРЕ в DB-скриптовете 16/17 (които вече
# вървят като root → не искат отделен `sudo node`, който не може да се whitelist-не безопасно).
# 16 houselookbook → HLB; 17 → WNB. Затова тук НЯМА отделни редове за HLB/WNB админи.

# ECO-3 (поддържа SQLite И PostgreSQL по ECO3_DB_TYPE) — един скрипт прави трите неща в ред:
# създава базата → попълва админи/модератори от .env → стартира kcy-eco3.
rstep "ECO-3 база + админи/модератори + услуга" "sudo ${REMOTE_BASE}/20-setup-eco3-database.sh${RESET}"

# ══ 3/4  УСЛУГИ House-Look-Book + WhereNoBiz + Find Best Price ══
step "3/5  Услуги House-Look-Book + WhereNoBiz + Find Best Price (systemd + nginx)"
rstep "HLB услуга (kcy-hlb)" "sudo ${REMOTE_BASE}/18-setup-houselookbook-service.sh"
rstep "WNB услуга (kcy-wnb)" "sudo ${REMOTE_BASE}/19-setup-wherenobiz-service.sh"
rstep "FBP услуга (kcy-fbp)" "sudo ${REMOTE_BASE}/21-setup-fbp-service.sh"

# ══ 4/5  ТОКЕН МОНИТОРИ ══
step "4/5  Токен монитори (token / brch1 / multisig)"
for k in token brch1 multisig; do
    rstep "монитор ${k} (kcy-tokmon-${k})" "sudo ${REMOTE_BASE}/31-setup-token-monitor.sh ${k}"
done

# ══ 5/5  FAILOVER — авто-възстановяване (ако е бил активен преди деплоя) ══
# ПОСЛЕДНО, след всички nginx промени (05/услуги/монитори), иначе 18/19 конфликтват.
step "5/5  Failover (авто-възстановяване, ако е бил активен)"
rstep "Failover restore" "sudo ${REMOTE_BASE}/12-setup-failover.sh --auto-restore"

# Чат админи/модератори от .env — ПАС 2/2 (НАКРАЯ: всичко е качено, услугите работят).
# Гарантира, че админът и модераторите на чата ще съществуват, дори ако пас 1 е пропуснат.
rstep "Чат админи/модератори от .env (пас 2/2)" "sudo ${REMOTE_BASE}/07-setup-database.sh --admins-only"

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
