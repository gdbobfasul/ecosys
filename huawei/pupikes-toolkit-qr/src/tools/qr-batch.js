// Version: 1.0000
// „Партиден QR" — генерира по един QR код за всеки ред от списъка. Мрежа с миниатюри,
// сваляне поединично или всички. Изцяло на устройството.
import QRCode from 'qrcode';
import { esc, downloadBlob } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  qb_label: { bg:'Един запис на ред (текст или URL)', ru:'Одна запись на строку (текст или URL)', uk:'Один запис на рядок (текст або URL)', en:'One entry per line (text or URL)', de:'Ein Eintrag pro Zeile (Text oder URL)', fr:'Une entrée par ligne (texte ou URL)', es:'Una entrada por línea (texto o URL)', 'es-MX':'Una entrada por línea (texto o URL)', it:'Una voce per riga (testo o URL)', pt:'Uma entrada por linha (texto ou URL)', ar:'إدخال واحد لكل سطر (نص أو رابط)', hi:'प्रति पंक्ति एक प्रविष्टि (टेक्स्ट या URL)', ja:'1行に1件（テキストまたはURL）', ky:'Ар сапта бир жазуу (текст же URL)', 'zh-Hant':'每行一筆（文字或網址）' },
  qb_gen:   { bg:'Генерирай всички', ru:'Создать все', uk:'Створити всі', en:'Generate all', de:'Alle erzeugen', fr:'Tout générer', es:'Generar todos', 'es-MX':'Generar todos', it:'Genera tutti', pt:'Gerar todos', ar:'توليد الكل', hi:'सभी जनरेट', ja:'すべて生成', ky:'Баарын түзүү', 'zh-Hant':'全部產生' },
  qb_dlall: { bg:'Свали всички', ru:'Скачать все', uk:'Завантажити всі', en:'Download all', de:'Alle laden', fr:'Tout télécharger', es:'Descargar todos', 'es-MX':'Descargar todos', it:'Scarica tutti', pt:'Baixar todos', ar:'تنزيل الكل', hi:'सभी डाउनलोड', ja:'すべて保存', ky:'Баарын жүктөө', 'zh-Hant':'全部下載' },
  qb_dl:    { bg:'Свали', ru:'Скачать', uk:'Завантажити', en:'Download', de:'Laden', fr:'Télécharger', es:'Descargar', 'es-MX':'Descargar', it:'Scarica', pt:'Baixar', ar:'تنزيل', hi:'डाउनलोड', ja:'保存', ky:'Жүктөө', 'zh-Hant':'下載' },
  qb_count: { bg:'{0} кода', ru:'{0} кодов', uk:'{0} кодів', en:'{0} codes', de:'{0} Codes', fr:'{0} codes', es:'{0} códigos', 'es-MX':'{0} códigos', it:'{0} codici', pt:'{0} códigos', ar:'{0} رمز', hi:'{0} कोड', ja:'{0} 件', ky:'{0} код', 'zh-Hant':'{0} 個代碼' },
  qb_empty: { bg:'Въведи поне един ред.', ru:'Введи хотя бы одну строку.', uk:'Введи хоча б один рядок.', en:'Enter at least one line.', de:'Mindestens eine Zeile eingeben.', fr:'Saisis au moins une ligne.', es:'Introduce al menos una línea.', 'es-MX':'Introduce al menos una línea.', it:'Inserisci almeno una riga.', pt:'Insira ao menos uma linha.', ar:'أدخل سطرًا واحدًا على الأقل.', hi:'कम से कम एक पंक्ति दर्ज करें।', ja:'少なくとも1行入力してください。', ky:'Жок дегенде бир сап киргиз.', 'zh-Hant':'請至少輸入一行。' },
});

export const title = 'Batch QR';

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('qb_label'))}</span><textarea id="qb-in" rows="6" placeholder="https://a.com&#10;https://b.com&#10;..."></textarea></label>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn primary" id="qb-gen">${esc(t('qb_gen'))}</button>
      <button class="btn" id="qb-dlall" style="display:none">${esc(t('qb_dlall'))}</button>
      <span id="qb-count" class="muted"></span></div>
    <div id="qb-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:12px"></div>`;
  const grid = root.querySelector('#qb-grid');
  const dlBtn = root.querySelector('#qb-dlall');
  let canvases = [];
  const fname = (s, i) => (String(s).replace(/[^\w-]+/g, '_').slice(0, 24) || ('qr' + i)) + '.png';
  root.querySelector('#qb-gen').onclick = async () => {
    const items = root.querySelector('#qb-in').value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    grid.innerHTML = ''; canvases = [];
    if (!items.length) { root.querySelector('#qb-count').textContent = t('qb_empty'); dlBtn.style.display = 'none'; return; }
    root.querySelector('#qb-count').textContent = tf('qb_count', items.length);
    dlBtn.style.display = '';
    for (let i = 0; i < items.length; i++) {
      const cell = document.createElement('div');
      cell.style.cssText = 'background:#181b22;border:1px solid #252a33;border-radius:10px;padding:8px;text-align:center';
      const cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;max-width:120px;background:#fff;border-radius:6px';
      cell.appendChild(cv);
      const lbl = document.createElement('div'); lbl.className = 'muted';
      lbl.style.cssText = 'font-size:11px;margin:6px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; lbl.textContent = items[i];
      cell.appendChild(lbl);
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = t('qb_dl');
      b.onclick = () => cv.toBlob((blob) => { if (blob) downloadBlob(blob, fname(items[i], i), 'image/png'); }, 'image/png');
      cell.appendChild(b); grid.appendChild(cell);
      try { await QRCode.toCanvas(cv, items[i], { width: 240, margin: 1 }); } catch (e) {}
      canvases.push({ cv, name: fname(items[i], i) });
    }
  };
  dlBtn.onclick = () => canvases.forEach(({ cv, name }, i) => setTimeout(() => cv.toBlob((b) => { if (b) downloadBlob(b, name, 'image/png'); }, 'image/png'), i * 250));
}
