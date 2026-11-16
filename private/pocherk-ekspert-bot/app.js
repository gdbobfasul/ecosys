/* ============================================================================
 * Почеркова експертиза — сравнение на букви
 * Локален инструмент (само браузър, без сървър). Интерфейс само на български.
 *
 * Идея: зарежда се ТЕСТОВ образец (черен) и един или повече СРАВНИТЕЛНИ образци
 * (всеки със свой цвят). Буквите от образците се „нарязват" (очертаване с мишка
 * или авто-нарязване). После за всяка буква се сравняват вариантите по два начина:
 *   • НАСЛАГАНИ ОТГОРЕ — тестовата буква е черна, другите образци се наслагват
 *     полупрозрачно върху нея, всеки със своя цвят;
 *   • НА СЪЩИЯ РЕД — буквите стоят една до друга на общ ред.
 * ========================================================================== */
'use strict';

/* ---------- палитра за сравнителните образци ---------- */
const PALETTE = ['#e23b3b','#2e7dff','#18a558','#b45bd6','#ff8c1a','#00b3b3',
                 '#d6b400','#e85aa0','#6a7bff','#4caf50','#ff5d8f','#8d6e63'];

/* ---------- състояние ---------- */
const state = {
  samples: [],     // {id,name,kind:'test'|'comp',color,dataUrl,img, thr, vis, op}
  letters: [],     // {id,sampleId,label, x,y,w,h, ink:{x,y,w,h}, place:{dx,dy,sc,rot}, _tint}
  selSample: null, // id на избрания образец (таб 1)
  curLabel: 'а',
  selLetter: null, // избрана буква за подравняване (таб 2)
};
let seq = 1;
const uid = () => 's' + (seq++);

/* ---------- кратки помощници ---------- */
const $ = s => document.querySelector(s);
const el = (t, cls) => { const e = document.createElement(t); if (cls) e.className = cls; return e; };
const sampleById = id => state.samples.find(s => s.id === id);
const lettersOf = label => state.letters.filter(l => l.label === label);

/* ========================================================================== *
 *  ЗАРЕЖДАНЕ НА ОБРАЗЦИ
 * ========================================================================== */
let pendingKind = 'comp';

$('#btnAddTest').onclick = () => { pendingKind = 'test'; $('#fileImg').click(); };
$('#btnAddComp').onclick = () => { pendingKind = 'comp'; $('#fileImg').click(); };

$('#fileImg').onchange = async e => {
  const files = [...e.target.files];
  e.target.value = '';
  for (const f of files) {
    const dataUrl = await readAsDataURL(f);
    await addSample(f.name.replace(/\.[^.]+$/, ''), pendingKind, dataUrl);
    // ако сме добавили тестов и има още файлове — те стават сравнителни
    if (pendingKind === 'test') pendingKind = 'comp';
  }
  renderSamples(); refreshStats(); if (!state.selSample && state.samples[0]) selectSample(state.samples[0].id);
};

function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
  });
}
function loadImg(dataUrl) {
  return new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl;
  });
}

async function addSample(name, kind, dataUrl) {
  const img = await loadImg(dataUrl);
  let color = '#000000';
  if (kind === 'comp') {
    const used = state.samples.filter(s => s.kind === 'comp').length;
    color = PALETTE[used % PALETTE.length];
  } else {
    // само един тестов образец
    const old = state.samples.find(s => s.kind === 'test');
    if (old) old.kind = 'comp';
  }
  const s = { id: uid(), name, kind, color, dataUrl, img,
              thr: 160, vis: true, op: kind === 'test' ? 1 : 0.5 };
  if (kind === 'test') { s.color = '#000000'; }
  state.samples.push(s);
  // пренареди: тестовият най-отгоре
  state.samples.sort((a, b) => (a.kind === 'test' ? -1 : 0) - (b.kind === 'test' ? -1 : 0));
  return s;
}

