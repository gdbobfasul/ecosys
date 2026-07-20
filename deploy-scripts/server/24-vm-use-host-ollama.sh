#!/usr/bin/env bash
# 24-vm-use-host-ollama.sh — насочва relay-а на виртуалната машина към Ollama на ХОСТА
# (видеокартата), вместо локалния CPU модел в самия гост.
#
# Защо: VirtualBox/VMware Workstation не подават картата на госта. Затова моделът върви на хоста
# (на 3090), а тук само пренасочваме relay-а да го ползва (вариант 1 от LEARNING-BUDDY-SERVER-CONNECT.md).
#
# Какво прави:
#   1. Проверява, че Ollama на хоста е достъпен по мрежата.
#   2. Записва в ${DATA_DIR}/ai.env: SELFLEARNING_AI_ENABLED=1 + URL към хоста + името на модела.
#   3. Спира локалния CPU-Ollama в госта (вече не трябва — смятаме на хоста).
#   4. Рестартира relay-а и прави проба през него.
#
# Употреба (от менюто, опция 84 — или ръчно на виртуалната машина):
#   sudo ./24-vm-use-host-ollama.sh <IP_НА_ХОСТА> [модел] [порт]
#   напр.: sudo ./24-vm-use-host-ollama.sh 192.168.0.133 qwen3.5:9b 11434

set -euo pipefail

HOST_IP="${1:-}"
MODEL="${2:-qwen3.5:9b}"
PORT="${3:-11434}"
DATA_DIR="${DATA_DIR:-/var/lib/kcy-selflearning/data}"
AIENV="$DATA_DIR/ai.env"
RELAY_PORT="${SELFLEARNING_PORT:-3013}"

if [ -z "$HOST_IP" ]; then
  echo "Употреба: $0 <IP_НА_ХОСТА> [модел] [порт]"
  echo "  напр.: $0 192.168.0.133 qwen3.5:9b 11434"
  exit 2
fi

URL="http://${HOST_IP}:${PORT}"

echo "→ Проверявам достъп до Ollama на хоста (${URL}/api/tags)…"
# ПОВТАРЯМЕ — хостът може точно сега да рестартира Ollama (опция 84 го рестартира преди това),
# затова не падаме на първия неуспех, а пробваме няколко пъти (понася „дупката" на рестарта).
_reach=0
for _i in 1 2 3 4 5 6; do
  if curl -fsS --max-time 6 "${URL}/api/tags" >/dev/null 2>&1; then _reach=1; break; fi
  echo "    още не отговаря (опит ${_i}/6) — изчаквам 3с…"
  sleep 3
done
if [ "$_reach" -ne 1 ]; then
  echo "✗ Не стигам ${URL}/api/tags след 6 опита."
  echo "  Провери на ХОСТА: OLLAMA_HOST=0.0.0.0:${PORT}, правило в защитната стена за ${PORT},"
  echo "  и че Ollama върви. Алтернатива: ползвай Tailscale IP на хоста за ${URL%:*}."
  exit 1
fi
echo "✓ Хостът отговаря."

# Дали моделът е наличен на хоста (само предупреждение, не спира).
if ! curl -fsS --max-time 8 "${URL}/api/tags" 2>/dev/null | grep -q "\"$MODEL\""; then
  echo "⚠ Внимание: моделът „$MODEL\" не се вижда на хоста. Тегли го на хоста: ollama pull $MODEL"
fi

mkdir -p "$DATA_DIR"
touch "$AIENV"

# Upsert на ключ=стойност в ai.env (без да трие други ключове).
upsert() {
  local k="$1" v="$2"
  if grep -q "^${k}=" "$AIENV"; then
    sed -i "s|^${k}=.*|${k}=${v}|" "$AIENV"
  else
    echo "${k}=${v}" >> "$AIENV"
  fi
}
upsert SELFLEARNING_AI_ENABLED 1
upsert SELFLEARNING_AI_URL "$URL"
upsert SELFLEARNING_AI_MODEL "$MODEL"
chmod 600 "$AIENV" 2>/dev/null || true
echo "✓ ${AIENV} обновен:"
sed 's/^/    /' "$AIENV"

# Спри локалния CPU-Ollama в госта — вече е излишен (смятаме на хоста).
if systemctl list-unit-files 2>/dev/null | grep -q '^ollama'; then
  echo "→ Спирам локалния CPU-Ollama в госта (smятаме на хоста)…"
  systemctl disable --now ollama 2>/dev/null || true
fi

echo "→ Рестартирам relay-а (kcy-selflearning)…"
systemctl restart kcy-selflearning
sleep 2

# Проба през relay-я (минава ai/<token> → Ollama на хоста). Ползваме node порта директно (без nginx/TLS).
TOKEN="$(cat "${DATA_DIR}/owner-token" 2>/dev/null || true)"
if [ -n "$TOKEN" ]; then
  echo "→ Проба през relay-я (моделът на хоста)…"
  RESP="$(curl -s --max-time 90 -X POST "http://127.0.0.1:${RELAY_PORT}/api/selflearning/ai/${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d '{"prompt":"Кажи здравей на български с едно изречение."}' || true)"
  echo "    ← $RESP"
  case "$RESP" in
    *'"text"'*) echo "✓ Relay → модел на хоста работи." ;;
    *) echo "⚠ Relay-ят не върна текст — виж journalctl -u kcy-selflearning." ;;
  esac
else
  echo "⚠ Няма owner-token (${DATA_DIR}/owner-token) — пропускам пробата през relay-я."
fi

echo ""
echo "✓ ГОТОВО — роботчето вече ползва видеокартата на хоста: ${MODEL} @ ${HOST_IP}:${PORT}"
echo "  Обратно към локален CPU модел: махни SELFLEARNING_AI_URL от ${AIENV} (или пусни опция 80 пак)."
