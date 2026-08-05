#!/usr/bin/env bash
# Version: 1.0001
# run-logger.sh — централно ЛОГВАНЕ + СУМА НА ГРЕШКИТЕ за старт менюто.
#
# Изисквания на потребителя:
#  1) Всяко изпълнение на точка от менюто се ЛОГВА цялостно (това, което се вижда на екрана)
#     в директория на bug-bot: private/bug-bot/start-menu-logs/<дата>-opt<N>.log
#  2) В КРАЯ на всяка точка се сумират ВСИЧКИ грешки, появили се по време на изпълнението, и се
#     визуализират заедно с ЛИЛАВ банер: как е приключил (изход + брой грешки) и коя точка е.
#  3) Реди се машинно-четим индекс (index.jsonl) — bug-bot го чете и веднъж на ден проверява
#     дали някоя точка е фейлнала (виж private/bug-bot/lib/scriptcheck.js).
#
# Ползва функции/променливи от 00-menu.sh (sourced там): menu_title, run_choice, PICK_SRV.
# stdbuf -o0 tee → пълна интерактивност (въпросите се показват веднага, без буфериране).

: "${SLOG_DIR:=${PROJECT_ROOT:-$(pwd)}/private/bug-bot/start-menu-logs}"

# Силни маркери за РЕАЛНА грешка (без безобидните „0 errors"/„без грешки"/успешни редове).
_SLOG_ERR_RE='BUILD FAILED|FAILURE:|KeytoolException|No key with alias|npm ERR!|fatal:|Traceback|Exception:|Permission denied|command not found|Cannot find module|ENOSPC|ECONNREFUSED|✗ |ГРЕШКА|ОШИБКА| error TS[0-9]|[[:space:]]error:|^error:|FAILED|lost connection|Connection closed|Connection refused|Connection timed out|scp: |rsync: |не се качи|се провали'
_SLOG_OK_RE='без грешки|не е грешка|не е реална грешка|not an error|no error|0 error|no errors|errorlevel 0|BUILD SUCCESSFUL|свеж backup|✓'

# slog_run <choice> — пуска run_choice със захванат изход (екран + лог), после обобщава.
slog_run() {
    local choice="$1"
    mkdir -p "$SLOG_DIR" 2>/dev/null
    local log="$SLOG_DIR/$(date +%Y%m%d-%H%M%S)-opt${choice// /}.log"
    SLOG_CURRENT="$log"
    {
        echo "# Pupikes старт меню — лог на изпълнение"
        echo "# точка: ${choice// /} — $(menu_title "$choice")"
        echo "# начало: $(date '+%F %T')"
        echo "# ============================================================"
    } > "$log"
    local ofd efd opid epid
    exec {ofd}> >(stdbuf -o0 tee -a "$log"); opid=$!
    exec {efd}> >(stdbuf -o0 tee -a "$log" >&2); epid=$!
    export KCY_NO_PAUSE=1              # точката да НЕ прави своята пауза — тя е СЛЕД обобщението (за да се вижда банерът)
    run_choice "$choice" >&$ofd 2>&$efd
    local rc=$?
    unset KCY_NO_PAUSE
    exec {ofd}>&- {efd}>&-
    # НЕ чакаме tee процесите: билд-демони (gradle) остават на заден фон и държат fd-а отворен →
    # `wait` би висял вечно и обобщението нямаше да се стигне. stdbuf -o0 вече е записал всичко.
    sleep 0.2   # микропауза само да флъшне последният ред към лога
    slog_summary "$choice" "$rc" "$log" "${PICK_SRV:-}"
    return $rc
}