/* ---------- списък с образци (ляво) ---------- */
function renderSamples() {
  const box = $('#sampleList'); box.innerHTML = '';
  if (!state.samples.length) {
    const e = el('div', 'hint'); e.style.padding = '10px';
    e.textContent = 'Няма образци. Добави „Тестов образец" и „Сравнителен образец" отгоре.';
    box.appendChild(e); return;
  }
  for (const s of state.samples) {
    const card = el('div', 'sample' + (s.id === state.selSample ? ' sel' : ''));
    const row = el('div', 'row');
    const dot = el('span', 'dot'); dot.style.background = s.color;
    const nm = el('span', 'nm'); nm.textContent = (s.kind === 'test' ? '◆ ' : '') + s.name;
    nm.title = s.kind === 'test' ? 'Тестов образец' : 'Сравнителен образец';
    const del = el('button', 'sm'); del.textContent = '✕'; del.title = 'Премахни';
    del.onclick = ev => { ev.stopPropagation(); removeSample(s.id); };
    row.append(dot, nm, del);
    const meta = el('div', 'meta');
    const n = state.letters.filter(l => l.sampleId === s.id).length;
    meta.textContent = (s.kind === 'test' ? 'тестов' : 'сравнителен') + ' · ' + n + ' букви';
    const th = el('img', 'thumb'); th.src = s.dataUrl;
    card.append(row, meta, th);
    card.onclick = () => selectSample(s.id);
    box.appendChild(card);
  }
}

function removeSample(id) {
  state.samples = state.samples.filter(s => s.id !== id);
  state.letters = state.letters.filter(l => l.sampleId !== id);
  if (state.selSample === id) state.selSample = state.samples[0] ? state.samples[0].id : null;
  renderSamples(); drawCutCanvas(); renderCuts(); refreshStats(); rebuildCmpLabels();
}

function selectSample(id) {
  state.selSample = id;
  const s = sampleById(id);
  $('#curSampleName').textContent = s ? s.name : '—';
  if (s) $('#thr').value = s.thr, $('#thrVal').textContent = s.thr;
  renderSamples(); drawCutCanvas();
}

/* ========================================================================== *
 *  ТАБ 1 — НАРЯЗВАНЕ
 * ========================================================================== */
const cutCanvas = $('#cutCanvas');
const cctx = cutCanvas.getContext('2d');
let zoom = 1;

$('#zoom').oninput = e => { zoom = (+e.target.value) / 100; drawCutCanvas(); };
$('#thr').oninput = e => {
  const s = sampleById(state.selSample); if (!s) return;
  s.thr = +e.target.value; $('#thrVal').textContent = s.thr;
  // стария тинт е невалиден
  for (const l of state.letters) if (l.sampleId === s.id) l._tint = null;
  drawCutCanvas();
};
$('#showMask').onchange = drawCutCanvas;

function drawCutCanvas() {
  const s = sampleById(state.selSample);
  if (!s) { cutCanvas.width = 10; cutCanvas.height = 10; cctx.clearRect(0, 0, 10, 10); return; }
  const W = Math.round(s.img.naturalWidth * zoom), H = Math.round(s.img.naturalHeight * zoom);
  cutCanvas.width = W; cutCanvas.height = H;
  cctx.clearRect(0, 0, W, H);
  cctx.drawImage(s.img, 0, 0, W, H);

  if ($('#showMask').checked) {
    const mask = tintWhole(s);
    cctx.save(); cctx.globalAlpha = 0.9; cctx.drawImage(mask, 0, 0, W, H); cctx.restore();
  }

  // съществуващи очертани букви
  for (const l of state.letters) {
    if (l.sampleId !== s.id) continue;
    const x = l.x * zoom, y = l.y * zoom, w = l.w * zoom, h = l.h * zoom;
    cctx.lineWidth = 1.5; cctx.strokeStyle = s.color; cctx.strokeRect(x, y, w, h);
    cctx.fillStyle = s.color;
    cctx.fillRect(x, y - 15, Math.max(16, l.label.length * 9 + 6), 15);
    cctx.fillStyle = '#fff'; cctx.font = '12px Segoe UI'; cctx.textBaseline = 'middle';
    cctx.fillText(l.label, x + 3, y - 7);
  }
  // текущо очертаване
  if (drag.active) {
    const r = normRect(drag);
    cctx.setLineDash([5, 4]); cctx.lineWidth = 1.5; cctx.strokeStyle = '#4a9eff';
    cctx.strokeRect(r.x * zoom, r.y * zoom, r.w * zoom, r.h * zoom); cctx.setLineDash([]);
  }
}

