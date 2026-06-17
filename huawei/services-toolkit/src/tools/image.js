// Компресор на снимки — изцяло през canvas, без качване.
import { downloadBlob, fmtSize } from '../core/ui.js';

export const title = 'Компресор на снимки';

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>Избери изображение</label>
      <input type="file" id="file" accept="image/jpeg,image/png,image/webp" />
      <label>Качество: <span id="qval">75%</span></label>
      <input type="range" id="quality" min="10" max="100" value="75" />
      <label>Изходен формат</label>
      <select id="format">
        <option value="image/jpeg">JPEG — най-малък размер</option>
        <option value="image/webp">WebP — модерен, добро качество</option>
        <option value="image/png">PNG — без загуба (за графики)</option>
      </select>
      <label>Максимална ширина (px, 0 = запази оригинала)</label>
      <input type="number" id="maxw" value="0" min="0" />
      <p class="hint">Компресията се прави изцяло на устройството — снимката не се качва никъде.</p>
      <button class="btn" id="go">Компресирай</button>
      <div class="cmp" id="cmp" style="display:none">
        <div><div>Оригинал</div><img id="origImg" /><div class="sz" id="origSz"></div></div>
        <div><div>Компресирано</div><img id="compImg" /><div class="sz" id="compSz"></div>
          <button class="btn" id="dl">Свали</button></div>
      </div>
      <div class="save-msg" id="save"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  let origFile = null, compBlob = null;

  $('#quality').addEventListener('input', (e) => { $('#qval').textContent = e.target.value + '%'; });
  $('#file').addEventListener('change', () => { origFile = $('#file').files[0] || null; });

  $('#go').addEventListener('click', () => {
    if (!origFile) { alert('Първо избери изображение.'); return; }
    const img = new Image();
    img.onload = () => {
      const maxw = parseInt($('#maxw').value, 10) || 0;
      let w = img.width, h = img.height;
      if (maxw > 0 && w > maxw) { h = Math.round(h * maxw / w); w = maxw; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const fmt = $('#format').value;
      const q = parseInt($('#quality').value, 10) / 100;
      c.toBlob((blob) => {
        if (!blob) { $('#save').textContent = 'Този формат не се поддържа на устройството.'; return; }
        compBlob = blob;
        $('#cmp').style.display = 'flex';
        $('#origImg').src = URL.createObjectURL(origFile);
        $('#compImg').src = URL.createObjectURL(blob);
        $('#origSz').textContent = fmtSize(origFile.size);
        $('#compSz').textContent = fmtSize(blob.size);
        const saved = 100 - Math.round(blob.size / origFile.size * 100);
        $('#save').textContent = saved > 0 ? ('Спестени ' + saved + '% от размера') : 'Без намаление (опитай по-ниско качество).';
      }, fmt, q);
    };
    img.src = URL.createObjectURL(origFile);
  });

  $('#dl').addEventListener('click', () => {
    if (!compBlob) return;
    const ext = $('#format').value.split('/')[1];
    downloadBlob(compBlob, 'compressed.' + ext);
  });
}
