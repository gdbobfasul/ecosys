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
import { renderSettings } from './screens/settings.js';
import { renderAgent } from './screens/agent.js';
import { renderAppBuilder } from './screens/app-builder.js';
import { renderLanguage } from './screens/language.js';
import { hasLangChosen, t } from './core/i18n.js';

// Десктоп ли сме? (Electron preload изнася SLF_DESKTOP === true.) Само тогава показваме
// екрана „🛠 Агент" + рутата му. На телефона (rustore/huawei) флагът липсва → скрит.
const IS_DESKTOP = (typeof window !== 'undefined' && window.SLF_DESKTOP === true);

const APP_ROUTES = {
  chat: renderChat,
  tasks: renderTasks,
  memory: renderMemory,
  sources: renderSources,
  vision: renderVision,
  youtube: renderYoutube,
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
  ['settings', 'nav_settings']
];

// Само на десктоп добавяме агентската рута + таб + App Builder-а. Етикетите им
// (🛠 Агент / 🏗 App Builder) са десктоп-специфични — оставаме ги без превод (нямат
// ключ в i18n; не са част от мобилния поток). Префиксваме ги с literal: за renderNav.
if (IS_DESKTOP) {
  APP_ROUTES.agent = renderAgent;
  NAV.push(['agent', 'literal:🛠 Агент']);
  APP_ROUTES['app-builder'] = renderAppBuilder;
  NAV.push(['app-builder', 'literal:🏗 App Builder']);
}

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

// Превежда етикет на навигацията: literal:… остава дословно, иначе е ключ за i18n.
function navLabel(labelKey) {
  return labelKey.startsWith('literal:') ? labelKey.slice('literal:'.length) : t(labelKey);
}

function renderNav(active) {
  return el('nav', { class: 'tabbar' }, [
    ...NAV.map(([route, labelKey]) =>
      el('button', {
        class: 'tab' + (route === active ? ' active' : ''),
        onclick: () => navigate(route)
      }, navLabel(labelKey))
    ),
    // 🌐 бутон за повторен избор на UI език (НЕ е рута — отваря екрана директно).
    el('button', { class: 'tab', onclick: openLangPicker }, t('lang_btn'))
  ]);
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
  startLearning(render);
  startListening();

  const route = currentRoute();
  (APP_ROUTES[route] || renderChat)(screen, ctx);
  app.appendChild(screen);
  app.appendChild(renderNav(route));
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
    else if (isNamed() && isUnlocked() && !isLockedDown()) { startLearning(render); startListening(); }
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
