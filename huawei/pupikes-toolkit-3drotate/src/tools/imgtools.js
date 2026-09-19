// Version: 1.0001
// imgtools.js — „🧰 Инструменти": 3 реални, НАПЪЛНО ОФЛАЙН инструмента за изображения през Canvas API.
// Няма мрежа — всичко се смята на устройството. Един споделен зареден образ за трите инструмента.
//   1) Трансформатор — завъртане 90/180/270°, огледало Х/В, жив преглед; резултат като data URL
//      (без <a download> — в webview е блокиран; показваме образа + бутон „Копирай като data URL").
//   2) Преоразмеряване — целева ширина (пази пропорцията), пречертава на Canvas, нови размери + прибл. размер.
//   3) Избор на цвят (пипетка) — клик върху образа → пикселен цвят → HEX/RGB, копиране.
// Етикетите са статично на български (по задание). Динамичните низове (размери/цветове/съобщения) са в JS.

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Зареждане на файл → HTMLImageElement (използва общия надежден избор на файл на апа).
function loadImg(dataUrl) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Неуспешно четене на изображението.'));
    im.src = dataUrl;
  });
}

// Копиране в клипборда с резервен вариант за webview без Clipboard API.
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

// Прибл. размер в четим вид.
function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
const toHex2 = (n) => ('0' + (n & 255).toString(16)).slice(-2);

export const title = 'Инструменти за изображения';

