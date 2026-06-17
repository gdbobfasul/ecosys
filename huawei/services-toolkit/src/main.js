import './core/styles.css';
import { tools, findTool } from './core/registry.js';
import { iconHTML } from './core/icons.js';
import { esc } from './core/ui.js';

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

// --- Начален екран ---
function renderHome() {
  app.innerHTML = `
    <div class="view">
      <div class="hero">
        <h1>Services Toolkit</h1>
        <p>Полезни офлайн инструменти — всичко работи на устройството.</p>
      </div>
      <input class="search" id="search" type="search" placeholder="Търси инструмент…" autocomplete="off" />
      <div class="grid" id="grid"></div>
      <div class="empty" id="empty" style="display:none">Няма съвпадения.</div>
    </div>
  `;
  const grid = app.querySelector('#grid');
  const empty = app.querySelector('#empty');
  const search = app.querySelector('#search');

  function draw(filter) {
    const q = (filter || '').trim().toLowerCase();
    const list = tools.filter((t) =>
      !q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
    );
    empty.style.display = list.length ? 'none' : 'block';
    grid.innerHTML = list.map((t) => `
      <div class="card${t.online ? ' online' : ''}" data-id="${t.id}">
        <div class="ic">${iconHTML(t.icon)}</div>
        <h3>${esc(t.name)}</h3>
        <p>${esc(t.desc)}</p>
        ${t.online ? '<span class="tag">онлайн</span>' : ''}
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
      <button class="back" id="back" aria-label="Назад">&#8592;</button>
      <div class="ttlwrap">
        <div class="ttl">${esc(tool.name)}</div>
        <div class="sub">${esc(tool.desc)}</div>
      </div>
    </div>
    <div class="view" id="toolbody">
      <div class="hint">Зареждам…</div>
    </div>
  `;
  app.querySelector('#back').addEventListener('click', () => navigate('#/'));

  const body = app.querySelector('#toolbody');
  try {
    const mod = await tool.load();
    body.innerHTML = '';
    mod.render(body);
  } catch (e) {
    body.innerHTML = `<div class="notice">Грешка при зареждане на инструмента: ${esc(e.message)}</div>`;
  }
}

function route() {
  const r = parseRoute();
  window.scrollTo(0, 0);
  if (r.name === 'tool') renderTool(r.id);
  else renderHome();
}

window.addEventListener('hashchange', route);
route();
