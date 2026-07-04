// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { mountHelp } from './core/help.js';
enforceLock();
mountHelp('price-watch-bot'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
// Входна точка — рутер между екраните.
import { injectStyles } from './ui/styles.js';
import { loadState, defaultState } from './core/storage.js';
import { start, stop } from './core/scheduler.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderConfig } from './screens/config.js';
import { renderPermissions } from './screens/permissions.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderLanguage } from './screens/language.js';
import { applyDir, t, hasLangChosen } from './core/i18n.js';

const root = document.getElementById('app');
let state = null;

function go(screen) {
  switch (screen) {
    case 'language': return renderLanguage(root, () => go(state.onboarded ? 'dashboard' : 'onboarding'));
    case 'onboarding': return renderOnboarding(root, state, go);
    case 'config': return renderConfig(root, state, go);
    case 'permissions': return renderPermissions(root, state, go);
    case 'dashboard': return renderDashboard(root, state, go);
    default: return renderOnboarding(root, state, go);
  }
}

// Свободна точка за повторно отваряне на избора на език (от бутона 🌐).
window.__pwbOpenLang = () => go('language');

async function boot() {
  injectStyles();
  applyDir();
  // Не блокираме рисуването вечно — при забавяне/срив тръгваме с подразбиращото се.
  try {
    state = await Promise.race([
      loadState(),
      new Promise((res) => setTimeout(() => res(defaultState()), 2500))
    ]);
  } catch (_) { state = defaultState(); }
  if (!state) state = defaultState();

  // Ако роботът вече е бил пуснат, продължаваме планировчика веднага.
  if (state.masterOn) start(state, () => { /* екранът се пречертава при влизане */ });

  // Спираме таймера при затваряне, за да не текат заявки.
  window.addEventListener('beforeunload', stop);

  // ПЪРВО стартиране → избор на език преди първия екран; после се пропуска.
  if (!hasLangChosen()) return go('language');

  go(state.onboarded ? 'dashboard' : 'onboarding');
}

// Никаква грешка при буут да не оставя черен екран.
boot().catch((e) => {
  try {
    if (root) {
      const msg = (e && e.message) ? e.message : t('err_unknown');
      root.innerHTML = '<div style="padding:20px;font-family:sans-serif">' +
        '<h2>' + t('app_name') + '</h2><p>' +
        t('boot_error').replace('{0}', msg) + '</p></div>';
    }
  } catch (_) {}
});
