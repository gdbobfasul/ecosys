#!/bin/bash
# Version: 1.0094
##############################################################################
# KCY — Sync ONLY сорс код (без assets, без данни/uploads/.env/node_modules)
# към живите папки. Без --delete (overlay — не трие работещото).
# БЕЗ npm install, БЕЗ реконфигурация. Накрая рестартира node сървисите.
# Изпълнява се КАТО root (през sudo). Аргумент: път до качения tar.gz.
#   sudo /var/www/kcy-ecosystem/deploy-scripts/server/14-sync-source.sh <tarball>
##############################################################################
set -e
TARBALL="$1"
WEB_ROOT="/var/www/html"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
SVC_GROUP="kcy"
CHAT_USER="kcy-chat"
ECO3_USER="kcy-eco3"

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

[ -n "$TARBALL" ] && [ -f "$TARBALL" ] || { echo -e "${RED}Няма архив: $TARBALL${NC}"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
tar -xzf "$TARBALL" -C "$TMP"

# ── public сорс (assets са изключени в архива) → web root, БЕЗ --delete ──
if [ -d "$TMP/public" ]; then
    echo -e "${YELLOW}public/ → ${WEB_ROOT}/ (overlay)${NC}"
    rsync -a "$TMP/public/" "$WEB_ROOT/"
fi

# ── private сорс → PRIVATE_DIR, БЕЗ --delete, без runtime данни ──
if [ -d "$TMP/private" ]; then
    echo -e "${YELLOW}private/ → ${PRIVATE_DIR}/ (overlay, без бази/uploads/.env)${NC}"
    rsync -a \
        --exclude='node_modules/' \
        --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' --exclude='*.sqlite' \
        --exclude='configs/.env' \
        --exclude='uploads/' \
        --exclude='logs/' \
        "$TMP/private/" "$PRIVATE_DIR/"
fi

# ── deploy-scripts / docs / tests → PROJECT_DIR (overlay) ──
for d in deploy-scripts docs tests; do
    [ -d "$TMP/$d" ] && { echo -e "${YELLOW}$d/ → ${PROJECT_DIR}/$d/${NC}"; rsync -a "$TMP/$d/" "$PROJECT_DIR/$d/"; }
done

# ── line endings + +x за .sh ──
if command -v dos2unix >/dev/null 2>&1; then
    find "$PROJECT_DIR/deploy-scripts" -name '*.sh' -exec dos2unix -q {} + 2>/dev/null || true
else
    find "$PROJECT_DIR/deploy-scripts" -name '*.sh' -exec sed -i 's/\r$//' {} + 2>/dev/null || true
fi
find "$PROJECT_DIR/deploy-scripts" -name '*.sh' -exec chmod +x {} + 2>/dev/null || true

# ── права (както 05-server-install) ──
chown -R root:"$SVC_GROUP" "$PROJECT_DIR" "$WEB_ROOT" 2>/dev/null || true
chown -R "$CHAT_USER":"$SVC_GROUP" "$PRIVATE_DIR/chat"   2>/dev/null || true
chown -R "$ECO3_USER":"$SVC_GROUP" "$PRIVATE_DIR/eco-3"  2>/dev/null || true
chown -R "$ECO3_USER":"$SVC_GROUP" "$PRIVATE_DIR/portals" 2>/dev/null || true
# данните остават собственост на сервизните потребители (не са пипани от overlay-а)
chown -R "$CHAT_USER":"$CHAT_USER" "$PRIVATE_DIR/chat/uploads" "$PRIVATE_DIR/chat/database" 2>/dev/null || true
chown -R "$ECO3_USER":"$ECO3_USER" "$PRIVATE_DIR/eco-3/database" "$PRIVATE_DIR/eco-3/logs" 2>/dev/null || true
chown -R "$ECO3_USER":"$ECO3_USER" "$PRIVATE_DIR/portals/database" 2>/dev/null || true

rm -f "$TARBALL"

# ── рестарт на node сървисите (сорсът се промени; nginx НЕ се пипа) ──
echo -e "${YELLOW}Рестарт на node сървисите...${NC}"
for svc in kcy-chat kcy-eco3 kcy-portals; do
    if systemctl restart "$svc" 2>/dev/null; then
        echo -e "  ${GREEN}✓ ${svc} рестартиран${NC}"
    else
        echo -e "  ${YELLOW}↷ ${svc} не е рестартиран (може да не съществува)${NC}"
    fi
done

echo ""
echo -e "${GREEN}✓ Сорсът обновен (overlay). БЕЗ npm install, БЕЗ реконфигурация.${NC}"
echo -e "${CYAN}  nginx не е пипан. Базите/uploads/.env са непокътнати.${NC}"