/* очертаване с мишка */
const drag = { active: false, x0: 0, y0: 0, x1: 0, y1: 0 };
function toImg(ev) {
  const rect = cutCanvas.getBoundingClientRect();
  const sx = cutCanvas.width / rect.width, sy = cutCanvas.height / rect.height;
  return { x: (ev.clientX - rect.left) * sx / zoom, y: (ev.clientY - rect.top) * sy / zoom };
}
function normRect(d) {
  return { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1),
           w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) };
}
cutCanvas.onmousedown = ev => {
  if (!state.selSample) return;
  const p = toImg(ev); drag.active = true; drag.x0 = drag.x1 = p.x; drag.y0 = drag.y1 = p.y;
};
window.addEventListener('mousemove', ev => {
  if (!drag.active) return; const p = toImg(ev); drag.x1 = p.x; drag.y1 = p.y; drawCutCanvas();
});
window.addEventListener('mouseup', () => {
  if (!drag.active) return; drag.active = false;
  const r = normRect(drag);
  if (r.w > 4 && r.h > 4) addLetter(state.selSample, r.x, r.y, r.w, r.h, state.curLabel);
  drawCutCanvas();
});

function addLetter(sampleId, x, y, w, h, label) {
  const l = { id: uid(), sampleId, label,
              x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
              ink: null, place: { dx: 0, dy: 0, sc: 1, rot: 0 }, _tint: null };
  computeInk(l);
  state.letters.push(l);
  renderCuts(); renderSamples(); refreshStats(); rebuildCmpLabels();
}

/* ========================================================================== *
 *  ОЦВЕТЯВАНЕ НА МАСТИЛОТО (ink → цвят с прозрачност спрямо тъмнината)
 * ========================================================================== */
function sampleRegionData(s, x, y, w, h) {
  const c = el('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
  const g = c.getContext('2d');
  g.drawImage(s.img, x, y, w, h, 0, 0, w, h);
  return g.getImageData(0, 0, c.width, c.height);
}

/* връща offscreen canvas с оцветено мастило + попълва l.ink (bbox на мастилото) */
function tintLetter(l) {
  const s = sampleById(l.sampleId);
  const key = s.thr + '|' + s.color;
  if (l._tint && l._tint.key === key) return l._tint.canvas;
  const id = sampleRegionData(s, l.x, l.y, l.w, l.h);
  const { data, width: w, height: h } = id;
  const [cr, cg, cb] = hexRgb(s.color);
  const thr = s.thr;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < thr) {
      const a = Math.min(1, (thr - lum) / thr);
      data[i] = cr; data[i + 1] = cg; data[i + 2] = cb; data[i + 3] = Math.round(a * 255);
      const px = p % w, py = (p / w) | 0;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    } else { data[i + 3] = 0; }
  }
  if (maxX < 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
  l.ink = { x: minX, y: minY, w: (maxX - minX + 1), h: (maxY - minY + 1) };
  const c = el('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(id, 0, 0);
  l._tint = { key, canvas: c };
  return c;
}
function computeInk(l) { tintLetter(l); }

/* оцветен цял образец (за преглед на прага) */
function tintWhole(s) {
  const w = s.img.naturalWidth, h = s.img.naturalHeight;
  const c = el('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.drawImage(s.img, 0, 0);
  const id = g.getImageData(0, 0, w, h), d = id.data, [cr, cg, cb] = hexRgb(s.color), thr = s.thr;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum < thr) { d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = Math.round(Math.min(1, (thr - lum) / thr) * 255); }
    else d[i + 3] = 0;
  }
  g.putImageData(id, 0, 0); return c;
}
function hexRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

