#!/bin/bash
# Version: 1.0199
##############################################################################
# KCY — Отделните приложни домейни + SSL (чете private/configs/domains.conf).
#
# Главният домейн (take.offbitch.com) + неговият nginx/SSL се правят от
# 05-server-install (опция 4/2). ТУК са САМО допълнителните домейни:
#   find.jwork.ru → wnb · look.myhousesetup.com → hlb · my.girl.place/kaji → chat
# Всеки показва САМО своето приложение (другите пътища → index) + по 1 SSL.
#
# SSL през WEBROOT (НЕ --nginx): challenge-ът се сервира от
# /var/www/html/.well-known/acme-challenge/ → имунен на HTTP→HTTPS редиректи
# (старият --nginx --redirect редиректваше challenge-а към 443 → 404).
# 2 паса: (1) HTTP блокове → webroot certonly → (2) добавяме 443 блокове.
# generate_conf регенерира файла от 0 при ВСЯКО пускане → чисти счупени стари
# certbot записи. НЕ пипа главния nginx конфиг и НЕ инсталира node/npm.
# Usage: sudo ./08-setup-domain.sh
##############################################################################
set -u
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

echo -e "${CYAN}========================================"
echo "  KCY — Приложни домейни + SSL (webroot)"
echo -e "========================================${NC}"

[ "$(id -u)" -eq 0 ] || { echo -e "${RED}Пусни като root (sudo).${NC}"; exit 1; }

PROJECT_DIR="/var/www/kcy-ecosystem"
DOMAINS_CONF="$PROJECT_DIR/private/configs/domains.conf"
[ -f "$DOMAINS_CONF" ] || { echo -e "${RED}Липсва $DOMAINS_CONF — пусни деплой (опция 4) първо.${NC}"; exit 1; }
. "$DOMAINS_CONF"
EMAIL="${SSL_EMAIL:-admin@${MAIN_DOMAIN:-localhost}}"

if [ -z "${APP_DOMAIN_MAP:-}" ]; then
    echo -e "${YELLOW}Няма APP_DOMAIN_MAP в конфига — нищо за правене.${NC}"; exit 0
fi

echo -e "  Главен домейн (от 05): ${GREEN}${MAIN_DOMAIN}${NC}"
echo -e "  Имейл за Let's Encrypt: ${GREEN}${EMAIL}${NC}"
read -p "  Enter за този имейл, или нов: " NE
[ -n "$NE" ] && EMAIL="$NE"

# ── IPv4 предпочитание за certbot ──
# Машина с IPv6 адрес, но БЕЗ IPv6 маршрут (какъвто е VPS-ът) кара python/certbot
# да пробва първо IPv6 → „Network is unreachable" и подновяването пада. curl оцелява
# (пада сам на IPv4), certbot НЕ. Редът в /etc/gai.conf кара getaddrinfo да предпочита
# IPv4 системно (certbot/apt/python), БЕЗ да пипа мрежата. Слага се само при нужда.
if ! ip -6 route show default 2>/dev/null | grep -q .; then
    if ! grep -q '^precedence ::ffff:0:0/96 100' /etc/gai.conf 2>/dev/null; then
        echo 'precedence ::ffff:0:0/96 100' >> /etc/gai.conf
        echo -e "  ${GREEN}✓ /etc/gai.conf: добавено IPv4 предпочитание (няма IPv6 маршрут → certbot падаше)${NC}"
    else
        echo -e "  ${GREEN}✓ /etc/gai.conf: IPv4 предпочитанието вече е налице${NC}"
    fi
fi

# certbot (БЕЗ node/npm — конфликтват с NodeSource nodejs). Webroot не иска nginx-плъгина.
if ! command -v certbot >/dev/null 2>&1; then
    echo -e "${CYAN}Инсталирам certbot...${NC}"
    apt-get update -qq && apt-get install -y certbot >/dev/null 2>&1 || true
fi

# Папката, от която nginx сервира ACME challenge-а (общ webroot за всички домейни).
mkdir -p /var/www/html/.well-known/acme-challenge
chmod -R 755 /var/www/html/.well-known 2>/dev/null || true

APP_CONF="/etc/nginx/sites-available/kcy-app-domains.conf"
APK_HTPASSWD="/etc/nginx/pupikes-apk.htpasswd"

