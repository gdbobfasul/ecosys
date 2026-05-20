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

# ─── Автоматична проверка за липсващи node модули ───
# Сканира require() във всеки сървис и сравнява с инсталираните в root node_modules.
# Резултатът влиза в modules-errors.log (и в bundle URL-а).
PD=/var/www/kcy-ecosystem
MODLOG="$OUT/modules-errors.log"
{
    echo "[$TS] [MODULE-CHECK] Проверка на require() vs node_modules"
    # Node вградени модули — пропускат се (не са npm пакети)
    BUILTINS="assert async_hooks buffer child_process cluster console crypto dgram dns domain events fs http http2 https inspector module net os path perf_hooks process punycode querystring readline repl stream string_decoder timers tls trace_events tty url util v8 vm worker_threads zlib"

    for svc_dir in chat eco-3 portals; do
        SVCPATH="$PD/private/$svc_dir"
        [ -d "$SVCPATH" ] || continue

        # Събери всички require() от server.js + routes/middleware/utils/database
        REQUIRED=$(grep -rhoP "require\(['\"]\\K[^'\"./][^'\"]*" \
            "$SVCPATH"/*.js \
            "$SVCPATH"/routes/*.js \
            "$SVCPATH"/middleware/*.js \
            "$SVCPATH"/utils/*.js \
            "$SVCPATH"/database/*.js \
            2>/dev/null | sed -E 's#/.*##' | sort -u)

        MISSING=""
        for mod in $REQUIRED; do
            # Пропусни вградените
            echo "$BUILTINS" | grep -qw "$mod" && continue
            # Провери в root node_modules
            if [ ! -d "$PD/node_modules/$mod" ]; then
                MISSING="$MISSING $mod"
            fi
        done

        if [ -n "$MISSING" ]; then
            echo "[$TS] [MISSING] $svc_dir → липсват модули:$MISSING"
        else
            echo "[$TS] [OK] $svc_dir → всички require() модули са налични"
        fi
    done
} > "$MODLOG"
# Trim
if [ "$(wc -l < "$MODLOG" 2>/dev/null)" -gt "$MAX_LINES" ]; then
    tail -n "$MAX_LINES" "$MODLOG" > "${MODLOG}.tmp" && mv "${MODLOG}.tmp" "$MODLOG"
fi

# ─── Health checks — портове + API endpoints ───
# Проверява дали всеки сървис слуша на порта си и отговаря на health endpoint.
# Резултатът → health-errors.log (bundle) + ENDPOINT_JSON (status.json по-долу).
HEALTHLOG="$OUT/health-errors.log"

# Helper: проверка дали порт слуша
port_listening() {
    ss -tlnp 2>/dev/null | grep -q ":$1 " && echo "yes" || echo "no"
}
# Helper: HTTP проверка на endpoint (връща HTTP код или "down")
http_check() {
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "$1" 2>/dev/null)
    [ -z "$code" ] || [ "$code" = "000" ] && echo "down" || echo "$code"
}

# Портове на сървисите
P_CHAT=$(port_listening 3000)
P_ECO3=$(port_listening 3001)
P_PORTALS=$(port_listening 3002)
P_DIAG=$(port_listening 4400)

# API health endpoints (локално)
H_CHAT=$(http_check "http://127.0.0.1:3000/api/health")
H_ECO3=$(http_check "http://127.0.0.1:3001/health")
H_PORTALS=$(http_check "http://127.0.0.1:3002/health")
H_DIAG=$(http_check "http://127.0.0.1:4400/health")

{
    echo "[$TS] [HEALTH-CHECK] портове + endpoints"
    echo "[$TS]   chat    : port 3000=$P_CHAT  /api/health=$H_CHAT"
    echo "[$TS]   eco-3   : port 3001=$P_ECO3  /health=$H_ECO3"
    echo "[$TS]   portals : port 3002=$P_PORTALS  /health=$H_PORTALS"
    echo "[$TS]   diag    : port 4400=$P_DIAG  /health=$H_DIAG"
    # Маркирай проблемите изрично
    for svc_check in "chat:$P_CHAT:$H_CHAT" "eco-3:$P_ECO3:$H_ECO3" "portals:$P_PORTALS:$H_PORTALS" "diag:$P_DIAG:$H_DIAG"; do
        name="${svc_check%%:*}"
        rest="${svc_check#*:}"
        port="${rest%%:*}"
        http="${rest##*:}"
        if [ "$port" = "no" ]; then
            echo "[$TS]   ⚠ $name НЕ слуша на порта си — сървисът вероятно е паднал"
        elif [ "$http" = "down" ]; then
            echo "[$TS]   ⚠ $name слуша но health endpoint не отговаря"
        elif [ "$http" != "200" ]; then
            echo "[$TS]   ⚠ $name health endpoint върна HTTP $http (очаквано 200)"
        fi
    done
    # nginx config + failover състояние
    if nginx -t >/dev/null 2>&1; then
        echo "[$TS]   nginx config: OK"
    else
        echo "[$TS]   ⚠ nginx config НЕВАЛИДЕН — виж: nginx -t"
    fi
    if [ -f /etc/nginx/sites-enabled/kcy-failover ]; then
        echo "[$TS]   failover: АКТИВЕН"
    else
        echo "[$TS]   failover: неактивен (сайтът се сервира директно)"
    fi
} > "$HEALTHLOG"
if [ "$(wc -l < "$HEALTHLOG" 2>/dev/null)" -gt "$MAX_LINES" ]; then
    tail -n "$MAX_LINES" "$HEALTHLOG" > "${HEALTHLOG}.tmp" && mv "${HEALTHLOG}.tmp" "$HEALTHLOG"
fi

# JSON фрагмент за status.json
ENDPOINT_JSON="\"endpoints\": {
    \"chat\": {\"port_3000\":\"$P_CHAT\",\"health\":\"$H_CHAT\"},
    \"eco3\": {\"port_3001\":\"$P_ECO3\",\"health\":\"$H_ECO3\"},
    \"portals\": {\"port_3002\":\"$P_PORTALS\",\"health\":\"$H_PORTALS\"},
    \"diag\": {\"port_4400\":\"$P_DIAG\",\"health\":\"$H_DIAG\"}
  }"

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
    echo "  $ENDPOINT_JSON,"
    echo "  \"checks\": {"
    PD=/var/www/kcy-ecosystem
    echo "    \"env_file\":$([ -f $PD/private/configs/.env ] && echo true || echo false),"
    # npm workspaces — всичко е в root node_modules, не в sub-директориите
    echo "    \"root_node_modules\":$([ -d $PD/node_modules ] && echo true || echo false),"
    echo "    \"express\":$([ -d $PD/node_modules/express ] && echo true || echo false),"
    echo "    \"sharp\":$([ -d $PD/node_modules/sharp ] && echo true || echo false),"
    echo "    \"better_sqlite3\":$([ -d $PD/node_modules/better-sqlite3 ] && echo true || echo false),"
    echo "    \"portal_db\":$([ -f $PD/private/portals/database/portals.db ] && echo true || echo false),"
    # Има ли липсващи модули (от MODULE-CHECK секцията)
    echo "    \"missing_modules\":$(grep -q '\[MISSING\]' "$MODLOG" 2>/dev/null && echo true || echo false),"
    echo "    \"nginx_config_valid\":$(nginx -t >/dev/null 2>&1 && echo true || echo false)"
    echo "  }"
    echo "}"
} > "$OUT/status.json.tmp" && mv "$OUT/status.json.tmp" "$OUT/status.json"

# Permissions — nginx (www-data) трябва да чете
chown -R root:www-data "$OUT" 2>/dev/null || chown -R root:root "$OUT"
chmod 755 "$OUT"
find "$OUT" -type f -exec chmod 644 {} \;

exit 0
