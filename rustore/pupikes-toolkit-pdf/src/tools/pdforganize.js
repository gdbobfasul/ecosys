// Version: 1.0026
// PDF студио — визуално пренареждане на страници (миниатюри), снимки → PDF, текст → PDF,
// печат по позиция, няколко страници на лист, данни/метаданни на файла.
// Изцяло офлайн: pdf-lib (сглобяване) + pdfjs-dist (миниатюри). Нищо не се качва никъде.
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { setStatus, downloadBlob, fmtSize, esc } from '../core/ui.js';
import { t, tf, register, getLang } from '../core/i18n.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
// Unicode шрифтове (латиница, кирилица, гръцки) — бандълват се ЛОКАЛНО, без мрежа.
import fontRegularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import fontBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';

register({
  pdfo_title: { bg:'PDF студио', ru:'PDF-студия', uk:'PDF-студія', en:'PDF studio', de:'PDF-Studio', fr:'Studio PDF', es:'Estudio PDF', 'es-MX':'Estudio PDF', it:'Studio PDF', pt:'Estúdio PDF', ar:'استوديو PDF', hi:'PDF स्टूडियो', ja:'PDFスタジオ', ky:'PDF студиясы', 'zh-Hant':'PDF 工作室' },
  pdfo_tab_pages: { bg:'Страници', ru:'Страницы', uk:'Сторінки', en:'Pages', de:'Seiten', fr:'Pages', es:'Páginas', 'es-MX':'Páginas', it:'Pagine', pt:'Páginas', ar:'الصفحات', hi:'पेज', ja:'ページ', ky:'Барактар', 'zh-Hant':'頁面' },
  pdfo_tab_img: { bg:'Снимки → PDF', ru:'Фото → PDF', uk:'Фото → PDF', en:'Photos → PDF', de:'Fotos → PDF', fr:'Photos → PDF', es:'Fotos → PDF', 'es-MX':'Fotos → PDF', it:'Foto → PDF', pt:'Fotos → PDF', ar:'صور ← PDF', hi:'फ़ोटो → PDF', ja:'写真 → PDF', ky:'Сүрөттөр → PDF', 'zh-Hant':'照片 → PDF' },
  pdfo_tab_text: { bg:'Текст → PDF', ru:'Текст → PDF', uk:'Текст → PDF', en:'Text → PDF', de:'Text → PDF', fr:'Texte → PDF', es:'Texto → PDF', 'es-MX':'Texto → PDF', it:'Testo → PDF', pt:'Texto → PDF', ar:'نص ← PDF', hi:'टेक्स्ट → PDF', ja:'テキスト → PDF', ky:'Текст → PDF', 'zh-Hant':'文字 → PDF' },
  pdfo_tab_stamp: { bg:'Печат', ru:'Штамп', uk:'Штамп', en:'Stamp', de:'Stempel', fr:'Tampon', es:'Sello', 'es-MX':'Sello', it:'Timbro', pt:'Carimbo', ar:'ختم', hi:'स्टाम्प', ja:'スタンプ', ky:'Мөөр', 'zh-Hant':'印章' },
  pdfo_tab_layout: { bg:'На лист', ru:'На лист', uk:'На аркуш', en:'Per sheet', de:'Pro Blatt', fr:'Par feuille', es:'Por hoja', 'es-MX':'Por hoja', it:'Per foglio', pt:'Por folha', ar:'في الورقة', hi:'प्रति शीट', ja:'用紙割付', ky:'Баракка', 'zh-Hant':'每張版面' },
  pdfo_tab_info: { bg:'Данни', ru:'Сведения', uk:'Відомості', en:'Info', de:'Infos', fr:'Infos', es:'Datos', 'es-MX':'Datos', it:'Dati', pt:'Dados', ar:'معلومات', hi:'जानकारी', ja:'情報', ky:'Маалымат', 'zh-Hant':'資訊' },

  pdfo_pick_pdf: { bg:'Избери PDF файл', ru:'Выберите PDF-файл', uk:'Виберіть PDF-файл', en:'Choose a PDF file', de:'PDF-Datei wählen', fr:'Choisir un fichier PDF', es:'Elegir archivo PDF', 'es-MX':'Elegir archivo PDF', it:'Scegli un file PDF', pt:'Escolher arquivo PDF', ar:'اختر ملف PDF', hi:'PDF फ़ाइल चुनें', ja:'PDFファイルを選択', ky:'PDF файл тандаңыз', 'zh-Hant':'選擇 PDF 檔案' },
  pdfo_need_file: { bg:'Избери PDF файл.', ru:'Выберите PDF-файл.', uk:'Виберіть PDF-файл.', en:'Choose a PDF file.', de:'Wähle eine PDF-Datei.', fr:'Choisis un fichier PDF.', es:'Elige un archivo PDF.', 'es-MX':'Elige un archivo PDF.', it:'Scegli un file PDF.', pt:'Escolha um arquivo PDF.', ar:'اختر ملف PDF.', hi:'PDF फ़ाइल चुनें।', ja:'PDFファイルを選択してください。', ky:'PDF файл тандаңыз.', 'zh-Hant':'請選擇 PDF 檔案。' },
  pdfo_empty_file: { bg:'Файлът се прочете празен — копирай го в паметта на телефона и опитай пак.', ru:'Файл прочитан пустым — скопируйте его в память телефона и попробуйте снова.', uk:'Файл прочитано порожнім — скопіюйте його в пам’ять телефону і спробуйте знову.', en:'The file read as empty — copy it to the phone storage and try again.', de:'Die Datei wurde leer gelesen — kopiere sie in den Telefonspeicher und versuche es erneut.', fr:'Le fichier a été lu vide — copie-le dans la mémoire du téléphone et réessaie.', es:'El archivo se leyó vacío — cópialo a la memoria del teléfono e inténtalo de nuevo.', 'es-MX':'El archivo se leyó vacío — cópialo a la memoria del teléfono e inténtalo de nuevo.', it:'Il file risulta vuoto — copialo nella memoria del telefono e riprova.', pt:'O arquivo foi lido vazio — copie-o para a memória do telefone e tente novamente.', ar:'قُرئ الملف فارغًا — انسخه إلى ذاكرة الهاتف وحاول مجددًا.', hi:'फ़ाइल खाली पढ़ी गई — इसे फ़ोन स्टोरेज में कॉपी करके फिर से प्रयास करें।', ja:'ファイルが空として読み込まれました — 端末の内部ストレージにコピーして再試行してください。', ky:'Файл бош окулду — телефондун эсине көчүрүп, кайра аракет кылыңыз.', 'zh-Hant':'檔案讀取為空 — 請複製到手機儲存空間後再試一次。' },
  pdfo_working: { bg:'Обработвам…', ru:'Обрабатываю…', uk:'Обробляю…', en:'Processing…', de:'Verarbeite…', fr:'Traitement…', es:'Procesando…', 'es-MX':'Procesando…', it:'Elaborazione…', pt:'Processando…', ar:'جارٍ المعالجة…', hi:'प्रक्रिया जारी…', ja:'処理中…', ky:'Иштетилүүдө…', 'zh-Hant':'處理中…' },
  pdfo_err: { bg:'Грешка: {0}', ru:'Ошибка: {0}', uk:'Помилка: {0}', en:'Error: {0}', de:'Fehler: {0}', fr:'Erreur : {0}', es:'Error: {0}', 'es-MX':'Error: {0}', it:'Errore: {0}', pt:'Erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'Ката: {0}', 'zh-Hant':'錯誤：{0}' },

  // --- Страници (миниатюри) ---
  pdfo_pages_hint: { bg:'Разгледай миниатюрите: премести със стрелките, завърти или изтрий страница, добави празна — после запази новия PDF.', ru:'Просмотрите миниатюры: переместите стрелками, поверните или удалите страницу, добавьте пустую — затем сохраните новый PDF.', uk:'Перегляньте мініатюри: перемістіть стрілками, поверніть або видаліть сторінку, додайте порожню — потім збережіть новий PDF.', en:'Browse the thumbnails: move with the arrows, rotate or delete a page, add a blank one — then save the new PDF.', de:'Miniaturen ansehen: mit den Pfeilen verschieben, Seite drehen oder löschen, leere Seite einfügen — dann neues PDF speichern.', fr:'Parcours les miniatures : déplace avec les flèches, fais pivoter ou supprime une page, ajoute une page vierge — puis enregistre le nouveau PDF.', es:'Revisa las miniaturas: mueve con las flechas, gira o elimina una página, añade una en blanco — luego guarda el nuevo PDF.', 'es-MX':'Revisa las miniaturas: mueve con las flechas, gira o elimina una página, agrega una en blanco — luego guarda el nuevo PDF.', it:'Sfoglia le miniature: sposta con le frecce, ruota o elimina una pagina, aggiungine una vuota — poi salva il nuovo PDF.', pt:'Veja as miniaturas: mova com as setas, gire ou exclua uma página, adicione uma em branco — depois salve o novo PDF.', ar:'تصفّح المصغّرات: حرّك بالأسهم، أدر الصفحة أو احذفها، أضف صفحة فارغة — ثم احفظ ملف PDF الجديد.', hi:'थंबनेल देखें: तीरों से हिलाएँ, पेज घुमाएँ या हटाएँ, खाली पेज जोड़ें — फिर नई PDF सहेजें।', ja:'サムネイルを確認：矢印で移動、ページを回転・削除、白紙を追加 — その後新しいPDFを保存。', ky:'Миниатюраларды караңыз: жебелер менен жылдырыңыз, баракты айлантыңыз же өчүрүңүз, бош барак кошуңуз — анан жаңы PDF сактаңыз.', 'zh-Hant':'瀏覽縮圖：用箭頭移動、旋轉或刪除頁面、加入空白頁 — 然後儲存新的 PDF。' },
  pdfo_pages_loading: { bg:'Правя миниатюри… {0}/{1}', ru:'Создаю миниатюры… {0}/{1}', uk:'Створюю мініатюри… {0}/{1}', en:'Building thumbnails… {0}/{1}', de:'Erstelle Miniaturen… {0}/{1}', fr:'Création des miniatures… {0}/{1}', es:'Creando miniaturas… {0}/{1}', 'es-MX':'Creando miniaturas… {0}/{1}', it:'Creo le miniature… {0}/{1}', pt:'Criando miniaturas… {0}/{1}', ar:'إنشاء المصغّرات… {0}/{1}', hi:'थंबनेल बन रहे… {0}/{1}', ja:'サムネイル作成中… {0}/{1}', ky:'Миниатюралар түзүлүүдө… {0}/{1}', 'zh-Hant':'產生縮圖中… {0}/{1}' },
  pdfo_pages_loaded: { bg:'{0} страници заредени.', ru:'Загружено страниц: {0}.', uk:'Завантажено сторінок: {0}.', en:'{0} pages loaded.', de:'{0} Seiten geladen.', fr:'{0} pages chargées.', es:'{0} páginas cargadas.', 'es-MX':'{0} páginas cargadas.', it:'{0} pagine caricate.', pt:'{0} páginas carregadas.', ar:'تم تحميل {0} صفحات.', hi:'{0} पेज लोड हुए।', ja:'{0}ページを読み込みました。', ky:'{0} барак жүктөлдү.', 'zh-Hant':'已載入 {0} 頁。' },
  pdfo_reverse: { bg:'Обратен ред', ru:'Обратный порядок', uk:'Зворотний порядок', en:'Reverse order', de:'Reihenfolge umkehren', fr:'Ordre inverse', es:'Orden inverso', 'es-MX':'Orden inverso', it:'Ordine inverso', pt:'Ordem inversa', ar:'عكس الترتيب', hi:'उल्टा क्रम', ja:'逆順', ky:'Тескери тартип', 'zh-Hant':'反轉順序' },
  pdfo_blank: { bg:'+ Празна страница', ru:'+ Пустая страница', uk:'+ Порожня сторінка', en:'+ Blank page', de:'+ Leere Seite', fr:'+ Page vierge', es:'+ Página en blanco', 'es-MX':'+ Página en blanco', it:'+ Pagina vuota', pt:'+ Página em branco', ar:'+ صفحة فارغة', hi:'+ खाली पेज', ja:'+ 白紙ページ', ky:'+ Бош барак', 'zh-Hant':'+ 空白頁' },
  pdfo_reset: { bg:'Отначало', ru:'Сначала', uk:'Спочатку', en:'Start over', de:'Von vorn', fr:'Recommencer', es:'Empezar de nuevo', 'es-MX':'Empezar de nuevo', it:'Ricomincia', pt:'Recomeçar', ar:'البدء من جديد', hi:'फिर से शुरू', ja:'やり直す', ky:'Кайра баштоо', 'zh-Hant':'重新開始' },
  pdfo_pages_save: { bg:'Запази новия PDF', ru:'Сохранить новый PDF', uk:'Зберегти новий PDF', en:'Save the new PDF', de:'Neues PDF speichern', fr:'Enregistrer le nouveau PDF', es:'Guardar el nuevo PDF', 'es-MX':'Guardar el nuevo PDF', it:'Salva il nuovo PDF', pt:'Salvar o novo PDF', ar:'حفظ ملف PDF الجديد', hi:'नई PDF सहेजें', ja:'新しいPDFを保存', ky:'Жаңы PDF сактоо', 'zh-Hant':'儲存新的 PDF' },
  pdfo_pages_done: { bg:'Готово — {0} страници записани.', ru:'Готово — записано {0} страниц.', uk:'Готово — записано {0} сторінок.', en:'Done — {0} pages saved.', de:'Fertig — {0} Seiten gespeichert.', fr:'Terminé — {0} pages enregistrées.', es:'Listo — {0} páginas guardadas.', 'es-MX':'Listo — {0} páginas guardadas.', it:'Fatto — {0} pagine salvate.', pt:'Pronto — {0} páginas salvas.', ar:'تم — حفظ {0} صفحات.', hi:'पूर्ण — {0} पेज सहेजे गए।', ja:'完了 — {0}ページを保存しました。', ky:'Даяр — {0} барак сакталды.', 'zh-Hant':'完成 — 已儲存 {0} 頁。' },
  pdfo_pages_empty: { bg:'Няма останали страници.', ru:'Не осталось страниц.', uk:'Не залишилося сторінок.', en:'No pages left.', de:'Keine Seiten übrig.', fr:'Aucune page restante.', es:'No quedan páginas.', 'es-MX':'No quedan páginas.', it:'Nessuna pagina rimasta.', pt:'Não restam páginas.', ar:'لم تتبقَّ صفحات.', hi:'कोई पेज नहीं बचा।', ja:'ページが残っていません。', ky:'Барак калган жок.', 'zh-Hant':'沒有剩餘頁面。' },
  pdfo_blank_label: { bg:'празна', ru:'пустая', uk:'порожня', en:'blank', de:'leer', fr:'vierge', es:'en blanco', 'es-MX':'en blanco', it:'vuota', pt:'em branco', ar:'فارغة', hi:'खाली', ja:'白紙', ky:'бош', 'zh-Hant':'空白' },
  pdfo_mv: { bg:'Премести', ru:'Переместить', uk:'Перемістити', en:'Move', de:'Verschieben', fr:'Déplacer', es:'Mover', 'es-MX':'Mover', it:'Sposta', pt:'Mover', ar:'نقل', hi:'हिलाएँ', ja:'移動', ky:'Жылдыруу', 'zh-Hant':'移動' },
  pdfo_rot: { bg:'Завърти', ru:'Повернуть', uk:'Повернути', en:'Rotate', de:'Drehen', fr:'Pivoter', es:'Girar', 'es-MX':'Girar', it:'Ruota', pt:'Girar', ar:'تدوير', hi:'घुमाएँ', ja:'回転', ky:'Айлантуу', 'zh-Hant':'旋轉' },
  pdfo_del: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Excluir', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },

  // --- Снимки → PDF ---
  pdfo_img_pick: { bg:'Избери снимки (JPG/PNG/WebP) в реда на страниците', ru:'Выберите фото (JPG/PNG/WebP) в порядке страниц', uk:'Виберіть фото (JPG/PNG/WebP) у порядку сторінок', en:'Choose photos (JPG/PNG/WebP) in page order', de:'Fotos wählen (JPG/PNG/WebP) in Seitenreihenfolge', fr:'Choisis des photos (JPG/PNG/WebP) dans l’ordre des pages', es:'Elige fotos (JPG/PNG/WebP) en orden de páginas', 'es-MX':'Elige fotos (JPG/PNG/WebP) en orden de páginas', it:'Scegli le foto (JPG/PNG/WebP) nell’ordine delle pagine', pt:'Escolha fotos (JPG/PNG/WebP) na ordem das páginas', ar:'اختر الصور (JPG/PNG/WebP) بترتيب الصفحات', hi:'पेज क्रम में फ़ोटो चुनें (JPG/PNG/WebP)', ja:'写真（JPG/PNG/WebP）をページ順に選択', ky:'Сүрөттөрдү (JPG/PNG/WebP) барак тартибинде тандаңыз', 'zh-Hant':'依頁面順序選擇照片（JPG/PNG/WebP）' },
  pdfo_page_size: { bg:'Размер на страницата', ru:'Размер страницы', uk:'Розмір сторінки', en:'Page size', de:'Seitengröße', fr:'Taille de page', es:'Tamaño de página', 'es-MX':'Tamaño de página', it:'Dimensione pagina', pt:'Tamanho da página', ar:'حجم الصفحة', hi:'पेज आकार', ja:'ページサイズ', ky:'Барак өлчөмү', 'zh-Hant':'頁面大小' },
  pdfo_size_img: { bg:'По размера на снимката', ru:'По размеру фото', uk:'За розміром фото', en:'Fit to the photo', de:'Nach Fotogröße', fr:'À la taille de la photo', es:'Según la foto', 'es-MX':'Según la foto', it:'In base alla foto', pt:'Pelo tamanho da foto', ar:'بحسب حجم الصورة', hi:'फ़ोटो के आकार से', ja:'写真のサイズに合わせる', ky:'Сүрөттүн өлчөмү боюнча', 'zh-Hant':'依照片大小' },
  pdfo_orient: { bg:'Ориентация', ru:'Ориентация', uk:'Орієнтація', en:'Orientation', de:'Ausrichtung', fr:'Orientation', es:'Orientación', 'es-MX':'Orientación', it:'Orientamento', pt:'Orientação', ar:'الاتجاه', hi:'दिशा', ja:'向き', ky:'Багыты', 'zh-Hant':'方向' },
  pdfo_orient_auto: { bg:'Автоматично (по снимката)', ru:'Автоматически (по фото)', uk:'Автоматично (за фото)', en:'Automatic (by photo)', de:'Automatisch (nach Foto)', fr:'Automatique (selon la photo)', es:'Automática (según la foto)', 'es-MX':'Automática (según la foto)', it:'Automatico (in base alla foto)', pt:'Automática (pela foto)', ar:'تلقائي (بحسب الصورة)', hi:'स्वचालित (फ़ोटो अनुसार)', ja:'自動（写真に合わせる）', ky:'Автоматтык (сүрөт боюнча)', 'zh-Hant':'自動（依照片）' },
  pdfo_portrait: { bg:'Портрет', ru:'Книжная', uk:'Книжкова', en:'Portrait', de:'Hochformat', fr:'Portrait', es:'Vertical', 'es-MX':'Vertical', it:'Verticale', pt:'Retrato', ar:'عمودي', hi:'पोर्ट्रेट', ja:'縦', ky:'Тик', 'zh-Hant':'直向' },
  pdfo_landscape: { bg:'Пейзаж', ru:'Альбомная', uk:'Альбомна', en:'Landscape', de:'Querformat', fr:'Paysage', es:'Horizontal', 'es-MX':'Horizontal', it:'Orizzontale', pt:'Paisagem', ar:'أفقي', hi:'लैंडस्केप', ja:'横', ky:'Жантык', 'zh-Hant':'橫向' },
  pdfo_margin: { bg:'Полета (мм)', ru:'Поля (мм)', uk:'Поля (мм)', en:'Margins (mm)', de:'Ränder (mm)', fr:'Marges (mm)', es:'Márgenes (mm)', 'es-MX':'Márgenes (mm)', it:'Margini (mm)', pt:'Margens (mm)', ar:'الهوامش (مم)', hi:'हाशिये (मिमी)', ja:'余白（mm）', ky:'Талаалар (мм)', 'zh-Hant':'邊距（mm）' },
  pdfo_img_compress: { bg:'Свий снимките (JPEG — по-малък файл)', ru:'Сжать фото (JPEG — меньший файл)', uk:'Стиснути фото (JPEG — менший файл)', en:'Compress photos (JPEG — smaller file)', de:'Fotos komprimieren (JPEG — kleinere Datei)', fr:'Compresser les photos (JPEG — fichier plus petit)', es:'Comprimir fotos (JPEG — archivo más pequeño)', 'es-MX':'Comprimir fotos (JPEG — archivo más pequeño)', it:'Comprimi le foto (JPEG — file più piccolo)', pt:'Comprimir fotos (JPEG — arquivo menor)', ar:'ضغط الصور (JPEG — ملف أصغر)', hi:'फ़ोटो संपीड़ित करें (JPEG — छोटी फ़ाइल)', ja:'写真を圧縮（JPEG — ファイルを小さく）', ky:'Сүрөттөрдү кысуу (JPEG — кичине файл)', 'zh-Hant':'壓縮照片（JPEG — 檔案較小）' },
  pdfo_img_btn: { bg:'Създай PDF от снимките', ru:'Создать PDF из фото', uk:'Створити PDF із фото', en:'Create PDF from photos', de:'PDF aus Fotos erstellen', fr:'Créer un PDF à partir des photos', es:'Crear PDF con las fotos', 'es-MX':'Crear PDF con las fotos', it:'Crea PDF dalle foto', pt:'Criar PDF das fotos', ar:'إنشاء PDF من الصور', hi:'फ़ोटो से PDF बनाएँ', ja:'写真からPDFを作成', ky:'Сүрөттөрдөн PDF түзүү', 'zh-Hant':'從照片建立 PDF' },
  pdfo_img_need: { bg:'Избери поне една снимка.', ru:'Выберите хотя бы одно фото.', uk:'Виберіть хоча б одне фото.', en:'Choose at least one photo.', de:'Wähle mindestens ein Foto.', fr:'Choisis au moins une photo.', es:'Elige al menos una foto.', 'es-MX':'Elige al menos una foto.', it:'Scegli almeno una foto.', pt:'Escolha pelo menos uma foto.', ar:'اختر صورة واحدة على الأقل.', hi:'कम से कम एक फ़ोटो चुनें।', ja:'写真を1枚以上選択してください。', ky:'Жок дегенде бир сүрөт тандаңыз.', 'zh-Hant':'請至少選擇一張照片。' },
  pdfo_img_done: { bg:'Готово — {0} снимки в PDF.', ru:'Готово — {0} фото в PDF.', uk:'Готово — {0} фото у PDF.', en:'Done — {0} photos in the PDF.', de:'Fertig — {0} Fotos im PDF.', fr:'Terminé — {0} photos dans le PDF.', es:'Listo — {0} fotos en el PDF.', 'es-MX':'Listo — {0} fotos en el PDF.', it:'Fatto — {0} foto nel PDF.', pt:'Pronto — {0} fotos no PDF.', ar:'تم — {0} صور في ملف PDF.', hi:'पूर्ण — PDF में {0} फ़ोटो।', ja:'完了 — {0}枚の写真をPDFに。', ky:'Даяр — PDFте {0} сүрөт.', 'zh-Hant':'完成 — PDF 中有 {0} 張照片。' },

  // --- Текст → PDF ---
  pdfo_text_label: { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'テキスト', ky:'Текст', 'zh-Hant':'文字' },
  pdfo_text_ph: { bg:'Напиши или постави текста тук…', ru:'Напишите или вставьте текст здесь…', uk:'Напишіть або вставте текст тут…', en:'Type or paste the text here…', de:'Text hier eingeben oder einfügen…', fr:'Saisis ou colle le texte ici…', es:'Escribe o pega el texto aquí…', 'es-MX':'Escribe o pega el texto aquí…', it:'Scrivi o incolla il testo qui…', pt:'Digite ou cole o texto aqui…', ar:'اكتب النص أو الصقه هنا…', hi:'यहाँ टेक्स्ट लिखें या पेस्ट करें…', ja:'ここにテキストを入力または貼り付け…', ky:'Текстти бул жерге жазыңыз же коюңуз…', 'zh-Hant':'在此輸入或貼上文字…' },
  pdfo_font_size: { bg:'Размер на шрифта', ru:'Размер шрифта', uk:'Розмір шрифту', en:'Font size', de:'Schriftgröße', fr:'Taille de police', es:'Tamaño de letra', 'es-MX':'Tamaño de letra', it:'Dimensione carattere', pt:'Tamanho da fonte', ar:'حجم الخط', hi:'फ़ॉन्ट आकार', ja:'文字サイズ', ky:'Шрифт өлчөмү', 'zh-Hant':'字體大小' },
  pdfo_text_hint: { bg:'Вграден шрифт: латиница, кирилица и гръцки. Други знаци се заменят с „?“.', ru:'Встроенный шрифт: латиница, кириллица и греческий. Другие знаки заменяются на «?».', uk:'Вбудований шрифт: латиниця, кирилиця та грецька. Інші знаки замінюються на «?».', en:'Built-in font: Latin, Cyrillic and Greek. Other characters are replaced with “?”.', de:'Eingebettete Schrift: Latein, Kyrillisch und Griechisch. Andere Zeichen werden durch „?“ ersetzt.', fr:'Police intégrée : latin, cyrillique et grec. Les autres caractères sont remplacés par « ? ».', es:'Fuente integrada: latín, cirílico y griego. Otros caracteres se sustituyen por «?».', 'es-MX':'Fuente integrada: latín, cirílico y griego. Otros caracteres se sustituyen por «?».', it:'Carattere integrato: latino, cirillico e greco. Gli altri caratteri sono sostituiti da «?».', pt:'Fonte integrada: latim, cirílico e grego. Outros caracteres são substituídos por «?».', ar:'الخط المدمج: لاتيني وسيريلي ويوناني. تُستبدل الأحرف الأخرى بـ «?».', hi:'अंतर्निहित फ़ॉन्ट: लैटिन, सिरिलिक और ग्रीक। अन्य अक्षर “?” से बदले जाते हैं।', ja:'内蔵フォント：ラテン・キリル・ギリシャ文字。他の文字は「?」に置き換えられます。', ky:'Камтылган шрифт: латын, кириллица жана грек. Башка белгилер «?» менен алмаштырылат.', 'zh-Hant':'內建字型：拉丁、西里爾與希臘字母。其他字元將以「?」取代。' },
  pdfo_text_btn: { bg:'Създай PDF от текста', ru:'Создать PDF из текста', uk:'Створити PDF із тексту', en:'Create PDF from text', de:'PDF aus Text erstellen', fr:'Créer un PDF à partir du texte', es:'Crear PDF con el texto', 'es-MX':'Crear PDF con el texto', it:'Crea PDF dal testo', pt:'Criar PDF do texto', ar:'إنشاء PDF من النص', hi:'टेक्स्ट से PDF बनाएँ', ja:'テキストからPDFを作成', ky:'Тексттен PDF түзүү', 'zh-Hant':'從文字建立 PDF' },
  pdfo_text_need: { bg:'Въведи текст.', ru:'Введите текст.', uk:'Введіть текст.', en:'Enter some text.', de:'Gib einen Text ein.', fr:'Saisis un texte.', es:'Introduce un texto.', 'es-MX':'Escribe un texto.', it:'Inserisci un testo.', pt:'Digite um texto.', ar:'أدخل نصًا.', hi:'टेक्स्ट दर्ज करें।', ja:'テキストを入力してください。', ky:'Текст киргизиңиз.', 'zh-Hant':'請輸入文字。' },
  pdfo_text_done: { bg:'Готово — {0} страници.', ru:'Готово — {0} страниц.', uk:'Готово — {0} сторінок.', en:'Done — {0} pages.', de:'Fertig — {0} Seiten.', fr:'Terminé — {0} pages.', es:'Listo — {0} páginas.', 'es-MX':'Listo — {0} páginas.', it:'Fatto — {0} pagine.', pt:'Pronto — {0} páginas.', ar:'تم — {0} صفحات.', hi:'पूर्ण — {0} पेज।', ja:'完了 — {0}ページ。', ky:'Даяр — {0} барак.', 'zh-Hant':'完成 — {0} 頁。' },
  pdfo_text_repl: { bg:' Заменени {0} неподдържани знака.', ru:' Заменено неподдерживаемых знаков: {0}.', uk:' Замінено непідтримуваних знаків: {0}.', en:' {0} unsupported characters replaced.', de:' {0} nicht unterstützte Zeichen ersetzt.', fr:' {0} caractères non pris en charge remplacés.', es:' {0} caracteres no admitidos sustituidos.', 'es-MX':' {0} caracteres no admitidos sustituidos.', it:' {0} caratteri non supportati sostituiti.', pt:' {0} caracteres não suportados substituídos.', ar:' تم استبدال {0} أحرف غير مدعومة.', hi:' {0} असमर्थित अक्षर बदले गए।', ja:' 未対応文字を{0}個置き換えました。', ky:' {0} колдоого алынбаган белги алмаштырылды.', 'zh-Hant':' 已取代 {0} 個不支援的字元。' },

  // --- Печат ---
  pdfo_stamp_text: { bg:'Текст на печата', ru:'Текст штампа', uk:'Текст штампа', en:'Stamp text', de:'Stempeltext', fr:'Texte du tampon', es:'Texto del sello', 'es-MX':'Texto del sello', it:'Testo del timbro', pt:'Texto do carimbo', ar:'نص الختم', hi:'स्टाम्प टेक्स्ट', ja:'スタンプの文字', ky:'Мөөрдүн тексти', 'zh-Hant':'印章文字' },
  pdfo_stamp_default: { bg:'ЧЕРНОВА', ru:'ЧЕРНОВИК', uk:'ЧЕРНЕТКА', en:'DRAFT', de:'ENTWURF', fr:'BROUILLON', es:'BORRADOR', 'es-MX':'BORRADOR', it:'BOZZA', pt:'RASCUNHO', ar:'DRAFT', hi:'DRAFT', ja:'DRAFT', ky:'ДОЛБООР', 'zh-Hant':'DRAFT' },
  pdfo_stamp_hint: { bg:'За разлика от водния знак, печатът е малък текст в избран ъгъл — например „ЧЕРНОВА“, „КОПИЕ“, „ПЛАТЕНО“ с дата.', ru:'В отличие от водяного знака, штамп — небольшой текст в выбранном углу, например «ЧЕРНОВИК», «КОПИЯ», «ОПЛАЧЕНО» с датой.', uk:'На відміну від водяного знака, штамп — невеликий текст у вибраному куті, наприклад «ЧЕРНЕТКА», «КОПІЯ», «СПЛАЧЕНО» з датою.', en:'Unlike the watermark, the stamp is a small text in a chosen corner — e.g. “DRAFT”, “COPY”, “PAID” with a date.', de:'Anders als das Wasserzeichen ist der Stempel ein kleiner Text in einer gewählten Ecke — z. B. „ENTWURF“, „KOPIE“, „BEZAHLT“ mit Datum.', fr:'Contrairement au filigrane, le tampon est un petit texte dans un coin choisi — ex. « BROUILLON », « COPIE », « PAYÉ » avec la date.', es:'A diferencia de la marca de agua, el sello es un texto pequeño en una esquina elegida — p. ej. «BORRADOR», «COPIA», «PAGADO» con fecha.', 'es-MX':'A diferencia de la marca de agua, el sello es un texto pequeño en una esquina elegida — p. ej. «BORRADOR», «COPIA», «PAGADO» con fecha.', it:'A differenza della filigrana, il timbro è un testo piccolo in un angolo scelto — es. «BOZZA», «COPIA», «PAGATO» con data.', pt:'Diferente da marca d’água, o carimbo é um texto pequeno num canto escolhido — ex. «RASCUNHO», «CÓPIA», «PAGO» com data.', ar:'بخلاف العلامة المائية، الختم نص صغير في زاوية مختارة — مثل «DRAFT» أو «COPY» أو «PAID» مع التاريخ.', hi:'वॉटरमार्क से अलग, स्टाम्प चुने हुए कोने में छोटा टेक्स्ट है — जैसे “DRAFT”, “COPY”, “PAID” तारीख़ के साथ।', ja:'透かしと違い、スタンプは選んだ隅の小さな文字です — 例：「DRAFT」「COPY」「PAID」＋日付。', ky:'Суу белгисинен айырмаланып, мөөр — тандалган бурчтагы кичине текст, мисалы «ДОЛБООР», «КӨЧҮРМӨ», «ТӨЛӨНДҮ» дата менен.', 'zh-Hant':'與浮水印不同，印章是位於所選角落的小段文字 — 例如「DRAFT」「COPY」「PAID」加日期。' },
  pdfo_pos: { bg:'Позиция', ru:'Позиция', uk:'Позиція', en:'Position', de:'Position', fr:'Position', es:'Posición', 'es-MX':'Posición', it:'Posizione', pt:'Posição', ar:'الموضع', hi:'स्थिति', ja:'位置', ky:'Орду', 'zh-Hant':'位置' },
  pdfo_pos_tl: { bg:'Горе вляво', ru:'Вверху слева', uk:'Угорі ліворуч', en:'Top left', de:'Oben links', fr:'En haut à gauche', es:'Arriba a la izquierda', 'es-MX':'Arriba a la izquierda', it:'In alto a sinistra', pt:'Superior esquerdo', ar:'أعلى اليسار', hi:'ऊपर बाएँ', ja:'左上', ky:'Жогору солдо', 'zh-Hant':'左上' },
  pdfo_pos_tc: { bg:'Горе в средата', ru:'Вверху по центру', uk:'Угорі по центру', en:'Top center', de:'Oben Mitte', fr:'En haut au centre', es:'Arriba al centro', 'es-MX':'Arriba al centro', it:'In alto al centro', pt:'Superior centro', ar:'أعلى الوسط', hi:'ऊपर मध्य', ja:'上中央', ky:'Жогору ортодо', 'zh-Hant':'上中' },
  pdfo_pos_tr: { bg:'Горе вдясно', ru:'Вверху справа', uk:'Угорі праворуч', en:'Top right', de:'Oben rechts', fr:'En haut à droite', es:'Arriba a la derecha', 'es-MX':'Arriba a la derecha', it:'In alto a destra', pt:'Superior direito', ar:'أعلى اليمين', hi:'ऊपर दाएँ', ja:'右上', ky:'Жогору оңдо', 'zh-Hant':'右上' },
  pdfo_pos_c: { bg:'Център', ru:'По центру', uk:'По центру', en:'Center', de:'Mitte', fr:'Centre', es:'Centro', 'es-MX':'Centro', it:'Centro', pt:'Centro', ar:'الوسط', hi:'मध्य', ja:'中央', ky:'Борбор', 'zh-Hant':'中央' },
  pdfo_pos_bl: { bg:'Долу вляво', ru:'Внизу слева', uk:'Унизу ліворуч', en:'Bottom left', de:'Unten links', fr:'En bas à gauche', es:'Abajo a la izquierda', 'es-MX':'Abajo a la izquierda', it:'In basso a sinistra', pt:'Inferior esquerdo', ar:'أسفل اليسار', hi:'नीचे बाएँ', ja:'左下', ky:'Төмөн солдо', 'zh-Hant':'左下' },
  pdfo_pos_bc: { bg:'Долу в средата', ru:'Внизу по центру', uk:'Унизу по центру', en:'Bottom center', de:'Unten Mitte', fr:'En bas au centre', es:'Abajo al centro', 'es-MX':'Abajo al centro', it:'In basso al centro', pt:'Inferior centro', ar:'أسفل الوسط', hi:'नीचे मध्य', ja:'下中央', ky:'Төмөн ортодо', 'zh-Hant':'下中' },
  pdfo_pos_br: { bg:'Долу вдясно', ru:'Внизу справа', uk:'Унизу праворуч', en:'Bottom right', de:'Unten rechts', fr:'En bas à droite', es:'Abajo a la derecha', 'es-MX':'Abajo a la derecha', it:'In basso a destra', pt:'Inferior direito', ar:'أسفل اليمين', hi:'नीचे दाएँ', ja:'右下', ky:'Төмөн оңдо', 'zh-Hant':'右下' },
  pdfo_color: { bg:'Цвят', ru:'Цвет', uk:'Колір', en:'Color', de:'Farbe', fr:'Couleur', es:'Color', 'es-MX':'Color', it:'Colore', pt:'Cor', ar:'اللون', hi:'रंग', ja:'色', ky:'Түсү', 'zh-Hant':'顏色' },
  pdfo_c_red: { bg:'Червен', ru:'Красный', uk:'Червоний', en:'Red', de:'Rot', fr:'Rouge', es:'Rojo', 'es-MX':'Rojo', it:'Rosso', pt:'Vermelho', ar:'أحمر', hi:'लाल', ja:'赤', ky:'Кызыл', 'zh-Hant':'紅色' },
  pdfo_c_blue: { bg:'Син', ru:'Синий', uk:'Синій', en:'Blue', de:'Blau', fr:'Bleu', es:'Azul', 'es-MX':'Azul', it:'Blu', pt:'Azul', ar:'أزرق', hi:'नीला', ja:'青', ky:'Көк', 'zh-Hant':'藍色' },
  pdfo_c_gray: { bg:'Сив', ru:'Серый', uk:'Сірий', en:'Gray', de:'Grau', fr:'Gris', es:'Gris', 'es-MX':'Gris', it:'Grigio', pt:'Cinza', ar:'رمادي', hi:'धूसर', ja:'灰色', ky:'Боз', 'zh-Hant':'灰色' },
  pdfo_c_black: { bg:'Черен', ru:'Чёрный', uk:'Чорний', en:'Black', de:'Schwarz', fr:'Noir', es:'Negro', 'es-MX':'Negro', it:'Nero', pt:'Preto', ar:'أسود', hi:'काला', ja:'黒', ky:'Кара', 'zh-Hant':'黑色' },
  pdfo_c_green: { bg:'Зелен', ru:'Зелёный', uk:'Зелений', en:'Green', de:'Grün', fr:'Vert', es:'Verde', 'es-MX':'Verde', it:'Verde', pt:'Verde', ar:'أخضر', hi:'हरा', ja:'緑', ky:'Жашыл', 'zh-Hant':'綠色' },
  pdfo_opacity: { bg:'Плътност (%)', ru:'Непрозрачность (%)', uk:'Непрозорість (%)', en:'Opacity (%)', de:'Deckkraft (%)', fr:'Opacité (%)', es:'Opacidad (%)', 'es-MX':'Opacidad (%)', it:'Opacità (%)', pt:'Opacidade (%)', ar:'الشفافية (%)', hi:'अपारदर्शिता (%)', ja:'不透明度（%）', ky:'Тыгыздыгы (%)', 'zh-Hant':'不透明度（%）' },
  pdfo_add_date: { bg:'Добави днешната дата', ru:'Добавить сегодняшнюю дату', uk:'Додати сьогоднішню дату', en:'Add today’s date', de:'Heutiges Datum anfügen', fr:'Ajouter la date du jour', es:'Añadir la fecha de hoy', 'es-MX':'Agregar la fecha de hoy', it:'Aggiungi la data di oggi', pt:'Adicionar a data de hoje', ar:'إضافة تاريخ اليوم', hi:'आज की तारीख़ जोड़ें', ja:'今日の日付を追加', ky:'Бүгүнкү датаны кошуу', 'zh-Hant':'加入今天的日期' },
  pdfo_range: { bg:'Страници (празно = всички; напр. 1-3,5)', ru:'Страницы (пусто = все; напр. 1-3,5)', uk:'Сторінки (порожньо = усі; напр. 1-3,5)', en:'Pages (empty = all; e.g. 1-3,5)', de:'Seiten (leer = alle; z. B. 1-3,5)', fr:'Pages (vide = toutes ; ex. 1-3,5)', es:'Páginas (vacío = todas; p. ej. 1-3,5)', 'es-MX':'Páginas (vacío = todas; p. ej. 1-3,5)', it:'Pagine (vuoto = tutte; es. 1-3,5)', pt:'Páginas (vazio = todas; ex. 1-3,5)', ar:'الصفحات (فارغ = الكل؛ مثل 1-3,5)', hi:'पेज (खाली = सभी; जैसे 1-3,5)', ja:'ページ（空欄 = すべて、例: 1-3,5）', ky:'Барактар (бош = баары; мис. 1-3,5)', 'zh-Hant':'頁面（留空 = 全部；例如 1-3,5）' },
  pdfo_range_invalid: { bg:'Невалиден диапазон.', ru:'Неверный диапазон.', uk:'Невірний діапазон.', en:'Invalid range.', de:'Ungültiger Bereich.', fr:'Plage invalide.', es:'Rango no válido.', 'es-MX':'Rango no válido.', it:'Intervallo non valido.', pt:'Intervalo inválido.', ar:'نطاق غير صالح.', hi:'अमान्य रेंज।', ja:'範囲が無効です。', ky:'Жараксыз диапазон.', 'zh-Hant':'範圍無效。' },
  pdfo_stamp_btn: { bg:'Сложи печата', ru:'Поставить штамп', uk:'Поставити штамп', en:'Apply the stamp', de:'Stempel setzen', fr:'Appliquer le tampon', es:'Aplicar el sello', 'es-MX':'Aplicar el sello', it:'Applica il timbro', pt:'Aplicar o carimbo', ar:'وضع الختم', hi:'स्टाम्प लगाएँ', ja:'スタンプを押す', ky:'Мөөр басуу', 'zh-Hant':'加上印章' },
  pdfo_stamp_done: { bg:'Готово — печат на {0} страници.', ru:'Готово — штамп на {0} страницах.', uk:'Готово — штамп на {0} сторінках.', en:'Done — stamp on {0} pages.', de:'Fertig — Stempel auf {0} Seiten.', fr:'Terminé — tampon sur {0} pages.', es:'Listo — sello en {0} páginas.', 'es-MX':'Listo — sello en {0} páginas.', it:'Fatto — timbro su {0} pagine.', pt:'Pronto — carimbo em {0} páginas.', ar:'تم — ختم على {0} صفحات.', hi:'पूर्ण — {0} पेज पर स्टाम्प।', ja:'完了 — {0}ページにスタンプ。', ky:'Даяр — {0} баракта мөөр.', 'zh-Hant':'完成 — {0} 頁已加印章。' },

  // --- На лист ---
  pdfo_layout_hint: { bg:'Събира няколко страници на един лист (за печат/преглед) или уеднаквява всички страници към един размер.', ru:'Размещает несколько страниц на одном листе (для печати/просмотра) или приводит все страницы к одному размеру.', uk:'Розміщує кілька сторінок на одному аркуші (для друку/перегляду) або приводить усі сторінки до одного розміру.', en:'Puts several pages on one sheet (for printing/review) or normalizes all pages to one size.', de:'Legt mehrere Seiten auf ein Blatt (zum Drucken/Prüfen) oder vereinheitlicht alle Seiten auf eine Größe.', fr:'Place plusieurs pages sur une feuille (impression/relecture) ou uniformise toutes les pages à une taille.', es:'Coloca varias páginas en una hoja (para imprimir/revisar) o unifica todas las páginas a un tamaño.', 'es-MX':'Coloca varias páginas en una hoja (para imprimir/revisar) o unifica todas las páginas a un tamaño.', it:'Mette più pagine su un foglio (per stampa/revisione) o uniforma tutte le pagine a una dimensione.', pt:'Coloca várias páginas numa folha (para impressão/revisão) ou uniformiza todas as páginas num tamanho.', ar:'يضع عدة صفحات في ورقة واحدة (للطباعة/المراجعة) أو يوحّد حجم جميع الصفحات.', hi:'कई पेज एक शीट पर रखता है (प्रिंट/समीक्षा हेतु) या सभी पेज एक आकार में करता है।', ja:'複数ページを1枚にまとめる（印刷・確認用）か、全ページを同じサイズに統一します。', ky:'Бир нече баракты бир баракка жайгаштырат (басып чыгаруу/кароо үчүн) же бардык барактарды бир өлчөмгө келтирет.', 'zh-Hant':'將多頁排在一張紙上（列印／檢閱用），或將所有頁面統一為同一大小。' },
  pdfo_layout_mode: { bg:'Подредба', ru:'Компоновка', uk:'Компонування', en:'Layout', de:'Anordnung', fr:'Disposition', es:'Disposición', 'es-MX':'Disposición', it:'Disposizione', pt:'Disposição', ar:'التخطيط', hi:'लेआउट', ja:'割付', ky:'Жайгашуу', 'zh-Hant':'版面' },
  pdfo_l_1: { bg:'1 на лист — уеднакви размера', ru:'1 на лист — единый размер', uk:'1 на аркуш — єдиний розмір', en:'1 per sheet — normalize size', de:'1 pro Blatt — Größe vereinheitlichen', fr:'1 par feuille — taille uniforme', es:'1 por hoja — unificar tamaño', 'es-MX':'1 por hoja — unificar tamaño', it:'1 per foglio — dimensione uniforme', pt:'1 por folha — uniformizar tamanho', ar:'1 في الورقة — توحيد الحجم', hi:'1 प्रति शीट — आकार एक करें', ja:'1ページ/枚 — サイズ統一', ky:'Баракка 1 — өлчөмдү бирдейлештирүү', 'zh-Hant':'每張 1 頁 — 統一大小' },
  pdfo_l_2: { bg:'2 на лист', ru:'2 на лист', uk:'2 на аркуш', en:'2 per sheet', de:'2 pro Blatt', fr:'2 par feuille', es:'2 por hoja', 'es-MX':'2 por hoja', it:'2 per foglio', pt:'2 por folha', ar:'2 في الورقة', hi:'2 प्रति शीट', ja:'2ページ/枚', ky:'Баракка 2', 'zh-Hant':'每張 2 頁' },
  pdfo_l_4: { bg:'4 на лист', ru:'4 на лист', uk:'4 на аркуш', en:'4 per sheet', de:'4 pro Blatt', fr:'4 par feuille', es:'4 por hoja', 'es-MX':'4 por hoja', it:'4 per foglio', pt:'4 por folha', ar:'4 في الورقة', hi:'4 प्रति शीट', ja:'4ページ/枚', ky:'Баракка 4', 'zh-Hant':'每張 4 頁' },
  pdfo_sheet: { bg:'Лист', ru:'Лист', uk:'Аркуш', en:'Sheet', de:'Blatt', fr:'Feuille', es:'Hoja', 'es-MX':'Hoja', it:'Foglio', pt:'Folha', ar:'الورقة', hi:'शीट', ja:'用紙', ky:'Барак', 'zh-Hant':'紙張' },
  pdfo_border: { bg:'Тънка рамка около всяка страница', ru:'Тонкая рамка вокруг каждой страницы', uk:'Тонка рамка навколо кожної сторінки', en:'Thin border around each page', de:'Dünner Rahmen um jede Seite', fr:'Fin cadre autour de chaque page', es:'Borde fino alrededor de cada página', 'es-MX':'Borde fino alrededor de cada página', it:'Bordo sottile attorno a ogni pagina', pt:'Borda fina ao redor de cada página', ar:'إطار رفيع حول كل صفحة', hi:'हर पेज के चारों ओर पतली सीमा', ja:'各ページに細い枠線', ky:'Ар бир барактын айланасында ичке чек', 'zh-Hant':'每頁加細邊框' },
  pdfo_layout_btn: { bg:'Подреди', ru:'Скомпоновать', uk:'Скомпонувати', en:'Arrange', de:'Anordnen', fr:'Disposer', es:'Organizar', 'es-MX':'Organizar', it:'Disponi', pt:'Organizar', ar:'ترتيب', hi:'व्यवस्थित करें', ja:'割り付ける', ky:'Жайгаштыруу', 'zh-Hant':'排版' },
  pdfo_layout_done: { bg:'Готово — {0} страници на {1} листа.', ru:'Готово — {0} страниц на {1} листах.', uk:'Готово — {0} сторінок на {1} аркушах.', en:'Done — {0} pages on {1} sheets.', de:'Fertig — {0} Seiten auf {1} Blättern.', fr:'Terminé — {0} pages sur {1} feuilles.', es:'Listo — {0} páginas en {1} hojas.', 'es-MX':'Listo — {0} páginas en {1} hojas.', it:'Fatto — {0} pagine su {1} fogli.', pt:'Pronto — {0} páginas em {1} folhas.', ar:'تم — {0} صفحات على {1} أوراق.', hi:'पूर्ण — {1} शीट पर {0} पेज।', ja:'完了 — {0}ページを{1}枚に。', ky:'Даяр — {1} баракта {0} бет.', 'zh-Hant':'完成 — {0} 頁排在 {1} 張紙上。' },

  // --- Данни ---
  pdfo_info_btn: { bg:'Прочети данните', ru:'Прочитать сведения', uk:'Прочитати відомості', en:'Read the info', de:'Infos lesen', fr:'Lire les infos', es:'Leer los datos', 'es-MX':'Leer los datos', it:'Leggi i dati', pt:'Ler os dados', ar:'قراءة المعلومات', hi:'जानकारी पढ़ें', ja:'情報を読み取る', ky:'Маалыматты окуу', 'zh-Hant':'讀取資訊' },
  pdfo_i_file: { bg:'Файл', ru:'Файл', uk:'Файл', en:'File', de:'Datei', fr:'Fichier', es:'Archivo', 'es-MX':'Archivo', it:'File', pt:'Arquivo', ar:'الملف', hi:'फ़ाइल', ja:'ファイル', ky:'Файл', 'zh-Hant':'檔案' },
  pdfo_i_size: { bg:'Размер', ru:'Размер', uk:'Розмір', en:'Size', de:'Größe', fr:'Taille', es:'Tamaño', 'es-MX':'Tamaño', it:'Dimensione', pt:'Tamanho', ar:'الحجم', hi:'आकार', ja:'サイズ', ky:'Өлчөмү', 'zh-Hant':'大小' },
  pdfo_i_pages: { bg:'Страници', ru:'Страниц', uk:'Сторінок', en:'Pages', de:'Seiten', fr:'Pages', es:'Páginas', 'es-MX':'Páginas', it:'Pagine', pt:'Páginas', ar:'الصفحات', hi:'पेज', ja:'ページ数', ky:'Барактар', 'zh-Hant':'頁數' },
  pdfo_i_pagesize: { bg:'Размер на страницата', ru:'Размер страницы', uk:'Розмір сторінки', en:'Page size', de:'Seitengröße', fr:'Taille de page', es:'Tamaño de página', 'es-MX':'Tamaño de página', it:'Dimensione pagina', pt:'Tamanho da página', ar:'حجم الصفحة', hi:'पेज आकार', ja:'ページサイズ', ky:'Барак өлчөмү', 'zh-Hant':'頁面大小' },
  pdfo_i_mixed: { bg:'(различни размери)', ru:'(разные размеры)', uk:'(різні розміри)', en:'(mixed sizes)', de:'(gemischte Größen)', fr:'(tailles mixtes)', es:'(tamaños distintos)', 'es-MX':'(tamaños distintos)', it:'(dimensioni miste)', pt:'(tamanhos variados)', ar:'(أحجام مختلفة)', hi:'(मिश्रित आकार)', ja:'（サイズ混在）', ky:'(ар кандай өлчөмдөр)', 'zh-Hant':'（大小不一）' },
  pdfo_i_enc: { bg:'Шифриран', ru:'Зашифрован', uk:'Зашифрований', en:'Encrypted', de:'Verschlüsselt', fr:'Chiffré', es:'Cifrado', 'es-MX':'Cifrado', it:'Cifrato', pt:'Criptografado', ar:'مشفّر', hi:'एन्क्रिप्टेड', ja:'暗号化', ky:'Шифрленген', 'zh-Hant':'已加密' },
  pdfo_yes: { bg:'да', ru:'да', uk:'так', en:'yes', de:'ja', fr:'oui', es:'sí', 'es-MX':'sí', it:'sì', pt:'sim', ar:'نعم', hi:'हाँ', ja:'はい', ky:'ооба', 'zh-Hant':'是' },
  pdfo_no: { bg:'не', ru:'нет', uk:'ні', en:'no', de:'nein', fr:'non', es:'no', 'es-MX':'no', it:'no', pt:'não', ar:'لا', hi:'नहीं', ja:'いいえ', ky:'жок', 'zh-Hant':'否' },
  pdfo_i_title: { bg:'Заглавие', ru:'Заголовок', uk:'Заголовок', en:'Title', de:'Titel', fr:'Titre', es:'Título', 'es-MX':'Título', it:'Titolo', pt:'Título', ar:'العنوان', hi:'शीर्षक', ja:'タイトル', ky:'Аталышы', 'zh-Hant':'標題' },
  pdfo_i_author: { bg:'Автор', ru:'Автор', uk:'Автор', en:'Author', de:'Autor', fr:'Auteur', es:'Autor', 'es-MX':'Autor', it:'Autore', pt:'Autor', ar:'المؤلف', hi:'लेखक', ja:'作成者', ky:'Автор', 'zh-Hant':'作者' },
  pdfo_i_subject: { bg:'Тема', ru:'Тема', uk:'Тема', en:'Subject', de:'Thema', fr:'Sujet', es:'Asunto', 'es-MX':'Asunto', it:'Oggetto', pt:'Assunto', ar:'الموضوع', hi:'विषय', ja:'件名', ky:'Темасы', 'zh-Hant':'主旨' },
  pdfo_i_keywords: { bg:'Ключови думи', ru:'Ключевые слова', uk:'Ключові слова', en:'Keywords', de:'Schlagwörter', fr:'Mots-clés', es:'Palabras clave', 'es-MX':'Palabras clave', it:'Parole chiave', pt:'Palavras-chave', ar:'الكلمات المفتاحية', hi:'कीवर्ड', ja:'キーワード', ky:'Ачкыч сөздөр', 'zh-Hant':'關鍵字' },
  pdfo_i_creator: { bg:'Създаден с', ru:'Создан в', uk:'Створено в', en:'Created with', de:'Erstellt mit', fr:'Créé avec', es:'Creado con', 'es-MX':'Creado con', it:'Creato con', pt:'Criado com', ar:'أُنشئ بواسطة', hi:'से बनाया गया', ja:'作成アプリ', ky:'Түзүлгөн программа', 'zh-Hant':'建立工具' },
  pdfo_i_producer: { bg:'Производител', ru:'Производитель', uk:'Виробник', en:'Producer', de:'Produzent', fr:'Producteur', es:'Productor', 'es-MX':'Productor', it:'Produttore', pt:'Produtor', ar:'المنتج', hi:'निर्माता', ja:'生成ソフト', ky:'Өндүрүүчү', 'zh-Hant':'產生器' },
  pdfo_i_created: { bg:'Създаден на', ru:'Дата создания', uk:'Дата створення', en:'Created on', de:'Erstellt am', fr:'Créé le', es:'Creado el', 'es-MX':'Creado el', it:'Creato il', pt:'Criado em', ar:'تاريخ الإنشاء', hi:'बनाया गया', ja:'作成日', ky:'Түзүлгөн күнү', 'zh-Hant':'建立日期' },
  pdfo_i_modified: { bg:'Променен на', ru:'Дата изменения', uk:'Дата зміни', en:'Modified on', de:'Geändert am', fr:'Modifié le', es:'Modificado el', 'es-MX':'Modificado el', it:'Modificato il', pt:'Modificado em', ar:'تاريخ التعديل', hi:'संशोधित', ja:'更新日', ky:'Өзгөртүлгөн күнү', 'zh-Hant':'修改日期' },
  pdfo_i_save: { bg:'Запази метаданните', ru:'Сохранить метаданные', uk:'Зберегти метадані', en:'Save metadata', de:'Metadaten speichern', fr:'Enregistrer les métadonnées', es:'Guardar metadatos', 'es-MX':'Guardar metadatos', it:'Salva i metadati', pt:'Salvar metadados', ar:'حفظ البيانات الوصفية', hi:'मेटाडेटा सहेजें', ja:'メタデータを保存', ky:'Метамаалыматты сактоо', 'zh-Hant':'儲存中繼資料' },
  pdfo_i_clear: { bg:'Изчисти всички метаданни', ru:'Очистить все метаданные', uk:'Очистити всі метадані', en:'Clear all metadata', de:'Alle Metadaten löschen', fr:'Effacer toutes les métadonnées', es:'Borrar todos los metadatos', 'es-MX':'Borrar todos los metadatos', it:'Cancella tutti i metadati', pt:'Limpar todos os metadados', ar:'مسح جميع البيانات الوصفية', hi:'सभी मेटाडेटा साफ़ करें', ja:'メタデータをすべて消去', ky:'Бардык метамаалыматты тазалоо', 'zh-Hant':'清除所有中繼資料' },
  pdfo_i_clear_hint: { bg:'Изчистването маха автор, заглавие, програма и дати — полезно преди да изпратиш файла.', ru:'Очистка удаляет автора, заголовок, программу и даты — полезно перед отправкой файла.', uk:'Очищення прибирає автора, заголовок, програму та дати — корисно перед надсиланням файлу.', en:'Clearing removes author, title, software and dates — useful before sending the file.', de:'Das Löschen entfernt Autor, Titel, Software und Daten — nützlich vor dem Versenden.', fr:'L’effacement retire auteur, titre, logiciel et dates — utile avant d’envoyer le fichier.', es:'Al borrar se quitan autor, título, programa y fechas — útil antes de enviar el archivo.', 'es-MX':'Al borrar se quitan autor, título, programa y fechas — útil antes de enviar el archivo.', it:'La cancellazione rimuove autore, titolo, software e date — utile prima di inviare il file.', pt:'A limpeza remove autor, título, programa e datas — útil antes de enviar o arquivo.', ar:'يزيل المسح المؤلف والعنوان والبرنامج والتواريخ — مفيد قبل إرسال الملف.', hi:'साफ़ करने से लेखक, शीर्षक, सॉफ़्टवेयर और तारीख़ें हट जाती हैं — फ़ाइल भेजने से पहले उपयोगी।', ja:'消去すると作成者・タイトル・ソフト名・日付が削除されます — 送信前に便利です。', ky:'Тазалоо авторду, аталышты, программаны жана даталарды өчүрөт — файлды жөнөтөр алдында пайдалуу.', 'zh-Hant':'清除會移除作者、標題、軟體與日期 — 傳送檔案前很有用。' },
  pdfo_i_saved: { bg:'Готово — метаданните са записани.', ru:'Готово — метаданные сохранены.', uk:'Готово — метадані збережено.', en:'Done — metadata saved.', de:'Fertig — Metadaten gespeichert.', fr:'Terminé — métadonnées enregistrées.', es:'Listo — metadatos guardados.', 'es-MX':'Listo — metadatos guardados.', it:'Fatto — metadati salvati.', pt:'Pronto — metadados salvos.', ar:'تم — حُفظت البيانات الوصفية.', hi:'पूर्ण — मेटाडेटा सहेजा गया।', ja:'完了 — メタデータを保存しました。', ky:'Даяр — метамаалымат сакталды.', 'zh-Hant':'完成 — 中繼資料已儲存。' },
  pdfo_i_cleared: { bg:'Готово — метаданните са изчистени.', ru:'Готово — метаданные очищены.', uk:'Готово — метадані очищено.', en:'Done — metadata cleared.', de:'Fertig — Metadaten gelöscht.', fr:'Terminé — métadonnées effacées.', es:'Listo — metadatos borrados.', 'es-MX':'Listo — metadatos borrados.', it:'Fatto — metadati cancellati.', pt:'Pronto — metadados limpos.', ar:'تم — مُسحت البيانات الوصفية.', hi:'पूर्ण — मेटाडेटा साफ़ किया गया।', ja:'完了 — メタデータを消去しました。', ky:'Даяр — метамаалымат тазаланды.', 'zh-Hant':'完成 — 中繼資料已清除。' }
});

export const title = t('pdfo_title');

// ---------- помощни ----------
const MM = 72 / 25.4; // 1 мм в PDF точки
const SIZES = { A4: [595.28, 841.89], Letter: [612, 792], A5: [419.53, 595.28] };
const NAMED = [['A4', 595, 842], ['Letter', 612, 792], ['A5', 420, 595], ['A3', 842, 1191], ['Legal', 612, 1008], ['B5', 499, 709]];

let _fontCache = {};
async function fontBytes(url) {
  if (_fontCache[url]) return _fontCache[url];
  const r = await fetch(url);
  if (!r.ok) throw new Error('font');
  _fontCache[url] = await r.arrayBuffer();
  return _fontCache[url];
}

// Чете файл; ако WebView-ът върне празно съдържание → ясна грешка.
async function readFile(f) {
  const buf = await f.arrayBuffer();
  if (!buf || !buf.byteLength) throw new Error(t('pdfo_empty_file'));
  return buf;
}

function parseRange(str, max) {
  const s = String(str || '').trim();
  if (!s) { const all = []; for (let i = 0; i < max; i++) all.push(i); return all; }
  const pages = [];
  s.split(',').forEach((part) => {
    part = part.trim();
    if (part.indexOf('-') > -1) {
      const [a, b] = part.split('-').map((x) => parseInt(x, 10));
      for (let i = a; i <= b; i++) if (i >= 1 && i <= max) pages.push(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= max) pages.push(n - 1);
    }
  });
  return pages;
}

function sizeName(w, h) {
  const a = Math.min(w, h), b = Math.max(w, h);
  for (const [n, sw, sh] of NAMED) if (Math.abs(a - sw) <= 3 && Math.abs(b - sh) <= 3) return n;
  return '';
}
function fmtPageSize(w, h) {
  const n = sizeName(w, h);
  return Math.round(w / MM) + ' × ' + Math.round(h / MM) + ' мм' + (n ? ' (' + n + ')' : '');
}
function fmtDate(d) {
  if (!d) return '—';
  try { return d.toLocaleString(getLang()); } catch (e) { return String(d); }
}

// Пренася текст в редове по ширина (с рязане на много дълги думи).
function wrapLines(text, font, size, maxW) {
  const lines = [];
  text.split(/\r?\n/).forEach((para) => {
    if (!para.trim()) { lines.push(''); return; }
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    words.forEach((w) => {
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxW) { cur = test; return; }
      if (cur) lines.push(cur);
      if (font.widthOfTextAtSize(w, size) > maxW) {
        let piece = '';
        for (const ch of w) {
          if (font.widthOfTextAtSize(piece + ch, size) > maxW && piece) { lines.push(piece); piece = ch; }
          else piece += ch;
        }
        cur = piece;
      } else cur = w;
    });
    lines.push(cur);
  });
  return lines;
}

