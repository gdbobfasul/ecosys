#!/usr/bin/env bash
# rename-kcy-to-pupikes.sh — ЕДНОКРАТНА миграция на СЪРВЪРА: преименува живата инфраструктура
# от "kcy-*" на "pupikes-*" СЪГЛАСУВАНО (папка + systemd услуги + nginx + sudoers), за да изчезне
# името kcy и от production. Изпълни ГО НА СЪРВЪРА веднъж, ПРЕДИ следващия деплой с новите скриптове.
#
# Защо отделно: тези имена сочат ЖИВИ услуги/папки. Ако само скриптовете се преименуват, но сървърът
# още държи kcy-*, деплоят прави паралелна инсталация и старите услуги увисват. Затова първо — тук.
#
# Идемпотентен: пуска се пак безопасно (пропуска вече мигрираните). Ползвай sudo.
#   sudo bash rename-kcy-to-pupikes.sh
set -euo pipefail

OLD_DIR="/var/www/kcy-ecosystem"
NEW_DIR="/var/www/pupikes-ecosystem"
# systemd услуги, които преименуваме kcy-X → pupikes-X
SERVICES=(kcy-apps kcy-eco3 kcy-chat kcy-portals kcy-hlb kcy-wnb kcy-fbp kcy-selflearning kcy-diag kcy-tokmon-token kcy-tokmon-multisig kcy-tokmon-brch)

echo "== Pupikes миграция: kcy-* → pupikes-* =="

# 1) Спри старите услуги (ако ги има)
for s in "${SERVICES[@]}"; do
  if systemctl list-unit-files | grep -q "^${s}.service"; then
    echo "  спирам ${s}"; systemctl stop "${s}" 2>/dev/null || true; systemctl disable "${s}" 2>/dev/null || true
  fi
done

# 2) Преименувай папката на инсталацията
if [ -d "$OLD_DIR" ] && [ ! -d "$NEW_DIR" ]; then
  echo "  папка: $OLD_DIR → $NEW_DIR"; mv "$OLD_DIR" "$NEW_DIR"
elif [ -d "$NEW_DIR" ]; then
  echo "  папка вече е $NEW_DIR (пропускам)"
fi

# 3) Пренапиши unit-файловете с ново име + нов WorkingDirectory/ExecStart път
for s in "${SERVICES[@]}"; do
  ns="pupikes-${s#kcy-}"
  src="/etc/systemd/system/${s}.service"
  dst="/etc/systemd/system/${ns}.service"
  if [ -f "$src" ]; then
    echo "  услуга: ${s} → ${ns}"
    sed -e "s#${OLD_DIR}#${NEW_DIR}#g" -e "s/kcy-/pupikes-/g" "$src" > "$dst"
    rm -f "$src"
  fi
done

# 4) nginx: подмени пътищата в конфигурациите
for c in /etc/nginx/sites-available/* /etc/nginx/conf.d/*; do
  [ -f "$c" ] || continue
  if grep -q "kcy-ecosystem\|kcy-" "$c"; then
    echo "  nginx: $c"; sed -i -e "s#${OLD_DIR}#${NEW_DIR}#g" -e "s/kcy-/pupikes-/g" "$c"
  fi
done

# 5) sudoers за админ превключвателя (ако съществува)
if [ -f /etc/sudoers.d/kcy-admin ]; then
  echo "  sudoers: kcy-admin → pupikes-admin"
  sed -e "s/kcy-/pupikes-/g" -e "s/kcy_/pupikes_/g" /etc/sudoers.d/kcy-admin > /etc/sudoers.d/pupikes-admin
  chmod 440 /etc/sudoers.d/pupikes-admin; rm -f /etc/sudoers.d/kcy-admin
fi

# 6) Презареди и пусни новите услуги
systemctl daemon-reload
for s in "${SERVICES[@]}"; do
  ns="pupikes-${s#kcy-}"
  if [ -f "/etc/systemd/system/${ns}.service" ]; then
    echo "  пускам ${ns}"; systemctl enable "${ns}" 2>/dev/null || true; systemctl start "${ns}" 2>/dev/null || true
  fi
done
nginx -t && systemctl reload nginx || echo "  ВНИМАНИЕ: nginx -t се провали — провери конфигурацията ръчно"

echo "== Готово. Провери: systemctl status pupikes-apps ; ls $NEW_DIR =="
echo "== След това пусни деплой с преименуваните скриптове (виж deploy-scripts). =="
