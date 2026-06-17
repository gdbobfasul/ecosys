#!/usr/bin/env bash
# install-into-android.sh
# ------------------------------------------------------------------------------
# Вкарва native NotificationReply плъгина в ГЕНЕРИРАНАТА android/ папка.
#
# КОГА: ИЗПЪЛНИ СЛЕД `npx cap add android`, ПРЕДИ gradle/Android Studio билд.
# (android/ е gitignored + се регенерира, затова native кодът живее тук, в native/,
#  и се „инсталира" с този скрипт.)
#
# Какво прави:
#   1. Копира .kt файловете в android/app/src/main/java/com/kcy/notificationreply/
#   2. Вмъква <service> фрагмента в <application> на AndroidManifest.xml
#   3. Регистрира плъгина в MainActivity (registerPlugin(NotificationReplyPlugin.class))
#
# Идемпотентен е: повторно изпълнение не дублира.
# ------------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$HERE/.." && pwd)"
ANDROID="$APP_DIR/android"
SRC="$HERE/notification-reply"

PKG_PATH="com/kcy/notificationreply"
JAVA_ROOT="$ANDROID/app/src/main/java"
DEST="$JAVA_ROOT/$PKG_PATH"
MANIFEST="$ANDROID/app/src/main/AndroidManifest.xml"

if [ ! -d "$ANDROID" ]; then
  echo "ГРЕШКА: липсва $ANDROID. Първо изпълни: npx cap add android" >&2
  exit 1
fi

echo "==> 1/3 Копирам Kotlin източниците"
mkdir -p "$DEST"
cp "$SRC/KcyNotificationListener.kt" "$DEST/"
cp "$SRC/NotificationReplyPlugin.kt" "$DEST/"
echo "    -> $DEST"

echo "==> 2/3 Вмъквам <service> в AndroidManifest.xml"
if grep -q "com.kcy.notificationreply.KcyNotificationListener" "$MANIFEST"; then
  echo "    (вече е вмъкнат — пропускам)"
else
  # Извличаме съдържанието на фрагмента без коментара (от първия <service до </service>).
  FRAG="$(sed -n '/<service/,/<\/service>/p' "$SRC/AndroidManifest.fragment.xml")"
  # Записваме фрагмента във временен файл и го вмъкваме точно преди </application>.
  TMP="$(mktemp)"
  printf '%s\n' "$FRAG" > "$TMP"
  # awk: при срещане на </application> първо изсипваме фрагмента, после реда.
  awk -v fragfile="$TMP" '
    /<\/application>/ && !done {
      while ((getline line < fragfile) > 0) print "        " line
      done=1
    }
    { print }
  ' "$MANIFEST" > "$MANIFEST.new"
  mv "$MANIFEST.new" "$MANIFEST"
  rm -f "$TMP"
  echo "    -> вмъкнато преди </application>"
fi

echo "==> 3/3 Регистрирам плъгина в MainActivity"
MAIN_JAVA="$(find "$JAVA_ROOT" -name 'MainActivity.java' | head -n 1 || true)"
if [ -z "${MAIN_JAVA:-}" ]; then
  echo "    ВНИМАНИЕ: MainActivity.java не е намерен. Capacitor 6 може да авто-открие плъгина."
  echo "    Ако WhatsApp/Viber/Messenger каналите не виждат плъгина, регистрирай ръчно (виж register.txt)."
else
  if grep -q "NotificationReplyPlugin" "$MAIN_JAVA"; then
    echo "    (вече е регистриран — пропускам)"
  else
    # Добавяме import след package реда и registerPlugin преди super.onCreate.
    python3 - "$MAIN_JAVA" <<'PY' 2>/dev/null || PYFAIL=1
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "NotificationReplyPlugin" not in s:
    s = re.sub(r'(package [^\n]+\n)',
               r'\1\nimport com.kcy.notificationreply.NotificationReplyPlugin;\n',
               s, count=1)
    if "super.onCreate" in s:
        s = s.replace("super.onCreate(savedInstanceState);",
                      "registerPlugin(NotificationReplyPlugin.class);\n        super.onCreate(savedInstanceState);",
                      1)
    open(p, "w", encoding="utf-8").write(s)
PY
    if [ "${PYFAIL:-0}" = "1" ]; then
      echo "    ВНИМАНИЕ: python3 липсва — регистрирай ръчно в MainActivity (виж register.txt)."
    else
      echo "    -> registerPlugin(NotificationReplyPlugin.class) добавен"
    fi
  fi
fi

echo
echo "ГОТОВО. Сега: npx cap sync android && gradle/Android Studio билд."
echo 'На устройството: дай „Notification access“ от настройките (бутонът в приложението го отваря).'
