// Version: 1.0000
// „Генератори" — парола, UUID, Lorem ipsum, SHA хешове (SHA-1/256/512 през SubtleCrypto).
// Изцяло на устройството.
import { esc } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  tg_pw:      { bg:'Парола', ru:'Пароль', uk:'Пароль', en:'Password', de:'Passwort', fr:'Mot de passe', es:'Contraseña', 'es-MX':'Contraseña', it:'Password', pt:'Senha', ar:'كلمة مرور', hi:'पासवर्ड', ja:'パスワード', ky:'Сырсөз', 'zh-Hant':'密碼' },
  tg_len:     { bg:'Дължина: {0}', ru:'Длина: {0}', uk:'Довжина: {0}', en:'Length: {0}', de:'Länge: {0}', fr:'Longueur : {0}', es:'Longitud: {0}', 'es-MX':'Longitud: {0}', it:'Lunghezza: {0}', pt:'Comprimento: {0}', ar:'الطول: {0}', hi:'लंबाई: {0}', ja:'長さ: {0}', ky:'Узундугу: {0}', 'zh-Hant':'長度：{0}' },
  tg_symbols: { bg:'Символи (!@#…)', ru:'Символы (!@#…)', uk:'Символи (!@#…)', en:'Symbols (!@#…)', de:'Symbole (!@#…)', fr:'Symboles (!@#…)', es:'Símbolos (!@#…)', 'es-MX':'Símbolos (!@#…)', it:'Simboli (!@#…)', pt:'Símbolos (!@#…)', ar:'رموز (!@#…)', hi:'सिंबल (!@#…)', ja:'記号 (!@#…)', ky:'Символдор (!@#…)', 'zh-Hant':'符號 (!@#…)' },
  tg_digits:  { bg:'Цифри (0-9)', ru:'Цифры (0-9)', uk:'Цифри (0-9)', en:'Digits (0-9)', de:'Ziffern (0-9)', fr:'Chiffres (0-9)', es:'Dígitos (0-9)', 'es-MX':'Dígitos (0-9)', it:'Cifre (0-9)', pt:'Dígitos (0-9)', ar:'أرقام (0-9)', hi:'अंक (0-9)', ja:'数字 (0-9)', ky:'Сандар (0-9)', 'zh-Hant':'數字 (0-9)' },
  tg_gen:     { bg:'Генерирай', ru:'Сгенерировать', uk:'Згенерувати', en:'Generate', de:'Erzeugen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'توليد', hi:'जनरेट', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  tg_uuid:    { bg:'UUID (v4)', ru:'UUID (v4)', uk:'UUID (v4)', en:'UUID (v4)', de:'UUID (v4)', fr:'UUID (v4)', es:'UUID (v4)', 'es-MX':'UUID (v4)', it:'UUID (v4)', pt:'UUID (v4)', ar:'UUID (v4)', hi:'UUID (v4)', ja:'UUID (v4)', ky:'UUID (v4)', 'zh-Hant':'UUID (v4)' },
  tg_lorem:   { bg:'Lorem ipsum', ru:'Lorem ipsum', uk:'Lorem ipsum', en:'Lorem ipsum', de:'Lorem ipsum', fr:'Lorem ipsum', es:'Lorem ipsum', 'es-MX':'Lorem ipsum', it:'Lorem ipsum', pt:'Lorem ipsum', ar:'Lorem ipsum', hi:'Lorem ipsum', ja:'Lorem ipsum', ky:'Lorem ipsum', 'zh-Hant':'Lorem ipsum' },
  tg_paras:   { bg:'Абзаци: {0}', ru:'Абзацы: {0}', uk:'Абзаци: {0}', en:'Paragraphs: {0}', de:'Absätze: {0}', fr:'Paragraphes : {0}', es:'Párrafos: {0}', 'es-MX':'Párrafos: {0}', it:'Paragrafi: {0}', pt:'Parágrafos: {0}', ar:'فقرات: {0}', hi:'अनुच्छेद: {0}', ja:'段落: {0}', ky:'Абзацтар: {0}', 'zh-Hant':'段落：{0}' },
  tg_hash:    { bg:'Хешове (на текста горе)', ru:'Хеши (текста выше)', uk:'Хеші (тексту вище)', en:'Hashes (of text above)', de:'Hashes (des Textes oben)', fr:'Hachages (du texte ci-dessus)', es:'Hashes (del texto de arriba)', 'es-MX':'Hashes (del texto de arriba)', it:'Hash (del testo sopra)', pt:'Hashes (do texto acima)', ar:'تجزئات (للنص أعلاه)', hi:'हैश (ऊपर के टेक्स्ट का)', ja:'ハッシュ（上のテキスト）', ky:'Хештер (жогорудагы текст)', 'zh-Hant':'雜湊（上方文字）' },
  tg_hash_in: { bg:'Текст за хеширане', ru:'Текст для хеширования', uk:'Текст для хешування', en:'Text to hash', de:'Zu hashender Text', fr:'Texte à hacher', es:'Texto a hashear', 'es-MX':'Texto a hashear', it:'Testo da hashare', pt:'Texto para hash', ar:'نص للتجزئة', hi:'हैश हेतु टेक्स्ट', ja:'ハッシュするテキスト', ky:'Хештөө үчүн текст', 'zh-Hant':'要雜湊的文字' },
  tg_out:     { bg:'Резултат', ru:'Результат', uk:'Результат', en:'Result', de:'Ergebnis', fr:'Résultat', es:'Resultado', 'es-MX':'Resultado', it:'Risultato', pt:'Resultado', ar:'النتيجة', hi:'परिणाम', ja:'結果', ky:'Жыйынтык', 'zh-Hant':'結果' },
  tg_copy:    { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
});

