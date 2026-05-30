#!/bin/bash
# Version: 1.0094
##############################################################################
# KCY — Sync ONLY assets (public/assets) към живия web root.
# Без --delete (не трие нищо), без рестарт (nginx сервира статично).
# Изпълнява се КАТО root (през sudo). Аргумент: път до качения tar.gz.
#   sudo /var/www/deploy/deploy-scripts/server/15-sync-assets.sh <tarball>
##############################################################################
set -e
TARBALL="$1"
WEB_ROOT="/var/www/html"
SVC_GROUP="kcy"

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'

[ -n "$TARBALL" ] && [ -f "$TARBALL" ] || { echo -e "${RED}Няма архив: $TARBALL${NC}"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
tar -xzf "$TARBALL" -C "$TMP"

SRC="$TMP/public/assets"
[ -d "$SRC" ] || SRC="$(find "$TMP" -type d -path '*/public/assets' | head -1)"
[ -d "$SRC" ] || { echo -e "${RED}В архива няма public/assets${NC}"; exit 1; }

mkdir -p "$WEB_ROOT/assets"
echo -e "${YELLOW}rsync assets → ${WEB_ROOT}/assets (overlay, без --delete)${NC}"
rsync -a "$SRC/" "$WEB_ROOT/assets/"
chown -R root:"$SVC_GROUP" "$WEB_ROOT/assets" 2>/dev/null || true

rm -f "$TARBALL"
COUNT="$(find "$WEB_ROOT/assets" -type f | wc -l)"
echo -e "${GREEN}✓ Асетите обновени (${COUNT} файла в ${WEB_ROOT}/assets).${NC}"
echo -e "${GREEN}  Рестарт НЕ е нужен — nginx сервира статично.${NC}"
