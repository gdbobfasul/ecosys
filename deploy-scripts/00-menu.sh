#!/bin/bash
# Version: 1.0176
##############################################################################
# KCY Ecosystem — Start Menu
# Един menu item = един реален скрипт. Параметрите се питат след избор.
# Usage: ./deploy-scripts/00-menu.sh
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Домейни от ЕДИННАТА конфигурация (private/configs/domains.conf) — нищо хардкоднато.
[ -f "private/configs/domains.conf" ] && . "private/configs/domains.conf"
# Зареди deploy таргетите (адреси/портове) — за да се показват в пикерите (опция 3/4 и т.н.)
[ -f .deploy-targets ] && . .deploy-targets

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'
MAGENTA=$'\033[0;35m'; GRAY=$'\033[0;37m'
BOLD=$'\033[1m'; NC=$'\033[0m'

trap 'echo ""; echo "Натисни Enter за затваряне..."; read DUMMY' EXIT

press_enter() { echo ""; read -p "Натисни Enter да продължиш... " _; }
run_cmd()     { echo ""; echo -e "${YELLOW}► $*${NC}"; echo ""; "$@"; press_enter; }

# Избор на сървър (prod/vm/custom) от .deploy-targets — пази същия избор като опция 2/3.
# При успех сетва PICK_SRV / PICK_USER / PICK_PORT и връща 0; при отказ връща 1.
pick_target() {
    PICK_SRV=""; PICK_USER=""; PICK_PORT=""
    # Зареди TARGET_* променливите — иначе ${!s_var} indirect expansion връща празно.
    [ -f .deploy-targets ] && . .deploy-targets
    local IDX=1; local -a DT=()
    if [ -f .deploy-targets ]; then
        for t in $(grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u); do
            local s_var="TARGET_${t}_SERVER" u_var="TARGET_${t}_USER" p_var="TARGET_${t}_PORT" desc
            case "$t" in
                prod) desc="production сървър (живият сайт)";;
                vm)   desc="тестова виртуална машина";;
                *)    desc="$t";;
            esac
            echo -e "    $IDX) ${GREEN}$t${NC} — $desc  (${!u_var:-deploy}@${!s_var}:${!p_var:-22})" >&2
            DT[$IDX]="$t"; IDX=$((IDX+1))
        done
    fi
    echo -e "    $IDX) ${GREEN}custom${NC} — ръчно server/user/port" >&2
    local CUSTOM_IDX=$IDX PICK
    read -p "  Избери сървър [1-${IDX}]: " PICK
    [ -z "$PICK" ] && return 1
    if [ "$PICK" = "$CUSTOM_IDX" ]; then
        read -p "  Server (IP/hostname): " PICK_SRV
        read -p "  Username: " PICK_USER
        read -p "  SSH port: " PICK_PORT
    elif [ -n "${DT[$PICK]}" ]; then
        local t="${DT[$PICK]}" s_var u_var p_var
        s_var="TARGET_${t}_SERVER"; u_var="TARGET_${t}_USER"; p_var="TARGET_${t}_PORT"
        PICK_SRV="${!s_var}"; PICK_USER="${!u_var:-deploy}"; PICK_PORT="${!p_var:-22}"
    else
        return 1
    fi
    [ -z "$PICK_USER" ] && PICK_USER=deploy
    [ -z "$PICK_PORT" ] && PICK_PORT=22
    return 0
}

