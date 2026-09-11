#!/usr/bin/env bash
# Version: 1.0000
# 27-setup-medikit-server.sh — вдига услугата kcy-medikit (private/medikit, node :3015) + nginx /api/medikit/.
# Обща сървърна база за Pupikes Medicines / Pupikes Doctor: справки за лекарства/състояния (openFDA, Wikidata,
# Wikipedia; кеширани на диск) + учене от аповете (opt-in, анонимно; gtin/име/отпечатък) с ЛИМИТИ на диска.
# Самостоятелно — не пипа другите услуги. data/ и config.json на сървъра НЕ се презаписват при деплой.
#   sudo $0                    → инсталира/обновява + рестартира
#   sudo $0 --status           → само статус (размер на склада / лимит / броячи)
#   sudo $0 --limit 3G         → смяна на общия лимит на data/ (напр. 500M, 3G, 2147483648) + рестарт
#   sudo $0 --per-ip-day 500   → записа /learn на IP за ден
#   sudo $0 --max-images 200000→ таван на научените отпечатъци (Doctor)
#   sudo $0 --prune on|off     → при пълен склад: режи най-слабо потвърденото (on) / спри ученето (off)
set -e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
APP_NAME="medikit"; SVC="kcy-medikit"
PROJECT_DIR="/var/www/kcy-ecosystem"; PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"; APP_DIR="$PRIVATE_DIR/$APP_NAME"
PORT_KEY="MEDIKIT_PORT"; PORT_DEFAULT="3015"
NGINX_INC_DIR="/etc/nginx/kcy-apps"; NGINX_INC="$NGINX_INC_DIR/medikit.conf"
LOG_DIR="/var/log/kcy-ecosystem"; SVC_USER="kcy-eco3"; SVC_GROUP="kcy"
CONFIG="$APP_DIR/config.json"; DATA_DIR="$APP_DIR/data"
STATUS_ONLY=false; SET_LIMIT=""; SET_IPDAY=""; SET_IMAGES=""; SET_PRUNE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --status) STATUS_ONLY=true ;;
    --limit) SET_LIMIT="$2"; shift ;;
    --per-ip-day) SET_IPDAY="$2"; shift ;;
    --max-images) SET_IMAGES="$2"; shift ;;
    --prune) SET_PRUNE="$2"; shift ;;
  esac; shift
