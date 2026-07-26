#!/usr/bin/env bash
# prune-apk-orphans.sh — трие от /apk файловете със СТАРИ имена (сираци след смяна на каталожно
# име или преименуване на папка). Пази ТОЧНО текущите: <slug>-{store}-release.apk и
# <id>-{store}-debug.apk (slug = apk-slug.mjs → каталожното name, резерв: title/папка).
# Безопасно е при частичен билд — изчислява очакваните имена за ВСИЧКИ апове, не само за билдваните,
# затова трие само истински сираци. Пуска се самостоятелно или от билд конвейера.
#   bash deploy-scripts/prune-apk-orphans.sh          # трие
#   DRY=1 bash deploy-scripts/prune-apk-orphans.sh    # само показва какво би изтрил
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -d apk ] || { echo "няма apk/ — нищо за чистене"; exit 0; }

declare -A OK
for tree in rustore huawei; do
  [ -d "$tree" ] || continue
  for d in "$tree"/*/; do
    id="$(basename "$d")"; [ -f "$d/capacitor.config.json" ] || continue
    slug="$(node deploy-scripts/apk-slug.mjs "$id" 2>/dev/null)"; [ -z "$slug" ] && slug="$id"
    for s in rustore huawei; do
      OK["${slug}-${s}-release.apk"]=1
      OK["${slug}-${s}-debug.apk"]=1
      OK["${id}-${s}-debug.apk"]=1
    done
  done
done

n=0
for f in apk/*.apk; do
  [ -f "$f" ] || continue
  b="$(basename "$f")"
  if [ -z "${OK[$b]:-}" ]; then
    if [ "${DRY:-0}" = "1" ]; then echo "  (dry) сирак: $b"; else rm -f "$f"; echo "  − сирак изтрит: $b"; fi
    n=$((n+1))
  fi
done
if [ "$n" -gt 0 ]; then echo "  ↻ ${DRY:+(dry) }${n} APK със стари имена"; else echo "  ✓ няма сираци в /apk"; fi