# APK gating за pupikes.app: всички .apk/.exe в /apk са зад ПАРОЛА, освен публичните
# (show+download от app-shared/pupikes-catalog.json). Емитва nginx location-и (ползва се
# в build_locations само когато ключът има APKGATE=1). ROOTът на домейна е /var/www/html/apk,
# затова файловете са на КОРЕНА (pupikes.app/<файл>.apk), не под /apk/ префикс.
apk_gate_locations() {
    local catalog="$PROJECT_DIR/app-shared/pupikes-catalog.json"
    # публичните файлове → без парола (exact-match location, бие regex-а долу)
    if [ -f "$catalog" ] && command -v node >/dev/null 2>&1; then
        node -e '
            const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
            const files=new Set();
            (c.groups||[]).forEach(g=>(g.apps||[]).forEach(a=>{ if(a.show&&a.download&&a.apk){ if(a.apk.rustore)files.add(a.apk.rustore); if(a.apk.huawei)files.add(a.apk.huawei);} }));
            [...files].forEach(f=>process.stdout.write("    location = /"+f+" { auth_basic off; }\n"));
        ' "$catalog" 2>/dev/null
    fi
    # всичко останало .apk/.exe → парола
    printf '    location ~* \\.(apk|exe)$ { auth_basic "Pupikes - po pokana"; auth_basic_user_file %s; }\n' "$APK_HTPASSWD"
}

# pupikes.app КАТАЛОГ: root=/var/www/html/apk. САМО каталог index.html + сваляне на APK
# (публичните свободно, скритите зад парола). БЕЗ портали/чат/нищо друго.
catalog_locations() {
    apk_gate_locations
    # Каталог (НЕ SPA): голият домейн → index.html (през `index`); липсващ път → 404.
    # НЕ ползваме /index.html като try_files fallback — при липсващ index.html това прави
    # вътрешен редирект-цикъл → nginx връща 500. С =404 такъв цикъл е невъзможен.
    printf '    location / { try_files $uri $uri/ =404; }\n'
}

# pupikes.com ХЪБ: РАЗРЕШЕНИ само приложенията в $HUB_ALLOW (напр. portals chat) — работят
# заедно с поддиректориите си; ВСЕКИ друг път → 301 към $HUB_REDIRECT_ELSE (pupikes.app).
# Приложение на СОБСТВЕН път (портали, DIR=/portals/) → проксира се тук. Приложение-корен
# със СОБСТВЕН домейн (чат, има APP_chat_PUBLIC) → пътят му води на неговия домейн.
hub_locations() {
    local akey aDIR aPORT aAPI aSERVE aPUBLIC
    local PH='proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 86400;'
    for akey in $HUB_ALLOW; do
        aDIR=$(eval "echo \${APP_${akey}_DIR}")
        aPORT=$(eval "echo \${APP_${akey}_PORT}")
        aAPI=$(eval "echo \${APP_${akey}_API}")
        aPUBLIC=$(eval "echo \${APP_${akey}_PUBLIC:-}")
        [ -z "$aDIR" ] && continue
        aSERVE="${aDIR%public/}"
        case "$aDIR" in
          */public/)  # приложение-корен (чат): води пътя към собствения му домейн, ако има
            if [ -n "$aPUBLIC" ]; then
                printf '    location = %s { return 301 https://%s/; }\n' "${aSERVE%/}" "$aPUBLIC"
                printf '    location ^~ %s { return 301 https://%s/; }\n' "$aSERVE" "$aPUBLIC"
            else
                printf '    location ^~ %s { proxy_pass http://127.0.0.1:%s; %s }\n' "$aSERVE" "$aPORT" "$PH"
                printf '    location ^~ %s { proxy_pass http://127.0.0.1:%s; %s }\n' "$aAPI" "$aPORT" "$PH"
                printf '    location ^~ /socket.io/ { proxy_pass http://127.0.0.1:%s; %s }\n' "$aPORT" "$PH"
            fi
            ;;
          *)  # приложение на собствен път (портали): проксира се на пътя + API-то му
            printf '    location ^~ %s { proxy_pass http://127.0.0.1:%s; %s }\n' "$aAPI" "$aPORT" "$PH"
            printf '    location ^~ %s { proxy_pass http://127.0.0.1:%s; %s }\n' "$aSERVE" "$aPORT" "$PH"
            ;;
        esac
    done
    printf '    location ^~ /shared/       { root /var/www/html; }\n'
    printf '    location ^~ /translations/ { root /var/www/html; }\n'
    printf '    location ^~ /assets/       { root /var/www/html; }\n'
    # ВСИЧКО ДРУГО (голият домейн + всеки неразрешен път) → pupikes.app (пази пътя)
    printf '    location / { return 301 %s$request_uri; }\n' "$HUB_REDIRECT_ELSE"
}