done
[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1
read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }
PORT=$(read_env "$PORT_KEY"); PORT="${PORT:-$PORT_DEFAULT}"
# „3G" / „500M" / „2048K" / байтове → байтове
to_bytes() {
  local v="$1"; v="${v^^}"
  case "$v" in
    *G|*GB) echo $(( ${v%%G*} * 1073741824 )) ;;
    *M|*MB) echo $(( ${v%%M*} * 1048576 )) ;;
    *K|*KB) echo $(( ${v%%K*} * 1024 )) ;;
    ''|*[!0-9]*) echo "" ;;
    *) echo "$v" ;;
  esac
}
show_status() {
  echo -e "\n${CYAN}── Статус: ${SVC} ──${NC}"
  echo -e "  systemctl: $(systemctl is-active ${SVC}.service 2>/dev/null || echo n/a) / $(systemctl is-enabled ${SVC}.service 2>/dev/null || echo n/a)"
  echo -e "  Порт: ${PORT}   Данни: ${DATA_DIR} ($(du -sh "$DATA_DIR" 2>/dev/null | cut -f1 || echo '—') на диска)"
  if [ -f "$CONFIG" ]; then
    echo -e "  Лимити (config.json): $(node -e "const c=require('$CONFIG');const g=(b)=>b>=1073741824?(b/1073741824).toFixed(2)+' GB':(b/1048576).toFixed(0)+' MB';console.log('склад '+g(c.maxStoreBytes)+' · запис '+(c.maxItemBytes/1024)+' KB · IP/ден '+c.maxPerIpPerDay+' · отпечатъци '+c.maxImageSigs+' · prune '+(c.pruneWhenFull?'on':'off'))" 2>/dev/null || echo 'нечетим')"
  fi
  if command -v curl &>/dev/null; then
    echo -e "  Health: $(curl -s -m 4 http://127.0.0.1:${PORT}/api/medikit/health 2>/dev/null || echo 'няма отговор')"
    local st; st=$(curl -s -m 4 http://127.0.0.1:${PORT}/api/medikit/stats 2>/dev/null || true)
    [ -n "$st" ] && echo -e "  Склад: $(echo "$st" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.store.human+' / '+j.store.limitHuman+' ('+j.store.percent+'%)'+(j.store.full?'  ПЪЛЕН — ученето е спряно':(j.store.warning?'  ! предупреждение ≥90%':''))+' · научено: gtin '+j.learned.gtin+', имена '+j.learned.name+', отпечатъци '+j.learned.image+' · кеш: лекарства '+j.cache.drug+', състояния '+j.cache.condition)}catch(e){console.log('—')}})" 2>/dev/null)"
  fi
  echo -e "  nginx include: $([ -f "$NGINX_INC" ] && echo "$NGINX_INC ✓" || echo "липсва")"
  echo -e "  Активен в nginx: $(nginx -T 2>/dev/null | grep -q 'kcy-apps/medikit' && echo да || echo "НЕ (пусни опция 2 веднъж)")"
}
# ── Смяна на лимити: пише в живия config.json (node — безопасно JSON редактиране) + рестарт ──
if [ -n "$SET_LIMIT$SET_IPDAY$SET_IMAGES$SET_PRUNE" ]; then
  [ -f "$CONFIG" ] || { mkdir -p "$APP_DIR"; [ -f "/var/www/deploy/private/$APP_NAME/config.json" ] && cp -f "/var/www/deploy/private/$APP_NAME/config.json" "$CONFIG" || echo '{}' > "$CONFIG"; }
  LB=""; if [ -n "$SET_LIMIT" ]; then LB=$(to_bytes "$SET_LIMIT"); [ -z "$LB" ] && { echo -e "${RED}✗ Невалиден лимит: $SET_LIMIT (пример: 3G, 500M, 2147483648)${NC}"; exit 1; }; [ "$LB" -lt 10485760 ] && { echo -e "${RED}✗ Лимитът е под 10 MB — отказ${NC}"; exit 1; }; fi
  if [ -n "$SET_PRUNE" ]; then case "$SET_PRUNE" in on|off|true|false|1|0) ;; *) echo -e "${RED}✗ --prune приема on|off${NC}"; exit 1 ;; esac; fi
  MK_LB="$LB" MK_IPDAY="$SET_IPDAY" MK_IMG="$SET_IMAGES" MK_PRUNE="$SET_PRUNE" node -e "
    const fs=require('fs'),f='$CONFIG';let c={};try{c=JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){}
    const e=process.env;if(e.MK_LB)c.maxStoreBytes=parseInt(e.MK_LB,10);if(e.MK_IPDAY)c.maxPerIpPerDay=parseInt(e.MK_IPDAY,10);
    if(e.MK_IMG)c.maxImageSigs=parseInt(e.MK_IMG,10);if(e.MK_PRUNE)c.pruneWhenFull=['on','true','1'].includes(e.MK_PRUNE);
    fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n');console.log('  config.json:',JSON.stringify({maxStoreBytes:c.maxStoreBytes,maxPerIpPerDay:c.maxPerIpPerDay,maxImageSigs:c.maxImageSigs,pruneWhenFull:c.pruneWhenFull}));"
  chown root:"$SVC_GROUP" "$CONFIG" 2>/dev/null || true; chmod a+r "$CONFIG"
  systemctl restart ${SVC}.service 2>/dev/null || true; sleep 1
  echo -e "  ${GREEN}✓ Лимитите са записани в ${CONFIG} и услугата е рестартирана${NC}"
  show_status; exit 0
