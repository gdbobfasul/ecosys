// Version: 1.0020
// r3-straighten.js — „Изправяне" (перспектива/трапец) за 3D Rotate. Изцяло на устройството (2D платно).
// Снимка на документ, дъска, фасада, екран, снимана под ъгъл → влачиш 4-те ъгъла върху обекта →
// „Изправи" → изравнена, правоъгълна снимка (проективна трансформация = хомография, обратно
// картографиране с билинейно семплиране). После сравнение ПРЕДИ/СЛЕД с плъзгач и запис PNG/JPG.
import { t, tf, register } from '../core/i18n.js';
import { pickBinaryFile } from '../core/filepick.js';
import { saveFile } from '../core/filesave.js';

register({
  rs_hint:     { bg:'Влачи 4-те ъгъла върху документа/дъската/фасадата, после „Изправи". Всичко става на устройството.', ru:'Перетащи 4 угла на документ/доску/фасад, затем «Выровнять». Всё на устройстве.', uk:'Перетягни 4 кути на документ/дошку/фасад, потім «Вирівняти». Усе на пристрої.', en:'Drag the 4 corners onto the document/board/facade, then “Straighten”. Everything runs on your device.', de:'Zieh die 4 Ecken auf Dokument/Tafel/Fassade, dann „Begradigen“. Alles auf dem Gerät.', fr:'Place les 4 coins sur le document/tableau/façade, puis « Redresser ». Tout se passe sur l’appareil.', es:'Arrastra las 4 esquinas sobre el documento/pizarra/fachada y pulsa «Enderezar». Todo en el dispositivo.', 'es-MX':'Arrastra las 4 esquinas sobre el documento/pizarrón/fachada y pulsa «Enderezar». Todo en el dispositivo.', it:'Trascina i 4 angoli su documento/lavagna/facciata, poi «Raddrizza». Tutto sul dispositivo.', pt:'Arrasta os 4 cantos para o documento/quadro/fachada e toca em «Endireitar». Tudo no dispositivo.', ar:'اسحب الزوايا الأربع إلى المستند/اللوح/الواجهة ثم «تقويم». كل شيء على جهازك.', hi:'4 कोनों को दस्तावेज़/बोर्ड/भवन पर खींचें, फिर “सीधा करें”। सब कुछ डिवाइस पर।', ja:'4つの角を書類・ボード・建物に合わせてドラッグし、「補正」を押します。すべて端末上で処理。', ky:'4 бурчту документке/доскага/фасадга сүйрөп, «Түздөө» бас. Баары түзмөктө.', 'zh-Hant':'將 4 個角拖到文件／白板／建築上，然後按「校正」。全部在裝置上執行。' },
  rs_go:       { bg:'Изправи', ru:'Выровнять', uk:'Вирівняти', en:'Straighten', de:'Begradigen', fr:'Redresser', es:'Enderezar', 'es-MX':'Enderezar', it:'Raddrizza', pt:'Endireitar', ar:'تقويم', hi:'सीधा करें', ja:'補正', ky:'Түздөө', 'zh-Hant':'校正' },
  rs_corners:  { bg:'Нулирай ъглите', ru:'Сбросить углы', uk:'Скинути кути', en:'Reset corners', de:'Ecken zurücksetzen', fr:'Réinitialiser les coins', es:'Restablecer esquinas', 'es-MX':'Restablecer esquinas', it:'Reimposta angoli', pt:'Repor cantos', ar:'إعادة الزوايا', hi:'कोने रीसेट करें', ja:'角をリセット', ky:'Бурчтарды баштапкы', 'zh-Hant':'重設角點' },
  rs_edit:     { bg:'Редактирай ъглите', ru:'Изменить углы', uk:'Змінити кути', en:'Edit corners', de:'Ecken bearbeiten', fr:'Modifier les coins', es:'Editar esquinas', 'es-MX':'Editar esquinas', it:'Modifica angoli', pt:'Editar cantos', ar:'تعديل الزوايا', hi:'कोने संपादित करें', ja:'角を編集', ky:'Бурчтарды өзгөртүү', 'zh-Hant':'編輯角點' },
  rs_compare:  { bg:'Преди / след — плъзни', ru:'До / после — двигай', uk:'До / після — рухай', en:'Before / after — slide', de:'Vorher / nachher — schieben', fr:'Avant / après — glisser', es:'Antes / después — desliza', 'es-MX':'Antes / después — desliza', it:'Prima / dopo — scorri', pt:'Antes / depois — desliza', ar:'قبل / بعد — اسحب', hi:'पहले / बाद — स्लाइड करें', ja:'補正前 / 後 — スライド', ky:'Чейин / кийин — жылдыр', 'zh-Hant':'前 / 後 — 滑動比較' },
  rs_save_png: { bg:'Запази PNG', ru:'Сохранить PNG', uk:'Зберегти PNG', en:'Save PNG', de:'PNG speichern', fr:'Enregistrer PNG', es:'Guardar PNG', 'es-MX':'Guardar PNG', it:'Salva PNG', pt:'Guardar PNG', ar:'حفظ PNG', hi:'PNG सहेजें', ja:'PNGを保存', ky:'PNG сактоо', 'zh-Hant':'儲存 PNG' },
  rs_save_jpg: { bg:'Запази JPG', ru:'Сохранить JPG', uk:'Зберегти JPG', en:'Save JPG', de:'JPG speichern', fr:'Enregistrer JPG', es:'Guardar JPG', 'es-MX':'Guardar JPG', it:'Salva JPG', pt:'Guardar JPG', ar:'حفظ JPG', hi:'JPG सहेजें', ja:'JPGを保存', ky:'JPG сактоо', 'zh-Hant':'儲存 JPG' },
  rs_result:   { bg:'Изправено: {0}×{1} px', ru:'Выровнено: {0}×{1} px', uk:'Вирівняно: {0}×{1} px', en:'Straightened: {0}×{1} px', de:'Begradigt: {0}×{1} px', fr:'Redressé : {0}×{1} px', es:'Enderezado: {0}×{1} px', 'es-MX':'Enderezado: {0}×{1} px', it:'Raddrizzato: {0}×{1} px', pt:'Endireitado: {0}×{1} px', ar:'تم التقويم: {0}×{1} بكسل', hi:'सीधा किया: {0}×{1} px', ja:'補正済み: {0}×{1} px', ky:'Түздөлдү: {0}×{1} px', 'zh-Hant':'已校正：{0}×{1} px' },
  rs_working:  { bg:'Изправям…', ru:'Выравниваю…', uk:'Вирівнюю…', en:'Straightening…', de:'Begradige…', fr:'Redressement…', es:'Enderezando…', 'es-MX':'Enderezando…', it:'Raddrizzo…', pt:'A endireitar…', ar:'جارٍ التقويم…', hi:'सीधा कर रहा…', ja:'補正中…', ky:'Түздөлүүдө…', 'zh-Hant':'校正中…' },
  rs_bad_quad: { bg:'Ъглите се пресичат — подреди ги като четириъгълник.', ru:'Углы пересекаются — расположи их четырёхугольником.', uk:'Кути перетинаються — розташуй їх чотирикутником.', en:'The corners cross — arrange them as a quadrilateral.', de:'Die Ecken kreuzen sich — als Viereck anordnen.', fr:'Les coins se croisent — dispose-les en quadrilatère.', es:'Las esquinas se cruzan — colócalas como cuadrilátero.', 'es-MX':'Las esquinas se cruzan — colócalas como cuadrilátero.', it:'Gli angoli si incrociano — disponili come quadrilatero.', pt:'Os cantos cruzam-se — dispõe-nos como quadrilátero.', ar:'الزوايا متقاطعة — رتّبها كشكل رباعي.', hi:'कोने एक-दूसरे को काटते हैं — चतुर्भुज की तरह रखें।', ja:'角が交差しています — 四角形になるよう配置してください。', ky:'Бурчтар кесилишет — төрт бурчтук кылып жайгаштыр.', 'zh-Hant':'角點交叉 — 請排成四邊形。' }
});

