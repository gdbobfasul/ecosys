// Входна точка — мъничък рутер между екраните + bootstrap на планировчика.
import { injectStyles, el } from './ui/styles.js';
import { loadState, defaultState } from './core/storage.js';
import { startScheduler, tick } from './core/scheduler.js';
import { APP_NAME } from './config.js';

import { renderOnboarding } from './screens/onboarding.js';
import { renderPermissions } from './screens/permissions.js';
import { renderMonitorConfig } from './screens/monitor-config.js';
import { renderDashboard } from './screens/dashboard.js';

const root = document.getElementById('app');
let state = null;
let current = 'onboarding';
let currentParams = null;

const SCREENS = {
  onboarding: renderOnboarding,
  permissions: renderPermissions,
  'monitor-config': renderMonitorConfig,
  dashboard: renderDashboard
};

// Долна навигация — само след онбординг.
const NAV = [
  { id: 'dashboard', ic: '📡', label: 'Табло' },
  { id: 'monitor-config', ic: '＋', label: 'Монитор' },
  { id: 'permissions', ic: '🔔', label: 'Разрешения' },
  { id: 'onboarding', ic: 'ℹ️', label: 'За робота' }
];

function go(screen, params = null) {
  current = screen;
  currentParams = params;
  render();
}
function refresh() { render(); }

const ctx = () => ({ state, go, refresh, params: currentParams });

function render() {
  root.innerHTML = '';

  // Топбар
  root.appendChild(el('div', { class: 'topbar' }, [
    el('div', { class: 'logo' }),
    el('h1', {}, APP_NAME)
  ]));

  const fn = SCREENS[current] || renderDashboard;
  root.appendChild(fn(ctx()));

  // Навигация (скрита по време на първоначалния онбординг)
  if (state.onboarded) {
    const nav = el('div', { class: 'nav' });
    for (const n of NAV) {
      nav.appendChild(el('button', {
        class: current === n.id ? 'active' : '',
        onclick: () => go(n.id)
      }, [el('span', { class: 'ic' }, n.ic), n.label]));
    }
    root.appendChild(nav);
  }
}

async function boot() {
  injectStyles();
  // Не блокираме рисуването вечно заради състоянието: ако четенето се забави/счупи,
  // тръгваме с подразбиращото се. Така никога няма „черен екран без меню" при старт.
  try {
    state = await Promise.race([
      loadState(),
      new Promise((res) => setTimeout(() => res(defaultState()), 2500))
    ]);
  } catch (_) { state = defaultState(); }
  if (!state) state = defaultState();
  current = state.onboarded ? 'dashboard' : 'onboarding';
  render();

  if (state.masterOn) {
    startScheduler(state, { onUpdate: refresh });
    // Веднага направи един тик при старт (наваксай пропуснатото докато апът е бил затворен).
    tick(state, { onUpdate: refresh }).catch(() => {});
  }
}

// Никаква грешка при буут да не оставя черен екран — показваме видимо съобщение.
boot().catch((e) => {
  try {
    if (root) {
      root.innerHTML = '';
      const d = document.createElement('div');
      d.style.cssText = 'padding:20px;color:#e8ecf5;font-family:sans-serif';
      d.innerHTML = '<h2>' + APP_NAME + '</h2><p>Стартова грешка: ' +
        (e && e.message ? e.message : 'неизвестна') + '</p>';
      root.appendChild(d);
    }
  } catch (_) {}
});
