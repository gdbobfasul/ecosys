// Version: 1.0020
// Инструменти за снимки — изцяло през canvas на устройството, без качване.
// Обогатяване (Huawei 4.3, 09.09.2026): освен компресията (качество/формат/макс. ширина) вече има и
// ОПЕРАЦИИ върху същата снимка: завъртане/огледало, изрязване по пропорция (1:1, 4:3, 16:9, 3:4, 9:16 —
// централно), точен размер (ширина × височина), филтри (сиво/сепия/яркост/контраст/наситеност/размазване),
// пакетна обработка на много снимки наведнъж, премахване на EXIF (при всяко записване), сравнение преди/след.
import { downloadBlob, fmtSize } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  img_title: { bg:'Инструменти за снимки', ru:'Инструменты для фото', uk:'Інструменти для фото', en:'Photo tools', de:'Foto-Werkzeuge', fr:'Outils photo', es:'Herramientas de fotos', 'es-MX':'Herramientas de fotos', it:'Strumenti foto', pt:'Ferramentas de fotos', ar:'أدوات الصور', hi:'फ़ोटो उपकरण', ja:'写真ツール', ky:'Сүрөт куралдары', 'zh-Hant':'照片工具' },
  img_pick: { bg:'Избери изображение (може няколко)', ru:'Выберите изображение (можно несколько)', uk:'Виберіть зображення (можна кілька)', en:'Choose image(s)', de:'Bild(er) auswählen', fr:'Choisir une ou plusieurs images', es:'Elegir imagen(es)', 'es-MX':'Elegir imagen(es)', it:'Scegli immagine/i', pt:'Escolher imagem(ns)', ar:'اختر صورة (أو عدة صور)', hi:'छवि चुनें (कई भी)', ja:'画像を選択（複数可）', ky:'Сүрөт танда (бир нече болот)', 'zh-Hant':'選擇圖片（可多張）' },
  img_quality: { bg:'Качество:', ru:'Качество:', uk:'Якість:', en:'Quality:', de:'Qualität:', fr:'Qualité :', es:'Calidad:', 'es-MX':'Calidad:', it:'Qualità:', pt:'Qualidade:', ar:'الجودة:', hi:'गुणवत्ता:', ja:'品質:', ky:'Сапат:', 'zh-Hant':'品質：' },
  img_format: { bg:'Изходен формат', ru:'Выходной формат', uk:'Вихідний формат', en:'Output format', de:'Ausgabeformat', fr:'Format de sortie', es:'Formato de salida', 'es-MX':'Formato de salida', it:'Formato di output', pt:'Formato de saída', ar:'صيغة الإخراج', hi:'आउटपुट फ़ॉर्मेट', ja:'出力形式', ky:'Чыгуу форматы', 'zh-Hant':'輸出格式' },
  img_fmt_jpeg: { bg:'JPEG — най-малък размер', ru:'JPEG — наименьший размер', uk:'JPEG — найменший розмір', en:'JPEG — smallest size', de:'JPEG — kleinste Größe', fr:'JPEG — le plus petit', es:'JPEG — más pequeño', 'es-MX':'JPEG — más pequeño', it:'JPEG — più piccolo', pt:'JPEG — mais pequeno', ar:'JPEG — الأصغر حجماً', hi:'JPEG — सबसे छोटा', ja:'JPEG — 最小サイズ', ky:'JPEG — эң кичине', 'zh-Hant':'JPEG — 最小' },
  img_fmt_webp: { bg:'WebP — модерен, добро качество', ru:'WebP — современный, хорошее качество', uk:'WebP — сучасний, добра якість', en:'WebP — modern, good quality', de:'WebP — modern, gute Qualität', fr:'WebP — moderne, bonne qualité', es:'WebP — moderno, buena calidad', 'es-MX':'WebP — moderno, buena calidad', it:'WebP — moderno, buona qualità', pt:'WebP — moderno, boa qualidade', ar:'WebP — حديث، جودة جيدة', hi:'WebP — आधुनिक, अच्छी गुणवत्ता', ja:'WebP — 高品質', ky:'WebP — заманбап, жакшы сапат', 'zh-Hant':'WebP — 現代、品質佳' },
  img_fmt_png: { bg:'PNG — без загуба (за графики)', ru:'PNG — без потерь (для графики)', uk:'PNG — без втрат (для графіки)', en:'PNG — lossless (for graphics)', de:'PNG — verlustfrei (für Grafiken)', fr:'PNG — sans perte (graphiques)', es:'PNG — sin pérdida (gráficos)', 'es-MX':'PNG — sin pérdida (gráficos)', it:'PNG — senza perdita (grafica)', pt:'PNG — sem perdas (gráficos)', ar:'PNG — بدون فقد (للرسوميات)', hi:'PNG — बिना नुकसान (ग्राफ़िक्स)', ja:'PNG — 可逆（図形向け）', ky:'PNG — жоготуусуз (графика)', 'zh-Hant':'PNG — 無損（圖形）' },
  img_maxw: { bg:'Максимална ширина (px, 0 = без промяна)', ru:'Макс. ширина (px, 0 = без изменений)', uk:'Макс. ширина (px, 0 = без змін)', en:'Max width (px, 0 = keep)', de:'Max. Breite (px, 0 = beibehalten)', fr:'Largeur max (px, 0 = inchangée)', es:'Ancho máx. (px, 0 = igual)', 'es-MX':'Ancho máx. (px, 0 = igual)', it:'Larghezza max (px, 0 = invariata)', pt:'Largura máx. (px, 0 = manter)', ar:'أقصى عرض (px، 0 = بدون تغيير)', hi:'अधिकतम चौड़ाई (px, 0 = वही)', ja:'最大幅（px、0＝そのまま）', ky:'Макс. туурасы (px, 0 = өзгөрбөйт)', 'zh-Hant':'最大寬度（px，0＝不變）' },
  img_hint: { bg:'Всичко става на устройството; при записване EXIF данните (място, дата, модел) се премахват автоматично.', ru:'Всё выполняется на устройстве; при сохранении EXIF (место, дата, модель) удаляется автоматически.', uk:'Усе виконується на пристрої; при збереженні EXIF (місце, дата, модель) видаляється автоматично.', en:'Everything happens on the device; EXIF data (location, date, model) is removed automatically on save.', de:'Alles auf dem Gerät; EXIF-Daten (Ort, Datum, Modell) werden beim Speichern automatisch entfernt.', fr:'Tout se fait sur l\'appareil ; les données EXIF (lieu, date, modèle) sont retirées automatiquement.', es:'Todo ocurre en el dispositivo; los datos EXIF (ubicación, fecha, modelo) se eliminan al guardar.', 'es-MX':'Todo ocurre en el dispositivo; los datos EXIF (ubicación, fecha, modelo) se eliminan al guardar.', it:'Tutto sul dispositivo; i dati EXIF (luogo, data, modello) vengono rimossi al salvataggio.', pt:'Tudo no dispositivo; os dados EXIF (local, data, modelo) são removidos ao guardar.', ar:'كل شيء على الجهاز؛ تُزال بيانات EXIF (الموقع، التاريخ، الطراز) تلقائياً عند الحفظ.', hi:'सब कुछ डिवाइस पर; सहेजते समय EXIF (स्थान, तारीख, मॉडल) अपने आप हटता है।', ja:'すべて端末内で処理。保存時にEXIF（位置・日時・機種）を自動削除。', ky:'Баары түзмөктө; сактоодо EXIF (жер, дата, модель) автоматтык түрдө өчүрүлөт.', 'zh-Hant':'全部在裝置上完成；儲存時自動移除 EXIF（位置、日期、機型）。' },
  img_go: { bg:'Обработи', ru:'Обработать', uk:'Обробити', en:'Process', de:'Verarbeiten', fr:'Traiter', es:'Procesar', 'es-MX':'Procesar', it:'Elabora', pt:'Processar', ar:'معالجة', hi:'प्रोसेस करें', ja:'処理', ky:'Иштетүү', 'zh-Hant':'處理' },
  img_original: { bg:'Оригинал', ru:'Оригинал', uk:'Оригінал', en:'Original', de:'Original', fr:'Original', es:'Original', 'es-MX':'Original', it:'Originale', pt:'Original', ar:'الأصل', hi:'मूल', ja:'元画像', ky:'Түпнуска', 'zh-Hant':'原圖' },
  img_compressed: { bg:'Резултат', ru:'Результат', uk:'Результат', en:'Result', de:'Ergebnis', fr:'Résultat', es:'Resultado', 'es-MX':'Resultado', it:'Risultato', pt:'Resultado', ar:'النتيجة', hi:'परिणाम', ja:'結果', ky:'Натыйжа', 'zh-Hant':'結果' },
  img_download: { bg:'Свали', ru:'Скачать', uk:'Завантажити', en:'Download', de:'Herunterladen', fr:'Télécharger', es:'Descargar', 'es-MX':'Descargar', it:'Scarica', pt:'Transferir', ar:'تنزيل', hi:'डाउनलोड', ja:'ダウンロード', ky:'Жүктөө', 'zh-Hant':'下載' },
  img_pick_first: { bg:'Първо избери изображение.', ru:'Сначала выберите изображение.', uk:'Спочатку виберіть зображення.', en:'Choose an image first.', de:'Wähle zuerst ein Bild.', fr:'Choisissez d\'abord une image.', es:'Elige primero una imagen.', 'es-MX':'Elige primero una imagen.', it:'Scegli prima un\'immagine.', pt:'Escolha primeiro uma imagem.', ar:'اختر صورة أولاً.', hi:'पहले छवि चुनें।', ja:'先に画像を選択してください。', ky:'Адегенде сүрөт танда.', 'zh-Hant':'請先選擇圖片。' },
  img_unsupported: { bg:'Този формат не се поддържа от устройството.', ru:'Этот формат не поддерживается устройством.', uk:'Цей формат не підтримується пристроєм.', en:'This format is not supported by the device.', de:'Dieses Format wird vom Gerät nicht unterstützt.', fr:'Format non pris en charge par l\'appareil.', es:'El dispositivo no admite este formato.', 'es-MX':'El dispositivo no admite este formato.', it:'Formato non supportato dal dispositivo.', pt:'Formato não suportado pelo dispositivo.', ar:'هذه الصيغة غير مدعومة على الجهاز.', hi:'यह फ़ॉर्मेट डिवाइस पर समर्थित नहीं है।', ja:'この形式は端末で未対応です。', ky:'Бул формат түзмөктө колдоого алынбайт.', 'zh-Hant':'裝置不支援此格式。' },
  img_saved: { bg:'Спестени {0}% от размера.', ru:'Сэкономлено {0}% размера.', uk:'Заощаджено {0}% розміру.', en:'Saved {0}% of the size.', de:'{0}% Größe gespart.', fr:'{0}% de taille économisés.', es:'Ahorrado {0}% del tamaño.', 'es-MX':'Ahorrado {0}% del tamaño.', it:'Risparmiato il {0}% della dimensione.', pt:'Poupados {0}% do tamanho.', ar:'وُفّر {0}% من الحجم.', hi:'आकार का {0}% बचा।', ja:'サイズを{0}%削減。', ky:'Өлчөмдүн {0}% үнөмдөлдү.', 'zh-Hant':'節省了 {0}% 的大小。' },
  img_no_reduction: { bg:'Без намаление (опитай по-ниско качество).', ru:'Без уменьшения (попробуйте меньшее качество).', uk:'Без зменшення (спробуйте нижчу якість).', en:'No reduction (try lower quality).', de:'Keine Reduktion (niedrigere Qualität versuchen).', fr:'Pas de réduction (essayez une qualité plus basse).', es:'Sin reducción (prueba menor calidad).', 'es-MX':'Sin reducción (prueba menor calidad).', it:'Nessuna riduzione (prova qualità inferiore).', pt:'Sem redução (tente menor qualidade).', ar:'بدون تقليل (جرّب جودة أقل).', hi:'कोई कमी नहीं (कम गुणवत्ता आज़माएँ)।', ja:'削減なし（品質を下げてみてください）。', ky:'Кичирейген жок (сапатты төмөндөтүп көр).', 'zh-Hant':'未縮小（請嘗試較低品質）。' },
  img_ops: { bg:'Операции (по избор, прилагат се преди записа)', ru:'Операции (по желанию, применяются перед сохранением)', uk:'Операції (за бажанням, перед збереженням)', en:'Operations (optional, applied before saving)', de:'Vorgänge (optional, vor dem Speichern)', fr:'Opérations (facultatif, avant l\'enregistrement)', es:'Operaciones (opcional, antes de guardar)', 'es-MX':'Operaciones (opcional, antes de guardar)', it:'Operazioni (facoltative, prima del salvataggio)', pt:'Operações (opcional, antes de guardar)', ar:'عمليات (اختيارية، قبل الحفظ)', hi:'ऑपरेशन (वैकल्पिक, सहेजने से पहले)', ja:'操作（任意、保存前に適用）', ky:'Операциялар (милдеттүү эмес, сактоодон мурун)', 'zh-Hant':'操作（選填，儲存前套用）' },
  img_rotate: { bg:'Завъртане / огледало', ru:'Поворот / зеркало', uk:'Поворот / дзеркало', en:'Rotate / mirror', de:'Drehen / spiegeln', fr:'Rotation / miroir', es:'Girar / espejo', 'es-MX':'Girar / espejo', it:'Ruota / specchia', pt:'Rodar / espelhar', ar:'تدوير / انعكاس', hi:'घुमाएँ / मिरर', ja:'回転／反転', ky:'Буруу / күзгү', 'zh-Hant':'旋轉／鏡像' },
  img_none: { bg:'— няма —', ru:'— нет —', uk:'— немає —', en:'— none —', de:'— keine —', fr:'— aucune —', es:'— ninguna —', 'es-MX':'— ninguna —', it:'— nessuna —', pt:'— nenhuma —', ar:'— لا شيء —', hi:'— कोई नहीं —', ja:'— なし —', ky:'— жок —', 'zh-Hant':'— 無 —' },
  img_crop: { bg:'Изрязване (централно, пропорция)', ru:'Обрезка (по центру, пропорция)', uk:'Обрізання (по центру, пропорція)', en:'Crop (centered, aspect ratio)', de:'Zuschnitt (zentriert, Seitenverhältnis)', fr:'Recadrage (centré, ratio)', es:'Recorte (centrado, proporción)', 'es-MX':'Recorte (centrado, proporción)', it:'Ritaglio (centrato, proporzione)', pt:'Recorte (centrado, proporção)', ar:'قص (مركزي، نسبة)', hi:'क्रॉप (केंद्रित, अनुपात)', ja:'切り抜き（中央、比率）', ky:'Кесүү (борбордук, пропорция)', 'zh-Hant':'裁切（置中，比例）' },
  img_exact: { bg:'Точен размер: ширина × височина (px, 0 = авто)', ru:'Точный размер: ширина × высота (px, 0 = авто)', uk:'Точний розмір: ширина × висота (px, 0 = авто)', en:'Exact size: width × height (px, 0 = auto)', de:'Genaue Größe: Breite × Höhe (px, 0 = auto)', fr:'Taille exacte : largeur × hauteur (px, 0 = auto)', es:'Tamaño exacto: ancho × alto (px, 0 = auto)', 'es-MX':'Tamaño exacto: ancho × alto (px, 0 = auto)', it:'Dimensione esatta: larghezza × altezza (px, 0 = auto)', pt:'Tamanho exato: largura × altura (px, 0 = auto)', ar:'حجم دقيق: العرض × الارتفاع (px، 0 = تلقائي)', hi:'सटीक आकार: चौड़ाई × ऊँचाई (px, 0 = ऑटो)', ja:'正確なサイズ：幅×高さ（px、0＝自動）', ky:'Так өлчөм: туурасы × бийиктиги (px, 0 = авто)', 'zh-Hant':'精確尺寸：寬 × 高（px，0＝自動）' },
  img_filter: { bg:'Филтър', ru:'Фильтр', uk:'Фільтр', en:'Filter', de:'Filter', fr:'Filtre', es:'Filtro', 'es-MX':'Filtro', it:'Filtro', pt:'Filtro', ar:'مرشح', hi:'फ़िल्टर', ja:'フィルター', ky:'Фильтр', 'zh-Hant':'濾鏡' },
  img_f_gray: { bg:'Черно-бяло', ru:'Чёрно-белое', uk:'Чорно-біле', en:'Black & white', de:'Schwarz-weiß', fr:'Noir et blanc', es:'Blanco y negro', 'es-MX':'Blanco y negro', it:'Bianco e nero', pt:'Preto e branco', ar:'أبيض وأسود', hi:'श्वेत-श्याम', ja:'白黒', ky:'Ак-кара', 'zh-Hant':'黑白' },
  img_f_sepia: { bg:'Сепия', ru:'Сепия', uk:'Сепія', en:'Sepia', de:'Sepia', fr:'Sépia', es:'Sepia', 'es-MX':'Sepia', it:'Seppia', pt:'Sépia', ar:'بني داكن', hi:'सेपिया', ja:'セピア', ky:'Сепия', 'zh-Hant':'懷舊' },
  img_f_bright: { bg:'По-светло', ru:'Светлее', uk:'Світліше', en:'Brighter', de:'Heller', fr:'Plus clair', es:'Más claro', 'es-MX':'Más claro', it:'Più chiaro', pt:'Mais claro', ar:'أفتح', hi:'ज़्यादा उजला', ja:'明るく', ky:'Ачыгыраак', 'zh-Hant':'更亮' },
  img_f_dark: { bg:'По-тъмно', ru:'Темнее', uk:'Темніше', en:'Darker', de:'Dunkler', fr:'Plus sombre', es:'Más oscuro', 'es-MX':'Más oscuro', it:'Più scuro', pt:'Mais escuro', ar:'أغمق', hi:'ज़्यादा गहरा', ja:'暗く', ky:'Күңүртүрөөк', 'zh-Hant':'更暗' },
  img_f_contrast: { bg:'Повече контраст', ru:'Больше контраста', uk:'Більше контрасту', en:'More contrast', de:'Mehr Kontrast', fr:'Plus de contraste', es:'Más contraste', 'es-MX':'Más contraste', it:'Più contrasto', pt:'Mais contraste', ar:'تباين أكثر', hi:'ज़्यादा कंट्रास्ट', ja:'コントラスト強', ky:'Контраст көбүрөөк', 'zh-Hant':'更多對比' },
  img_f_vivid: { bg:'По-наситени цветове', ru:'Насыщеннее цвета', uk:'Насиченіші кольори', en:'More vivid', de:'Kräftigere Farben', fr:'Couleurs plus vives', es:'Colores más vivos', 'es-MX':'Colores más vivos', it:'Colori più vivi', pt:'Cores mais vivas', ar:'ألوان أكثر حيوية', hi:'ज़्यादा चटख रंग', ja:'鮮やか', ky:'Түстөр каныккан', 'zh-Hant':'更鮮豔' },
  img_f_blur: { bg:'Леко размазване', ru:'Лёгкое размытие', uk:'Легке розмиття', en:'Soft blur', de:'Weichzeichner', fr:'Flou léger', es:'Desenfoque suave', 'es-MX':'Desenfoque suave', it:'Sfocatura leggera', pt:'Desfoque suave', ar:'ضبابية خفيفة', hi:'हल्का धुंधलापन', ja:'ソフトぼかし', ky:'Жумшак бүдөмүк', 'zh-Hant':'柔化模糊' },
  img_f_invert: { bg:'Негатив', ru:'Негатив', uk:'Негатив', en:'Negative', de:'Negativ', fr:'Négatif', es:'Negativo', 'es-MX':'Negativo', it:'Negativo', pt:'Negativo', ar:'سلبي', hi:'नेगेटिव', ja:'ネガ', ky:'Негатив', 'zh-Hant':'負片' },
  img_batch_done: { bg:'Обработени {0} снимки — всяка е свалена отделно.', ru:'Обработано {0} фото — каждое скачано отдельно.', uk:'Оброблено {0} фото — кожне завантажено окремо.', en:'Processed {0} photos — each downloaded separately.', de:'{0} Fotos verarbeitet — jedes einzeln heruntergeladen.', fr:'{0} photos traitées — chacune téléchargée séparément.', es:'{0} fotos procesadas — cada una descargada por separado.', 'es-MX':'{0} fotos procesadas — cada una descargada por separado.', it:'{0} foto elaborate — ognuna scaricata separatamente.', pt:'{0} fotos processadas — cada uma transferida separadamente.', ar:'تمت معالجة {0} صورة — نُزّلت كل واحدة على حدة.', hi:'{0} फ़ोटो प्रोसेस — हर एक अलग डाउनलोड।', ja:'{0}枚を処理 — それぞれ個別にダウンロード。', ky:'{0} сүрөт иштетилди — ар бири өзүнчө жүктөлдү.', 'zh-Hant':'已處理 {0} 張 — 各自單獨下載。' },
  img_dims: { bg:'{0}×{1} px', ru:'{0}×{1} px', uk:'{0}×{1} px', en:'{0}×{1} px', de:'{0}×{1} px', fr:'{0}×{1} px', es:'{0}×{1} px', 'es-MX':'{0}×{1} px', it:'{0}×{1} px', pt:'{0}×{1} px', ar:'{0}×{1} px', hi:'{0}×{1} px', ja:'{0}×{1} px', ky:'{0}×{1} px', 'zh-Hant':'{0}×{1} px' }
});

