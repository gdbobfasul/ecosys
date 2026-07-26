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
    echo "  (production ВИНАГИ през Tailscale — стабилно; пада на публичния само ако TS е спрян)"
    echo "    1) само production (Tailscale) — препоръчано"
    echo "    2) production (Tailscale) + виртуалната машина"
    echo "    3) само виртуалната машина"
    echo "    5) отказ"
    echo ""; read -p "  Избери [1-3/5, Enter=1]: " PICK
    case "$PICK" in
        2) TARGETS=(prodts vm) ;;
        3) TARGETS=(vm) ;;
        5) echo "Отказано"; exit 0 ;;
        *) TARGETS=(prodts) ;;
    esac
fi

# махни несъществуващи цели (напр. ако vm/prodts не са конфигурирани)
declare -a VALID=()
for t in "${TARGETS[@]}"; do
    if have_target "$t"; then VALID+=("$t"); else echo -e "${YELLOW}! целта '$t' не е в .deploy-targets — пропускам${NC}"; fi
done
[ "${#VALID[@]}" -eq 0 ] && { echo -e "${RED}Няма валидна цел.${NC}"; exit 1; }

# ── ДЕЛТА КАЧВАНЕ (мащабируемо). НЕ тарваме всичко наведнъж (расте → таймаут при 2-4+ GB), а
#    качваме само ПРОМЕНЕНИТЕ/новите release файлове спрямо това, което сървърът ВЕЧЕ има
#    (сравнение по sha1 през ssh — без нужда от rsync на клиента). Дори при 10 GB общо, ако са
#    се сменили 2 апа → качват се само те. Каталожните файлове вървят ВИНАГИ (малки). DEBUG — никога.
#    Кандидати: release .apk (по slug при KCY_APPS_ONLY) + десктоп .exe.
WEB_APK="/var/www/html/apk"
declare -a CAND_CAT=() CAND_BIN=()
while IFS= read -r f; do CAND_CAT+=("$f"); done < <(find apk -maxdepth 1 -type f ! -name '*.apk' ! -name '*.exe')
if [ -n "$KCY_APPS_ONLY" ]; then
    for nm in $KCY_APPS_ONLY; do
        slug="$(node deploy-scripts/apk-slug.mjs "$nm" 2>/dev/null)"; [ -z "$slug" ] && slug="$nm"
        while IFS= read -r f; do CAND_BIN+=("$f"); done < <(find apk -maxdepth 1 -type f \( -name "${slug}-*-release.apk" -o -name "${nm}-*.exe" \))
    done
    echo -e "  ${CYAN}само избрани: ${KCY_APPS_ONLY}${NC}"
else
    while IFS= read -r f; do CAND_BIN+=("$f"); done < <(find apk -maxdepth 1 -type f \( -name '*-release.apk' -o -name '*.exe' \))
fi
# локални sha1 на бинарните кандидати (за сравнение със сървъра)
declare -A LH=()
for f in "${CAND_BIN[@]}"; do LH["$(basename "$f")"]="$(sha1sum "$f" | cut -d' ' -f1)"; done
echo ""; echo -e "  ${CYAN}[1] кандидати: ${#CAND_BIN[@]} release/exe + ${#CAND_CAT[@]} каталожни (качва се само делтата спрямо сървъра)${NC}"

