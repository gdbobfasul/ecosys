#!/usr/bin/env bash
# Version: 1.0000
# prepare-legal-docs.sh — ЕДНО МЯСТО за подготовката на задължителните документи (privacy/terms).
# Действия (за да НЕ се повтарят в 04/05/sync-source/build):
#   1) ГЕНЕРИРА документите   (gen-privacy.mjs + gen-terms.mjs → <магазин>/<ап>/publish/*.html)
#   2) СЪБИРА ги в public/privacy (collect-legal-to-public.mjs) → ПЪТУВАТ в деплой архива (като deploy@),
#      а сървърните root скриптове (05 / 14-sync-source) ги слагат в /var/www/html/privacy —
#      БЕЗ да е нужен root SSH от локалната машина (това чупеше и връщаше 404-ките).
#
# Викан от: 02-full-install (2), 04-deploy (4), sync-source (5), build-mobile-apps (57).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; X=$'\e[0m'

if ! command -v node >/dev/null 2>&1; then
  echo -e "  ${Y}(няма node — пропускам подготовката на правните документи)${X}"; exit 0
fi

echo -e "  ${C}→ Подготвям задължителните документи (генерирам + събирам в public/privacy)…${X}"
[ -f deploy-scripts/gen-privacy.mjs ] && node deploy-scripts/gen-privacy.mjs >/dev/null 2>&1 || true
[ -f deploy-scripts/gen-terms.mjs ]   && node deploy-scripts/gen-terms.mjs   >/dev/null 2>&1 || true
if [ -f deploy-scripts/collect-legal-to-public.mjs ]; then
  node deploy-scripts/collect-legal-to-public.mjs || echo -e "  ${Y}! събирането в public/privacy върна грешка${X}"
fi
