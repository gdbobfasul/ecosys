#!/usr/bin/env bash
# Споделен завършващ надпис за деплой скриптовете.
# done_banner <target-key> [server] [label]
#   Печата в ЛИЛАВО „обновяването на <име> завърши" — ЧИСТ БЪЛГАРСКИ, без заемки.
#   Мапва target ключа към българско име:
#     prod        → основния сървър
#     prodts      → основния сървър (Tailscale)   (същият основен сървър, но през Tailscale)
#     vm          → виртуалната машина
#     друго (custom) → етикета, иначе „сървъра" (НИКОГА голо IP).
done_banner() {
    local key="$1" server="$2" label="$3" name script
    local PURPLE=$'\033[1;35m' NC=$'\033[0m'
    script="${0##*/}"          # КОЙ скрипт приключи (име на файла, напр. 04-deploy.sh)
    [ -z "$script" ] && script="скриптът"
    case "$key" in
        prod|production|PROD)      name="основния сървър" ;;
        prodts|prodTS|PRODTS)      name="основния сървър (Tailscale)" ;;
        vm|VM|virtualmachine)      name="виртуалната машина" ;;
        *)                         name="${label:-сървъра}" ;;
    esac
    # Предпазител: ако name по някаква причина е голо IP (IPv4) — не го показвай, ползвай „сървъра".
    case "$name" in
        [0-9]*.[0-9]*.[0-9]*.[0-9]*) name="сървъра" ;;
    esac
    echo ""
    echo -e "${PURPLE}скрипт ${script} приключи · обновяването на ${name} завърши${NC}"
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
