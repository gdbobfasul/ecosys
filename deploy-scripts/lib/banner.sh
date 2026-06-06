#!/usr/bin/env bash
# Споделен завършващ надпис за деплой скриптовете.
# done_banner <target-key> [server] [label]
#   Печата в ЛИЛАВО „ъпдейта на <етикет> завърши". Мапва target ключа:
#     prod → production
#     vm   → virtual machine
#     друго (custom) → label-ът, иначе IP/хоста на сървъра (както е в менюто), иначе „server".
done_banner() {
    local key="$1" server="$2" label="$3" name
    local PURPLE=$'\033[1;35m' NC=$'\033[0m'
    case "$key" in
        prod|production|PROD) name="production" ;;
        vm|VM|virtualmachine) name="virtual machine" ;;
        *)                    name="${label:-${server:-server}}" ;;
    esac
    echo ""
    echo -e "${PURPLE}ъпдейта на ${name} завърши${NC}"
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
