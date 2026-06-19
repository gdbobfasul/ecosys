// main.js — буут + мъничък рутер между екраните.
// Бутва бързо: TF.js НЕ се внася тук (lazy-load в recognizer.js при първа нужда).

import { injectStyles } from './ui/styles.js';
import { loadSettings, DEFAULT_SETTINGS } from './core/storage.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderPermissions } from './screens/permissions.js';
import { renderConfig } from './screens/config.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderWatcher, teardownWatcher } from './screens/watcher.js';
import { isWatcher } from './core/pairing.js';

const screens = {
  onboarding: renderOnboarding,
  permissions: renderPermissions,
  config: renderConfig,
  dashboard: renderDashboard,
  watcher: renderWatcher
};

async function go(name) {
  const root = document.getElementById('app');
  // Винаги спираме евентуалното живо полване на наблюдаващия преди смяна на екран.
  teardownWatcher();
  // В роля „Наблюдаващ" таблото е без камера → показваме изгледа на наблюдаващия.
  if (name === 'dashboard' && isWatcher()) name = 'watcher';
  const render = screens[name] || renderOnboarding;
  try {
    await render(root, { go });
  } catch (e) {
    root.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'card';
    p.innerHTML = '<h2>Грешка</h2><p>' + (e && e.message ? e.message : 'неизвестна') + '</p>';
    root.appendChild(p);
  }
}

async function boot() {
  injectStyles();
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
      root.innerHTML = '<div class="card"><h2>Камера-страж</h2><p>Стартовата грешка беше прихваната: ' +
        (e && e.message ? e.message : 'неизвестна') + '</p></div>';
    }
  } catch (_) {}
});