export const title = 'Generators';

const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur'.split(' ');
const rnd = (n) => { const a = new Uint32Array(1); (crypto.getRandomValues ? crypto.getRandomValues(a) : (a[0] = Math.floor(Math.random() * 4294967296))); return a[0] % n; };

function genPassword(len, digits, symbols) {
  let set = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  if (digits) set += '0123456789';
  if (symbols) set += '!@#$%^&*()-_=+[]{};:,.?';
  let out = '';
  for (let i = 0; i < len; i++) out += set[rnd(set.length)];
  return out;
}
function genUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10,16).join('')}`;
}
function genLorem(paras) {
  const out = [];
  for (let p = 0; p < paras; p++) {
    const n = 30 + rnd(30); let s = '';
    for (let i = 0; i < n; i++) s += (i ? ' ' : '') + LOREM[rnd(LOREM.length)];
    out.push(s.charAt(0).toUpperCase() + s.slice(1) + '.');
  }
  return out.join('\n\n');
}
async function hashAll(text) {
  const data = new TextEncoder().encode(text);
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const out = [];
  for (const alg of ['SHA-1', 'SHA-256', 'SHA-512']) {
    try { out.push(alg + ': ' + hex(await crypto.subtle.digest(alg, data))); } catch (e) { out.push(alg + ': —'); }
  }
  return out.join('\n\n');
}

export function render(root) {
  root.innerHTML = `
    <div style="font-weight:700;color:#8ecae6;margin-bottom:4px">${esc(t('tg_pw'))}</div>
    <div id="tg-lenlbl" class="muted"></div>
    <input type="range" id="tg-len" min="6" max="48" value="16" style="width:100%">
    <label style="display:inline-flex;gap:6px;align-items:center;margin-right:14px"><input type="checkbox" id="tg-dig" checked>${esc(t('tg_digits'))}</label>
    <label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="tg-sym" checked>${esc(t('tg_symbols'))}</label>
    <div style="margin-top:6px"><button class="btn primary" id="tg-genpw">${esc(t('tg_gen'))}</button></div>

    <div style="font-weight:700;color:#8ecae6;margin:14px 0 4px">${esc(t('tg_uuid'))}</div>
    <button class="btn" id="tg-genuuid">${esc(t('tg_gen'))}</button>

    <div style="font-weight:700;color:#8ecae6;margin:14px 0 4px">${esc(t('tg_lorem'))}</div>
    <div id="tg-plbl" class="muted"></div>
    <input type="range" id="tg-paras" min="1" max="8" value="2" style="width:100%">
    <button class="btn" id="tg-genlorem">${esc(t('tg_gen'))}</button>

    <div style="font-weight:700;color:#8ecae6;margin:14px 0 4px">${esc(t('tg_hash'))}</div>
    <label class="fld"><span>${esc(t('tg_hash_in'))}</span><textarea id="tg-hin" rows="2"></textarea></label>
    <button class="btn" id="tg-genhash">${esc(t('tg_gen'))}</button>

    <label class="fld" style="margin-top:12px"><span>${esc(t('tg_out'))}</span><textarea id="tg-out" rows="5" readonly></textarea></label>
    <button class="btn" id="tg-copy">${esc(t('tg_copy'))}</button>`;
  const $ = (s) => root.querySelector(s), out = $('#tg-out');
  const len = $('#tg-len'), paras = $('#tg-paras');
  const upLen = () => $('#tg-lenlbl').textContent = tf('tg_len', len.value);
  const upPar = () => $('#tg-plbl').textContent = tf('tg_paras', paras.value);
  len.oninput = upLen; paras.oninput = upPar; upLen(); upPar();
  $('#tg-genpw').onclick = () => out.value = genPassword(+len.value, $('#tg-dig').checked, $('#tg-sym').checked);
  $('#tg-genuuid').onclick = () => out.value = genUUID();
  $('#tg-genlorem').onclick = () => out.value = genLorem(+paras.value);
  $('#tg-genhash').onclick = async () => { out.value = '…'; out.value = await hashAll($('#tg-hin').value); };
  $('#tg-copy').onclick = () => { try { navigator.clipboard.writeText(out.value); } catch (_) {} };
}
