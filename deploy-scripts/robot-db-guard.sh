#!/usr/bin/env bash
# robot-db-guard.sh — ПРЕДПАЗЕН бекъп на реалните бази ПРЕДИ тест-робота и възстановяване САМО при чист тест.
#
# По искане: роботът тества срещу РЕАЛНИТЕ бази (не стъбнати) и ги пълни с тестови данни.
# За да не се губят реалните данни:
#   1) БЕКЪП на всички бази (PG от .env + SQLite файловете) → верифициран;
#   2) пуска командата на робота (той пълни базите с тестови данни);
#   3) при УСПЕХ (exit 0) → ВЪЗСТАНОВЯВА реалните данни от бекъпа;
#      при ГРЕШКА → НЕ възстановява (реалните данни остават в бекъпа), слага LOCK — докато не се оправят.
#
# ⚠️ ВМ-side, деструктивно при restore. ВАЛИДИРАЙ на ВМ (виж `status`/`backup` първо) преди да разчиташ на него.
#
# Подкоманди:
#   backup                 — само бекъп (безопасно, нищо не трие)
#   restore [<ts>|latest]  — възстанови реалните данни от бекъп (деструктивно за тестовите)
#   guard -- <cmd...>      — бекъп → пусни cmd (робота) → restore ако cmd успее, иначе LOCK
#   status                 — покажи последния бекъп + LOCK състоянието
#
# Настройки (env): ROBOT_DB_ENV (.env път), ROBOT_DB_PROJECT (корен), ROBOT_DB_DEST (бекъп папка)
set -uo pipefail

PROJECT="${ROBOT_DB_PROJECT:-/var/www/kcy-project}"
ENVFILE="${ROBOT_DB_ENV:-$PROJECT/private/configs/.env}"
DEST="${ROBOT_DB_DEST:-/var/backups/robot-db}"
LOCK="$DEST/LOCK"
C_R=$'\e[31m'; C_G=$'\e[32m'; C_Y=$'\e[33m'; C_C=$'\e[36m'; C_X=$'\e[0m'

# Известни SQLite файлове (съществуващите се бекъпват).
sqlite_files() {
  local chatfile; chatfile=$(envval CHAT_SQLITE_DB_FILE); [ -z "$chatfile" ] && chatfile="amschat.db"
  printf '%s\n' \
    "$PROJECT/private/chat/database/$chatfile" \
    "$PROJECT/private/chat/database/amschat.db" \
    "$PROJECT/private/portals/database/portals.db" \
    "$PROJECT/private/eco-3/database/eco3.db" | awk '!seen[$0]++'
}

