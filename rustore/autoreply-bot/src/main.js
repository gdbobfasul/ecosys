// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
enforceLock();
mountEcosystem('autoreply-bot'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
startPromoAds('autoreply-bot'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('autoreply-bot'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
// main.js — входна точка: рутиране между екраните + долна навигация.
import './ui/styles.css';
import { el, clear } from './ui/dom.js';
import { getState } from './core/storage.js';
import { OnboardingScreen } from './screens/onboarding.js';
import { RulesConfigScreen } from './screens/rules-config.js';
import { PermissionsScreen } from './screens/permissions.js';
import { DashboardScreen } from './screens/dashboard.js';
import { DemoInboxScreen } from './screens/demo-inbox.js';
import { ChannelsScreen } from './screens/channels.js';
import { LanguageScreen } from './screens/language.js';
import { startPump } from './core/pump.js';
import { t, applyDir, hasLangChosen } from './core/i18n.js';

const app = document.getElementById('app');

// Текущ екран.
let current = 'dashboard';
// Дали показваме слоя за избор на език.
let langPicker = false;

const TABS = [
  { id: 'dashboard', ic: '🏠', key: 'tab_dashboard' },
  { id: 'channels', ic: '🔗', key: 'tab_channels' },
  { id: 'rules', ic: '📜', key: 'tab_rules' },
  { id: 'inbox', ic: '💬', key: 'tab_demo' },
  { id: 'permissions', ic: '🔐', key: 'tab_permissions' }
];

function navigate(screen) {
  current = screen;
  render();
}

// Отваря/затваря слоя за избор на език (ползва се от 🌐 бутона).
export function openLanguage() { langPicker = true; render(); }

export function render() {
  const s = getState();
  clear(app);

  // Прилагаме посоката (rtl за арабски) и lang атрибута при всяко рисуване.
  applyDir();

  // Слой за избор на език: при първо стартиране (без избран език) или при поискване.
  if (langPicker || !hasLangChosen()) {
    app.appendChild(LanguageScreen({ onPick: () => { langPicker = false; render(); } }));
    removeTabbar();
    return;
  }

  // Док онбординг, докато роботът не е активиран.
  if (!s.activated) {
    app.appendChild(OnboardingScreen({ navigate, render, openLanguage }));
    removeTabbar();
    return;
  }

  let view;
  switch (current) {
    case 'channels': view = ChannelsScreen({ navigate, render, openLanguage }); break;
    case 'rules': view = RulesConfigScreen({ navigate, render, openLanguage }); break;
    case 'inbox': view = DemoInboxScreen({ navigate, render, openLanguage }); break;
    case 'permissions': view = PermissionsScreen({ navigate, render, openLanguage }); break;
    case 'dashboard':
    default: view = DashboardScreen({ navigate, render, openLanguage }); current = 'dashboard'; break;
  }
  app.appendChild(view);
  renderTabbar();

  // Стартираме реалните канали (KCY polling + native listener) веднъж след активиране.
  startPump(render);
}

function renderTabbar() {
  removeTabbar();
  const bar = el('nav', { class: 'tabbar', id: 'tabbar' },
    TABS.map((tab) => {
      const b = el('button', { class: current === tab.id ? 'active' : '' }, [
        el('span', { class: 'ic' }, tab.ic),
        el('span', {}, t(tab.key))
      ]);
      b.addEventListener('click', () => navigate(tab.id));
      return b;
    }));
  document.body.appendChild(bar);
}

function removeTabbar() {
  const ex = document.getElementById('tabbar');
  if (ex) ex.remove();
}

render();
