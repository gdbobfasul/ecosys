// Свиване на PDF — растеризира всяка страница с pdf.js, после сглобява нов PDF.
// Изцяло офлайн.
import { PDFDocument } from 'pdf-lib';
import { setStatus, downloadBlob, fmtSize } from '../core/ui.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { t, tf, register } from '../core/i18n.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

register({
  pdfc_title: { bg:'Свиване на PDF', ru:'Сжатие PDF', uk:'Стиснення PDF', en:'PDF compress', de:'PDF komprimieren', fr:'Compresser PDF', es:'Comprimir PDF', 'es-MX':'Comprimir PDF', it:'Comprimi PDF', pt:'Comprimir PDF', ar:'ضغط PDF', hi:'PDF संपीड़न', ja:'PDF圧縮', ky:'PDF кысуу', 'zh-Hant':'PDF 壓縮' },
  pdfc_pick: { bg:'Избери PDF файл', ru:'Выберите PDF-файл', uk:'Виберіть PDF-файл', en:'Choose a PDF file', de:'PDF-Datei wählen', fr:'Choisir un fichier PDF', es:'Elige un archivo PDF', 'es-MX':'Elige un archivo PDF', it:'Scegli un file PDF', pt:'Escolha um arquivo PDF', ar:'اختر ملف PDF', hi:'PDF फ़ाइल चुनें', ja:'PDFファイルを選択', ky:'PDF файлды тандаңыз', 'zh-Hant':'選擇 PDF 檔案' },
  pdfc_level: { bg:'Ниво на свиване', ru:'Уровень сжатия', uk:'Рівень стиснення', en:'Compression level', de:'Komprimierungsstufe', fr:'Niveau de compression', es:'Nivel de compresión', 'es-MX':'Nivel de compresión', it:'Livello di compressione', pt:'Nível de compressão', ar:'مستوى الضغط', hi:'संपीड़न स्तर', ja:'圧縮レベル', ky:'Кысуу деңгээли', 'zh-Hant':'壓縮等級' },
  pdfc_high: { bg:'Силно (най-малък размер)', ru:'Сильное (наименьший размер)', uk:'Сильне (найменший розмір)', en:'High (smallest size)', de:'Stark (kleinste Größe)', fr:'Élevé (taille minimale)', es:'Alto (menor tamaño)', 'es-MX':'Alto (menor tamaño)', it:'Alto (dimensione minima)', pt:'Alto (menor tamanho)', ar:'عالٍ (أصغر حجم)', hi:'उच्च (सबसे छोटा आकार)', ja:'強（最小サイズ）', ky:'Күчтүү (эң кичине өлчөм)', 'zh-Hant':'高（最小體積）' },
  pdfc_medium: { bg:'Средно (баланс)', ru:'Среднее (баланс)', uk:'Середнє (баланс)', en:'Medium (balanced)', de:'Mittel (ausgewogen)', fr:'Moyen (équilibré)', es:'Medio (equilibrado)', 'es-MX':'Medio (equilibrado)', it:'Medio (bilanciato)', pt:'Médio (equilibrado)', ar:'متوسط (متوازن)', hi:'मध्यम (संतुलित)', ja:'中（バランス）', ky:'Орточо (тең салмак)', 'zh-Hant':'中（平衡）' },
  pdfc_low: { bg:'Леко (по-добро качество)', ru:'Слабое (лучшее качество)', uk:'Слабке (краща якість)', en:'Light (better quality)', de:'Leicht (bessere Qualität)', fr:'Léger (meilleure qualité)', es:'Ligero (mejor calidad)', 'es-MX':'Ligero (mejor calidad)', it:'Leggero (qualità migliore)', pt:'Leve (melhor qualidade)', ar:'خفيف (جودة أفضل)', hi:'हल्का (बेहतर गुणवत्ता)', ja:'弱（高品質）', ky:'Жеңил (жакшы сапат)', 'zh-Hant':'輕（品質較佳）' },
  pdfc_hint: { bg:'Всяка страница се преобразува в изображение. Работи най-добре за сканирани документи. Текстът става неизбираем (растеризира се).', ru:'Каждая страница преобразуется в изображение. Лучше всего работает для сканированных документов. Текст становится невыделяемым (растрируется).', uk:'Кожна сторінка перетворюється на зображення. Найкраще працює для сканованих документів. Текст стає невиділюваним (растеризується).', en:'Each page is converted to an image. Works best for scanned documents. Text becomes unselectable (rasterized).', de:'Jede Seite wird in ein Bild umgewandelt. Funktioniert am besten bei gescannten Dokumenten. Text wird nicht mehr auswählbar (gerastert).', fr:'Chaque page est convertie en image. Fonctionne mieux pour les documents numérisés. Le texte devient non sélectionnable (rastérisé).', es:'Cada página se convierte en imagen. Funciona mejor con documentos escaneados. El texto deja de ser seleccionable (se rasteriza).', 'es-MX':'Cada página se convierte en imagen. Funciona mejor con documentos escaneados. El texto deja de ser seleccionable (se rasteriza).', it:'Ogni pagina viene convertita in immagine. Funziona meglio con documenti scansionati. Il testo non è più selezionabile (rasterizzato).', pt:'Cada página é convertida em imagem. Funciona melhor com documentos digitalizados. O texto deixa de ser selecionável (rasterizado).', ar:'تُحوَّل كل صفحة إلى صورة. يعمل بشكل أفضل مع المستندات الممسوحة ضوئيًا. يصبح النص غير قابل للتحديد (يُحوَّل إلى صورة).', hi:'प्रत्येक पेज एक छवि में बदल जाता है। स्कैन किए गए दस्तावेज़ों के लिए सबसे अच्छा काम करता है। टेक्स्ट चयन योग्य नहीं रहता (रास्टराइज़ हो जाता है)।', ja:'各ページを画像に変換します。スキャン文書に最適です。テキストは選択不可になります（ラスタライズ）。', ky:'Ар бир барак сүрөткө айланат. Сканерленген документтер үчүн эң жакшы иштейт. Текст тандалбай калат (растрленет).', 'zh-Hant':'每一頁都會轉換為圖片。最適合掃描文件。文字將無法選取（點陣化）。' },
  pdfc_go: { bg:'Свий PDF', ru:'Сжать PDF', uk:'Стиснути PDF', en:'Compress PDF', de:'PDF komprimieren', fr:'Compresser le PDF', es:'Comprimir PDF', 'es-MX':'Comprimir PDF', it:'Comprimi PDF', pt:'Comprimir PDF', ar:'اضغط PDF', hi:'PDF संपीड़ित करें', ja:'PDFを圧縮', ky:'PDF кысуу', 'zh-Hant':'壓縮 PDF' },
  pdfc_need_file: { bg:'Избери PDF файл.', ru:'Выберите PDF-файл.', uk:'Виберіть PDF-файл.', en:'Choose a PDF file.', de:'PDF-Datei wählen.', fr:'Choisissez un fichier PDF.', es:'Elige un archivo PDF.', 'es-MX':'Elige un archivo PDF.', it:'Scegli un file PDF.', pt:'Escolha um arquivo PDF.', ar:'اختر ملف PDF.', hi:'PDF फ़ाइल चुनें।', ja:'PDFファイルを選択してください。', ky:'PDF файлды тандаңыз.', 'zh-Hant':'請選擇 PDF 檔案。' },
  pdfc_working: { bg:'Обработвам…', ru:'Обрабатываю…', uk:'Обробляю…', en:'Processing…', de:'Verarbeite…', fr:'Traitement…', es:'Procesando…', 'es-MX':'Procesando…', it:'Elaborazione…', pt:'Processando…', ar:'جارٍ المعالجة…', hi:'प्रक्रिया जारी…', ja:'処理中…', ky:'Иштетилүүдө…', 'zh-Hant':'處理中…' },
  pdfc_done: { bg:'Готово: {0} → {1} (−{2}%). Файлът е свален.', ru:'Готово: {0} → {1} (−{2}%). Файл скачан.', uk:'Готово: {0} → {1} (−{2}%). Файл завантажено.', en:'Done: {0} → {1} (−{2}%). File downloaded.', de:'Fertig: {0} → {1} (−{2}%). Datei heruntergeladen.', fr:'Terminé : {0} → {1} (−{2}%). Fichier téléchargé.', es:'Listo: {0} → {1} (−{2}%). Archivo descargado.', 'es-MX':'Listo: {0} → {1} (−{2}%). Archivo descargado.', it:'Fatto: {0} → {1} (−{2}%). File scaricato.', pt:'Pronto: {0} → {1} (−{2}%). Arquivo baixado.', ar:'تم: {0} ← {1} (−{2}%). تم تنزيل الملف.', hi:'पूर्ण: {0} → {1} (−{2}%). फ़ाइल डाउनलोड हुई।', ja:'完了: {0} → {1} (−{2}%)。ファイルをダウンロードしました。', ky:'Бүттү: {0} → {1} (−{2}%). Файл жүктөлдү.', 'zh-Hant':'完成：{0} → {1}（−{2}%）。檔案已下載。' },
  pdfc_already: { bg:'{0} → {1}. Този PDF вече е оптимизиран. Файлът е свален.', ru:'{0} → {1}. Этот PDF уже оптимизирован. Файл скачан.', uk:'{0} → {1}. Цей PDF уже оптимізований. Файл завантажено.', en:'{0} → {1}. This PDF is already optimized. File downloaded.', de:'{0} → {1}. Diese PDF ist bereits optimiert. Datei heruntergeladen.', fr:'{0} → {1}. Ce PDF est déjà optimisé. Fichier téléchargé.', es:'{0} → {1}. Este PDF ya está optimizado. Archivo descargado.', 'es-MX':'{0} → {1}. Este PDF ya está optimizado. Archivo descargado.', it:'{0} → {1}. Questo PDF è già ottimizzato. File scaricato.', pt:'{0} → {1}. Este PDF já está otimizado. Arquivo baixado.', ar:'{0} ← {1}. هذا الملف PDF محسَّن بالفعل. تم تنزيل الملف.', hi:'{0} → {1}. यह PDF पहले से अनुकूलित है। फ़ाइल डाउनलोड हुई।', ja:'{0} → {1}。このPDFは既に最適化されています。ファイルをダウンロードしました。', ky:'{0} → {1}. Бул PDF мурунтан эле оптималдаштырылган. Файл жүктөлдү.', 'zh-Hant':'{0} → {1}。此 PDF 已經過最佳化。檔案已下載。' },
  pdfc_error: { bg:'Грешка: {0}', ru:'Ошибка: {0}', uk:'Помилка: {0}', en:'Error: {0}', de:'Fehler: {0}', fr:'Erreur : {0}', es:'Error: {0}', 'es-MX':'Error: {0}', it:'Errore: {0}', pt:'Erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'Ката: {0}', 'zh-Hant':'錯誤：{0}' }
});

export const title = t('pdfc_title');

const LEVELS = {
  high:   { scale: 1.0, quality: 0.5 },
  medium: { scale: 1.3, quality: 0.65 },
  low:    { scale: 1.7, quality: 0.8 }
};

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>${t('pdfc_pick')}</label>
      <input type="file" id="pdfFile" accept="application/pdf" />
      <label>${t('pdfc_level')}</label>
      <select id="level">
        <option value="high">${t('pdfc_high')}</option>
        <option value="medium" selected>${t('pdfc_medium')}</option>
        <option value="low">${t('pdfc_low')}</option>
      </select>
      <p class="hint">${t('pdfc_hint')}</p>
      <button class="btn" id="go">${t('pdfc_go')}</button>
      <div class="bar" id="barWrap" style="display:none"><div id="bar"></div></div>
      <div class="status" id="status"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  $('#go').addEventListener('click', async () => {
    const f = $('#pdfFile').files[0];
    if (!f) { setStatus($('#status'), 'err', t('pdfc_need_file')); return; }
    const cfg = LEVELS[$('#level').value] || LEVELS.medium;
    const origSize = f.size;
    const btn = $('#go'); btn.disabled = true;
    $('#barWrap').style.display = 'block';
    const bar = $('#bar');
    setStatus($('#status'), 'work', t('pdfc_working'));
    try {
      const src = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      const out = await PDFDocument.create();
      const n = src.numPages;
      for (let i = 1; i <= n; i++) {
        const page = await src.getPage(i);
        const vp = page.getViewport({ scale: cfg.scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const jpgDataUrl = canvas.toDataURL('image/jpeg', cfg.quality);
        const jpgBytes = await (await fetch(jpgDataUrl)).arrayBuffer();
        const img = await out.embedJpg(jpgBytes);
        const p = out.addPage([canvas.width, canvas.height]);
        p.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        bar.style.width = Math.round(i / n * 100) + '%';
      }
      const bytes = await out.save();
      const newSize = bytes.length;
      downloadBlob(bytes, (f.name.replace(/\.pdf$/i, '') || 'document') + '-compressed.pdf', 'application/pdf');
      const pct = Math.round((1 - newSize / origSize) * 100);
      if (newSize < origSize) {
        setStatus($('#status'), 'ok', tf('pdfc_done', fmtSize(origSize), fmtSize(newSize), pct));
      } else {
        setStatus($('#status'), 'ok', tf('pdfc_already', fmtSize(origSize), fmtSize(newSize)));
      }
    } catch (e) {
      setStatus($('#status'), 'err', tf('pdfc_error', e.message));
    } finally {
      btn.disabled = false;
    }
  });
}
