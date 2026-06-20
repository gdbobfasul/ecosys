// main.js — входна точка + рутер със състояния:
//   0) засечена смяна на устройство → lockdown (анти-кражба)
//   1) НЕ е кръстен → раждане (birth)
//   2) кръстен, но заключен → lock (питай името)
//   3) отключен → приложение (chat / tasks / memory / settings)
import './ui/styles.css';
import { hydrate, getState } from './core/storage.js';
import { el, clear } from './ui/dom.js';
import { isNamed, isUnlocked } from './core/identity.js';
import { checkDeviceIntegrity, engageLockdown, isLockedDown } from './core/device.js';
import { start as startLearning, stop as stopLearning } from './core/learning-loop.js';
import { startListening, stopListening } from './core/listen.js';
import { stopConversation } from './core/conversation.js';
import { renderBirth } from './screens/birth.js';
import { renderLock } from './screens/lock.js';
import { renderLockdown } from './screens/lockdown.js';
import { renderChat } from './screens/chat.js';
import { renderTasks } from './screens/tasks.js';
import { renderMemory } from './screens/memory.js';
import { renderSources } from './screens/sources.js';
import { renderVision } from './screens/vision.js';
import { renderYoutube } from './screens/youtube.js';
import { renderAnimations } from './screens/animations.js';
import { renderSettings } from './screens/settings.js';

const APP_ROUTES = {
  chat: renderChat,
  tasks: renderTasks,
  memory: renderMemory,
  sources: renderSources,
  vision: renderVision,
  youtube: renderYoutube,
  animations: renderAnimations,
  settings: renderSettings
};
const NAV = [
  ['chat', 'Чат'],
  ['tasks', 'Задачи'],
  ['memory', 'Памет'],
  ['sources', 'Знание'],
  ['vision', 'Зрение'],
  ['youtube', 'YouTube'],
  ['animations', 'Анимации'],
  ['settings', 'Настройки']
];

function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return APP_ROUTES[h] ? h : 'chat';
}

export function navigate(route) { location.hash = '#/' + route; }

function renderNav(active) {
  return el('nav', { class: 'tabbar' },
    NAV.map(([route, label]) =>
      el('button', {
        class: 'tab' + (route === active ? ' active' : ''),
        onclick: () => navigate(route)
      }, label)
    )
  );
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  clear(app);

  const screen = el('main', { class: 'screen' });
  const ctx = { navigate, rerender: render };

  // Анти-кражба: ако е активен lockdown, искаме повторна авторизация преди всичко.
  if (isNamed() && isLockedDown()) {
    stopLearning(); stopListening(); stopConversation();
    renderLockdown(screen, ctx);
    app.appendChild(screen);
    return;
  }

  if (!isNamed()) {
    stopLearning(); stopListening(); stopConversation();
    renderBirth(screen, ctx);
    app.appendChild(screen);
    return;
  }
  if (!isUnlocked()) {
    stopLearning(); stopListening(); stopConversation();
    renderLock(screen, ctx);
    app.appendChild(screen);
    return;
  }

  // Отключени сме → пускаме непрекъснатото учене + слушането (докато приложението е активно).
  startLearning(learningRerender);
  startListening();

  const route = currentRoute();
  (APP_ROUTES[route] || renderChat)(screen, ctx);
  app.appendChild(screen);
  app.appendChild(renderNav(route));
}

// Фоновото учене обновява екрана при нов научен елемент. НО пълно пре-рисуване на
// ИНТЕРАКТИВНИ екрани разваля текущото действие: на „Чат" трие текста в полето, а на
// „Знание" (sources) ПРЕКЪСВА тегленето на connection.bot.token (връзката умираше след
// 1-2 опита, без да стигне до 4). Затова на тези екрани НЕ пре-рисуваме от фоновия такт.
// На останалите (Задачи, Памет…) обновяваме нормално, за да се вижда новонаученото.
const NO_BG_RERENDER = new Set(['chat', 'sources', 'settings']);
function learningRerender() {
  if (NO_BG_RERENDER.has(currentRoute())) return;
  render();
}

window.addEventListener('hashchange', render);

// Hydrate от нативния storage (ако има), после проверка за устройство, после рисуваме.
async function boot() {
  try { await hydrate(); } catch (_) { /* localStorage кешът остава */ }
  // Анти-кражба: ако имаме базов отпечатък и сегашното устройство не съвпада → lockdown.
  try {
    if (isNamed() && !isLockedDown()) {
      const integ = await checkDeviceIntegrity();
      if (integ.moved) engageLockdown('device-change');
    }
  } catch (_) { /* при съмнение не блокираме */ }
  render();
}

// Пауза на ученето при минимизиране/затваряне (пести батерия; пести и почтеност на сесията).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopLearning(); stopListening(); stopConversation(); }
    else if (isNamed() && isUnlocked() && !isLockedDown()) { startLearning(learningRerender); startListening(); }
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
