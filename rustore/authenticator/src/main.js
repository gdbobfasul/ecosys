// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { playIntro } from './core/intro.js';
import { mountHelp } from './core/help.js';
enforceLock();
playIntro(); // кратко „KCY Ecosystem" интро при старт
mountHelp('authenticator'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
// main.js — входна точка и рутер на „KCY Authenticator".
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
  'password-edit': renderPasswordEdit
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
function resetLockTimer() {
  if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
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
  // Заключи при отиване на заден план (живот на приложението).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session.unlocked) {
      const sec = autoLockSeconds();
      if (sec && sec > 0) nav.lock();
    }
  });
  nav.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