# ── качи към всяка цел последователно ──
FAILED=()
for TNAME in "${VALID[@]}"; do
    sv="TARGET_${TNAME}_SERVER"; uv="TARGET_${TNAME}_USER"; pv="TARGET_${TNAME}_PORT"; lv="TARGET_${TNAME}_LABEL"
    SERVER="${!sv}"; USER="${!uv:-deploy}"; PORT="${!pv:-2222}"
    # production ВИНАГИ през Tailscale; ако TS е спрян (100.x недостъпен) → падни на публичния prod
    # (СЪЩИЯТ сървър, друг път). Така не удряме публичния fail2ban, освен когато няма избор.
    if [ "$TNAME" = "prodts" ] && ! timeout 4 bash -c "exec 3<>/dev/tcp/${SERVER}/${PORT}" 2>/dev/null; then
        if [ -n "${TARGET_prod_SERVER:-}" ]; then
            echo -e "  ${YELLOW}⚠ Tailscale (${SERVER}) недостъпен → падам на публичния път (${TARGET_prod_SERVER})${NC}"
            SERVER="${TARGET_prod_SERVER}"; USER="${TARGET_prod_USER:-deploy}"; PORT="${TARGET_prod_PORT:-2222}"
        fi
    fi
    echo ""; echo -e "${CYAN}══ $TNAME — ${!lv:-$TNAME} (${USER}@${SERVER}:${PORT}) ══${NC}"

    if ! timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${PORT}" 2>/dev/null; then
        for p in 22 2222; do timeout 3 bash -c "exec 3<>/dev/tcp/${SERVER}/${p}" 2>/dev/null && { PORT="$p"; break; }; done
    fi
    # keepalive държи връзката жива при мрежов трепет. (ControlMaster НЕ се ползва — този ssh на
    # Windows не мултиплексира надеждно. На Tailscale/VM няма fail2ban, тъй че файл-по-файл е ок.)
    SSH="ssh -o ConnectTimeout=90 -o ServerAliveInterval=30 -p ${PORT}"
    SCP="scp -o ConnectTimeout=90 -o ServerAliveInterval=15 -o ServerAliveCountMax=8 -o TCPKeepAlive=yes -P ${PORT}"

    if ! $SSH "${USER}@${SERVER}" "mkdir -p ${STAGING}"; then echo -e "${RED}  ✗ няма достъп до ${STAGING}${NC}"; FAILED+=("$TNAME"); continue; fi

    # ДЕЛТА: вземи sha1 на вече качените release/exe на ТОЗИ сървър, тарни само различните/новите.
    declare -A SH=(); while read -r _h _n; do [ -n "$_n" ] && SH["$_n"]="$_h"; done < <($SSH "${USER}@${SERVER}" "cd ${WEB_APK} 2>/dev/null && sha1sum *-release.apk *.exe 2>/dev/null" 2>/dev/null)
    declare -a FILES=("${CAND_CAT[@]}")
    for f in "${CAND_BIN[@]}"; do b="$(basename "$f")"; [ "${SH[$b]:-x}" = "${LH[$b]}" ] || FILES+=("$f"); done
    _nbin=$(( ${#FILES[@]} - ${#CAND_CAT[@]} ))
    echo -e "${YELLOW}  [2] Делта за ${TNAME}: ${_nbin} нови/променени release + ${#CAND_CAT[@]} каталожни${NC}"
    # Качваме ФАЙЛ ПО ФАЙЛ в staging папка (НЕ един голям тар): голям APK или мрежов трепет
    # проваля само СЕБЕ СИ (retry за файла), не целия трансфер. Каналът се държи жив (keepalive).
    # Липсналите файлове се доизкачат при следващо пускане (делтата пак ще ги включи).
    STAGE="${STAGING}/apk-stage"
    $SSH "${USER}@${SERVER}" "rm -rf '${STAGE}' && mkdir -p '${STAGE}/apk'" >/dev/null 2>&1
    # По-малките първо (каталог + леки апове) → бърз видим напредък; големите игри накрая.
    IFS=$'\n' FILES=($(for f in "${FILES[@]}"; do printf '%s\t%s\n' "$(stat -c%s "$f" 2>/dev/null || echo 0)" "$f"; done | sort -n | cut -f2-)); unset IFS
    ntot=${#FILES[@]}; ni=0; nfail=0
    echo -e "  ${CYAN}качвам ${ntot} файла ФАЙЛ ПО ФАЙЛ (големите APK отнемат време — прогрес по-долу)${NC}"
    for f in "${FILES[@]}"; do
        ni=$((ni+1)); b="$(basename "$f")"; sz="$(du -h "$f" 2>/dev/null | cut -f1)"; up=false
        echo -e "    ${CYAN}↑ [${ni}/${ntot}] ${b} (${sz})…${NC}"
        for a in 1 2 3; do $SCP "$f" "${USER}@${SERVER}:${STAGE}/apk/${b}" && { up=true; break; }; echo -e "      ${YELLOW}опит $a неуспешен, чакам 5с…${NC}"; sleep 5; done
        $up || { echo -e "      ${RED}✗ ${b} не се качи${NC}"; nfail=$((nfail+1)); }
    done
    [ "$nfail" -gt 0 ] && echo -e "  ${YELLOW}⚠ ${nfail} файла не се качиха — прилагам качените; липсващите ще се доизкачат при следващо пускане${NC}"

    # Сглоби apk/-архива НА СЪРВЪРА (бързо, локален диск) → подай на приемника. Така работи и със
    # СТАРИЯ приемник (очаква архив), без нужда от нов деплой. Само 1 малка ssh команда, не трансфер.
    REMOTE_TAR="${STAGING}/pupikes-apps-$(date +%s)-${TNAME}.tgz"
    if ! $SSH "${USER}@${SERVER}" "cd '${STAGE}' && tar czf '${REMOTE_TAR}' apk && rm -rf apk"; then
        echo -e "  ${RED}✗ $TNAME — сглобяването на архива на сървъра се провали${NC}"; FAILED+=("$TNAME"); continue
    fi

    echo -e "${YELLOW}  [3] Прилагане на сървъра (overlay в /var/www/html/apk)...${NC}"
    if ssh -t -o ConnectTimeout=90 -o ServerAliveInterval=15 -p ${PORT} "${USER}@${SERVER}" "sudo ${REMOTE_SCRIPT} '${REMOTE_TAR}'"; then
        if [ "$nfail" -eq 0 ]; then echo -e "  ${GREEN}✓ $TNAME — приложенията са прехвърлени${NC}"; else echo -e "  ${YELLOW}◑ $TNAME — частично (${nfail} липсват, пусни пак за тях)${NC}"; FAILED+=("$TNAME (частично)"); fi
    else
        echo -e "  ${RED}✗ $TNAME — сървърната стъпка върна грешка${NC}"; FAILED+=("$TNAME")
    fi
    $SSH "${USER}@${SERVER}" "rm -rf '${STAGE}'" >/dev/null 2>&1
done

echo ""
if [ "${#FAILED[@]}" -eq 0 ]; then
    echo -e "${GREEN}✓ ГОТОВО — приложенията са качени на: ${VALID[*]}${NC}"
else
    echo -e "${RED}✗ Неуспешни: ${FAILED[*]}${NC}"
    echo -e "${YELLOW}  Ако иска и отказва парола (ПЪРВО ползване): пусни веднъж деплой на проекта + опцията за обновяване на правата (sudoers), после пак.${NC}"
fi
