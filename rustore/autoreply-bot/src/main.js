// main.js — входна точка: рутиране между екраните + долна навигация.
import './ui/styles.css';
import { el, clear } from './ui/dom.js';
import { getState } from './core/storage.js';
import { OnboardingScreen } from './screens/onboarding.js';
import { RulesConfigScreen } from './screens/rules-config.js';
import { PermissionsScreen } from './screens/permissions.js';
import { DashboardScreen } from './screens/dashboard.js';
import { DemoInboxScreen } from './screens/demo-inbox.js';

const app = document.getElementById('app');

// Текущ екран.
let current = 'dashboard';

const TABS = [
  { id: 'dashboard', ic: '🏠', label: 'Табло' },
  { id: 'rules', ic: '📜', label: 'Правила' },
  { id: 'inbox', ic: '💬', label: 'Demo' },
  { id: 'permissions', ic: '🔐', label: 'Права' }
];

function navigate(screen) {
  current = screen;
  render();
}

export function render() {
  const s = getState();
  clear(app);

  // Док онбординг, докато роботът не е активиран.
  if (!s.activated) {
    app.appendChild(OnboardingScreen({ navigate, render }));
    removeTabbar();
    return;
  }

  let view;
  switch (current) {
    case 'rules': view = RulesConfigScreen({ navigate, render }); break;
    case 'inbox': view = DemoInboxScreen({ navigate, render }); break;
    case 'permissions': view = PermissionsScreen({ navigate, render }); break;
    case 'dashboard':
    default: view = DashboardScreen({ navigate, render }); current = 'dashboard'; break;
  }
  app.appendChild(view);
  renderTabbar();
}

function renderTabbar() {
  removeTabbar();
  const bar = el('nav', { class: 'tabbar', id: 'tabbar' },
    TABS.map((t) => {
      const b = el('button', { class: current === t.id ? 'active' : '' }, [
        el('span', { class: 'ic' }, t.ic),
        el('span', {}, t.label)
      ]);
      b.addEventListener('click', () => navigate(t.id));
      return b;
    }));
  document.body.appendChild(bar);
}

function removeTabbar() {
  const ex = document.getElementById('tabbar');
  if (ex) ex.remove();
}

render();