// ── Хомография: единичен квадрат (u,v ∈ 0..1) → четириъгълник p0(0,0) p1(1,0) p2(1,1) p3(0,1) ──
function squareToQuad(p) {
  const [x0, y0] = p[0], [x1, y1] = p[1], [x2, y2] = p[2], [x3, y3] = p[3];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-9) return null;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
}
// Изпъкнал ли е четириъгълникът (всички завои в една посока)?
function isConvex(p) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-6) continue;
    if (!sign) sign = z > 0 ? 1 : -1; else if ((z > 0 ? 1 : -1) !== sign) return false;
  }
  return sign !== 0;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Снимката → пиксели (ограничена до MAX по дългата страна, за памет/скорост на телефон).
function imageData(img, MAX) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const s = Math.min(1, MAX / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
  return { data: cx.getImageData(0, 0, w, h).data, w, h, scale: s };
}

// Изправяне: p = 4 ъгъла в координати на ОРИГИНАЛА. Връща платно с резултата.
export function straighten(img, corners) {
  const src = imageData(img, 2000);
  const p = corners.map((c) => [c[0] * src.scale, c[1] * src.scale]);
  const H = squareToQuad(p);
  if (!H) return null;
  // Размер на резултата = средни дължини на срещуположните страни (в пиксели на източника).
  let W = Math.round((dist(p[0], p[1]) + dist(p[3], p[2])) / 2);
  let Hh = Math.round((dist(p[0], p[3]) + dist(p[1], p[2])) / 2);
  const cap = Math.min(1, 1600 / Math.max(W, Hh, 1));
  W = Math.max(8, Math.round(W * cap)); Hh = Math.max(8, Math.round(Hh * cap));
  const out = new Uint8ClampedArray(W * Hh * 4);
  const sd = src.data, sw = src.w, sh = src.h;
  for (let y = 0; y < Hh; y++) {
    const v = (y + 0.5) / Hh;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const den = H.g * u + H.h * v + 1;
      const sx = (H.a * u + H.b * v + H.c) / den - 0.5;
      const sy = (H.d * u + H.e * v + H.f) / den - 0.5;
      const o = (y * W + x) * 4;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) { out[o] = out[o+1] = out[o+2] = 255; out[o+3] = 255; continue; }
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      out[o]   = sd[i00]   * w00 + sd[i10]   * w10 + sd[i01]   * w01 + sd[i11]   * w11;
      out[o+1] = sd[i00+1] * w00 + sd[i10+1] * w10 + sd[i01+1] * w01 + sd[i11+1] * w11;
      out[o+2] = sd[i00+2] * w00 + sd[i10+2] * w10 + sd[i01+2] * w01 + sd[i11+2] * w11;
      out[o+3] = 255;
    }
  }
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  c.getContext('2d').putImageData(new ImageData(out, W, Hh), 0, 0);
  return c;
}

