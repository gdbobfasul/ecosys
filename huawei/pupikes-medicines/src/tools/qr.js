// Version: 1.0001
// QR код — генериране (qrcode npm) + четене от файл/камера (jsqr npm).
// Изцяло на устройството, без мрежа.
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { esc, downloadBlob } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  qr_tab_gen: { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erstellen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएं', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  qr_tab_read: { bg:'Разчети', ru:'Сканировать', uk:'Сканувати', en:'Read', de:'Lesen', fr:'Lire', es:'Leer', 'es-MX':'Leer', it:'Leggi', pt:'Ler', ar:'قراءة', hi:'पढ़ें', ja:'読み取り', ky:'Окуу', 'zh-Hant':'讀取' },
  qr_gen_label: { bg:'Текст или URL за кодиране', ru:'Текст или URL для кодирования', uk:'Текст або URL для кодування', en:'Text or URL to encode', de:'Text oder URL zum Kodieren', fr:'Texte ou URL à encoder', es:'Texto o URL a codificar', 'es-MX':'Texto o URL a codificar', it:'Testo o URL da codificare', pt:'Texto ou URL para codificar', ar:'نص أو رابط للترميز', hi:'एन्कोड करने हेतु टेक्स्ट या URL', ja:'エンコードするテキストまたはURL', ky:'Коддоо үчүн текст же URL', 'zh-Hant':'要編碼的文字或網址' },
  qr_gen_ph: { bg:'https://example.com или произволен текст', ru:'https://example.com или любой текст', uk:'https://example.com або будь-який текст', en:'https://example.com or any text', de:'https://example.com oder beliebiger Text', fr:'https://example.com ou n’importe quel texte', es:'https://example.com o cualquier texto', 'es-MX':'https://example.com o cualquier texto', it:'https://example.com o qualsiasi testo', pt:'https://example.com ou qualquer texto', ar:'https://example.com أو أي نص', hi:'https://example.com या कोई भी टेक्स्ट', ja:'https://example.com または任意のテキスト', ky:'https://example.com же каалаган текст', 'zh-Hant':'https://example.com 或任意文字' },
  qr_size_label: { bg:'Размер', ru:'Размер', uk:'Розмір', en:'Size', de:'Größe', fr:'Taille', es:'Tamaño', 'es-MX':'Tamaño', it:'Dimensione', pt:'Tamanho', ar:'الحجم', hi:'आकार', ja:'サイズ', ky:'Өлчөм', 'zh-Hant':'尺寸' },
  qr_size_s: { bg:'Малък (200px)', ru:'Маленький (200px)', uk:'Малий (200px)', en:'Small (200px)', de:'Klein (200px)', fr:'Petit (200px)', es:'Pequeño (200px)', 'es-MX':'Pequeño (200px)', it:'Piccolo (200px)', pt:'Pequeno (200px)', ar:'صغير (200px)', hi:'छोटा (200px)', ja:'小 (200px)', ky:'Кичине (200px)', 'zh-Hant':'小 (200px)' },
  qr_size_m: { bg:'Среден (300px)', ru:'Средний (300px)', uk:'Середній (300px)', en:'Medium (300px)', de:'Mittel (300px)', fr:'Moyen (300px)', es:'Mediano (300px)', 'es-MX':'Mediano (300px)', it:'Medio (300px)', pt:'Médio (300px)', ar:'متوسط (300px)', hi:'मध्यम (300px)', ja:'中 (300px)', ky:'Орто (300px)', 'zh-Hant':'中 (300px)' },
  qr_size_l: { bg:'Голям (500px)', ru:'Большой (500px)', uk:'Великий (500px)', en:'Large (500px)', de:'Groß (500px)', fr:'Grand (500px)', es:'Grande (500px)', 'es-MX':'Grande (500px)', it:'Grande (500px)', pt:'Grande (500px)', ar:'كبير (500px)', hi:'बड़ा (500px)', ja:'大 (500px)', ky:'Чоң (500px)', 'zh-Hant':'大 (500px)' },
  qr_ecc_label: { bg:'Корекция на грешки', ru:'Коррекция ошибок', uk:'Корекція помилок', en:'Error correction', de:'Fehlerkorrektur', fr:'Correction d’erreurs', es:'Corrección de errores', 'es-MX':'Corrección de errores', it:'Correzione errori', pt:'Correção de erros', ar:'تصحيح الأخطاء', hi:'त्रुटि सुधार', ja:'誤り訂正', ky:'Каталарды оңдоо', 'zh-Hant':'錯誤修正' },
  qr_ecc_l: { bg:'Ниска (L)', ru:'Низкая (L)', uk:'Низька (L)', en:'Low (L)', de:'Niedrig (L)', fr:'Faible (L)', es:'Baja (L)', 'es-MX':'Baja (L)', it:'Bassa (L)', pt:'Baixa (L)', ar:'منخفض (L)', hi:'निम्न (L)', ja:'低 (L)', ky:'Төмөн (L)', 'zh-Hant':'低 (L)' },
  qr_ecc_m: { bg:'Средна (M)', ru:'Средняя (M)', uk:'Середня (M)', en:'Medium (M)', de:'Mittel (M)', fr:'Moyenne (M)', es:'Media (M)', 'es-MX':'Media (M)', it:'Media (M)', pt:'Média (M)', ar:'متوسط (M)', hi:'मध्यम (M)', ja:'中 (M)', ky:'Орто (M)', 'zh-Hant':'中 (M)' },
  qr_ecc_q: { bg:'Висока (Q)', ru:'Высокая (Q)', uk:'Висока (Q)', en:'High (Q)', de:'Hoch (Q)', fr:'Élevée (Q)', es:'Alta (Q)', 'es-MX':'Alta (Q)', it:'Alta (Q)', pt:'Alta (Q)', ar:'عالٍ (Q)', hi:'उच्च (Q)', ja:'高 (Q)', ky:'Жогору (Q)', 'zh-Hant':'高 (Q)' },
  qr_ecc_h: { bg:'Максимална (H)', ru:'Максимальная (H)', uk:'Максимальна (H)', en:'Maximum (H)', de:'Maximal (H)', fr:'Maximale (H)', es:'Máxima (H)', 'es-MX':'Máxima (H)', it:'Massima (H)', pt:'Máxima (H)', ar:'أقصى (H)', hi:'अधिकतम (H)', ja:'最大 (H)', ky:'Эң жогорку (H)', 'zh-Hant':'最高 (H)' },
  qr_gen_btn: { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erstellen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएं', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  qr_read_hint: { bg:'Качи снимка с QR код или сканирай с камерата — текстът/линкът се разчита на устройството.', ru:'Загрузи фото с QR-кодом или сканируй камерой — текст/ссылка читаются на устройстве.', uk:'Завантаж фото з QR-кодом або скануй камерою — текст/посилання читаються на пристрої.', en:'Upload a photo with a QR code or scan with the camera — the text/link is read on your device.', de:'Lade ein Foto mit QR-Code hoch oder scanne mit der Kamera — Text/Link wird auf dem Gerät gelesen.', fr:'Importe une photo avec un code QR ou scanne avec la caméra — le texte/lien est lu sur l’appareil.', es:'Sube una foto con un código QR o escanea con la cámara — el texto/enlace se lee en el dispositivo.', 'es-MX':'Sube una foto con un código QR o escanea con la cámara — el texto/enlace se lee en el dispositivo.', it:'Carica una foto con un codice QR o scansiona con la fotocamera — il testo/link viene letto sul dispositivo.', pt:'Envie uma foto com um código QR ou escaneie com a câmera — o texto/link é lido no dispositivo.', ar:'حمّل صورة بها رمز QR أو امسحها بالكاميرا — يُقرأ النص/الرابط على جهازك.', hi:'QR कोड वाली फ़ोटो अपलोड करें या कैमरे से स्कैन करें — टेक्स्ट/लिंक डिवाइस पर पढ़ा जाता है।', ja:'QRコードの写真をアップロードするかカメラでスキャン — テキスト/リンクは端末上で読み取られます。', ky:'QR коду бар сүрөттү жүктө же камера менен скандa — текст/шилтеме түзмөктө окулат.', 'zh-Hant':'上傳含 QR 碼的相片或以相機掃描 — 文字／連結在裝置上讀取。' },
  qr_read_label: { bg:'Качи изображение с QR код', ru:'Загрузи изображение с QR-кодом', uk:'Завантаж зображення з QR-кодом', en:'Upload an image with a QR code', de:'Bild mit QR-Code hochladen', fr:'Importer une image avec un code QR', es:'Sube una imagen con un código QR', 'es-MX':'Sube una imagen con un código QR', it:'Carica un’immagine con un codice QR', pt:'Envie uma imagem com um código QR', ar:'حمّل صورة بها رمز QR', hi:'QR कोड वाली इमेज अपलोड करें', ja:'QRコード付き画像をアップロード', ky:'QR коду бар сүрөттү жүктө', 'zh-Hant':'上傳含 QR 碼的圖片' },
  qr_decode_btn: { bg:'Разчети от файл', ru:'Сканировать из файла', uk:'Сканувати з файлу', en:'Read from file', de:'Aus Datei lesen', fr:'Lire depuis un fichier', es:'Leer desde archivo', 'es-MX':'Leer desde archivo', it:'Leggi da file', pt:'Ler do arquivo', ar:'قراءة من ملف', hi:'फ़ाइल से पढ़ें', ja:'ファイルから読み取り', ky:'Файлдан окуу', 'zh-Hant':'從檔案讀取' },
  qr_cam_btn: { bg:'Сканирай с камера', ru:'Сканировать камерой', uk:'Сканувати камерою', en:'Scan with camera', de:'Mit Kamera scannen', fr:'Scanner avec la caméra', es:'Escanear con cámara', 'es-MX':'Escanear con cámara', it:'Scansiona con fotocamera', pt:'Escanear com câmera', ar:'امسح بالكاميرا', hi:'कैमरे से स्कैन करें', ja:'カメラでスキャン', ky:'Камера менен скандоо', 'zh-Hant':'以相機掃描' },
  qr_cam_stop: { bg:'Спри камерата', ru:'Остановить камеру', uk:'Зупинити камеру', en:'Stop camera', de:'Kamera stoppen', fr:'Arrêter la caméra', es:'Detener cámara', 'es-MX':'Detener cámara', it:'Ferma fotocamera', pt:'Parar câmera', ar:'إيقاف الكاميرا', hi:'कैमरा रोकें', ja:'カメラを停止', ky:'Камераны токтотуу', 'zh-Hant':'停止相機' },
  qr_err_empty: { bg:'Въведи текст или URL.', ru:'Введи текст или URL.', uk:'Введи текст або URL.', en:'Enter text or a URL.', de:'Text oder URL eingeben.', fr:'Saisis un texte ou une URL.', es:'Introduce texto o una URL.', 'es-MX':'Introduce texto o una URL.', it:'Inserisci testo o un URL.', pt:'Insira texto ou uma URL.', ar:'أدخل نصًا أو رابطًا.', hi:'टेक्स्ट या URL दर्ज करें।', ja:'テキストまたはURLを入力。', ky:'Текст же URL киргиз.', 'zh-Hant':'請輸入文字或網址。' },
  qr_err_toolong: { bg:'Текстът е твърде дълъг за този размер/ниво. Опитай по-голям размер или ниво „L".', ru:'Текст слишком длинный для этого размера/уровня. Попробуй больший размер или уровень «L».', uk:'Текст занадто довгий для цього розміру/рівня. Спробуй більший розмір або рівень «L».', en:'The text is too long for this size/level. Try a larger size or level “L”.', de:'Der Text ist zu lang für diese Größe/Stufe. Versuche eine größere Größe oder Stufe „L".', fr:'Le texte est trop long pour cette taille/ce niveau. Essaie une taille plus grande ou le niveau « L ».', es:'El texto es demasiado largo para este tamaño/nivel. Prueba un tamaño mayor o el nivel «L».', 'es-MX':'El texto es demasiado largo para este tamaño/nivel. Prueba un tamaño mayor o el nivel «L».', it:'Il testo è troppo lungo per questa dimensione/livello. Prova una dimensione maggiore o il livello «L».', pt:'O texto é muito longo para este tamanho/nível. Tente um tamanho maior ou o nível “L”.', ar:'النص طويل جدًا لهذا الحجم/المستوى. جرّب حجمًا أكبر أو المستوى «L».', hi:'इस आकार/स्तर के लिए टेक्स्ट बहुत लंबा है। बड़ा आकार या स्तर “L” आज़माएं।', ja:'このサイズ/レベルにはテキストが長すぎます。より大きいサイズまたはレベル「L」を試してください。', ky:'Текст бул өлчөм/деңгээл үчүн өтө узун. Чоңураак өлчөм же «L» деңгээлин сынап көр.', 'zh-Hant':'文字對此尺寸／等級而言太長。請試試更大的尺寸或等級「L」。' },
  qr_dl_btn: { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG herunterladen', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Baixar PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड करें', ja:'PNGをダウンロード', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  qr_attach_first: { bg:'Първо прикачи изображение.', ru:'Сначала прикрепи изображение.', uk:'Спершу прикріпи зображення.', en:'Attach an image first.', de:'Zuerst ein Bild anhängen.', fr:'Joins d’abord une image.', es:'Adjunta primero una imagen.', 'es-MX':'Adjunta primero una imagen.', it:'Allega prima un’immagine.', pt:'Anexe primeiro uma imagem.', ar:'أرفق صورة أولًا.', hi:'पहले एक इमेज संलग्न करें।', ja:'まず画像を添付してください。', ky:'Адегенде сүрөт тиркеп ал.', 'zh-Hant':'請先附加圖片。' },
  qr_reading: { bg:'Разчитам…', ru:'Сканирую…', uk:'Сканую…', en:'Reading…', de:'Lese…', fr:'Lecture…', es:'Leyendo…', 'es-MX':'Leyendo…', it:'Lettura…', pt:'Lendo…', ar:'جارٍ القراءة…', hi:'पढ़ रहा…', ja:'読み取り中…', ky:'Окулууда…', 'zh-Hant':'讀取中…' },
  qr_read_err: { bg:'Грешка при разчитане: {0}', ru:'Ошибка чтения: {0}', uk:'Помилка читання: {0}', en:'Read error: {0}', de:'Lesefehler: {0}', fr:'Erreur de lecture : {0}', es:'Error de lectura: {0}', 'es-MX':'Error de lectura: {0}', it:'Errore di lettura: {0}', pt:'Erro de leitura: {0}', ar:'خطأ في القراءة: {0}', hi:'पढ़ने में त्रुटि: {0}', ja:'読み取りエラー: {0}', ky:'Окуу катасы: {0}', 'zh-Hant':'讀取錯誤：{0}' },
  qr_img_load_err: { bg:'Изображението не може да се зареди.', ru:'Изображение не удалось загрузить.', uk:'Зображення не вдалося завантажити.', en:'The image could not be loaded.', de:'Das Bild konnte nicht geladen werden.', fr:'Impossible de charger l’image.', es:'No se pudo cargar la imagen.', 'es-MX':'No se pudo cargar la imagen.', it:'Impossibile caricare l’immagine.', pt:'Não foi possível carregar a imagem.', ar:'تعذّر تحميل الصورة.', hi:'इमेज लोड नहीं हो सकी।', ja:'画像を読み込めませんでした。', ky:'Сүрөт жүктөлгөн жок.', 'zh-Hant':'無法載入圖片。' },
  qr_cam_unavail: { bg:'Камерата не е достъпна: {0}', ru:'Камера недоступна: {0}', uk:'Камера недоступна: {0}', en:'Camera unavailable: {0}', de:'Kamera nicht verfügbar: {0}', fr:'Caméra indisponible : {0}', es:'Cámara no disponible: {0}', 'es-MX':'Cámara no disponible: {0}', it:'Fotocamera non disponibile: {0}', pt:'Câmera indisponível: {0}', ar:'الكاميرا غير متاحة: {0}', hi:'कैमरा उपलब्ध नहीं: {0}', ja:'カメラが利用できません: {0}', ky:'Камера жеткиликсиз: {0}', 'zh-Hant':'相機無法使用：{0}' },
  qr_not_found: { bg:'QR код не е разпознат.', ru:'QR-код не распознан.', uk:'QR-код не розпізнано.', en:'No QR code recognized.', de:'Kein QR-Code erkannt.', fr:'Aucun code QR reconnu.', es:'No se reconoció ningún código QR.', 'es-MX':'No se reconoció ningún código QR.', it:'Nessun codice QR riconosciuto.', pt:'Nenhum código QR reconhecido.', ar:'لم يتم التعرف على رمز QR.', hi:'कोई QR कोड नहीं पहचाना गया।', ja:'QRコードを認識できませんでした。', ky:'QR код таанылган жок.', 'zh-Hant':'未辨識到 QR 碼。' },
  qr_content: { bg:'Съдържание:', ru:'Содержимое:', uk:'Вміст:', en:'Content:', de:'Inhalt:', fr:'Contenu :', es:'Contenido:', 'es-MX':'Contenido:', it:'Contenuto:', pt:'Conteúdo:', ar:'المحتوى:', hi:'सामग्री:', ja:'内容:', ky:'Мазмун:', 'zh-Hant':'內容：' },
  qr_is_link: { bg:'Това е линк.', ru:'Это ссылка.', uk:'Це посилання.', en:'This is a link.', de:'Das ist ein Link.', fr:'Ceci est un lien.', es:'Esto es un enlace.', 'es-MX':'Esto es un enlace.', it:'Questo è un link.', pt:'Isto é um link.', ar:'هذا رابط.', hi:'यह एक लिंक है।', ja:'これはリンクです。', ky:'Бул шилтеме.', 'zh-Hant':'這是一個連結。' },
  qr_is_text: { bg:'Това е текст.', ru:'Это текст.', uk:'Це текст.', en:'This is text.', de:'Das ist Text.', fr:'Ceci est du texte.', es:'Esto es texto.', 'es-MX':'Esto es texto.', it:'Questo è testo.', pt:'Isto é texto.', ar:'هذا نص.', hi:'यह टेक्स्ट है।', ja:'これはテキストです。', ky:'Бул текст.', 'zh-Hant':'這是文字。' }
});

export const title = 'QR код';

// jsQR връща code.data като latin1 низ — за кирилица/UTF-8 декодираме
// суровите байтове (binaryData) през TextDecoder, иначе кирилицата се чупи.
function qrText(code) {
  if (!code) return null;
  try {
    if (code.binaryData && code.binaryData.length) {
      return new TextDecoder('utf-8').decode(new Uint8Array(code.binaryData));
    }
  } catch (e) { /* fallback към code.data */ }
  return code.data;
}

export function render(root) {
  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="gen">${esc(t('qr_tab_gen'))}</button>
      <button class="tab" data-tab="read">${esc(t('qr_tab_read'))}</button>
    </div>
    <div class="tool-card" data-panel="gen">
      <label>${esc(t('qr_gen_label'))}</label>
      <textarea id="gentext" placeholder="${esc(t('qr_gen_ph'))}"></textarea>
      <div class="row">
        <div>
          <label>${esc(t('qr_size_label'))}</label>
          <select id="gensize">
            <option value="200">${esc(t('qr_size_s'))}</option>
            <option value="300" selected>${esc(t('qr_size_m'))}</option>
            <option value="500">${esc(t('qr_size_l'))}</option>
          </select>
        </div>
        <div>
          <label>${esc(t('qr_ecc_label'))}</label>
          <select id="genecc">
            <option value="L">${esc(t('qr_ecc_l'))}</option>
            <option value="M" selected>${esc(t('qr_ecc_m'))}</option>
            <option value="Q">${esc(t('qr_ecc_q'))}</option>
            <option value="H">${esc(t('qr_ecc_h'))}</option>
          </select>
        </div>
      </div>
      <button class="btn" id="genbtn">${esc(t('qr_gen_btn'))}</button>
      <div class="center" id="genresult"></div>
    </div>
    <div class="tool-card" data-panel="read" style="display:none">
      <p class="hint">${esc(t('qr_read_hint'))}</p>
      <label>${esc(t('qr_read_label'))}</label>
      <input type="file" id="readfile" accept="image/*" />
      <button class="btn" id="decodebtn">${esc(t('qr_decode_btn'))}</button>
      <div class="row" style="margin-top:14px">
        <button class="btn sec" id="cambtn">${esc(t('qr_cam_btn'))}</button>
        <button class="btn sec" id="camstop">${esc(t('qr_cam_stop'))}</button>
      </div>
      <div class="center" id="camwrap" style="display:none;margin-top:12px"><video id="cam" playsinline></video></div>
      <div class="readout" id="readout" style="display:none"></div>
    </div>
  `;

  const $ = (s) => root.querySelector(s);

  // --- табове ---
  root.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      root.querySelectorAll('[data-panel]').forEach((p) => {
        p.style.display = p.dataset.panel === which ? 'block' : 'none';
      });
      if (which !== 'read') stopCam();
    });
  });

  // --- генериране ---
  $('#genbtn').addEventListener('click', async () => {
    const txt = $('#gentext').value;
    const box = $('#genresult');
    if (!txt || !txt.trim()) { box.innerHTML = '<p style="color:var(--err)">' + esc(t('qr_err_empty')) + '</p>'; return; }
    const size = parseInt($('#gensize').value, 10) || 300;
    const ecc = $('#genecc').value;
    const canvas = document.createElement('canvas');
    try {
      await QRCode.toCanvas(canvas, txt, { width: size, errorCorrectionLevel: ecc, margin: 1 });
    } catch (e) {
      box.innerHTML = '<p style="color:var(--err)">' + esc(t('qr_err_toolong')) + '</p>';
      return;
    }
    box.innerHTML = '<div class="qr-out"></div><button class="btn" id="dlqr">' + esc(t('qr_dl_btn')) + '</button>';
    box.querySelector('.qr-out').appendChild(canvas);
    box.querySelector('#dlqr').addEventListener('click', () => {
      canvas.toBlob((b) => b && downloadBlob(b, 'qr-code.png'), 'image/png');
    });
  });

  // --- четене от файл ---
  $('#decodebtn').addEventListener('click', () => {
    const f = $('#readfile').files && $('#readfile').files[0];
    if (!f) { showReadout(null, t('qr_attach_first')); return; }
    showReadout(null, t('qr_reading'));
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(d.data, d.width, d.height);
        showReadout(code ? qrText(code) : null);
      } catch (e) {
        showReadout(null, tf('qr_read_err', e.message));
      }
    };
    img.onerror = () => showReadout(null, t('qr_img_load_err'));
    img.src = URL.createObjectURL(f);
  });

  // --- камера ---
  let camStream = null, camRAF = null;
  $('#cambtn').addEventListener('click', startCam);
  $('#camstop').addEventListener('click', stopCam);

  async function startCam() {
    const v = $('#cam');
    $('#camwrap').style.display = 'block';
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      v.srcObject = camStream; await v.play();
      scanLoop();
    } catch (e) {
      $('#camwrap').style.display = 'none';
      showReadout(null, tf('qr_cam_unavail', e.message));
    }
  }
  function stopCam() {
    if (camRAF) cancelAnimationFrame(camRAF);
    if (camStream) { camStream.getTracks().forEach((trk) => trk.stop()); camStream = null; }
    $('#camwrap').style.display = 'none';
  }
  function scanLoop() {
    const v = $('#cam');
    if (!camStream) return;
    if (v.readyState === v.HAVE_ENOUGH_DATA) {
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(d.data, d.width, d.height);
      if (code) { showReadout(qrText(code)); stopCam(); return; }
    }
    camRAF = requestAnimationFrame(scanLoop);
  }

  function showReadout(data, customEmpty) {
    const box = $('#readout');
    box.style.display = 'block';
    if (!data) {
      box.className = 'readout empty';
      box.textContent = customEmpty || t('qr_not_found');
      return;
    }
    box.className = 'readout';
    const isUrl = /^https?:\/\//i.test(data);
    const safe = esc(data);
    box.innerHTML = '<strong>' + esc(t('qr_content')) + '</strong><br>' +
      (isUrl
        ? `<a href="${safe}" target="_blank" rel="noopener">${safe}</a><br><span class="hint">${esc(t('qr_is_link'))}</span>`
        : `<span>${safe}</span><br><span class="hint">${esc(t('qr_is_text'))}</span>`);
  }

  // спри камерата при напускане на изгледа
  window.addEventListener('hashchange', stopCam, { once: true });
}
