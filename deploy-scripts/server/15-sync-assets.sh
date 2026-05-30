#!/bin/bash
# Version: 1.0094
##############################################################################
# KCY — Sync ONLY assets (public/assets) към живия web root.
# Разархивира подадения архив В STAGING (както Deploy), после overlay.
# Без --delete (не трие), без рестарт (nginx сервира статично).
#
# Пуска се КАТО root (през sudo) от STAGING пътя — както 05-server-install.sh:
#   sudo /var/www/deploy/deploy-scripts/server/15-sync-assets.sh <tarball>
##############################################################################
set -e
TARBALL="$1"
STAGING="/var/www/deploy"
WEB_ROOT="/var/www/html"
SVC_GROUP="kcy"

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'

[ -n "$TARBALL" ] && [ -f "$TARBALL" ] || { echo -e "${RED}Няма архив: $TARBALL${NC}"; exit 1; }

SRC="$STAGING/_sync_assets"
rm -rf "$SRC"; mkdir -p "$SRC"
echo -e "${YELLOW}Разархивиране в staging...${NC}"
tar -xzf "$TARBALL" -C "$SRC"
rm -f "$TARBALL"

# архивът съдържа public/assets — намери го
ASRC="$SRC/public/assets"
[ -d "$ASRC" ] || ASRC="$(find "$SRC" -type d -path '*/public/assets' | head -1)"
[ -d "$ASRC" ] || { echo -e "${RED}В архива няма public/assets${NC}"; rm -rf "$SRC"; exit 1; }

mkdir -p "$WEB_ROOT/assets"
echo -e "${YELLOW}rsync assets -> ${WEB_ROOT}/assets (overlay, без --delete)${NC}"
rsync -a "$ASRC/" "$WEB_ROOT/assets/"
chown -R root:"$SVC_GROUP" "$WEB_ROOT/assets" 2>/dev/null || true

rm -rf "$SRC"
COUNT="$(find "$WEB_ROOT/assets" -type f | wc -l)"
echo -e "${GREEN}OK Асетите обновени (${COUNT} файла в ${WEB_ROOT}/assets).${NC}"
echo -e "${GREEN}   Рестарт НЕ е нужен — nginx сервира статично.${NC}"