/* ========================================================================== *
 *  АВТО-НАРЯЗВАНЕ (свързани компоненти) — помощно, не е безпогрешно за свързан почерк
 * ========================================================================== */
$('#btnAuto').onclick = () => {
  const s = sampleById(state.selSample); if (!s) return;
  const boxes = connectedComponents(s);
  if (!boxes.length) { alert('Не са намерени отделни петна. Настрой прага или очертай ръчно.'); return; }
  if (boxes.length > 400) { alert('Твърде много петна (' + boxes.length + '). Вдигни прага.'); return; }
  for (const b of boxes) addLetterQuiet(s.id, b.x, b.y, b.w, b.h, '?');
  renderCuts(); renderSamples(); refreshStats(); rebuildCmpLabels(); drawCutCanvas();
  alert('Намерени ' + boxes.length + ' петна (с надпис „?“). Кликни върху всяко вдясно, за да му зададеш буква.');
};
function addLetterQuiet(sampleId, x, y, w, h, label) {
  const l = { id: uid(), sampleId, label, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
              ink: null, place: { dx: 0, dy: 0, sc: 1, rot: 0 }, _tint: null };
  computeInk(l); state.letters.push(l);
}
function connectedComponents(s) {
  const w = s.img.naturalWidth, h = s.img.naturalHeight;
  const c = el('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.drawImage(s.img, 0, 0); const d = g.getImageData(0, 0, w, h).data;
  const ink = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    ink[p] = lum < s.thr ? 1 : 0;
  }
  const lab = new Int32Array(w * h).fill(0);
  const boxes = []; const stack = [];
  const minA = Math.max(8, (w * h) / 40000), maxA = (w * h) / 3;
  for (let p = 0; p < w * h; p++) {
    if (!ink[p] || lab[p]) continue;
    const id = boxes.length + 1; stack.length = 0; stack.push(p); lab[p] = id;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
    while (stack.length) {
      const q = stack.pop(), qx = q % w, qy = (q / w) | 0; area++;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (ink[np] && !lab[np]) { lab[np] = id; stack.push(np); }
      }
    }
    if (area >= minA && area <= maxA) {
      const pad = 2;
      boxes.push({ x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad),
                   w: Math.min(w, x1 + pad) - Math.max(0, x0 - pad),
                   h: Math.min(h, y1 + pad) - Math.max(0, y0 - pad) });
    }
  }
  boxes.sort((a, b) => a.x - b.x);
  return boxes;
}

/* ========================================================================== *
 *  АЗБУКА + НАДПИС НА БУКВИТЕ
 * ========================================================================== */
const LOWER = 'абвгдежзийклмнопрстуфхцчшщъьюя'.split('');
const UPPER = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ'.split('');
function buildAlphabet() {
  const box = $('#alphabet'); box.innerHTML = '';
  [...LOWER, ...UPPER].forEach(ch => {
    const b = el('button'); b.textContent = ch;
    if (ch === state.curLabel) b.classList.add('on');
    b.onclick = () => setLabel(ch); box.appendChild(b);
  });
}
function setLabel(ch) {
  state.curLabel = ch; $('#curLabel').textContent = ch;
  [...$('#alphabet').children].forEach(b => b.classList.toggle('on', b.textContent === ch));
}
$('#btnFreeLabel').onclick = () => { const v = $('#freeLabel').value.trim(); if (v) setLabel(v); };
$('#freeLabel').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnFreeLabel').click(); });

