// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { mountHelp } from './core/help.js';
enforceLock();
mountEcosystem('routine-bot'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
mountHelp('routine-bot'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
// Входна точка + прост рутер. Всичко е самостоятелно: без мрежа освен
// безплатното keyless Open-Meteo за времето.
import { injectStyles } from './ui/styles.js';
import { clear, h } from './ui/dom.js';
import { storage, KEYS } from './core/storage.js';
import { scheduler } from './core/scheduler.js';
import { t, applyDir, hasLangChosen } from './core/i18n.js';

import { renderOnboarding } from './screens/onboarding.js';
import { renderRoutineConfig } from './screens/routine-config.js';
import { renderRemindersSetup } from './screens/reminders.js';
import { renderPermissions } from './screens/permissions.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderNotes } from './screens/notes.js';
import { renderLanguage } from './screens/language.js';

const root = document.getElementById('app');
let navEl = null;
let langFab = null;

function go(screen) {
  clear(root);
  if (navEl) navEl.remove();
  navEl = null;

  const ctx = { go };
  switch (screen) {
    case 'language':
      // Изборът на език показва само езиковата решетка (без 🌐 бутон и навигация).
      removeLangFab();
      return renderLanguage(root, () => boot());
    case 'onboarding': return renderOnboarding(root, ctx);
    case 'config': return renderRoutineConfig(root, ctx);
    case 'reminders-setup': return renderRemindersSetup(root, ctx);
    case 'permissions': return renderPermissions(root, { ...ctx, isWizard: true });
    case 'permissions-edit': return renderPermissions(root, { ...ctx, isWizard: false });
    case 'dashboard':
      renderDashboard(root, ctx);
      mountNav('dashboard');
      return;
    case 'notes':
      renderNotes(root, ctx);
      mountNav('notes');
      return;
    default: return renderOnboarding(root, ctx);
  }
}

// Плаващ бутон 🌐 за смяна на езика на интерфейса по всяко време.
function ensureLangFab() {
  if (langFab) return;
  langFab = h(`<button class="lang-fab">${t('lang_btn')}</button>`);
  langFab.addEventListener('click', () => go('language'));
  document.body.appendChild(langFab);
}
function removeLangFab() {
  if (langFab) { langFab.remove(); langFab = null; }
}

function mountNav(active) {
  if (navEl) navEl.remove();
  navEl = h(`
    <nav class="nav">
      <button data-go="dashboard" class="${active === 'dashboard' ? 'active' : ''}">
        <span class="ico">🏠</span>${t('nav_dashboard')}</button>
      <button data-go="notes" class="${active === 'notes' ? 'active' : ''}">
        <span class="ico">📝</span>${t('nav_notes')}</button>
      <button data-go="config"><span class="ico">⚙️</span>${t('nav_routine')}</button>
      <button data-go="permissions-edit"><span class="ico">🔔</span>${t('nav_perms')}</button>
    </nav>
  `);
  navEl.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => go(b.dataset.go));
  });
  document.body.appendChild(navEl);
}

async function boot() {
  injectStyles();
  applyDir();

  // ПЪРВО стартиране: ако езикът на интерфейса още не е избран — покажи избора.
  if (!hasLangChosen()) {
    removeLangFab();
    return go('language');
  }
  ensureLangFab();

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
        '<h2>' + t('boot_title') + '</h2><p>' +
        t('boot_error').replace('{0}', (e && e.message ? e.message : t('boot_unknown'))) +
        '</p></div>';
    }
  } catch (_) {}
});
