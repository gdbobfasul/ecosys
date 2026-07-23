// Version: 1.0002
// rotate3d.js — Pupikes Toolkit 3D Rotate. Зарежда картинка и я върти в 3D през WebGL.
// 4 оси; ЗАДЪРЖАНЕ на бутон = бавно въртене в реално време, ПУСКАНЕ = спира. „Запази" → PNG.
// Всичко на устройството — картинката не се качва никъде.
//
// РЕЖИМИ на обем (по искане — картинката да не изглежда като лист хартия):
//   • Плоско  — плосък quad (както досега).
//   • Обем (Метод 1) — картинката се ИЗДЪЛБАВА в плочка с дебелина: лице + гръб + странични
//                       ръбове (цвят = средният цвят на снимката) → има реален обем при въртене.
//   • Релеф (Метод 2) — от яркостта на снимката се гради КАРТА НА ВИСОЧИНИТЕ (по-светлото
//                       изпъква) → истински 3D релеф със сенки; при въртене се вижда обемът.
//
// Въртенето се пази като КВАТЕРНИОН (нормализира се всеки кадър) → няма натрупване на грешка,
// осите остават точни колкото и да въртиш (по-рано матрицата „плуваше" след много въртения).
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
  r3_nogl:       { bg:'WebGL не се поддържа тук.', ru:'WebGL здесь не поддерживается.', uk:'WebGL тут не підтримується.', en:'WebGL is not supported here.', de:'WebGL wird hier nicht unterstützt.', fr:'WebGL n’est pas pris en charge ici.', es:'WebGL no es compatible aquí.', 'es-MX':'WebGL no es compatible aquí.', it:'WebGL non è supportato qui.', pt:'WebGL não é suportado aqui.', ar:'WebGL غير مدعوم هنا.', hi:'यहाँ WebGL समर्थित नहीं है।', ja:'ここではWebGLがサポートされていません。', ky:'Бул жерде WebGL колдоого алынбайт.', 'zh-Hant':'此處不支援 WebGL。' },
  r3_mode:       { bg:'Обем', ru:'Объём', uk:'Обʼєм', en:'Depth', de:'Tiefe', fr:'Volume', es:'Volumen', 'es-MX':'Volumen', it:'Volume', pt:'Volume', ar:'العمق', hi:'गहराई', ja:'立体', ky:'Көлөм', 'zh-Hant':'立體' },
  r3_mode_flat:  { bg:'Плоско', ru:'Плоско', uk:'Плоско', en:'Flat', de:'Flach', fr:'Plat', es:'Plano', 'es-MX':'Plano', it:'Piatto', pt:'Plano', ar:'مسطّح', hi:'सपाट', ja:'平面', ky:'Түз', 'zh-Hant':'平面' },
  r3_mode_slab:  { bg:'Обем', ru:'Объём', uk:'Обʼєм', en:'Volume', de:'Volumen', fr:'Volume', es:'Volumen', 'es-MX':'Volumen', it:'Volume', pt:'Volume', ar:'حجم', hi:'आयतन', ja:'厚み', ky:'Көлөм', 'zh-Hant':'厚度' },
  r3_mode_relief:{ bg:'Релеф', ru:'Рельеф', uk:'Рельєф', en:'Relief', de:'Relief', fr:'Relief', es:'Relieve', 'es-MX':'Relieve', it:'Rilievo', pt:'Relevo', ar:'نتوء', hi:'उभार', ja:'レリーフ', ky:'Рельеф', 'zh-Hant':'浮雕' }
});

export const title = t('t_rotate3d_name');

// ── Минимални mat4 помощници (column-major, като WebGL) ──────────────────────
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

// ── Ориентация като КВАТЕРНИОН [x,y,z,w] — стабилна (без натрупване на грешка) ─────────────
function qIdent() { return [0, 0, 0, 1]; }
function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0]/l, q[1]/l, q[2]/l, q[3]/l]; }
function qMul(a, b) { // a ⊗ b
  return [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
  ];
}
// Завърта q около ЕКРАННА ос (ax,ay,az) на ъгъл rad — ПРЕ-умножение (осите остават екранни).
function qRotateWorld(q, ax, ay, az, rad) {
  const len = Math.hypot(ax, ay, az) || 1, s = Math.sin(rad/2);
  const dq = [ (ax/len)*s, (ay/len)*s, (az/len)*s, Math.cos(rad/2) ];
  return qNorm(qMul(dq, q));
}
// Кватернион → mat4 (column-major)
function qMat(q) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const xx = x*x, yy = y*y, zz = z*z, xy = x*y, xz = x*z, yz = y*z, wx = w*x, wy = w*y, wz = w*z;
  return [
    1-2*(yy+zz), 2*(xy+wz),   2*(xz-wy),   0,
    2*(xy-wz),   1-2*(xx+zz), 2*(yz+wx),   0,
    2*(xz+wy),   2*(yz-wx),   1-2*(xx+yy), 0,
    0, 0, 0, 1
  ];
}