export const title = t('img_title');

const FILTERS = { none: '', gray: 'grayscale(1)', sepia: 'sepia(0.8)', bright: 'brightness(1.25)', dark: 'brightness(0.8)', contrast: 'contrast(1.35)', vivid: 'saturate(1.6)', blur: 'blur(2px)', invert: 'invert(1)' };
const RATIOS = { none: 0, '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '16:9': 16 / 9, '9:16': 9 / 16 };

// Прилага операциите върху едно изображение → Blob (в избрания формат/качество). Canvas → без EXIF.
function processImage(img, o) {
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  const r = RATIOS[o.ratio] || 0;
  if (r) { if (sw / sh > r) { const nw = Math.round(sh * r); sx = Math.round((sw - nw) / 2); sw = nw; } else { const nh = Math.round(sw / r); sy = Math.round((sh - nh) / 2); sh = nh; } }
  let w = sw, h = sh;
  if (o.exactW > 0 || o.exactH > 0) { if (o.exactW > 0 && o.exactH > 0) { w = o.exactW; h = o.exactH; } else if (o.exactW > 0) { h = Math.round(sh * o.exactW / sw); w = o.exactW; } else { w = Math.round(sw * o.exactH / sh); h = o.exactH; } }
  else if (o.maxw > 0 && w > o.maxw) { h = Math.round(h * o.maxw / w); w = o.maxw; }
  const rot = o.rot; const swap = rot === 'r90' || rot === 'r270';
  const c = document.createElement('canvas'); c.width = swap ? h : w; c.height = swap ? w : h;
  const ctx = c.getContext('2d');
  ctx.filter = FILTERS[o.filter] || 'none';
  ctx.translate(c.width / 2, c.height / 2);
  if (rot === 'r90') ctx.rotate(Math.PI / 2); else if (rot === 'r180') ctx.rotate(Math.PI); else if (rot === 'r270') ctx.rotate(-Math.PI / 2);
  if (rot === 'hflip') ctx.scale(-1, 1); else if (rot === 'vflip') ctx.scale(1, -1);
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  return new Promise((res) => c.toBlob((b) => res({ blob: b, w: c.width, h: c.height }), o.fmt, o.q));
}
function loadImage(file) { return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); }); }