# Роля на машината за X-Served-By: PROD (живия ams-chat) или VM (всичко друго)
case "$(hostname)" in ams-chat*) KCY_ROLE="PROD" ;; *) KCY_ROLE="VM" ;; esac

# Вътрешните локации на приложението (printf + единични кавички → nginx променливите
# като $host остават литерални; разширяват се само %s = API/PORT/SERVE).
build_locations() {  # ползва $API $PORT $SERVE $NESTED от извикващия
    printf '    location ^~ %s { proxy_pass http://127.0.0.1:%s; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 86400; }\n' "$API" "$PORT"
    # PORTALS (порт 3002) на ВСЕКИ приложен домейн — споделеният админ вход + системното
    # меню (system-nav.js вика /api/portals/ip-admin и /api/portals/me на ВСЯКА страница)
    # + /shared/admin-status.html. Без тези блокове /portals/login.html и /api/portals/*
    # падаха в SPA fallback-а (location /) → връщаха index.html на чата (="връща ме на
    # главната"). `^~` + най-дълъг префикс → /api/portals/ печели пред /api/ на чата.
    printf '    location ^~ /api/portals/ { proxy_pass http://127.0.0.1:3002; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 86400; }\n'
    printf '    location ^~ /portals/ { proxy_pass http://127.0.0.1:3002; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 86400; }\n'
    # WATCH релеят (Baby Radar / camera-watch, порт 3013 = selflearning relay) на ВСЕКИ
    # приложен домейн: апът по подразбиране бие selflearning.bot.nu/api/watch/..., а този
    # префикс досега падаше в SPA fallback-а (GET → index.html, POST → 405) → „не се връзват".
    # client_max_body_size 3m — кадрите от детегледачката са JSON с base64 снимка.
    printf '    location ^~ /api/watch/ { proxy_pass http://127.0.0.1:3013; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 60; client_max_body_size 3m; }\n'
    if [ "$NESTED" = "1" ]; then
        printf '    location ^~ /socket.io/ { proxy_pass http://127.0.0.1:%s; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }\n' "$PORT"
        printf '    location ^~ /uploads/ { proxy_pass http://127.0.0.1:%s; proxy_set_header Host $host; }\n' "$PORT"
        printf '    location ^~ %s { root /var/www/html; }\n' "$SERVE"
    else
        printf '    location ^~ /uploads/ { proxy_pass http://127.0.0.1:%s; proxy_set_header Host $host; }\n' "$PORT"
    fi
    printf '    location ^~ /shared/       { root /var/www/html; }\n'
    printf '    location ^~ /translations/ { root /var/www/html; }\n'
    printf '    location ^~ /assets/       { root /var/www/html; }\n'
    printf '    location ^~ /downloads/    { root /var/www/html; }\n'
    # /privacy/ — статични страници за поверителност на приложенията (за магазините).
    # Адресите са ПОСТОЯННИ, докато приложението е активно (не се сменят):
    #   /privacy/newslator/hw-privacy.html  (Huawei AppGallery)
    #   /privacy/newslator/ru-privacy.html  (RuStore)
    # Сервира се от /var/www/html/privacy/ на ВСЕКИ приложен домейн (вкл. selflearning.bot.nu).
    printf '    location ^~ /privacy/      { root /var/www/html; }\n'
    printf '    location / { try_files $uri $uri/ /index.html; }\n'
}

