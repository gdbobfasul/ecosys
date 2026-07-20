// Version: 1.0173
// ──────────────────────────────────────────────────────────────────────────
// ГЕНЕРАТОР НА ДЪРВО НА ЕКОСИСТЕМАТА  →  /tree
//
// Сканира папка public/ и създава:
//   public/tree/index.html  — кликаемо дърво на ВСИЧКИ страници (за човек),
//                             с админ маркери и примерни URL параметри.
//   public/tree/tree.json   — машинно четим списък (използва се от робота).
//
// „Автоматично": пуска се с `node private/robot/tree-gen.js` (или от деплоя
// след качване на сорса — виж 14-sync-source.sh), затова дървото е винаги
// актуално спрямо реалните файлове.
//
// Карта на маршрутите (както ги сервира nginx на главния домейн):
//   public/<път>            → /<път>            (статично, location /)
//   <папка>/index.html      → /<папка>/         (директория)
//   House-Look-Book/<x>     → /houselookbook/<x> (приложение kcy-hlb :3010)
//   WhereNoBiz/<x>          → /wherenobiz/<x>    (приложение kcy-wnb :3011)
// ──────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');

// Коренът на статиката: на сървъра подай PUBLIC_DIR=/var/www/html; локално — repo/public.
const ROOT = process.env.PUBLIC_DIR
  ? path.resolve(process.env.PUBLIC_DIR)
  : path.join(__dirname, '..', '..', 'public');
const OUT_DIR = path.join(ROOT, 'tree');

// Подредба + етикети на приложенията (по първата папка). '' = коренът на сайта.
const APP_ORDER = ['', 'portals', 'chat', 'eco-3', 'find-best-price', 'House-Look-Book', 'WhereNoBiz',
                   'crypto', 'shared', 'tree'];
const APP_LABELS = {
  '':                'Основен сайт',
  portals:           'Портали (игри + услуги)',
  chat:              'Чат',
  'eco-3':           'ECO-3 — AI студио',
  'find-best-price': 'Find Best Price',
  'House-Look-Book': 'House-Look-Book',
  'WhereNoBiz':      'WhereNoBiz',
  crypto:            'Crypto (token/brch1/multisig — само админ)',
  shared:            'Споделени / Диагностика',
  tree:              'Дърво (тази страница)',
};
// Папка → URL префикс (приложенията се сервират под друг път).
const FOLDER_URL_REMAP = { 'House-Look-Book': 'houselookbook', 'WhereNoBiz': 'wherenobiz' };

// Курирани ДОПЪЛНИТЕЛНИ адреси, които НЕ са статични .html файлове
// (динамични/прокси маршрути) — за пълнота на дървото и за робота.
const EXTRAS = [
  { app: 'shared', url: '/last-errors-bundle',    title: 'Логове (грешки + дебъг) — слети', type: 'admin', note: 'kcy-diag :4400' },
  { app: 'shared', url: '/last-errors-bundle-vm', title: 'Логове от VM',                     type: 'admin', note: 'само ако VM е вдигнат' },
  // health endpoint-и (за робота; връщат JSON, не HTML)
  { app: 'chat',    url: '/api/health',       title: 'health (chat)',    type: 'api' },
  { app: 'eco-3',   url: '/api/eco3/health',  title: 'health (eco-3)',   type: 'api' },
  { app: 'portals', url: '/api/portals/health', title: 'health (portals)', type: 'api' },
  { app: 'House-Look-Book', url: '/api/hlb/health', title: 'health (HLB)', type: 'api' },
  { app: 'WhereNoBiz',      url: '/api/wnb/health', title: 'health (WNB)', type: 'api' },
  { app: 'find-best-price', url: '/api/fbp/health', title: 'health (FBP)', type: 'api' },
];

// Курирани примерни URL параметри по страница (особено за админ/параметрични).
const PARAM_NOTES = {
  '/houselookbook/':             [{ q: '?edit=<ID>', note: 'редакция на къща (собственик/админ)' }],
  '/houselookbook/profile.html': [{ q: '?edit=<ID>', note: 'редакция на публикуваното' }],
  '/houselookbook/admin.html':   [{ q: '?tab=pending', note: 'таб: pending|reports|all|banned|generate' }],
  '/wherenobiz/post.html':       [{ q: '?id=<ID>',   note: 'преглед на конкретна публикация' }],
  '/wherenobiz/admin.html':      [{ q: '?tab=pending', note: 'таб: pending|reports|all|banned' }],
  '/wherenobiz/browse.html':     [{ q: '?country=<КОД>', note: 'филтър по държава (напр. BG)' }],
  '/portals/login.html':         [{ q: '?next=<URL>', note: 'пренасочване след вход' }],
};

// Кои адреси да се третират като АДМИН (заключени/чувствителни).
const isAdmin = (url) =>
  /\/admin(\/|\.html|$)/.test(url) || /admin-status/.test(url) || /\/scripts\.html$/.test(url) || /\/robot\.html$/.test(url);

