// Version: 1.0000
// „JSON / CSV" — форматиране (prettify), сгъстяване (minify), валидиране на JSON,
// и превръщане JSON↔CSV. Изцяло на устройството.
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  tj_in:      { bg:'Вход', ru:'Ввод', uk:'Ввід', en:'Input', de:'Eingabe', fr:'Entrée', es:'Entrada', 'es-MX':'Entrada', it:'Input', pt:'Entrada', ar:'المدخل', hi:'इनपुट', ja:'入力', ky:'Кириш', 'zh-Hant':'輸入' },
  tj_out:     { bg:'Резултат', ru:'Результат', uk:'Результат', en:'Result', de:'Ergebnis', fr:'Résultat', es:'Resultado', 'es-MX':'Resultado', it:'Risultato', pt:'Resultado', ar:'النتيجة', hi:'परिणाम', ja:'結果', ky:'Жыйынтык', 'zh-Hant':'結果' },
  tj_pretty:  { bg:'Форматирай JSON', ru:'Форматировать JSON', uk:'Форматувати JSON', en:'Prettify JSON', de:'JSON formatieren', fr:'Formater JSON', es:'Formatear JSON', 'es-MX':'Formatear JSON', it:'Formatta JSON', pt:'Formatar JSON', ar:'تنسيق JSON', hi:'JSON फ़ॉर्मेट', ja:'JSON整形', ky:'JSON форматтоо', 'zh-Hant':'美化 JSON' },
  tj_min:     { bg:'Сгъсти JSON', ru:'Сжать JSON', uk:'Стиснути JSON', en:'Minify JSON', de:'JSON minimieren', fr:'Minifier JSON', es:'Minificar JSON', 'es-MX':'Minificar JSON', it:'Minimizza JSON', pt:'Minificar JSON', ar:'تصغير JSON', hi:'JSON मिनिफ़ाई', ja:'JSON圧縮', ky:'JSON кысуу', 'zh-Hant':'壓縮 JSON' },
  tj_valid:   { bg:'Провери JSON', ru:'Проверить JSON', uk:'Перевірити JSON', en:'Validate JSON', de:'JSON prüfen', fr:'Valider JSON', es:'Validar JSON', 'es-MX':'Validar JSON', it:'Valida JSON', pt:'Validar JSON', ar:'تحقّق JSON', hi:'JSON जाँचें', ja:'JSON検証', ky:'JSON текшерүү', 'zh-Hant':'驗證 JSON' },
  tj_j2c:     { bg:'JSON → CSV', ru:'JSON → CSV', uk:'JSON → CSV', en:'JSON → CSV', de:'JSON → CSV', fr:'JSON → CSV', es:'JSON → CSV', 'es-MX':'JSON → CSV', it:'JSON → CSV', pt:'JSON → CSV', ar:'JSON → CSV', hi:'JSON → CSV', ja:'JSON → CSV', ky:'JSON → CSV', 'zh-Hant':'JSON → CSV' },
  tj_c2j:     { bg:'CSV → JSON', ru:'CSV → JSON', uk:'CSV → JSON', en:'CSV → JSON', de:'CSV → JSON', fr:'CSV → JSON', es:'CSV → JSON', 'es-MX':'CSV → JSON', it:'CSV → JSON', pt:'CSV → JSON', ar:'CSV → JSON', hi:'CSV → JSON', ja:'CSV → JSON', ky:'CSV → JSON', 'zh-Hant':'CSV → JSON' },
  tj_ok:      { bg:'Валиден JSON ✓', ru:'Валидный JSON ✓', uk:'Валідний JSON ✓', en:'Valid JSON ✓', de:'Gültiges JSON ✓', fr:'JSON valide ✓', es:'JSON válido ✓', 'es-MX':'JSON válido ✓', it:'JSON valido ✓', pt:'JSON válido ✓', ar:'JSON صالح ✓', hi:'मान्य JSON ✓', ja:'有効なJSON ✓', ky:'Туура JSON ✓', 'zh-Hant':'有效 JSON ✓' },
  tj_err:     { bg:'Грешка: {0}', ru:'Ошибка: {0}', uk:'Помилка: {0}', en:'Error: {0}', de:'Fehler: {0}', fr:'Erreur : {0}', es:'Error: {0}', 'es-MX':'Error: {0}', it:'Errore: {0}', pt:'Erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'Ката: {0}', 'zh-Hant':'錯誤：{0}' },
  tj_copy:    { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
  tj_dl:      { bg:'Свали', ru:'Скачать', uk:'Завантажити', en:'Download', de:'Laden', fr:'Télécharger', es:'Descargar', 'es-MX':'Descargar', it:'Scarica', pt:'Baixar', ar:'تنزيل', hi:'डाउनलोड', ja:'保存', ky:'Жүктөө', 'zh-Hant':'下載' },
});

