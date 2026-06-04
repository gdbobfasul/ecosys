// Version: 1.0171
// WhereNoBiz — read-only изглед на базата (само админ/модератор).
// Табове по таблица + търсене (по всички колони) + странициране (100/стр).
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => (window.WNB ? WNB.esc(s) : String(s == null ? '' : s));
  const PER_PAGE = 100;

  let tables = [];   // [{ name, total, columns, rows }]
  let active = 0;    // индекс на активната таблица
  let page = 0;      // текуща страница (0-базиран)
  let query = '';    // търсене

  function fmt(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  // Редовете на активната таблица, филтрирани по търсенето.
  function filteredRows() {
    const t = tables[active];
    if (!t) return [];
    if (!query) return t.rows;
    const q = query.toLowerCase();
    return t.rows.filter(r => t.columns.some(c => fmt(r[c]).toLowerCase().includes(q)));
  }

  function renderTabs() {
    $('#dbTabs').innerHTML = tables.map((t, i) =>
      `<button class="dtab${i === active ? ' on' : ''}" data-i="${i}">${esc(t.name)} <span class="n">${t.total}</span></button>`
    ).join('');
    $('#dbTabs').querySelectorAll('.dtab').forEach(b => b.onclick = () => {
      active = +b.dataset.i; page = 0; query = ''; $('#dbSearch').value = '';
      renderTabs(); renderTable();
    });
  }

  function renderTable() {
    const t = tables[active];
    const tableBox = $('#dbTable'), pager = $('#dbPager'), info = $('#dbInfo');
    if (!t) { tableBox.innerHTML = '<div class="empty-note">Няма таблици.</div>'; pager.innerHTML = ''; info.textContent = ''; return; }

    const rows = filteredRows();
    const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    if (page >= pages) page = pages - 1;
    const start = page * PER_PAGE;
    const slice = rows.slice(start, start + PER_PAGE);

    const capNote = t.rows.length < t.total ? ` (показани първите ${t.rows.length} от ${t.total})` : '';
    info.textContent = query
      ? `${rows.length} съвпадения от ${t.rows.length}${capNote}`
      : `${t.total} реда${capNote}`;

    if (!slice.length) {
      tableBox.innerHTML = `<div class="empty-note">${query ? 'Няма съвпадения.' : '— празна —'}</div>`;
      pager.innerHTML = '';
      return;
    }

    let h = '<div class="tbl-wrap"><table class="dbtbl"><thead><tr>' +
      t.columns.map(c => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
    slice.forEach(r => {
      h += '<tr>' + t.columns.map(c => `<td title="${esc(fmt(r[c]))}">${esc(fmt(r[c]))}</td>`).join('') + '</tr>';
    });
    h += '</tbody></table></div>';
    tableBox.innerHTML = h;

    pager.innerHTML = pages > 1
      ? `<button id="pPrev"${page === 0 ? ' disabled' : ''}>← Назад</button>` +
        `<span class="pinfo">Стр. ${page + 1} / ${pages} · редове ${start + 1}–${start + slice.length}</span>` +
        `<button id="pNext"${page >= pages - 1 ? ' disabled' : ''}>Напред →</button>`
      : '';
    if (pages > 1) {
      $('#pPrev').onclick = () => { if (page > 0) { page--; renderTable(); } };
      $('#pNext').onclick = () => { if (page < pages - 1) { page++; renderTable(); } };
    }
  }

  async function load() {
    $('#dbTable').innerHTML = '<div class="empty-note">Зареждам…</div>';
    try {
      const r = await WNB.api('/moderation/db');
      tables = r.tables || [];
      active = Math.min(active, Math.max(0, tables.length - 1));
      page = 0;
      renderTabs();
      renderTable();
    } catch (e) {
      $('#dbTable').innerHTML = `<div class="empty-note">Грешка: ${esc(e.message)}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await WNB.mountNav('admin');
    if (!user) { location.href = 'login.html'; return; }
    if (user.role !== 'moderator' && user.role !== 'admin') { $('#noAccess').style.display = ''; return; }
    $('#dbMain').style.display = '';
    $('#reload').onclick = load;
    $('#dbSearch').oninput = (e) => { query = e.target.value.trim(); page = 0; renderTable(); };
    load();
  });
})();
