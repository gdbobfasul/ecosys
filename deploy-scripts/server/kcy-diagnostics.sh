#!/bin/bash
# Version: 1.0091
##############################################################################
# KCY Ecosystem — Diagnostics log appender
#
# Извиква се от:
#   • /api/diag/regen (kcy-diag service) — когато admin-status страницата зареди
#   • Manually за тестове
#
# Append-ва кратки [SNAPSHOT] записи в съществуващите .log файлове.
# Не пише ВСИЧКО — само ключови facts ("status now"). Service-ите сами си пишат
# stage логовете при изпълнение.
#
# Файлове в /var/www/html/last-errors/:
#   memory-errors.log    services-errors.log    web-errors.log
#   chat-errors.log      eco3-errors.log         portal-errors.log
#   token-errors.log     berich1-errors.log      multisig-errors.log
#   status.json          (machine-readable)
##############################################################################

set -u
OUT="/var/www/html/last-errors"
mkdir -p "$OUT"
TS=$(date '+%Y-%m-%dT%H:%M:%S')
MAX_LINES=200

append_log() {
    local file="$OUT/$1"; shift
    echo "[$TS] [SNAPSHOT] $*" >> "$file"
    # Trim — keep last MAX_LINES редове
    if [ -f "$file" ] && [ "$(wc -l < "$file" 2>/dev/null)" -gt "$MAX_LINES" ]; then
        tail -n "$MAX_LINES" "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    fi
}

# ─── memory-errors.log ───
RAM_USED=$(free -m | awk '/^Mem:/ {print $3}')
RAM_TOTAL=$(free -m | awk '/^Mem:/ {print $2}')
SWAP_USED=$(free -m | awk '/^Swap:/ {print $3}')
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
append_log memory-errors.log "RAM ${RAM_USED}/${RAM_TOTAL}MB · Swap ${SWAP_USED}/${SWAP_TOTAL}MB"

# OOM kills скорошни (само ако има)
RECENT_OOM=$(dmesg 2>/dev/null | grep -ic "killed process\|out of memory" || echo 0)
if [ "${RECENT_OOM}" -gt 0 ]; then
    append_log memory-errors.log "⚠ Имало е $RECENT_OOM OOM събития в dmesg"
fi

# ─── services-errors.log — статус на услугите ───
SVC_STATUS=""
for svc in nginx kcy-chat kcy-eco3 kcy-portals kcy-diag postgresql; do
    active=$(systemctl is-active "$svc" 2>/dev/null || echo "n/a")
    SVC_STATUS="${SVC_STATUS}${svc}:${active} "
done
append_log services-errors.log "$SVC_STATUS"

# Recent failures
FAILED=$(systemctl --failed --no-legend --no-pager 2>/dev/null | wc -l)
[ "$FAILED" -gt 0 ] && append_log services-errors.log "⚠ $FAILED failed units (systemctl --failed)"

# ─── disk ───
DISK=$(df -h / 2>/dev/null | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')
append_log services-errors.log "disk / · $DISK"

# ─── web-errors.log — nginx tail ───
if [ -f /var/log/nginx/error.log ]; then
    NGINX_RECENT=$(tail -20 /var/log/nginx/error.log 2>/dev/null)
    if [ -n "$NGINX_RECENT" ]; then
        {
            echo "[$TS] [SNAPSHOT] nginx error.log tail -20:"
            echo "$NGINX_RECENT" | sed 's/^/    /'
        } >> "$OUT/web-errors.log"
    fi
fi

# ─── per-service journalctl tails (последни 20 реда) ───
for pair in "kcy-chat:chat-errors.log" "kcy-eco3:eco3-errors.log" "kcy-portals:portal-errors.log"; do
    svc="${pair%:*}"
    log="${pair#*:}"
    if systemctl list-units --all "${svc}.service" --no-legend 2>/dev/null | grep -q "$svc"; then
        TAIL=$(journalctl -u "$svc" -n 20 --no-pager 2>/dev/null | tail -20)
        {
            echo "[$TS] [SNAPSHOT] journalctl -u $svc -n 20:"
            echo "$TAIL" | sed 's/^/    /'
        } >> "$OUT/$log"
    fi
done

# Trim per-service
for f in chat-errors.log eco3-errors.log portal-errors.log web-errors.log; do
    file="$OUT/$f"
    if [ -f "$file" ] && [ "$(wc -l < "$file" 2>/dev/null)" -gt "$MAX_LINES" ]; then
        tail -n "$MAX_LINES" "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    fi
done

# ─── status.json (за UI cards) ───
{
    echo "{"
    echo "  \"generated\": \"$TS\","
    echo "  \"hostname\": \"$(hostname)\","
    echo "  \"uptime\": \"$(uptime -p 2>/dev/null || echo '-')\","
    echo "  \"memory\": {\"ram_used_mb\":$RAM_USED,\"ram_total_mb\":$RAM_TOTAL,\"swap_used_mb\":${SWAP_USED:-0},\"swap_total_mb\":${SWAP_TOTAL:-0}},"
    echo "  \"disk\": \"$DISK\","
    echo "  \"services\": {"
    first=true
    for svc in nginx kcy-chat kcy-eco3 kcy-portals kcy-diag postgresql; do
        active=$(systemctl is-active "$svc" 2>/dev/null || echo "n/a")
        enabled=$(systemctl is-enabled "$svc" 2>/dev/null || echo "n/a")
        restarts=$(systemctl show "$svc" --property=NRestarts --value 2>/dev/null || echo "0")
        $first || echo ","
        first=false
        echo -n "    \"$svc\": {\"active\":\"$active\",\"enabled\":\"$enabled\",\"restarts\":$restarts}"
    done
    echo ""
    echo "  },"
    echo "  \"checks\": {"
    PD=/var/www/kcy-ecosystem
    echo "    \"env_file\":$([ -f $PD/private/configs/.env ] && echo true || echo false),"
    echo "    \"chat_node_modules\":$([ -d $PD/private/chat/node_modules ] && echo true || echo false),"
    echo "    \"eco3_node_modules\":$([ -d $PD/private/eco-3/node_modules ] && echo true || echo false),"
    echo "    \"portals_node_modules\":$([ -d $PD/private/portals/node_modules ] && echo true || echo false),"
    echo "    \"portal_db\":$([ -f $PD/private/portals/database/portals.db ] && echo true || echo false),"
    echo "    \"nginx_config_valid\":$(nginx -t >/dev/null 2>&1 && echo true || echo false)"
    echo "  }"
    echo "}"
} > "$OUT/status.json.tmp" && mv "$OUT/status.json.tmp" "$OUT/status.json"

# Permissions — nginx (www-data) трябва да чете
chown -R root:www-data "$OUT" 2>/dev/null || chown -R root:root "$OUT"
chmod 755 "$OUT"
find "$OUT" -type f -exec chmod 644 {} \;

exit 0
