// Version: 1.0016
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('kcy-toolkit-videos'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
startPromoAds('kcy-toolkit-videos'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('kcy-toolkit-videos'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('kcy-toolkit-videos'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('kcy-toolkit-videos'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
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

// --- Начален екран ---
function renderHome() {
  app.innerHTML = `
    <div class="view">
      <div class="hero">
        <button class="lang-toggle" id="langbtn" title="${esc(t('lang_btn'))}">${esc(t('lang_btn'))}</button>
        <h1>KCY Toolkit Videos</h1>
        <p>${esc(t('home_sub'))}</p>
      </div>
      <input class="search" id="search" type="search" placeholder="${esc(t('search_ph'))}" autocomplete="off" />
      <div class="grid" id="grid"></div>
      <div class="empty" id="empty" style="display:none">${esc(t('no_matches'))}</div>
    </div>
  `;
  const grid = app.querySelector('#grid');
  const empty = app.querySelector('#empty');
  const search = app.querySelector('#search');
  const langbtn = app.querySelector('#langbtn');
  if (langbtn) langbtn.addEventListener('click', renderLanguage);

  function draw(filter) {
    const q = (filter || '').trim().toLowerCase();
    const list = tools.filter((tool) =>
      !q || t(tool.name).toLowerCase().includes(q) || t(tool.desc).toLowerCase().includes(q)
    );
    empty.style.display = list.length ? 'none' : 'block';
    grid.innerHTML = list.map((tool) => `
      <div class="card${tool.online ? ' online' : ''}" data-id="${tool.id}">
        <div class="ic">${iconHTML(tool.icon)}</div>
        <h3>${esc(t(tool.name))}</h3>
        <p>${esc(t(tool.desc))}</p>
        ${tool.online ? `<span class="tag">${esc(t('online_tag'))}</span>` : ''}
      </div>
    `).join('');
    grid.querySelectorAll('.card').forEach((c) => {
      c.addEventListener('click', () => navigate('#/tool/' + c.dataset.id));
    });
  }

  search.addEventListener('input', () => draw(search.value));
  draw('');
}

// --- Екран на инструмент ---
async function renderTool(id) {
  const tool = findTool(id);
  if (!tool) { navigate('#/'); return; }

  app.innerHTML = `
    <div class="topbar">
      <button class="back" id="back" aria-label="${esc(t('back'))}">&#8592;</button>
      <div class="ttlwrap">
        <div class="ttl">${esc(t(tool.name))}</div>
        <div class="sub">${esc(t(tool.desc))}</div>
      </div>
    </div>
    <div class="view" id="toolbody">
      <div class="hint">${esc(t('loading'))}</div>
    </div>
  `;
  app.querySelector('#back').addEventListener('click', () => navigate('#/'));

  const body = app.querySelector('#toolbody');
  try {
    const mod = await tool.load();
    body.innerHTML = '';
    mod.render(body);
  } catch (e) {
    body.innerHTML = `<div class="notice">${esc(t('load_error'))} ${esc(e.message)}</div>`;
  }
}

function route() {
  const r = parseRoute();
  window.scrollTo(0, 0);
  // При първо стартиране първо избор на език (само на началния маршрут).
  if (r.name !== 'tool' && !hasLangChosen()) { renderLanguage(); return; }
  if (r.name === 'tool') renderTool(r.id);
  else renderHome();
}

applyDir();
window.addEventListener('hashchange', route);
route();
