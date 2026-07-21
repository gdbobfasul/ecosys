// Version: 1.0001
// rotate3d.js — Pupikes Toolkit 3D Rotate. Зарежда картинка и я показва като 3D обект
// (плосък текстуриран quad в перспектива) през WebGL. 4 оси; ЗАДЪРЖАНЕ на бутон = бавно
// въртене в реално време, ПУСКАНЕ = спира. „Запази" → нов PNG файл (телефон: реален файл +
// Споделяне, браузър: сваляне). Всичко на устройството — картинката не се качва никъде.
import { t, tf, register } from '../core/i18n.js';
import { pickBinaryFile } from '../core/filepick.js';
import { saveFile } from '../core/filesave.js';

register({
  r3_pick:       { bg:'Избери изображение', ru:'Выберите изображение', uk:'Виберіть зображення', en:'Choose an image', de:'Bild auswählen', fr:'Choisir une image', es:'Elegir imagen', 'es-MX':'Elegir imagen', it:'Scegli un’immagine', pt:'Escolher imagem', ar:'اختر صورة', hi:'छवि चुनें', ja:'画像を選択', ky:'Сүрөт тандаңыз', 'zh-Hant':'選擇圖片' },
  r3_hint:       { bg:'Задръж бутон за ос — картинката се върти бавно; пусни — спира. Всичко става на устройството.', ru:'Удерживай ось — изображение медленно вращается; отпусти — остановится. Всё на устройстве.', uk:'Утримуй вісь — зображення повільно обертається; відпусти — зупиниться. Усе на пристрої.', en:'Hold an axis to rotate slowly; release to stop. Everything runs on your device.', de:'Achse gedrückt halten — das Bild dreht sich langsam; loslassen — es stoppt. Alles auf dem Gerät.', fr:'Maintiens un axe — l’image tourne lentement ; relâche pour arrêter. Tout se passe sur l’appareil.', es:'Mantén un eje — la imagen gira despacio; suelta para parar. Todo en el dispositivo.', 'es-MX':'Mantén un eje — la imagen gira despacio; suelta para parar. Todo en el dispositivo.', it:'Tieni premuto un asse — l’immagine ruota lentamente; rilascia per fermarla. Tutto sul dispositivo.', pt:'Mantém um eixo — a imagem gira devagar; solta para parar. Tudo no dispositivo.', ar:'اضغط مع الاستمرار على محور — تدور الصورة ببطء؛ اترك لتتوقف. كل شيء على جهازك.', hi:'किसी अक्ष को दबाए रखें — छवि धीरे घूमती है; छोड़ें तो रुक जाती है। सब कुछ डिवाइस पर।', ja:'軸を押し続けると画像がゆっくり回転、離すと停止。すべて端末上で動作。', ky:'Октту басып тур — сүрөт жай айланат; кое бер — токтойт. Баары түзмөктө.', 'zh-Hant':'按住某個軸，圖片會緩慢旋轉；放開即停止。全部在裝置上執行。' },
  r3_axis_h:     { bg:'Хоризонтална ос', ru:'Горизонтальная ось', uk:'Горизонтальна вісь', en:'Horizontal axis', de:'Horizontale Achse', fr:'Axe horizontal', es:'Eje horizontal', 'es-MX':'Eje horizontal', it:'Asse orizzontale', pt:'Eixo horizontal', ar:'محور أفقي', hi:'क्षैतिज अक्ष', ja:'水平軸', ky:'Горизонталдык ок', 'zh-Hant':'水平軸' },
  r3_axis_v:     { bg:'Вертикална ос', ru:'Вертикальная ось', uk:'Вертикальна вісь', en:'Vertical axis', de:'Vertikale Achse', fr:'Axe vertical', es:'Eje vertical', 'es-MX':'Eje vertical', it:'Asse verticale', pt:'Eixo vertical', ar:'محور رأسي', hi:'ऊर्ध्वाधर अक्ष', ja:'垂直軸', ky:'Вертикалдык ок', 'zh-Hant':'垂直軸' },
  r3_axis_28:    { bg:'Ос 2–8 ч.', ru:'Ось 2–8 ч.', uk:'Вісь 2–8 год.', en:'2–8 o’clock axis', de:'Achse 2–8 Uhr', fr:'Axe 2–8 h', es:'Eje 2–8 h', 'es-MX':'Eje 2–8 h', it:'Asse 2–8', pt:'Eixo 2–8 h', ar:'محور 2–8', hi:'2–8 बजे अक्ष', ja:'2–8時の軸', ky:'2–8 саат огу', 'zh-Hant':'2–8 點軸' },
  r3_axis_104:   { bg:'Ос 10–4 ч.', ru:'Ось 10–4 ч.', uk:'Вісь 10–4 год.', en:'10–4 o’clock axis', de:'Achse 10–4 Uhr', fr:'Axe 10–4 h', es:'Eje 10–4 h', 'es-MX':'Eje 10–4 h', it:'Asse 10–4', pt:'Eixo 10–4 h', ar:'محور 10–4', hi:'10–4 बजे अक्ष', ja:'10–4時の軸', ky:'10–4 саат огу', 'zh-Hant':'10–4 點軸' },
  r3_reset:      { bg:'Нулирай', ru:'Сбросить', uk:'Скинути', en:'Reset', de:'Zurücksetzen', fr:'Réinitialiser', es:'Restablecer', 'es-MX':'Restablecer', it:'Reimposta', pt:'Repor', ar:'إعادة تعيين', hi:'रीसेट', ja:'リセット', ky:'Баштапкы абалга', 'zh-Hant':'重設' },
  r3_save:       { bg:'Запази', ru:'Сохранить', uk:'Зберегти', en:'Save', de:'Speichern', fr:'Enregistrer', es:'Guardar', 'es-MX':'Guardar', it:'Salva', pt:'Guardar', ar:'حفظ', hi:'सहेजें', ja:'保存', ky:'Сактоо', 'zh-Hant':'儲存' },
  r3_pick_first: { bg:'Първо избери изображение.', ru:'Сначала выберите изображение.', uk:'Спершу виберіть зображення.', en:'Choose an image first.', de:'Wähle zuerst ein Bild.', fr:'Choisis d’abord une image.', es:'Primero elige una imagen.', 'es-MX':'Primero elige una imagen.', it:'Scegli prima un’immagine.', pt:'Escolhe primeiro uma imagem.', ar:'اختر صورة أولاً.', hi:'पहले एक छवि चुनें।', ja:'まず画像を選択してください。', ky:'Адегенде сүрөт тандаңыз.', 'zh-Hant':'請先選擇圖片。' },
  r3_saved:      { bg:'Запазено ({0})', ru:'Сохранено ({0})', uk:'Збережено ({0})', en:'Saved ({0})', de:'Gespeichert ({0})', fr:'Enregistré ({0})', es:'Guardado ({0})', 'es-MX':'Guardado ({0})', it:'Salvato ({0})', pt:'Guardado ({0})', ar:'تم الحفظ ({0})', hi:'सहेजा गया ({0})', ja:'保存しました（{0}）', ky:'Сакталды ({0})', 'zh-Hant':'已儲存（{0}）' },
  r3_nogl:       { bg:'WebGL не се поддържа тук.', ru:'WebGL здесь не поддерживается.', uk:'WebGL тут не підтримується.', en:'WebGL is not supported here.', de:'WebGL wird hier nicht unterstützt.', fr:'WebGL n’est pas pris en charge ici.', es:'WebGL no es compatible aquí.', 'es-MX':'WebGL no es compatible aquí.', it:'WebGL non è supportato qui.', pt:'WebGL não é suportado aqui.', ar:'WebGL غير مدعوم هنا.', hi:'यहाँ WebGL समर्थित नहीं है।', ja:'ここではWebGLがサポートされていません。', ky:'Бул жерде WebGL колдоого алынбайт.', 'zh-Hant':'此處不支援 WebGL。' }
});

