// PDF инструменти — сливане, разделяне, воден знак, визуален подпис.
// Изцяло офлайн: pdf-lib (редакция) + pdfjs-dist (рендиране на страница за подпис).
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { setStatus, downloadBlob } from '../core/ui.js';
// pdfjs worker — бандълва се локално чрез Vite ?url
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const title = 'PDF инструменти';

function parseRange(str, max) {
  const pages = [];
  str.split(',').forEach((part) => {
    part = part.trim();
    if (part.indexOf('-') > -1) {
      const [a, b] = part.split('-').map((x) => parseInt(x, 10));
      for (let i = a; i <= b; i++) if (i >= 1 && i <= max) pages.push(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= max) pages.push(n - 1);
    }
  });
  return pages;
}

export function render(root) {
  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="merge">Сливане</button>
      <button class="tab" data-tab="split">Разделяне</button>
      <button class="tab" data-tab="wm">Воден знак</button>
      <button class="tab" data-tab="sign">Подпис</button>
    </div>

    <div class="tool-card" data-panel="merge">
      <label>Избери няколко PDF файла (в реда за сливане)</label>
      <input type="file" id="mFiles" accept="application/pdf" multiple />
      <button class="btn" id="mBtn">Слей PDF</button>
      <div class="status" id="mStatus"></div>
    </div>

    <div class="tool-card" data-panel="split" style="display:none">
      <label>Избери PDF файл</label>
      <input type="file" id="sFile" accept="application/pdf" />
      <label>Страници за извличане (напр. 1-3,5,8)</label>
      <input type="text" id="sRange" placeholder="1-3,5,8" value="1" />
      <button class="btn" id="sBtn">Извлечи страници</button>
      <div class="status" id="sStatus"></div>
    </div>

    <div class="tool-card" data-panel="wm" style="display:none">
      <label>Избери PDF файл</label>
      <input type="file" id="wFile" accept="application/pdf" />
      <label>Текст на водния знак (латиница)</label>
      <input type="text" id="wText" value="CONFIDENTIAL" />
      <p class="hint">Вграденият стандартен шрифт поддържа латиница. За кирилица използвай латински текст.</p>
      <button class="btn" id="wBtn">Добави воден знак</button>
      <div class="status" id="wStatus"></div>
    </div>

    <div class="tool-card" data-panel="sign" style="display:none">
      <div class="notice"><b>Внимание:</b> това е визуален подпис (изображение върху PDF), НЕ е електронен/криптографски подпис и не е правно валиден е-подпис.</div>
      <h3 style="margin:14px 0 8px">Стъпка 1 — извлечи подпис от документ</h3>
      <label>PDF с подписа</label>
      <input type="file" id="sigSrc" accept="application/pdf" />
      <label>Страница с подписа</label>
      <input type="number" id="sigPage" value="1" min="1" />
      <button class="btn sec" id="showPage">Покажи страницата</button>
      <p class="hint">След като се покаже, очертай с пръст/мишка правоъгълник около подписа.</p>
      <div id="sigCanvasWrap" style="position:relative;display:none;overflow:auto;border:1px solid var(--line);border-radius:8px;margin-top:10px">
        <canvas id="sigCanvas" style="display:block;max-width:100%"></canvas>
        <div id="sigSel" style="position:absolute;border:2px dashed var(--err);background:rgba(248,81,73,.2);display:none;pointer-events:none"></div>
      </div>
      <button class="btn" id="cropBtn" style="display:none">Изрежи подписа</button>
      <div id="sigPreview" style="margin-top:10px"></div>

      <h3 style="margin:18px 0 8px">Стъпка 2 — постави подписа</h3>
      <label>PDF за подписване</label>
      <input type="file" id="tgtPdf" accept="application/pdf" />
      <label>Страница (1 = първа, -1 = последна)</label>
      <input type="number" id="tgtPage" value="-1" />
      <label>Размер (% от ширината)</label>
      <input type="number" id="sigScale" value="25" min="5" max="100" />
      <button class="btn" id="applySig">Постави подписа</button>
      <div class="status" id="signStatus"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  root.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach((p) => {
        p.style.display = p.dataset.panel === t.dataset.tab ? 'block' : 'none';
      });
    });
  });

  function save(bytes, name) { downloadBlob(bytes, name, 'application/pdf'); }

  // --- Сливане ---
  $('#mBtn').addEventListener('click', async () => {
    const files = $('#mFiles').files;
    if (files.length < 2) { setStatus($('#mStatus'), 'err', 'Избери поне 2 PDF файла.'); return; }
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const doc = await PDFDocument.load(await files[i].arrayBuffer());
        const pages = await out.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      save(await out.save(), 'merged.pdf');
      setStatus($('#mStatus'), 'ok', 'Готово — ' + files.length + ' файла слети.');
    } catch (e) { setStatus($('#mStatus'), 'err', 'Грешка: ' + e.message); }
  });

  // --- Разделяне ---
  $('#sBtn').addEventListener('click', async () => {
    const f = $('#sFile').files[0];
    if (!f) { setStatus($('#sStatus'), 'err', 'Избери PDF файл.'); return; }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      const idx = parseRange($('#sRange').value, doc.getPageCount());
      if (!idx.length) { setStatus($('#sStatus'), 'err', 'Невалиден диапазон.'); return; }
      const out = await PDFDocument.create();
      const pages = await out.copyPages(doc, idx);
      pages.forEach((p) => out.addPage(p));
      save(await out.save(), 'extracted.pdf');
      setStatus($('#sStatus'), 'ok', 'Готово — ' + idx.length + ' страници извлечени.');
    } catch (e) { setStatus($('#sStatus'), 'err', 'Грешка: ' + e.message); }
  });

  // --- Воден знак (StandardFont, латиница, офлайн) ---
  $('#wBtn').addEventListener('click', async () => {
    const f = $('#wFile').files[0];
    if (!f) { setStatus($('#wStatus'), 'err', 'Избери PDF файл.'); return; }
    const text = ($('#wText').value || 'CONFIDENTIAL').replace(/[^\x00-\xFF]/g, '?');
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const pages = doc.getPages();
      pages.forEach((page) => {
        const w = page.getWidth(), h = page.getHeight();
        const tw = font.widthOfTextAtSize(text, 42);
        page.drawText(text, {
          x: w / 2 - tw / 2, y: h / 2, size: 42, font,
          color: rgb(0.6, 0.6, 0.6), opacity: 0.35, rotate: degrees(45)
        });
      });
      save(await doc.save(), 'watermarked.pdf');
      setStatus($('#wStatus'), 'ok', 'Готово — воден знак на ' + pages.length + ' страници.');
    } catch (e) { setStatus($('#wStatus'), 'err', 'Грешка: ' + e.message); }
  });

  // --- Визуален подпис ---
  let sigCroppedDataURL = null, selStart = null;

  $('#showPage').addEventListener('click', async () => {
    const f = $('#sigSrc').files[0];
    if (!f) { setStatus($('#signStatus'), 'err', 'Избери PDF с подпис.'); return; }
    try {
      const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      const pageNum = Math.min(Math.max(parseInt($('#sigPage').value, 10) || 1, 1), pdf.numPages);
      const page = await pdf.getPage(pageNum);
      const vp = page.getViewport({ scale: 2 });
      const canvas = $('#sigCanvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      $('#sigCanvasWrap').style.display = 'block';
      $('#cropBtn').style.display = 'block';
      setupSelection();
      setStatus($('#signStatus'), 'ok', 'Страницата е заредена — очертай подписа.');
    } catch (e) { setStatus($('#signStatus'), 'err', 'Грешка: ' + e.message); }
  });

  function setupSelection() {
    const canvas = $('#sigCanvas'), sel = $('#sigSel');
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return { x: cx * (canvas.width / r.width), y: cy * (canvas.height / r.height), dx: cx, dy: cy };
    }
    function down(e) { e.preventDefault(); selStart = pos(e); sel.style.display = 'block'; }
    function move(e) {
      if (!selStart) return; e.preventDefault();
      const p = pos(e);
      const x = Math.min(selStart.dx, p.dx), y = Math.min(selStart.dy, p.dy);
      const w = Math.abs(p.dx - selStart.dx), h = Math.abs(p.dy - selStart.dy);
      sel.style.left = x + 'px'; sel.style.top = y + 'px';
      sel.style.width = w + 'px'; sel.style.height = h + 'px';
      sel._rect = { x: Math.min(selStart.x, p.x), y: Math.min(selStart.y, p.y), w: Math.abs(p.x - selStart.x), h: Math.abs(p.y - selStart.y) };
    }
    function up() { selStart = null; }
    canvas.onmousedown = down; canvas.onmousemove = move; window.addEventListener('mouseup', up);
    canvas.ontouchstart = down; canvas.ontouchmove = move; window.addEventListener('touchend', up);
  }

  $('#cropBtn').addEventListener('click', () => {
    const sel = $('#sigSel'); const r = sel._rect;
    if (!r || r.w < 5 || r.h < 5) { setStatus($('#signStatus'), 'err', 'Първо очертай правоъгълник.'); return; }
    const src = $('#sigCanvas');
    const c = document.createElement('canvas');
    c.width = Math.round(r.w); c.height = Math.round(r.h);
    c.getContext('2d').drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    sigCroppedDataURL = c.toDataURL('image/png');
    $('#sigPreview').innerHTML = '<p class="hint">Изрязан подпис:</p><img src="' + sigCroppedDataURL + '" style="max-width:260px;border:1px solid var(--line);border-radius:6px;background:#fff" />';
    setStatus($('#signStatus'), 'ok', 'Подписът е изрязан. Премини към Стъпка 2.');
  });

  $('#applySig').addEventListener('click', async () => {
    if (!sigCroppedDataURL) { setStatus($('#signStatus'), 'err', 'Първо изрежи подпис (Стъпка 1).'); return; }
    const f = $('#tgtPdf').files[0];
    if (!f) { setStatus($('#signStatus'), 'err', 'Избери PDF за подписване.'); return; }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      const pngBytes = await (await fetch(sigCroppedDataURL)).arrayBuffer();
      const png = await doc.embedPng(pngBytes);
      const pages = doc.getPages();
      let idx = parseInt($('#tgtPage').value, 10);
      if (idx === -1 || idx > pages.length) idx = pages.length;
      if (idx < 1) idx = 1;
      const page = pages[idx - 1];
      const pw = page.getWidth();
      const scalePct = Math.min(Math.max(parseInt($('#sigScale').value, 10) || 25, 5), 100) / 100;
      const imgW = pw * scalePct;
      const imgH = imgW * (png.height / png.width);
      page.drawImage(png, { x: pw - imgW - 40, y: 40, width: imgW, height: imgH });
      save(await doc.save(), 'signed.pdf');
      setStatus($('#signStatus'), 'ok', 'Подписът е поставен на страница ' + idx + '.');
    } catch (e) { setStatus($('#signStatus'), 'err', 'Грешка: ' + e.message); }
  });
}