ask_choice() {
    local prompt="$1"; shift
    echo "" >&2
    echo "  $prompt" >&2
    local i=1
    local choices=("$@")
    for o in "${choices[@]}"; do echo "    $i) $o" >&2; i=$((i+1)); done
    echo "    0) Cancel" >&2
    read -p "    Избери [1-${#choices[@]}, 0]: " idx >&2
    if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le ${#choices[@]} ]; then
        echo "${choices[$((idx-1))]}"
    fi
}

# Print one menu item with 2-line description
item() {
    local num="$1"; local title="$2"; local desc1="$3"; local desc2="$4"; local note="$5"
    printf "  ${BOLD}%2s${NC})  %s\n" "$num" "$title"
    [ -n "$desc1" ] && echo -e "         ${GRAY}${desc1}${NC}"
    [ -n "$desc2" ] && echo -e "         ${GRAY}${desc2}${NC}"
    [ -n "$note" ] && echo -e "         ${YELLOW}${note}${NC}"
    echo ""
}

show_menu() {
    clear
    echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║         KCY Ecosystem — Admin Menu        $(date '+%Y-%m-%d %H:%M:%S')          ║${NC}"
    echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}${CYAN}━━━ DEPLOY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item " 1" "Bootstrap нов сървър + deploy" \
        "Изпълнява се ЕДИН път при нов VPS/VM. Генерира SSH ключ на Windows," \
        "копира го на сървъра, инсталира пакети, накрая пита да направи deploy."
    item " 2" "ПЪЛНА ИНСТАЛАЦИЯ на нов сървър" \
        "Едно действие: deploy (код+.env) → npm install (пита, дефолт Не) → бази → услуги" \
        "(chat/eco3/portals + HLB/WNB) → токен монитори. Пита само: асети? Drop бази?" \
        "За нов сървър или пълно пресъздаване от 0."
    item " 4" "Deploy проекта" \
        "Архивира кода, качва на сървъра, разархивира, активира на production място." \
        "Извиква се при всяка промяна. След избор пита за target: vm / prod / custom." \
        "Презаписва стария .env."
    item " 5" "Прехвърли само СОРС (бърз)" \
        "Качва само кода (без видеа/картинки, без npm/реконфигурация) и рестартира" \
        "node сървисите (chat/eco3/portals/hlb/wnb + kcy-diag). Пита кой сървър. Overlay — не трие работещото."
    item " 6" "Прехвърли само АСЕТИ (видеа/картинки/css)" \
        "Качва само public/assets към живия web root. Пита кой сървър." \
        "Без рестарт, без реконфигурация — nginx сервира статично."

    item " 3" "SSH връзка към сървър (директно)" \
        "Отваря интерактивна SSH сесия в терминала. След избор питам коя машина:" \
        "1) прод — root@take.offbitch.com:2222   2) VM — deploy@192.168.0.108:2222 (ключ id_ed25519)."

    # (Новите приложения House-Look-Book / WhereNoBiz са на 41–44 по-долу.)

    echo -e "${BOLD}${CYAN}━━━ DATABASES (локални) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item " 7" "Init Portal база данни" \
        "Създава portals.db с 4 таблици: users, payments, scores, jobs." \
        "Безопасно за повторно изпълнение (CREATE IF NOT EXISTS)."
    item " 8" "Init ECO-3 база данни" \
        "Създава eco3.db за AI Studio. Schema-та е дефинирана в private/eco-3/database/." \
        "Auto-създава се и при стартиране на eco-3 сървъра."
    item " 9" "Portal DB stats" \
        "Показва списък на таблиците и брой записи във всяка." \
        "Read-only — само за информация."
    item "10" "Chat DB migrations" \
        "Прилага pending migrations за chat базата (нови таблици/колони)." \
        "Безопасно — пропуска вече приложени миграции."

    echo -e "${BOLD}${CYAN}━━━ SMART CONTRACTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "11" "Compile contracts" \
        "Компилира Solidity контрактите → ABI + bytecode в artifacts/." \
        "Избор: всички / само KCY token / само BRCH1 token."
    item "12" "Deploy KCY token (mainnet)" \
        "Деплойва KCY-meme-1 token на BSC Mainnet. ⚠ Харчи реален BNB за gas." \
        "Изисква 'DEPLOY' confirm. Изпълни се само веднъж в живота на токена."
    item "13" "Deploy Multi-Sig (mainnet)" \
        "Деплойва Multi-Sig wallet contract на BSC Mainnet. ⚠ Харчи реален BNB." \
        "Изисква 'DEPLOY' confirm. След това адресът се записва в production .env."
    item "14" "Deploy BRCH1 token" \
        "Деплойва BeRicH 1 (BRCH1) token. testnet = безплатно (фалшив BNB)." \
        "mainnet = реален BNB за gas. След избор пита коя мрежа."
    item "15" "Verify BRCH1 on BscScan" \
        "Качва source code на контракта в BscScan за публична проверка." \
        "Без verify, BscScan показва само bytecode. След избор пита коя мрежа."

    echo -e "${BOLD}${CYAN}━━━ TESTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "16" "Run tests" \
        "Изпълнява jest unit тестове. След избор пита кой test suite:" \
        "all (всички) / token / multisig / chat / mobile / portals / portals smoke (bash)."

    echo -e "${BOLD}${CYAN}━━━ SERVICES (локален dev) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "17" "Start chat service" \
        "Стартира chat backend локално на порт 3000." \
        "След избор пита: prod (node, без auto-reload) или dev (nodemon)."
    item "18" "Start eco-3 service" \
        "Стартира ECO-3 AI Studio backend локално на порт 3001." \
        "След избор пита: prod (node) или dev (nodemon)."
    item "19" "Start all services" \
        "Стартира chat + eco-3 паралелно в един процес (background)." \
        "Удобно за интегрални тестове. Ctrl+C спира двете заедно."

    echo -e "${BOLD}${CYAN}━━━ EXPORT / BACKUP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "20" "Archive проекта" \
        "Създава tar.gz архив в \$HOME с целия проект (без node_modules, artifacts, cache)." \
        "Полезно преди риско́ва операция (миграция, refactor)."
    item "21" "SQLite DB → SQL dump" \
        "Експортира portal.db и eco3.db като .sql файлове в \$HOME/kcy-db-backup/." \
        "SQL dump-овете могат да се възстановят с 'sqlite3 db.sqlite < dump.sql'."
    item "22" "Portal users → CSV" \
        "Експортира portal_users таблицата в CSV (id, username, email, created_at)." \
        "Файл: \$HOME/portal-users-DATE.csv. Готов за Excel/Google Sheets."
    item "23" "Backup .env file" \
        "Копира private/configs/.env на \$HOME с timestamp. Permissions 600." \
        "Препоръчвам преди да правиш промени в .env."

    echo -e "${BOLD}${CYAN}━━━ CONFIG / MAINTENANCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "24" "Show ENV-EXAMPLE" \
        "Прочита и показва docs/ENV-EXAMPLE.env (шаблон с всички възможни настройки)." \
        "Полезно когато искаш да видиш какви environment променливи са нужни."
    item "25" "Edit .deploy-targets" \
        "Отваря nano за конфигурация на deploy targets (prod, vm, custom server-и)." \
        "Ако файлът не съществува, копира от .deploy-targets.example."
    item "26" "Edit local .env" \
        "Отваря nano за private/configs/.env (твоят локален environment файл)." \
        "Ако файлът не съществува, копира от ENV-EXAMPLE.env template."
    item "27" "Promote ENV-EXAMPLE → .env" \
        "Копира docs/ENV-EXAMPLE.env в private/configs/.env." \
        "Полезно за първоначална настройка — после редактираш стойностите."
    item "28" "npm install (ЛОКАЛНО — твоята машина)" \
        "Инсталира node_modules на ТВОЯТА машина (npm install --legacy-peer-deps в root-а)." \
        "За локален dev/тест (опции 16-19). За СЪРВЪРА → отговори 'y' на въпроса за npm в опция 2." \
        "Нужно след clone, промяна на package.json, или липсващи модули локално."
    item "29" "Clean caches" \
        "Изтрива всички node_modules/, artifacts/, cache/ папки в проекта." \
        "⚠ След това трябва пак npm install. Полезно при странни bug-ове."

    echo -e "${BOLD}${CYAN}━━━ REMOTE COMMANDS (показва SSH cmd) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "30" "Update sudoers на сървъра" \
        "Дава SSH команда за update на sudoers entry (limited sudo за deploy user)." \
        "Изпълни когато добавиш нов скрипт или промениш разрешенията."
    item "31" "Setup wizard (.env)" \
        "Дава SSH команда за интерактивна .env конфигурация на сървъра." \
        "Питат се всички environment стойности; записват се в production .env."
    item "32" "Setup / Reset database" \
        "Дава SSH команда за setup на DB на сървъра (SQLite или PostgreSQL)." \
        "С опция reset — ⚠ изтрива ВСИЧКИ данни от production базата."
    item "33" "Setup domain / SSL" \
        "Дава SSH команда за конфигурация на nginx + Let's Encrypt SSL certificate." \
        "Изисква вече настроен DNS A-запис към сървъра."
    item "34" "Service status" \
        "Дава SSH команда за 'systemctl status kcy-chat kcy-eco3 nginx'." \
        "Показва дали services работят, последни logs, exit codes."
    item "35" "View live logs" \
        "Дава SSH команда за 'journalctl -u kcy-chat -u kcy-eco3 -f' (live следене)." \
        "Полезно когато правиш deploy и искаш да видиш как се стартират."

    echo -e "${BOLD}${CYAN}━━━ FAILOVER (VPS ↔ VM) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "36" "Setup Tailscale VPN" \
        "Инсталира Tailscale на сървъра (VPS или VM) — нужно за failover." \
        "Безплатно за лична употреба. Минава през SSH command."
    item "37" "Setup failover proxy (VPS)" \
        "На production VPS: превръща nginx в reverse proxy към VM." \
        "Ако VM падне → VPS автоматично пое. Изисква Tailscale на двете машини."

    echo -e "${BOLD}${CYAN}━━━ INFO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "40" "Status & info" \
        "Показва: версия на проекта, Node + npm версии, OS, deploy targets," \
        "локални DB файлове с размер, дали node_modules е инсталиран."

    echo -e "${BOLD}${CYAN}━━━ НОВИ ПРИЛОЖЕНИЯ — УСЛУГИ (systemd+nginx, първа настройка) ━━━━━━━━${NC}"
    echo ""
    item "43" "Deploy House-Look-Book УСЛУГА (systemd+nginx) → сървър" \
        "Вдига kcy-hlb услугата (node :3010) + nginx /houselookbook/, /api/hlb/." \
        "Самостоятелно — не пипа chat/eco3/portals. nginx маршрутът идва с опция 2."
    item "44" "Deploy WhereNoBiz УСЛУГА (systemd+nginx) → сървър" \
        "Вдига kcy-wnb услугата (node :3011) + nginx /wherenobiz/, /api/wnb/." \
        "Самостоятелно — не пипа chat/eco3/portals. nginx маршрутът идва с опция 2."
    item "54" "Deploy Find Best Price БАЗА (PostgreSQL) → сървър" \
        "Създава база findbestprice + потребител (FBP_PG_USER от .env), схема + админи." \
        "Самостоятелно (findbestprice). Само PostgreSQL."
    item "55" "Deploy Find Best Price УСЛУГА (systemd+nginx) → сървър" \
        "Вдига kcy-fbp услугата (node :3012) + nginx /find-best-price/, /api/fbp/." \
        "Самостоятелно — не пипа другите. nginx маршрутът идва с опция 2."

    echo -e "${BOLD}${CYAN}━━━ ПО ПРИЛОЖЕНИЕ — обнови (база + админи/модератори от .env + рестарт) ━${NC}"
    echo ""
    item "45" "House-Look-Book — обнови" \
        "Обновява HLB базата и рестартира kcy-hlb." \
        "Самостоятелно — пипа САМО HLB. (.env идва с опция 2.)" \
        "Създава/обновява HLB админи и модератори според .env."
    item "46" "WhereNoBiz — обнови" \
        "Обновява WNB базата и рестартира kcy-wnb." \
        "Самостоятелно — пипа САМО WNB." \
        "Създава/обновява WNB админи и модератори според .env."
    item "47" "Portals — обнови" \
        "Рестартира kcy-portals — при старта прилага схемата." \
        "Самостоятелно — пипа САМО portals." \
        "Създава/обновява portals админи и модератори според .env."
    item "48" "Chat — обнови" \
        "Рестартира kcy-chat (таблица admin_users)." \
        "Самостоятелно — пипа САМО chat." \
        "Създава/обновява chat админи и модератори според .env."
    item "49" "ECO-3 — обнови" \
        "Създава/обновява eco3_admins от .env, после рестартира kcy-eco3." \
        "Самостоятелно — пипа САМО eco3." \
        "Създава/обновява ECO-3 админи и модератори според .env."

    echo -e "${BOLD}${RED}━━━ ОПАСНИ (двойно потвърждение) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "50" "Disable SSH password auth" \
        "⚠ ОПАСНО! Изключва парола за SSH login (само ключ). Препоръчвам само за" \
        "сървъри с recovery console (DigitalOcean). НЕ за локалната VM!"
    item "51" "Toggle kcy-admin sudo" \
        "⚠ ОПАСНО! Добавя/премахва kcy-admin от sudo групата. Влияе на root достъп." \
        "Двойно потвърждение (yes → no) за защита от случайно натискане."

    echo -e "${BOLD}${CYAN}━━━ ТОКЕН МОНИТОРИ (read-only индексатор/аналитика/аларми) ━━━━━━━━━━━━${NC}"
    echo ""
    item "52" "Token Monitor — настрой услуга (избери токен)" \
        "Вдига kcy-tokmon-<токен> (индексатор + dashboard + аларми) + nginx /tokmon/<токен>/." \
        "Отделно за всеки: token / brch1 / multisig. Чете on-chain, БЕЗ ключове (read-only)." \
        "Нужен е ethers на сървъра (опция 2 пълна инсталация го слага). Бездейства, докато не впишеш адреса."

    echo ""
    echo -e "${BOLD}${CYAN}━━━ ТЕСТ РОБОТ (Playwright обхождане + лов на грешки) ━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "53" "Тест робот — инсталирай (Playwright + Chromium)" \
        "npm install + сваля Chromium на сървъра, прави папка за репорти, рестартира kcy-diag." \
        "После пускаш робота от админ менюто на сайта: 🤖 Робот (/shared/robot.html)." \
        "Chromium яде RAM — на малък сървър пускай по едно обхождане."

    echo ""
    echo -e "${BOLD}${CYAN}━━━ FILL DATA (попълване със системно съдържание — ботове/скрапери) ━━${NC}"
    echo ""
    # РЕЗЕРВИРАНО: позиции 60-70 СА САМО за FILL DATA задачи (пълнене на данни по
    # сайтовете). Не ги ползвай за друго. План: 61 чат авто-отговори · 62 FBP скрапер
    # · 63 WNB пълнител · 64 HLB пълнител · 65-70 свободни за бъдещи.
    item "60" "Чат — попълни системни потребители" \
        "Създава N бот-потребители от различни държави (флаг is_system=1) в чата." \
        "Питам колко. НЕ са реални хора — само оживяват чата."
    item "61" "Чат — авто-отговори на системните" \
        "Системните отговарят на реални хора: поздрав / как си / работа / 20+ комплимента." \
        "Разпознава намерение, отговаря на езика на държавата (15 езика)."
    item "62" "Find Best Price — скрапер (Google ≤3/ден)" \
        "Търси продукти в онлайн магазини по държави → пълни базата (магазини+продукти+цени)." \
        "САМО текст, без картинки; маркира is_system. Твърд таван 3 Google заявки/ден."
    item "63" "WhereNoBiz — попълни липсващи бизнеси" \
        "Системни постове за липсващ бизнес по държави; описание на езика на държавата." \
        "Маркира is_system; системният няма телефон (не се договаря). Google до 1/ден."
    item "64" "House-Look-Book — генерирай модели къщи" \
        "Създава системни модели странни къщи (форма/покрив/етажи/стаи/цвят) — рендерират се." \
        "Параметрични, без картинки (надеждно); маркира is_system."
    echo -e "  ${GRAY}(65-70 запазени за бъдещи FILL DATA задачи)${NC}"

    echo -e "${BOLD}${GRAY}━━━ СВОБОДНИ НОМЕРА ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    item "38" "СВОБОДЕН"
    item "38" "СВОБОДЕН"
    item "39" "СВОБОДЕН"
    item "41" "СВОБОДЕН"
    item "42" "СВОБОДЕН"

    echo -e "  ${BOLD}q${NC})  Изход"
    echo ""
}

