// "Подреди своя дом" — UI логика на уеб прототипа (фаза 1: конструктор + PDF).
// Самостоятелно, чисто приложение (правило от brief-а).

(function () {
  'use strict';

  let CONFIG = null;
  let editingId = null;     // ако сме отворили ?edit=ID → редакция вместо ново
  let editingTitle = '';
  const state = {
    footprint: 'square',
    roof: 'gabled',
    floors: 2,
    wallColor: '#e8d9c0',
    roofColor: '#8a4b3b',
    accentColor: '#3b6ea5',
    windowsPerFloor: 2,
    extras: { pool: false, boat: false, pier: false },
    rooms: [],   // rooms[етаж] = [{ type, shape }] — разпределение по етажи и стаи
    customShape: null,  // форма по снимка (силует) → footprint='custom'
  };

  const $ = sel => document.querySelector(sel);
  const T = (k, v) => (window.HLB_I18N ? HLB_I18N.t(k, v) : k);
  const esc = s => (window.HLB ? HLB.esc(s) : String(s == null ? '' : s));

  // Параметрите, които подаваме на рендера (+ лимитите от config).
  function renderParams() {
    return Object.assign({}, state, { limits: CONFIG.limits });
  }

  // ── рисуване ────────────────────────────────────────────────────
  function drawPreview() {
    $('#preview').innerHTML = HouseRender.elevation(renderParams(), 'front');
    drawAllSides();
    drawFloorPlans();
  }

  // Планове по етажи (схема отгоре със стаите).
  function drawFloorPlans() {
    const wrap = $('#floorPlans');
    if (!wrap) return;
    ensureRooms();
    wrap.innerHTML = '';
    for (let f = 0; f < state.floors; f++) {
      const cell = document.createElement('div');
      cell.className = 'thumb';
      cell.innerHTML = HouseRender.floorPlan(renderParams(), f);
      wrap.appendChild(cell);
    }
  }

  // ── стаи по етажи ────────────────────────────────────────────────
  // Поддържа state.rooms да има точно по един масив на етаж.
  function ensureRooms() {
    if (!Array.isArray(state.rooms)) state.rooms = [];
    const n = Math.max(1, state.floors || 1);
    state.rooms = state.rooms.map(fl => Array.isArray(fl) ? fl.filter(r => r && r.type).map(normalizeRoom) : []);
    while (state.rooms.length < n) state.rooms.push([]);
    if (state.rooms.length > n) state.rooms.length = n;
  }
  // Нормализира стая: стени според формата + мебели с място/стена.
  function normalizeRoom(r) {
    const shape = r.shape || 'rect';
    const nw = HouseRender.wallsForShape(shape);
    let walls = Array.isArray(r.walls) ? r.walls.slice(0, nw) : [];
    while (walls.length < nw) walls.push({ doors: 0, windows: 0 });
    walls = walls.map(w => ({ doors: Math.max(0, +(w && w.doors) || 0), windows: Math.max(0, +(w && w.windows) || 0) }));
    const items = (Array.isArray(r.items) ? r.items : []).filter(it => it && it.type).map(it => {
      const place = it.place === 'wall' ? 'wall' : 'center';
      const wall = place === 'wall' ? Math.min(nw - 1, Math.max(0, +it.wall || 0)) : 0;
      return { type: it.type, place, wall };
    });
    return { type: r.type, shape, walls, items };
  }
  function roomOptions(sel) {
    return HouseRender.ROOM_TYPES.map(rt => `<option value="${rt.id}"${rt.id === sel ? ' selected' : ''}>${T(rt.key)}</option>`).join('');
  }
  function shapeOptions(sel) {
    return HouseRender.ROOM_SHAPES.map(sh => `<option value="${sh.id}"${sh.id === sel ? ' selected' : ''}>${T(sh.key)}</option>`).join('');
  }
  function furnitureAddOptions(roomType) {
    const list = HouseRender.FURNITURE.slice().sort((a, b) => (a.rooms.includes(roomType) ? 0 : 1) - (b.rooms.includes(roomType) ? 0 : 1));
    return list.map(fi => `<option value="${fi.id}">${T(fi.key)}</option>`).join('');
  }
  const expandedRooms = new Set();   // "f:i" → разгъната стая
  function roomDetailsHtml(f, i, r) {
    const HR = HouseRender, nw = HR.wallsForShape(r.shape);
    const wallCount = {}; let centerCount = 0;
    r.items.forEach(it => { if (it.place === 'wall') wallCount[it.wall] = (wallCount[it.wall] || 0) + 1; else centerCount++; });
    let wallsHtml = '';
    for (let w = 0; w < nw; w++) {
      const ww = r.walls[w] || {};
      wallsHtml += `<div class="wall-row"><span class="wlabel">${T('wall.label', { n: w + 1 })}</span>` +
        `<label>${T('wall.doors')} <input type="number" min="0" max="4" class="w-doors" data-f="${f}" data-i="${i}" data-w="${w}" value="${ww.doors || 0}"></label>` +
        `<label>${T('wall.windows')} <input type="number" min="0" max="6" class="w-win" data-f="${f}" data-i="${i}" data-w="${w}" value="${ww.windows || 0}"></label></div>`;
    }
    const placeOptions = (it) => {
      let o = `<option value="center"${it.place === 'center' ? ' selected' : ''}${(centerCount >= HR.CENTER_MAX && it.place !== 'center') ? ' disabled' : ''}>${T('wall.center')}</option>`;
      for (let w = 0; w < nw; w++) {
        const sel = it.place === 'wall' && it.wall === w, full = (wallCount[w] || 0) >= HR.WALL_MAX && !sel;
        o += `<option value="w${w}"${sel ? ' selected' : ''}${full ? ' disabled' : ''}>${T('wall.label', { n: w + 1 })}${full ? ' ' + T('rooms.full') : ''}</option>`;
      }
      return o;
    };
    const itemsHtml = r.items.map((it, idx) => {
      const fi = HR.furnitureItem(it.type) || { name: it.type, key: '' };
      return `<div class="item-row"><span class="iname">${esc(fi.key ? T(fi.key) : fi.name)}</span>` +
        `<select class="i-place" data-f="${f}" data-i="${i}" data-idx="${idx}">${placeOptions(it)}</select>` +
        `<button type="button" class="del-item" data-f="${f}" data-i="${i}" data-idx="${idx}">✕</button></div>`;
    }).join('');
    return `<div class="room-details">` +
      `<div class="rd-walls">${wallsHtml}</div>` +
      `<div class="rd-items">${itemsHtml}<div class="add-item-row"><select class="add-item-sel" data-f="${f}" data-i="${i}"><option value="">${T('rooms.add_item')}…</option>${furnitureAddOptions(r.type)}</select></div></div>` +
      `<div class="rd-preview">${HR.roomDetailPlan(r)}<div class="rd-wviews">${Array.from({ length: nw }).map((_, w) => HR.wallElevation(r, w)).join('')}</div></div></div>`;
  }
  function buildRoomsUI() {
    ensureRooms();
    const box = $('#roomsByFloor');
    if (!box) return;
    box.innerHTML = '';
    for (let f = 0; f < state.floors; f++) {
      const rooms = state.rooms[f];
      const block = document.createElement('div');
      block.className = 'floor-block';
      let html = `<div class="floor-head"><b>${T('rooms.floor', { n: f + 1 })}</b> <button type="button" class="add-room" data-f="${f}">${T('rooms.add')}</button></div>`;
      if (!rooms.length) html += `<div class="room-empty">${T('rooms.none')}</div>`;
      rooms.forEach((r, i) => {
        const open = expandedRooms.has(f + ':' + i);
        html += `<div class="room-row">` +
          `<select class="r-type" data-f="${f}" data-i="${i}">${roomOptions(r.type)}</select>` +
          `<select class="r-shape" data-f="${f}" data-i="${i}" title="Форма">${shapeOptions(r.shape)}</select>` +
          `<button type="button" class="r-details${open ? ' on' : ''}" data-f="${f}" data-i="${i}">${T('rooms.details')} ${open ? '▴' : '▾'}</button>` +
          `<button type="button" class="del-room" data-f="${f}" data-i="${i}" title="Премахни">✕</button></div>`;
        if (open) html += roomDetailsHtml(f, i, r);
      });
      block.innerHTML = html;
      box.appendChild(block);
    }
    bindRoomsUI(box);
  }
  function bindRoomsUI(box) {
    const rebuild = () => { buildRoomsUI(); drawPreview(); };
    box.querySelectorAll('.add-room').forEach(b => b.onclick = () => { state.rooms[+b.dataset.f].push({ type: 'living', shape: 'rect', walls: [], items: [] }); rebuild(); });
    box.querySelectorAll('.del-room').forEach(b => b.onclick = () => { expandedRooms.delete(b.dataset.f + ':' + b.dataset.i); state.rooms[+b.dataset.f].splice(+b.dataset.i, 1); rebuild(); });
    box.querySelectorAll('.r-type').forEach(s => s.onchange = () => { state.rooms[+s.dataset.f][+s.dataset.i].type = s.value; rebuild(); });
    box.querySelectorAll('.r-shape').forEach(s => s.onchange = () => { state.rooms[+s.dataset.f][+s.dataset.i].shape = s.value; rebuild(); });
    box.querySelectorAll('.r-details').forEach(b => b.onclick = () => { const k = b.dataset.f + ':' + b.dataset.i; expandedRooms.has(k) ? expandedRooms.delete(k) : expandedRooms.add(k); buildRoomsUI(); });
    box.querySelectorAll('.w-doors').forEach(p => p.onchange = () => { state.rooms[+p.dataset.f][+p.dataset.i].walls[+p.dataset.w].doors = Math.max(0, +p.value || 0); rebuild(); });
    box.querySelectorAll('.w-win').forEach(p => p.onchange = () => { state.rooms[+p.dataset.f][+p.dataset.i].walls[+p.dataset.w].windows = Math.max(0, +p.value || 0); rebuild(); });
    box.querySelectorAll('.i-place').forEach(s => s.onchange = () => { const it = state.rooms[+s.dataset.f][+s.dataset.i].items[+s.dataset.idx]; if (s.value === 'center') { it.place = 'center'; it.wall = 0; } else { it.place = 'wall'; it.wall = +s.value.slice(1); } rebuild(); });
    box.querySelectorAll('.del-item').forEach(b => b.onclick = () => { state.rooms[+b.dataset.f][+b.dataset.i].items.splice(+b.dataset.idx, 1); rebuild(); });
    box.querySelectorAll('.add-item-sel').forEach(s => s.onchange = () => { if (s.value) { addItemToRoom(+s.dataset.f, +s.dataset.i, s.value); rebuild(); } });
  }
  function addItemToRoom(f, i, typeId) {
    const HR = HouseRender, r = state.rooms[f][i], nw = HR.wallsForShape(r.shape);
    const fi = HR.furnitureItem(typeId) || { def: 'center' };
    const wallCount = {}; let centerCount = 0;
    r.items.forEach(it => { if (it.place === 'wall') wallCount[it.wall] = (wallCount[it.wall] || 0) + 1; else centerCount++; });
    if (fi.def === 'center' && centerCount < HR.CENTER_MAX) { r.items.push({ type: typeId, place: 'center', wall: 0 }); return; }
    for (let w = 0; w < nw; w++) if ((wallCount[w] || 0) < HR.WALL_MAX) { r.items.push({ type: typeId, place: 'wall', wall: w }); return; }
    if (centerCount < HR.CENTER_MAX) { r.items.push({ type: typeId, place: 'center', wall: 0 }); return; }
    alert(T('rooms.full'));
  }

  function drawAllSides() {
    const grid = $('#allSides');
    grid.innerHTML = '';
    HouseRender.SIDES.forEach(side => {
      const cell = document.createElement('div');
      cell.className = 'thumb';
      cell.innerHTML = HouseRender.elevation(renderParams(), side);
      grid.appendChild(cell);
    });
    const roofCell = document.createElement('div');
    roofCell.className = 'thumb';
    roofCell.innerHTML = HouseRender.roofPlan(renderParams());
    grid.appendChild(roofCell);
  }

  // ── контроли ────────────────────────────────────────────────────
  function buildControls() {
    // Форма
    const fp = $('#footprint');
    HouseRender.FOOTPRINTS.forEach(f => fp.add(new Option(T(f.key), f.id)));
    fp.value = state.footprint;
    fp.onchange = () => { state.footprint = fp.value; state.customShape = null; const m = $('#shapeImgMsg'); if (m) m.style.display = 'none'; drawPreview(); };

    // Покрив
    const rf = $('#roof');
    HouseRender.ROOFS.forEach(r => rf.add(new Option(T(r.key), r.id)));
    rf.value = state.roof;
    rf.onchange = () => { state.roof = rf.value; drawPreview(); };

    // Етажи (макс от config — правило: без твърди стойности в кода)
    const fl = $('#floors');
    fl.min = CONFIG.limits.minFloors;
    fl.max = CONFIG.limits.maxFloors;
    fl.value = state.floors;
    $('#floorsVal').textContent = state.floors;
    fl.oninput = () => { state.floors = +fl.value; $('#floorsVal').textContent = state.floors; ensureRooms(); buildRoomsUI(); drawPreview(); };

    // Прозорци на етаж
    const wn = $('#windows');
    wn.value = state.windowsPerFloor;
    $('#windowsVal').textContent = state.windowsPerFloor;
    wn.oninput = () => { state.windowsPerFloor = +wn.value; $('#windowsVal').textContent = state.windowsPerFloor; drawPreview(); };

    // Цветове
    bindColor('#wallColor', 'wallColor');
    bindColor('#roofColor', 'roofColor');
    bindColor('#accentColor', 'accentColor');

    // Екстри
    ['pool', 'boat', 'pier'].forEach(k => {
      const el = document.querySelector(`#ex_${k}`);
      el.checked = state.extras[k];
      el.onchange = () => { state.extras[k] = el.checked; drawPreview(); };
    });

    // Бутони
    $('#btnRandom').onclick = randomize;
    $('#btnPdf').onclick = exportPdf;
    $('#btnSave').onclick = saveToGallery;

    const shapeImg = $('#shapeImg');
    if (shapeImg) shapeImg.onchange = () => { if (shapeImg.files && shapeImg.files[0]) uploadShape(shapeImg.files[0]); };

    buildRoomsUI();
  }

  // Качена снимка → силует → custom форма (footprint='custom'). Споделен ендпойнт с админа.
  async function uploadShape(file) {
    if (!file || typeof HLB === 'undefined') return;
    const msg = $('#shapeImgMsg');
    const fd = new FormData(); fd.append('image', file);
    if (msg) { msg.style.display = ''; msg.className = 'msg'; msg.textContent = T('shapeimg.processing'); }
    try {
      const r = await HLB.api('/proposals/shape-from-image', { method: 'POST', formData: fd });
      if (r && Array.isArray(r.pts) && r.pts.length > 2) {
        state.customShape = { pts: r.pts };
        state.footprint = 'custom';
        if (msg) { msg.className = 'msg ok'; msg.textContent = T('shapeimg.done'); }
        drawPreview();
      } else if (msg) { msg.className = 'msg err'; msg.textContent = T('shapeimg.fail'); }
    } catch (e) {
      if (msg) { msg.className = 'msg err'; msg.textContent = (e.status === 401 ? T('js.need_login_save') : e.message); }
    }
  }

  // Запазва текущата конструирана къща като предложение в галерията (през API).
  // composer_params = целият state, за да може галерията да я пре-рендира.
  async function saveToGallery() {
    if (typeof HLB === 'undefined') return;
    const fpObj = HouseRender.FOOTPRINTS.find(f => f.id === state.footprint) || {};
    const fpName = fpObj.key ? T(fpObj.key) : (fpObj.name || state.footprint);
    const title = prompt(T('js.save_prompt'), editingId ? editingTitle : T('js.save_default', { name: fpName }));
    if (title === null) return; // отказ
    const params = {
      footprint: state.footprint, roof: state.roof, floors: state.floors,
      wallColor: state.wallColor, roofColor: state.roofColor, accentColor: state.accentColor,
      windowsPerFloor: state.windowsPerFloor, extras: state.extras,
      rooms: state.rooms, customShape: state.customShape || null,
    };
    try {
      if (editingId) {
        await HLB.api(`/proposals/${editingId}`, { method: 'PUT', body: { title: title.trim() || fpName, composer_params: params } });
        showSaveMsg(T('js.updated_ok'), true);
      } else {
        await HLB.api('/proposals', { method: 'POST', body: { title: title.trim() || fpName, composer_params: params } });
        showSaveMsg(T('js.saved_ok'), true);
      }
    } catch (e) {
      if (e.status === 401) { showSaveMsg(T('js.need_login_save'), false); setTimeout(() => location.href = 'login.html', 900); }
      else if (e.status === 402) showSaveMsg(T('js.need_sub_propose'), false);
      else showSaveMsg(e.message, false);
    }
  }

  function showSaveMsg(text, ok) {
    const el = $('#saveMsg');
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + (ok ? 'ok' : 'err');
    el.style.display = '';
  }

  function bindColor(sel, key) {
    const el = $(sel);
    el.value = state[key];
    el.oninput = () => { state[key] = el.value; drawPreview(); };
  }

  // "Стотици варианти" — произволен дизайн (функция от brief-а: бързо разлистване).
  function randomize() {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const colors = ['#e8d9c0', '#cfd8dc', '#f3e1c0', '#d9c2e0', '#c9e0d0', '#f0c9c9', '#bcd3e8'];
    const roofs = ['#8a4b3b', '#445566', '#3b6b4a', '#7a5230', '#5b4b7a'];
    state.footprint = pick(HouseRender.FOOTPRINTS).id;
    state.roof = pick(HouseRender.ROOFS).id;
    state.floors = CONFIG.limits.minFloors + Math.floor(Math.random() * (CONFIG.limits.maxFloors - CONFIG.limits.minFloors + 1));
    state.windowsPerFloor = 1 + Math.floor(Math.random() * 3);
    state.wallColor = pick(colors);
    state.roofColor = pick(roofs);
    state.accentColor = pick(['#3b6ea5', '#b5651d', '#2e8b57', '#8a3b6e']);
    state.extras = { pool: Math.random() < 0.4, boat: Math.random() < 0.3, pier: Math.random() < 0.3 };
    state.rooms = [];
    for (let f = 0; f < state.floors; f++) {
      const cnt = 1 + Math.floor(Math.random() * 4);
      const arr = [];
      for (let i = 0; i < cnt; i++) arr.push({ type: pick(HouseRender.ROOM_TYPES).id, shape: pick(HouseRender.ROOM_SHAPES).id });
      state.rooms.push(arr);
    }
    syncControls();
    drawPreview();
  }

  // Връща контролите към текущия state (след randomize).
  function syncControls() {
    $('#footprint').value = state.footprint;
    $('#roof').value = state.roof;
    $('#floors').value = state.floors; $('#floorsVal').textContent = state.floors;
    $('#windows').value = state.windowsPerFloor; $('#windowsVal').textContent = state.windowsPerFloor;
    $('#wallColor').value = state.wallColor;
    $('#roofColor').value = state.roofColor;
    $('#accentColor').value = state.accentColor;
    ['pool', 'boat', 'pier'].forEach(k => { document.querySelector(`#ex_${k}`).checked = state.extras[k]; });
    buildRoomsUI();
  }

  // ── PDF (изгледи от всички страни) ───────────────────────────────
  // Зависимост-нула: рендерираме лист и ползваме печата на браузъра → "Запази като PDF".
  // Работи офлайн, на всяка платформа.
  function exportPdf() {
    const p = renderParams();
    const fpO = HouseRender.FOOTPRINTS.find(f => f.id === p.footprint) || {};
    const rfO = HouseRender.ROOFS.find(r => r.id === p.roof) || {};
    const fpName = fpO.key ? T(fpO.key) : (fpO.name || p.footprint);
    const rfName = rfO.key ? T(rfO.key) : (rfO.name || p.roof);
    const exList = Object.entries(state.extras).filter(([, v]) => v).map(([k]) => T('extra.' + k)).join(', ') || T('pdf.none');

    // Стаи: за всяка — план отгоре + изглед на всяка стена.
    const roomsHtml = (p.rooms || []).map(fl => (fl || []).map(r => {
      const nw = HouseRender.wallsForShape(r.shape);
      const views = Array.from({ length: nw }).map((_, w) => `<div class="cell">${HouseRender.wallElevation(r, w)}</div>`).join('');
      return `<div class="cell">${HouseRender.roomDetailPlan(r)}</div>${views}`;
    }).join('')).join('');

    const sheet = `<!doctype html><html lang="${window.HLB_I18N ? HLB_I18N.lang : 'bg'}"><head><meta charset="utf-8">
      <title>${T('pdf.title')}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: system-ui, Arial; color: #233; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { font-size: 12px; color: #556; margin-bottom: 14px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .cell { border: 1px solid #ccd; border-radius: 8px; padding: 6px; }
        .cell svg { width: 100%; height: auto; display: block; }
        @media print { .noprint { display: none; } }
        .noprint { margin: 14px 0; }
        button { font-size: 14px; padding: 8px 16px; }
      </style></head><body>
      <h1>${T('pdf.title')}</h1>
      <div class="meta">${T('pdf.shape')}: <b>${fpName}</b> · ${T('pdf.roof')}: <b>${rfName}</b> · ${T('pdf.floors')}: <b>${p.floors}</b> · ${T('pdf.extras')}: <b>${exList}</b></div>
      <div class="noprint"><button onclick="window.print()">${T('js.print_pdf')}</button></div>
      <div class="grid">
        ${HouseRender.SIDES.map(s => `<div class="cell">${HouseRender.elevation(p, s)}</div>`).join('')}
        <div class="cell">${HouseRender.roofPlan(p)}</div>
        ${Array.from({ length: p.floors || 0 }).map((_, f) => `<div class="cell">${HouseRender.floorPlan(p, f)}</div>`).join('')}
      </div>
      ${roomsHtml ? `<h1 style="font-size:16px;margin:18px 0 6px">${T('rooms.detail_pdf')}</h1><div class="grid">${roomsHtml}</div>` : ''}
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert(T('js.popup_blocked')); return; }
    w.document.open(); w.document.write(sheet); w.document.close();
  }

  // ── старт ───────────────────────────────────────────────────────
  async function init() {
    if (window.HLB_I18N && HLB_I18N.ready) { try { await HLB_I18N.ready; } catch (_) {} }
    try {
      CONFIG = await (await fetch('config.json')).json();
    } catch (e) {
      // Фолбек, ако config.json не е достъпен (напр. отворен директно от файл).
      CONFIG = { limits: { minFloors: 1, maxFloors: 3 } };
      console.warn('config.json не е зареден, ползвам фолбек лимити', e);
    }
    Object.assign(state, CONFIG.defaults || {});
    if (typeof HLB !== 'undefined') { try { await HLB.mountNav('build'); } catch (_) {} }
    await maybeLoadEdit();
    buildControls();
    drawPreview();
  }

  // Ако сме дошли от профила с ?edit=ID → зареди модела в конструктора за редакция.
  async function maybeLoadEdit() {
    const id = new URLSearchParams(location.search).get('edit');
    if (!id || typeof HLB === 'undefined') return;
    try {
      const r = await HLB.api(`/proposals/${id}`);
      const p = r.proposal;
      if (p && p.composer_params) {
        editingId = p.id;
        editingTitle = p.title || '';
        Object.assign(state, p.composer_params);
        showSaveMsg(T('js.editing_loaded', { title: editingTitle }), true);
      }
    } catch (e) { /* не успя да зареди — продължи с нов дизайн */ }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