# slog_summary <choice> <rc> <log> — брои грешките в лога, реди index.jsonl, печата ЛИЛАВ банер.
slog_summary() {
    local opt="${1// /}" rc="$2" log="$3"
    local where="${4:-${PICK_SRV:-}}"
    local PURPLE=$'\033[1;35m' RED=$'\033[1;31m' GREEN=$'\033[1;32m' YELLOW=$'\033[1;33m' BOLD=$'\033[1m' NC=$'\033[0m'
    local RULE="════════════════════════════════════════════════════════════════════════════════"
    local title; title="$(menu_title "$opt")"

    # редовете-грешки (без ANSI цветовете при броене)
    local errlines errcount=0
    errlines="$(sed $'s/\x1b\\[[0-9;]*m//g' "$log" 2>/dev/null | grep -naiE "$_SLOG_ERR_RE" | grep -aivE "$_SLOG_OK_RE")"

    # SSL/домейн грешки са ОЧАКВАНИ на непублична (LAN/резервна) машина — certbot не може да
    # верифицира домейн, който не сочи към нея. На такава цел ги ИЗВАЖДАМЕ от броя (показваме ги
    # отделно). На публичен production същите грешки СИ броят (там са реален проблем).
    local sslcount=0 sslnote=1
    local _ssl_re='Няма SSL сертификат|failed to authenticate some domains|Certificate Authority failed to verify|Certbot failed to authenticate'
    if printf '%s' "$where" | grep -qE '^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.[0-9]|localhost)'; then
        local _ssl _rest
        _ssl="$(printf '%s\n' "$errlines" | grep -aiE "$_ssl_re")"
        _rest="$(printf '%s\n' "$errlines" | grep -aivE "$_ssl_re")"
        [ -n "$_ssl" ] && sslcount="$(printf '%s\n' "$_ssl" | grep -c .)"
        errlines="$(printf '%s\n' "$_rest" | grep -a . )"
    fi
    [ -n "$errlines" ] && errcount="$(printf '%s\n' "$errlines" | grep -c .)"

    # обобщение в лога
    {
        echo ""
        echo "# ============================================================"
        echo "# КРАЙ: $(date '+%F %T') · изход=$rc · открити грешки=$errcount"
    } >> "$log"

    # машинно-четим индекс (bug-bot го чете за дневната проверка)
    printf '{"ts":"%s","opt":"%s","title":"%s","exit":%s,"errors":%s,"ssl_expected":%s,"log":"%s"}\n' \
        "$(date '+%F %T')" "$opt" "$(printf '%s' "$title" | sed 's/\\/\\\\/g; s/"/\\"/g')" "$rc" "$errcount" "$sslcount" "$(basename "$log")" \
        >> "$SLOG_DIR/index.jsonl"

    # РЕТЕНЦИЯ: пазим последните SLOG_KEEP лога (по подр. 80) — иначе се трупат (~1 MB/пускане).
    # Индексът остава пълен (малък). Триат се само стари .log файлове.
    ls -1t "$SLOG_DIR"/*-opt*.log 2>/dev/null | tail -n "+$(( ${SLOG_KEEP:-80} + 1 ))" | while read -r _old; do rm -f "$_old" 2>/dev/null; done

    # ЛИЛАВ банер на екрана: как приключи + какво изпълни + грешките
    echo ""
    echo -e "${PURPLE}${RULE}${NC}"
    if [ "$rc" -eq 0 ] && [ "$errcount" -eq 0 ]; then
        echo -e "${PURPLE}${BOLD}  ✓ Точка ${opt} — ${title} · приключи УСПЕШНО${NC}"
        echo -e "${PURPLE}     Изход: 0     ·     ${GREEN}${BOLD}Грешки: 0${NC}"
    else
        echo -e "${PURPLE}${BOLD}  ⚠ Точка ${opt} — ${title} · приключи С ГРЕШКИ${NC}"
        echo -e "${PURPLE}     Изход: ${rc}     ·     ${RED}${BOLD}Грешки: ${errcount}${NC}"
        printf '%s\n' "$errlines" | head -20 | sed -E 's/^([0-9]+):/       ред \1: /'
        [ "$errcount" -gt 20 ] && echo -e "${PURPLE}       … и още $((errcount-20)) (виж пълния лог)${NC}"
    fi
    # SSL/домейн грешки на непублична/резервна машина — показваме ги ОТДЕЛНО (не се броят като реални)
    [ "$sslcount" -gt 0 ] && echo -e "${PURPLE}     ${YELLOW}SSL/домейн: ${sslcount} (очаквани — машината не е публична, домейните не сочат към нея)${NC}"
    echo -e "${PURPLE}  Пълен лог: ${log}${NC}"
    echo -e "${PURPLE}${RULE}${NC}"
}
