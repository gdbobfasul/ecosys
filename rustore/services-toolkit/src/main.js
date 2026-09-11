import { mountLangGate as __mountLangGate } from './core/lang-gate.js';
import { LANGUAGES as __LG_L, getLang as __LG_G, setLang as __LG_S } from './core/i18n.js';
__mountLangGate({ languages: __LG_L, current: __LG_G(), setLang: __LG_S });
enforceLicense('services-toolkit', 'rustore'); // лог на инсталация СЛЕД езика (rustore билд)
// Version: 1.0021
// 11.09.2026 (обединение): Pupikes Toolkit СЪБИРА всички инструменти от семейството Toolkit — решетката е
// групирана по РАЗДЕЛИ (registry.js: group → i18n grp_*), най-отгоре е отличената карта „Вериги от инструменти";
// при отворен инструмент, ако има активна верига (sessionStorage), над него стои лента „стъпка i от N" с подсказка
// и бутон „Следваща стъпка" (tools/chains.js).
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
import { enforceLicense } from './core/license.js';
enforceLock();
mountEcosystem('services-toolkit'); // „Още от Pupikes" showcase
playIntro(); // кратко „Pupikes" интро при старт
startPromoAds('services-toolkit'); // реклами: старт (след интрото) + среда + край (PUPIKES_END_AD)
mountHelp('services-toolkit'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('services-toolkit'); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('services-toolkit'); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
import './core/styles.css';
import { tools, findTool, GROUPS } from './core/registry.js';
import { iconHTML } from './core/icons.js';
import { esc } from './core/ui.js';
import { t, tf, getLang, setLang, hasLangChosen, applyDir, LANGUAGES } from './core/i18n.js';
import { APP_VERSION } from './version.js';

const app = document.getElementById('app');
const CHAIN_KEY = 'st.chain.active.v1'; // същият ключ като в tools/chains.js (без импорт, за да не се зарежда модулът при старт)

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

// Карта на инструмент в решетката
function cardHTML(tool) {
  return `
      <div class="card${tool.online ? ' online' : ''}${tool.main ? ' main' : ''}" data-id="${tool.id}"${tool.main ? ' style="grid-column:1/-1;border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset"' : ''}>
        <div class="ic">${iconHTML(tool.icon)}</div>
        <h3>${esc(t(tool.name))}</h3>
        <p>${esc(t(tool.desc))}</p>
        ${tool.online ? `<span class="tag">${esc(t('online_tag'))}</span>` : ''}
      </div>`;
}

// --- Начален екран ---
function renderHome() {
  app.innerHTML = `
    <div class="view">
      <div class="hero">
        <button class="lang-toggle" id="langbtn" title="${esc(t('lang_btn'))}">${esc(t('lang_btn'))}</button>
        <h1>Pupikes Toolkit</h1>
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
      !q || t(tool.name).toLowerCase().includes(q) || t(tool.desc).toLowerCase().includes(q) || (tool.group && t('grp_' + tool.group).toLowerCase().includes(q))
    );
    empty.style.display = list.length ? 'none' : 'block';
    if (q) {
      // При търсене — плосък списък без заглавия на раздели
      grid.innerHTML = list.map(cardHTML).join('');
    } else {
      // Решетка по раздели: отличената карта (веригите) най-отгоре, после всеки раздел със заглавие и брой
      let html = list.filter((x) => x.main).map(cardHTML).join('');
      for (const g of GROUPS) {
        const items = list.filter((x) => x.group === g);
        if (!items.length) continue;
        html += `<div class="grp-ttl" data-grp="${g}" style="grid-column:1/-1;margin:10px 0 -4px;font-size:.85em;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em;display:flex;justify-content:space-between"><span>${esc(t('grp_' + g))}</span><span style="text-transform:none">${esc(items.length === 1 ? t('grp_count1') : tf('grp_count', items.length))}</span></div>`;
        html += items.map(cardHTML).join('');
      }
      grid.innerHTML = html;
    }
    grid.querySelectorAll('.card').forEach((c) => {
      c.addEventListener('click', () => navigate('#/tool/' + c.dataset.id));
    });
  }

  search.addEventListener('input', () => draw(search.value));
  draw('');
}

// --- Лента на активната верига над инструмента (виж tools/chains.js) ---
function chainState() { try { return JSON.parse(sessionStorage.getItem(CHAIN_KEY) || 'null'); } catch (e) { return null; } }
function chainBarHTML(id) {
  const st = chainState();
  if (!st || !st.steps || !st.steps[st.idx] || st.steps[st.idx].tool !== id) return '';
  const step = st.steps[st.idx]; const last = st.idx >= st.steps.length - 1;
  return `<div class="notice" id="chainbar" style="margin-bottom:12px">
      <b>${esc(tf('chain_bar', st.name, st.idx + 1, st.steps.length))}</b>
      <div style="margin:4px 0 8px">${esc(step.hint ? t(step.hint) : '')}</div>
      <div style="display:flex;gap:8px"><button class="btn inline" id="chainNext">${esc(t(last ? 'chain_finish' : 'chain_next'))}</button><button class="btn inline sec" id="chainStop">${esc(t('chain_stop'))}</button></div>
    </div>`;
}
function wireChainBar() {
  const nxt = app.querySelector('#chainNext'); const stop = app.querySelector('#chainStop');
  if (stop) stop.addEventListener('click', () => { try { sessionStorage.removeItem(CHAIN_KEY); } catch (e) {} const b = app.querySelector('#chainbar'); if (b) b.remove(); });
  if (nxt) nxt.addEventListener('click', () => {
    const st = chainState(); if (!st) return;
    if (st.idx >= st.steps.length - 1) {
      try { sessionStorage.removeItem(CHAIN_KEY); } catch (e) {}
      const b = app.querySelector('#chainbar'); if (b) b.innerHTML = `<b>${esc(t('chain_done_msg'))}</b>`;
      return;
    }
    st.idx += 1; try { sessionStorage.setItem(CHAIN_KEY, JSON.stringify(st)); } catch (e) {}
    navigate('#/tool/' + st.steps[st.idx].tool);
  });
}

// --- Екран на инструмент ---
// 11.09.2026: инструментите с unmount() (напр. „Видео инструкция" — преглед/запис на глас) се спират при излизане.
let currentMod = null;
function stopCurrentTool() { if (currentMod && typeof currentMod.unmount === 'function') { try { currentMod.unmount(); } catch (e) {} } currentMod = null; }
async function renderTool(id) {
  stopCurrentTool();
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
    <div class="view">
      ${chainBarHTML(id)}
      <div id="toolbody"><div class="hint">${esc(t('loading'))}</div></div>
    </div>
  `;
  app.querySelector('#back').addEventListener('click', () => navigate('#/'));
  wireChainBar();

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
  else { stopCurrentTool(); renderHome(); }
}

applyDir();
window.addEventListener('hashchange', route);
route();
