// main.js — буут + мъничък рутер между екраните.
// Бутва бързо: TF.js НЕ се внася тук (lazy-load в recognizer.js при първа нужда).

import { injectStyles } from './ui/styles.js';
import { loadSettings, DEFAULT_SETTINGS } from './core/storage.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderPermissions } from './screens/permissions.js';
import { renderConfig } from './screens/config.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderWatcher, teardownWatcher } from './screens/watcher.js';
import { renderLanguage } from './screens/language.js';
import { isWatcher } from './core/pairing.js';
import { t, tf, applyDir, hasLangChosen } from './core/i18n.js';

const screens = {
  language: renderLanguage,
  onboarding: renderOnboarding,
  permissions: renderPermissions,
  config: renderConfig,
  dashboard: renderDashboard,
  watcher: renderWatcher
};

// Малък 🌐 бутон (горе вдясно) за повторна смяна на езика по всяко време.
function ensureLangFab() {
  let fab = document.getElementById('lang-fab');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'lang-fab';
    fab.className = 'lang-fab';
    fab.addEventListener('click', () => go('language'));
    document.body.appendChild(fab);
  }
  fab.textContent = t('lang_btn');
}

async function go(name) {
  const root = document.getElementById('app');
  // Винаги спираме евентуалното живо полване на наблюдаващия преди смяна на екран.
  teardownWatcher();
  // В роля „Наблюдаващ" таблото е без камера → показваме изгледа на наблюдаващия.
  if (name === 'dashboard' && isWatcher()) name = 'watcher';
  // На екрана за избор на език няма нужда от плаващия 🌐 бутон.
  const fab = document.getElementById('lang-fab');
  if (fab) fab.style.display = (name === 'language') ? 'none' : '';
  const render = screens[name] || renderOnboarding;
  try {
    await render(root, { go });
  } catch (e) {
    root.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'card';
    p.innerHTML = '<h2>' + t('error') + '</h2><p>' + (e && e.message ? e.message : t('unknown')) + '</p>';
    root.appendChild(p);
  }
  // Етикетът на бутона следва текущия език.
  if (document.getElementById('lang-fab')) ensureLangFab();
}

async function boot() {
  injectStyles();
  applyDir();          // посока на текста (RTL за арабски) според избрания език
  ensureLangFab();     // плаващ 🌐 бутон за смяна на езика
  // ПЪРВО СТАРТИРАНЕ: ако още не е избран език → екран за избор ПРЕДИ всичко друго.
  if (!hasLangChosen()) { go('language'); return; }
  // Не блокираме UI вечно заради настройките: ако четенето се забави/счупи, тръгваме с
  // подразбиращите се (onboarding). Така никога няма „увиснал" тъмен екран при старт.
  let s = { ...DEFAULT_SETTINGS };
  try {
    s = await Promise.race([
      loadSettings(),
      new Promise((res) => setTimeout(() => res({ ...DEFAULT_SETTINGS }), 2500))
    ]);
  } catch (_) { s = { ...DEFAULT_SETTINGS }; }
  go(s && s.activated ? 'dashboard' : 'onboarding');
}

// Никаква грешка при буут да не оставя празен екран — показваме видимо съобщение.
boot().catch((e) => {
  try {
    const root = document.getElementById('app');
    if (root) {
      root.innerHTML = '<div class="card"><h2>' + t('app_name') + '</h2><p>' +
        tf('boot_error', (e && e.message ? e.message : t('unknown'))) + '</p></div>';
    }
  } catch (_) {}
});
