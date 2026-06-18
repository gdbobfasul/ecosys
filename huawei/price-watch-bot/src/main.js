// Входна точка — рутер между екраните.
import { injectStyles } from './ui/styles.js';
import { loadState, defaultState } from './core/storage.js';
import { start, stop } from './core/scheduler.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderConfig } from './screens/config.js';
import { renderPermissions } from './screens/permissions.js';
import { renderDashboard } from './screens/dashboard.js';

const root = document.getElementById('app');
let state = null;

function go(screen) {
  switch (screen) {
    case 'onboarding': return renderOnboarding(root, state, go);
    case 'config': return renderConfig(root, state, go);
    case 'permissions': return renderPermissions(root, state, go);
    case 'dashboard': return renderDashboard(root, state, go);
    default: return renderOnboarding(root, state, go);
  }
}

async function boot() {
  injectStyles();
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

  go(state.onboarded ? 'dashboard' : 'onboarding');
}

// Никаква грешка при буут да не оставя черен екран.
boot().catch((e) => {
  try {
    if (root) {
      root.innerHTML = '<div style="padding:20px;font-family:sans-serif">' +
        '<h2>Робот за цени</h2><p>Стартова грешка: ' + (e && e.message ? e.message : 'неизвестна') + '</p></div>';
    }
  } catch (_) {}
});