/* списък с нарязани букви, групиран по знак */
function renderCuts() {
  const box = $('#cutsList'); box.innerHTML = '';
  const labels = [...new Set(state.letters.map(l => l.label))].sort(labelSort);
  if (!labels.length) {
    const e = el('div', 'hint'); e.textContent = 'Още няма нарязани букви.'; box.appendChild(e); return;
  }
  for (const lb of labels) {
    const grp = el('div', 'cutGroup');
    const t = el('div', 'gtitle'); t.textContent = '„' + lb + '“ · ' + lettersOf(lb).length; grp.appendChild(t);
    const row = el('div', 'cutRow');
    for (const l of lettersOf(lb)) {
      const item = el('div', 'cutItem'); item.title = 'Клик: задай буква „' + state.curLabel + '“';
      const cv = el('canvas'); const t2 = tintLetter(l);
      const sc = Math.min(1, 46 / t2.height); cv.width = Math.round(t2.width * sc); cv.height = Math.round(t2.height * sc);
      const g = cv.getContext('2d'); g.drawImage(t2, 0, 0, cv.width, cv.height); item.appendChild(cv);
      const cc = el('span', 'cc'); cc.style.background = sampleById(l.sampleId).color; item.appendChild(cc);
      const x = el('button', 'x'); x.textContent = '×';
      x.onclick = ev => { ev.stopPropagation(); state.letters = state.letters.filter(z => z.id !== l.id);
        renderCuts(); renderSamples(); refreshStats(); rebuildCmpLabels(); drawCutCanvas(); };
      item.appendChild(x);
      item.onclick = () => { l.label = state.curLabel; l._tint = null; renderCuts(); drawCutCanvas(); rebuildCmpLabels(); };
      row.appendChild(item);
    }
    grp.appendChild(row); box.appendChild(grp);
  }
}
function labelSort(a, b) { return a.localeCompare(b, 'bg'); }

/* ========================================================================== *
 *  ТАБ 2 — СРАВНЕНИЕ ПО БУКВИ
 * ========================================================================== */
const cmpCanvas = $('#cmpCanvas'); const mctx = cmpCanvas.getContext('2d');
let letterH = 200;
$('#letterH').oninput = e => { letterH = +e.target.value; drawCmp(); };
document.querySelectorAll('input[name=mode]').forEach(r => r.onchange = drawCmp);
$('#cmpLabel').onchange = () => { state.selLetter = null; drawCmp(); buildLegend(); };

function rebuildCmpLabels() {
  const sel = $('#cmpLabel'); const prev = sel.value;
  const labels = [...new Set(state.letters.map(l => l.label))].filter(x => x !== '?').sort(labelSort);
  sel.innerHTML = '';
  for (const lb of labels) { const o = el('option'); o.value = lb; o.textContent = '„' + lb + '“  (' + lettersOf(lb).length + ' варианта)'; sel.appendChild(o); }
  if (labels.includes(prev)) sel.value = prev;
  buildLegend(); drawCmp();
}

function curCmpLetters() {
  const lb = $('#cmpLabel').value;
  const ls = lettersOf(lb);
  // тестовите първо (черни, най-отдолу), после сравнителните
  return ls.slice().sort((a, b) => kindRank(a) - kindRank(b));
}
function kindRank(l) { return sampleById(l.sampleId).kind === 'test' ? 0 : 1; }