const VERT = 'attribute vec3 aPos; attribute vec2 aUv; attribute float aShade;' +
  'uniform mat4 uMVP; varying vec2 vUv; varying float vShade;' +
  'void main(){ vUv = aUv; vShade = aShade; gl_Position = uMVP * vec4(aPos, 1.0); }';
const FRAG = 'precision mediump float; varying vec2 vUv; varying float vShade;' +
  'uniform sampler2D uTex; uniform float uUseTex; uniform vec3 uSolid;' +
  'void main(){ vec4 c = mix(vec4(uSolid,1.0), texture2D(uTex, vUv), uUseTex); gl_FragColor = vec4(c.rgb*vShade, c.a); }';

function compile(gl, type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
  return sh;
}

// ── Помощници за анализ на снимката (среден цвят + карта на височините за релефа) ──
function imgPixels(img, size) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, size, size);
  return cx.getImageData(0, 0, size, size).data;
}
function avgColor(img) {
  const d = imgPixels(img, 16); let r = 0, g = 0, b = 0, n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
  return [ (r/n)/255, (g/n)/255, (b/n)/255 ];
}
// Мрежа яркости G×G, ОБЪРНАТА по Y (за да съвпадне с FLIP_Y текстурата: ред 0 = долу).
function lumGrid(img, G) {
  const d = imgPixels(img, G); const out = new Float32Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const src = ((G - 1 - j) * G + i) * 4;                      // канвасът е отгоре-надолу
    out[j * G + i] = (0.299*d[src] + 0.587*d[src+1] + 0.114*d[src+2]) / 255;
  }
  return out;
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card" style="user-select:none;-webkit-user-select:none;-webkit-touch-callout:none">
      <div id="r3wrap" style="position:relative;width:100%;max-width:420px;margin:0 auto;aspect-ratio:1/1;border-radius:14px;overflow:hidden;
        background:conic-gradient(#e9edf3 90deg,#f6f8fb 0 180deg,#e9edf3 0 270deg,#f6f8fb 0) 0 0/28px 28px;border:1px solid #d7dde8">
        <canvas id="r3cv" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>
      </div>
      <p class="hint">${t('r3_hint')}</p>
      <button class="btn" id="r3pick">📁 ${t('r3_pick')}</button>
      <div id="r3modes" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px">
        <button class="btn modeb" data-m="0">▭ ${t('r3_mode_flat')}</button>
        <button class="btn modeb" data-m="1">🧊 ${t('r3_mode_slab')}</button>
        <button class="btn modeb" data-m="2">⛰ ${t('r3_mode_relief')}</button>
      </div>
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

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aUv  = gl.getAttribLocation(prog, 'aUv');
  const aShade = gl.getAttribLocation(prog, 'aShade');
  const uMVP = gl.getUniformLocation(prog, 'uMVP');
  const uUseTex = gl.getUniformLocation(prog, 'uUseTex');
  const uSolid = gl.getUniformLocation(prog, 'uSolid');
  // Буфери: текстурираната част (лице/гръб/релеф) + плътната част (странични ръбове при „Обем").
  const bPos = gl.createBuffer(), bUv = gl.createBuffer(), bSh = gl.createBuffer(), bIdx = gl.createBuffer();
  const bsPos = gl.createBuffer(), bsSh = gl.createBuffer(), bsIdx = gl.createBuffer();
  let texCount = 0, solidCount = 0;
  const tex = gl.createTexture();

  gl.viewport(0, 0, 900, 900);
  gl.clearColor(0, 0, 0, 0);
  gl.disable(gl.CULL_FACE);          // виждаме и „гърба"
  gl.enable(gl.DEPTH_TEST);          // при обем/релеф лицата се подреждат правилно по дълбочина
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const persp = mPerspective(40 * Math.PI / 180, 1, 0.1, 100);
  const view  = mTranslate(0, 0, -3.2);
  let q = qIdent();
  let texReady = false;
  let mode = 1;                      // 0=плоско, 1=обем (Метод 1), 2=релеф (Метод 2)
  let curImg = null, curSolid = [0.8, 0.8, 0.82];

  const HALF = 0.9;                  // половин размер на най-дългата страна
  const THICK = 0.05;                // половин дебелина на плочката (Метод 1)
  const RELIEF = 0.22;               // амплитуда на релефа (Метод 2)
  const GRID = 96;                   // резолюция на релефната мрежа

  function quadSize(imgW, imgH) {
    const asp = imgW / imgH; let qw = HALF, qh = HALF;
    if (asp >= 1) qh = HALF / asp; else qw = HALF * asp;
    return [qw, qh];
  }

  // ── Построяване на геометрията според режима ──
  function buildFlat(qw, qh) {
    const pos = new Float32Array([-qw,-qh,0,  qw,-qh,0,  -qw,qh,0,  qw,qh,0]);
    const uv  = new Float32Array([0,0, 1,0, 0,1, 1,1]);
    const sh  = new Float32Array([1, 1, 1, 1]);
    const idx = new Uint16Array([0,1,2, 2,1,3]);
    return { pos, uv, sh, idx, solidPos: null };
  }
  function buildSlab(qw, qh) {
    const h = THICK;
    // Лице (z=+h) и гръб (z=-h) — текстурирани.
    const pos = new Float32Array([
      -qw,-qh, h,  qw,-qh, h,  -qw,qh, h,  qw,qh, h,      // лице
      -qw,-qh,-h,  qw,-qh,-h,  -qw,qh,-h,  qw,qh,-h       // гръб
    ]);
    const uv = new Float32Array([0,0, 1,0, 0,1, 1,1,  0,0, 1,0, 0,1, 1,1]);
    const sh = new Float32Array([1,1,1,1, 0.92,0.92,0.92,0.92]);
    const idx = new Uint16Array([0,1,2, 2,1,3,  4,6,5, 5,6,7]);
    // Странични ръбове — плътен цвят (средният цвят на снимката), лека сянка за обем.
    const sp = new Float32Array([
      -qw,-qh, h,  qw,-qh, h,  qw,qh, h,  -qw,qh, h,       // 0..3 лицев ринг
      -qw,-qh,-h,  qw,-qh,-h,  qw,qh,-h,  -qw,qh,-h        // 4..7 заден ринг
    ]);
    const ssh = new Float32Array([0.8,0.8,0.8,0.8, 0.62,0.62,0.62,0.62]);
    const sidx = new Uint16Array([
      0,1,5, 5,4,0,   1,2,6, 6,5,1,   2,3,7, 7,6,2,   3,0,4, 4,7,3
    ]);
    return { pos, uv, sh, idx, solidPos: sp, solidSh: ssh, solidIdx: sidx };
  }
  function buildRelief(qw, qh) {
    const G = GRID, lum = curImg ? lumGrid(curImg, G) : new Float32Array(G * G);
    const n = G * G;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), sh = new Float32Array(n);
    const H = (i, j) => (lum[Math.max(0, Math.min(G-1, j)) * G + Math.max(0, Math.min(G-1, i))] - 0.5) * RELIEF;
    const dx = (2 * qw) / (G - 1), dy = (2 * qh) / (G - 1);
    const Lx = 0.35, Ly = 0.45, Lz = 0.82, Ll = Math.hypot(Lx, Ly, Lz);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const k = j * G + i, u = i / (G - 1), v = j / (G - 1);
      pos[k*3] = -qw + u * 2 * qw; pos[k*3+1] = -qh + v * 2 * qh; pos[k*3+2] = H(i, j);
      uv[k*2] = u; uv[k*2+1] = v;
      // Нормала от наклона на височинното поле → Ламбертова сянка (прави релефа видим).
      const nx = -(H(i+1, j) - H(i-1, j)) / (2 * dx);
      const ny = -(H(i, j+1) - H(i, j-1)) / (2 * dy);
      const nl = Math.hypot(nx, ny, 1) || 1;
      const d = (nx*Lx + ny*Ly + 1*Lz) / (nl * Ll);
      sh[k] = 0.55 + 0.5 * Math.max(0, d);
    }
    const idx = new Uint16Array((G - 1) * (G - 1) * 6); let p = 0;
    for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) {
      const a = j*G + i, b = a + 1, c = a + G, e = c + 1;
      idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = c; idx[p++] = b; idx[p++] = e;
    }
    return { pos, uv, sh, idx, solidPos: null };
  }

  function upload(buf, data) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); }
  function rebuild() {
    if (!curImg) { texCount = 0; solidCount = 0; return; }
    const [qw, qh] = quadSize(curImg.naturalWidth || curImg.width, curImg.naturalHeight || curImg.height);
    const g = mode === 2 ? buildRelief(qw, qh) : mode === 1 ? buildSlab(qw, qh) : buildFlat(qw, qh);
    upload(bPos, g.pos); upload(bUv, g.uv); upload(bSh, g.sh);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    texCount = g.idx.length;
    if (g.solidPos) {
      upload(bsPos, g.solidPos); upload(bsSh, g.solidSh);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bsIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.solidIdx, gl.STATIC_DRAW);
      solidCount = g.solidIdx.length;
    } else solidCount = 0;
  }

  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!texReady || !texCount) return;
    const mvp = mMul(mMul(persp, view), qMat(q));
    gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
    // Текстурирана част (лице/гръб/релеф)
    gl.enableVertexAttribArray(aUv);
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bSh); gl.enableVertexAttribArray(aShade); gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uUseTex, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx);
    gl.drawElements(gl.TRIANGLES, texCount, gl.UNSIGNED_SHORT, 0);
    // Плътни странични ръбове (само „Обем")
    if (solidCount) {
      gl.disableVertexAttribArray(aUv);          // константа (0,0) — без значение при uUseTex=0
      gl.bindBuffer(gl.ARRAY_BUFFER, bsPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bsSh); gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uUseTex, 0);
      gl.uniform3f(uSolid, curSolid[0], curSolid[1], curSolid[2]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bsIdx);
      gl.drawElements(gl.TRIANGLES, solidCount, gl.UNSIGNED_SHORT, 0);
    }
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
      curImg = img;
      try { curSolid = avgColor(img); } catch (e) { curSolid = [0.8, 0.8, 0.82]; }
      q = qIdent(); texReady = true; rebuild(); draw();
    };
    img.src = dataUrl;
  }

  // ── въртене при задържане на бутон (екранни оси, кватернион) ──
  const AXES = { h: [1,0,0], v: [0,1,0], '28': [1,1,0], '104': [1,-1,0] };
  const SPEED = 0.6; // rad/сек ≈ 34°/сек
  let active = null, raf = 0, lastT = 0;
  function frame(ts) {
    if (!active) { raf = 0; lastT = 0; return; }
    if (!lastT) lastT = ts;
    const dt = Math.min((ts - lastT) / 1000, 0.05); lastT = ts;
    q = qRotateWorld(q, active[0], active[1], active[2], SPEED * dt);
    draw();
    raf = requestAnimationFrame(frame);
  }
  function startAxis(key) { if (!texReady) { flash(t('r3_pick_first'), true); return; } active = AXES[key]; lastT = 0; if (!raf) raf = requestAnimationFrame(frame); }
  function stopAxis() { active = null; lastT = 0; }

  root.querySelectorAll('.axb').forEach((b) => {
    const key = b.getAttribute('data-ax');
    const down = (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} startAxis(key); };
    const up = (e) => { if (e) { e.preventDefault(); try { b.releasePointerCapture(e.pointerId); } catch (_) {} } stopAxis(); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault()); // без меню при дълго задържане
  });

  function flash(text, err) { msg.style.color = err ? '#c0392b' : '#2e7d32'; msg.textContent = text; }

  // ── режими (Плоско / Обем / Релеф) ──
  const modeBtns = root.querySelectorAll('.modeb');
  function paintModes() {
    modeBtns.forEach((b) => {
      const on = Number(b.getAttribute('data-m')) === mode;
      b.style.background = on ? '#2f7d32' : '';
      b.style.color = on ? '#fff' : '';
      b.style.fontWeight = on ? '700' : '';
    });
  }
  modeBtns.forEach((b) => b.addEventListener('click', () => {
    mode = Number(b.getAttribute('data-m')); paintModes();
    if (texReady) { rebuild(); draw(); }
  }));
  paintModes();

  $('#r3pick').addEventListener('click', async () => {
    const f = await pickBinaryFile('image/*');
    if (!f || !f.dataUrl) return;
    loadImage(f.dataUrl); msg.textContent = '';
  });
  $('#r3reset').addEventListener('click', () => { q = qIdent(); draw(); });
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
