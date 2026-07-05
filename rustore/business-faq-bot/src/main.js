// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { mountHelp } from './core/help.js';
enforceLock();
mountEcosystem('business-faq-bot'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
mountHelp('business-faq-bot'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
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
import { renderLanguagePicker } from './screens/language.js';
import { startPump } from './core/pump.js';
import { t, hasLangChosen, applyDir } from './core/i18n.js';

const ROUTES = {
  onboarding: renderOnboarding,
  kb: renderKbConfig,
  channels: renderChannels,
  permissions: renderPermissions,
  dashboard: renderDashboard,
  chat: renderDemoChat
};

const NAV = [
  ['dashboard', 'nav_dashboard'],
  ['kb', 'nav_kb'],
  ['channels', 'nav_channels'],
  ['chat', 'nav_chat'],
  ['permissions', 'nav_permissions']
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
    NAV.map(([route, labelKey]) =>
      el('button', {
        class: 'tab' + (route === active ? ' active' : ''),
        onclick: () => navigate(route)
      }, t(labelKey))
    )
  );
}

function render() {
  const app = document.getElementById('app');
  clear(app);
  applyDir();

  // ПЪРВО стартиране: показваме избор на език преди всичко друго.
  if (!hasLangChosen()) {
    renderLanguagePicker(app, render);
    return;
  }

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