/* легенда: по образци (цвят, видимост, прозрачност) */
function buildLegend() {
  const box = $('#legend'); box.innerHTML = '';
  const lb = $('#cmpLabel').value;
  const sampleIds = [...new Set(lettersOf(lb).map(l => l.sampleId))];
  if (!sampleIds.length) { const e = el('div', 'hint'); e.textContent = 'Избери знак с нарязани букви.'; box.appendChild(e); return; }
  // подреди тест първи
  sampleIds.sort((a, b) => (sampleById(a).kind === 'test' ? -1 : 0) - (sampleById(b).kind === 'test' ? -1 : 0));
  for (const sid of sampleIds) {
    const s = sampleById(sid);
    const row = el('div', 'legRow');
    const curSelSample = state.selLetter && lettersOf(lb).find(l => l.id === state.selLetter);
    if (curSelSample && curSelSample.sampleId === sid) row.classList.add('sel');
    const dot = el('span', 'dot'); dot.style.background = s.color;
    const nm = el('span', 'nm'); nm.textContent = (s.kind === 'test' ? '◆ ' : '') + s.name; nm.title = nm.textContent;
    const vis = el('input'); vis.type = 'checkbox'; vis.checked = s.vis; vis.title = 'видим';
    vis.onchange = () => { s.vis = vis.checked; drawCmp(); };
    const op = el('input'); op.type = 'range'; op.min = 10; op.max = 100; op.value = Math.round(s.op * 100); op.title = 'плътност';
    op.oninput = () => { s.op = (+op.value) / 100; drawCmp(); };
    row.append(dot, nm, vis, op);
    row.onclick = ev => {
      if (ev.target === vis || ev.target === op) return;
      const first = lettersOf(lb).find(l => l.sampleId === sid);
      if (first) { state.selLetter = first.id; updateAlignSel(); buildLegend(); drawCmp(); }
    };
    box.appendChild(row);
  }
}
function updateAlignSel() {
  const l = state.letters.find(x => x.id === state.selLetter);
  $('#alignSel').textContent = l ? '— избран: ' + sampleById(l.sampleId).name : '';
}

/* ---- рисуване на сравнението ---- */
let cmpHits = []; // за хит-тест при влачене
function drawCmp() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  const letters = curCmpLetters().filter(l => sampleById(l.sampleId).vis);
  cmpHits = [];
  if (!letters.length) {
    cmpCanvas.width = 640; cmpCanvas.height = 300;
    mctx.clearRect(0, 0, 640, 300); mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, 640, 300);
    mctx.fillStyle = '#999'; mctx.font = '16px Segoe UI'; mctx.textAlign = 'center';
    mctx.fillText('Няма видими букви за този знак.', 320, 150); mctx.textAlign = 'left';
    return;
  }
  if (mode === 'overlay') drawOverlay(letters); else drawRow(letters);
}

function drawOverlay(letters) {
  // ред на рисуване: първо сравнителните (полупрозрачни, отдолу),
  // после ТЕСТОВИЯТ черен плътно отгоре — еталонът се чете ясно, а цветните
  // части, които стърчат извън черното, са отклоненията.
  letters = letters.slice().sort((a, b) => kindRank(b) - kindRank(a));
  // платно: центрирано, обща базова линия
  let maxW = 0;
  for (const l of letters) { tintLetter(l); const s = letterH / l.ink.h * l.place.sc; maxW = Math.max(maxW, l.ink.w * s); }
  const W = Math.max(400, Math.round(maxW * 1.6 + 160));
  const H = Math.round(letterH * 2.0 + 60);
  cmpCanvas.width = W; cmpCanvas.height = H;
  mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, W, H);
  const baseY = Math.round(H * 0.72), cx = Math.round(W / 2);
  // водачи
  mctx.strokeStyle = '#eee'; mctx.lineWidth = 1;
  mctx.beginPath(); mctx.moveTo(0, baseY); mctx.lineTo(W, baseY); mctx.stroke();
  mctx.beginPath(); mctx.moveTo(cx, 0); mctx.lineTo(cx, H); mctx.stroke();

  for (const l of letters) {
    const s = sampleById(l.sampleId);
    const t = tintLetter(l);
    const sc = (letterH / l.ink.h) * l.place.sc;
    const tx = cx + l.place.dx, ty = baseY + l.place.dy;
    mctx.save();
    mctx.globalAlpha = s.op;
    mctx.translate(tx, ty); mctx.rotate(l.place.rot); mctx.scale(sc, sc);
    mctx.drawImage(t, -(l.ink.x + l.ink.w / 2), -(l.ink.y + l.ink.h));
    mctx.restore();
    // хит-правоъгълник (екранни координати)
    const halfW = l.ink.w / 2 * sc, hgt = l.ink.h * sc;
    cmpHits.push({ id: l.id, x0: tx - halfW, y0: ty - hgt, x1: tx + halfW, y1: ty });
    if (l.id === state.selLetter) {
      mctx.strokeStyle = '#4a9eff'; mctx.setLineDash([5, 4]); mctx.lineWidth = 1.5;
      mctx.strokeRect(tx - halfW, ty - hgt, halfW * 2, hgt); mctx.setLineDash([]);
    }
  }
}

