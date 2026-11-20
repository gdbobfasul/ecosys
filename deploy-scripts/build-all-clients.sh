#!/bin/bash
# Version: 1.0000
##############################################################################
# KCY — ЕДИННА компилация на ВСИЧКИ клиентски приложения (един източник на истина).
#
# Вика се от:
#   • старт-меню точка 97 (интерактивният избор на обхват/вариант)
#   • 02-full-install.sh стъпка 0/5 (пълната инсталация — пълен билд)
#   • старт-меню точки 87 / 88 / 95 (деплой на SendTo / Desk / Дом — билд частта)
# Така „навсякъде, където деплой изисква билд" минава ПРЕЗ ТУК — няма дублирана логика.
#
# Обхват (BAC_SCOPE):
#   all      магазинни (rustore/huawei) + SendTo + Desk + Дом            [по подразбиране]
#   store    само магазинните апове
#   private  само частните (SendTo + Desk + Дом)
#   exe      само десктоп .exe-тата (SendTo + Desk + Дом-Център)
#   apk      само APK-тата (магазинни + частни)
#   sendto   само SendTo (.exe + APK)
#   desk     само Desk (.exe + APK)
#   dom      само Pupikes Дом (5 роли: APK + .exe)
#
# Допълнителни env:
#   KCY_BUILD_VARIANT   debug | release | both   (за магазинните; дефолт debug)
#   KCY_STORES          "huawei" | "rustore" | "rustore huawei"  (за магазинните)
#   KCY_APPS_ONLY       ограничава магазинните до списък (иначе всички)
#   PUPIKES_DOM_DOMAIN  домейн за server.url на Дом (дефолт take.offbitch.com)
#
# Нефатално: провал на един апп НЕ спира останалите (връща 0, за да продължи деплоят).
##############################################################################
set +e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; GRAY=$'\033[0;90m'; BOLD=$'\033[1m'; NC=$'\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 0

SCOPE="${BAC_SCOPE:-all}"
DOM_DOMAIN="${PUPIKES_DOM_DOMAIN:-take.offbitch.com}"

# Какво да билдна според обхвата
DO_STORE=0; DO_SENDTO=0; DO_DESK=0; DO_DOM=0; PRIV_ONLY=""
case "$SCOPE" in
    all)     DO_STORE=1; DO_SENDTO=1; DO_DESK=1; DO_DOM=1 ;;
    store)   DO_STORE=1 ;;
    private) DO_SENDTO=1; DO_DESK=1; DO_DOM=1 ;;
    exe)     DO_SENDTO=1; DO_DESK=1; DO_DOM=1; PRIV_ONLY="exe" ;;   # магазинните са само APK → извън exe
    apk)     DO_STORE=1; DO_SENDTO=1; DO_DESK=1; DO_DOM=1; PRIV_ONLY="apk" ;;
    sendto)  DO_SENDTO=1 ;;
    desk)    DO_DESK=1 ;;
    dom)     DO_DOM=1 ;;
    *)       echo -e "${YELLOW}! Непознат BAC_SCOPE='$SCOPE' — ползвам 'all'${NC}"; DO_STORE=1; DO_SENDTO=1; DO_DESK=1; DO_DOM=1 ;;
esac
# Ръчен override на формата за частните (exe|apk), независимо от обхвата — ползва се от 87/88.
[ -n "${BAC_PRIV_ONLY:-}" ] && PRIV_ONLY="$BAC_PRIV_ONLY"

echo -e "${BOLD}${CYAN}━━━ Компилация на клиентските приложения (обхват: ${SCOPE}) ━━━${NC}"

# ─────────────────────────── 1) Магазинни апове ───────────────────────────
if [ "$DO_STORE" = 1 ]; then
    echo ""
    echo -e "${CYAN}▶ Магазинни апове (rustore/huawei) — вариант: ${KCY_BUILD_VARIANT:-debug} · магазини: ${KCY_STORES:-rustore huawei}${NC}"
    case "${KCY_BUILD_VARIANT:-debug}" in
        release) KCY_BUILD_VARIANT=release bash "$SCRIPT_DIR/release-apks.sh" \
                    || echo -e "  ${YELLOW}! магазинният билд върна грешка — продължавам${NC}" ;;
        both)    KCY_BUILD_VARIANT=both    bash "$SCRIPT_DIR/release-apks.sh" \
                    || echo -e "  ${YELLOW}! магазинният билд върна грешка — продължавам${NC}" ;;
        *)       bash "$SCRIPT_DIR/build-mobile-apps.sh" all \
                    || echo -e "  ${YELLOW}! магазинният билд върна грешка — продължавам${NC}" ;;
    esac
