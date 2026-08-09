// Version: 1.0000
// „Кодиране/декодиране" — URL, HTML entities, ROT13, Морзов код, двоично, шестнайсетично.
// Изцяло на устройството (UTF-8 през TextEncoder/TextDecoder).
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  te_in:    { bg:'Вход', ru:'Ввод', uk:'Ввід', en:'Input', de:'Eingabe', fr:'Entrée', es:'Entrada', 'es-MX':'Entrada', it:'Input', pt:'Entrada', ar:'المدخل', hi:'इनपुट', ja:'入力', ky:'Кириш', 'zh-Hant':'輸入' },
  te_out:   { bg:'Резултат', ru:'Результат', uk:'Результат', en:'Result', de:'Ergebnis', fr:'Résultat', es:'Resultado', 'es-MX':'Resultado', it:'Risultato', pt:'Resultado', ar:'النتيجة', hi:'परिणाम', ja:'結果', ky:'Жыйынтык', 'zh-Hant':'結果' },
  te_enc:   { bg:'Кодирай', ru:'Кодировать', uk:'Кодувати', en:'Encode', de:'Kodieren', fr:'Encoder', es:'Codificar', 'es-MX':'Codificar', it:'Codifica', pt:'Codificar', ar:'ترميز', hi:'एन्कोड', ja:'エンコード', ky:'Коддоо', 'zh-Hant':'編碼' },
  te_dec:   { bg:'Декодирай', ru:'Декодировать', uk:'Декодувати', en:'Decode', de:'Dekodieren', fr:'Décoder', es:'Decodificar', 'es-MX':'Decodificar', it:'Decodifica', pt:'Decodificar', ar:'فك الترميز', hi:'डिकोड', ja:'デコード', ky:'Декоддоо', 'zh-Hant':'解碼' },
  te_url:   { bg:'URL', ru:'URL', uk:'URL', en:'URL', de:'URL', fr:'URL', es:'URL', 'es-MX':'URL', it:'URL', pt:'URL', ar:'URL', hi:'URL', ja:'URL', ky:'URL', 'zh-Hant':'URL' },
  te_html:  { bg:'HTML', ru:'HTML', uk:'HTML', en:'HTML', de:'HTML', fr:'HTML', es:'HTML', 'es-MX':'HTML', it:'HTML', pt:'HTML', ar:'HTML', hi:'HTML', ja:'HTML', ky:'HTML', 'zh-Hant':'HTML' },
  te_rot13: { bg:'ROT13', ru:'ROT13', uk:'ROT13', en:'ROT13', de:'ROT13', fr:'ROT13', es:'ROT13', 'es-MX':'ROT13', it:'ROT13', pt:'ROT13', ar:'ROT13', hi:'ROT13', ja:'ROT13', ky:'ROT13', 'zh-Hant':'ROT13' },
  te_morse: { bg:'Морзов код', ru:'Морзе', uk:'Морзе', en:'Morse', de:'Morse', fr:'Morse', es:'Morse', 'es-MX':'Morse', it:'Morse', pt:'Morse', ar:'مورس', hi:'मोर्स', ja:'モールス', ky:'Морзе', 'zh-Hant':'摩斯' },
  te_bin:   { bg:'Двоично', ru:'Двоичное', uk:'Двійкове', en:'Binary', de:'Binär', fr:'Binaire', es:'Binario', 'es-MX':'Binario', it:'Binario', pt:'Binário', ar:'ثنائي', hi:'बाइनरी', ja:'2進', ky:'Экилик', 'zh-Hant':'二進位' },
  te_hex:   { bg:'Шестнайсетично', ru:'Шестнадцатеричное', uk:'Шістнадцяткове', en:'Hex', de:'Hex', fr:'Hex', es:'Hex', 'es-MX':'Hex', it:'Esadecimale', pt:'Hex', ar:'ست عشري', hi:'हेक्स', ja:'16進', ky:'Он алтылык', 'zh-Hant':'十六進位' },
  te_copy:  { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
  te_dl:    { bg:'Свали .txt', ru:'Скачать .txt', uk:'Завантажити .txt', en:'Download .txt', de:'.txt laden', fr:'Télécharger .txt', es:'Descargar .txt', 'es-MX':'Descargar .txt', it:'Scarica .txt', pt:'Baixar .txt', ar:'تنزيل .txt', hi:'.txt डाउनलोड', ja:'.txt保存', ky:'.txt жүктөө', 'zh-Hant':'下載 .txt' },
  te_err:   { bg:'Невалиден вход за декодиране.', ru:'Неверный ввод для декодирования.', uk:'Невірний ввід для декодування.', en:'Invalid input to decode.', de:'Ungültige Eingabe zum Dekodieren.', fr:'Entrée invalide à décoder.', es:'Entrada no válida para decodificar.', 'es-MX':'Entrada no válida para decodificar.', it:'Input non valido da decodificare.', pt:'Entrada inválida para decodificar.', ar:'مدخل غير صالح لفك الترميز.', hi:'डिकोड हेतु अमान्य इनपुट।', ja:'デコードする入力が不正です。', ky:'Декоддоо үчүн туура эмес кириш.', 'zh-Hant':'解碼輸入無效。' },
});

