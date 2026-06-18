// Входна точка + прост рутер. Всичко е самостоятелно: без мрежа освен
// безплатното keyless Open-Meteo за времето.
import { injectStyles } from './ui/styles.js';
import { clear, h } from './ui/dom.js';
import { storage, KEYS } from './core/storage.js';
import { scheduler } from './core/scheduler.js';

import { renderOnboarding } from './screens/onboarding.js';
import { renderRoutineConfig } from './screens/routine-config.js';
import { renderRemindersSetup } from './screens/reminders.js';
import { renderPermissions } from './screens/permissions.js';
import { renderDashboard } from './screens/dashboard.js';

const root = document.getElementById('app');
let navEl = null;

function go(screen) {
  clear(root);
  if (navEl) navEl.remove();
  navEl = null;

  const ctx = { go };
  switch (screen) {
    case 'onboarding': return renderOnboarding(root, ctx);
    case 'config': return renderRoutineConfig(root, ctx);
    case 'reminders-setup': return renderRemindersSetup(root, ctx);
    case 'permissions': return renderPermissions(root, { ...ctx, isWizard: true });
    case 'permissions-edit': return renderPermissions(root, { ...ctx, isWizard: false });
    case 'dashboard':
      renderDashboard(root, ctx);
      mountNav('dashboard');
      return;
    default: return renderOnboarding(root, ctx);
  }
}

function mountNav(active) {
  if (navEl) navEl.remove();
  navEl = h(`
    <nav class="nav">
      <button data-go="dashboard" class="${active === 'dashboard' ? 'active' : ''}">
        <span class="ico">🏠</span>Табло</button>
      <button data-go="config"><span class="ico">⚙️</span>Рутина</button>
      <button data-go="permissions-edit"><span class="ico">🔔</span>Разрешения</button>
    </nav>
  `);
  navEl.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => go(b.dataset.go));
  });
  document.body.appendChild(navEl);
}

async function boot() {
  injectStyles();
  const state = await storage.get(KEYS.state, null);
  // При старт презареди графика (нативно възстановяване след рестарт).
  try { await scheduler.reschedule(); } catch (_) {}
  if (state && state.onboarded) {
    go('dashboard');
  } else {
    go('onboarding');
  }
}

// Никаква грешка при буут да не оставя черен екран — показваме видимо съобщение.
boot().catch((e) => {
  try {
    const root = document.getElementById('app');
    if (root) {
      root.innerHTML = '<div style="padding:20px;font-family:sans-serif">' +
        '<h2>Робот за рутини</h2><p>Стартова грешка: ' + (e && e.message ? e.message : 'неизвестна') + '</p></div>';
    }
  } catch (_) {}
});
