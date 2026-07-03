// Version: 1.0001
// Компресор на снимки — изцяло през canvas, без качване.
import { downloadBlob, fmtSize } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  img_title: { bg:'Компресор на снимки', ru:'Сжатие изображений', uk:'Стиснення зображень', en:'Image compressor', de:'Bildkompressor', fr:'Compresseur d’images', es:'Compresor de imágenes', 'es-MX':'Compresor de imágenes', it:'Compressore immagini', pt:'Compressor de imagens', ar:'ضاغط الصور', hi:'इमेज कंप्रेसर', ja:'画像圧縮', ky:'Сүрөт кысуу', 'zh-Hant':'圖片壓縮' },
  img_pick: { bg:'Избери изображение', ru:'Выберите изображение', uk:'Виберіть зображення', en:'Choose an image', de:'Bild auswählen', fr:'Choisir une image', es:'Elegir imagen', 'es-MX':'Elegir imagen', it:'Scegli un’immagine', pt:'Escolher imagem', ar:'اختر صورة', hi:'छवि चुनें', ja:'画像を選択', ky:'Сүрөт тандаңыз', 'zh-Hant':'選擇圖片' },
  img_quality: { bg:'Качество:', ru:'Качество:', uk:'Якість:', en:'Quality:', de:'Qualität:', fr:'Qualité :', es:'Calidad:', 'es-MX':'Calidad:', it:'Qualità:', pt:'Qualidade:', ar:'الجودة:', hi:'गुणवत्ता:', ja:'品質：', ky:'Сапаты:', 'zh-Hant':'品質：' },
  img_format: { bg:'Изходен формат', ru:'Выходной формат', uk:'Вихідний формат', en:'Output format', de:'Ausgabeformat', fr:'Format de sortie', es:'Formato de salida', 'es-MX':'Formato de salida', it:'Formato di uscita', pt:'Formato de saída', ar:'صيغة الإخراج', hi:'आउटपुट फ़ॉर्मेट', ja:'出力形式', ky:'Чыгуу форматы', 'zh-Hant':'輸出格式' },
  img_fmt_jpeg: { bg:'JPEG — най-малък размер', ru:'JPEG — наименьший размер', uk:'JPEG — найменший розмір', en:'JPEG — smallest size', de:'JPEG — kleinste Größe', fr:'JPEG — taille minimale', es:'JPEG — tamaño más pequeño', 'es-MX':'JPEG — tamaño más pequeño', it:'JPEG — dimensione minima', pt:'JPEG — menor tamanho', ar:'JPEG — أصغر حجم', hi:'JPEG — सबसे छोटा आकार', ja:'JPEG — 最小サイズ', ky:'JPEG — эң кичине өлчөм', 'zh-Hant':'JPEG — 最小體積' },
  img_fmt_webp: { bg:'WebP — модерен, добро качество', ru:'WebP — современный, хорошее качество', uk:'WebP — сучасний, гарна якість', en:'WebP — modern, good quality', de:'WebP — modern, gute Qualität', fr:'WebP — moderne, bonne qualité', es:'WebP — moderno, buena calidad', 'es-MX':'WebP — moderno, buena calidad', it:'WebP — moderno, buona qualità', pt:'WebP — moderno, boa qualidade', ar:'WebP — حديث، جودة جيدة', hi:'WebP — आधुनिक, अच्छी गुणवत्ता', ja:'WebP — 最新・高品質', ky:'WebP — заманбап, жакшы сапат', 'zh-Hant':'WebP — 現代、品質佳' },
  img_fmt_png: { bg:'PNG — без загуба (за графики)', ru:'PNG — без потерь (для графики)', uk:'PNG — без втрат (для графіки)', en:'PNG — lossless (for graphics)', de:'PNG — verlustfrei (für Grafiken)', fr:'PNG — sans perte (pour graphiques)', es:'PNG — sin pérdida (para gráficos)', 'es-MX':'PNG — sin pérdida (para gráficos)', it:'PNG — senza perdita (per grafica)', pt:'PNG — sem perdas (para gráficos)', ar:'PNG — بدون فقدان (للرسومات)', hi:'PNG — हानिरहित (ग्राफ़िक्स हेतु)', ja:'PNG — 可逆（図向け）', ky:'PNG — жоготуусуз (графика үчүн)', 'zh-Hant':'PNG — 無損（適合圖形）' },
  img_maxw: { bg:'Максимална ширина (px, 0 = запази оригинала)', ru:'Максимальная ширина (px, 0 = сохранить оригинал)', uk:'Максимальна ширина (px, 0 = зберегти оригінал)', en:'Maximum width (px, 0 = keep original)', de:'Maximale Breite (px, 0 = Original behalten)', fr:'Largeur maximale (px, 0 = garder l’original)', es:'Ancho máximo (px, 0 = mantener el original)', 'es-MX':'Ancho máximo (px, 0 = mantener el original)', it:'Larghezza massima (px, 0 = mantieni originale)', pt:'Largura máxima (px, 0 = manter original)', ar:'أقصى عرض (بكسل، 0 = الإبقاء على الأصل)', hi:'अधिकतम चौड़ाई (px, 0 = मूल रखें)', ja:'最大幅（px、0 = 元のまま）', ky:'Максималдуу туурасы (px, 0 = түпнусканы сактоо)', 'zh-Hant':'最大寬度（px，0 = 保留原始）' },
  img_hint: { bg:'Компресията се прави изцяло на устройството — снимката не се качва никъде.', ru:'Сжатие выполняется полностью на устройстве — изображение никуда не загружается.', uk:'Стиснення виконується повністю на пристрої — зображення нікуди не завантажується.', en:'Compression runs entirely on your device — the image is never uploaded anywhere.', de:'Die Komprimierung läuft vollständig auf dem Gerät — das Bild wird nirgendwohin hochgeladen.', fr:'La compression se fait entièrement sur l’appareil — l’image n’est jamais envoyée nulle part.', es:'La compresión se realiza completamente en el dispositivo — la imagen no se sube a ningún lugar.', 'es-MX':'La compresión se realiza completamente en el dispositivo — la imagen no se sube a ningún lugar.', it:'La compressione avviene interamente sul dispositivo — l’immagine non viene caricata da nessuna parte.', pt:'A compressão ocorre totalmente no dispositivo — a imagem não é enviada para lugar nenhum.', ar:'يتم الضغط بالكامل على جهازك — لا يتم رفع الصورة إلى أي مكان.', hi:'संपीड़न पूरी तरह आपके डिवाइस पर होता है — छवि कहीं अपलोड नहीं होती।', ja:'圧縮はすべて端末上で行われます — 画像はどこにもアップロードされません。', ky:'Кысуу толугу менен түзмөктө аткарылат — сүрөт эч жакка жүктөлбөйт.', 'zh-Hant':'壓縮完全在裝置上進行 — 圖片不會上傳到任何地方。' },
  img_go: { bg:'Компресирай', ru:'Сжать', uk:'Стиснути', en:'Compress', de:'Komprimieren', fr:'Compresser', es:'Comprimir', 'es-MX':'Comprimir', it:'Comprimi', pt:'Comprimir', ar:'اضغط', hi:'संपीड़ित करें', ja:'圧縮', ky:'Кысуу', 'zh-Hant':'壓縮' },
  img_original: { bg:'Оригинал', ru:'Оригинал', uk:'Оригінал', en:'Original', de:'Original', fr:'Original', es:'Original', 'es-MX':'Original', it:'Originale', pt:'Original', ar:'الأصل', hi:'मूल', ja:'元', ky:'Түпнуска', 'zh-Hant':'原始' },
  img_compressed: { bg:'Компресирано', ru:'Сжато', uk:'Стиснуто', en:'Compressed', de:'Komprimiert', fr:'Compressé', es:'Comprimido', 'es-MX':'Comprimido', it:'Compresso', pt:'Comprimido', ar:'مضغوط', hi:'संपीड़ित', ja:'圧縮済み', ky:'Кысылган', 'zh-Hant':'已壓縮' },
  img_download: { bg:'Свали', ru:'Скачать', uk:'Завантажити', en:'Download', de:'Herunterladen', fr:'Télécharger', es:'Descargar', 'es-MX':'Descargar', it:'Scarica', pt:'Baixar', ar:'تنزيل', hi:'डाउनलोड', ja:'ダウンロード', ky:'Жүктөп алуу', 'zh-Hant':'下載' },
  img_pick_first: { bg:'Първо избери изображение.', ru:'Сначала выберите изображение.', uk:'Спершу виберіть зображення.', en:'Choose an image first.', de:'Wähle zuerst ein Bild.', fr:'Choisis d’abord une image.', es:'Primero elige una imagen.', 'es-MX':'Primero elige una imagen.', it:'Scegli prima un’immagine.', pt:'Escolha primeiro uma imagem.', ar:'اختر صورة أولاً.', hi:'पहले एक छवि चुनें।', ja:'まず画像を選択してください。', ky:'Адегенде сүрөт тандаңыз.', 'zh-Hant':'請先選擇圖片。' },
  img_unsupported: { bg:'Този формат не се поддържа на устройството.', ru:'Этот формат не поддерживается на устройстве.', uk:'Цей формат не підтримується на пристрої.', en:'This format is not supported on your device.', de:'Dieses Format wird auf dem Gerät nicht unterstützt.', fr:'Ce format n’est pas pris en charge sur l’appareil.', es:'Este formato no es compatible con el dispositivo.', 'es-MX':'Este formato no es compatible con el dispositivo.', it:'Questo formato non è supportato sul dispositivo.', pt:'Este formato não é suportado no dispositivo.', ar:'هذه الصيغة غير مدعومة على جهازك.', hi:'यह फ़ॉर्मेट आपके डिवाइस पर समर्थित नहीं है।', ja:'この形式は端末でサポートされていません。', ky:'Бул формат түзмөктө колдоого алынбайт.', 'zh-Hant':'此格式在您的裝置上不受支援。' },
  img_saved: { bg:'Спестени {0}% от размера', ru:'Сэкономлено {0}% размера', uk:'Заощаджено {0}% розміру', en:'Saved {0}% of the size', de:'{0}% der Größe gespart', fr:'{0}% de taille économisés', es:'Ahorrado {0}% del tamaño', 'es-MX':'Ahorrado {0}% del tamaño', it:'Risparmiato {0}% della dimensione', pt:'Economizado {0}% do tamanho', ar:'تم توفير {0}% من الحجم', hi:'आकार का {0}% बचाया', ja:'サイズを{0}%削減', ky:'Өлчөмдүн {0}% үнөмдөлдү', 'zh-Hant':'節省了 {0}% 的體積' },
  img_no_reduction: { bg:'Без намаление (опитай по-ниско качество).', ru:'Без уменьшения (попробуйте качество ниже).', uk:'Без зменшення (спробуйте нижчу якість).', en:'No reduction (try a lower quality).', de:'Keine Verkleinerung (versuche eine niedrigere Qualität).', fr:'Aucune réduction (essaie une qualité plus basse).', es:'Sin reducción (prueba una calidad menor).', 'es-MX':'Sin reducción (prueba una calidad menor).', it:'Nessuna riduzione (prova una qualità più bassa).', pt:'Sem redução (tente uma qualidade menor).', ar:'لا يوجد تقليل (جرّب جودة أقل).', hi:'कोई कमी नहीं (कम गुणवत्ता आज़माएं)।', ja:'削減なし（より低い品質をお試しください）。', ky:'Азайуу жок (төмөнүрөөк сапатты сынап көрүңүз).', 'zh-Hant':'未縮小（試試較低品質）。' }
});

