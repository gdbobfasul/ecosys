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
    state.rooms = state.rooms.map(fl => Array.isArray(fl) ? fl.filter(r => r && r.type).map(r => ({ type: r.type, shape: r.shape || 'rect' })) : []);
    while (state.rooms.length < n) state.rooms.push([]);
    if (state.rooms.length > n) state.rooms.length = n;
  }
  function roomOptions(sel) {
    return HouseRender.ROOM_TYPES.map(rt => `<option value="${rt.id}"${rt.id === sel ? ' selected' : ''}>${T(rt.key)}</option>`).join('');
  }
  function shapeOptions(sel) {
    return HouseRender.ROOM_SHAPES.map(sh => `<option value="${sh.id}"${sh.id === sel ? ' selected' : ''}>${T(sh.key)}</option>`).join('');
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
      block.innerHTML =
        `<div class="floor-head"><b>${T('rooms.floor', { n: f + 1 })}</b> <button type="button" class="add-room" data-f="${f}">${T('rooms.add')}</button></div>` +
        (rooms.length
          ? rooms.map((r, i) => `<div class="room-row"><select class="r-type" data-f="${f}" data-i="${i}">${roomOptions(r.type)}</select><select class="r-shape" data-f="${f}" data-i="${i}" title="Форма">${shapeOptions(r.shape)}</select><button type="button" class="del-room" data-f="${f}" data-i="${i}" title="Премахни">✕</button></div>`).join('')
          : `<div class="room-empty">${T('rooms.none')}</div>`);
      box.appendChild(block);
    }
    box.querySelectorAll('.add-room').forEach(b => b.onclick = () => { state.rooms[+b.dataset.f].push({ type: 'living', shape: 'rect' }); buildRoomsUI(); drawPreview(); });
    box.querySelectorAll('.del-room').forEach(b => b.onclick = () => { state.rooms[+b.dataset.f].splice(+b.dataset.i, 1); buildRoomsUI(); drawPreview(); });
    box.querySelectorAll('.r-type').forEach(s => s.onchange = () => { state.rooms[+s.dataset.f][+s.dataset.i].type = s.value; drawPreview(); });
    box.querySelectorAll('.r-shape').forEach(s => s.onchange = () => { state.rooms[+s.dataset.f][+s.dataset.i].shape = s.value; drawPreview(); });
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