// ── Екранът „Изправяне": stage = кутия за платното, pane = бутоните. getImage() → текущата снимка. ──
export function mountStraighten({ stage, pane, getImage, pickImage, flash }) {
  stage.innerHTML = `
    <canvas id="rsEdit" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>
    <div id="rsCmp" style="position:absolute;inset:0;display:none">
      <canvas id="rsA" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
      <div id="rsClip" style="position:absolute;inset:0;overflow:hidden;width:50%"><canvas id="rsB" style="position:absolute;top:0;left:0;height:100%"></canvas></div>
      <div id="rsLine" style="position:absolute;top:0;bottom:0;left:50%;width:2px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.6)"></div>
    </div>`;
  pane.innerHTML = `
    <p class="hint">${t('rs_hint')}</p>
    <button class="btn" id="rsPick">📁 ${t('r3_pick')}</button>
    <div id="rsEditBtns" style="display:flex;gap:8px;margin-top:10px">
      <button class="btn" id="rsCorners" style="flex:1;background:#5b6472;margin-top:0">${t('rs_corners')}</button>
      <button class="btn" id="rsGo" style="flex:2;margin-top:0">📐 ${t('rs_go')}</button>
    </div>
    <div id="rsCmpBtns" style="display:none">
      <label style="margin-top:10px">${t('rs_compare')}</label>
      <input type="range" id="rsSlide" min="0" max="100" value="50" />
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" id="rsBack" style="flex:1;background:#5b6472;margin-top:0">${t('rs_edit')}</button>
        <button class="btn" id="rsPng" style="flex:1;margin-top:0">💾 ${t('rs_save_png')}</button>
        <button class="btn" id="rsJpg" style="flex:1;margin-top:0">💾 ${t('rs_save_jpg')}</button>
      </div>
    </div>`;
  const $ = (s) => pane.querySelector(s) || stage.querySelector(s);
  const edit = $('#rsEdit'), cmp = $('#rsCmp'), cA = $('#rsA'), cB = $('#rsB'), clip = $('#rsClip'), line = $('#rsLine');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let img = null, corners = null, result = null, fit = null, drag = -1;

  // Разположение на снимката в платното (побрана, центрирана).
  function computeFit() {
    const bw = stage.clientWidth || 360, bh = stage.clientHeight || bw;
    edit.width = Math.round(bw * DPR); edit.height = Math.round(bh * DPR);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.min(bw / iw, bh / ih) * 0.94;
    fit = { s, ox: (bw - iw * s) / 2, oy: (bh - ih * s) / 2, bw, bh };
  }
  function resetCorners() {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const mx = iw * 0.12, my = ih * 0.12;
    corners = [[mx, my], [iw - mx, my], [iw - mx, ih - my], [mx, ih - my]];
  }
  function toScreen(p) { return [fit.ox + p[0] * fit.s, fit.oy + p[1] * fit.s]; }
  function drawEdit() {
    if (!img || !fit) return;
    const cx = edit.getContext('2d');
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.clearRect(0, 0, fit.bw, fit.bh);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    cx.drawImage(img, fit.ox, fit.oy, iw * fit.s, ih * fit.s);
    // затъмнение извън четириъгълника
    const sc = corners.map(toScreen);
    cx.save();
    cx.beginPath(); cx.rect(0, 0, fit.bw, fit.bh);
    cx.moveTo(sc[0][0], sc[0][1]); for (let i = 3; i >= 1; i--) cx.lineTo(sc[i][0], sc[i][1]); cx.closePath();
    cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fill('evenodd'); cx.restore();
    // контур + ъгли
    cx.beginPath(); cx.moveTo(sc[0][0], sc[0][1]); for (let i = 1; i < 4; i++) cx.lineTo(sc[i][0], sc[i][1]); cx.closePath();
    cx.lineWidth = 2; cx.strokeStyle = '#2f7d32'; cx.stroke();
    sc.forEach((p, i) => {
      cx.beginPath(); cx.arc(p[0], p[1], drag === i ? 16 : 12, 0, Math.PI * 2);
      cx.fillStyle = 'rgba(47,125,50,.9)'; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = '#fff'; cx.stroke();
    });
  }
  function showEdit() {
    cmp.style.display = 'none'; edit.style.display = ''; $('#rsCmpBtns').style.display = 'none'; $('#rsEditBtns').style.display = 'flex';
    if (img) { computeFit(); drawEdit(); }
  }
  // Сравнение: двете снимки побрани в ЕДНАКВА кутия; горният слой се реже по плъзгача.
  function drawCompare() {
    const bw = stage.clientWidth || 360, bh = stage.clientHeight || bw;
    [cA, cB].forEach((c) => { c.width = Math.round(bw * DPR); c.height = Math.round(bh * DPR); c.style.width = bw + 'px'; });
    const put = (c, src, w, h) => {
      const cx = c.getContext('2d'); cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, bw, bh);
      const s = Math.min(bw / w, bh / h) * 0.94; cx.drawImage(src, (bw - w * s) / 2, (bh - h * s) / 2, w * s, h * s);
    };
    put(cA, img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    put(cB, result, result.width, result.height);
  }
  function showCompare() {
    edit.style.display = 'none'; cmp.style.display = ''; $('#rsEditBtns').style.display = 'none'; $('#rsCmpBtns').style.display = '';
    drawCompare(); setSlide($('#rsSlide').value);
  }
  function setSlide(v) { clip.style.width = v + '%'; line.style.left = v + '%'; }

  // влачене на ъгъл
  const pos = (e) => { const r = edit.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  edit.addEventListener('pointerdown', (e) => {
    if (!img) return; e.preventDefault();
    const [x, y] = pos(e); let best = -1, bd = 28;
    corners.map(toScreen).forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    drag = best; try { edit.setPointerCapture(e.pointerId); } catch (_) {} drawEdit();
  });
  edit.addEventListener('pointermove', (e) => {
    if (drag < 0 || !img) return; e.preventDefault();
    const [x, y] = pos(e);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    corners[drag] = [Math.max(0, Math.min(iw, (x - fit.ox) / fit.s)), Math.max(0, Math.min(ih, (y - fit.oy) / fit.s))];
    drawEdit();
  });
  const endDrag = (e) => { if (drag < 0) return; try { edit.releasePointerCapture(e.pointerId); } catch (_) {} drag = -1; drawEdit(); };
  edit.addEventListener('pointerup', endDrag); edit.addEventListener('pointercancel', endDrag);

  $('#rsPick').addEventListener('click', async () => { const im = await pickImage(); if (im) setImage(im); });
  $('#rsCorners').addEventListener('click', () => { if (!img) return; resetCorners(); drawEdit(); });
  $('#rsGo').addEventListener('click', () => {
    if (!img) { flash(t('r3_pick_first'), true); return; }
    if (!isConvex(corners)) { flash(t('rs_bad_quad'), true); return; }
    flash(t('rs_working'));
    setTimeout(() => {
      try { result = straighten(img, corners); } catch (e) { result = null; }
      if (!result) { flash(t('rs_bad_quad'), true); return; }
      flash(tf('rs_result', result.width, result.height)); showCompare();
    }, 30);
  });
  $('#rsSlide').addEventListener('input', (e) => setSlide(e.target.value));
  $('#rsBack').addEventListener('click', showEdit);
  const save = (type, ext) => {
    if (!result) return;
    let c = result;
    if (type === 'image/jpeg') { c = document.createElement('canvas'); c.width = result.width; c.height = result.height; const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(result, 0, 0); }
    c.toBlob(async (blob) => { if (!blob) return; await saveFile('pupikes-straight-' + Date.now() + '.' + ext, blob, type); flash(tf('r3_saved', ext.toUpperCase())); }, type, 0.92);
  };
  $('#rsPng').addEventListener('click', () => save('image/png', 'png'));
  $('#rsJpg').addEventListener('click', () => save('image/jpeg', 'jpg'));

  function setImage(im) { img = im; result = null; resetCorners(); showEdit(); }
  // При отваряне на таба: взима текущата снимка от 3D (ако е сменена) и преначертава.
  function activate() {
    const im = getImage();
    if (im && im !== img) setImage(im); else if (img) { if (result && cmp.style.display !== 'none') showCompare(); else showEdit(); }
  }
  return { activate, setImage };
}