# Генерирай целия kcy-app-domains.conf от 0. За домейн със сертификат → 80(redirect)+443;
# без сертификат → само 80 (за да работи преди SSL и да мине ACME).
generate_conf() {
    : > "$APP_CONF"
    printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
        [ -z "$dom" ] && continue
        # ── Пренасочващ домейн (само 301 към друг адрес, не сервира приложение) ──
        REDIR=$(eval "echo \${APP_${key}_REDIRECT:-}")
        if [ -n "$REDIR" ]; then
            CERT="/etc/letsencrypt/live/$dom/fullchain.pem"
            if [ -f "$CERT" ]; then
                cat >> "$APP_CONF" <<EOF
server {
    listen 80; server_name $dom;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
    location / { return 301 ${REDIR}\$request_uri; }
}
server {
    listen 443 ssl; server_name $dom;
    ssl_certificate     /etc/letsencrypt/live/$dom/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$dom/privkey.pem;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
    location / { return 301 ${REDIR}\$request_uri; }
}
EOF
                echo -e "  ${GREEN}✓ $dom → 301 ${REDIR} (HTTPS)${NC}"
            else
                cat >> "$APP_CONF" <<EOF
server {
    listen 80; server_name $dom;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
    location / { return 301 ${REDIR}\$request_uri; }
}
EOF
                echo -e "  ${GREEN}✓ $dom → 301 ${REDIR} (HTTP само — чака SSL)${NC}"
            fi
            continue
        fi
        # ── ХЪБ домейн (pupikes.com): разрешени приложения + redirect-else ──
        ALLOW=$(eval "echo \${APP_${key}_ALLOW:-}")
        if [ -n "$ALLOW" ]; then
            HUB_ALLOW="$ALLOW"
            HUB_REDIRECT_ELSE=$(eval "echo \${APP_${key}_REDIRECT_ELSE:-https://pupikes.app}")
            ROOTDIR="/var/www/html"
            LOC="$(hub_locations)"
        else
            DIR=$(eval "echo \${APP_${key}_DIR}")
            PORT=$(eval "echo \${APP_${key}_PORT}")
            API=$(eval "echo \${APP_${key}_API}")
            if [ -z "$DIR" ] || [ -z "$PORT" ] || [ -z "$API" ]; then
                echo -e "  ${YELLOW}! непознат ключ '$key' за $dom — пропускам${NC}"; continue
            fi
            SERVE="${DIR%public/}"
            FS=$(eval "echo \${APP_${key}_FS}"); [ -z "$FS" ] && FS="${DIR#/}"
            ROOTDIR="/var/www/html/${FS%/}"
            case "$DIR" in */public/) NESTED=1 ;; *) NESTED=0 ;; esac
            # КАТАЛОГ домейн (pupikes.app, APKGATE=1): само каталог + APK; иначе нормалното приложение
            if [ "$(eval "echo \${APP_${key}_APKGATE:-}")" = "1" ]; then
                LOC="$(catalog_locations)"
            else
                LOC="$(build_locations)"
            fi
        fi
        CERT="/etc/letsencrypt/live/$dom/fullchain.pem"
        if [ -f "$CERT" ]; then
            cat >> "$APP_CONF" <<EOF
server {
    listen 80;
    server_name $dom;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl;
    server_name $dom;
    root $ROOTDIR;
    index index.html;
    ssl_certificate     /etc/letsencrypt/live/$dom/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$dom/privkey.pem;
    add_header X-Served-By "${KCY_ROLE}" always;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
$LOC
}
EOF
            echo -e "  ${GREEN}✓ $dom → $key  (HTTPS, root=$ROOTDIR :$PORT)${NC}"
        else
            cat >> "$APP_CONF" <<EOF
server {
    listen 80;
    server_name $dom;
    root $ROOTDIR;
    index index.html;
    add_header X-Served-By "${KCY_ROLE}" always;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; allow all; default_type "text/plain"; }
$LOC
}
EOF
            echo -e "  ${GREEN}✓ $dom → $key  (HTTP само — чака SSL, root=$ROOTDIR :$PORT)${NC}"
        fi
    done
    ln -sf "$APP_CONF" /etc/nginx/sites-enabled/kcy-app-domains.conf
}

