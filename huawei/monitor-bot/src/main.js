// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
enforceLock();
mountEcosystem('monitor-bot'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
startPromoAds('monitor-bot'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('monitor-bot'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
// Входна точка — мъничък рутер между екраните + bootstrap на планировчика.
import { injectStyles, el } from './ui/styles.js';
import { loadState, defaultState } from './core/storage.js';
import { startScheduler, tick } from './core/scheduler.js';
import { APP_NAME } from './config.js';
import { t, applyDir, hasLangChosen } from './core/i18n.js';

import { renderOnboarding } from './screens/onboarding.js';
import { renderPermissions } from './screens/permissions.js';
import { renderMonitorConfig } from './screens/monitor-config.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderLanguage } from './screens/language.js';

const root = document.getElementById('app');
let state = null;
let current = 'onboarding';
let currentParams = null;
// Показваме ли точно сега екрана за избор на език (преди първия екран / при ръчно отваряне)?
let langPick = false;

const SCREENS = {
  onboarding: renderOnboarding,
  permissions: renderPermissions,
  'monitor-config': renderMonitorConfig,
  dashboard: renderDashboard
};

// Долна навигация — само след онбординг. Етикетите се превеждат при всяко рисуване.
const NAV = [
  { id: 'dashboard', ic: '📡', label: 'nav_dashboard' },
  { id: 'monitor-config', ic: '＋', label: 'nav_monitor' },
  { id: 'permissions', ic: '🔔', label: 'nav_permissions' },
  { id: 'onboarding', ic: 'ℹ️', label: 'nav_about' }
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

  // Топбар (с бутон за смяна на език 🌐)
  root.appendChild(el('div', { class: 'topbar' }, [
    el('div', { class: 'logo' }),
    el('h1', {}, APP_NAME),
    el('button', {
      class: 'lang',
      title: t('language'),
      onclick: () => { langPick = true; render(); }
    }, t('lang_btn'))
  ]));

  // Екран за избор на език (заема мястото на съдържанието; без долна навигация).
  if (langPick) {
    root.appendChild(renderLanguage(() => { langPick = false; render(); }));
    return;
  }

  const fn = SCREENS[current] || renderDashboard;
  root.appendChild(fn(ctx()));

  // Навигация (скрита по време на първоначалния онбординг)
  if (state.onboarded) {
    const nav = el('div', { class: 'nav' });
    for (const n of NAV) {
      nav.appendChild(el('button', {
        class: current === n.id ? 'active' : '',
        onclick: () => go(n.id)
      }, [el('span', { class: 'ic' }, n.ic), t(n.label)]));
    }
    root.appendChild(nav);
  }
}

async function boot() {
  injectStyles();
  applyDir();
  // Първо стартиране без избран език → показваме избора преди всичко останало.
  langPick = !hasLangChosen();
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
      const msg = (e && e.message) ? e.message : t('boot_unknown');
      d.innerHTML = '<h2>' + APP_NAME + '</h2><p>' +
        t('boot_error').replace('{0}', msg) + '</p>';
      root.appendChild(d);
    }
  } catch (_) {}
});