export const title = 'Encode/Decode';

const MORSE = { A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.','.':'.-.-.-',',':'--..--','?':'..--..','/':'-..-.','@':'.--.-.','-':'-....-' };
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const bytes = (s) => new TextEncoder().encode(s);
const fromBytes = (a) => new TextDecoder('utf-8').decode(new Uint8Array(a));

const OPS = {
  url:   { enc: (s) => encodeURIComponent(s), dec: (s) => decodeURIComponent(s) },
  html:  { enc: (s) => s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])),
           dec: (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp:'&',lt:'<',gt:'>',quot:'"','#39':"'" }[e])) },
  rot13: { enc: (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c.charCodeAt(0) + 13) ? c.charCodeAt(0) + 13 : c.charCodeAt(0) - 13)), dec: null },
  morse: { enc: (s) => s.toUpperCase().split('').map((c) => c === ' ' ? '/' : (MORSE[c] || '')).filter(Boolean).join(' '),
           dec: (s) => s.trim().split(/\s+/).map((t2) => t2 === '/' ? ' ' : (UNMORSE[t2] || '')).join('') },
  bin:   { enc: (s) => [...bytes(s)].map((b) => b.toString(2).padStart(8, '0')).join(' '),
           dec: (s) => fromBytes(s.trim().split(/\s+/).map((b) => parseInt(b, 2))) },
  hex:   { enc: (s) => [...bytes(s)].map((b) => b.toString(16).padStart(2, '0')).join(' '),
           dec: (s) => fromBytes(s.trim().split(/\s+/).map((b) => parseInt(b, 16))) },
};
OPS.rot13.dec = OPS.rot13.enc; // ROT13 е симетричен

export function render(root) {
  const row = (key, label) => `<div style="display:flex;align-items:center;gap:6px;margin:4px 0">
    <span style="flex:1;font-weight:600">${esc(t(label))}</span>
    <button class="btn" data-op="${key}" data-dir="enc">${esc(t('te_enc'))}</button>
    <button class="btn" data-op="${key}" data-dir="dec">${esc(t('te_dec'))}</button></div>`;
  root.innerHTML = `
    <label class="fld"><span>${esc(t('te_in'))}</span><textarea id="te-in" rows="4"></textarea></label>
    ${row('url', 'te_url')}${row('html', 'te_html')}${row('rot13', 'te_rot13')}${row('morse', 'te_morse')}${row('bin', 'te_bin')}${row('hex', 'te_hex')}
    <label class="fld" style="margin-top:10px"><span>${esc(t('te_out'))}</span><textarea id="te-out" rows="4" readonly></textarea></label>
    <div style="display:flex;gap:8px"><button class="btn primary" id="te-copy">${esc(t('te_copy'))}</button><button class="btn" id="te-dl">${esc(t('te_dl'))}</button></div>`;
  const inp = root.querySelector('#te-in'), out = root.querySelector('#te-out');
  root.querySelectorAll('[data-op]').forEach((b) => b.onclick = () => {
    const fn = OPS[b.getAttribute('data-op')][b.getAttribute('data-dir')];
    try { out.value = fn(inp.value); } catch (e) { out.value = t('te_err'); }
  });
  root.querySelector('#te-copy').onclick = () => { try { navigator.clipboard.writeText(out.value); } catch (_) {} };
  root.querySelector('#te-dl').onclick = () => downloadBlob(new Blob([out.value], { type: 'text/plain' }), 'encoded.txt', 'text/plain');
}
