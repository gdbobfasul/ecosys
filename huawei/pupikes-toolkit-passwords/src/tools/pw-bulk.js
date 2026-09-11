// Version: 1.0020
// „Пакетни пароли + политика" (обогатяване Huawei 4.1, 09.09.2026): генерира N пароли (до 100) по политика
// (дължина, набори, без объркващи знаци 0O1lI, без повторения), проверява ВСЯКА срещу анализатора,
// показва таблица със сила и износ като CSV/TXT (за администратори, екипи, Wi-Fi гост пароли). Изцяло на устройството.
import { esc, downloadBlob, copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';
import { analyze } from './pw-strength.js';

register({
  pb_title: { bg:'Пакетни пароли + политика', ru:'Пакет паролей + политика', uk:'Пакет паролів + політика', en:'Bulk passwords + policy', de:'Passwort-Stapel + Richtlinie', fr:'Mots de passe en lot + politique', es:'Contraseñas en lote + política', 'es-MX':'Contraseñas en lote + política', it:'Password in blocco + policy', pt:'Palavras-passe em lote + política', ar:'كلمات مرور بالجملة + سياسة', hi:'बल्क पासवर्ड + नीति', ja:'一括パスワード＋ポリシー', ky:'Топтоп сырсөздөр + саясат', 'zh-Hant':'批次密碼＋政策' },
  pb_hint: { bg:'За администратори и екипи: много пароли наведнъж по правила, всяка проверена за сила, износ в CSV.', ru:'Для администраторов и команд: много паролей сразу по правилам, каждый проверен на стойкость, экспорт в CSV.', uk:'Для адміністраторів і команд: багато паролів одразу за правилами, кожен перевірений на стійкість, експорт у CSV.', en:'For admins and teams: many passwords at once by policy, each checked for strength, CSV export.', de:'Für Admins und Teams: viele Passwörter nach Richtlinie, jedes auf Stärke geprüft, CSV-Export.', fr:'Pour admins et équipes : beaucoup de mots de passe selon une politique, chacun vérifié, export CSV.', es:'Para administradores y equipos: muchas contraseñas según una política, cada una comprobada, exportación CSV.', 'es-MX':'Para administradores y equipos: muchas contraseñas según una política, cada una comprobada, exportación CSV.', it:'Per admin e team: molte password secondo una policy, ognuna verificata, esportazione CSV.', pt:'Para administradores e equipas: muitas palavras-passe por política, cada uma verificada, exportação CSV.', ar:'للمسؤولين والفرق: كلمات مرور كثيرة دفعة واحدة وفق سياسة، كل منها مفحوصة، تصدير CSV.', hi:'एडमिन और टीमों के लिए: नीति के अनुसार कई पासवर्ड, हर एक की जाँच, CSV निर्यात।', ja:'管理者・チーム向け：ポリシーに沿って多数生成、各パスワードを強度チェック、CSV出力。', ky:'Админдер жана командалар үчүн: саясат боюнча көп сырсөз, ар бири текшерилген, CSV экспорт.', 'zh-Hant':'給管理員與團隊：依政策一次產生多組密碼，逐一檢查強度，匯出 CSV。' },
  pb_n: { bg:'Брой', ru:'Количество', uk:'Кількість', en:'Count', de:'Anzahl', fr:'Nombre', es:'Cantidad', 'es-MX':'Cantidad', it:'Quantità', pt:'Quantidade', ar:'العدد', hi:'संख्या', ja:'個数', ky:'Саны', 'zh-Hant':'數量' },
  pb_len: { bg:'Дължина', ru:'Длина', uk:'Довжина', en:'Length', de:'Länge', fr:'Longueur', es:'Longitud', 'es-MX':'Longitud', it:'Lunghezza', pt:'Comprimento', ar:'الطول', hi:'लंबाई', ja:'長さ', ky:'Узундугу', 'zh-Hant':'長度' },
  pb_upper: { bg:'Главни букви', ru:'Заглавные', uk:'Великі літери', en:'Uppercase', de:'Großbuchstaben', fr:'Majuscules', es:'Mayúsculas', 'es-MX':'Mayúsculas', it:'Maiuscole', pt:'Maiúsculas', ar:'أحرف كبيرة', hi:'बड़े अक्षर', ja:'大文字', ky:'Баш тамгалар', 'zh-Hant':'大寫' },
  pb_digits: { bg:'Цифри', ru:'Цифры', uk:'Цифри', en:'Digits', de:'Ziffern', fr:'Chiffres', es:'Dígitos', 'es-MX':'Dígitos', it:'Cifre', pt:'Dígitos', ar:'أرقام', hi:'अंक', ja:'数字', ky:'Цифралар', 'zh-Hant':'數字' },
  pb_symbols: { bg:'Знаци', ru:'Символы', uk:'Символи', en:'Symbols', de:'Sonderzeichen', fr:'Symboles', es:'Símbolos', 'es-MX':'Símbolos', it:'Simboli', pt:'Símbolos', ar:'رموز', hi:'चिह्न', ja:'記号', ky:'Белгилер', 'zh-Hant':'符號' },
  pb_noamb: { bg:'Без объркващи знаци (0O1lI|)', ru:'Без похожих знаков (0O1lI|)', uk:'Без схожих знаків (0O1lI|)', en:'No ambiguous characters (0O1lI|)', de:'Keine verwechselbaren Zeichen (0O1lI|)', fr:'Sans caractères ambigus (0O1lI|)', es:'Sin caracteres ambiguos (0O1lI|)', 'es-MX':'Sin caracteres ambiguos (0O1lI|)', it:'Senza caratteri ambigui (0O1lI|)', pt:'Sem caracteres ambíguos (0O1lI|)', ar:'بدون أحرف ملتبسة (0O1lI|)', hi:'भ्रामक अक्षर नहीं (0O1lI|)', ja:'紛らわしい文字なし（0O1lI|）', ky:'Чаташтырган белгилерсиз (0O1lI|)', 'zh-Hant':'不含易混淆字元（0O1lI|）' },
  pb_norep: { bg:'Без повтарящи се съседни знаци', ru:'Без повторяющихся соседних знаков', uk:'Без повторюваних сусідніх знаків', en:'No repeated adjacent characters', de:'Keine doppelten Nachbarzeichen', fr:'Sans caractères adjacents répétés', es:'Sin caracteres adyacentes repetidos', 'es-MX':'Sin caracteres adyacentes repetidos', it:'Senza caratteri adiacenti ripetuti', pt:'Sem caracteres adjacentes repetidos', ar:'بدون أحرف متجاورة مكررة', hi:'लगातार दोहराए अक्षर नहीं', ja:'隣接する同一文字なし', ky:'Катар кайталанган белгилерсиз', 'zh-Hant':'無相鄰重複字元' },
  pb_gen: { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erzeugen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएँ', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  pb_csv: { bg:'Свали CSV', ru:'Скачать CSV', uk:'Завантажити CSV', en:'Download CSV', de:'CSV laden', fr:'Télécharger CSV', es:'Descargar CSV', 'es-MX':'Descargar CSV', it:'Scarica CSV', pt:'Transferir CSV', ar:'تنزيل CSV', hi:'CSV डाउनलोड', ja:'CSVをダウンロード', ky:'CSV жүктөө', 'zh-Hant':'下載 CSV' },
  pb_copy: { bg:'Копирай всички', ru:'Копировать все', uk:'Копіювати всі', en:'Copy all', de:'Alle kopieren', fr:'Tout copier', es:'Copiar todo', 'es-MX':'Copiar todo', it:'Copia tutto', pt:'Copiar tudo', ar:'نسخ الكل', hi:'सब कॉपी करें', ja:'すべてコピー', ky:'Баарын көчүрүү', 'zh-Hant':'全部複製' },
  pb_copied: { bg:'Копирано ✓', ru:'Скопировано ✓', uk:'Скопійовано ✓', en:'Copied ✓', de:'Kopiert ✓', fr:'Copié ✓', es:'Copiado ✓', 'es-MX':'Copiado ✓', it:'Copiato ✓', pt:'Copiado ✓', ar:'تم النسخ ✓', hi:'कॉपी हो गया ✓', ja:'コピーしました ✓', ky:'Көчүрүлдү ✓', 'zh-Hant':'已複製 ✓' }
});

export const title = 'Bulk passwords';

function rnd(max) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max; }
export function makeOne(p) {
  let low = 'abcdefghijklmnopqrstuvwxyz', up = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', dg = '0123456789', sy = '!@#$%^&*()-_=+[]{};:,.?/';
  if (p.noamb) { low = low.replace(/[lo]/g, ''); up = up.replace(/[IO]/g, ''); dg = dg.replace(/[01]/g, ''); sy = sy.replace(/[|]/g, ''); }
  const sets = [low]; if (p.upper) sets.push(up); if (p.digits) sets.push(dg); if (p.symbols) sets.push(sy);
  const all = sets.join('');
  for (let attempt = 0; attempt < 50; attempt++) {
    const out = [];
    sets.forEach((s) => out.push(s[rnd(s.length)]));            // по един от всеки задължителен набор
    while (out.length < p.len) out.push(all[rnd(all.length)]);
    for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    const s = out.join('');
    if (p.norep && /(.)\1/.test(s)) continue;
    return s;
  }
  return null;
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <p class="hint">${esc(t('pb_hint'))}</p>
      <div style="display:flex;gap:8px"><div style="flex:1"><label>${esc(t('pb_n'))}</label><input type="number" id="pb-n" min="1" max="100" value="10" /></div><div style="flex:1"><label>${esc(t('pb_len'))}</label><input type="number" id="pb-len" min="8" max="64" value="16" /></div></div>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="pb-upper" checked> ${esc(t('pb_upper'))}</label>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="pb-digits" checked> ${esc(t('pb_digits'))}</label>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="pb-symbols" checked> ${esc(t('pb_symbols'))}</label>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="pb-noamb" checked> ${esc(t('pb_noamb'))}</label>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="pb-norep" checked> ${esc(t('pb_norep'))}</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" id="pb-gen">${esc(t('pb_gen'))}</button><button class="btn sec" id="pb-csv">${esc(t('pb_csv'))}</button><button class="btn sec" id="pb-copy">${esc(t('pb_copy'))}</button></div>
      <div id="pb-out" style="margin-top:10px;overflow-x:auto"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  let rows = [];
  const gen = () => {
    const p = { len: Math.max(8, Math.min(64, parseInt($('#pb-len').value, 10) || 16)), upper: $('#pb-upper').checked, digits: $('#pb-digits').checked, symbols: $('#pb-symbols').checked, noamb: $('#pb-noamb').checked, norep: $('#pb-norep').checked };
    const n = Math.max(1, Math.min(100, parseInt($('#pb-n').value, 10) || 10));
    rows = []; for (let i = 0; i < n; i++) { const s = makeOne(p); if (s) rows.push({ pw: s, bits: analyze(s).bits }); }
    $('#pb-out').innerHTML = '<table style="border-collapse:collapse;font-family:monospace;font-size:14px">' + rows.map((r, i) => `<tr><td style="padding:3px 8px;opacity:.6">${i + 1}</td><td style="padding:3px 8px">${esc(r.pw)}</td><td style="padding:3px 8px;color:${r.bits < 64 ? 'var(--warn)' : 'var(--ok)'}">${r.bits} b</td></tr>`).join('') + '</table>';
  };
  $('#pb-gen').addEventListener('click', gen);
  $('#pb-csv').addEventListener('click', () => { if (rows.length) downloadBlob(new Blob(['﻿n;password;entropy_bits\n' + rows.map((r, i) => (i + 1) + ';' + r.pw + ';' + r.bits).join('\n')], { type: 'text/csv' }), 'passwords.csv', 'text/csv'); });
  $('#pb-copy').addEventListener('click', async (e) => { if (rows.length && await copyText(rows.map((r) => r.pw).join('\n'))) { const o = e.target.textContent; e.target.textContent = t('pb_copied'); setTimeout(() => { e.target.textContent = o; }, 900); } });
  gen();
}
