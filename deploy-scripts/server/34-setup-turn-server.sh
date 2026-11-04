#!/usr/bin/env bash
# Version: 1.0000
# 34-setup-turn-server.sh — вдига НАШ TURN/STUN сървър (coturn) на същата машина.
# За какво е: когато директната P2P връзка (WebRTC) между двете устройства не стане заради
# строг NAT / защитна стена, TURN препредава потока през сървъра. Ползва се САМО като резерва —
# директните връзки вървят без него. Обслужва и PupikesSendTo (/sendto/), и Pupikes-Desk (/desk/).
#
#   sudo $0            → инсталира/обновява coturn + конфиг + firewall + рестарт
#   sudo $0 --status   → само статус
#
# Данни за достъп (вградени в клиентите — публични по дизайн за дълготрайни TURN креденшъли):
#   потребител: pupikes   парола: PupikesTurn2026   realm: <домейна>
# Самостоятелно — не пипа другите услуги.
set -e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
PROJECT_DIR="/var/www/kcy-ecosystem"; PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
DOMAINS_CONF="$PRIVATE_DIR/configs/domains.conf"
TURN_USER="pupikes"; TURN_PASS="PupikesTurn2026"
TURN_PORT="3478"; TURN_TLS_PORT="5349"
RELAY_MIN="49160"; RELAY_MAX="49200"
CERT_DST="/etc/coturn/certs"
STATUS_ONLY=false; for arg in "$@"; do case $arg in --status) STATUS_ONLY=true ;; esac; done
[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1

# ── домейн (realm + сертификат) ──
read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }
MAIN_DOMAIN="$(read_env MAIN_DOMAIN)"
[ -z "$MAIN_DOMAIN" ] && MAIN_DOMAIN="$(grep -i 'MAIN_DOMAIN' "$DOMAINS_CONF" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs)"
[ -z "$MAIN_DOMAIN" ] && MAIN_DOMAIN="take.offbitch.com"
LE_LIVE="/etc/letsencrypt/live/$MAIN_DOMAIN"

show_status() {
  echo -e "\n${CYAN}── Статус: coturn (TURN/STUN) ──${NC}"
  echo -e "  systemctl: $(systemctl is-active coturn 2>/dev/null || echo n/a) / $(systemctl is-enabled coturn 2>/dev/null || echo n/a)"
  echo -e "  realm: ${MAIN_DOMAIN}   потребител: ${TURN_USER}"
  echo -e "  портове: STUN/TURN ${TURN_PORT} (udp+tcp) · TLS ${TURN_TLS_PORT} · релеен обхват ${RELAY_MIN}-${RELAY_MAX}/udp"
  echo -e "  слуша: $(ss -lun 2>/dev/null | grep -q ":${TURN_PORT} " && echo "да (:${TURN_PORT}/udp)" || echo 'НЕ')"
  echo -e "  TLS сертификат: $([ -f "$CERT_DST/fullchain.pem" ] && echo "налице ($CERT_DST)" || echo 'няма → само обикновен turn:3478')"
}
if [ "$STATUS_ONLY" = true ]; then show_status; exit 0; fi

echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup: НАШ TURN/STUN сървър (coturn) за WebRTC резерва${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

echo -e "${GREEN}[1/5] Инсталирам coturn...${NC}"
export DEBIAN_FRONTEND=noninteractive
if ! command -v turnserver &>/dev/null; then
  apt-get update -qq 2>/dev/null || true
  apt-get install -y -qq coturn 2>&1 | tail -3 || { echo -e "${RED}✗ apt install coturn се провали${NC}"; exit 1; }
else
  echo -e "  ${CYAN}coturn вече е инсталиран ($(turnserver -h 2>&1 | head -1 || true))${NC}"
fi
# Разреши демона (Debian/Ubuntu го държи изключен по подразбиране)
if [ -f /etc/default/coturn ]; then
  sed -i 's/^#*\s*TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
  grep -q '^TURNSERVER_ENABLED=1' /etc/default/coturn || echo 'TURNSERVER_ENABLED=1' >> /etc/default/coturn
fi

echo -e "${GREEN}[2/5] Откривам публичния адрес...${NC}"
PUBIP="$(curl -s -m 8 https://api.ipify.org 2>/dev/null || true)"
[ -z "$PUBIP" ] && PUBIP="$(curl -s -m 8 https://ifconfig.me 2>/dev/null || true)"
[ -z "$PUBIP" ] && PUBIP="$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[0-9.]+' | head -1)"
echo -e "  публичен IP: ${PUBIP:-<неизвестен — external-ip пропуснат>}"

echo -e "${GREEN}[3/5] Сертификат за TLS (turns:${TURN_TLS_PORT}) от Let's Encrypt...${NC}"
TLS_LINES=""
if [ -f "$LE_LIVE/fullchain.pem" ] && [ -f "$LE_LIVE/privkey.pem" ]; then
  mkdir -p "$CERT_DST"
  cp -L "$LE_LIVE/fullchain.pem" "$CERT_DST/fullchain.pem"
  cp -L "$LE_LIVE/privkey.pem" "$CERT_DST/privkey.pem"
  id turnserver &>/dev/null && chown turnserver:turnserver "$CERT_DST"/*.pem 2>/dev/null || true
  chmod 640 "$CERT_DST"/*.pem 2>/dev/null || true
  TLS_LINES="cert=$CERT_DST/fullchain.pem
pkey=$CERT_DST/privkey.pem"
  # При подновяване на сертификата — прекопирай и рестартирай (деплой-hook).
  HOOK_DIR="/etc/letsencrypt/renewal-hooks/deploy"; mkdir -p "$HOOK_DIR"
  cat > "$HOOK_DIR/coturn-certs.sh" << HOOKEOF
#!/usr/bin/env bash
# Авто-генериран от 34-setup-turn-server.sh — обновява копието на сертификата за coturn при подновяване.
LE="/etc/letsencrypt/live/$MAIN_DOMAIN"
D="$CERT_DST"
[ -f "\$LE/fullchain.pem" ] || exit 0
cp -L "\$LE/fullchain.pem" "\$D/fullchain.pem"; cp -L "\$LE/privkey.pem" "\$D/privkey.pem"
id turnserver &>/dev/null && chown turnserver:turnserver "\$D"/*.pem 2>/dev/null || true
chmod 640 "\$D"/*.pem 2>/dev/null || true
systemctl restart coturn 2>/dev/null || true
HOOKEOF
  chmod +x "$HOOK_DIR/coturn-certs.sh"
  echo -e "  ${GREEN}✓ сертификат копиран в $CERT_DST (+ авто-подновяване)${NC}"
else
  echo -e "  ${YELLOW}! няма Let's Encrypt сертификат за $MAIN_DOMAIN → TLS изключен, работи обикновен turn:${TURN_PORT} (udp/tcp)${NC}"
fi

echo -e "${GREEN}[4/5] Записвам /etc/turnserver.conf...${NC}"
EXTIP_LINE=""; [ -n "$PUBIP" ] && EXTIP_LINE="external-ip=$PUBIP"
cat > /etc/turnserver.conf << CONFEOF
# coturn — авто-генериран от 34-setup-turn-server.sh. Резервен TURN/STUN за WebRTC (sendto + desk).
listening-port=$TURN_PORT
tls-listening-port=$TURN_TLS_PORT
min-port=$RELAY_MIN
max-port=$RELAY_MAX
$EXTIP_LINE
realm=$MAIN_DOMAIN
server-name=$MAIN_DOMAIN
# Дълготрайни креденшъли (вградени в публичните клиенти).
lt-cred-mech
user=$TURN_USER:$TURN_PASS
fingerprint
$TLS_LINES
# Сигурност: без TURN към вътрешни/локални адреси (анти-SSRF).
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
no-cli
no-tlsv1
no-tlsv1_1
pidfile=/run/turnserver/turnserver.pid
CONFEOF
mkdir -p /run/turnserver 2>/dev/null || true
id turnserver &>/dev/null && chown turnserver:turnserver /run/turnserver 2>/dev/null || true
echo -e "  ${GREEN}✓ /etc/turnserver.conf записан${NC}"

echo -e "${GREEN}[5/5] Firewall + старт...${NC}"
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw allow ${TURN_PORT}/udp >/dev/null 2>&1 || true
  ufw allow ${TURN_PORT}/tcp >/dev/null 2>&1 || true
  ufw allow ${TURN_TLS_PORT}/udp >/dev/null 2>&1 || true
  ufw allow ${TURN_TLS_PORT}/tcp >/dev/null 2>&1 || true
  ufw allow ${RELAY_MIN}:${RELAY_MAX}/udp >/dev/null 2>&1 || true
  echo -e "  ${GREEN}✓ ufw: отворени ${TURN_PORT}, ${TURN_TLS_PORT}, ${RELAY_MIN}-${RELAY_MAX}/udp${NC}"
else
  echo -e "  ${YELLOW}! ufw не е активен — ако имаш облачен firewall (напр. при доставчика), отвори ръчно:${NC}"
  echo -e "    ${YELLOW}${TURN_PORT}/udp, ${TURN_PORT}/tcp, ${TURN_TLS_PORT}/tcp, ${RELAY_MIN}-${RELAY_MAX}/udp${NC}"
fi
systemctl enable coturn 2>/dev/null || true
systemctl restart coturn 2>/dev/null || true
sleep 2
if systemctl is-active --quiet coturn; then
  echo -e "  ${GREEN}✓ coturn работи${NC}"
else
  echo -e "  ${RED}✗ coturn не тръгна: journalctl -u coturn -n 30${NC}"; journalctl -u coturn -n 20 --no-pager 2>/dev/null || true
fi
show_status
echo -e "\n${GREEN}  Готово: НАШ TURN е вдигнат.${NC}"
echo -e "  ${CYAN}Клиентите вече сочат към: turn:${MAIN_DOMAIN}:${TURN_PORT} (потребител ${TURN_USER}).${NC}"
echo -e "  ${CYAN}Пусни отново точки 87 и 88, за да се качат клиентите с новия TURN адрес.${NC}"
