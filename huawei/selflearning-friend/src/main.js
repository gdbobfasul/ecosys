import { enforceLock } from './core/lock.js';
enforceLock(); // 4-дневно пробно заключване (виж core/lock.js)
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
import { renderLanguage } from './screens/language.js';
import { hasLangChosen, t } from './core/i18n.js';

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
// route → ключ за превод на етикета в навигацията (преводът се чете при всяко рисуване).
const NAV = [
  ['chat', 'nav_chat'],
  ['tasks', 'nav_tasks'],
  ['memory', 'nav_memory'],
  ['sources', 'nav_sources'],
  ['vision', 'nav_vision'],
  ['youtube', 'nav_youtube'],
  ['animations', 'nav_animations'],
  ['settings', 'nav_settings']
];

// Флаг: показваме екрана за избор на UI език (повторен избор от 🌐 бутона). При първо
// стартиране се определя автоматично от hasLangChosen() в render().
let forceLangPicker = false;

function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return APP_ROUTES[h] ? h : 'chat';
}

export function navigate(route) { location.hash = '#/' + route; }

// Отваря екрана за повторен избор на UI език (от 🌐 бутона / Настройки). След избор
// (или Отказ) се връща към нормалния поток през render().
export function openLangPicker() { forceLangPicker = true; render(); }

function renderNav(active) {
  return el('nav', { class: 'tabbar' },
    NAV.map(([route, labelKey]) =>
      el('button', {
        class: 'tab' + (route === active ? ' active' : ''),
        onclick: () => navigate(route)
      }, t(labelKey))
    )
  );
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  clear(app);

  const screen = el('main', { class: 'screen' });
  const ctx = { navigate, rerender: render, openLangPicker };

  // ПЪРВО СТАРТИРАНЕ: избор на UI език ПРЕДИ целия поток (lockdown/раждане/заключване/чат).
  // Показваме го, ако потребителят още не е избирал език, ИЛИ ако е поискал повторен избор
  // от 🌐 бутона (forceLangPicker). Гласовият език е независим и не се пипа тук.
  const repick = forceLangPicker;
  if (!hasLangChosen() || repick) {
    stopLearning(); stopListening(); stopConversation();
    renderLanguage(screen, {
      showCancel: repick,                       // „Отказ“ само при повторен избор (вече има избран)
      onChosen: () => { forceLangPicker = false; render(); },
      onCancel: () => { forceLangPicker = false; render(); }
    });
    app.appendChild(screen);
    return;
  }

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