fi

# ─── Хелпър за Electron+Capacitor апп (SendTo / Desk) → <dir>/release/ ───
# PD_ONLY: "exe" само .exe · "apk" само APK · празно = и двете. Нефатално.
build_ecap_app() {
    local dir="$1" label="$2"
    echo ""
    echo -e "${CYAN}▶ ${label} (${dir})${NC}"
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "  ${YELLOW}! npm липсва — прескачам ${label}.${NC}"; return 0
    fi
    if [ ! -d "$PROJECT_ROOT/$dir" ]; then
        echo -e "  ${YELLOW}! Няма папка ${dir} — прескачам.${NC}"; return 0
    fi
    ( cd "$PROJECT_ROOT/$dir" || exit 0
      [ -f build-tools/stamp-version.cjs ] && node build-tools/stamp-version.cjs || true
      echo -e "  ${GRAY}  npm install…${NC}"
      npm install --no-audit --no-fund 2>&1 | tail -3 || echo -e "  ${YELLOW}  ! npm install даде грешка${NC}"
      if [ "${PRIV_ONLY}" != "apk" ]; then
          echo -e "  ${GRAY}  Windows .exe (electron-builder) → release/…${NC}"
          npm run dist 2>&1 | tail -4 || echo -e "  ${YELLOW}  ! .exe билдът се провали — пропуснато${NC}"
      fi
      if [ "${PRIV_ONLY}" = "exe" ]; then
          : # само .exe
      elif [ -n "${ANDROID_HOME:-}" ] || [ -n "${ANDROID_SDK_ROOT:-}" ]; then
          echo -e "  ${GRAY}  Android APK → release/…${NC}"
          npm run android:add >/dev/null 2>&1 || true
          npm run android:apk 2>&1 | tail -4 || echo -e "  ${YELLOW}  ! APK билдът се провали — пропуснато${NC}"
      else
          echo -e "  ${YELLOW}  APK пропуснат: няма Android SDK (ANDROID_HOME) на тази машина.${NC}"
      fi
      [ -d release ] && { echo -e "  ${GREEN}  Готово в ${dir}/release/:${NC}"; ls -1 release 2>/dev/null | grep -vi '^readme' | sed 's/^/      • /' || true; }
    )
    return 0
}

[ "$DO_SENDTO" = 1 ] && build_ecap_app "private/pupikes-sendto" "Pupikes SendTo"
[ "$DO_DESK"   = 1 ] && build_ecap_app "private/pupikes-desk"   "Pupikes Desk"

# ─────────────────────── Pupikes Дом (5 роли обвивки) ───────────────────────
if [ "$DO_DOM" = 1 ]; then
    echo ""
    echo -e "${CYAN}▶ Pupikes Дом — обвивки (private/pupikes-dom/apps) · домейн: ${DOM_DOMAIN}${NC}"
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "  ${YELLOW}! npm липсва — прескачам Дом.${NC}"
    elif [ ! -d "$PROJECT_ROOT/private/pupikes-dom/apps" ]; then
        echo -e "  ${YELLOW}! Няма private/pupikes-dom/apps — прескачам.${NC}"
    else
        ( cd "$PROJECT_ROOT/private/pupikes-dom/apps" || exit 0
          [ -d node_modules ] || npm install --no-audit --no-fund 2>&1 | tail -3
          case "$PRIV_ONLY" in
              exe) node build.cjs --only exe --domain "$DOM_DOMAIN" ;;
              apk) node build.cjs --only apk --domain "$DOM_DOMAIN" ;;
              *)   node build.cjs --domain "$DOM_DOMAIN" ;;
          esac ) || echo -e "  ${YELLOW}  ! Дом билдът върна грешка — провери Node/Android SDK${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✓ Компилацията приключи (обхват: ${SCOPE}). Артефактите са в release/ на всяко приложение.${NC}"
exit 0
