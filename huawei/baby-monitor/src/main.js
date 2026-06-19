// main.js — входна точка + рутер със състояния:
//   1) НЕ е активиран → onboarding
//   2) активиран, но не е минал config/permissions → продължава онбординга
//   3) онбординг завършен → приложение (dashboard / config / log) с долна навигация
import './ui/styles.css';
import { hydrate, getState } from './core/storage.js';
import { el, clear } from './ui/dom.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderConfig } from './screens/config.js';
import { renderPermissions } from './screens/permissions.js';
import { renderDashboard, teardownDashboard } from './screens/dashboard.js';
import { renderWatcher, teardownWatcher } from './screens/watcher.js';
import { renderLog } from './screens/log.js';
import { isWatcher } from './core/pairing.js';

// Маршрути на „онбординг“ потока (без таб-бар).
const FLOW = {
  onboarding: renderOnboarding,
  config: renderConfig,
  permissions: renderPermissions
};
// Маршрути на готовото приложение (с таб-бар).
const APP_ROUTES = {
  dashboard: renderDashboard,
  log: renderLog,
  config: renderConfig
};
const NAV = [
  ['dashboard', 'Наблюдение'],
  ['log', 'Дневник'],
  ['config', 'Настройки']
];

function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return h || '';
}

export function navigate(route) { location.hash = '#/' + route; }

function renderNav(active) {
  return el('nav', { class: 'tabbar' },
    NAV.map(([route, label]) =>
      el('button', {
        class: 'tab' + (route === active ? ' active' : ''),
        onclick: () => navigate(route)
      }, label)
    )
  );
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  // Винаги спираме евентуалното живо наблюдение преди пререндер (камера/цикъл + watcher poll).
  teardownDashboard();
  teardownWatcher();
  clear(app);

  const s = getState();
  const screen = el('main', { class: 'screen' });
  const ctx = { navigate, rerender: render };

  // Все още не активиран → онбординг.
  if (!s.activated) {
    renderOnboarding(screen, ctx);
    app.appendChild(screen);
    return;
  }

  // Активиран, но онбордингът не е завършен → водим през потока.
  if (!s.onboarded) {
    const r = currentRoute();
    const fn = FLOW[r] || renderConfig; // след активиране отиваме на config
    fn(screen, ctx);
    app.appendChild(screen);
    return;
  }

  // Готово приложение с таб-бар.
  let route = currentRoute();
  if (!APP_ROUTES[route]) route = 'dashboard';
  // В роля „Наблюдаващ" табът „Наблюдение" показва изгледа на наблюдаващия (без камера).
  if (route === 'dashboard' && isWatcher()) renderWatcher(screen, ctx);
  else APP_ROUTES[route](screen, ctx);
  app.appendChild(screen);
  app.appendChild(renderNav(route));
}

window.addEventListener('hashchange', render);

// Пауза на наблюдението при минимизиране (пести батерия + освобождава камерата).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) teardownDashboard();
  });
}

async function boot() {
  try { await hydrate(); } catch (_) { /* localStorage кешът остава */ }
  render();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