function drawRow(letters) {
  const gap = 28, pad = 24;
  const dims = letters.map(l => { tintLetter(l); const sc = (letterH / l.ink.h) * l.place.sc; return { l, sc, w: l.ink.w * sc, h: l.ink.h * sc }; });
  const W = Math.max(400, Math.round(pad * 2 + dims.reduce((a, d) => a + d.w, 0) + gap * (dims.length - 1)));
  const H = Math.round(letterH * 1.5 + 70);
  cmpCanvas.width = W; cmpCanvas.height = H;
  mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, W, H);
  const baseY = Math.round(H * 0.68);
  mctx.strokeStyle = '#eee'; mctx.beginPath(); mctx.moveTo(0, baseY); mctx.lineTo(W, baseY); mctx.stroke();
  let x = pad;
  for (const d of dims) {
    const l = d.l, s = sampleById(l.sampleId), t = tintLetter(l);
    mctx.save(); mctx.globalAlpha = s.op;
    mctx.translate(x + d.w / 2 + l.place.dx, baseY + l.place.dy); mctx.rotate(l.place.rot); mctx.scale(d.sc, d.sc);
    mctx.drawImage(t, -(l.ink.x + l.ink.w / 2), -(l.ink.y + l.ink.h));
    mctx.restore();
    // надпис на образеца под буквата
    mctx.fillStyle = s.color; mctx.font = '13px Segoe UI'; mctx.textAlign = 'center';
    mctx.fillText((s.kind === 'test' ? '◆ ' : '') + s.name, x + d.w / 2, baseY + 24);
    cmpHits.push({ id: l.id, x0: x, y0: baseY - d.h, x1: x + d.w, y1: baseY });
    if (l.id === state.selLetter) { mctx.strokeStyle = '#4a9eff'; mctx.setLineDash([5, 4]); mctx.strokeRect(x, baseY - d.h, d.w, d.h); mctx.setLineDash([]); }
    x += d.w + gap;
  }
  mctx.textAlign = 'left';
}

/* влачене за подравняване върху платното */
let cdrag = null;
function cmpToCanvas(ev) {
  const r = cmpCanvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * cmpCanvas.width / r.width, y: (ev.clientY - r.top) * cmpCanvas.height / r.height };
}
cmpCanvas.onmousedown = ev => {
  const p = cmpToCanvas(ev);
  const hit = [...cmpHits].reverse().find(h => p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1);
  if (hit) { state.selLetter = hit.id; updateAlignSel(); buildLegend();
    const l = state.letters.find(x => x.id === hit.id);
    cdrag = { id: hit.id, px: p.x, py: p.y, dx0: l.place.dx, dy0: l.place.dy }; drawCmp(); }
};
window.addEventListener('mousemove', ev => {
  if (!cdrag) return; const p = cmpToCanvas(ev);
  const l = state.letters.find(x => x.id === cdrag.id); if (!l) return;
  l.place.dx = cdrag.dx0 + (p.x - cdrag.px); l.place.dy = cdrag.dy0 + (p.y - cdrag.py); drawCmp();
});
window.addEventListener('mouseup', () => { cdrag = null; });

