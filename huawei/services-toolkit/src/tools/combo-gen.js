// Version: 1.0000
// „Бърз генератор (данни)" (раздел „Комбинирани инструменти").
// Генерирай наведнъж по избран брой: UUID, случайни пароли, Lorem текст,
// случайни числа в диапазон, случайни дати в период. Изцяло на устройството — без мрежа.
import { esc, copyText } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  cbg_type:   { bg:'Какво да генерирам', ru:'Что генерировать', uk:'Що генерувати', en:'What to generate', de:'Was generieren', fr:'Quoi générer', es:'Qué generar', 'es-MX':'Qué generar', it:'Cosa generare', pt:'O que gerar', ar:'ماذا أولّد', hi:'क्या जनरेट करें', ja:'生成する対象', ky:'Эмнени түзүү', 'zh-Hant':'要產生什麼' },
  cbg_count:  { bg:'Брой: {0}', ru:'Количество: {0}', uk:'Кількість: {0}', en:'Count: {0}', de:'Anzahl: {0}', fr:'Nombre : {0}', es:'Cantidad: {0}', 'es-MX':'Cantidad: {0}', it:'Quantità: {0}', pt:'Quantidade: {0}', ar:'العدد: {0}', hi:'गिनती: {0}', ja:'個数: {0}', ky:'Саны: {0}', 'zh-Hant':'數量：{0}' },
  cbg_gen:    { bg:'Генерирай', ru:'Сгенерировать', uk:'Згенерувати', en:'Generate', de:'Erzeugen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'توليد', hi:'जनरेट', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  cbg_out:    { bg:'Резултат', ru:'Результат', uk:'Результат', en:'Result', de:'Ergebnis', fr:'Résultat', es:'Resultado', 'es-MX':'Resultado', it:'Risultato', pt:'Resultado', ar:'النتيجة', hi:'परिणाम', ja:'結果', ky:'Жыйынтык', 'zh-Hant':'結果' },
  cbg_copy:   { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
  cbg_uuid:   { bg:'UUID (v4)', ru:'UUID (v4)', uk:'UUID (v4)', en:'UUID (v4)', de:'UUID (v4)', fr:'UUID (v4)', es:'UUID (v4)', 'es-MX':'UUID (v4)', it:'UUID (v4)', pt:'UUID (v4)', ar:'UUID (v4)', hi:'UUID (v4)', ja:'UUID (v4)', ky:'UUID (v4)', 'zh-Hant':'UUID (v4)' },
  cbg_pw:     { bg:'Случайни пароли', ru:'Случайные пароли', uk:'Випадкові паролі', en:'Random passwords', de:'Zufällige Passwörter', fr:'Mots de passe aléatoires', es:'Contraseñas aleatorias', 'es-MX':'Contraseñas aleatorias', it:'Password casuali', pt:'Senhas aleatórias', ar:'كلمات مرور عشوائية', hi:'यादृच्छिक पासवर्ड', ja:'ランダムパスワード', ky:'Кокус сырсөздөр', 'zh-Hant':'隨機密碼' },
  cbg_lorem:  { bg:'Lorem текст (изречения)', ru:'Lorem-текст (предложения)', uk:'Lorem-текст (речення)', en:'Lorem text (sentences)', de:'Lorem-Text (Sätze)', fr:'Texte Lorem (phrases)', es:'Texto Lorem (frases)', 'es-MX':'Texto Lorem (frases)', it:'Testo Lorem (frasi)', pt:'Texto Lorem (frases)', ar:'نص Lorem (جمل)', hi:'Lorem टेक्स्ट (वाक्य)', ja:'Loremテキスト（文）', ky:'Lorem текст (сүйлөмдөр)', 'zh-Hant':'Lorem 文字（句子）' },
  cbg_num:    { bg:'Случайни числа', ru:'Случайные числа', uk:'Випадкові числа', en:'Random numbers', de:'Zufallszahlen', fr:'Nombres aléatoires', es:'Números aleatorios', 'es-MX':'Números aleatorios', it:'Numeri casuali', pt:'Números aleatórios', ar:'أرقام عشوائية', hi:'यादृच्छिक संख्याएँ', ja:'ランダムな数', ky:'Кокус сандар', 'zh-Hant':'隨機數字' },
  cbg_date:   { bg:'Случайни дати', ru:'Случайные даты', uk:'Випадкові дати', en:'Random dates', de:'Zufällige Daten', fr:'Dates aléatoires', es:'Fechas aleatorias', 'es-MX':'Fechas aleatorias', it:'Date casuali', pt:'Datas aleatórias', ar:'تواريخ عشوائية', hi:'यादृच्छिक तिथियाँ', ja:'ランダムな日付', ky:'Кокус даталар', 'zh-Hant':'隨機日期' },
  cbg_len:    { bg:'Дължина на паролата: {0}', ru:'Длина пароля: {0}', uk:'Довжина пароля: {0}', en:'Password length: {0}', de:'Passwortlänge: {0}', fr:'Longueur du mot de passe : {0}', es:'Longitud de la contraseña: {0}', 'es-MX':'Longitud de la contraseña: {0}', it:'Lunghezza password: {0}', pt:'Comprimento da senha: {0}', ar:'طول كلمة المرور: {0}', hi:'पासवर्ड लंबाई: {0}', ja:'パスワード長: {0}', ky:'Сырсөздүн узундугу: {0}', 'zh-Hant':'密碼長度：{0}' },
  cbg_min:    { bg:'Най-малко', ru:'Минимум', uk:'Мінімум', en:'Min', de:'Min', fr:'Min', es:'Mín', 'es-MX':'Mín', it:'Min', pt:'Mín', ar:'الأدنى', hi:'न्यूनतम', ja:'最小', ky:'Эң аз', 'zh-Hant':'最小' },
  cbg_max:    { bg:'Най-много', ru:'Максимум', uk:'Максимум', en:'Max', de:'Max', fr:'Max', es:'Máx', 'es-MX':'Máx', it:'Max', pt:'Máx', ar:'الأقصى', hi:'अधिकतम', ja:'最大', ky:'Эң көп', 'zh-Hant':'最大' },
  cbg_ints:   { bg:'Само цели числа', ru:'Только целые', uk:'Лише цілі', en:'Whole numbers only', de:'Nur ganze Zahlen', fr:'Entiers seulement', es:'Solo enteros', 'es-MX':'Solo enteros', it:'Solo interi', pt:'Apenas inteiros', ar:'أعداد صحيحة فقط', hi:'केवल पूर्ण संख्याएँ', ja:'整数のみ', ky:'Бүтүн сандар гана', 'zh-Hant':'僅整數' },
  cbg_dfrom:  { bg:'От дата', ru:'С даты', uk:'Від дати', en:'From date', de:'Von Datum', fr:'Date de début', es:'Fecha desde', 'es-MX':'Fecha desde', it:'Data da', pt:'Data de', ar:'من تاريخ', hi:'तिथि से', ja:'開始日', ky:'Датадан', 'zh-Hant':'起始日期' },
  cbg_dto:    { bg:'До дата', ru:'По дату', uk:'До дати', en:'To date', de:'Bis Datum', fr:'Date de fin', es:'Fecha hasta', 'es-MX':'Fecha hasta', it:'Data a', pt:'Data até', ar:'إلى تاريخ', hi:'तिथि तक', ja:'終了日', ky:'Датага чейин', 'zh-Hant':'結束日期' },
});

