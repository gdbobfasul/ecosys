// Version: 1.0018
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
  pdfd_error: { bg:'Грешка: {0}', ru:'Ошибка: {0}', uk:'Помилка: {0}', en:'Error: {0}', de:'Fehler: {0}', fr:'Erreur : {0}', es:'Error: {0}', 'es-MX':'Error: {0}', it:'Errore: {0}', pt:'Erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'Ката: {0}', 'zh-Hant':'錯誤：{0}' },
  pdfd_mode: { bg:'Режим', ru:'Режим', uk:'Режим', en:'Mode', de:'Modus', fr:'Mode', es:'Modo', 'es-MX':'Modo', it:'Modalità', pt:'Modo', ar:'الوضع', hi:'मोड', ja:'モード', ky:'Режим', 'zh-Hant':'模式' },
  pdfd_mode_exact: { bg:'Точно копие — страниците влизат като картинки (пази шрифтове, таблици, знаци 1:1; текстът не се редактира)', ru:'Точная копия — страницы входят как картинки (сохраняет шрифты, таблицы, знаки 1:1; текст не редактируется)', uk:'Точна копія — сторінки входять як зображення (зберігає шрифти, таблиці, знаки 1:1; текст не редагується)', en:'Exact copy — pages go in as images (keeps fonts, tables, symbols 1:1; text is not editable)', de:'Exakte Kopie — Seiten als Bilder (Schriften, Tabellen, Zeichen 1:1; Text nicht bearbeitbar)', fr:'Copie exacte — les pages entrent comme images (polices, tableaux, symboles 1:1 ; texte non modifiable)', es:'Copia exacta — las páginas entran como imágenes (mantiene fuentes, tablas, símbolos 1:1; el texto no es editable)', 'es-MX':'Copia exacta — las páginas entran como imágenes (mantiene fuentes, tablas, símbolos 1:1; el texto no es editable)', it:'Copia esatta — le pagine entrano come immagini (mantiene font, tabelle, simboli 1:1; testo non modificabile)', pt:'Cópia exata — as páginas entram como imagens (mantém fontes, tabelas, símbolos 1:1; o texto não é editável)', ar:'نسخة طبق الأصل — تدخل الصفحات كصور (تحافظ على الخطوط والجداول والرموز 1:1؛ النص غير قابل للتحرير)', hi:'सटीक प्रति — पेज छवियों के रूप में जाते हैं (फ़ॉन्ट, टेबल, चिह्न 1:1; टेक्स्ट संपादन योग्य नहीं)', ja:'完全コピー — ページを画像として挿入（フォント・表・記号を1:1で保持。テキストは編集不可）', ky:'Так көчүрмө — барактар сүрөт катары кирет (шрифт/таблица/белгилер 1:1; текст оңдолбойт)', 'zh-Hant':'精確副本 — 頁面以圖片放入（字型、表格、符號 1:1；文字不可編輯）' },
  pdfd_mode_edit: { bg:'Редактируем текст — запазва размер/удебелен/курсив/шрифт и разпознава таблици (сложните подредби може да се разместят)', ru:'Редактируемый текст — сохраняет размер/жирный/курсив/шрифт и распознаёт таблицы (сложная вёрстка может сместиться)', uk:'Редагований текст — зберігає розмір/жирний/курсив/шрифт і розпізнає таблиці (складна верстка може зміститися)', en:'Editable text — keeps size/bold/italic/font and detects tables (complex layouts may shift)', de:'Bearbeitbarer Text — behält Größe/Fett/Kursiv/Schrift und erkennt Tabellen (komplexe Layouts können verrutschen)', fr:'Texte modifiable — garde taille/gras/italique/police et détecte les tableaux (les mises en page complexes peuvent bouger)', es:'Texto editable — mantiene tamaño/negrita/cursiva/fuente y detecta tablas (los diseños complejos pueden moverse)', 'es-MX':'Texto editable — mantiene tamaño/negrita/cursiva/fuente y detecta tablas (los diseños complejos pueden moverse)', it:'Testo modificabile — mantiene dimensione/grassetto/corsivo/font e rileva tabelle (i layout complessi possono spostarsi)', pt:'Texto editável — mantém tamanho/negrito/itálico/fonte e detecta tabelas (layouts complexos podem se deslocar)', ar:'نص قابل للتحرير — يحافظ على الحجم/الغامق/المائل/الخط ويكتشف الجداول (قد تتزحزح التخطيطات المعقدة)', hi:'संपादन योग्य टेक्स्ट — आकार/बोल्ड/इटैलिक/फ़ॉन्ट रखता है और टेबल पहचानता है (जटिल लेआउट खिसक सकते हैं)', ja:'編集可能テキスト — サイズ・太字・斜体・フォントを保持し、表を検出（複雑なレイアウトはずれる場合あり）', ky:'Оңдолуучу текст — өлчөм/калың/курсив/шрифтти сактайт жана таблицаларды таанайт (татаал жайгашуулар жылышы мүмкүн)', 'zh-Hant':'可編輯文字 — 保留大小／粗體／斜體／字型並偵測表格（複雜版面可能會移位）' },
});