# Публикува статичните правни страници: копира */publish/*-privacy.html И */publish/*-terms.html
# от репото в /var/www/html/privacy/<приложение>/, откъдето nginx ги сервира (изискване на
# магазините — Huawei 7.2/7.1 privacy + Общи условия за legal-gate „екран 3"; RuStore). No-op с
# предупреждение, ако липсват.
sync_privacy_pages() {
    local dest_root="/var/www/html/privacy" n=0 f pubdir appdir app
    mkdir -p "$dest_root"
    while IFS= read -r f; do
        [ -f "$f" ] || continue
        pubdir="$(dirname "$f")"          # .../<приложение>/publish
        appdir="$(dirname "$pubdir")"     # .../<приложение>
        app="$(basename "$appdir")"
        mkdir -p "$dest_root/$app"
        cp -f "$f" "$dest_root/$app/" && n=$((n+1))
    done <<EOF
$(find "$PROJECT_DIR" -type f \( -name '*-privacy.html' -o -name '*-terms.html' \) -path '*/publish/*' 2>/dev/null)
EOF
    chmod -R 755 "$dest_root" 2>/dev/null || true
    if [ "$n" -gt 0 ]; then
        echo -e "  ${GREEN}✓ публикувани $n правни страници (privacy + terms) в $dest_root${NC}"
    else
        echo -e "  ${YELLOW}! няма *-privacy.html / *-terms.html под $PROJECT_DIR — качи ги ръчно в $dest_root/<приложение>/${NC}"
    fi
}