export const title = t('t_rotate3d_name');

// ── Минимални mat4 помощници (column-major, като WebGL) ──────────────────────
function mIdent() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function mMul(a, b) { // връща a·b (прилага се към колонен вектор като (a·b)·v)
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
  }
  return o;
}
function mPerspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [ f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0 ];
}
function mTranslate(x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; }
function mRotAxis(ax, ay, az, rad) { // въртене около произволна ос (нормализира се)
  const len = Math.hypot(ax, ay, az) || 1, x = ax/len, y = ay/len, z = az/len;
  const c = Math.cos(rad), s = Math.sin(rad), tt = 1 - c;
  return [
    tt*x*x + c,    tt*x*y + s*z,  tt*x*z - s*y,  0,
    tt*x*y - s*z,  tt*y*y + c,    tt*y*z + s*x,  0,
    tt*x*z + s*y,  tt*y*z - s*x,  tt*z*z + c,    0,
    0, 0, 0, 1
  ];
}

const VERT = 'attribute vec2 aPos; attribute vec2 aUv; uniform mat4 uMVP; varying vec2 vUv;' +
  'void main(){ vUv = aUv; gl_Position = uMVP * vec4(aPos, 0.0, 1.0); }';
const FRAG = 'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
  'void main(){ gl_FragColor = texture2D(uTex, vUv); }';

