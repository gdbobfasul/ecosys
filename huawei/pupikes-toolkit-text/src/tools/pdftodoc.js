// Version: 1.0014
// PDF към Word — извлича текста от PDF (pdf.js, вграден в бандъла) и сглобява
// .docx (минимален WordprocessingML в ZIP „store" — без външни библиотеки).
// Изцяло офлайн: нищо не се качва никъде. Същата логика като портал услугата
// pdf-to-doc.html (редове по y → абзаци по вертикална дупка, долна медиана ×1.8).
// Сканирани PDF-и (снимки на страници) нямат текст → честно съобщение.
import { setStatus, downloadBlob } from '../core/ui.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { t, tf, register } from '../core/i18n.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

register({
  pdfd_title: { bg:'PDF към Word', ru:'PDF в Word', uk:'PDF у Word', en:'PDF to Word', de:'PDF zu Word', fr:'PDF vers Word', es:'PDF a Word', 'es-MX':'PDF a Word', it:'Da PDF a Word', pt:'PDF para Word', ar:'PDF إلى Word', hi:'PDF से Word', ja:'PDF から Word', ky:'PDF → Word', 'zh-Hant':'PDF 轉 Word' },
  pdfd_pick: { bg:'Избери PDF файл', ru:'Выберите PDF-файл', uk:'Виберіть PDF-файл', en:'Choose a PDF file', de:'PDF-Datei wählen', fr:'Choisir un fichier PDF', es:'Elige un archivo PDF', 'es-MX':'Elige un archivo PDF', it:'Scegli un file PDF', pt:'Escolha um arquivo PDF', ar:'اختر ملف PDF', hi:'PDF फ़ाइल चुनें', ja:'PDFファイルを選択', ky:'PDF файлды тандаңыз', 'zh-Hant':'選擇 PDF 檔案' },
  pdfd_pagebreaks: { bg:'Нова страница в Word за всяка страница от PDF-а', ru:'Новая страница в Word для каждой страницы PDF', uk:'Нова сторінка у Word для кожної сторінки PDF', en:'New Word page for every PDF page', de:'Neue Word-Seite für jede PDF-Seite', fr:'Nouvelle page Word pour chaque page du PDF', es:'Nueva página de Word por cada página del PDF', 'es-MX':'Nueva página de Word por cada página del PDF', it:'Nuova pagina Word per ogni pagina del PDF', pt:'Nova página Word para cada página do PDF', ar:'صفحة Word جديدة لكل صفحة من PDF', hi:'PDF की हर पेज के लिए Word में नया पेज', ja:'PDF の各ページごとに Word で改ページ', ky:'PDF-тин ар бир барагы үчүн Word-до жаңы барак', 'zh-Hant':'PDF 每一頁在 Word 中另起新頁' },
  pdfd_hint: { bg:'Текстът се чете страница по страница и се подрежда в абзаци. Работи за PDF-и с истински текст. Сканирани документи (снимки на страници) нямат текст за извличане. Форматирането (шрифтове, таблици, картинки) не се пренася — пренася се текстът.', ru:'Текст читается постранично и складывается в абзацы. Работает для PDF с настоящим текстом. Сканированные документы (фото страниц) не содержат текста. Форматирование (шрифты, таблицы, картинки) не переносится — переносится текст.', uk:'Текст читається посторінково і складається в абзаци. Працює для PDF зі справжнім текстом. Скановані документи (фото сторінок) не мають тексту. Форматування (шрифти, таблиці, зображення) не переноситься — переноситься текст.', en:'The text is read page by page and arranged into paragraphs. Works for PDFs with real text. Scanned documents (photos of pages) contain no text. Formatting (fonts, tables, images) is not carried over — the text is.', de:'Der Text wird Seite für Seite gelesen und in Absätze gegliedert. Funktioniert bei PDFs mit echtem Text. Gescannte Dokumente (Seitenfotos) enthalten keinen Text. Formatierung (Schriften, Tabellen, Bilder) wird nicht übernommen — der Text schon.', fr:'Le texte est lu page par page et organisé en paragraphes. Fonctionne pour les PDF avec du vrai texte. Les documents scannés (photos de pages) n’ont pas de texte. La mise en forme (polices, tableaux, images) n’est pas transférée — le texte l’est.', es:'El texto se lee página por página y se organiza en párrafos. Funciona con PDF de texto real. Los documentos escaneados (fotos de páginas) no tienen texto. El formato (fuentes, tablas, imágenes) no se transfiere — el texto sí.', 'es-MX':'El texto se lee página por página y se organiza en párrafos. Funciona con PDF de texto real. Los documentos escaneados (fotos de páginas) no tienen texto. El formato (fuentes, tablas, imágenes) no se transfiere — el texto sí.', it:'Il testo viene letto pagina per pagina e organizzato in paragrafi. Funziona con PDF con testo reale. I documenti scansionati (foto di pagine) non hanno testo. La formattazione (font, tabelle, immagini) non viene trasferita — il testo sì.', pt:'O texto é lido página a página e organizado em parágrafos. Funciona com PDF de texto real. Documentos digitalizados (fotos de páginas) não têm texto. A formatação (fontes, tabelas, imagens) não é transferida — o texto é.', ar:'يُقرأ النص صفحة صفحة ويُرتب في فقرات. يعمل مع ملفات PDF ذات نص حقيقي. المستندات الممسوحة ضوئيًا (صور صفحات) لا تحتوي نصًا. التنسيق (الخطوط والجداول والصور) لا يُنقل — يُنقل النص.', hi:'टेक्स्ट पेज-दर-पेज पढ़ा जाता है और अनुच्छेदों में लगाया जाता है। असली टेक्स्ट वाले PDF के लिए काम करता है। स्कैन किए दस्तावेज़ (पेज की फ़ोटो) में टेक्स्ट नहीं होता। फ़ॉर्मेटिंग (फ़ॉन्ट, टेबल, चित्र) नहीं जाती — टेक्स्ट जाता है।', ja:'テキストはページごとに読み取られ、段落にまとめられます。実際のテキストを含む PDF で動作します。スキャン文書（ページの画像）にはテキストがありません。書式（フォント・表・画像）は引き継がれません — テキストのみです。', ky:'Текст барактап окулуп, абзацтарга жайгаштырылат. Чыныгы тексти бар PDF үчүн иштейт. Сканерленген документтерде (барак сүрөттөрү) текст жок. Форматтоо (шрифттер, таблицалар, сүрөттөр) өтпөйт — текст өтөт.', 'zh-Hant':'逐頁讀取文字並整理成段落。適用於含真實文字的 PDF。掃描文件（頁面照片）沒有文字。格式（字型、表格、圖片）不會轉移 — 只轉移文字。' },
  pdfd_go: { bg:'Направи Word файл', ru:'Создать файл Word', uk:'Створити файл Word', en:'Make Word file', de:'Word-Datei erstellen', fr:'Créer le fichier Word', es:'Crear archivo Word', 'es-MX':'Crear archivo Word', it:'Crea file Word', pt:'Criar arquivo Word', ar:'إنشاء ملف Word', hi:'Word फ़ाइल बनाएं', ja:'Word ファイルを作成', ky:'Word файл түзүү', 'zh-Hant':'產生 Word 檔' },
  pdfd_need_file: { bg:'Избери PDF файл.', ru:'Выберите PDF-файл.', uk:'Виберіть PDF-файл.', en:'Choose a PDF file.', de:'PDF-Datei wählen.', fr:'Choisissez un fichier PDF.', es:'Elige un archivo PDF.', 'es-MX':'Elige un archivo PDF.', it:'Scegli un file PDF.', pt:'Escolha um arquivo PDF.', ar:'اختر ملف PDF.', hi:'PDF फ़ाइल चुनें।', ja:'PDFファイルを選択してください。', ky:'PDF файлды тандаңыз.', 'zh-Hant':'請選擇 PDF 檔案。' },
  pdfd_working: { bg:'Обработвам…', ru:'Обрабатываю…', uk:'Обробляю…', en:'Processing…', de:'Verarbeite…', fr:'Traitement…', es:'Procesando…', 'es-MX':'Procesando…', it:'Elaborazione…', pt:'Processando…', ar:'جارٍ المعالجة…', hi:'प्रक्रिया जारी…', ja:'処理中…', ky:'Иштетилүүдө…', 'zh-Hant':'處理中…' },
  pdfd_done: { bg:'Готово! Word файлът (.docx) е свален: {0} стр., {1} абзаца.', ru:'Готово! Файл Word (.docx) скачан: {0} стр., {1} абзацев.', uk:'Готово! Файл Word (.docx) завантажено: {0} стор., {1} абзаців.', en:'Done! The Word file (.docx) was downloaded: {0} pages, {1} paragraphs.', de:'Fertig! Die Word-Datei (.docx) wurde heruntergeladen: {0} Seiten, {1} Absätze.', fr:'Terminé ! Le fichier Word (.docx) a été téléchargé : {0} pages, {1} paragraphes.', es:'¡Listo! El archivo Word (.docx) se descargó: {0} páginas, {1} párrafos.', 'es-MX':'¡Listo! El archivo Word (.docx) se descargó: {0} páginas, {1} párrafos.', it:'Fatto! Il file Word (.docx) è stato scaricato: {0} pagine, {1} paragrafi.', pt:'Pronto! O arquivo Word (.docx) foi baixado: {0} páginas, {1} parágrafos.', ar:'تم! نُزّل ملف Word ‏(.docx): {0} صفحة، {1} فقرة.', hi:'हो गया! Word फ़ाइल (.docx) डाउनलोड हुई: {0} पेज, {1} अनुच्छेद।', ja:'完了！Word ファイル（.docx）をダウンロードしました: {0} ページ、{1} 段落。', ky:'Даяр! Word файл (.docx) жүктөлдү: {0} барак, {1} абзац.', 'zh-Hant':'完成！Word 檔（.docx）已下載：{0} 頁、{1} 段。' },
  pdfd_empty: { bg:'В този PDF няма текст за извличане (вероятно е сканиран — само снимки на страници).', ru:'В этом PDF нет текста для извлечения (вероятно, это скан — только изображения страниц).', uk:'У цьому PDF немає тексту для витягання (ймовірно, це скан — лише зображення сторінок).', en:'This PDF has no extractable text (it is probably scanned — page images only).', de:'Dieses PDF enthält keinen extrahierbaren Text (wahrscheinlich ein Scan — nur Seitenbilder).', fr:'Ce PDF ne contient pas de texte extractible (probablement un scan — images de pages uniquement).', es:'Este PDF no tiene texto extraíble (probablemente es un escaneo — solo imágenes de páginas).', 'es-MX':'Este PDF no tiene texto extraíble (probablemente es un escaneo — solo imágenes de páginas).', it:'Questo PDF non ha testo estraibile (probabilmente è una scansione — solo immagini di pagine).', pt:'Este PDF não tem texto extraível (provavelmente é digitalizado — apenas imagens de páginas).', ar:'لا يحتوي هذا الـPDF على نص قابل للاستخراج (على الأرجح ممسوح ضوئيًا — صور صفحات فقط).', hi:'इस PDF में निकालने लायक टेक्स्ट नहीं है (शायद स्कैन है — सिर्फ़ पेज की छवियां)।', ja:'この PDF には抽出できるテキストがありません（おそらくスキャン — ページ画像のみ）。', ky:'Бул PDF-те алына турган текст жок (кыязы, скан — барак сүрөттөрү гана).', 'zh-Hant':'此 PDF 沒有可擷取的文字（可能是掃描檔 — 僅頁面圖片）。' },
  pdfd_error: { bg:'Грешка: {0}', ru:'Ошибка: {0}', uk:'Помилка: {0}', en:'Error: {0}', de:'Fehler: {0}', fr:'Erreur : {0}', es:'Error: {0}', 'es-MX':'Error: {0}', it:'Errore: {0}', pt:'Erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'Ката: {0}', 'zh-Hant':'錯誤：{0}' }
});

export const title = t('pdfd_title');

// ── Редовете на една страница → абзаци ──────────────────────────────────────
function pageToParagraphs(textContent) {
  const lines = {};
  for (const it of textContent.items) {
    if (!it.str || !it.str.trim()) continue;
    const key = Math.round(it.transform[5] / 3) * 3;   // толеранс 3pt по вертикала
    if (!lines[key]) lines[key] = { y: it.transform[5], items: [] };
    lines[key].items.push({ x: it.transform[4], str: it.str });
  }
  const arr = Object.values(lines).sort((a, b) => b.y - a.y);   // отгоре надолу
  const lineTexts = [];
  const gaps = [];
  for (let j = 0; j < arr.length; j++) {
    arr[j].items.sort((a, b) => a.x - b.x);
    let s = '';
    for (const piece of arr[j].items) {
      if (s && !/\s$/.test(s) && !/^\s/.test(piece.str)) s += ' ';
      s += piece.str;
    }
    lineTexts.push(s.replace(/\s+/g, ' ').trim());
    if (j > 0) gaps.push(arr[j - 1].y - arr[j].y);
  }
  // праг = ДОЛНАТА медиана на дупките × 1.8 (горната слива абзаци при малко редове)
  const sorted = gaps.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 14;
  const paragraphs = [];
  let cur = '';
  for (let n = 0; n < lineTexts.length; n++) {
    if (n > 0 && gaps[n - 1] > median * 1.8) { if (cur) paragraphs.push(cur); cur = ''; }
    cur = cur ? (cur + ' ' + lineTexts[n]) : lineTexts[n];
  }
  if (cur) paragraphs.push(cur);
  return paragraphs;
}

// ── Минимален .docx (ZIP „store" + CRC32) ───────────────────────────────────
let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t2 = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t2[n] = c >>> 0; }
  CRC_TABLE = t2; return t2;
}
function crc32(bytes) {
  const t2 = crcTable(); let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = t2[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files) {
  const enc = new TextEncoder();
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data, crc = crc32(data), size = data.length;
    const lh = new Uint8Array(30 + nameBytes.length); const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true); lh.set(nameBytes, 30);
    parts.push(lh, data);
    const ch = new Uint8Array(46 + nameBytes.length); const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true); ch.set(nameBytes, 46);
    central.push(ch);
    offset += lh.length + data.length;
  }
  let centralSize = 0; for (const c2 of central) centralSize += c2.length;
  const eocd = new Uint8Array(22); const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, eocd], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');   // контролни знаци — невалидни в XML
}
function buildDocx(pages, pageBreaks) {
  let body = '';
  for (let p = 0; p < pages.length; p++) {
    if (p > 0 && pageBreaks) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    for (const para of pages[p]) body += '<w:p><w:r><w:t xml:space="preserve">' + xmlEscape(para) + '</w:t></w:r></w:p>';
  }
  if (!body) body = '<w:p/>';
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>';
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  const enc = new TextEncoder();
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'word/document.xml', data: enc.encode(documentXml) }
  ]);
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>${t('pdfd_pick')}</label>
      <input type="file" id="pdfFile" accept="application/pdf" />
      <label style="display:flex;align-items:center;gap:8px;font-weight:400">
        <input type="checkbox" id="pageBreaks" checked style="width:18px;height:18px" /> ${t('pdfd_pagebreaks')}
      </label>
      <p class="hint">${t('pdfd_hint')}</p>
      <button class="btn" id="go">${t('pdfd_go')}</button>
      <div class="bar" id="barWrap" style="display:none"><div id="bar"></div></div>
      <div class="status" id="status"></div>
    </div>`;

  const status = root.querySelector('#status');
  const btn = root.querySelector('#go');
  btn.addEventListener('click', async () => {
    const f = root.querySelector('#pdfFile').files[0];
    if (!f) { setStatus(status, 'err', t('pdfd_need_file')); return; }
    const pageBreaks = root.querySelector('#pageBreaks').checked;
    btn.disabled = true;
    const barWrap = root.querySelector('#barWrap'); const bar = root.querySelector('#bar');
    barWrap.style.display = '';
    setStatus(status, 'work', t('pdfd_working'));
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pages = [];
      let totalParas = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const paras = pageToParagraphs(await page.getTextContent());
        totalParas += paras.length;
        pages.push(paras);
        bar.style.width = Math.round(i / pdf.numPages * 100) + '%';
      }
      if (!totalParas) { setStatus(status, 'err', t('pdfd_empty')); return; }
      const blob = buildDocx(pages, pageBreaks);
      downloadBlob(blob, (f.name.replace(/\.pdf$/i, '') || 'document') + '.docx');
      setStatus(status, 'ok', tf('pdfd_done', pdf.numPages, totalParas));
    } catch (e) {
      setStatus(status, 'err', tf('pdfd_error', (e && e.message) || e));
    } finally {
      btn.disabled = false;
    }
  });
}
