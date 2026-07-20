// Version: 1.0019
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
// ВГРАДЕН режим (?embedded=1): аутентикаторът живее КАТО ИНСТРУМЕНТ вътре в „Pupikes Toolkit"
// (iframe). Обвиващото приложение вече има интро/реклами/правен екран/долна лента → тук се
// пропускат, за да не излизат двойно. Самостоятелното приложение остава непроменено.
const KCY_EMBEDDED = /(^|[?&])embedded=1/.test(location.search);
enforceLock();
if (!KCY_EMBEDDED) {
  mountEcosystem('authenticator'); // „Още от Pupikes" showcase
  playIntro(); // кратко „Pupikes" интро при старт
  startPromoAds('authenticator'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
  mountHelp('authenticator'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
  mountPrivacyLink('authenticator'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
  mountLegalGate('authenticator'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
} else {
  // скрий долната Pupikes лента (kcy-bar се самомонтира при import от другите модули)
  const st = document.createElement('style');
  st.textContent = '#kcy-bar{display:none !important} body{padding-bottom:0 !important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
  if (document.head) document.head.appendChild(st);
}
// main.js — входна точка и рутер на „Pupikes Authenticator".
// Поток при старт:
//   1) още не е избран език → екран за избор на език (15-те езика);
//   2) няма сейф → екран за създаване на master парола;
//   3) има сейф → екран за отключване (парола/биометрия);
//   4) отключено → списък с кодовете.
// Авто-заключване: при бездействие сейфът се заключва и тайните се чистят от паметта.
import { THEME } from './theme.js';
import { CSS } from './ui/styles.js';
import { applyDir, hasLangChosen } from './core/i18n.js';
import { hasVault, loadSettings, session, lock, autoLockSeconds } from './core/storage.js';

import { renderLanguage } from './screens/language.js';
import { renderSetup } from './screens/setup.js';
import { renderUnlock } from './screens/unlock.js';
import { renderList } from './screens/list.js';
import { renderAdd } from './screens/add.js';
import { renderEdit } from './screens/edit.js';
import { renderSettings } from './screens/settings.js';
import { renderDups } from './screens/dups.js';
import { renderCollectionAdd } from './screens/collection-add.js';
import { renderCollectionView } from './screens/collection-view.js';
import { renderPasswordEdit } from './screens/password-edit.js';
import { renderSeedEdit } from './screens/seed-edit.js';

// --- Инжектиране на стилове + цветовете на темата като CSS променливи ---
function injectStyles() {
  const root = document.documentElement;
  root.style.setProperty('--bg', THEME.bg);
  root.style.setProperty('--bgCard', THEME.bgCard);
  root.style.setProperty('--bgInput', THEME.bgInput);
  root.style.setProperty('--text', THEME.text);
  root.style.setProperty('--textDim', THEME.textDim);
  root.style.setProperty('--border', THEME.border);
  root.style.setProperty('--primary', THEME.primary);
  root.style.setProperty('--accent', THEME.accent);
  root.style.setProperty('--danger', THEME.danger);
  root.style.setProperty('--warn', THEME.warn);
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

const SCREENS = {
  language: renderLanguage,
  setup: renderSetup,
  unlock: renderUnlock,
  list: renderList,
  add: renderAdd,
  edit: renderEdit,
  settings: renderSettings,
  dups: renderDups,
  'collection-add': renderCollectionAdd,
  'collection-view': renderCollectionView,
  'password-edit': renderPasswordEdit,
  'seed-edit': renderSeedEdit
};

// Навигационен обект, подаван на всеки екран.
export const nav = {
  current: null,
  go(screen, data) {
    this.current = screen;
    const root = document.getElementById('app');
    const fn = SCREENS[screen];
    if (fn) fn(root, this, data);
    resetLockTimer();
  },
  // Решава кой екран да покаже според състоянието.
  start() {
    if (!hasLangChosen()) return this.go('language');
    if (!hasVault()) return this.go('setup');
    if (!session.unlocked) return this.go('unlock');
    return this.go('list');
  },
  lock() {
    lock();
    this.go('unlock');
  }
};

// --- Авто-заключване при бездействие ---
let lockTimer = null;
let lastActivityAt = Date.now();   // за проверка при връщане на фокуса (таймерите на заден план спят)
function resetLockTimer() {
  if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
  lastActivityAt = Date.now();
  const sec = autoLockSeconds();
  if (!session.unlocked || !sec || sec <= 0) return;
  lockTimer = setTimeout(() => {
    if (session.unlocked) nav.lock();
  }, sec * 1000);
}

function bootstrap() {
  injectStyles();
  applyDir();
  // Активността нулира таймера за заключване.
  ['pointerdown', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, () => { if (session.unlocked) resetLockTimer(); }, { passive: true }));
  // Поведение при отиване на заден план (смяна на приложението). НО не и докато нативен
  // file-picker е активен (той изкарва апа на заден план; иначе трезорът се заключва насред
  // импорт → „locked").
  //   • lockOnBlur: true (подразбиране) → заключва ВЕДНАГА при загуба на фокус;
  //   • lockOnBlur: false → НЕ заключва при смяна на приложението: важи САМО таймаутът за
  //     бездействие. Понеже таймерите спят на заден план, при ВРЪЩАНЕ на фокуса проверяваме
  //     колко е минало от последното действие — изтекъл таймаут → заключва чак тогава.
  document.addEventListener('visibilitychange', () => {
    const sec = autoLockSeconds();
    if (document.hidden && session.unlocked && !window.__KCY_SUSPEND_LOCK__) {
      if (!sec || sec <= 0) return;                       // „никога" → не заключваме
      if (loadSettings().lockOnBlur === false) return;    // изборът: без заключване при смяна
      nav.lock();
    } else if (!document.hidden && session.unlocked) {
      if (sec && sec > 0 && (Date.now() - lastActivityAt) >= sec * 1000) nav.lock();
      else resetLockTimer();                              // подновяваме таймера след връщане
    }
  });
  nav.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
