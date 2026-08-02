#!/usr/bin/env bash
# Version: 1.0000
# Качва ЗАДЪЛЖИТЕЛНАТА за Huawei/RuStore документация на приложенията на сървъра, за да
# работят правните линкове ВЪТРЕ в апа (Huawei 7.1/7.2, RuStore): Поверителност, Условия,
# Авторско право и всеки друг такъв документ от <магазин>/<ап>/publish/*.html.
# Целта: /var/www/html/privacy/<ап>/ — точно откъдето core/legal.js ги отваря.
#
# Този етап е ЗАДЪЛЖИТЕЛЕН и се вика автоматично при БИЛД на приложение и при ДЕПЛОЙ
# (точка 2) — без питане. НЕ проваля билда/деплоя при липса на връзка: само предупреждава
# и продължава (пусни пак при връзка).
#
# Употреба:
#   sync-legal-pages.sh                 # всички приложения
#   sync-legal-pages.sh <ап> [ап...]    # само избрани (име на папка)
#
# Конфиг (env, с прод дефолти — нищо хардкоднато освен разумните по подразбиране):
#   LEGAL_HOST  (default: MAIN_DOMAIN от private/configs/domains.conf → take.offbitch.com)
#   LEGAL_USER  (default: root)      LEGAL_PORT (default: 2222)
#   LEGAL_KEY   (default: ~/.ssh/id_ed25519 | id_rsa | id_ecdsa)
#   LEGAL_DEST  (default: /var/www/html/privacy)
#   KCY_NO_LEGAL_SYNC=1  → пропусни напълно (за нарочно офлайн билдване)
set -u
cd "$(dirname "$0")/.." || exit 1

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
say() { echo -e "$@"; }

[ "${KCY_NO_LEGAL_SYNC:-0}" = "1" ] && { say "  ${YELLOW}◦ качване на правна документация пропуснато (KCY_NO_LEGAL_SYNC=1)${NC}"; exit 0; }

# ── конфиг ──
[ -f "private/configs/domains.conf" ] && . "private/configs/domains.conf"
HOST="${LEGAL_HOST:-${MAIN_DOMAIN:-take.offbitch.com}}"
SUSER="${LEGAL_USER:-root}"
PORT="${LEGAL_PORT:-2222}"
DEST="${LEGAL_DEST:-/var/www/html/privacy}"
KEY="${LEGAL_KEY:-}"
if [ -z "$KEY" ]; then
  for k in "$HOME/.ssh/id_ed25519" "$HOME/.ssh/id_rsa" "$HOME/.ssh/id_ecdsa"; do [ -f "$k" ] && { KEY="$k"; break; }; done
fi
SSHO="-o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new -p $PORT"
[ -n "$KEY" ] && SSHO="$SSHO -i $KEY"

# ── кои приложения ──
declare -a APPS=()
if [ "$#" -gt 0 ]; then
  for a in "$@"; do
    n="$(basename "${a%/}")"; seen=0
    for x in "${APPS[@]:-}"; do [ "$x" = "$n" ] && { seen=1; break; }; done
    [ "$seen" = 0 ] && APPS+=("$n")
  done
else
  for store in huawei rustore; do
    [ -d "$store" ] || continue
    for d in "$store"/*/; do
      d="${d%/}"; [ -f "$d/package.json" ] || continue
      n="$(basename "$d")"; seen=0
      for x in "${APPS[@]:-}"; do [ "$x" = "$n" ] && { seen=1; break; }; done
      [ "$seen" = 0 ] && APPS+=("$n")
    done
  done
fi
[ "${#APPS[@]}" -eq 0 ] && { say "  ${YELLOW}◦ няма приложения за правна документация${NC}"; exit 0; }

# ── събери документите в temp с структура <ап>/<файл> ──
STAGE="$(mktemp -d 2>/dev/null || echo "/tmp/legal.$$")"; mkdir -p "$STAGE"
trap 'rm -rf "$STAGE"' EXIT
DOC_RE='privacy|terms|copyright|legal|eula|gdpr|disclaimer|cookie'
files=0; apps_done=0
for app in "${APPS[@]}"; do
  got=0
  for store in huawei rustore; do
    pd="$store/$app/publish"; [ -d "$pd" ] || continue
    while IFS= read -r f; do
      [ -f "$f" ] || continue
      b="$(basename "$f")"
      echo "$b" | grep -qiE "$DOC_RE" || continue
      mkdir -p "$STAGE/$app"
      [ -f "$STAGE/$app/$b" ] || { cp -f "$f" "$STAGE/$app/$b" && files=$((files+1)) && got=1; }
    done < <(find "$pd" -maxdepth 1 -type f -name '*.html' 2>/dev/null)
  done
  [ "$got" = 1 ] && apps_done=$((apps_done+1))
done

[ "$files" -eq 0 ] && { say "  ${YELLOW}◦ няма правни документи за качване${NC}"; exit 0; }

say "  ${CYAN}→ качвам ${files} задължителни документа за ${apps_done} приложения → ${SUSER}@${HOST}:${DEST}${NC}"

# ── проверка на връзка (не проваля билда) ──
if ! ssh $SSHO "${SUSER}@${HOST}" "true" 2>/dev/null; then
  say "  ${YELLOW}! сървърът е недостъпен — документацията НЕ е качена (билдът/деплоят продължава). Пусни пак при връзка.${NC}"
  exit 0
fi

# ── качване: stream tar → разархивиране в DEST ──
if tar -C "$STAGE" -cf - . 2>/dev/null | ssh $SSHO "${SUSER}@${HOST}" "mkdir -p '$DEST' && tar -C '$DEST' -xf - && chmod -R 755 '$DEST'" 2>/dev/null; then
  say "  ${GREEN}✓ качени ${files} документа (${apps_done} приложения) — правните линкове са налични онлайн${NC}"
else
  say "  ${YELLOW}! качването не успя — билдът/деплоят продължава. Пусни пак при връзка.${NC}"
fi
exit 0