// Заменя знаците, които шрифтът не съдържа, с „?“ (връща и броя им).
function sanitize(text, font) {
  const set = new Set(font.getCharacterSet());
  let out = '', repl = 0;
  for (const ch of text.replace(/\t/g, '    ')) {
    const cp = ch.codePointAt(0);
    if (ch === '\n' || ch === '\r' || set.has(cp)) out += ch;
    else { out += '?'; repl++; }
  }
  return { text: out, repl };
}

// Снимка → { bytes, kind:'jpg'|'png', w, h }; WebP/други → през canvas.
async function loadImage(file, compress) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error(file.name)); img.src = url; });
    const type = (file.type || '').toLowerCase();
    if (!compress && (type === 'image/jpeg' || type === 'image/png')) {
      return { bytes: await readFile(file), kind: type === 'image/png' ? 'png' : 'jpg', w: img.naturalWidth, h: img.naturalHeight };
    }
    // ограничаваме много големите снимки до 2500 px по дългата страна (памет/размер)
    const maxSide = 2500;
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext('2d');
    if (compress) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = compress ? c.toDataURL('image/jpeg', 0.85) : c.toDataURL('image/png');
    const bytes = await (await fetch(dataUrl)).arrayBuffer();
    return { bytes, kind: compress ? 'jpg' : 'png', w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}

