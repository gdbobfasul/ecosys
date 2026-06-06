#!/bin/bash
# Version: 1.0093
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
    active=$(systemctl is-active "$svc" 2>/dev/null | head -1 | tr -d "\r\n")
    [ -z "$active" ] && active="n/a"
    SVC_STATUS="${SVC_STATUS}${svc}:${active} "
done
append_log services-errors.log "$SVC_STATUS"

# Recent failures — броим И изписваме ИМЕНАТА (иначе не се знае кой пада)
FAILED_LIST=$(systemctl --failed --no-legend --no-pager 2>/dev/null | awk '{print $1}' | grep -v '^$' | tr '\n' ' ')
FAILED=$(echo "$FAILED_LIST" | wc -w)
[ "$FAILED" -gt 0 ] && append_log services-errors.log "⚠ $FAILED failed units: $FAILED_LIST"

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

# API health endpoints (локално) — всеки сървис има различен път
H_CHAT=$(http_check "http://127.0.0.1:3000/api/health")
H_ECO3=$(http_check "http://127.0.0.1:3001/health")
H_PORTALS=$(http_check "http://127.0.0.1:3002/api/portals/health")
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

    # ── Failover + bundle URL верига ──
    FAILOVER_ON="no"
    [ -f /etc/nginx/sites-enabled/kcy-failover ] && FAILOVER_ON="yes"
    if [ "$FAILOVER_ON" = "yes" ]; then
        echo "[$TS]   failover: АКТИВЕН (443 → kcy-failover → upstream)"
        # kcy-backup има ли diag include?
        if [ -f /etc/nginx/sites-available/kcy-backup ]; then
            if grep -q "kcy-diag-proxy" /etc/nginx/sites-available/kcy-backup 2>/dev/null; then
                echo "[$TS]   kcy-backup: има diag include ✓"
            else
                echo "[$TS]   ⚠ kcy-backup НЯМА diag include — bundle URL ще върне index.html!"
            fi
        else
            echo "[$TS]   ⚠ kcy-backup конфиг липсва"
        fi
        # Локален тест 8080 (backup site)
        P8080=$(port_listening 8080)
        echo "[$TS]   port 8080 (backup): $P8080"
    else
        echo "[$TS]   failover: неактивен (443 → директно сайта)"
    fi

    # nginx snippet за diag
    if [ -f /etc/nginx/snippets/kcy-diag-proxy.conf ]; then
        if grep -q "last-errors-bundle" /etc/nginx/snippets/kcy-diag-proxy.conf 2>/dev/null; then
            echo "[$TS]   diag snippet: има bundle location ✓"
        else
            echo "[$TS]   ⚠ diag snippet НЯМА bundle location"
        fi
    else
        echo "[$TS]   ⚠ diag snippet файл липсва"
    fi

    # Тест на цялата bundle верига — публичен URL
    BUNDLE_LOCAL=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "http://127.0.0.1:4400/bundle" 2>/dev/null)
    BUNDLE_CT=$(curl -s -o /dev/null -w "%{content_type}" --max-time 5 "https://127.0.0.1/last-errors-bundle" -k -H "Host: $(hostname -f 2>/dev/null || hostname)" 2>/dev/null)
    echo "[$TS]   bundle 4400 директно: HTTP ${BUNDLE_LOCAL:-down}"
    case "$BUNDLE_CT" in
        text/plain*) echo "[$TS]   bundle публичен URL: OK (text/plain) ✓" ;;
        text/html*)  echo "[$TS]   ⚠ bundle публичен URL връща HTML вместо text/plain — веригата е счупена" ;;
        *)           echo "[$TS]   bundle публичен URL: content-type=${BUNDLE_CT:-неизвестен}" ;;
    esac

    # ── nginx — кои конфиги са активни + техните location блокове ──
    # Това показва ТОЧНО защо /portals/ или /last-errors-bundle падат на index.html.
    echo "[$TS] ── nginx активни конфиги ──"
    for f in /etc/nginx/sites-enabled/*; do
        [ -e "$f" ] || continue
        echo "[$TS]   enabled: $(basename "$f")"
    done
    echo "[$TS] ── nginx location блокове (server_name + location + proxy_pass + root) ──"
    grep -hE "^\s*(server_name|listen|location|proxy_pass|root|include)" /etc/nginx/sites-enabled/* 2>/dev/null \
        | sed "s/^/[$TS]   /" | head -60

    # ── Portals register.html — тест на цялата верига ──
    echo "[$TS] ── Portals static тест ──"
    # 1. Файлът на диска
    for d in /var/www/html/portals /var/www/kcy-ecosystem/public/portals; do
        if [ -f "$d/register.html" ]; then
            echo "[$TS]   файл: $d/register.html съществува ($(wc -c < "$d/register.html") байта)"
        else
            echo "[$TS]   файл: $d/register.html ЛИПСВА"
        fi
    done
    # 2. portals сървис директно (3002)
    R_PORT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "http://127.0.0.1:3002/portals/register.html" 2>/dev/null)
    echo "[$TS]   3002 директно /portals/register.html: HTTP ${R_PORT:-down}"
    # 3. през nginx (публично)
    R_NGINX=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 "https://127.0.0.1/portals/register.html" -H "Host: $(hostname -f 2>/dev/null || hostname)" 2>/dev/null)
    echo "[$TS]   nginx /portals/register.html: HTTP ${R_NGINX:-down}"
    # 4. POST към registration API — статус + content-type + ТЯЛО (за 502 debug)
    REG_BODY=$(curl -s --max-time 5 \
        -X POST "http://127.0.0.1:3002/api/portals/register" \
        -H "Content-Type: application/json" \
        -d '{"username":"__diagtest__","password":"diagpass"}' 2>&1)
    REG_PORT=$(curl -s -o /dev/null -w "%{http_code} %{content_type}" --max-time 4 \
        -X POST "http://127.0.0.1:3002/api/portals/register" \
        -H "Content-Type: application/json" \
        -d '{"username":"__diagtest2__","password":"diagpass"}' 2>/dev/null)
    echo "[$TS]   POST register (3002): $REG_PORT"
    echo "[$TS]   POST register тяло: $(echo "$REG_BODY" | head -c 300 | tr '\n' ' ')"

    # 5. Session тест — регистрирай → пази cookie → провери billing/status със същата сесия
    CJAR=$(mktemp)
    UNAME="__sess_$(date +%s)__"
    curl -s --max-time 5 -c "$CJAR" \
        -X POST "http://127.0.0.1:3002/api/portals/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$UNAME\",\"password\":\"diagpass123\"}" >/dev/null 2>&1
    BILLING_SESS=$(curl -s --max-time 4 -b "$CJAR" -w " [HTTP %{http_code}]" \
        "http://127.0.0.1:3002/api/portals/billing/status" 2>/dev/null | head -c 250 | tr '\n' ' ')
    echo "[$TS]   billing/status СЪС сесия (3002): $BILLING_SESS"
    # Същото през nginx (HTTPS) — проверява дали trust proxy + secure cookie работят
    CJAR2=$(mktemp)
    UNAME2="__sessn_$(date +%s)__"
    curl -sk --max-time 5 -c "$CJAR2" \
        -X POST "https://127.0.0.1/api/portals/register" \
        -H "Host: $(hostname -f 2>/dev/null || hostname)" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$UNAME2\",\"password\":\"diagpass123\"}" >/dev/null 2>&1
    BILLING_NGINX=$(curl -sk --max-time 5 -b "$CJAR2" -w " [HTTP %{http_code}]" \
        "https://127.0.0.1/api/portals/billing/status" \
        -H "Host: $(hostname -f 2>/dev/null || hostname)" 2>/dev/null | head -c 250 | tr '\n' ' ')
    echo "[$TS]   billing/status СЪС сесия (nginx HTTPS): $BILLING_NGINX"
    rm -f "$CJAR" "$CJAR2" 2>/dev/null || true

    # Почисти тестовите потребители (__diagtest%, __sess%) — иначе portal_users
    # се пълни с боклук при всяко пускане. Ползваме sqlite3 CLI ако е наличен,
    # иначе пропускаме тихо (cleanup-ът не е критичен).
    PORTAL_DB_FILE="/var/www/kcy-ecosystem/private/portals/database/portals.db"
    if [ -f "$PORTAL_DB_FILE" ] && command -v sqlite3 >/dev/null 2>&1; then
        DEL=$(sqlite3 "$PORTAL_DB_FILE" \
            "DELETE FROM portal_users WHERE username LIKE '__diagtest%' OR username LIKE '__sess%'; SELECT changes();" 2>/dev/null)
        echo "[$TS]   diag cleanup: изтрити ${DEL:-0} тестови потребителя"
    else
        echo "[$TS]   diag cleanup: пропуснат (sqlite3 CLI липсва)"
    fi

    # 6. Portal games/services страници — тест директно на 3002
    for page in "games" "services"; do
        P_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 \
            "http://127.0.0.1:3002/portals/$page/" 2>/dev/null)
        echo "[$TS]   /portals/$page/ (3002): HTTP ${P_CODE:-TIMEOUT}"
        if [ -f "/var/www/html/portals/index-$page.html" ]; then
            SZ=$(wc -c < "/var/www/html/portals/index-$page.html")
            echo "[$TS]     index-$page.html: $SZ байта"
        else
            echo "[$TS]     index-$page.html: ЛИПСВА"
        fi
    done

    # portals последни 8 реда лог — хваща crash грешката
    echo "[$TS] ── portals journal (последни грешки) ──"
    journalctl -u kcy-portals -n 12 --no-pager 2>/dev/null | tail -12 | sed "s/^/[$TS]   /"
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
    UPTIME_CLEAN=$(uptime -p 2>/dev/null | tr -d '\r\n' | sed 's/"/\\"/g')
    echo "  \"uptime\": \"${UPTIME_CLEAN:--}\","
    echo "  \"memory\": {\"ram_used_mb\":$RAM_USED,\"ram_total_mb\":$RAM_TOTAL,\"swap_used_mb\":${SWAP_USED:-0},\"swap_total_mb\":${SWAP_TOTAL:-0}},"
    echo "  \"disk\": \"$DISK\","
    echo "  \"services\": {"
    first=true
    for svc in nginx kcy-chat kcy-eco3 kcy-portals kcy-diag postgresql; do
        active=$(systemctl is-active "$svc" 2>/dev/null | head -1 | tr -d "\r\n")
        [ -z "$active" ] && active="n/a"
        enabled=$(systemctl is-enabled "$svc" 2>/dev/null | head -1 | tr -d "\r\n")
        [ -z "$enabled" ] && enabled="n/a"
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