// ── помощни ────────────────────────────────────────────────────────────────
function walkHtml(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'assets' || name === 'tree' || name === 'node_modules') continue;
      walkHtml(full, acc);
    } else if (name.endsWith('.html')) {
      acc.push(full);
    }
  }
  return acc;
}

function fileToUrl(rel) {
  let parts = rel.split(path.sep);
  if (FOLDER_URL_REMAP[parts[0]]) parts[0] = FOLDER_URL_REMAP[parts[0]];
  let url = '/' + parts.join('/');
  if (url.endsWith('/index.html')) url = url.slice(0, -'index.html'.length); // .../ди
  if (url === '/index.html') url = '/';
  return url;
}

function titleOf(file, url) {
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { /* ignore */ }
  const m = txt.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m && m[1].trim()) return m[1].trim().replace(/\s+/g, ' ').slice(0, 90);
  const h = txt.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h && h[1].trim()) return h[1].trim().replace(/\s+/g, ' ').slice(0, 90);
  return path.basename(url) || url;
}

// Авто-извличане на параметри от текста на страницата (URLSearchParams/?x=).
function autoParams(file) {
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const names = new Set();
  let m;
  const reGet = /searchParams\.get\(\s*['"]([\w-]+)['"]/g;
  while ((m = reGet.exec(txt))) names.add(m[1]);
  const reGet2 = /getParam\(\s*['"]([\w-]+)['"]/g;
  while ((m = reGet2.exec(txt))) names.add(m[1]);
  return [...names].map((n) => ({ q: `?${n}=<стойност>`, note: 'параметър (авто-открит)' }));
}

function appOf(rel) {
  const top = rel.split(path.sep)[0];
  return top.endsWith('.html') ? '' : top; // файл директно в public/ → коренът
}

// ── събиране ─────────────────────────────────────────────────────────────
const files = walkHtml(ROOT);
const byApp = new Map();
const pushPage = (app, page) => {
  if (!byApp.has(app)) byApp.set(app, []);
  byApp.get(app).push(page);
};

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const url = fileToUrl(rel);
  const app = appOf(rel);
  const curated = PARAM_NOTES[url] || [];
  const auto = autoParams(file).filter((a) => !curated.some((c) => c.q.split('=')[0] === a.q.split('=')[0]));
  pushPage(app, {
    url,
    title: titleOf(file, url),
    type: isAdmin(url) ? 'admin' : 'page',
    params: [...curated, ...auto],
  });
}
for (const ex of EXTRAS) pushPage(ex.app, { url: ex.url, title: ex.title, type: ex.type, note: ex.note || '', params: [] });

// сортирай страниците във всяка група (коренът „/" първи, после азбучно)
for (const arr of byApp.values()) {
  arr.sort((a, b) => (a.url === '/' ? -1 : b.url === '/' ? 1 : a.url.localeCompare(b.url)));
}

// подреди групите по APP_ORDER, после непознатите
const orderedApps = [...byApp.keys()].sort((a, b) => {
  const ia = APP_ORDER.indexOf(a), ib = APP_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
});

const generatedAt = new Date().toISOString();
const groups = orderedApps.map((app) => ({
  app,
  label: APP_LABELS[app] || app || 'Основен сайт',
  pages: byApp.get(app),
}));
const totalPages = groups.reduce((s, g) => s + g.pages.length, 0);

// ── tree.json (за робота) ───────────────────────────────────────────────
const json = {
  generatedAt,
  totalPages,
  health: EXTRAS.filter((e) => e.type === 'api').map((e) => ({ app: e.app, url: e.url })),
  groups,
};

// ── index.html (за човек) ─────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const badge = (t) =>
  t === 'admin' ? '<span class="b adm">🔒 админ</span>'
  : t === 'api' ? '<span class="b api">API</span>'
  : '';

const pageRow = (p) => {
  const params = (p.params || []).map((pp) =>
    `<a class="param" href="${esc(p.url + pp.q.replace(/<[^>]+>/g, '1'))}" target="_blank" title="${esc(pp.note)}">${esc(pp.q)}</a>`
  ).join(' ');
  const note = p.note ? `<span class="note">${esc(p.note)}</span>` : '';
  return `<li class="row ${p.type}">
    <a class="link" href="${esc(p.url)}" target="_blank">${esc(p.title)}</a>
    <code class="url">${esc(p.url)}</code> ${badge(p.type)} ${note}
    ${params ? `<div class="params">${params}</div>` : ''}
  </li>`;
};

const sections = groups.map((g) => `
  <section class="grp" data-app="${esc(g.app)}">
    <h2>${esc(g.label)} <span class="cnt">${g.pages.length}</span></h2>
    <ul>${g.pages.map(pageRow).join('')}</ul>
  </section>`).join('');

const html = `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Дърво на екосистемата — Pupikes</title>
<style>
  :root{--bg:#0d1117;--card:#161b22;--bd:#30363d;--fg:#c9d1d9;--mut:#8b949e;--ac:#58a6ff;--adm:#f0883e;--api:#3fb950;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:24px}
  header{max-width:1000px;margin:0 auto 18px}
  h1{font-size:1.5em;margin:0 0 6px}
  .meta{color:var(--mut);font-size:.85em}
  .tools{max-width:1000px;margin:0 auto 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  input[type=search]{flex:1;min-width:220px;background:var(--card);border:1px solid var(--bd);color:var(--fg);padding:9px 12px;border-radius:8px}
  .filterbtn{background:var(--card);border:1px solid var(--bd);color:var(--fg);padding:7px 12px;border-radius:8px;cursor:pointer}
  .filterbtn.on{border-color:var(--ac);color:var(--ac)}
  main{max-width:1000px;margin:0 auto}
  .grp{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px 18px;margin-bottom:16px}
  .grp h2{font-size:1.05em;color:var(--ac);margin:0 0 10px;border-bottom:1px solid var(--bd);padding-bottom:8px}
  .cnt{color:var(--mut);font-size:.8em;font-weight:400}
  ul{list-style:none;margin:0;padding:0}
  .row{padding:7px 0;border-bottom:1px dashed #21262d}
  .row:last-child{border-bottom:0}
  .link{color:var(--fg);text-decoration:none;font-weight:600}
  .link:hover{color:var(--ac);text-decoration:underline}
  .url{color:var(--mut);font-size:.8em;margin-left:8px}
  .b{font-size:.72em;padding:1px 7px;border-radius:10px;margin-left:6px;vertical-align:middle}
  .b.adm{background:#3d1d10;color:var(--adm);border:1px solid #5a2e16}
  .b.api{background:#102a17;color:var(--api);border:1px solid #1c4429}
  .note{color:var(--mut);font-size:.8em;margin-left:8px;font-style:italic}
  .params{margin:5px 0 2px 14px}
  .param{display:inline-block;background:#0d2438;border:1px solid #1d4a6e;color:#9ecbff;font-size:.78em;
         padding:1px 8px;border-radius:6px;margin:2px 4px 0 0;text-decoration:none;font-family:monospace}
  .param:hover{border-color:var(--ac)}
  .hide{display:none}
  footer{max-width:1000px;margin:18px auto;color:var(--mut);font-size:.8em}
  a.home{color:var(--ac)}
</style>
</head>
<body>
<header>
  <h1>🌳 Дърво на екосистемата</h1>
  <div class="meta">${totalPages} страници · генерирано: <span id="gen">${esc(generatedAt)}</span> · <a class="home" href="/">🏠 към сайта</a> · <a class="home" href="/tree/tree.json" target="_blank">tree.json</a></div>
</header>
<div class="tools">
  <input id="q" type="search" placeholder="🔎 търси страница или URL…" autocomplete="off">
  <button class="filterbtn on" data-f="all">Всички</button>
  <button class="filterbtn" data-f="admin">🔒 само админ</button>
  <button class="filterbtn" data-f="page">само публични</button>
</div>
<main>${sections}</main>
<footer>Генерира се автоматично от <code>private/robot/tree-gen.js</code> — отразява реалните файлове в <code>public/</code>.</footer>
<script>
  const rows = [...document.querySelectorAll('.row')];
  const q = document.getElementById('q');
  let mode = 'all';
  function apply(){
    const t = q.value.trim().toLowerCase();
    rows.forEach(r=>{
      const txt = r.textContent.toLowerCase();
      const okText = !t || txt.includes(t);
      const okMode = mode==='all' || r.classList.contains(mode);
      r.classList.toggle('hide', !(okText && okMode));
    });
    document.querySelectorAll('.grp').forEach(g=>{
      const any = [...g.querySelectorAll('.row')].some(r=>!r.classList.contains('hide'));
      g.classList.toggle('hide', !any);
    });
  }
  q.addEventListener('input', apply);
  document.querySelectorAll('.filterbtn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.filterbtn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); mode=b.dataset.f; apply();
  }));
  // покажи локалното време четимо
  try{ document.getElementById('gen').textContent = new Date('${esc(generatedAt)}').toLocaleString('bg-BG'); }catch(e){}
</script>
<!-- системно меню: Начало + връзки между Статус/Робот/Дърво + админ дропдаун + ЛОГНАТ АДМИН -->
<script src="/shared/js/system-nav.js?v=1.0175"></script>
</body>
</html>`;

// ── запис ────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'tree.json'), JSON.stringify(json, null, 2), 'utf8');

console.log(`✓ Дърво генерирано: ${totalPages} страници, ${groups.length} групи`);
console.log(`  → ${path.join(OUT_DIR, 'index.html')}`);
console.log(`  → ${path.join(OUT_DIR, 'tree.json')}`);
