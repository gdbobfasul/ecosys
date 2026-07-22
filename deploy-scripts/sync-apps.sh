#!/bin/bash
# Version: 1.0001
##############################################################################
# Pupikes — Прехвърли САМО приложенията (папката apk/: каталог + инсталационни
# файлове) към ЕДИН ИЛИ ПОВЕЧЕ сървъра, последователно. Архивира веднъж, качва
# към всеки target, активира през whitelist-нат сървърен приемник (17-sync-apps.sh)
# → overlay в /var/www/html/apk. БЕЗ рестарт (nginx сервира статично).
#
#   ./deploy-scripts/sync-apps.sh                 # пита (пресети: prod+vm, prod+…)
#   ./deploy-scripts/sync-apps.sh prod vm         # директно към тези цели, последователно
##############################################################################
trap '[ -n "$KCY_NO_PAUSE" ] || { echo ""; echo "Натисни Enter за затваряне..."; read DUMMY; }' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
STAGING="/var/www/deploy"
PROJECT_DIR="/var/www/kcy-ecosystem"
REMOTE_SCRIPT="${PROJECT_DIR}/deploy-scripts/server/17-sync-apps.sh"

[ -d apk ] || { echo -e "${RED}Няма папка apk/ в проекта — първо билдни приложенията.${NC}"; exit 1; }
[ -f apk/index.html ] || echo -e "${YELLOW}! няма apk/index.html (каталожната страница) — качвам каквото има.${NC}"

[ -f .deploy-targets ] && source .deploy-targets
list_targets() { [ -f .deploy-targets ] && grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u; }
have_target() { local v="TARGET_${1}_SERVER"; [ -n "${!v}" ]; }

# ── избор на цели ──
declare -a TARGETS=()
if [ "$#" -gt 0 ]; then
    TARGETS=("$@")                                  # подадени наготово (напр. от билда)
else
    echo ""; echo "  Къде да кача приложенията (2 последователни места)?"
    echo "    1) production + виртуалната машина"
    echo "    2) production + Tailscale (частен път)"
    echo "    3) само production"
    echo "    4) само виртуалната машина"
    echo "    5) отказ"
    echo ""; read -p "  Избери [1-5]: " PICK
    case "$PICK" in
        1) TARGETS=(prod vm) ;;
        2) TARGETS=(prod prodts) ;;
        3) TARGETS=(prod) ;;
        4) TARGETS=(vm) ;;
        *) echo "Отказано"; exit 0 ;;
    esac
fi

# махни несъществуващи цели (напр. ако vm/prodts не са конфигурирани)
declare -a VALID=()
for t in "${TARGETS[@]}"; do
    if have_target "$t"; then VALID+=("$t"); else echo -e "${YELLOW}! целта '$t' не е в .deploy-targets — пропускам${NC}"; fi
done
[ "${#VALID[@]}" -eq 0 ] && { echo -e "${RED}Няма валидна цел.${NC}"; exit 1; }

# ── архивирай apk/ веднъж. По подразбиране ЦЯЛАТА папка (каталог + всички инсталационни файлове).
#    Ако е зададен KCY_APPS_ONLY (имена, напр. "fps-hunter market-pulse") → само техните APK/EXE
#    + каталожните файлове (index/catalog/versions/лого — за да остане страницата консистентна). ──
TAR="${HOME}/pupikes-apps-$(date +%Y%m%d-%H%M%S).tar.gz"
echo ""; echo -e "${YELLOW}[1] Архивиране на apk/ ...${NC}"
if [ -n "$KCY_APPS_ONLY" ]; then
    declare -a FILES=()
    # Каталожни файлове (всичко в apk/ БЕЗ .apk/.exe) — винаги.
    while IFS= read -r f; do FILES+=("$f"); done < <(find apk -maxdepth 1 -type f ! -name '*.apk' ! -name '*.exe')
    # APK/EXE само на избраните имена (двата магазина + евентуален десктоп .exe).
    for nm in $KCY_APPS_ONLY; do
        while IFS= read -r f; do FILES+=("$f"); done < <(find apk -maxdepth 1 -type f \( -name "${nm}-*.apk" -o -name "${nm}-*.exe" \))
    done
    [ "${#FILES[@]}" -eq 0 ] && { echo -e "${RED}Няма файлове за избраните апове: $KCY_APPS_ONLY${NC}"; exit 1; }
    echo -e "  ${CYAN}само избрани: ${KCY_APPS_ONLY}${NC}"
    tar -czf "$TAR" "${FILES[@]}" || { echo -e "${RED}tar се провали${NC}"; exit 1; }
else
    tar -czf "$TAR" apk || { echo -e "${RED}tar се провали${NC}"; exit 1; }
fi
echo -e "  ${GREEN}✓ $(du -h "$TAR" | cut -f1)${NC}"

# ── качи към всяка цел последователно ──
FAILED=()
for TNAME in "${VALID[@]}"; do
    sv="TARGET_${TNAME}_SERVER"; uv="TARGET_${TNAME}_USER"; pv="TARGET_${TNAME}_PORT"; lv="TARGET_${TNAME}_LABEL"
    SERVER="${!sv}"; USER="${!uv:-deploy}"; PORT="${!pv:-2222}"
    echo ""; echo -e "${CYAN}══ $TNAME — ${!lv:-$TNAME} (${USER}@${SERVER}:${PORT}) ══${NC}"

    if ! timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${PORT}" 2>/dev/null; then
        for p in 22 2222; do timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${p}" 2>/dev/null && { PORT="$p"; break; }; done
    fi
    SSH="ssh -o ConnectTimeout=90 -o ServerAliveInterval=30 -p ${PORT}"
    SCP="scp -o ConnectTimeout=90 -P ${PORT}"

    echo -e "${YELLOW}  [2] Качване в staging...${NC}"
    if ! $SSH "${USER}@${SERVER}" "mkdir -p ${STAGING}"; then echo -e "${RED}  ✗ няма достъп до ${STAGING}${NC}"; FAILED+=("$TNAME"); continue; fi
    REMOTE_TAR="${STAGING}/$(basename "$TAR")"
    OK=false
    for a in 1 2 3 4; do $SCP "$TAR" "${USER}@${SERVER}:${REMOTE_TAR}" && { OK=true; break; }; echo "    опит $a неуспешен, чакам 5с..."; sleep 5; done
    if ! $OK; then echo -e "${RED}  ✗ scp се провали${NC}"; FAILED+=("$TNAME"); continue; fi

    echo -e "${YELLOW}  [3] Прилагане на сървъра (overlay в /var/www/html/apk)...${NC}"
    if ssh -t -o ConnectTimeout=90 -p ${PORT} "${USER}@${SERVER}" "sudo ${REMOTE_SCRIPT} '${REMOTE_TAR}'"; then
        echo -e "  ${GREEN}✓ $TNAME — приложенията са прехвърлени${NC}"
    else
        echo -e "  ${RED}✗ $TNAME — сървърната стъпка върна грешка${NC}"; FAILED+=("$TNAME")
    fi
done

rm -f "$TAR"
echo ""
if [ "${#FAILED[@]}" -eq 0 ]; then
    echo -e "${GREEN}✓ ГОТОВО — приложенията са качени на: ${VALID[*]}${NC}"
else
    echo -e "${RED}✗ Неуспешни: ${FAILED[*]}${NC}"
    echo -e "${YELLOW}  Ако иска и отказва парола (ПЪРВО ползване): пусни веднъж деплой на проекта + опцията за обновяване на правата (sudoers), после пак.${NC}"
fi