export const title = t('pdfd_title');

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
// ── Извличане С ФОРМАТ: страница → модел { blocks: [ {type:'p',runs}|{type:'table',rows} ] }
function pageToModel(textContent) {
  var styles = textContent.styles || {};
  // 1) редове по y (толеранс 3)
  var lineMap = {};
  for (var ii = 0; ii < textContent.items.length; ii++) {
    var it = textContent.items[ii];
    if (!it.str || !it.str.trim()) continue;
    var key = Math.round(it.transform[5] / 3) * 3;
    if (!lineMap[key]) lineMap[key] = { y: it.transform[5], items: [] };
    var st = styles[it.fontName] || {};
    var fam = String(st.fontFamily || '');
    var size = Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 11;
    lineMap[key].items.push({
      x: it.transform[4],
      w: it.width || 0,
      str: it.str,
      size: size,
      bold: /bold|black|heavy/i.test((it.realFont || '') + ' ' + it.fontName + ' ' + fam),
      italic: /italic|oblique/i.test((it.realFont || '') + ' ' + it.fontName + ' ' + fam),
      font: (it.realFont ? String(it.realFont).replace(/^[A-Z]{6}\+/, '').replace(/[-,](Bold|Italic|Oblique|Regular|Light|Medium).*$/i, '') : '') || fam.replace(/^["']|["']$/g, '').split(',')[0] || null
    });
  }
  var lines = Object.keys(lineMap).map(function (k) { return lineMap[k]; });
  lines.sort(function (a, b) { return b.y - a.y; });
  lines.forEach(function (ln) { ln.items.sort(function (a, b) { return a.x - b.x; }); });

  // 2) „клетки" в реда: разцепваме при ХОРИЗОНТАЛНА дупка ≥ 12 (координати на PDF)
  function lineCells(ln) {
    var cells = []; var cur = null; var prevEnd = null;
    for (var i2 = 0; i2 < ln.items.length; i2++) {
      var t2 = ln.items[i2];
      if (cur && prevEnd != null && (t2.x - prevEnd) < 12) {
        cur.items.push(t2);
      } else {
        cur = { x: t2.x, items: [t2] }; cells.push(cur);
      }
      prevEnd = t2.x + (t2.w || t2.str.length * t2.size * 0.5);
    }
    return cells;
  }

  // 3) ТАБЛИЦИ чрез КОЛОННА РЕКОНСТРУКЦИЯ (v3): последователните редове с ≥2 клетки
  // се събират в блок; от ВСИЧКИ техни клетки се клъстерират началните x-та → колоните
  // на таблицата; всяка клетка отива в най-близката колона. Така работи и с OCR слой
  // (сканирани документи), където колоните не са идеално подравнени, а клетка може да
  // се пренася на следващ ред (влиза като отделен ред от таблицата — приемливо).
  var pageLeft = Infinity, pageRight = 0;
  for (var pl = 0; pl < lines.length; pl++) {
    var ln0 = lines[pl];
    var first = ln0.items[0], last = ln0.items[ln0.items.length - 1];
    if (first.x < pageLeft) pageLeft = first.x;
    var re2 = last.x + (last.w || last.str.length * last.size * 0.5);
    if (re2 > pageRight) pageRight = re2;
  }
  if (!isFinite(pageLeft)) { pageLeft = 0; pageRight = 612; }

  function clusterColumns(rows) {
    var xs = [];
    rows.forEach(function (cells) { cells.forEach(function (c) { xs.push(c.x); }); });
    xs.sort(function (a, b) { return a - b; });
    var cols = [];
    for (var xi = 0; xi < xs.length; xi++) {
      if (!cols.length || xs[xi] - cols[cols.length - 1].sum / cols[cols.length - 1].n > 22) {
        cols.push({ sum: xs[xi], n: 1 });
      } else { cols[cols.length - 1].sum += xs[xi]; cols[cols.length - 1].n++; }
    }
    return cols.map(function (c) { return c.sum / c.n; });
  }

  function lineAlign(ln) {
    var first = ln.items[0], last = ln.items[ln.items.length - 1];
    var leftGap = first.x - pageLeft;
    var rightGap = pageRight - (last.x + (last.w || last.str.length * last.size * 0.5));
    if (leftGap > 40 && rightGap > 40 && Math.abs(leftGap - rightGap) < Math.max(30, (leftGap + rightGap) * 0.25)) return 'center';
    if (rightGap < 25 && leftGap > 120) return 'right';
    return null;
  }

  var blocks = [];
  var i3 = 0;
  var gaps = [];
  for (var g = 1; g < lines.length; g++) gaps.push(lines[g - 1].y - lines[g].y);
  var sortedG = gaps.slice().sort(function (a, b) { return a - b; });
  var median = sortedG.length ? sortedG[Math.floor((sortedG.length - 1) / 2)] : 14;

  while (i3 < lines.length) {
    var cells0 = lineCells(lines[i3]);
    if (cells0.length >= 2) {
      // събери блока от последователни многоклетъчни редове
      var rawRows = [cells0]; var j3 = i3 + 1;
      while (j3 < lines.length) {
        var cj = lineCells(lines[j3]);
        if (cj.length >= 2) { rawRows.push(cj); j3++; }
        else if (cj.length === 1 && j3 + 1 < lines.length && lineCells(lines[j3 + 1]).length >= 2) {
          // единичен ред МЕЖДУ табличните (пренесена клетка, напр. втори ред от име) —
          // влиза като ред на таблицата в своята колона, без да я къса
          rawRows.push(cj); j3++;
        }
        else break;
      }
      if (rawRows.length >= 2) {
        var colXs = clusterColumns(rawRows);
        if (colXs.length >= 2) {
          var grid = rawRows.map(function (cells) {
            var row = new Array(colXs.length);
            cells.forEach(function (c) {
              var best = 0, bd = Infinity;
              for (var ci = 0; ci < colXs.length; ci++) {
                var d = Math.abs(c.x - colXs[ci]);
                if (d < bd) { bd = d; best = ci; }
              }
              if (row[best]) row[best].items = row[best].items.concat(c.items);
              else row[best] = { x: c.x, items: c.items };
            });
            return row;
          });
          blocks.push({ type: 'table', grid: grid, nCols: colXs.length });
          i3 = j3; continue;
        }
      }
    }
    // обикновен ред → абзац (слепване по вертикалната дупка), с подравняване
    var para = { type: 'p', lines: [lines[i3]], align: lineAlign(lines[i3]) };
    var k3 = i3 + 1;
    while (k3 < lines.length) {
      var gap = lines[k3 - 1].y - lines[k3].y;
      if (gap > median * 1.8) break;
      if (lineCells(lines[k3]).length >= 2) break;
      para.lines.push(lines[k3]); k3++;
    }
    blocks.push(para);
    i3 = k3;
  }
  return blocks;
}

// ── WordprocessingML ──
function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
function runXml(t2) {
  var sz = Math.max(2, Math.round(t2.size * 2));     // половин пунктове
  var pr = '<w:rPr>' +
    (t2.font ? '<w:rFonts w:ascii="' + xmlEsc(t2.font) + '" w:hAnsi="' + xmlEsc(t2.font) + '"/>' : '') +
    (t2.bold ? '<w:b/>' : '') + (t2.italic ? '<w:i/>' : '') +
    '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr>';
  return '<w:r>' + pr + '<w:t xml:space="preserve">' + xmlEsc(t2.str) + '</w:t></w:r>';
}
function itemsToRuns(items) {
  // съседни парчета с еднакъв стил → един пас; интервал между отдалечени
  var out = ''; var prev = null;
  for (var i4 = 0; i4 < items.length; i4++) {
    var t3 = items[i4];
    if (prev && !/\s$/.test(prev.str) && !/^\s/.test(t3.str)) {
      out += runXml({ str: ' ', size: t3.size, bold: false, italic: false, font: t3.font });
    }
    out += runXml(t3); prev = t3;
  }
  return out;
}
function paraXml(lines, align) {
  // редовете на един абзац се сливат; всеки ред пази своите стилови пасове
  var runs = '';
  for (var i5 = 0; i5 < lines.length; i5++) {
    if (i5 > 0) runs += runXml({ str: ' ', size: lines[i5].items[0].size, bold: false, italic: false, font: null });
    runs += itemsToRuns(lines[i5].items);
  }
  var pr = align ? '<w:pPr><w:jc w:val="' + align + '"/></w:pPr>' : '';
  return '<w:p>' + pr + runs + '</w:p>';
}
function tableXml(grid, nCols) {
  var xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>' +
    '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:color="999999"/>' +
    '<w:bottom w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/>' +
    '<w:insideH w:val="single" w:sz="4" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:color="999999"/></w:tblBorders></w:tblPr>';
  grid.forEach(function (row) {
    xml += '<w:tr>';
    for (var c5 = 0; c5 < nCols; c5++) {
      var cell = row[c5];
      xml += '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p>' +
        (cell ? itemsToRuns(cell.items) : '') + '</w:p></w:tc>';
    }
    xml += '</w:tr>';
  });
  xml += '</w:tbl><w:p/>';
  return xml;
}

// ── Сглобяване на .docx (двата режима). images = [{data:Uint8Array,wPx,hPx}] при 'exact'.
function buildDocx2(opts) {
  var enc = new TextEncoder();
  var files = [];
  var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  var docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  var body = '';
  if (opts.mode === 'exact') {
    for (var p5 = 0; p5 < opts.images.length; p5++) {
      var img = opts.images[p5];
      var rid = 'rImg' + (p5 + 1);
      docRels += '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page' + (p5 + 1) + '.png"/>';
      files.push({ name: 'word/media/page' + (p5 + 1) + '.png', data: img.data });
      // ~16.5cm печатна ширина → EMU (9525 на пиксел при 96dpi мащабираме към ширината)
      var maxW = 5940000;   // ~15.7 см
      var scale = maxW / (img.wPx * 9525);
      var cx = Math.round(img.wPx * 9525 * Math.min(1, scale));
      var cy = Math.round(img.hPx * 9525 * Math.min(1, scale));
      if (p5 > 0) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      body += '<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
        '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + (p5 + 1) + '" name="page' + (p5 + 1) + '"/>' +
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:nvPicPr><pic:cNvPr id="' + (p5 + 1) + '" name="page' + (p5 + 1) + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
        '<pic:blipFill><a:blip r:embed="' + rid + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
    }
  } else {
    for (var p6 = 0; p6 < opts.pages.length; p6++) {
      if (p6 > 0 && opts.pageBreaks) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      var blocks = opts.pages[p6];
      for (var b6 = 0; b6 < blocks.length; b6++) {
        var blk = blocks[b6];
        body += blk.type === 'table' ? tableXml(blk.grid, blk.nCols) : paraXml(blk.lines, blk.align);
      }
    }
  }
  if (!body) body = '<w:p/>';
  docRels += '</Relationships>';
  var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>';
  var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  files.unshift({ name: '[Content_Types].xml', data: enc.encode(contentTypes) });
  files.push({ name: '_rels/.rels', data: enc.encode(rels) });
  files.push({ name: 'word/_rels/document.xml.rels', data: enc.encode(docRels) });
  files.push({ name: 'word/document.xml', data: enc.encode(documentXml) });
  return files;   // подава се на zipStore(...)
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>${t('pdfd_pick')}</label>
      <input type="file" id="pdfFile" accept="application/pdf" />
      <label>${t('pdfd_mode')}</label>
      <select id="pdfMode">
        <option value="exact">${t('pdfd_mode_exact')}</option>
        <option value="editable">${t('pdfd_mode_edit')}</option>
      </select>
      <label id="pbWrap" style="display:none;align-items:center;gap:8px;font-weight:400">
        <input type="checkbox" id="pageBreaks" checked style="width:18px;height:18px" /> ${t('pdfd_pagebreaks')}
      </label>
      <p class="hint">${t('pdfd_hint')}</p>
      <button class="btn" id="go">${t('pdfd_go')}</button>
      <div class="bar" id="barWrap" style="display:none"><div id="bar"></div></div>
      <div class="status" id="status"></div>
    </div>`;

  const status = root.querySelector('#status');
  const modeSel = root.querySelector('#pdfMode');
  modeSel.addEventListener('change', () => {
    root.querySelector('#pbWrap').style.display = modeSel.value === 'editable' ? 'flex' : 'none';
  });
  const btn = root.querySelector('#go');
  btn.addEventListener('click', async () => {
    const f = root.querySelector('#pdfFile').files[0];
    if (!f) { setStatus(status, 'err', t('pdfd_need_file')); return; }
    const mode = modeSel.value;
    const pageBreaks = root.querySelector('#pageBreaks').checked;
    btn.disabled = true;
    const barWrap = root.querySelector('#barWrap'); const bar = root.querySelector('#bar');
    barWrap.style.display = '';
    setStatus(status, 'work', t('pdfd_working'));
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let filesOut;
      if (mode === 'exact') {
        // всяка страница → картинка (пази шрифтове/таблици/знаци 1:1)
        const images = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
          images.push({ data: new Uint8Array(await blob.arrayBuffer()), wPx: canvas.width, hPx: canvas.height });
          bar.style.width = Math.round(i / pdf.numPages * 100) + '%';
        }
        filesOut = buildDocx2({ mode: 'exact', images });
      } else {
        // редактируем текст С ФОРМАТ (размер/удебелен/курсив/шрифт) + таблици
        const pages = [];
        let total = 0;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          try { await page.getOperatorList(); } catch (e) {}   // зарежда шрифтовете в commonObjs (за bold/името)
          try { for (const it of tc.items) { if (it.fontName && page.commonObjs.has(it.fontName)) { const fo = page.commonObjs.get(it.fontName); if (fo && fo.name) it.realFont = fo.name; } } } catch (e) {}
          const blocks = pageToModel(tc);
          total += blocks.length;
          pages.push(blocks);
          bar.style.width = Math.round(i / pdf.numPages * 100) + '%';
        }
        if (!total) { setStatus(status, 'err', t('pdfd_empty')); return; }
        filesOut = buildDocx2({ mode: 'editable', pages, pageBreaks });
      }
      const blob = zipStore(filesOut);
      downloadBlob(blob, (f.name.replace(/\.pdf$/i, '') || 'document') + '.docx');
      setStatus(status, 'ok', tf('pdfd_done', pdf.numPages, mode === 'exact' ? pdf.numPages : '~'));
    } catch (e) {
      setStatus(status, 'err', tf('pdfd_error', (e && e.message) || e));
    } finally {
      btn.disabled = false;
    }
  });
}
