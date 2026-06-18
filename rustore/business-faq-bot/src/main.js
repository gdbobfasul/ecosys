// main.js — входна точка + прост hash-based рутер.
import './ui/styles.css';
import { getState } from './core/storage.js';
import { el, clear } from './ui/dom.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderKbConfig } from './screens/kb-config.js';
import { renderChannels } from './screens/channels.js';
import { renderPermissions } from './screens/permissions.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderDemoChat } from './screens/demo-chat.js';
import { startPump } from './core/pump.js';

const ROUTES = {
  onboarding: renderOnboarding,
  kb: renderKbConfig,
  channels: renderChannels,
  permissions: renderPermissions,
  dashboard: renderDashboard,
  chat: renderDemoChat
};

const NAV = [
  ['dashboard', 'Табло'],
  ['kb', 'База знания'],
  ['channels', 'Канали'],
  ['chat', 'Демо чат'],
  ['permissions', 'Разрешения']
];

function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return h || (getState().activated ? 'dashboard' : 'onboarding');
}

export function navigate(route) {
  location.hash = '#/' + route;
}

function renderNav(active) {
  if (!getState().activated) return null;
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
  clear(app);

  let route = currentRoute();
  // Преди активиране насочваме винаги към онбординг.
  if (!getState().activated && route !== 'onboarding') route = 'onboarding';
  const renderFn = ROUTES[route] || renderOnboarding;

  const screen = el('main', { class: 'screen' });
  renderFn(screen, { navigate, rerender: render });

  app.appendChild(screen);
  const nav = renderNav(route);
  if (nav) app.appendChild(nav);
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
// При незабавно зареждане (модулите се изпълняват след DOM в повечето случаи):
if (document.readyState !== 'loading') render();

// Стартираме „двигателя" на реалните канали (KCY polling + native слушател).
// Деградира честно: ако нищо не е настроено/налично, просто не прави нищо.
startPump(render);