export const title = 'Batch generator';

const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat'.split(' ');
const rnd = (n) => { const a = new Uint32Array(1); (crypto.getRandomValues ? crypto.getRandomValues(a) : (a[0] = Math.floor(Math.random() * 4294967296))); return a[0] % n; };
const rndFloat = () => { const a = new Uint32Array(1); (crypto.getRandomValues ? crypto.getRandomValues(a) : (a[0] = Math.floor(Math.random() * 4294967296))); return a[0] / 4294967296; };

function genUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10,16).join('')}`;
}
function genPassword(len) {
  const set = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
  let out = ''; for (let i = 0; i < len; i++) out += set[rnd(set.length)]; return out;
}
function genSentence() {
  const n = 6 + rnd(9); let s = '';
  for (let i = 0; i < n; i++) s += (i ? ' ' : '') + LOREM[rnd(LOREM.length)];
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('cbg_type'))}</span><select id="cbg-type">
      <option value="uuid">${esc(t('cbg_uuid'))}</option>
      <option value="pw">${esc(t('cbg_pw'))}</option>
      <option value="lorem">${esc(t('cbg_lorem'))}</option>
      <option value="num">${esc(t('cbg_num'))}</option>
      <option value="date">${esc(t('cbg_date'))}</option>
    </select></label>
    <div id="cbg-cntlbl" class="muted"></div>
    <input type="range" id="cbg-cnt" min="1" max="100" value="10" style="width:100%">
    <div id="cbg-opts"></div>
    <button class="btn primary" id="cbg-gen" style="margin-top:8px">${esc(t('cbg_gen'))}</button>
    <label class="fld" style="margin-top:12px"><span>${esc(t('cbg_out'))}</span><textarea id="cbg-out" rows="8" readonly></textarea></label>
    <button class="btn" id="cbg-copy">${esc(t('cbg_copy'))}</button>`;

  const $ = (s) => root.querySelector(s);
  const type = $('#cbg-type'), cnt = $('#cbg-cnt'), opts = $('#cbg-opts'), out = $('#cbg-out');
  const upCnt = () => $('#cbg-cntlbl').textContent = tf('cbg_count', cnt.value);
  cnt.oninput = upCnt; upCnt();

  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);

  function drawOpts() {
    if (type.value === 'pw') {
      opts.innerHTML = `<div id="cbg-lenlbl" class="muted"></div><input type="range" id="cbg-len" min="6" max="48" value="16" style="width:100%">`;
      const len = $('#cbg-len'); const upLen = () => $('#cbg-lenlbl').textContent = tf('cbg_len', len.value); len.oninput = upLen; upLen();
    } else if (type.value === 'num') {
      opts.innerHTML = `<div class="row">
        <div><label class="fld"><span>${esc(t('cbg_min'))}</span><input type="number" id="cbg-min" value="0"></label></div>
        <div><label class="fld"><span>${esc(t('cbg_max'))}</span><input type="number" id="cbg-max" value="100"></label></div></div>
        <label class="check"><input type="checkbox" id="cbg-int" checked>${esc(t('cbg_ints'))}</label>`;
    } else if (type.value === 'date') {
      opts.innerHTML = `<div class="row">
        <div><label class="fld"><span>${esc(t('cbg_dfrom'))}</span><input type="date" id="cbg-df" value="${yearAgo}"></label></div>
        <div><label class="fld"><span>${esc(t('cbg_dto'))}</span><input type="date" id="cbg-dt" value="${today}"></label></div></div>`;
    } else opts.innerHTML = '';
  }

  function generate() {
    const n = +cnt.value; const lines = [];
    if (type.value === 'uuid') { for (let i = 0; i < n; i++) lines.push(genUUID()); }
    else if (type.value === 'pw') { const len = +($('#cbg-len') ? $('#cbg-len').value : 16); for (let i = 0; i < n; i++) lines.push(genPassword(len)); }
    else if (type.value === 'lorem') { for (let i = 0; i < n; i++) lines.push(genSentence()); }
    else if (type.value === 'num') {
      let mn = parseFloat($('#cbg-min').value), mx = parseFloat($('#cbg-max').value);
      if (isNaN(mn)) mn = 0; if (isNaN(mx)) mx = 100; if (mn > mx) [mn, mx] = [mx, mn];
      const ints = $('#cbg-int').checked;
      for (let i = 0; i < n; i++) { const v = mn + rndFloat() * (mx - mn); lines.push(ints ? String(Math.round(v)) : String(Math.round(v * 1000) / 1000)); }
    } else if (type.value === 'date') {
      let a = Date.parse($('#cbg-df').value), b = Date.parse($('#cbg-dt').value);
      if (isNaN(a)) a = Date.now() - 365 * 864e5; if (isNaN(b)) b = Date.now(); if (a > b) [a, b] = [b, a];
      for (let i = 0; i < n; i++) lines.push(new Date(a + rndFloat() * (b - a)).toISOString().slice(0, 10));
    }
    out.value = lines.join('\n');
  }

  type.onchange = () => { drawOpts(); out.value = ''; };
  $('#cbg-gen').onclick = generate;
  $('#cbg-copy').onclick = () => copyText(out.value);
  drawOpts();
}