export function render(root) {
  root.innerHTML = `
    <style>
      .pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;margin-top:12px}
      .pgc{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center}
      .pgc .th{height:132px;display:flex;align-items:center;justify-content:center;overflow:hidden}
      .pgc img{max-width:112px;max-height:112px;border-radius:4px;background:#fff;transition:transform .15s}
      .pgc .bl{width:80px;height:112px;background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#888;font-size:.75em}
      .pgc .no{font-size:.8em;color:var(--text-dim);margin-top:4px}
      .pgc .pb{display:flex;gap:4px;margin-top:6px}
      .pgc .pb button{flex:1;padding:6px 0;border-radius:6px;border:1px solid var(--line);background:var(--bg-3);color:var(--text);cursor:pointer;font-size:.95em}
      .pgc .pb button.d{color:var(--err)}
      .prow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .prow .btn{margin-top:0;flex:1;min-width:120px}
      .kv{margin-top:12px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
      .kv .l{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px dashed var(--line);font-size:.9em}
      .kv .l:last-child{border:none}
      .kv .l span:first-child{color:var(--text-dim)}
      .kv .l span:last-child{text-align:end;word-break:break-word}
    </style>
    <div class="tabs">
      <button class="tab active" data-tab="pages">${esc(t('pdfo_tab_pages'))}</button>
      <button class="tab" data-tab="img">${esc(t('pdfo_tab_img'))}</button>
      <button class="tab" data-tab="text">${esc(t('pdfo_tab_text'))}</button>
      <button class="tab" data-tab="stamp">${esc(t('pdfo_tab_stamp'))}</button>
      <button class="tab" data-tab="layout">${esc(t('pdfo_tab_layout'))}</button>
      <button class="tab" data-tab="info">${esc(t('pdfo_tab_info'))}</button>
    </div>

    <div class="tool-card" data-panel="pages">
      <label>${esc(t('pdfo_pick_pdf'))}</label>
      <input type="file" id="pgFile" accept="application/pdf" />
      <p class="hint">${esc(t('pdfo_pages_hint'))}</p>
      <div class="status" id="pgStatus"></div>
      <div class="pgrid" id="pgGrid"></div>
      <div class="prow" id="pgActions" style="display:none">
        <button class="btn sec" id="pgReverse">${esc(t('pdfo_reverse'))}</button>
        <button class="btn sec" id="pgBlank">${esc(t('pdfo_blank'))}</button>
        <button class="btn sec" id="pgReset">${esc(t('pdfo_reset'))}</button>
      </div>
      <button class="btn" id="pgSave" style="display:none">${esc(t('pdfo_pages_save'))}</button>
    </div>

    <div class="tool-card" data-panel="img" style="display:none">
      <label>${esc(t('pdfo_img_pick'))}</label>
      <input type="file" id="imFiles" accept="image/*" multiple />
      <div class="row">
        <div><label>${esc(t('pdfo_page_size'))}</label>
          <select id="imSize"><option value="A4">A4</option><option value="Letter">Letter</option><option value="A5">A5</option><option value="img">${esc(t('pdfo_size_img'))}</option></select></div>
        <div><label>${esc(t('pdfo_orient'))}</label>
          <select id="imOrient"><option value="auto">${esc(t('pdfo_orient_auto'))}</option><option value="p">${esc(t('pdfo_portrait'))}</option><option value="l">${esc(t('pdfo_landscape'))}</option></select></div>
      </div>
      <label>${esc(t('pdfo_margin'))}</label>
      <input type="number" id="imMargin" value="10" min="0" max="50" step="1" />
      <label class="check"><input type="checkbox" id="imCompress" checked /> ${esc(t('pdfo_img_compress'))}</label>
      <button class="btn" id="imBtn">${esc(t('pdfo_img_btn'))}</button>
      <div class="bar" id="imBarWrap" style="display:none"><div id="imBar"></div></div>
      <div class="status" id="imStatus"></div>
    </div>

    <div class="tool-card" data-panel="text" style="display:none">
      <label>${esc(t('pdfo_text_label'))}</label>
      <textarea id="txText" placeholder="${esc(t('pdfo_text_ph'))}" style="min-height:160px"></textarea>
      <div class="row">
        <div><label>${esc(t('pdfo_font_size'))}</label>
          <select id="txSize"><option value="10">10</option><option value="12" selected>12</option><option value="14">14</option><option value="18">18</option><option value="24">24</option></select></div>
        <div><label>${esc(t('pdfo_page_size'))}</label>
          <select id="txPage"><option value="A4">A4</option><option value="Letter">Letter</option><option value="A5">A5</option></select></div>
      </div>
      <label>${esc(t('pdfo_margin'))}</label>
      <input type="number" id="txMargin" value="20" min="5" max="50" step="1" />
      <p class="hint">${esc(t('pdfo_text_hint'))}</p>
      <button class="btn" id="txBtn">${esc(t('pdfo_text_btn'))}</button>
      <div class="status" id="txStatus"></div>
    </div>

    <div class="tool-card" data-panel="stamp" style="display:none">
      <label>${esc(t('pdfo_pick_pdf'))}</label>
      <input type="file" id="stFile" accept="application/pdf" />
      <label>${esc(t('pdfo_stamp_text'))}</label>
      <input type="text" id="stText" value="${esc(t('pdfo_stamp_default'))}" />
      <p class="hint">${esc(t('pdfo_stamp_hint'))}</p>
      <div class="row">
        <div><label>${esc(t('pdfo_pos'))}</label>
          <select id="stPos">
            <option value="tl">${esc(t('pdfo_pos_tl'))}</option><option value="tc">${esc(t('pdfo_pos_tc'))}</option><option value="tr" selected>${esc(t('pdfo_pos_tr'))}</option>
            <option value="c">${esc(t('pdfo_pos_c'))}</option>
            <option value="bl">${esc(t('pdfo_pos_bl'))}</option><option value="bc">${esc(t('pdfo_pos_bc'))}</option><option value="br">${esc(t('pdfo_pos_br'))}</option>
          </select></div>
        <div><label>${esc(t('pdfo_color'))}</label>
          <select id="stColor">
            <option value="red">${esc(t('pdfo_c_red'))}</option><option value="blue">${esc(t('pdfo_c_blue'))}</option><option value="gray">${esc(t('pdfo_c_gray'))}</option><option value="black">${esc(t('pdfo_c_black'))}</option><option value="green">${esc(t('pdfo_c_green'))}</option>
          </select></div>
      </div>
      <div class="row">
        <div><label>${esc(t('pdfo_font_size'))}</label><input type="number" id="stSize" value="14" min="6" max="72" /></div>
        <div><label>${esc(t('pdfo_opacity'))}</label><input type="number" id="stOpacity" value="85" min="10" max="100" step="5" /></div>
      </div>
      <label class="check"><input type="checkbox" id="stDate" /> ${esc(t('pdfo_add_date'))}</label>
      <label>${esc(t('pdfo_range'))}</label>
      <input type="text" id="stRange" placeholder="1-3,5" />
      <button class="btn" id="stBtn">${esc(t('pdfo_stamp_btn'))}</button>
      <div class="status" id="stStatus"></div>
    </div>

    <div class="tool-card" data-panel="layout" style="display:none">
      <label>${esc(t('pdfo_pick_pdf'))}</label>
      <input type="file" id="lyFile" accept="application/pdf" />
      <p class="hint">${esc(t('pdfo_layout_hint'))}</p>
      <div class="row">
        <div><label>${esc(t('pdfo_layout_mode'))}</label>
          <select id="lyMode"><option value="1">${esc(t('pdfo_l_1'))}</option><option value="2" selected>${esc(t('pdfo_l_2'))}</option><option value="4">${esc(t('pdfo_l_4'))}</option></select></div>
        <div><label>${esc(t('pdfo_sheet'))}</label>
          <select id="lySheet"><option value="A4">A4</option><option value="Letter">Letter</option><option value="A5">A5</option></select></div>
      </div>
      <label class="check"><input type="checkbox" id="lyBorder" checked /> ${esc(t('pdfo_border'))}</label>
      <button class="btn" id="lyBtn">${esc(t('pdfo_layout_btn'))}</button>
      <div class="status" id="lyStatus"></div>
    </div>

    <div class="tool-card" data-panel="info" style="display:none">
      <label>${esc(t('pdfo_pick_pdf'))}</label>
      <input type="file" id="inFile" accept="application/pdf" />
      <button class="btn sec" id="inBtn">${esc(t('pdfo_info_btn'))}</button>
      <div class="status" id="inStatus"></div>
      <div id="inOut" style="display:none">
        <div class="kv" id="inKv"></div>
        <label>${esc(t('pdfo_i_title'))}</label><input type="text" id="inTitle" />
        <label>${esc(t('pdfo_i_author'))}</label><input type="text" id="inAuthor" />
        <label>${esc(t('pdfo_i_subject'))}</label><input type="text" id="inSubject" />
        <label>${esc(t('pdfo_i_keywords'))}</label><input type="text" id="inKeywords" />
        <button class="btn" id="inSave">${esc(t('pdfo_i_save'))}</button>
        <p class="hint">${esc(t('pdfo_i_clear_hint'))}</p>
        <button class="btn sec" id="inClear">${esc(t('pdfo_i_clear'))}</button>
      </div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  root.querySelectorAll('.tab').forEach((tb) => {
    tb.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      tb.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach((p) => { p.style.display = p.dataset.panel === tb.dataset.tab ? 'block' : 'none'; });
    });
  });

  function save(bytes, name) { downloadBlob(bytes, name, 'application/pdf'); }
  function baseName(f, suffix) { return ((f && f.name) || 'document').replace(/\.pdf$/i, '') + suffix + '.pdf'; }

  // ================= Страници (миниатюри) =================
  let pg = { bytes: null, file: null, items: [], firstW: 595.28, firstH: 841.89 };

  function drawPages() {
    const grid = $('#pgGrid');
    const items = pg.items;
    $('#pgActions').style.display = pg.bytes ? 'flex' : 'none';
    $('#pgSave').style.display = pg.bytes ? 'block' : 'none';
    grid.innerHTML = items.map((it, i) => `
      <div class="pgc" data-i="${i}">
        <div class="th">${it.blank ? `<div class="bl">${esc(t('pdfo_blank_label'))}</div>` : `<img src="${it.thumb}" style="transform:rotate(${it.rot}deg)" alt="" />`}</div>
        <div class="no">${i + 1}${it.blank ? '' : ' · ' + (it.idx + 1)}${it.rot ? ' · ' + it.rot + '°' : ''}</div>
        <div class="pb">
          <button data-a="l" title="${esc(t('pdfo_mv'))}">◀</button>
          <button data-a="r" title="${esc(t('pdfo_mv'))}">▶</button>
          <button data-a="rot" title="${esc(t('pdfo_rot'))}">↻</button>
          <button data-a="del" class="d" title="${esc(t('pdfo_del'))}">✕</button>
        </div>
      </div>`).join('');
    grid.querySelectorAll('.pgc button').forEach((b) => {
      b.addEventListener('click', () => {
        const i = parseInt(b.closest('.pgc').dataset.i, 10);
        const a = b.dataset.a;
        if (a === 'l' && i > 0) { const x = items[i]; items[i] = items[i - 1]; items[i - 1] = x; }
        else if (a === 'r' && i < items.length - 1) { const x = items[i]; items[i] = items[i + 1]; items[i + 1] = x; }
        else if (a === 'rot') items[i].rot = (items[i].rot + 90) % 360;
        else if (a === 'del') items.splice(i, 1);
        drawPages();
      });
    });
  }

  async function loadPages(f) {
    pg = { bytes: null, file: f, items: [], firstW: 595.28, firstH: 841.89 };
    $('#pgGrid').innerHTML = '';
    try {
      const buf = await readFile(f);
      pg.bytes = buf.slice(0); // копие — pdfjs може да прехвърли буфера към worker-а
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const n = pdf.numPages;
      for (let p = 1; p <= n; p++) {
        setStatus($('#pgStatus'), 'work', tf('pdfo_pages_loading', p, n));
        const page = await pdf.getPage(p);
        const vp1 = page.getViewport({ scale: 1 });
        if (p === 1) { pg.firstW = vp1.width; pg.firstH = vp1.height; }
        const vp = page.getViewport({ scale: Math.min(1, 220 / Math.max(vp1.width, vp1.height)) });
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        pg.items.push({ idx: p - 1, rot: 0, thumb: c.toDataURL('image/jpeg', 0.7), blank: false });
        page.cleanup();
      }
      setStatus($('#pgStatus'), 'ok', tf('pdfo_pages_loaded', n));
      drawPages();
    } catch (e) { setStatus($('#pgStatus'), 'err', tf('pdfo_err', e.message)); }
  }

  $('#pgFile').addEventListener('change', () => { const f = $('#pgFile').files[0]; if (f) loadPages(f); });
  $('#pgReverse').addEventListener('click', () => { pg.items.reverse(); drawPages(); });
  $('#pgBlank').addEventListener('click', () => { pg.items.push({ idx: -1, rot: 0, thumb: '', blank: true }); drawPages(); });
  $('#pgReset').addEventListener('click', () => { if (pg.file) loadPages(pg.file); });
  $('#pgSave').addEventListener('click', async () => {
    if (!pg.bytes) { setStatus($('#pgStatus'), 'err', t('pdfo_need_file')); return; }
    if (!pg.items.length) { setStatus($('#pgStatus'), 'err', t('pdfo_pages_empty')); return; }
    try {
      setStatus($('#pgStatus'), 'work', t('pdfo_working'));
      const src = await PDFDocument.load(pg.bytes);
      const out = await PDFDocument.create();
      for (const it of pg.items) {
        if (it.blank) { out.addPage([pg.firstW, pg.firstH]); continue; }
        const [p] = await out.copyPages(src, [it.idx]);
        if (it.rot) p.setRotation(degrees(((p.getRotation().angle || 0) + it.rot) % 360));
        out.addPage(p);
      }
      save(await out.save(), baseName(pg.file, '-pages'));
      setStatus($('#pgStatus'), 'ok', tf('pdfo_pages_done', pg.items.length));
    } catch (e) { setStatus($('#pgStatus'), 'err', tf('pdfo_err', e.message)); }
  });

  // ================= Снимки → PDF =================
  $('#imBtn').addEventListener('click', async () => {
    const files = Array.from($('#imFiles').files || []);
    if (!files.length) { setStatus($('#imStatus'), 'err', t('pdfo_img_need')); return; }
    const btn = $('#imBtn'); btn.disabled = true;
    $('#imBarWrap').style.display = 'block'; const bar = $('#imBar'); bar.style.width = '0';
    setStatus($('#imStatus'), 'work', t('pdfo_working'));
    try {
      const sizeKey = $('#imSize').value, orient = $('#imOrient').value;
      const margin = Math.min(Math.max(parseFloat($('#imMargin').value) || 0, 0), 50) * MM;
      const compress = $('#imCompress').checked;
      const out = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const im = await loadImage(files[i], compress);
        const emb = im.kind === 'png' ? await out.embedPng(im.bytes) : await out.embedJpg(im.bytes);
        let pw, ph;
        if (sizeKey === 'img') { pw = im.w * 0.75 + 2 * margin; ph = im.h * 0.75 + 2 * margin; }
        else {
          const [a, b] = SIZES[sizeKey] || SIZES.A4;
          const land = orient === 'l' || (orient === 'auto' && im.w > im.h);
          pw = land ? b : a; ph = land ? a : b;
        }
        const page = out.addPage([pw, ph]);
        const aw = pw - 2 * margin, ah = ph - 2 * margin;
        const k = Math.min(aw / im.w, ah / im.h);
        const w = im.w * k, h = im.h * k;
        page.drawImage(emb, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        bar.style.width = Math.round((i + 1) / files.length * 100) + '%';
      }
      save(await out.save(), 'photos.pdf');
      setStatus($('#imStatus'), 'ok', tf('pdfo_img_done', files.length));
    } catch (e) { setStatus($('#imStatus'), 'err', tf('pdfo_err', e.message)); }
    finally { btn.disabled = false; }
  });

  // ================= Текст → PDF =================
  $('#txBtn').addEventListener('click', async () => {
    const raw = $('#txText').value;
    if (!raw.trim()) { setStatus($('#txStatus'), 'err', t('pdfo_text_need')); return; }
    try {
      setStatus($('#txStatus'), 'work', t('pdfo_working'));
      const size = parseInt($('#txSize').value, 10) || 12;
      const [pw, ph] = SIZES[$('#txPage').value] || SIZES.A4;
      const margin = Math.min(Math.max(parseFloat($('#txMargin').value) || 20, 5), 50) * MM;
      const out = await PDFDocument.create();
      out.registerFontkit(fontkit);
      const font = await out.embedFont(await fontBytes(fontRegularUrl), { subset: true });
      const { text, repl } = sanitize(raw, font);
      const lines = wrapLines(text, font, size, pw - 2 * margin);
      const lh = size * 1.4;
      let page = null, y = 0, pages = 0;
      for (const line of lines) {
        if (!page || y < margin + lh) { page = out.addPage([pw, ph]); y = ph - margin - size; pages++; }
        if (line) page.drawText(line, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
        y -= lh;
      }
      save(await out.save(), 'text.pdf');
      setStatus($('#txStatus'), 'ok', tf('pdfo_text_done', pages) + (repl ? tf('pdfo_text_repl', repl) : ''));
    } catch (e) { setStatus($('#txStatus'), 'err', tf('pdfo_err', e.message)); }
  });

  // ================= Печат =================
  const COLORS = { red: rgb(0.8, 0.1, 0.1), blue: rgb(0.1, 0.3, 0.8), gray: rgb(0.45, 0.45, 0.45), black: rgb(0, 0, 0), green: rgb(0.1, 0.55, 0.2) };
  $('#stBtn').addEventListener('click', async () => {
    const f = $('#stFile').files[0];
    if (!f) { setStatus($('#stStatus'), 'err', t('pdfo_need_file')); return; }
    try {
      setStatus($('#stStatus'), 'work', t('pdfo_working'));
      let text = ($('#stText').value || t('pdfo_stamp_default')).trim();
      if ($('#stDate').checked) { let d; try { d = new Date().toLocaleDateString(getLang()); } catch (e) { d = new Date().toISOString().slice(0, 10); } text = text ? text + ' · ' + d : d; }
      const pos = $('#stPos').value, color = COLORS[$('#stColor').value] || COLORS.red;
      const size = Math.min(Math.max(parseInt($('#stSize').value, 10) || 14, 6), 72);
      const opacity = Math.min(Math.max(parseInt($('#stOpacity').value, 10) || 85, 10), 100) / 100;
      const doc = await PDFDocument.load(await readFile(f));
      const idx = parseRange($('#stRange').value, doc.getPageCount());
      if (!idx.length) { setStatus($('#stStatus'), 'err', t('pdfo_range_invalid')); return; }
      doc.registerFontkit(fontkit);
      const font = await doc.embedFont(await fontBytes(fontBoldUrl), { subset: true });
      const { text: safe } = sanitize(text, font);
      const pages = doc.getPages(), pad = 24;
      idx.forEach((i) => {
        const page = pages[i]; const w = page.getWidth(), h = page.getHeight();
        const tw = font.widthOfTextAtSize(safe, size);
        let x = pad, y = pad;
        if (pos[1] === 'c' || pos === 'c') x = (w - tw) / 2; else if (pos[1] === 'r') x = w - tw - pad;
        if (pos[0] === 't') y = h - pad - size; else if (pos === 'c') y = (h - size) / 2;
        page.drawText(safe, { x, y, size, font, color, opacity });
      });
      save(await doc.save(), baseName(f, '-stamped'));
      setStatus($('#stStatus'), 'ok', tf('pdfo_stamp_done', idx.length));
    } catch (e) { setStatus($('#stStatus'), 'err', tf('pdfo_err', e.message)); }
  });

  // ================= На лист (N страници на лист / уеднаквяване) =================
  $('#lyBtn').addEventListener('click', async () => {
    const f = $('#lyFile').files[0];
    if (!f) { setStatus($('#lyStatus'), 'err', t('pdfo_need_file')); return; }
    try {
      setStatus($('#lyStatus'), 'work', t('pdfo_working'));
      const per = parseInt($('#lyMode').value, 10) || 2;
      const border = $('#lyBorder').checked;
      const [sa, sb] = SIZES[$('#lySheet').value] || SIZES.A4;
      const srcBytes = await readFile(f);
      const src = await PDFDocument.load(srcBytes);
      const out = await PDFDocument.create();
      const embedded = await out.embedPdf(src, src.getPageIndices());
      const n = embedded.length;
      // 2 на лист → пейзажен лист с 2 колони; 4 → портрет 2×2; 1 → портрет/пейзаж по страницата
      const cols = per === 4 ? 2 : per;
      const rows = per === 4 ? 2 : 1;
      const gap = 10 * MM * 0.6, margin = 8 * MM;
      let sheets = 0;
      for (let s = 0; s < n; s += per) {
        let pw, ph;
        if (per === 1) { const land = embedded[s].width > embedded[s].height; pw = land ? sb : sa; ph = land ? sa : sb; }
        else if (per === 2) { pw = sb; ph = sa; }
        else { pw = sa; ph = sb; }
        const page = out.addPage([pw, ph]); sheets++;
        const cw = (pw - 2 * margin - gap * (cols - 1)) / cols;
        const ch = (ph - 2 * margin - gap * (rows - 1)) / rows;
        for (let k = 0; k < per && s + k < n; k++) {
          const ep = embedded[s + k];
          const col = k % cols, row = Math.floor(k / cols);
          const k2 = Math.min(cw / ep.width, ch / ep.height);
          const w = ep.width * k2, h = ep.height * k2;
          const cx = margin + col * (cw + gap), cy = ph - margin - (row + 1) * ch - row * gap;
          const x = cx + (cw - w) / 2, y = cy + (ch - h) / 2;
          page.drawPage(ep, { x, y, xScale: k2, yScale: k2 });
          if (border) page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
        }
      }
      save(await out.save(), baseName(f, '-' + per + 'up'));
      setStatus($('#lyStatus'), 'ok', tf('pdfo_layout_done', n, sheets));
    } catch (e) { setStatus($('#lyStatus'), 'err', tf('pdfo_err', e.message)); }
  });

  // ================= Данни / метаданни =================
  let infoBytes = null, infoFile = null;
  $('#inBtn').addEventListener('click', async () => {
    const f = $('#inFile').files[0];
    if (!f) { setStatus($('#inStatus'), 'err', t('pdfo_need_file')); return; }
    try {
      setStatus($('#inStatus'), 'work', t('pdfo_working'));
      infoBytes = await readFile(f); infoFile = f;
      const doc = await PDFDocument.load(infoBytes, { ignoreEncryption: true, updateMetadata: false });
      const pages = doc.getPages();
      const p0 = pages[0];
      let mixed = false;
      if (p0) { const w0 = Math.round(p0.getWidth()), h0 = Math.round(p0.getHeight()); mixed = pages.some((p) => Math.round(p.getWidth()) !== w0 || Math.round(p.getHeight()) !== h0); }
      const rows = [
        [t('pdfo_i_file'), f.name], [t('pdfo_i_size'), fmtSize(f.size)], [t('pdfo_i_pages'), String(pages.length)],
        [t('pdfo_i_pagesize'), p0 ? fmtPageSize(p0.getWidth(), p0.getHeight()) + (mixed ? ' ' + t('pdfo_i_mixed') : '') : '—'],
        [t('pdfo_i_enc'), doc.isEncrypted ? t('pdfo_yes') : t('pdfo_no')],
        [t('pdfo_i_creator'), doc.getCreator() || '—'], [t('pdfo_i_producer'), doc.getProducer() || '—'],
        [t('pdfo_i_created'), fmtDate(doc.getCreationDate())], [t('pdfo_i_modified'), fmtDate(doc.getModificationDate())]
      ];
      $('#inKv').innerHTML = rows.map(([k, v]) => `<div class="l"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
      $('#inTitle').value = doc.getTitle() || ''; $('#inAuthor').value = doc.getAuthor() || '';
      $('#inSubject').value = doc.getSubject() || ''; $('#inKeywords').value = doc.getKeywords() || '';
      $('#inOut').style.display = 'block';
      $('#inStatus').className = 'status';
    } catch (e) { setStatus($('#inStatus'), 'err', tf('pdfo_err', e.message)); }
  });
  async function writeMeta(clear) {
    if (!infoBytes) { setStatus($('#inStatus'), 'err', t('pdfo_need_file')); return; }
    try {
      const doc = await PDFDocument.load(infoBytes, { updateMetadata: false });
      if (clear) {
        doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
        const epoch = new Date(0); doc.setCreationDate(epoch); doc.setModificationDate(epoch);
        $('#inTitle').value = ''; $('#inAuthor').value = ''; $('#inSubject').value = ''; $('#inKeywords').value = '';
      } else {
        doc.setTitle($('#inTitle').value.trim()); doc.setAuthor($('#inAuthor').value.trim()); doc.setSubject($('#inSubject').value.trim());
        doc.setKeywords($('#inKeywords').value.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
        doc.setModificationDate(new Date());
      }
      save(await doc.save(), baseName(infoFile, clear ? '-clean' : '-meta'));
      setStatus($('#inStatus'), 'ok', t(clear ? 'pdfo_i_cleared' : 'pdfo_i_saved'));
    } catch (e) { setStatus($('#inStatus'), 'err', tf('pdfo_err', e.message)); }
  }
  $('#inSave').addEventListener('click', () => writeMeta(false));
  $('#inClear').addEventListener('click', () => writeMeta(true));
}
