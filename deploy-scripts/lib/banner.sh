#!/usr/bin/env bash
# Version: 1.0219
# Споделен завършващ надпис за деплой скриптовете.
#
# ПРАВИЛО (изрично искане на потребителя): в КРАЯ на всяка точка се изписва
#   1) КОЯ ТОЧКА ОТ СТАРТ МЕНЮТО е извикана (номер + какво прави) — НИКОГА името на
#      скрипта-файл и НИКОГА името на услуга/технология (Tailscale и т.н.);
#   2) НА КОЙ СЪРВЪР е изпълнено (българското име на целта + адресът ѝ в скоби).
# Точката идва от старт менюто през средата: 00-menu.sh изнася KCY_MENU_OPT и
# KCY_MENU_TITLE в print_start_banner, преди да пусне точката. Ако скриптът е пуснат
# НА РЪКА (извън менюто), честно пишем „(пуснато ръчно, извън старт менюто)" — пак
# БЕЗ име на файл.
#
# done_banner <target-key> [server] [label]
#   Мапва target ключа към българско име на машината:
#     prod / prodts  → основния сървър   (prodts е СЪЩИЯТ сървър — маршрутът НЕ се споменава)
#     vm             → виртуалната машина
#     друго (custom) → етикета, иначе „сървъра"
#   Адресът (server) се добавя в скоби — потребителят иска да ВИЖДА на кой сървър е минало.
done_banner() {
    local key="$1" server="$2" label="$3" name head
    local PURPLE=$'\033[1;35m' BOLD=$'\033[1m' NC=$'\033[0m'
    case "$key" in
        prod|production|PROD|prodts|prodTS|PRODTS) name="основния сървър" ;;
        vm|VM|virtualmachine)                      name="виртуалната машина" ;;
        *)                                         name="${label:-сървъра}" ;;
    esac
    if [ -n "${KCY_MENU_OPT:-}" ]; then
        head="Точка ${KCY_MENU_OPT} от старт менюто${KCY_MENU_TITLE:+ — „${KCY_MENU_TITLE}“}"
    else
        head="Действието (пуснато ръчно, извън старт менюто)"
    fi
    echo ""
    echo -e "${PURPLE}${BOLD}✓ ${head} · завърши успешно${NC}"
    echo -e "${PURPLE}  Изпълнено на: ${name}${server:+ (${server})}${NC}"
    echo ""
}

# Закача се веднъж: при УСПЕШЕН изход (код 0) печата надписа.
# Употреба:  arm_done_banner "$TNAME" "$SERVER" "$LABEL"  (след резолвване на target-а)
# KCY_SUPPRESS_DONE=1 изключва надписа (напр. когато 02 вика 04 вътрешно — за да не е 2 пъти).
arm_done_banner() {
    [ "${KCY_SUPPRESS_DONE:-0}" = "1" ] && return 0
    _DONE_KEY="$1"; _DONE_SRV="$2"; _DONE_LABEL="$3"
    trap '[ $? -eq 0 ] && done_banner "${_DONE_KEY:-}" "${_DONE_SRV:-}" "${_DONE_LABEL:-}"' EXIT
}
