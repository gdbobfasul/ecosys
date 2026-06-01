#!/bin/bash
# Version: 1.0095
##############################################################################
# KCY — Sync ONLY assets (public/assets) към живия web root.
# Разархивира подадения архив В STAGING, после overlay.
# Без --delete (не трие), без рестарт (nginx сервира статично).
#
# Пуска се КАТО root (през sudo):
#   sudo /var/www/kcy-ecosystem/deploy-scripts/server/15-sync-assets.sh <tarball>
##############################################################################
# Без `set -e` — дребна грешка (chown) не бива да убива целия sync тихо.
TARBALL="$1"
STAGING="/var/www/deploy"
WEB_ROOT="/var/www/html"
SVC_GROUP="kcy"

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

[ -n "$TARBALL" ] && [ -f "$TARBALL" ] || { echo -e "${RED}Няма архив: $TARBALL${NC}"; exit 1; }

SRC="$STAGING/_sync_assets"
rm -rf "$SRC"; mkdir -p "$SRC"
echo -e "${YELLOW}Разархивиране в staging ($SRC)...${NC}"
tar -xzf "$TARBALL" -C "$SRC" || { echo -e "${RED}tar се провали${NC}"; exit 1; }
rm -f "$TARBALL"

# намери public/assets — независимо дали има водеща папка
ASRC="$SRC/public/assets"
[ -d "$ASRC" ] || ASRC="$(find "$SRC" -type d -path '*/public/assets' | head -1)"
echo -e "${CYAN}  намерено public/assets: ${ASRC:-НЕ}${NC}"
[ -n "$ASRC" ] && [ -d "$ASRC" ] || { echo -e "${RED}✗ В архива няма public/assets${NC}"; rm -rf "$SRC"; exit 1; }

mkdir -p "$WEB_ROOT/assets"
echo -e "${YELLOW}rsync assets -> ${WEB_ROOT}/assets (overlay, --checksum)${NC}"
# --checksum: сравнява СЪДЪРЖАНИЕТО, не размер/време. Иначе файл със същия размер
# (но друго съдържание/движение) НЕ се презаписва — точно този бъг.
if rsync -a --checksum "$ASRC/" "$WEB_ROOT/assets/"; then
    echo -e "  ${GREEN}✓ assets копирани${NC}"
else
    echo -e "  ${RED}✗ rsync assets се провали${NC}"; rm -rf "$SRC"; exit 1
fi
chown -R root:"$SVC_GROUP" "$WEB_ROOT/assets" 2>/dev/null || true

rm -rf "$SRC"
COUNT="$(find "$WEB_ROOT/assets" -type f | wc -l)"
echo -e "${GREEN}OK Асетите обновени (${COUNT} файла в ${WEB_ROOT}/assets).${NC}"
echo -e "${GREEN}   Рестарт НЕ е нужен — nginx сервира статично.${NC}"