export const title = 'JSON / CSV';

function parseCSV(text) {
  const rows = []; let row = [], val = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else q = false; } else val += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(val); val = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(val); rows.push(row); row = []; val = ''; }
    else val += c;
  }
  if (val !== '' || row.length) { row.push(val); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter((r) => r.length && r.some((x) => x !== '')).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
function toCSV(arr) {
  if (!Array.isArray(arr) || !arr.length) throw new Error('array of objects');
  const cols = [...new Set(arr.flatMap((o) => Object.keys(o)))];
  const cell = (v) => { const s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(','), ...arr.map((o) => cols.map((c) => cell(o[c])).join(','))].join('\n');
}

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('tj_in'))}</span><textarea id="tj-in" rows="5"></textarea></label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">
      <button class="btn" data-op="pretty">${esc(t('tj_pretty'))}</button>
      <button class="btn" data-op="min">${esc(t('tj_min'))}</button>
      <button class="btn" data-op="valid">${esc(t('tj_valid'))}</button>
      <button class="btn" data-op="j2c">${esc(t('tj_j2c'))}</button>
      <button class="btn" data-op="c2j">${esc(t('tj_c2j'))}</button></div>
    <div id="tj-status" class="muted" style="min-height:18px"></div>
    <label class="fld"><span>${esc(t('tj_out'))}</span><textarea id="tj-out" rows="6" readonly></textarea></label>
    <div style="display:flex;gap:8px"><button class="btn primary" id="tj-copy">${esc(t('tj_copy'))}</button><button class="btn" id="tj-dl">${esc(t('tj_dl'))}</button></div>`;
  const inp = root.querySelector('#tj-in'), out = root.querySelector('#tj-out'), st = root.querySelector('#tj-status');
  const ops = {
    pretty: () => JSON.stringify(JSON.parse(inp.value), null, 2),
    min: () => JSON.stringify(JSON.parse(inp.value)),
    valid: () => { JSON.parse(inp.value); st.textContent = t('tj_ok'); st.style.color = '#3fb950'; return inp.value.trim(); },
    j2c: () => toCSV(JSON.parse(inp.value)),
    c2j: () => JSON.stringify(parseCSV(inp.value), null, 2),
  };
  root.querySelectorAll('[data-op]').forEach((b) => b.onclick = () => {
    st.textContent = ''; st.style.color = '';
    try { out.value = ops[b.getAttribute('data-op')](); } catch (e) { out.value = ''; st.textContent = t('tj_err').replace('{0}', e.message || e); st.style.color = '#f85149'; }
  });
  root.querySelector('#tj-copy').onclick = () => { try { navigator.clipboard.writeText(out.value); } catch (_) {} };
  root.querySelector('#tj-dl').onclick = () => { const csv = out.value.trim().startsWith('{') || out.value.trim().startsWith('['); downloadBlob(new Blob([out.value], { type: 'text/plain' }), csv ? 'data.json' : 'data.csv', 'text/plain'); };
}