fi
if [ "$STATUS_ONLY" = true ]; then show_status; exit 0; fi
echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup услуга: ${SVC}  (Pupikes Medikit — лекарства/заболявания: справки + учене)${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
# Файловете идват от STAGING (/var/www/deploy/private/medikit — качени с scp/деплой) → живата папка (root:kcy).
# config.json се копира САМО ако липсва (пази сменените лимити); data/ никога не се пипа.
STAGE_DIR="/var/www/deploy/private/$APP_NAME"
if [ -f "$STAGE_DIR/server.js" ]; then
  mkdir -p "$APP_DIR"; cp -f "$STAGE_DIR"/server.js "$STAGE_DIR"/package.json "$APP_DIR"/ 2>/dev/null
  [ -f "$CONFIG" ] || cp -f "$STAGE_DIR/config.json" "$CONFIG" 2>/dev/null || true
  chown root:"$SVC_GROUP" "$APP_DIR" "$APP_DIR"/server.js "$APP_DIR"/package.json "$CONFIG" 2>/dev/null || true; chmod a+rX "$APP_DIR" "$APP_DIR"/*.js "$APP_DIR"/*.json 2>/dev/null || true
  echo -e "  ${CYAN}staging → $APP_DIR (обновено; config.json/data/ запазени)${NC}"
fi
[ -f "$APP_DIR/server.js" ] || { echo -e "${RED}✗ $APP_DIR/server.js липсва — качи проекта първо (опция 2/4 или scp в $STAGE_DIR)${NC}"; exit 1; }
if ! id "$SVC_USER" &>/dev/null; then echo -e "${YELLOW}  ! Потребител $SVC_USER липсва → root${NC}"; SVC_USER="root"; fi
getent group "$SVC_GROUP" >/dev/null || SVC_GROUP="$SVC_USER"
mkdir -p "$LOG_DIR" "$NGINX_INC_DIR" "$DATA_DIR"
chown -R "$SVC_USER":"$SVC_GROUP" "$DATA_DIR"; chmod 750 "$DATA_DIR"
[ -f "$CONFIG" ] || echo '{}' > "$CONFIG"
echo -e "${GREEN}[1/2] systemd услуга ${SVC} (порт ${PORT})...${NC}"
ENVFILE_LINE=""; [ -f "$GLOBAL_ENV" ] && ENVFILE_LINE="EnvironmentFile=-${GLOBAL_ENV}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY Pupikes Medikit (drug/condition lookups + opt-in learning store with disk limits)
After=network.target
[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
${ENVFILE_LINE}
Environment=NODE_ENV=production
Environment=MEDIKIT_PORT=${PORT}
Environment=MEDIKIT_DATA=${DATA_DIR}
Environment=MEDIKIT_SHARDS=${PROJECT_DIR}/public/medikit/meds
ExecStart=/usr/bin/node server.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${LOG_DIR} ${DATA_DIR}
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload; systemctl enable ${SVC}.service 2>/dev/null || true; systemctl restart ${SVC}.service 2>/dev/null || true
sleep 2
if systemctl is-active --quiet ${SVC}.service; then echo -e "  ${GREEN}✓ ${SVC} работи (порт ${PORT})${NC}"; else echo -e "  ${RED}✗ ${SVC} не тръгна: journalctl -u ${SVC} -n 30${NC}"; journalctl -u ${SVC} -n 15 --no-pager 2>/dev/null || true; fi
echo -e "${GREEN}[2/2] nginx include ${NGINX_INC}...${NC}"
cat > "$NGINX_INC" << NGXEOF
# kcy-medikit — справки лекарства/състояния + учене (авто-генериран от 27-setup-medikit-server.sh)
location ^~ /api/medikit/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 30;
    proxy_buffering off;
    client_max_body_size 128k;
}
NGXEOF
echo -e "  ${GREEN}✓ Записан: ${NGINX_INC}${NC}"
if nginx -t 2>/dev/null; then systemctl reload nginx; echo -e "  ${GREEN}✓ nginx презаредил${NC}"; else echo -e "  ${RED}✗ nginx -t се провали — махам include-а${NC}"; rm -f "$NGINX_INC"; nginx -t 2>/dev/null && systemctl reload nginx; fi
nginx -T 2>/dev/null | grep -q 'kcy-apps/medikit' && echo -e "  ${GREEN}✓ Маршрутът е активен в nginx${NC}" || echo -e "  ${YELLOW}  ! include директивата още не е в основния конфиг — пусни ВЕДНЪЖ опция 2.${NC}"
show_status
echo -e "\n${GREEN}  Готово: ${SVC}. Тест: https://pupikes.app/api/medikit/health   ·   лимит: sudo $0 --limit 3G${NC}"