/* бутони за подравняване */
document.querySelectorAll('.align [data-nudge]').forEach(b => b.onclick = () => {
  const l = state.letters.find(x => x.id === state.selLetter);
  if (!l) { return; }
  const n = b.dataset.nudge, step = 4;
  if (n === 'up') l.place.dy -= step; if (n === 'down') l.place.dy += step;
  if (n === 'left') l.place.dx -= step; if (n === 'right') l.place.dx += step;
  if (n === 'bigger') l.place.sc *= 1.05; if (n === 'smaller') l.place.sc /= 1.05;
  if (n === 'rotl') l.place.rot -= 0.035; if (n === 'rotr') l.place.rot += 0.035;
  drawCmp();
});
$('#btnAutoAlign').onclick = () => {
  const lb = $('#cmpLabel').value;
  for (const l of lettersOf(lb)) l.place = { dx: 0, dy: 0, sc: 1, rot: 0 };
  state.selLetter = null; updateAlignSel(); drawCmp();
};

/* износ като PNG */
$('#btnExport').onclick = () => {
  const lb = $('#cmpLabel').value || 'bukva';
  const a = el('a'); a.download = 'pocherk-' + lb + '-' + Date.now() + '.png';
  a.href = cmpCanvas.toDataURL('image/png'); a.click();
};

/* ========================================================================== *
 *  ТАБОВЕ
 * ========================================================================== */
$('#tabCut').onclick = () => switchTab('cut');
$('#tabCmp').onclick = () => switchTab('cmp');
function switchTab(t) {
  $('#tabCut').classList.toggle('active', t === 'cut');
  $('#tabCmp').classList.toggle('active', t === 'cmp');
  $('#viewCut').classList.toggle('active', t === 'cut');
  $('#viewCmp').classList.toggle('active', t === 'cmp');
  if (t === 'cmp') { rebuildCmpLabels(); }
}

/* ========================================================================== *
 *  СТАТИСТИКА + ЗАПИС/ЗАРЕЖДАНЕ НА ПРОЕКТ
 * ========================================================================== */
function refreshStats() {
  $('#statSamples').textContent = state.samples.length;
  $('#statLetters').textContent = state.letters.length;
  $('#statLabels').textContent = new Set(state.letters.map(l => l.label).filter(x => x !== '?')).size;
}

$('#btnSave').onclick = () => {
  const data = {
    v: 1,
    samples: state.samples.map(s => ({ id: s.id, name: s.name, kind: s.kind, color: s.color, dataUrl: s.dataUrl, thr: s.thr, vis: s.vis, op: s.op })),
    letters: state.letters.map(l => ({ id: l.id, sampleId: l.sampleId, label: l.label, x: l.x, y: l.y, w: l.w, h: l.h, place: l.place })),
    seq,
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = el('a'); a.download = 'pocherk-ekspertiza-' + Date.now() + '.json'; a.href = URL.createObjectURL(blob); a.click();
};
$('#btnLoad').onclick = () => $('#fileProj').click();
$('#fileProj').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const txt = await f.text();
  let data; try { data = JSON.parse(txt); } catch { alert('Невалиден файл.'); return; }
  state.samples = []; state.letters = [];
  for (const s of data.samples) {
    const img = await loadImg(s.dataUrl);
    state.samples.push({ ...s, img });
  }
  for (const l of data.letters) state.letters.push({ ...l, ink: null, _tint: null, place: l.place || { dx: 0, dy: 0, sc: 1, rot: 0 } });
  for (const l of state.letters) computeInk(l);
  seq = data.seq || seq;
  state.selSample = state.samples[0] ? state.samples[0].id : null;
  renderSamples(); if (state.selSample) selectSample(state.selSample);
  renderCuts(); refreshStats(); rebuildCmpLabels();
};
$('#btnNew').onclick = () => {
  if (state.samples.length && !confirm('Да изчистя ли всичко?')) return;
  state.samples = []; state.letters = []; state.selSample = null; state.selLetter = null;
  renderSamples(); drawCutCanvas(); renderCuts(); refreshStats(); rebuildCmpLabels();
};

/* ========================================================================== *
 *  СТАРТ
 * ========================================================================== */
buildAlphabet(); renderSamples(); renderCuts(); refreshStats(); rebuildCmpLabels();
setLabel('а');
