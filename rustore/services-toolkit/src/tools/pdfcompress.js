// Свиване на PDF — растеризира всяка страница с pdf.js, после сглобява нов PDF.
// Изцяло офлайн.
import { PDFDocument } from 'pdf-lib';
import { setStatus, downloadBlob, fmtSize } from '../core/ui.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const title = 'Свиване на PDF';

const LEVELS = {
  high:   { scale: 1.0, quality: 0.5 },
  medium: { scale: 1.3, quality: 0.65 },
  low:    { scale: 1.7, quality: 0.8 }
};

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>Избери PDF файл</label>
      <input type="file" id="pdfFile" accept="application/pdf" />
      <label>Ниво на свиване</label>
      <select id="level">
        <option value="high">Силно (най-малък размер)</option>
        <option value="medium" selected>Средно (баланс)</option>
        <option value="low">Леко (по-добро качество)</option>
      </select>
      <p class="hint">Всяка страница се преобразува в изображение. Работи най-добре за сканирани документи. Текстът става неизбираем (растеризира се).</p>
      <button class="btn" id="go">Свий PDF</button>
      <div class="bar" id="barWrap" style="display:none"><div id="bar"></div></div>
      <div class="status" id="status"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  $('#go').addEventListener('click', async () => {
    const f = $('#pdfFile').files[0];
    if (!f) { setStatus($('#status'), 'err', 'Избери PDF файл.'); return; }
    const cfg = LEVELS[$('#level').value] || LEVELS.medium;
    const origSize = f.size;
    const btn = $('#go'); btn.disabled = true;
    $('#barWrap').style.display = 'block';
    const bar = $('#bar');
    setStatus($('#status'), 'work', 'Обработвам…');
    try {
      const src = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      const out = await PDFDocument.create();
      const n = src.numPages;
      for (let i = 1; i <= n; i++) {
        const page = await src.getPage(i);
        const vp = page.getViewport({ scale: cfg.scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const jpgDataUrl = canvas.toDataURL('image/jpeg', cfg.quality);
        const jpgBytes = await (await fetch(jpgDataUrl)).arrayBuffer();
        const img = await out.embedJpg(jpgBytes);
        const p = out.addPage([canvas.width, canvas.height]);
        p.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        bar.style.width = Math.round(i / n * 100) + '%';
      }
      const bytes = await out.save();
      const newSize = bytes.length;
      downloadBlob(bytes, (f.name.replace(/\.pdf$/i, '') || 'document') + '-compressed.pdf', 'application/pdf');
      const pct = Math.round((1 - newSize / origSize) * 100);
      if (newSize < origSize) {
        setStatus($('#status'), 'ok', `Готово: ${fmtSize(origSize)} → ${fmtSize(newSize)} (−${pct}%). Файлът е свален.`);
      } else {
        setStatus($('#status'), 'ok', `${fmtSize(origSize)} → ${fmtSize(newSize)}. Този PDF вече е оптимизиран. Файлът е свален.`);
      }
    } catch (e) {
      setStatus($('#status'), 'err', 'Грешка: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });
}
