// "Подреди своя дом" — UI логика на уеб прототипа (фаза 1: конструктор + PDF).
// Без крипто, без линкове към KCY — самостоятелно приложение (правило от brief-а).

(function () {
  'use strict';

  let CONFIG = null;
  const state = {
    footprint: 'square',
    roof: 'gabled',
    floors: 2,
    wallColor: '#e8d9c0',
    roofColor: '#8a4b3b',
    accentColor: '#3b6ea5',
    windowsPerFloor: 2,
    extras: { pool: false, boat: false, pier: false },
  };

  const $ = sel => document.querySelector(sel);

  // Параметрите, които подаваме на рендера (+ лимитите от config).
  function renderParams() {
    return Object.assign({}, state, { limits: CONFIG.limits });
  }

  // ── рисуване ────────────────────────────────────────────────────
  function drawPreview() {
    $('#preview').innerHTML = HouseRender.elevation(renderParams(), 'front');
    drawAllSides();
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
    HouseRender.FOOTPRINTS.forEach(f => fp.add(new Option(f.name, f.id)));
    fp.value = state.footprint;
    fp.onchange = () => { state.footprint = fp.value; drawPreview(); };

    // Покрив
    const rf = $('#roof');
    HouseRender.ROOFS.forEach(r => rf.add(new Option(r.name, r.id)));
    rf.value = state.roof;
    rf.onchange = () => { state.roof = rf.value; drawPreview(); };

    // Етажи (макс от config — правило: без твърди стойности в кода)
    const fl = $('#floors');
    fl.min = CONFIG.limits.minFloors;
    fl.max = CONFIG.limits.maxFloors;
    fl.value = state.floors;
    $('#floorsVal').textContent = state.floors;
    fl.oninput = () => { state.floors = +fl.value; $('#floorsVal').textContent = state.floors; drawPreview(); };

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
  }

  // ── PDF (изгледи от всички страни) ───────────────────────────────
  // Зависимост-нула: рендерираме лист и ползваме печата на браузъра → "Запази като PDF".
  // Работи офлайн, на всяка платформа.
  function exportPdf() {
    const p = renderParams();
    const fpName = (HouseRender.FOOTPRINTS.find(f => f.id === p.footprint) || {}).name || p.footprint;
    const rfName = (HouseRender.ROOFS.find(r => r.id === p.roof) || {}).name || p.roof;
    const exList = Object.entries(state.extras).filter(([, v]) => v).map(([k]) => ({ pool: 'басейн', boat: 'лодка', pier: 'пристан' }[k])).join(', ') || '—';

    const sheet = `<!doctype html><html lang="bg"><head><meta charset="utf-8">
      <title>Подреди своя дом — изгледи</title>
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
      <h1>Подреди своя дом — изгледи на къщата</h1>
      <div class="meta">Форма: <b>${fpName}</b> · Покрив: <b>${rfName}</b> · Етажи: <b>${p.floors}</b> · Екстри: <b>${exList}</b></div>
      <div class="noprint"><button onclick="window.print()">🖨️ Печат / Запази като PDF</button></div>
      <div class="grid">
        ${HouseRender.SIDES.map(s => `<div class="cell">${HouseRender.elevation(p, s)}</div>`).join('')}
        <div class="cell">${HouseRender.roofPlan(p)}</div>
      </div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Изскачащият прозорец е блокиран — разреши pop-up за този сайт.'); return; }
    w.document.open(); w.document.write(sheet); w.document.close();
  }

  // ── старт ───────────────────────────────────────────────────────
  async function init() {
    try {
      CONFIG = await (await fetch('config.json')).json();
    } catch (e) {
      // Фолбек, ако config.json не е достъпен (напр. отворен директно от файл).
      CONFIG = { limits: { minFloors: 1, maxFloors: 3 } };
      console.warn('config.json не е зареден, ползвам фолбек лимити', e);
    }
    Object.assign(state, CONFIG.defaults || {});
    buildControls();
    drawPreview();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