export function render(root) {
  const opt = (v, l, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${l}</option>`;
  root.innerHTML = `
    <div class="tool-card">
      <label>${t('img_pick')}</label>
      <input type="file" id="file" accept="image/jpeg,image/png,image/webp" multiple />
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
      <div style="margin-top:10px;font-weight:700;color:#8ecae6">${t('img_ops')}</div>
      <label>${t('img_rotate')}</label>
      <select id="rot">${opt('none', t('img_none'), true)}${opt('r90', '↻ 90°')}${opt('r180', '↻ 180°')}${opt('r270', '↺ 90°')}${opt('hflip', '↔')}${opt('vflip', '↕')}</select>
      <label>${t('img_crop')}</label>
      <select id="ratio">${opt('none', t('img_none'), true)}${['1:1', '4:3', '3:4', '16:9', '9:16'].map((r) => opt(r, r)).join('')}</select>
      <label>${t('img_exact')}</label>
      <div style="display:flex;gap:6px"><input type="number" id="exw" value="0" min="0" style="flex:1" /><input type="number" id="exh" value="0" min="0" style="flex:1" /></div>
      <label>${t('img_filter')}</label>
      <select id="filter">${opt('none', t('img_none'), true)}${opt('gray', t('img_f_gray'))}${opt('sepia', t('img_f_sepia'))}${opt('bright', t('img_f_bright'))}${opt('dark', t('img_f_dark'))}${opt('contrast', t('img_f_contrast'))}${opt('vivid', t('img_f_vivid'))}${opt('blur', t('img_f_blur'))}${opt('invert', t('img_f_invert'))}</select>
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
  let files = [], compBlob = null, compName = 'image';

  $('#quality').addEventListener('input', (e) => { $('#qval').textContent = e.target.value + '%'; });
  $('#file').addEventListener('change', () => { files = Array.from($('#file').files || []); });

  const opts = () => ({ fmt: $('#format').value, q: parseInt($('#quality').value, 10) / 100, maxw: parseInt($('#maxw').value, 10) || 0,
    rot: $('#rot').value, ratio: $('#ratio').value, exactW: parseInt($('#exw').value, 10) || 0, exactH: parseInt($('#exh').value, 10) || 0, filter: $('#filter').value });

  $('#go').addEventListener('click', async () => {
    if (!files.length) { alert(t('img_pick_first')); return; }
    const o = opts(); const ext = o.fmt.split('/')[1];
    if (files.length > 1) {
      // ПАКЕТНО: същите настройки за всяка снимка, всяка се сваля отделно.
      let n = 0;
      for (const f of files) {
        try { const img = await loadImage(f); const r = await processImage(img, o); if (r.blob) { downloadBlob(r.blob, (f.name.replace(/\.[^.]+$/, '') || 'image') + '.' + ext); n++; } } catch (e) {}
      }
      $('#cmp').style.display = 'none'; $('#save').textContent = tf('img_batch_done', n); return;
    }
    const f = files[0];
    try {
      const img = await loadImage(f);
      const r = await processImage(img, o);
      if (!r.blob) { $('#save').textContent = t('img_unsupported'); return; }
      compBlob = r.blob; compName = (f.name.replace(/\.[^.]+$/, '') || 'image') + '.' + ext;
      $('#cmp').style.display = 'flex';
      $('#origImg').src = URL.createObjectURL(f);
      $('#compImg').src = URL.createObjectURL(r.blob);
      $('#origSz').textContent = fmtSize(f.size) + ' · ' + tf('img_dims', img.width, img.height);
      $('#compSz').textContent = fmtSize(r.blob.size) + ' · ' + tf('img_dims', r.w, r.h);
      const saved = 100 - Math.round(r.blob.size / f.size * 100);
      $('#save').textContent = saved > 0 ? tf('img_saved', saved) : t('img_no_reduction');
    } catch (e) { $('#save').textContent = t('img_unsupported'); }
  });

  $('#dl').addEventListener('click', () => { if (compBlob) downloadBlob(compBlob, compName); });
}
