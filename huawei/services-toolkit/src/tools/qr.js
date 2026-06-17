// QR код — генериране (qrcode npm) + четене от файл/камера (jsqr npm).
// Изцяло на устройството, без мрежа.
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { esc, downloadBlob } from '../core/ui.js';

export const title = 'QR код';

export function render(root) {
  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="gen">Генерирай</button>
      <button class="tab" data-tab="read">Разчети</button>
    </div>
    <div class="tool-card" data-panel="gen">
      <label>Текст или URL за кодиране</label>
      <textarea id="gentext" placeholder="https://example.com или произволен текст"></textarea>
      <div class="row">
        <div>
          <label>Размер</label>
          <select id="gensize">
            <option value="200">Малък (200px)</option>
            <option value="300" selected>Среден (300px)</option>
            <option value="500">Голям (500px)</option>
          </select>
        </div>
        <div>
          <label>Корекция на грешки</label>
          <select id="genecc">
            <option value="L">Ниска (L)</option>
            <option value="M" selected>Средна (M)</option>
            <option value="Q">Висока (Q)</option>
            <option value="H">Максимална (H)</option>
          </select>
        </div>
      </div>
      <button class="btn" id="genbtn">Генерирай</button>
      <div class="center" id="genresult"></div>
    </div>
    <div class="tool-card" data-panel="read" style="display:none">
      <p class="hint">Качи снимка с QR код или сканирай с камерата — текстът/линкът се разчита на устройството.</p>
      <label>Качи изображение с QR код</label>
      <input type="file" id="readfile" accept="image/*" />
      <button class="btn" id="decodebtn">Разчети от файл</button>
      <div class="row" style="margin-top:14px">
        <button class="btn sec" id="cambtn">Сканирай с камера</button>
        <button class="btn sec" id="camstop">Спри камерата</button>
      </div>
      <div class="center" id="camwrap" style="display:none;margin-top:12px"><video id="cam" playsinline></video></div>
      <div class="readout" id="readout" style="display:none"></div>
    </div>
  `;

  const $ = (s) => root.querySelector(s);

  // --- табове ---
  root.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const which = t.dataset.tab;
      root.querySelectorAll('[data-panel]').forEach((p) => {
        p.style.display = p.dataset.panel === which ? 'block' : 'none';
      });
      if (which !== 'read') stopCam();
    });
  });

  // --- генериране ---
  $('#genbtn').addEventListener('click', async () => {
    const txt = $('#gentext').value;
    const box = $('#genresult');
    if (!txt || !txt.trim()) { box.innerHTML = '<p style="color:var(--err)">Въведи текст или URL.</p>'; return; }
    const size = parseInt($('#gensize').value, 10) || 300;
    const ecc = $('#genecc').value;
    const canvas = document.createElement('canvas');
    try {
      await QRCode.toCanvas(canvas, txt, { width: size, errorCorrectionLevel: ecc, margin: 1 });
    } catch (e) {
      box.innerHTML = '<p style="color:var(--err)">Текстът е твърде дълъг за този размер/ниво. Опитай по-голям размер или ниво „L".</p>';
      return;
    }
    box.innerHTML = '<div class="qr-out"></div><button class="btn" id="dlqr">Свали PNG</button>';
    box.querySelector('.qr-out').appendChild(canvas);
    box.querySelector('#dlqr').addEventListener('click', () => {
      canvas.toBlob((b) => b && downloadBlob(b, 'qr-code.png'), 'image/png');
    });
  });

  // --- четене от файл ---
  $('#decodebtn').addEventListener('click', () => {
    const f = $('#readfile').files && $('#readfile').files[0];
    if (!f) { showReadout(null, 'Първо прикачи изображение.'); return; }
    showReadout(null, 'Разчитам…');
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(d.data, d.width, d.height);
        showReadout(code ? code.data : null);
      } catch (e) {
        showReadout(null, 'Грешка при разчитане: ' + e.message);
      }
    };
    img.onerror = () => showReadout(null, 'Изображението не може да се зареди.');
    img.src = URL.createObjectURL(f);
  });

  // --- камера ---
  let camStream = null, camRAF = null;
  $('#cambtn').addEventListener('click', startCam);
  $('#camstop').addEventListener('click', stopCam);

  async function startCam() {
    const v = $('#cam');
    $('#camwrap').style.display = 'block';
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      v.srcObject = camStream; await v.play();
      scanLoop();
    } catch (e) {
      $('#camwrap').style.display = 'none';
      showReadout(null, 'Камерата не е достъпна: ' + e.message);
    }
  }
  function stopCam() {
    if (camRAF) cancelAnimationFrame(camRAF);
    if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; }
    $('#camwrap').style.display = 'none';
  }
  function scanLoop() {
    const v = $('#cam');
    if (!camStream) return;
    if (v.readyState === v.HAVE_ENOUGH_DATA) {
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(d.data, d.width, d.height);
      if (code) { showReadout(code.data); stopCam(); return; }
    }
    camRAF = requestAnimationFrame(scanLoop);
  }

  function showReadout(data, customEmpty) {
    const box = $('#readout');
    box.style.display = 'block';
    if (!data) {
      box.className = 'readout empty';
      box.textContent = customEmpty || 'QR код не е разпознат.';
      return;
    }
    box.className = 'readout';
    const isUrl = /^https?:\/\//i.test(data);
    const safe = esc(data);
    box.innerHTML = '<strong>Съдържание:</strong><br>' +
      (isUrl
        ? `<a href="${safe}" target="_blank" rel="noopener">${safe}</a><br><span class="hint">Това е линк.</span>`
        : `<span>${safe}</span><br><span class="hint">Това е текст.</span>`);
  }

  // спри камерата при напускане на изгледа
  window.addEventListener('hashchange', stopCam, { once: true });
}
