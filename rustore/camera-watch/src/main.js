// main.js — буут + мъничък рутер между екраните.
// Бутва бързо: TF.js НЕ се внася тук (lazy-load в recognizer.js при първа нужда).

import { injectStyles } from './ui/styles.js';
import { loadSettings } from './core/storage.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderPermissions } from './screens/permissions.js';
import { renderConfig } from './screens/config.js';
import { renderDashboard } from './screens/dashboard.js';

const screens = {
  onboarding: renderOnboarding,
  permissions: renderPermissions,
  config: renderConfig,
  dashboard: renderDashboard
};

async function go(name) {
  const root = document.getElementById('app');
  const render = screens[name] || renderOnboarding;
  try {
    await render(root, { go });
  } catch (e) {
    root.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'card';
    p.innerHTML = '<h2>Грешка</h2><p>' + (e && e.message ? e.message : 'неизвестна') + '</p>';
    root.appendChild(p);
  }
}

async function boot() {
  injectStyles();
  const s = await loadSettings();
  // Ако вече е активиран — право на таблото; иначе onboarding.
  go(s.activated ? 'dashboard' : 'onboarding');
}

boot();