# Пълни root-а на pupikes.app (/var/www/html/apk): каталог index.html + catalog.json + лого
# + всички построени APK/EXE от репо-папката apk/. Без това root-ът е празен → голият домейн
# прави редирект-цикъл (500). Публичните APK се свалят свободно, скритите искат парола (nginx).
sync_pupikes_catalog() {
    # има ли изобщо APKGATE домейн? ако не → нищо за правене
    printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do [ -n "$key" ] && [ "$(eval "echo \${APP_${key}_APKGATE:-}")" = "1" ] && exit 7; done
    [ $? -ne 7 ] && return 0
    local dest="/var/www/html/apk" apks="$PROJECT_DIR/apk"
    mkdir -p "$dest"
    # 1) каталог страница + данни + лого — ЖИВЕЯТ В apk/ (в git); apk/ е папката на pupikes.app.
    local got=0 cf
    for cf in index.html catalog.json pupikes-logo.svg; do
        [ -f "$apks/$cf" ] && cp -f "$apks/$cf" "$dest/$cf" 2>/dev/null && got=$((got+1))
    done
    if [ "$got" -gt 0 ]; then echo -e "  ${GREEN}✓ каталог ($got файла) → $dest${NC}"
    else echo -e "  ${YELLOW}! няма каталог в $apks — качи папката apk/ (index.html/catalog.json/лого) на сървъра${NC}"; fi
    # 2) всички построени APK/EXE → root-а (nginx решава кои са публични/зад парола)
    local n=0 f
    if [ -d "$apks" ]; then
        for f in "$apks"/*.apk "$apks"/*.exe; do [ -f "$f" ] && { cp -f "$f" "$dest/" && n=$((n+1)); }; done
    fi
    chmod -R 755 "$dest" 2>/dev/null || true
    if [ "$n" -gt 0 ]; then echo -e "  ${GREEN}✓ $n APK/EXE → $dest (публичните свободно, скритите с парола)${NC}"
    else echo -e "  ${YELLOW}! няма построени APK в $apks — каталогът зарежда, но свалянето ще е 404, докато не билднеш+качиш${NC}"; fi
}

# ── Публикувай правните страници (privacy + terms) за магазините ──
echo -e "${CYAN}Публикувам правни страници (privacy + terms)...${NC}"
sync_privacy_pages

# ── Пълни pupikes.app root-а (каталог + APK) — иначе голият домейн 500 (редирект-цикъл) ──
echo -e "${CYAN}Пълня pupikes.app каталога (/var/www/html/apk)...${NC}"
sync_pupikes_catalog

# ── APK парола: осигури htpasswd файла (иначе auth_basic_user_file → nginx -t пада) ──
NEED_HTPASSWD=0
printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do [ -n "$key" ] && [ "$(eval "echo \${APP_${key}_APKGATE:-}")" = "1" ] && exit 7; done; [ $? -eq 7 ] && NEED_HTPASSWD=1
if [ "$NEED_HTPASSWD" = "1" ]; then
    if [ ! -f "$APK_HTPASSWD" ]; then
        echo "pupikes:$(openssl passwd -apr1 'pupikes' 2>/dev/null)" > "$APK_HTPASSWD"
        echo -e "  ${YELLOW}! създадох $APK_HTPASSWD (временно: потребител ${GREEN}pupikes${YELLOW} / парола ${GREEN}pupikes${YELLOW}) — СМЕНИ Я: htpasswd $APK_HTPASSWD pupikes${NC}"
    else
        echo -e "  ${GREEN}✓ $APK_HTPASSWD вече съществува (паролата за скритите APK-та)${NC}"
    fi
    # ВАЖНО: nginx воркерът (www-data) ТРЯБВА да чете файла, иначе auth_basic_user_file →
    # „Permission denied" → 500 при сваляне СЛЕД въвеждане на паролата. Затова — винаги
    # (и при нов, и при вече съществуващ файл) осигуряваме четимост от групата на nginx.
    NGINX_GRP="$(id -gn www-data 2>/dev/null || echo www-data)"
    chown "root:$NGINX_GRP" "$APK_HTPASSWD" 2>/dev/null || true
    chmod 644 "$APK_HTPASSWD" 2>/dev/null || true
fi

# ── Пас 1: HTTP блокове (за да тръгне ACME webroot) ──
echo -e "${CYAN}nginx блокове — пас 1 (HTTP)...${NC}"
generate_conf
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓ nginx презареден${NC}"
else
    echo -e "  ${RED}✗ nginx -t се провали:${NC}"; nginx -t; exit 1
fi

# ── SSL през WEBROOT (token от /var/www/html/.well-known — имунен на редиректи) ──
echo -e "${CYAN}SSL сертификати (webroot)...${NC}"
printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
    [ -z "$dom" ] && continue
    if getent hosts "$dom" >/dev/null 2>&1 || host "$dom" >/dev/null 2>&1; then
        if certbot certonly --webroot -w /var/www/html -d "$dom" \
                --non-interactive --agree-tos -m "$EMAIL" --keep-until-expiring; then
            echo -e "  ${GREEN}✓ сертификат $dom${NC}"
        else
            echo -e "  ${YELLOW}! SSL $dom не мина — провери: A-запис към тази машина + порт 80 отворен${NC}"
        fi
    else
        echo -e "  ${YELLOW}! $dom не резолвва още — пусни пак след DNS${NC}"
    fi
done

# ── Пас 2: добави 443 блокове за домейните със сертификат ──
echo -e "${CYAN}nginx блокове — пас 2 (HTTPS)...${NC}"
generate_conf
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓ nginx презареден (HTTPS активен)${NC}"
else
    echo -e "  ${RED}✗ nginx -t се провали след пас 2:${NC}"; nginx -t
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Приложните домейни са настроени${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
printf '%s\n' "$APP_DOMAIN_MAP" | while read -r dom key; do
    [ -z "$dom" ] && continue
    if [ -f "/etc/letsencrypt/live/$dom/fullchain.pem" ]; then
        echo -e "  ${CYAN}https://$dom${NC} → $key"
    else
        echo -e "  ${YELLOW}http://$dom${NC} → $key (още без SSL — провери DNS и пусни пак)"
    fi
done
echo -e "  ${YELLOW}(главният ${MAIN_DOMAIN} е от 05 — не се пипа тук)${NC}"

# ── Failover авто-възстановяване: 08 пресъздаде kcy-app-domains.conf и го пусна
# пак → ако failover е бил активен, връщаме го (иначе app-домейните конфликтват
# с failover front-а). No-op ако failover не е бил активен (няма маркер). ──
FAILOVER_SH="$(dirname "$0")/12-setup-failover.sh"
if [ -f "$FAILOVER_SH" ] && [ -f /etc/kcy-failover.conf ]; then
    echo ""
    echo -e "${CYAN}  Failover е бил активен — възстановявам след пресъздаването...${NC}"
    bash "$FAILOVER_SH" --auto-restore || echo -e "  ${YELLOW}! Failover restore не мина — пусни ръчно опция 37${NC}"
fi