export const title = t('img_title');

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>${t('img_pick')}</label>
      <input type="file" id="file" accept="image/jpeg,image/png,image/webp" />
      <label>${t('img_quality')} <span id="qval">75%</span></label>
      <input type="range" id="quality" min="10" max="100" value="75" />
      <label>${t('img_format')}</label>
      <select id="format">
        <option value="image/jpeg">${t('img_fmt_jpeg')}</option>
        <option value="image/webp">${t('img_fmt_webp')}</option>
        <option value="image/png">${t('img_fmt_png')}</option>
      </select>
      <label>${t('img_maxw')}</label>
      <input type="number" id="maxw" value="0" min="0" />
      <p class="hint">${t('img_hint')}</p>
      <button class="btn" id="go">${t('img_go')}</button>
      <div class="cmp" id="cmp" style="display:none">
        <div><div>${t('img_original')}</div><img id="origImg" /><div class="sz" id="origSz"></div></div>
        <div><div>${t('img_compressed')}</div><img id="compImg" /><div class="sz" id="compSz"></div>
          <button class="btn" id="dl">${t('img_download')}</button></div>
      </div>
      <div class="save-msg" id="save"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  let origFile = null, compBlob = null;

  $('#quality').addEventListener('input', (e) => { $('#qval').textContent = e.target.value + '%'; });
  $('#file').addEventListener('change', () => { origFile = $('#file').files[0] || null; });

  $('#go').addEventListener('click', () => {
    if (!origFile) { alert(t('img_pick_first')); return; }
    const img = new Image();
    img.onload = () => {
      const maxw = parseInt($('#maxw').value, 10) || 0;
      let w = img.width, h = img.height;
      if (maxw > 0 && w > maxw) { h = Math.round(h * maxw / w); w = maxw; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const fmt = $('#format').value;
      const q = parseInt($('#quality').value, 10) / 100;
      c.toBlob((blob) => {
        if (!blob) { $('#save').textContent = t('img_unsupported'); return; }
        compBlob = blob;
        $('#cmp').style.display = 'flex';
        $('#origImg').src = URL.createObjectURL(origFile);
        $('#compImg').src = URL.createObjectURL(blob);
        $('#origSz').textContent = fmtSize(origFile.size);
        $('#compSz').textContent = fmtSize(blob.size);
        const saved = 100 - Math.round(blob.size / origFile.size * 100);
        $('#save').textContent = saved > 0 ? tf('img_saved', saved) : t('img_no_reduction');
      }, fmt, q);
    };
    img.src = URL.createObjectURL(origFile);
  });

  $('#dl').addEventListener('click', () => {
    if (!compBlob) return;
    const ext = $('#format').value.split('/')[1];
    downloadBlob(compBlob, 'compressed.' + ext);
  });
}
