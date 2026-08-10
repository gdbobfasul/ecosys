#!/usr/bin/env bash
# app-excludes.sh — печата tar exclude ПАТЕРНИ за ПЕР-АП съдържанието на приложенията, които НЕ са
# в KCY_APPS_ONLY. Така деплоят/асетите се ограничават до „само Релийз"/избрани приложения.
# Празен KCY_APPS_ONLY → нищо (пълен деплой). Викано с `--exclude-from` от 04-deploy/sync-source/
# sync-assets. Пипа САМО явно пер-ап пътища:
#   public/privacy/<id>  ·  apk/icons/<id>.png  ·  public/assets/animations/<Име=id>
# Споделените асети (общи css/видео) НЕ се пипат (безопасно).
[ -z "${KCY_APPS_ONLY:-}" ] && exit 0
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"; [ -n "$ROOT" ] && cd "$ROOT" || exit 0
KEEP=" ${KCY_APPS_ONLY//,/ } "
listed() { case "$KEEP" in *" $1 "*) return 0 ;; *) return 1 ;; esac; }
declare -A ALL=()
for s in huawei rustore; do [ -d "$s" ] || continue; for d in "$s"/*/; do [ -d "$d" ] && ALL["$(basename "$d")"]=1; done; done
for id in "${!ALL[@]}"; do
  listed "$id" && continue
  [ -d "public/privacy/$id" ] && echo "public/privacy/$id"
  [ -f "apk/icons/$id.png" ] && echo "apk/icons/$id.png"
done
if [ -d public/assets/animations ]; then
  for d in public/assets/animations/*/; do
    [ -d "$d" ] || continue; nm="$(basename "$d")"; lc="$(echo "$nm" | tr '[:upper:]' '[:lower:]')"
    [ -n "${ALL[$lc]:-}" ] && ! listed "$lc" && echo "public/assets/animations/$nm"
  done
fi
exit 0