run_choice() {
    case "$1" in
        # ── DEPLOY ──
        1)
            # Динамичен списък от .deploy-targets + опция за нов target
            echo ""
            echo "  Каква машина да bootstrap-неш?"
            IDX=1
            declare -a BS_ARR=()
            declare -a BS_USER_ARR=()
            declare -a BS_SERVER_ARR=()
            declare -a BS_PORT_ARR=()
            if [ -f .deploy-targets ]; then
                . .deploy-targets
                for t in $(grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u); do
                    s_var="TARGET_${t}_SERVER"; u_var="TARGET_${t}_USER"; p_var="TARGET_${t}_PORT"
                    echo "    $IDX) $t — ${!u_var}@${!s_var}:${!p_var}"
                    BS_ARR[$IDX]="$t"
                    BS_SERVER_ARR[$IDX]="${!s_var}"
                    BS_USER_ARR[$IDX]="${!u_var}"
                    BS_PORT_ARR[$IDX]="${!p_var}"
                    IDX=$((IDX+1))
                done
            fi
            echo "    $IDX) custom — ще те пита server/user/port"
            CUSTOM_IDX=$IDX
            echo ""
            read -p "  Избери [1-${IDX}, default=1]: " PICK
            PICK="${PICK:-1}"
            if [ -z "$PICK" ]; then echo "Отказано"; press_enter
            elif [ "$PICK" = "$CUSTOM_IDX" ]; then
                read -p "  Server (IP или hostname): " S
                read -p "  Username: " U
                read -p "  SSH port: " P
                run_cmd ./deploy-scripts/01-bootstrap.sh "$S" "$U" "$P"
            elif [ -n "${BS_ARR[$PICK]}" ]; then
                run_cmd ./deploy-scripts/01-bootstrap.sh "${BS_SERVER_ARR[$PICK]}" "${BS_USER_ARR[$PICK]}" "${BS_PORT_ARR[$PICK]}"
            else
                echo "Невалиден избор"; press_enter
            fi
            ;;
        2)
            run_cmd ./deploy-scripts/02-full-install.sh
            ;;
        3)
            echo ""
            echo -e "${BOLD}${CYAN}  SSH връзка — към коя машина?${NC}"
            echo ""
            echo -e "    1) ${GREEN}прод${NC} — root@take.offbitch.com:2222"
            echo -e "    2) ${GREEN}VM${NC}   — deploy@192.168.0.108:2222  (ключ id_ed25519)"
            echo ""
            read -p "  Избери [1-2]: " SSHPICK
            case "$SSHPICK" in
                1) run_cmd ssh -v -p 2222 root@take.offbitch.com ;;
                2) run_cmd ssh -i ~/.ssh/id_ed25519 -p 2222 deploy@192.168.0.108 ;;
                *) echo "  Отказано"; press_enter ;;
            esac
            ;;

        4)
            # Динамичен списък от .deploy-targets за deploy
            echo ""
            echo -e "${BOLD}${CYAN}  ПЪЛЕН DEPLOY — на кой сървър?${NC}"
            echo "  (Качва целия проект, разархивира, пуска 05-server-install:"
            echo "   npm install + реконфигурация + рестарт. Ползвай при голяма промяна"
            echo "   или нов пакет. За само код → опция 5 (Прехвърли само СОРС), за само видеа → опция 6 (Прехвърли само АСЕТИ).)"
            echo ""
            IDX=1
            declare -a DT_ARR=()
            if [ -f .deploy-targets ]; then
                for t in $(grep -oE "^TARGET_[a-zA-Z0-9_]+_SERVER" .deploy-targets | sed -E 's/^TARGET_(.+)_SERVER$/\1/' | sort -u); do
                    s_var="TARGET_${t}_SERVER"; p_var="TARGET_${t}_PORT"; l_var="TARGET_${t}_LABEL"
                    case "$t" in
                        prod) DESC="истинският production сървър (живият сайт, който виждат хората)";;
                        vm)   DESC="локална тестова виртуална машина (за проба преди prod)";;
                        *)    DESC="${!l_var:-$t}";;
                    esac
                    echo -e "    $IDX) ${GREEN}$t${NC} — $DESC"
                    echo "        ${!s_var}:${!p_var}"
                    DT_ARR[$IDX]="$t"
                    IDX=$((IDX+1))
                done
            fi
            echo -e "    $IDX) ${GREEN}custom${NC} — ръчно въвеждаш server/user/port (друг сървър)"
            CUSTOM_IDX=$IDX
            echo ""
            read -p "  Избери [1-${IDX}, default=1]: " PICK
            PICK="${PICK:-1}"
            if [ -z "$PICK" ]; then echo "Отказано"; press_enter
            elif [ "$PICK" = "$CUSTOM_IDX" ]; then
                run_cmd ./deploy-scripts/04-deploy.sh
            elif [ -n "${DT_ARR[$PICK]}" ]; then
                run_cmd ./deploy-scripts/04-deploy.sh "${DT_ARR[$PICK]}"
            else
                echo "Невалиден избор"; press_enter
            fi
            ;;

        # ── DEPLOY (леки трансфери) ──
        5)
            run_cmd ./deploy-scripts/sync-source.sh
            ;;
        6)
            run_cmd ./deploy-scripts/sync-assets.sh
            ;;

        # ── НОВИ ПРИЛОЖЕНИЯ (бази + услуги) — точки 5/6 са свободни, всичко е на 41–44 ──
        41)
            echo ""
            echo -e "${BOLD}${CYAN}  DEPLOY House-Look-Book база — на кой сървър?${NC}"
            echo ""
            if pick_target; then
                echo ""
                read -p "  Reset? Enter = НЕ трий (само създай/обнови)  |  напиши 'да' = ТРИЙ всичко (DROP): " RM
                RST=""; case "$RM" in да|Да|ДА|reset|RESET|yes|YES|y|Y) RST=" --reset";; esac
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/16-setup-app-databases.sh houselookbook${RST}"
                echo ""
                echo -e "  ${YELLOW}Менюто ще се свърже и изпълни на сървъра (проектът трябва да е качен — опция 2/4):${NC}"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV}${NC}"
                echo -e "    ${CYAN}${REMOTE}${NC}"
                echo ""
                echo "  → Резултат: създава база houselookbook + потребителя (HLB_PG_USER от .env) и зарежда схемата."
                echo ""
                echo ""
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                echo ""
                if [ "$RC" -eq 0 ]; then
                    echo -e "  ${GREEN}✓ Готово (exit 0) — база houselookbook е настроена на ${PICK_SRV}${NC}"
                else
                    echo -e "  ${RED}✗ Скриптът върна грешка (exit ${RC}) — виж изхода по-горе${NC}"
                fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        42)
            echo ""
            echo -e "${BOLD}${CYAN}  DEPLOY WhereNoBiz база — на кой сървър?${NC}"
            echo ""
            if pick_target; then
                echo ""
                read -p "  Reset? Enter = НЕ трий (само създай/обнови)  |  напиши 'да' = ТРИЙ всичко (DROP): " RM
                RST=""; case "$RM" in да|Да|ДА|reset|RESET|yes|YES|y|Y) RST=" --reset";; esac
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/17-setup-wherenobiz-database.sh${RST}"
                echo ""
                echo -e "  ${YELLOW}Менюто ще се свърже и изпълни на сървъра (проектът трябва да е качен — опция 2/4):${NC}"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV}${NC}"
                echo -e "    ${CYAN}${REMOTE}${NC}"
                echo ""
                echo "  → Резултат: създава база wherenobiz + потребителя (WNB_PG_USER от .env) и зарежда схемата."
                echo ""
                echo ""
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                echo ""
                if [ "$RC" -eq 0 ]; then
                    echo -e "  ${GREEN}✓ Готово (exit 0) — база wherenobiz е настроена на ${PICK_SRV}${NC}"
                else
                    echo -e "  ${RED}✗ Скриптът върна грешка (exit ${RC}) — виж изхода по-горе${NC}"
                fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        43)
            echo ""
            echo -e "${BOLD}${CYAN}  DEPLOY House-Look-Book УСЛУГА (systemd+nginx) — на кой сървър?${NC}"
            echo ""
            if pick_target; then
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/18-setup-houselookbook-service.sh"
                echo ""
                echo -e "  ${YELLOW}Менюто ще се свърже и изпълни на сървъра (проектът трябва да е качен — опция 2/4):${NC}"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV}${NC}"
                echo -e "    ${CYAN}${REMOTE}${NC}"
                echo ""
                echo "  → Резултат: вдига kcy-hlb (node :3010) + nginx /houselookbook/, /api/hlb/."
                echo "    (nginx маршрутът се активира напълно след опция 2 — пълен деплой.)"
                echo ""
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                echo ""
                if [ "$RC" -eq 0 ]; then
                    echo -e "  ${GREEN}✓ Готово (exit 0) — kcy-hlb услугата е настроена на ${PICK_SRV}${NC}"
                else
                    echo -e "  ${RED}✗ Скриптът върна грешка (exit ${RC}) — виж изхода по-горе${NC}"
                fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        44)
            echo ""
            echo -e "${BOLD}${CYAN}  DEPLOY WhereNoBiz УСЛУГА (systemd+nginx) — на кой сървър?${NC}"
            echo ""
            if pick_target; then
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/19-setup-wherenobiz-service.sh"
                echo ""
                echo -e "  ${YELLOW}Менюто ще се свърже и изпълни на сървъра (проектът трябва да е качен — опция 2/4):${NC}"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV}${NC}"
                echo -e "    ${CYAN}${REMOTE}${NC}"
                echo ""
                echo "  → Резултат: вдига kcy-wnb (node :3011) + nginx /wherenobiz/, /api/wnb/."
                echo "    (nginx маршрутът се активира напълно след опция 2 — пълен деплой.)"
                echo ""
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                echo ""
                if [ "$RC" -eq 0 ]; then
                    echo -e "  ${GREEN}✓ Готово (exit 0) — kcy-wnb услугата е настроена на ${PICK_SRV}${NC}"
                else
                    echo -e "  ${RED}✗ Скриптът върна грешка (exit ${RC}) — виж изхода по-горе${NC}"
                fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        54)
            echo ""
            echo -e "${BOLD}${CYAN}  DEPLOY Find Best Price база (PostgreSQL) — на кой сървър?${NC}"
            echo ""
            if pick_target; then
                read -p "  Reset? Enter = НЕ трий (само създай/обнови)  |  напиши 'да' = ТРИЙ всичко (DROP): " RM
                RST=""; case "$RM" in да|Да|ДА|reset|RESET|yes|YES|y|Y) RST=" --reset";; esac
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/16-setup-app-databases.sh findbestprice${RST}"
                echo ""
                echo -e "  ${YELLOW}Менюто ще се свърже и изпълни на сървъра (проектът трябва да е качен — опция 2/4):${NC}"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV}${NC}"
                echo -e "    ${CYAN}${REMOTE}${NC}"
                echo ""
                echo "  → Резултат: създава база findbestprice + потребителя (FBP_PG_USER от .env), схемата и попълва админи/модератори."
                echo ""
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                echo ""
                if [ "$RC" -eq 0 ]; then
                    echo -e "  ${GREEN}✓ Готово (exit 0) — база findbestprice е настроена на ${PICK_SRV}${NC}"
                else
                    echo -e "  ${RED}✗ Скриптът върна грешка (exit ${RC}) — виж изхода по-горе${NC}"
                fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        55)
            echo ""
            echo -e "${BOLD}${CYAN}  DEPLOY Find Best Price УСЛУГА (systemd+nginx) — на кой сървър?${NC}"
            echo ""
            if pick_target; then
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/21-setup-fbp-service.sh"
                echo ""
                echo -e "  ${YELLOW}Менюто ще се свърже и изпълни на сървъра (проектът трябва да е качен — опция 2/4):${NC}"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV}${NC}"
                echo -e "    ${CYAN}${REMOTE}${NC}"
                echo ""
                echo "  → Резултат: вдига kcy-fbp (node :3012) + nginx /find-best-price/, /api/fbp/."
                echo "    (nginx маршрутът се активира напълно след опция 2 — пълен деплой.)"
                echo ""
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                echo ""
                if [ "$RC" -eq 0 ]; then
                    echo -e "  ${GREEN}✓ Готово (exit 0) — kcy-fbp услугата е настроена на ${PICK_SRV}${NC}"
                else
                    echo -e "  ${RED}✗ Скриптът върна грешка (exit ${RC}) — виж изхода по-горе${NC}"
                fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        45|46|47|48|49)
            case "$choice" in
              45) UAPP=hlb;     ULABEL="House-Look-Book" ;;
              46) UAPP=wnb;     ULABEL="WhereNoBiz" ;;
              47) UAPP=portals; ULABEL="Portals" ;;
              48) UAPP=chat;    ULABEL="Chat" ;;
              49) UAPP=eco3;    ULABEL="ECO-3" ;;
            esac
            echo ""
            echo -e "${BOLD}${CYAN}  ОБНОВИ ${ULABEL} (база + админи/модератори от .env + рестарт) — на кой сървър?${NC}"
            echo ""
            if pick_target; then
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/30-update-app.sh ${UAPP}"
                echo ""
                echo -e "  ${YELLOW}Менюто ще се свърже и изпълни на сървъра (.env идва с опция 2):${NC}"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV}${NC}"
                echo -e "    ${CYAN}${REMOTE}${NC}"
                echo ""
                echo "  → Резултат: обновява САМО ${ULABEL} (база + неговите админи/модератори + рестарт)."
                echo ""
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                echo ""
                if [ "$RC" -eq 0 ]; then
                    echo -e "  ${GREEN}✓ Готово (exit 0) — ${ULABEL} обновено на ${PICK_SRV}${NC}"
                else
                    echo -e "  ${RED}✗ Скриптът върна грешка (exit ${RC}) — виж изхода по-горе${NC}"
                fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        52)
            echo ""
            echo -e "${BOLD}${CYAN}  Token Monitor — за кой токен?${NC}"
            echo "    1) token (KCY-meme-1)"
            echo "    2) brch1 (BeRicH 1)"
            echo "    3) multisig"
            echo "    4) ВСИЧКИ"
            read -p "  Избери [1-4, Enter = ВСИЧКИ]: " TSEL
            case "$TSEL" in
                1) TLIST="token" ;;
                2) TLIST="brch1" ;;
                3) TLIST="multisig" ;;
                ""|4) TLIST="token brch1 multisig" ;;
                *) TLIST="" ;;
            esac
            if [ -n "$TLIST" ] && pick_target; then
                for TKN in $TLIST; do
                    REMOTE="sudo /var/www/deploy/deploy-scripts/server/31-setup-token-monitor.sh ${TKN}"
                    echo ""
                    echo -e "  ${BOLD}${CYAN}→ ${TKN}${NC}"
                    echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV} ${REMOTE}${NC}"
                    ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                    RC=$?
                    [ "$RC" -eq 0 ] && echo -e "  ${GREEN}✓ kcy-tokmon-${TKN} настроен${NC}" || echo -e "  ${RED}✗ ${TKN}: грешка (exit ${RC})${NC}"
                done
            elif [ -z "$TLIST" ]; then echo "  Невалиден избор — отказано"
            else echo "  Отказано"; fi
            press_enter
            ;;
        53)
            echo ""
            echo -e "${BOLD}${CYAN}  Тест робот — инсталиране (Playwright + Chromium)${NC}"
            if pick_target; then
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/32-setup-robot.sh"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV} ${REMOTE}${NC}"
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                [ "$RC" -eq 0 ] && echo -e "  ${GREEN}✓ Роботът е инсталиран — пусни го от 🤖 Робот в админ менюто${NC}" || echo -e "  ${RED}✗ грешка (exit ${RC})${NC}"
            else echo "  Отказано"; fi
            press_enter
            ;;
        60)
            echo ""
            echo -e "${BOLD}${CYAN}  FILL DATA · Чат — системни потребители${NC}"
            if pick_target; then
                read -p "  Колко потребителя да създам? [Enter = 20]: " NUSERS
                NUSERS="${NUSERS:-20}"
                if printf '%s' "$NUSERS" | grep -qE '^[0-9]+$'; then
                    REMOTE="bash -lc 'cd /var/www/kcy-ecosystem/private/chat && node scripts/fill-system-users.js ${NUSERS}'"
                    echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV} → fill-system-users.js ${NUSERS}${NC}"
                    ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                    RC=$?
                    [ "$RC" -eq 0 ] && echo -e "  ${GREEN}✓ Готово — ${NUSERS} системни потребители на ${PICK_SRV}${NC}" || echo -e "  ${RED}✗ грешка (exit ${RC})${NC}"
                else echo "  Невалиден брой."; fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        61)
            echo ""
            echo -e "${BOLD}${CYAN}  FILL DATA · Чат — авто-отговори на системните${NC}"
            if pick_target; then
                read -p "  Макс. брой отговори този път? [Enter = 500]: " NREP
                NREP="${NREP:-500}"
                if printf '%s' "$NREP" | grep -qE '^[0-9]+$'; then
                    REMOTE="bash -lc 'cd /var/www/kcy-ecosystem/private/chat && node scripts/fill-system-replies.js ${NREP}'"
                    echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV} → fill-system-replies.js ${NREP}${NC}"
                    ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                    RC=$?
                    [ "$RC" -eq 0 ] && echo -e "  ${GREEN}✓ Готово — авто-отговорите минаха на ${PICK_SRV}${NC}" || echo -e "  ${RED}✗ грешка (exit ${RC})${NC}"
                else echo "  Невалиден брой."; fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        62)
            echo ""
            echo -e "${BOLD}${CYAN}  FILL DATA · Find Best Price — скрапер (Google ≤3/ден)${NC}"
            if pick_target; then
                read -p "  Макс Google заявки този път [Enter = всички останали за деня]: " NQ
                NQ_ARG=""
                if [ -n "$NQ" ]; then
                    if printf '%s' "$NQ" | grep -qE '^[0-9]+$'; then NQ_ARG=" $NQ"; else echo "  Невалиден брой."; press_enter; fi
                fi
                REMOTE="bash -lc 'cd /var/www/kcy-ecosystem/private/find-best-price && node scripts/fbp-scraper.js${NQ_ARG}'"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV} → fbp-scraper.js${NQ_ARG}${NC}"
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                [ "$RC" -eq 0 ] && echo -e "  ${GREEN}✓ Готово — скраперът мина на ${PICK_SRV}${NC}" || echo -e "  ${RED}✗ грешка (exit ${RC})${NC}"
            else echo "  Отказано"; fi
            press_enter
            ;;
        63)
            echo ""
            echo -e "${BOLD}${CYAN}  FILL DATA · WhereNoBiz — липсващи бизнеси${NC}"
            if pick_target; then
                read -p "  Колко поста да добавя? [Enter = 20]: " NWNB
                NWNB="${NWNB:-20}"
                if printf '%s' "$NWNB" | grep -qE '^[0-9]+$'; then
                    REMOTE="bash -lc 'cd /var/www/kcy-ecosystem/private/WhereNoBiz && node scripts/wnb-filler.js ${NWNB}'"
                    echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV} → wnb-filler.js ${NWNB}${NC}"
                    ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                    RC=$?
                    [ "$RC" -eq 0 ] && echo -e "  ${GREEN}✓ Готово — WNB попълнен на ${PICK_SRV}${NC}" || echo -e "  ${RED}✗ грешка (exit ${RC})${NC}"
                else echo "  Невалиден брой."; fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        64)
            echo ""
            echo -e "${BOLD}${CYAN}  FILL DATA · House-Look-Book — генерирай модели${NC}"
            if pick_target; then
                read -p "  Колко модела да генерирам? [Enter = 20]: " NHLB
                NHLB="${NHLB:-20}"
                if printf '%s' "$NHLB" | grep -qE '^[0-9]+$'; then
                    REMOTE="bash -lc 'cd /var/www/kcy-ecosystem/private/House-Look-Book && node scripts/hlb-filler.js ${NHLB}'"
                    echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV} → hlb-filler.js ${NHLB}${NC}"
                    ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                    RC=$?
                    [ "$RC" -eq 0 ] && echo -e "  ${GREEN}✓ Готово — HLB модели на ${PICK_SRV}${NC}" || echo -e "  ${RED}✗ грешка (exit ${RC})${NC}"
                else echo "  Невалиден брой."; fi
            else echo "  Отказано"; fi
            press_enter
            ;;
        7)
            if [ -f private/portals/database/init.js ]; then
                run_cmd bash -c "cd private/portals && node database/init.js"
            else echo "  private/portals/database/init.js не съществува"; press_enter
            fi
            ;;
        8)
            if [ -f private/eco-3/database/init.js ]; then
                run_cmd bash -c "cd private/eco-3 && node database/init.js"
            else echo "  private/eco-3/database/init.js не съществува"; press_enter
            fi
            ;;
        9)
            if [ -f private/portals/database/portals.db ]; then
                echo ""
                sqlite3 private/portals/database/portals.db ".tables"
                echo ""
                for t in portal_users portal_monthly_payments portal_game_scores portal_service_jobs; do
                    count=$(sqlite3 private/portals/database/portals.db "SELECT COUNT(*) FROM $t" 2>/dev/null || echo "—")
                    printf "  %-30s %s\n" "$t" "$count"
                done
            else echo "  Portal DB не съществува (първо пусни опция 7 — Init Portal база данни)"
            fi
            press_enter
            ;;
        10)
            if [ -f private/chat/scripts/migrate-database.sh ]; then
                run_cmd bash private/chat/scripts/migrate-database.sh
            else echo "  Migration script не съществува"; press_enter
            fi
            ;;

        # ── SMART CONTRACTS ──
        11)
            scope=$(ask_choice "Какво да compile-нем?" "all (KCY + BRCH1)" "KCY token" "BRCH1")
            case "$scope" in
                "all (KCY + BRCH1)") run_cmd npm run compile:all ;;
                "KCY token")         run_cmd npm run compile ;;
                "BRCH1")             run_cmd npm run compile:brch1 ;;
                *) echo "Отказано"; press_enter ;;
            esac
            ;;
        12)
            read -p "  ${RED}⚠ KCY token MAINNET. Напиши 'DEPLOY': ${NC}" conf
            [ "$conf" = "DEPLOY" ] && run_cmd npm run deploy:token || { echo "  Отказано"; press_enter; }
            ;;
        13)
            read -p "  ${RED}⚠ Multi-Sig MAINNET. Напиши 'DEPLOY': ${NC}" conf
            [ "$conf" = "DEPLOY" ] && run_cmd npm run deploy:multisig || { echo "  Отказано"; press_enter; }
            ;;
        14)
            net=$(ask_choice "Network?" "testnet (BSC Testnet — безплатно)" "mainnet (BSC — платено)")
            case "$net" in
                "testnet (BSC Testnet — безплатно)")
                    run_cmd npm run deploy:brch1:testnet ;;
                "mainnet (BSC — платено)")
                    read -p "  ${RED}⚠ MAINNET. Напиши 'DEPLOY': ${NC}" conf
                    [ "$conf" = "DEPLOY" ] && run_cmd npm run deploy:brch1:mainnet || { echo "  Отказано"; press_enter; }
                    ;;
                *) echo "Отказано"; press_enter ;;
            esac
            ;;
        15)
            net=$(ask_choice "Network?" "testnet" "mainnet")
            case "$net" in
                testnet) run_cmd npm run verify:brch1:testnet ;;
                mainnet) run_cmd npm run verify:brch1:mainnet ;;
                *) echo "Отказано"; press_enter ;;
            esac
            ;;

        # ── TESTS ──
        16)
            scope=$(ask_choice "Test suite?" "all" "token" "multisig" "chat" "mobile" "portals (Node)" "portals smoke (bash)")
            case "$scope" in
                all)       run_cmd npm test ;;
                token)     run_cmd npm run test:token ;;
                multisig)  run_cmd npm run test:multisig ;;
                chat)      run_cmd npm run test:chat ;;
                mobile)    run_cmd npm run test:mobile ;;
                "portals (Node)")        run_cmd npm run test:portals ;;
                "portals smoke (bash)")  run_cmd npm run test:portals:smoke ;;
                *) echo "Отказано"; press_enter ;;
            esac
            ;;

        # ── SERVICES ──
        17)
            mode=$(ask_choice "Mode?" "prod (node)" "dev (nodemon)")
            case "$mode" in
                "prod (node)")     run_cmd npm run start:chat ;;
                "dev (nodemon)")   run_cmd npm run start:chat:dev ;;
                *) echo "Отказано"; press_enter ;;
            esac
            ;;
        18)
            mode=$(ask_choice "Mode?" "prod (node)" "dev (nodemon)")
            case "$mode" in
                "prod (node)")     run_cmd npm run start:eco3 ;;
                "dev (nodemon)")   run_cmd npm run start:eco3:dev ;;
                *) echo "Отказано"; press_enter ;;
            esac
            ;;
        19) run_cmd npm run start:all ;;

        # ── EXPORT ──
        20)
            NAME="kcy-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
            run_cmd tar -czf "$HOME/${NAME}" \
                --exclude='node_modules' --exclude='artifacts' \
                --exclude='cache' --exclude='*.log' \
                -C "$PROJECT_ROOT/.." "$(basename "$PROJECT_ROOT")"
            echo "  ✓ $HOME/${NAME}"
            press_enter
            ;;
        21)
            mkdir -p "$HOME/kcy-db-backup"
            for db in private/portals/database/portals.db private/eco-3/database/eco3.db; do
                if [ -f "$db" ]; then
                    OUT="$HOME/kcy-db-backup/$(basename ${db%.db})-$(date +%Y%m%d-%H%M%S).sql"
                    sqlite3 "$db" ".dump" > "$OUT"
                    echo "  ✓ $OUT"
                fi
            done
            press_enter
            ;;
        22)
            if [ -f private/portals/database/portals.db ]; then
                OUT="$HOME/portal-users-$(date +%Y%m%d).csv"
                sqlite3 -header -csv private/portals/database/portals.db \
                    "SELECT id, username, email, created_at FROM portal_users;" > "$OUT"
                echo "  ✓ $OUT"
            else echo "  Portal DB не съществува"
            fi
            press_enter
            ;;
        23)
            if [ -f private/configs/.env ]; then
                OUT="$HOME/kcy-env-backup-$(date +%Y%m%d-%H%M%S).env"
                cp private/configs/.env "$OUT"
                chmod 600 "$OUT"
                echo "  ✓ $OUT"
            else echo "  private/configs/.env не съществува"
            fi
            press_enter
            ;;

        # ── CONFIG / MAINTENANCE ──
        24)
            if [ -f docs/ENV-EXAMPLE.env ]; then echo ""; cat docs/ENV-EXAMPLE.env
            else echo "  docs/ENV-EXAMPLE.env не съществува"
            fi
            press_enter
            ;;
        25)
            if [ ! -f .deploy-targets ]; then
                cp deploy-scripts/.deploy-targets.example .deploy-targets
                echo "  Създадох .deploy-targets от template"
            fi
            ${EDITOR:-nano} .deploy-targets
            ;;
        26)
            mkdir -p private/configs
            if [ ! -f private/configs/.env ] && [ -f docs/ENV-EXAMPLE.env ]; then
                cp docs/ENV-EXAMPLE.env private/configs/.env
                echo "  Създадох .env от template"
            fi
            ${EDITOR:-nano} private/configs/.env
            ;;
        27)
            if [ -f docs/ENV-EXAMPLE.env ]; then
                mkdir -p private/configs
                cp docs/ENV-EXAMPLE.env private/configs/.env
                echo "  ✓ private/configs/.env създаден"
            else echo "  Template не съществува"
            fi
            press_enter
            ;;
        28) run_cmd npm install --legacy-peer-deps ;;
        29)
            read -p "  ${RED}Изтриване на node_modules, artifacts, cache. Сигурен? [y/N]: ${NC}" conf
            if [ "$conf" = "y" ] || [ "$conf" = "Y" ]; then
                rm -rf node_modules artifacts cache 2>/dev/null
                find . -type d -name "node_modules" -prune -exec rm -rf {} + 2>/dev/null
                find . -type d -name "artifacts" -prune -exec rm -rf {} + 2>/dev/null
                find . -type d -name "cache" -prune -exec rm -rf {} + 2>/dev/null
                echo "  ✓ Изтрито"
            else echo "  Отказано"
            fi
            press_enter
            ;;

        # ── REMOTE ──
        30)
            run_cmd ./deploy-scripts/update-sudoers.sh
            ;;
        31)
            echo ""
            echo "  Изпълни на сървъра:"
            echo -e "  ${CYAN}ssh deploy@SERVER${NC}"
            echo -e "  ${CYAN}sudo /var/www/deploy/deploy-scripts/server/06-setup-wizard.sh${NC}"
            press_enter
            ;;
        32)
            action=$(ask_choice "Какво?" "setup" "reset (⚠ изтрива данните)")
            case "$action" in
                setup)
                    echo ""
                    echo "  Изпълни на сървъра:"
                    echo -e "  ${CYAN}ssh deploy@SERVER${NC}"
                    echo -e "  ${CYAN}sudo /var/www/deploy/deploy-scripts/server/07-setup-database.sh${NC}"
                    ;;
                "reset (⚠ изтрива данните)")
                    read -p "  ${RED}⚠ Напиши 'RESET': ${NC}" conf
                    if [ "$conf" = "RESET" ]; then
                        echo ""
                        echo "  Изпълни на сървъра:"
                        echo -e "  ${CYAN}ssh deploy@SERVER${NC}"
                        echo -e "  ${CYAN}sudo /var/www/deploy/deploy-scripts/server/07-setup-database.sh --reset${NC}"
                    else echo "  Отказано"
                    fi
                    ;;
                *) echo "Отказано" ;;
            esac
            press_enter
            ;;
        33)
            echo ""
            echo -e "${BOLD}${CYAN}  Домейн / SSL — nginx + Let's Encrypt (чете private/configs/domains.conf)${NC}"
            if pick_target; then
                REMOTE="sudo /var/www/deploy/deploy-scripts/server/08-setup-domain.sh"
                echo -e "    ${CYAN}ssh -p ${PICK_PORT} ${PICK_USER}@${PICK_SRV} ${REMOTE}${NC}"
                ssh -t -p "$PICK_PORT" "${PICK_USER}@${PICK_SRV}" "$REMOTE"
                RC=$?
                [ "$RC" -eq 0 ] && echo -e "  ${GREEN}✓ Домейните/SSL са настроени${NC}" || echo -e "  ${RED}✗ грешка (exit ${RC})${NC}"
            else echo "  Отказано"; fi
            press_enter
            ;;
        34)
            echo ""
            echo "  Изпълни на сървъра:"
            echo -e "  ${CYAN}ssh deploy@SERVER 'sudo systemctl status kcy-chat kcy-eco3 nginx --no-pager'${NC}"
            press_enter
            ;;
        35)
            echo ""
            echo "  Изпълни на сървъра (Ctrl+C за изход):"
            echo -e "  ${CYAN}ssh deploy@SERVER 'sudo journalctl -u kcy-chat -u kcy-eco3 -f'${NC}"
            press_enter
            ;;

        # ── FAILOVER ──
        36)
            echo ""
            target=$(ask_choice "На коя машина?" "VPS (${MAIN_DOMAIN})" "VM (192.168.0.108)")
            case "$target" in
                "VPS (${MAIN_DOMAIN})")
                    echo ""
                    echo "  Изпълни на VPS-а:"
                    echo -e "  ${CYAN}ssh deploy@${MAIN_DOMAIN} -p 2222${NC}"
                    echo -e "  ${CYAN}sudo /var/www/deploy/deploy-scripts/server/11-setup-tailscale.sh${NC}"
                    ;;
                "VM (192.168.0.108)")
                    echo ""
                    echo "  Изпълни на VM-а:"
                    echo -e "  ${CYAN}ssh deploy@192.168.0.108${NC}"
                    echo -e "  ${CYAN}sudo /var/www/deploy/deploy-scripts/server/11-setup-tailscale.sh${NC}"
                    ;;
                *) echo "Отказано" ;;
            esac
            press_enter
            ;;
        37)
            echo ""
            echo -e "${BOLD}${CYAN}  Failover — настройка (VM=primary при включена, VPS=SSL front+backup)${NC}"
            echo -e "  ${YELLOW}⚠ Пипа nginx на ДВЕТЕ машини. Качвам ТЕКУЩИЯ (поправен) скрипт и го пускам.${NC}"
            echo ""
            LSH="$SCRIPT_DIR/server/12-setup-failover.sh"           # локалният (актуален) скрипт
            RPATH="/var/www/deploy/deploy-scripts/server/12-setup-failover.sh"   # whitelist-нат път на сървъра
            VM_LAN="192.168.0.108"; VM_TS="100.119.216.84"
            if [ ! -f "$LSH" ]; then echo -e "  ${RED}Липсва $LSH${NC}"; press_enter
            else
              read -p "  Да настроя failover СЕГА (VM-prep + VPS)? [y/N]: " conf
              if [ "$conf" = "y" ] || [ "$conf" = "Y" ]; then
                echo ""
                echo -e "  ${CYAN}→ 1/2 VM (${VM_LAN}): качвам скрипта + vm-prep…${NC}"
                if scp -q -i ~/.ssh/id_ed25519 -P 2222 "$LSH" "deploy@${VM_LAN}:${RPATH}" \
                   && ssh -t -i ~/.ssh/id_ed25519 -p 2222 "deploy@${VM_LAN}" "sudo ${RPATH} --vm-prep"; then
                    echo -e "  ${GREEN}✓ VM готов${NC}"
                    echo ""
                    echo -e "  ${CYAN}→ 2/2 живия (${MAIN_DOMAIN}): качвам скрипта + failover…${NC}"
                    if scp -q -P 2222 "$LSH" "deploy@${MAIN_DOMAIN}:${RPATH}" \
                       && ssh -t -p 2222 "deploy@${MAIN_DOMAIN}" "sudo ${RPATH} ${VM_TS}"; then
                        echo -e "  ${GREEN}✓ Failover активен.${NC} Проверка:"
                        echo -e "    ${CYAN}curl -sI https://${MAIN_DOMAIN} | grep -i served-by${NC}   (VM = VM-ката · PROD = живият)"
                    else echo -e "  ${RED}✗ Стъпка 2 (VPS) се провали — виж изхода горе${NC}"; fi
                else echo -e "  ${RED}✗ Стъпка 1 (VM-prep) се провали — VM-ката достъпна ли е на ${VM_LAN}?${NC}"; fi
              else echo "  Отказано. (Връщане: на живия → sudo ${RPATH} --revert)"; fi
              press_enter
            fi
            ;;

        # ── DANGEROUS ──
        50)
            echo ""
            echo -e "  ${RED}⚠ Тази операция изключва парола за SSH login.${NC}"
            echo -e "  ${RED}   Препоръчвам САМО за сървъри с recovery console (DigitalOcean).${NC}"
            echo ""
            echo "  Изпълни на сървъра:"
            echo -e "  ${CYAN}ssh deploy@SERVER${NC}"
            echo -e "  ${CYAN}sudo /var/www/deploy/deploy-scripts/server/10-disable-ssh-password.sh${NC}"
            echo ""
            echo "  Скриптът има double-confirm защита (yes → no)."
            press_enter
            ;;
        51)
            echo ""
            echo -e "  ${RED}⚠ Тази операция променя sudo правата на kcy-admin.${NC}"
            echo -e "  ${RED}   Влияе на root достъпа към сървъра.${NC}"
            echo ""
            echo "  Изпълни на сървъра:"
            echo -e "  ${CYAN}ssh deploy@SERVER${NC}"
            echo -e "  ${CYAN}sudo /var/www/deploy/deploy-scripts/server/13-kcy-admin-sudo-toggle.sh${NC}"
            echo ""
            echo "  Скриптът има double-confirm защита (yes → no)."
            press_enter
            ;;

        # ── INFO ──
        40)
            clear
            echo -e "${BOLD}${CYAN}── Status & Info ──${NC}"
            echo ""
            VERFILE=$(ls *.version 2>/dev/null | head -1); [ -n "$VERFILE" ] && echo -e "  ${BOLD}Version:${NC}     $(cat "$VERFILE")"
            command -v node >/dev/null && echo -e "  ${BOLD}Node.js:${NC}     $(node -v)"
            command -v npm  >/dev/null && echo -e "  ${BOLD}NPM:${NC}         $(npm -v)"
            echo -e "  ${BOLD}OS:${NC}          $(uname -s) $(uname -r)"
            echo ""
            echo -e "  ${BOLD}Deploy targets:${NC}"
            if [ -f .deploy-targets ]; then
                grep -E "^TARGET_.*_SERVER" .deploy-targets | sed 's/^/    /'
            else
                echo "    (defaults — prod=${MAIN_DOMAIN}:2222, vm=192.168.0.108:22)"
            fi
            echo ""
            echo -e "  ${BOLD}Local databases:${NC}"
            for db in "Portal:private/portals/database/portals.db" \
                      "ECO-3:private/eco-3/database/eco3.db" \
                      "Chat:private/chat/database/chat.db"; do
                name="${db%%:*}"; path="${db#*:}"
                if [ -f "$path" ]; then
                    size=$(du -h "$path" | cut -f1)
                    echo -e "    ${name}: ${GREEN}✓${NC} $path ($size)"
                else
                    echo -e "    ${name}: ${YELLOW}—${NC} (не съществува)"
                fi
            done
            echo ""
            echo -e "  ${BOLD}node_modules:${NC}"
            if [ -d node_modules ]; then
                echo -e "    ${GREEN}✓${NC} ($(du -sh node_modules | cut -f1))"
            else
                echo -e "    ${YELLOW}—${NC} пусни опция 28 (npm install ЛОКАЛНО)"
            fi
            press_enter
            ;;

        q|Q) trap - EXIT; echo "Чао!"; exit 0 ;;
        *) echo "Невалиден избор."; sleep 1 ;;
    esac
}

# Ясен лилав банер — маркира откъде започва да се изпълнява избраният скрипт.
print_start_banner() {
    local opt="$1"
    local PURPLE=$'\033[1;35m'
    local RULE="════════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo -e "${PURPLE}${RULE}${NC}"
    echo -e "${PURPLE}${BOLD}                              ▶  СТАРТИРА СКРИПТ — опция ${opt}${NC}"
    echo -e "${PURPLE}${RULE}${NC}"
    echo ""
}

# === MAIN LOOP ===
while true; do
    show_menu
    read -p "Избери [1-52, q]: " choice
    # банер само за реалните опции (не за изход/празен ред)
    case "$choice" in
        ''|q|Q|quit|exit|изход) : ;;
        *) print_start_banner "$choice" ;;
    esac
    run_choice "$choice"
done
