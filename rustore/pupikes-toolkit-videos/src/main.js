import { mountLangGate as __mountLangGate } from './core/lang-gate.js';
import { LANGUAGES as __LG_L, getLang as __LG_G, setLang as __LG_S } from './core/i18n.js';
__mountLangGate({ languages: __LG_L, current: __LG_G(), setLang: __LG_S });
enforceLicense('pupikes-toolkit-videos', 'rustore'); // лог на инсталация СЛЕД езика (rustore билд)
// Version: 1.0021
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
import { enforceLicense } from './core/license.js';
enforceLock();
mountEcosystem('pupikes-toolkit-videos'); // „Още от Pupikes" showcase
playIntro(); // кратко „Pupikes" интро при старт
startPromoAds('pupikes-toolkit-videos'); // реклами: старт (след интрото) + среда + край (PUPIKES_END_AD)
mountHelp('pupikes-toolkit-videos'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('pupikes-toolkit-videos'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('pupikes-toolkit-videos'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
import './core/styles.css';
import { tools, findTool } from './core/registry.js';
import { iconHTML } from './core/icons.js';
import { esc } from './core/ui.js';
import { t, getLang, setLang, hasLangChosen, applyDir, LANGUAGES } from './core/i18n.js';
import { APP_VERSION } from './version.js';

const app = document.getElementById('app');

// --- Просто хеш-базирано рутиране (#/  и  #/tool/<id>) ---
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const m = h.match(/^tool\/(.+)$/);
  return m ? { name: 'tool', id: m[1] } : { name: 'home' };
}

function navigate(hash) {
  location.hash = hash;
}

// --- Екран за избор на език (при първо стартиране и от бутона 🌐) ---
function renderLanguage() {
  const cur = getLang();
  app.innerHTML = `
    <div class="view">
      <div class="hero"><div style="font-size:2.4em">🌐</div><h1>${esc(t('pick_lang'))}</h1></div>
      <div class="lang-grid" id="langgrid"></div>
      <button class="btn" id="startbtn" style="margin-top:16px">${esc(t('start_app'))}</button>
      <div class="center" style="opacity:0.55; font-size:12px; margin-top:6px">v${esc(APP_VERSION)}</div>
    </div>
  `;
  // Избор/продължаване с даден език: записва езика и влиза в приложението.
  const choose = (code) => { setLang(code); renderHome(); };
  const grid = app.querySelector('#langgrid');
  grid.innerHTML = LANGUAGES.map((l) =>
    `<button class="lang-btn${l.code === cur ? ' cur' : ''}" data-code="${l.code}">${esc(l.native)}</button>`
  ).join('');
  grid.querySelectorAll('.lang-btn').forEach((b) => {
    b.addEventListener('click', () => choose(b.dataset.code));
  });
  // Бутон „Стартирай" — влиза с ТЕКУЩО избрания (или подразбиращ се) език.
  app.querySelector('#startbtn').addEventListener('click', () => choose(cur));
}

// --- Начален екран = първият таб („Видео инструкция") ---
// v1.0021 (Huawei 4.3): вместо решетка с карти — горна лента със заглавието на текущия таб и табове
// „Видео инструкция" (главната функция, първи екран след старта) | „Видео инструменти".
function renderHome() { renderTool(tools[0].id); }

// --- Екран с табове ---
let currentMod = null;
async function renderTool(id) {
  const tool = findTool(id);
  if (!tool) { navigate('#/'); return; }
  if (currentMod && typeof currentMod.unmount === 'function') { try { currentMod.unmount(); } catch (e) {} }
  currentMod = null;

  app.innerHTML = `
    <div class="topbar">
      <div class="ttlwrap" style="flex:1">
        <div class="ttl">${esc(t(tool.name))}</div>
        <div class="sub">${esc(t(tool.desc))}</div>
      </div>
      <button class="lang-toggle" id="langbtn" style="position:static;flex-shrink:0" title="${esc(t('lang_btn'))}">${esc(t('lang_btn'))}</button>
    </div>
    <div class="view">
      <div class="tabs" id="tooltabs">${tools.map((x) => `
        <button class="tab${x.id === tool.id ? ' active' : ''}" data-id="${x.id}"><span style="display:inline-block;width:18px;height:18px;vertical-align:-4px">${iconHTML(x.icon)}</span> ${esc(t(x.name))}</button>`).join('')}
      </div>
      <div id="toolbody"><div class="hint">${esc(t('loading'))}</div></div>
    </div>
  `;
  app.querySelector('#langbtn').addEventListener('click', renderLanguage);
  app.querySelectorAll('#tooltabs .tab').forEach((b) => {
    b.addEventListener('click', () => navigate(b.dataset.id === tools[0].id ? '#/' : '#/tool/' + b.dataset.id));
  });

  const body = app.querySelector('#toolbody');
  try {
    const mod = await tool.load();
    body.innerHTML = '';
    currentMod = mod;
    await mod.render(body);
  } catch (e) {
    body.innerHTML = `<div class="notice">${esc(t('load_error'))} ${esc(e.message)}</div>`;
  }
}

function route() {
  const r = parseRoute();
  window.scrollTo(0, 0);
  // При първо стартиране първо избор на език (само на началния маршрут).
  if (!hasLangChosen()) { renderLanguage(); return; }   // ПЪРВО избор на език (като всички апове) — и при апове с един инструмент
  if (r.name === 'tool') renderTool(r.id);
  else renderHome();
}

applyDir();
window.addEventListener('hashchange', route);
route();
