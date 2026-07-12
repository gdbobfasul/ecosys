// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('baby-monitor'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
startPromoAds('baby-monitor'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('baby-monitor'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('baby-monitor'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('baby-monitor'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
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
import { renderLanguage } from './screens/language.js';
import { isWatcher } from './core/pairing.js';
import { t, hasLangChosen, applyDir } from './core/i18n.js';

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
  ['dashboard', 'nav_watch'],
  ['log', 'nav_log'],
  ['config', 'nav_settings']
];

// При първо стартиране показваме избор на език ПРЕДИ първия екран.
let _langPending = !hasLangChosen();

function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return h || '';
}

export function navigate(route) { location.hash = '#/' + route; }

function renderNav(active) {
  return el('nav', { class: 'tabbar' },
    NAV.map(([route, key]) =>
      el('button', {
        class: 'tab' + (route === active ? ' active' : ''),
        onclick: () => navigate(route)
      }, t(key))
    )
  );
}

// Малък 🌐 бутон (горе вдясно) за повторен избор на език.
function langFab() {
  return el('button', {
    class: 'lang-fab',
    title: t('language'),
    'aria-label': t('language'),
    onclick: () => { _langPending = true; render(); }
  }, '🌐');
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

  // Първо стартиране (или натиснат 🌐) → избор на език ПРЕДИ всичко друго.
  if (_langPending) {
    renderLanguage(screen, () => { _langPending = false; render(); });
    app.appendChild(screen);
    return;
  }

  // Все още не активиран → онбординг.
  if (!s.activated) {
    renderOnboarding(screen, ctx);
    app.appendChild(screen);
    app.appendChild(langFab());
    return;
  }

  // Активиран, но онбордингът не е завършен → водим през потока.
  if (!s.onboarded) {
    const r = currentRoute();
    const fn = FLOW[r] || renderConfig; // след активиране отиваме на config
    fn(screen, ctx);
    app.appendChild(screen);
    app.appendChild(langFab());
    return;
  }

  // Готово приложение с таб-бар.
  let route = currentRoute();
  if (!APP_ROUTES[route]) route = 'dashboard';
  // В роля „Наблюдаващ" табът „Наблюдение" показва изгледа на наблюдаващия (без камера).
  if (route === 'dashboard' && isWatcher()) renderWatcher(screen, ctx);
  else APP_ROUTES[route](screen, ctx);
  app.appendChild(screen);
  app.appendChild(langFab());
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
  applyDir(); // прилага dir=rtl/ltr + lang според избрания език
  try { await hydrate(); } catch (_) { /* localStorage кешът остава */ }
  render();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
