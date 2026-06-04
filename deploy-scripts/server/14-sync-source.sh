#!/bin/bash
# Version: 1.0171
##############################################################################
# KCY — Sync ONLY сорс код (без assets, без данни/uploads/.env/node_modules).
# Разархивира подадения архив В STAGING (както прави Deploy), после прави
# overlay към живите папки. Без npm install, без реконфигурация.
# Накрая рестартира node сървисите.
#
# Пуска се КАТО root (през sudo) от STAGING пътя — същия като 05-server-install.sh:
#   sudo /var/www/deploy/deploy-scripts/server/14-sync-source.sh <tarball>
##############################################################################
# Не ползваме `set -e` — една дребна грешка (chown на липсваща папка) не бива да
# убива целия sync тихо. Вместо това проверяваме критичните стъпки явно.

TARBALL="$1"
STAGING="/var/www/deploy"
WEB_ROOT="/var/www/html"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
SVC_GROUP="kcy"
CHAT_USER="kcy-chat"
ECO3_USER="kcy-eco3"

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

[ -n "$TARBALL" ] && [ -f "$TARBALL" ] || { echo -e "${RED}Няма архив: $TARBALL${NC}"; exit 1; }

# разархивирай В STAGING. Поддържаме И двата формата на архив:
#  - с водеща папка (Deploy / новата опция 3): 2026-05-30-toks/public/...
#  - без водеща папка (стар формат): public/...
SRC="$STAGING/_sync_src"
rm -rf "$SRC"; mkdir -p "$SRC"
echo -e "${YELLOW}Разархивиране в staging ($SRC)...${NC}"
tar -xzf "$TARBALL" -C "$SRC" || { echo -e "${RED}tar се провали${NC}"; exit 1; }
rm -f "$TARBALL"

# намери къде са public/private (в корена или в единична водеща папка)
if [ ! -d "$SRC/public" ] && [ ! -d "$SRC/private" ]; then
    inner="$(find "$SRC" -mindepth 1 -maxdepth 1 -type d | head -1)"
    if [ -n "$inner" ] && { [ -d "$inner/public" ] || [ -d "$inner/private" ]; }; then
        SRC="$inner"
    fi
fi
echo -e "${CYAN}  намерено: public=$([ -d "$SRC/public" ] && echo ДА || echo НЕ) private=$([ -d "$SRC/private" ] && echo ДА || echo НЕ) (в $SRC)${NC}"

# public сорс (assets изключени в архива) -> web root, БЕЗ --delete
if [ -d "$SRC/public" ]; then
    echo -e "${YELLOW}public/ -> ${WEB_ROOT}/ (overlay)${NC}"
    rsync -a "$SRC/public/" "$WEB_ROOT/" && echo -e "  ${GREEN}✓ public копиран${NC}" || echo -e "  ${RED}✗ rsync public се провали${NC}"
else
    echo -e "  ${RED}✗ НЯМА public в архива — играта няма да се обнови!${NC}"
fi

# private сорс -> PRIVATE_DIR, БЕЗ --delete, без runtime данни
if [ -d "$SRC/private" ]; then
    echo -e "${YELLOW}private/ -> ${PRIVATE_DIR}/ (overlay, без бази/uploads/.env)${NC}"
    rsync -a \
        --exclude='node_modules/' \
        --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' --exclude='*.sqlite' \
        --exclude='configs/.env' \
        --exclude='uploads/' \
        --exclude='logs/' \
        "$SRC/private/" "$PRIVATE_DIR/"
fi

# deploy-scripts / docs / tests -> PROJECT_DIR (overlay)
for d in deploy-scripts docs tests; do
    [ -d "$SRC/$d" ] && { echo -e "${YELLOW}$d/ -> ${PROJECT_DIR}/$d/${NC}"; rsync -a "$SRC/$d/" "$PROJECT_DIR/$d/"; }
done

# line endings + +x за .sh
if command -v dos2unix >/dev/null 2>&1; then
    find "$PROJECT_DIR/deploy-scripts" -name '*.sh' -exec dos2unix -q {} + 2>/dev/null || true
else
    find "$PROJECT_DIR/deploy-scripts" -name '*.sh' -exec sed -i 's/\r$//' {} + 2>/dev/null || true
fi
find "$PROJECT_DIR/deploy-scripts" -name '*.sh' -exec chmod +x {} + 2>/dev/null || true

# права (както 05-server-install)
chown -R root:"$SVC_GROUP" "$PROJECT_DIR" "$WEB_ROOT" 2>/dev/null || true
chown -R "$CHAT_USER":"$SVC_GROUP" "$PRIVATE_DIR/chat"    2>/dev/null || true
chown -R "$ECO3_USER":"$SVC_GROUP" "$PRIVATE_DIR/eco-3"   2>/dev/null || true
chown -R "$ECO3_USER":"$SVC_GROUP" "$PRIVATE_DIR/portals" 2>/dev/null || true
chown -R "$CHAT_USER":"$CHAT_USER" "$PRIVATE_DIR/chat/uploads" "$PRIVATE_DIR/chat/database" 2>/dev/null || true
chown -R "$ECO3_USER":"$ECO3_USER" "$PRIVATE_DIR/eco-3/database" "$PRIVATE_DIR/eco-3/logs" 2>/dev/null || true
chown -R "$ECO3_USER":"$ECO3_USER" "$PRIVATE_DIR/portals/database" 2>/dev/null || true

# Качени файлове на новите апове (HLB/WNB). Услугите kcy-hlb/kcy-wnb се въртят като
# $ECO3_USER, но при пълен деплой папките uploads остават собственост на root →
# записът на качена снимка дава „Permission denied". Гарантираме права тук (на всеки sync):
#  - създаваме под-папките (posts/proposals), за да съществуват с верен собственик;
#  - chown към service потребителя; chmod 2775 (setgid) → новите файлове наследяват
#    групата kcy и групата може да пише (издържа и ако root създаде нещо после).
for _app in WhereNoBiz House-Look-Book; do
  _up="$PRIVATE_DIR/$_app/uploads"
  if [ -d "$PRIVATE_DIR/$_app" ]; then
    mkdir -p "$_up/posts" "$_up/proposals" 2>/dev/null || true
    chown -R "$ECO3_USER":"$SVC_GROUP" "$_up" 2>/dev/null || true
    chmod -R 2775 "$_up" 2>/dev/null || true
  fi
done

rm -rf "$SRC"

# рестарт на node сървисите (nginx НЕ се пипа)
echo -e "${YELLOW}Рестарт на node сървисите...${NC}"
for svc in kcy-chat kcy-eco3 kcy-portals kcy-hlb kcy-wnb kcy-diag; do
    if systemctl restart "$svc" 2>/dev/null; then
        echo -e "  ${GREEN}OK ${svc} рестартиран${NC}"
    else
        echo -e "  ${YELLOW}- ${svc} не е рестартиран (може да не съществува)${NC}"
    fi
done

echo ""
echo -e "${GREEN}OK Сорсът обновен (overlay). БЕЗ npm install, БЕЗ реконфигурация.${NC}"
echo -e "${CYAN}   nginx не е пипан. Базите/uploads/.env са непокътнати.${NC}"