export function render(root) {
  // Споделено състояние — един образ за трите инструмента.
  const S = { img: null, name: '', rot: 0, flipH: false, flipV: false };

  root.innerHTML = `
    <div class="tool-card">
      <div class="tabs" id="itabs">
        <button class="tab active" data-tab="transform">🔄 Трансформатор</button>
        <button class="tab" data-tab="resize">📐 Преоразмеряване</button>
        <button class="tab" data-tab="pick">🎨 Цвят от образ</button>
      </div>

      <button class="btn" id="iload">📁 Зареди изображение</button>
      <div class="hint" id="iname">Няма зареден образ. Всичко се обработва на устройството — без интернет.</div>
      <div class="save-msg" id="imsg" style="min-height:18px"></div>

      <!-- 1) ТРАНСФОРМАТОР -->
      <div id="paneTransform">
        <p class="hint">Завърти или огледай изображението. Живият преглед е долу. Резултатът е data URL — задръж пръст върху образа за „Копирай/Запази изображение" или ползвай бутона.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px">
          <button class="btn sec" id="t_rot90"  style="margin-top:0">↻ Завърти 90°</button>
          <button class="btn sec" id="t_rot180" style="margin-top:0">⤴ Завърти 180°</button>
          <button class="btn sec" id="t_rot270" style="margin-top:0">↺ Завърти 270°</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px">
          <button class="btn sec" id="t_fliph" style="margin-top:0">↔ Огледало хоризонт.</button>
          <button class="btn sec" id="t_flipv" style="margin-top:0">↕ Огледало вертик.</button>
          <button class="btn sec" id="t_reset" style="margin-top:0;background:#5b6472;color:#fff">↺ Нулирай</button>
        </div>
        <div class="hint" id="t_state" style="margin-top:8px"></div>
        <div style="text-align:center;margin-top:10px">
          <img id="t_out" alt="Резултат" style="max-width:100%;max-height:340px;border-radius:12px;border:1px solid var(--line);display:none" />
        </div>
        <button class="btn" id="t_copy" style="display:none">📋 Копирай като data URL</button>
      </div>

      <!-- 2) ПРЕОРАЗМЕРЯВАНЕ -->
      <div id="paneResize" style="display:none">
        <p class="hint">Задай целева ширина — височината се изчислява автоматично, за да се запази пропорцията.</p>
        <label for="r_width">Целева ширина (px)</label>
        <input id="r_width" type="number" min="1" max="10000" step="1" placeholder="напр. 800" />
        <button class="btn" id="r_apply">📐 Преоразмери</button>
        <div class="out-block" id="r_info" style="display:none">
          <div class="line"><span>Оригинал</span><span id="r_orig">—</span></div>
          <div class="line"><span>Нови размери</span><span id="r_new">—</span></div>
          <div class="line"><span>Прибл. размер (PNG)</span><span id="r_size">—</span></div>
        </div>
        <div style="text-align:center;margin-top:10px">
          <img id="r_out" alt="Преоразмерен" style="max-width:100%;max-height:340px;border-radius:12px;border:1px solid var(--line);display:none" />
        </div>
        <button class="btn" id="r_copy" style="display:none">📋 Копирай като data URL</button>
      </div>

      <!-- 3) ПИПЕТКА -->
      <div id="panePick" style="display:none">
        <p class="hint">Докосни (или кликни) върху изображението, за да прочетеш цвета на пиксела.</p>
        <div style="text-align:center;margin-top:8px">
          <canvas id="p_cv" style="max-width:100%;max-height:340px;border-radius:12px;border:1px solid var(--line);cursor:crosshair;touch-action:none;display:none"></canvas>
          <div class="hint" id="p_empty">Зареди изображение, за да избереш цвят.</div>
        </div>
        <div class="out-block" id="p_info" style="display:none">
          <div class="line"><span>Проба</span><span id="p_swatch" style="width:60px;height:20px;border-radius:6px;border:1px solid var(--line)"></span></div>
          <div class="line"><span>HEX</span><span id="p_hex">—</span></div>
          <div class="line"><span>RGB</span><span id="p_rgb">—</span></div>
        </div>
        <button class="btn" id="p_copy" style="display:none">📋 Копирай HEX</button>
      </div>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const msg = $('#imsg');
  function flash(text, err) { msg.style.color = err ? 'var(--err)' : 'var(--ok)'; msg.textContent = text || ''; }
  const need = () => { if (!S.img) { flash('Първо зареди изображение.', true); return false; } return true; };

  // ── табове ──
  const panes = { transform: $('#paneTransform'), resize: $('#paneResize'), pick: $('#panePick') };
  function showTab(id) {
    root.querySelectorAll('#itabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    for (const k in panes) panes[k].style.display = k === id ? '' : 'none';
    flash('');
    if (id === 'pick') drawPick();
  }
  root.querySelectorAll('#itabs .tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ── споделено зареждане на изображение ──
  $('#iload').addEventListener('click', async () => {
    try {
      const { pickBinaryFile } = await import('../core/filepick.js');
      const f = await pickBinaryFile('image/*');
      if (!f || !f.dataUrl) return;
      const im = await loadImg(f.dataUrl);
      S.img = im; S.name = f.name || 'изображение';
      S.rot = 0; S.flipH = false; S.flipV = false;
      $('#iname').textContent = S.name + ' — ' + im.naturalWidth + '×' + im.naturalHeight + ' px';
      flash('Изображението е заредено.');
      renderTransform();
      $('#r_width').value = im.naturalWidth;
      $('#r_info').style.display = 'none'; $('#r_out').style.display = 'none'; $('#r_copy').style.display = 'none';
      $('#p_info').style.display = 'none'; $('#p_copy').style.display = 'none';
      drawPick();
    } catch (e) { flash(String(e && e.message || e), true); }
  });

  // ── 1) Трансформатор ──
  function renderTransform() {
    if (!S.img) { $('#t_out').style.display = 'none'; $('#t_copy').style.display = 'none'; $('#t_state').textContent = ''; return; }
    const w = S.img.naturalWidth, h = S.img.naturalHeight;
    const swap = S.rot === 90 || S.rot === 270;
    const cw = swap ? h : w, ch = swap ? w : h;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const cx = cv.getContext('2d');
    cx.save();
    cx.translate(cw / 2, ch / 2);
    cx.rotate(S.rot * Math.PI / 180);
    cx.scale(S.flipH ? -1 : 1, S.flipV ? -1 : 1);
    cx.drawImage(S.img, -w / 2, -h / 2);
    cx.restore();
    const url = cv.toDataURL('image/png');
    const out = $('#t_out');
    out.src = url; out.style.display = 'inline-block';
    $('#t_copy').style.display = ''; $('#t_copy').dataset.url = url;
    $('#t_state').textContent = 'Завъртане: ' + S.rot + '° · Огледало Х: ' + (S.flipH ? 'да' : 'не') + ' · Огледало В: ' + (S.flipV ? 'да' : 'не') + ' · ' + cw + '×' + ch + ' px';
  }
  $('#t_rot90').addEventListener('click', () => { if (!need()) return; S.rot = (S.rot + 90) % 360; renderTransform(); });
  $('#t_rot180').addEventListener('click', () => { if (!need()) return; S.rot = (S.rot + 180) % 360; renderTransform(); });
  $('#t_rot270').addEventListener('click', () => { if (!need()) return; S.rot = (S.rot + 270) % 360; renderTransform(); });
  $('#t_fliph').addEventListener('click', () => { if (!need()) return; S.flipH = !S.flipH; renderTransform(); });
  $('#t_flipv').addEventListener('click', () => { if (!need()) return; S.flipV = !S.flipV; renderTransform(); });
  $('#t_reset').addEventListener('click', () => { if (!need()) return; S.rot = 0; S.flipH = false; S.flipV = false; renderTransform(); flash('Нулирано.'); });
  $('#t_copy').addEventListener('click', async (e) => {
    const ok = await copyText(e.currentTarget.dataset.url || '');
    flash(ok ? 'Data URL е копиран в клипборда.' : 'Копирането не бе разрешено — задръж пръст върху образа.', !ok);
  });

  // ── 2) Преоразмеряване ──
  $('#r_apply').addEventListener('click', () => {
    if (!need()) return;
    const w = S.img.naturalWidth, h = S.img.naturalHeight;
    let tw = Math.round(Number($('#r_width').value));
    if (!tw || tw < 1) { flash('Въведи валидна ширина.', true); return; }
    tw = Math.min(tw, 10000);
    const th = Math.max(1, Math.round(tw * h / w));
    const cv = document.createElement('canvas');
    cv.width = tw; cv.height = th;
    const cx = cv.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(S.img, 0, 0, tw, th);
    const url = cv.toDataURL('image/png');
    $('#r_orig').textContent = w + '×' + h + ' px';
    $('#r_new').textContent = tw + '×' + th + ' px';
    // Прибл. размер от дължината на base64 частта на data URL.
    const b64 = url.indexOf(',') >= 0 ? url.slice(url.indexOf(',') + 1) : url;
    const bytes = Math.round(b64.length * 3 / 4);
    $('#r_size').textContent = '≈ ' + humanSize(bytes);
    $('#r_info').style.display = '';
    const out = $('#r_out'); out.src = url; out.style.display = 'inline-block';
    $('#r_copy').style.display = ''; $('#r_copy').dataset.url = url;
    flash('Преоразмерено до ' + tw + '×' + th + ' px.');
  });
  $('#r_copy').addEventListener('click', async (e) => {
    const ok = await copyText(e.currentTarget.dataset.url || '');
    flash(ok ? 'Data URL е копиран в клипборда.' : 'Копирането не бе разрешено — задръж пръст върху образа.', !ok);
  });

  // ── 3) Пипетка ──
  let pickData = null, pickW = 0, pickH = 0;
  function drawPick() {
    const cv = $('#p_cv'), empty = $('#p_empty');
    if (!S.img) { cv.style.display = 'none'; empty.style.display = ''; return; }
    empty.style.display = 'none'; cv.style.display = 'inline-block';
    // Рисуваме на вътрешна резолюция (капирана), за точно четене на пиксели.
    const max = 1600, w = S.img.naturalWidth, h = S.img.naturalHeight;
    const sc = Math.min(1, max / Math.max(w, h));
    pickW = Math.max(1, Math.round(w * sc)); pickH = Math.max(1, Math.round(h * sc));
    cv.width = pickW; cv.height = pickH;
    const cx = cv.getContext('2d');
    cx.drawImage(S.img, 0, 0, pickW, pickH);
    try { pickData = cx.getImageData(0, 0, pickW, pickH).data; } catch (e) { pickData = null; }
  }
  function readAt(clientX, clientY) {
    const cv = $('#p_cv');
    if (!pickData) return;
    const rect = cv.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / rect.width * pickW);
    const y = Math.floor((clientY - rect.top) / rect.height * pickH);
    if (x < 0 || y < 0 || x >= pickW || y >= pickH) return;
    const i = (y * pickW + x) * 4;
    const r = pickData[i], g = pickData[i + 1], b = pickData[i + 2];
    const hex = '#' + toHex2(r) + toHex2(g) + toHex2(b);
    const rgb = 'rgb(' + r + ', ' + g + ', ' + b + ')';
    $('#p_hex').textContent = hex.toUpperCase();
    $('#p_rgb').textContent = rgb;
    $('#p_swatch').style.background = hex;
    $('#p_info').style.display = '';
    $('#p_copy').style.display = ''; $('#p_copy').dataset.hex = hex.toUpperCase();
  }
  $('#p_cv').addEventListener('click', (e) => readAt(e.clientX, e.clientY));
  $('#p_cv').addEventListener('pointerdown', (e) => { e.preventDefault(); readAt(e.clientX, e.clientY); });
  $('#p_copy').addEventListener('click', async (e) => {
    const ok = await copyText(e.currentTarget.dataset.hex || '');
    flash(ok ? 'HEX е копиран: ' + (e.currentTarget.dataset.hex || '') : 'Копирането не бе разрешено.', !ok);
  });
}