envval() { [ -f "$ENVFILE" ] && grep -E "^$1=" "$ENVFILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r"' ; }

# Имената на PG базите — всички ключове в .env, завършващи на PG_DATABASE (CHAT_/HLB_/WNB_/FBP_/ECO3_/…).
pg_databases() {
  [ -f "$ENVFILE" ] || return 0
  grep -E "PG_DATABASE=" "$ENVFILE" 2>/dev/null | cut -d= -f2- | tr -d '\r"' | awk 'NF' | awk '!seen[$0]++'
}
pg_owner_for() { local o; o=$(envval "${1}_PG_USER"); [ -z "$o" ] && o=$(envval PG_USER); [ -z "$o" ] && o="kcy"; printf '%s' "$o"; }

verify_gz() { [ -s "$1" ] && gzip -t "$1" 2>/dev/null; }

do_backup() {
  local ts; ts=$(date +%Y%m%d-%H%M%S)
  local dir="$DEST/$ts"; mkdir -p "$dir" || { echo "${C_R}✗ не мога да създам $dir${C_X}"; return 1; }
  echo "${C_C}▶ Бекъп на реалните бази → $dir${C_X}"
  local ok=1 manifest="$dir/manifest.txt"; : > "$manifest"

  # PG
  local db
  while IFS= read -r db; do
    [ -z "$db" ] && continue
    local out="$dir/pg_${db}.sql.gz"
    if sudo -u postgres pg_dump "$db" 2>/dev/null | gzip > "$out"; then
      if verify_gz "$out"; then echo "  ${C_G}✓ PG $db${C_X}"; echo "pg $db pg_${db}.sql.gz" >> "$manifest";
      else echo "  ${C_R}✗ PG $db — бекъпът е празен/повреден${C_X}"; ok=0; fi
    else echo "  ${C_R}✗ PG $db — pg_dump се провали${C_X}"; ok=0; fi
  done < <(pg_databases)

  # SQLite
  local f
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    local base; base=$(basename "$f"); local out="$dir/sqlite_${base}"
    if cp -f "$f" "$out" && [ -s "$out" ]; then echo "  ${C_G}✓ SQLite $base${C_X}"; echo "sqlite $f sqlite_${base}" >> "$manifest";
    else echo "  ${C_R}✗ SQLite $base — копирането се провали${C_X}"; ok=0; fi
  done < <(sqlite_files)

  if [ "$ok" != 1 ] || [ ! -s "$manifest" ]; then
    echo "${C_R}✗ Бекъпът НЕ е пълен — ПРЕКРАТЯВАМ (никакъв тест не тръгва без валиден бекъп).${C_X}"; return 1
  fi
  ln -sfn "$ts" "$DEST/latest"
  echo "${C_G}✓ Бекъп готов: $dir${C_X}"
}

do_restore() {
  local ts="${1:-latest}"; local dir="$DEST/$ts"
  [ "$ts" = "latest" ] && dir="$DEST/$(readlink "$DEST/latest" 2>/dev/null)"
  local manifest="$dir/manifest.txt"
  [ -f "$manifest" ] || { echo "${C_R}✗ Няма валиден бекъп ($manifest липсва) — ОТКАЗ.${C_X}"; return 1; }
  echo "${C_C}▶ Възстановявам реалните данни от: $dir${C_X}"
  local kind src file
  while read -r kind src file; do
    [ -z "$kind" ] && continue
    local path="$dir/$file"
    if [ "$kind" = "pg" ]; then
      verify_gz "$path" || { echo "  ${C_R}✗ $src — бекъпът е повреден, пропускам${C_X}"; continue; }
      local owner; owner=$(pg_owner_for "$src")
      sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$src' AND pid<>pg_backend_pid();" >/dev/null 2>&1
      sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$src\" WITH (FORCE);" >/dev/null 2>&1 || sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$src\";" >/dev/null 2>&1
      sudo -u postgres psql -c "CREATE DATABASE \"$src\" OWNER \"$owner\";" >/dev/null 2>&1
      if gunzip -c "$path" | sudo -u postgres psql "$src" >/dev/null 2>&1; then echo "  ${C_G}✓ PG $src${C_X}"; else echo "  ${C_R}✗ PG $src — зареждането се провали${C_X}"; fi
    else
      [ -s "$path" ] || { echo "  ${C_R}✗ $src — бекъпът е празен, пропускам${C_X}"; continue; }
      if cp -f "$path" "$src"; then echo "  ${C_G}✓ SQLite $(basename "$src")${C_X}"; else echo "  ${C_R}✗ SQLite $(basename "$src")${C_X}"; fi
    fi
  done < "$manifest"
  echo "${C_G}✓ Реалните данни са върнати.${C_X}"
}

do_guard() {
  [ -f "$LOCK" ] && { echo "${C_R}✗ Има LOCK ($LOCK) — предишен тест намери грешки; реалните данни ОЩЕ не са върнати. Оправи ги, после restore + махни LOCK.${C_X}"; cat "$LOCK"; return 3; }
  do_backup || { echo "${C_R}✗ Бекъпът се провали — НЕ пускам робота.${C_X}"; return 1; }
  local ts; ts=$(readlink "$DEST/latest")
  echo "${C_C}▶ Пускам робота: $*${C_X}"
  if "$@"; then
    echo "${C_G}✓ Роботът приключи без грешки — възстановявам реалните данни.${C_X}"
    do_restore latest
  else
    local rc=$?
    { echo "ts=$ts"; echo "cmd=$*"; echo "reason=роботът върна грешка (rc=$rc) — реалните данни са в бекъпа $DEST/$ts"; echo "action=оправи грешките, после: $0 restore $ts && rm $LOCK"; } > "$LOCK"
    echo "${C_R}✗ Роботът намери грешки (rc=$rc). НЕ възстановявам реалните данни — те са пазени в $DEST/$ts.${C_X}"
    echo "${C_Y}  Реалната база се връща чак след като се оправят грешките: $0 restore $ts && rm $LOCK${C_X}"
    return "$rc"
  fi
}

case "${1:-status}" in
  backup)  do_backup ;;
  restore) shift; do_restore "${1:-latest}" ;;
  guard)   shift; [ "${1:-}" = "--" ] && shift; [ "$#" -gt 0 ] || { echo "Употреба: $0 guard -- <команда за робота>"; exit 2; }; do_guard "$@" ;;
  status)
    echo "ENV: $ENVFILE"; echo "Бекъпи: $DEST"; echo "PG бази: $(pg_databases | tr '\n' ' ')"
    echo "Последен бекъп: $(readlink "$DEST/latest" 2>/dev/null || echo '—')"
    [ -f "$LOCK" ] && { echo "${C_R}LOCK активен:${C_X}"; cat "$LOCK"; } || echo "LOCK: няма"
    ;;
  *) echo "Употреба: $0 {backup|restore [<ts>]|guard -- <cmd...>|status}"; exit 2 ;;
esac
