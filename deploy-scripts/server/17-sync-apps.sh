#!/bin/bash
# Version: 1.0001
##############################################################################
# Pupikes — Sync САМО папката на приложенията (apk/) към живия web root на
# pupikes.app: /var/www/html/apk. Съдържа каталога (index.html + catalog.json
# + лого) + готовите инсталационни файлове (.apk/.exe). Overlay (без --delete),
# без рестарт (nginx сервира статично).
#
# Пуска се КАТО root (през sudo), с готовия архив като аргумент:
#   sudo /var/www/deploy/deploy-scripts/server/17-sync-apps.sh <tarball>
##############################################################################
# Без `set -e` — дребна грешка (chown) не бива да убива целия sync тихо.
TARBALL="$1"
STAGING="/var/www/deploy"
WEB_ROOT="/var/www/html"
SVC_GROUP="kcy"

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

[ -n "$TARBALL" ] && [ -f "$TARBALL" ] || { echo -e "${RED}Няма архив: $TARBALL${NC}"; exit 1; }

SRC="$STAGING/_sync_apps"
rm -rf "$SRC"; mkdir -p "$SRC"
echo -e "${YELLOW}Разархивиране в staging ($SRC)...${NC}"
tar -xzf "$TARBALL" -C "$SRC" || { echo -e "${RED}tar се провали${NC}"; exit 1; }
rm -f "$TARBALL"

# намери папката apk — независимо дали има водеща папка в архива
ASRC="$SRC/apk"
[ -d "$ASRC" ] || ASRC="$(find "$SRC" -type d -name apk | head -1)"
echo -e "${CYAN}  намерено apk: ${ASRC:-НЕ}${NC}"
[ -n "$ASRC" ] && [ -d "$ASRC" ] || { echo -e "${RED}✗ В архива няма папка apk${NC}"; rm -rf "$SRC"; exit 1; }

mkdir -p "$WEB_ROOT/apk"
echo -e "${YELLOW}rsync apk -> ${WEB_ROOT}/apk (overlay, --checksum)${NC}"
# --checksum: сравнява СЪДЪРЖАНИЕТО, не размер/време → нов билд със същия размер пак се обновява.
if rsync -a --checksum "$ASRC/" "$WEB_ROOT/apk/"; then
    echo -e "  ${GREEN}✓ приложения + каталог копирани${NC}"
else
    echo -e "  ${RED}✗ rsync apk се провали${NC}"; rm -rf "$SRC"; exit 1
fi
chown -R root:"$SVC_GROUP" "$WEB_ROOT/apk" 2>/dev/null || true
chmod -R 755 "$WEB_ROOT/apk" 2>/dev/null || true

rm -rf "$SRC"
COUNT="$(find "$WEB_ROOT/apk" -type f | wc -l)"
echo -e "${GREEN}OK Приложенията обновени (${COUNT} файла в ${WEB_ROOT}/apk).${NC}"
echo -e "${GREEN}   Каталогът + свалянията са живи. Рестарт НЕ е нужен — nginx сервира статично.${NC}"