function compile(gl, type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
  return sh;
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <div id="r3wrap" style="position:relative;width:100%;max-width:420px;margin:0 auto;aspect-ratio:1/1;border-radius:14px;overflow:hidden;
        background:conic-gradient(#e9edf3 90deg,#f6f8fb 0 180deg,#e9edf3 0 270deg,#f6f8fb 0) 0 0/28px 28px;border:1px solid #d7dde8">
        <canvas id="r3cv" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>
      </div>
      <p class="hint">${t('r3_hint')}</p>
      <button class="btn" id="r3pick">📁 ${t('r3_pick')}</button>
      <div id="r3axes" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
        <button class="btn axb" data-ax="h"   style="touch-action:none">↕ ${t('r3_axis_h')}</button>
        <button class="btn axb" data-ax="v"   style="touch-action:none">↔ ${t('r3_axis_v')}</button>
        <button class="btn axb" data-ax="28"  style="touch-action:none">⤢ ${t('r3_axis_28')}</button>
        <button class="btn axb" data-ax="104" style="touch-action:none">⤡ ${t('r3_axis_104')}</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" id="r3reset" style="flex:1;background:#5b6472">↺ ${t('r3_reset')}</button>
        <button class="btn" id="r3save"  style="flex:2">💾 ${t('r3_save')}</button>
      </div>
      <div class="save-msg" id="r3msg" style="min-height:18px;margin-top:8px"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  const canvas = $('#r3cv'), msg = $('#r3msg');
  canvas.width = 900; canvas.height = 900;

  let gl;
  try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true }); } catch (e) {}
  if (!gl) { msg.style.color = '#c0392b'; msg.textContent = t('r3_nogl'); return; }

  // Програма + буфери (позиции + UV; попълват се при зареждане на картинка)
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aUv  = gl.getAttribLocation(prog, 'aUv');
  const uMVP = gl.getUniformLocation(prog, 'uMVP');
  const posBuf = gl.createBuffer(), uvBuf = gl.createBuffer();
  const tex = gl.createTexture();

  gl.viewport(0, 0, 900, 900);
  gl.clearColor(0, 0, 0, 0);
  gl.disable(gl.CULL_FACE);          // виждаме и „гърба" на картата при обръщане
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const persp = mPerspective(40 * Math.PI / 180, 1, 0.1, 100);
  const view  = mTranslate(0, 0, -3.2);
  let orient = mIdent();
  let texReady = false;

  // UV: (0,0)=долу ляво; ползваме FLIP_Y при качване, за да съвпадне с картинката.
  const UVS = new Float32Array([0,0, 1,0, 0,1, 1,1]);

  function setQuad(imgW, imgH) {
    const asp = imgW / imgH;
    let qw = 0.9, qh = 0.9;
    if (asp >= 1) qh = 0.9 / asp; else qw = 0.9 * asp;
    const P = new Float32Array([-qw,-qh, qw,-qh, -qw,qh, qw,qh]);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, UVS, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
  }

  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!texReady) return;
    const mvp = mMul(mMul(persp, view), orient);
    gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function loadImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      setQuad(img.naturalWidth || img.width, img.naturalHeight || img.height);
      orient = mIdent(); texReady = true; draw();
    };
    img.src = dataUrl;
  }

  // ── въртене при задържане на бутон ──
  // Оси в WebGL координати (Y нагоре): хоризонтална=X, вертикална=Y,
  // 2–8 ч.=диагонал (1,1,0), 10–4 ч.=диагонал (1,-1,0).
  const AXES = { h: [1,0,0], v: [0,1,0], '28': [1,1,0], '104': [1,-1,0] };
  const SPEED = 0.6; // rad/сек ≈ 34°/сек — бавно
  let active = null, raf = 0, lastT = 0;
  function frame(ts) {
    if (!active) { raf = 0; lastT = 0; return; }
    if (!lastT) lastT = ts;
    const dt = Math.min((ts - lastT) / 1000, 0.05); lastT = ts;
    orient = mMul(mRotAxis(active[0], active[1], active[2], SPEED * dt), orient);
    draw();
    raf = requestAnimationFrame(frame);
  }
  function startAxis(key) { if (!texReady) { flash(t('r3_pick_first')); return; } active = AXES[key]; lastT = 0; if (!raf) raf = requestAnimationFrame(frame); }
  function stopAxis() { active = null; lastT = 0; }

  root.querySelectorAll('.axb').forEach((b) => {
    const key = b.getAttribute('data-ax');
    const down = (e) => { e.preventDefault(); startAxis(key); };
    const up = (e) => { if (e) e.preventDefault(); stopAxis(); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
  });

  function flash(text, err) { msg.style.color = err ? '#c0392b' : '#2e7d32'; msg.textContent = text; }

  $('#r3pick').addEventListener('click', async () => {
    const f = await pickBinaryFile('image/*');
    if (!f || !f.dataUrl) return;
    loadImage(f.dataUrl); msg.textContent = '';
  });
  $('#r3reset').addEventListener('click', () => { orient = mIdent(); draw(); });
  $('#r3save').addEventListener('click', () => {
    if (!texReady) { flash(t('r3_pick_first'), true); return; }
    draw(); // гарантирай текущия кадър в буфера
    canvas.toBlob(async (blob) => {
      if (!blob) { flash(t('r3_nogl'), true); return; }
      await saveFile('pupikes-3d-' + Date.now() + '.png', blob, 'image/png');
      flash(tf('r3_saved', 'PNG'));
    }, 'image/png');
  });

  draw(); // празен прозрачен кадър в началото
}
