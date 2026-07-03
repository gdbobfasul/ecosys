// Version: 1.0001
// PDF инструменти — сливане, разделяне, воден знак, визуален подпис.
// Изцяло офлайн: pdf-lib (редакция) + pdfjs-dist (рендиране на страница за подпис).
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { setStatus, downloadBlob } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';
// pdfjs worker — бандълва се локално чрез Vite ?url
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
// Кирилски Unicode шрифт за водния знак — бандълва се ЛОКАЛНО (офлайн, без CDN).
// pdf-lib StandardFonts (WinAnsi) не съдържат кирилица; затова вграждаме TTF чрез fontkit.
import cyrFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';

register({
  pdf_title: { bg:'PDF инструменти', ru:'PDF-инструменты', uk:'PDF-інструменти', en:'PDF tools', de:'PDF-Werkzeuge', fr:'Outils PDF', es:'Herramientas PDF', 'es-MX':'Herramientas PDF', it:'Strumenti PDF', pt:'Ferramentas PDF', ar:'أدوات PDF', hi:'PDF टूल', ja:'PDFツール', ky:'PDF куралдары', 'zh-Hant':'PDF 工具' },
  pdf_tab_merge: { bg:'Сливане', ru:'Объединение', uk:'Об’єднання', en:'Merge', de:'Zusammenführen', fr:'Fusionner', es:'Unir', 'es-MX':'Unir', it:'Unisci', pt:'Juntar', ar:'دمج', hi:'मर्ज', ja:'結合', ky:'Бириктирүү', 'zh-Hant':'合併' },
  pdf_tab_split: { bg:'Разделяне', ru:'Разделение', uk:'Поділ', en:'Split', de:'Teilen', fr:'Diviser', es:'Dividir', 'es-MX':'Dividir', it:'Dividi', pt:'Dividir', ar:'تقسيم', hi:'विभाजन', ja:'分割', ky:'Бөлүү', 'zh-Hant':'分割' },
  pdf_tab_wm: { bg:'Воден знак', ru:'Водяной знак', uk:'Водяний знак', en:'Watermark', de:'Wasserzeichen', fr:'Filigrane', es:'Marca de agua', 'es-MX':'Marca de agua', it:'Filigrana', pt:'Marca d’água', ar:'علامة مائية', hi:'वॉटरमार्क', ja:'透かし', ky:'Суу белгиси', 'zh-Hant':'浮水印' },
  pdf_tab_sign: { bg:'Подпис', ru:'Подпись', uk:'Підпис', en:'Signature', de:'Signatur', fr:'Signature', es:'Firma', 'es-MX':'Firma', it:'Firma', pt:'Assinatura', ar:'توقيع', hi:'हस्ताक्षर', ja:'署名', ky:'Кол тамга', 'zh-Hant':'簽名' },

  pdf_merge_pick: { bg:'Избери няколко PDF файла (в реда за сливане)', ru:'Выберите несколько PDF-файлов (в порядке объединения)', uk:'Виберіть кілька PDF-файлів (у порядку об’єднання)', en:'Choose several PDF files (in merge order)', de:'Mehrere PDF-Dateien wählen (in Zusammenführungs­reihenfolge)', fr:'Choisis plusieurs fichiers PDF (dans l’ordre de fusion)', es:'Elige varios archivos PDF (en orden de unión)', 'es-MX':'Elige varios archivos PDF (en orden de unión)', it:'Scegli più file PDF (nell’ordine di unione)', pt:'Escolha vários arquivos PDF (na ordem de junção)', ar:'اختر عدة ملفات PDF (بترتيب الدمج)', hi:'कई PDF फ़ाइलें चुनें (मर्ज क्रम में)', ja:'複数のPDFファイルを選択（結合順）', ky:'Бир нече PDF файл тандаңыз (бириктирүү тартибинде)', 'zh-Hant':'選擇多個 PDF 檔案（依合併順序）' },
  pdf_merge_btn: { bg:'Слей PDF', ru:'Объединить PDF', uk:'Об’єднати PDF', en:'Merge PDF', de:'PDF zusammenführen', fr:'Fusionner les PDF', es:'Unir PDF', 'es-MX':'Unir PDF', it:'Unisci PDF', pt:'Juntar PDF', ar:'دمج PDF', hi:'PDF मर्ज करें', ja:'PDFを結合', ky:'PDF бириктирүү', 'zh-Hant':'合併 PDF' },
  pdf_merge_min: { bg:'Избери поне 2 PDF файла.', ru:'Выберите минимум 2 PDF-файла.', uk:'Виберіть щонайменше 2 PDF-файли.', en:'Choose at least 2 PDF files.', de:'Wähle mindestens 2 PDF-Dateien.', fr:'Choisis au moins 2 fichiers PDF.', es:'Elige al menos 2 archivos PDF.', 'es-MX':'Elige al menos 2 archivos PDF.', it:'Scegli almeno 2 file PDF.', pt:'Escolha pelo menos 2 arquivos PDF.', ar:'اختر ملفين PDF على الأقل.', hi:'कम से कम 2 PDF फ़ाइलें चुनें।', ja:'PDFファイルを2つ以上選択してください。', ky:'Жок дегенде 2 PDF файл тандаңыз.', 'zh-Hant':'請至少選擇 2 個 PDF 檔案。' },
  pdf_merge_done: { bg:'Готово — {0} файла слети.', ru:'Готово — объединено {0} файлов.', uk:'Готово — об’єднано {0} файлів.', en:'Done — {0} files merged.', de:'Fertig — {0} Dateien zusammengeführt.', fr:'Terminé — {0} fichiers fusionnés.', es:'Listo — {0} archivos unidos.', 'es-MX':'Listo — {0} archivos unidos.', it:'Fatto — {0} file uniti.', pt:'Pronto — {0} arquivos juntados.', ar:'تم — دمج {0} ملفات.', hi:'पूर्ण — {0} फ़ाइलें मर्ज हुईं।', ja:'完了 — {0}ファイルを結合しました。', ky:'Даяр — {0} файл бириктирилди.', 'zh-Hant':'完成 — 已合併 {0} 個檔案。' },

  pdf_pick_one: { bg:'Избери PDF файл', ru:'Выберите PDF-файл', uk:'Виберіть PDF-файл', en:'Choose a PDF file', de:'PDF-Datei wählen', fr:'Choisir un fichier PDF', es:'Elegir archivo PDF', 'es-MX':'Elegir archivo PDF', it:'Scegli un file PDF', pt:'Escolher arquivo PDF', ar:'اختر ملف PDF', hi:'PDF फ़ाइल चुनें', ja:'PDFファイルを選択', ky:'PDF файл тандаңыз', 'zh-Hant':'選擇 PDF 檔案' },
  pdf_split_pages: { bg:'Страници за извличане (напр. 1-3,5,8)', ru:'Страницы для извлечения (напр. 1-3,5,8)', uk:'Сторінки для витягу (напр. 1-3,5,8)', en:'Pages to extract (e.g. 1-3,5,8)', de:'Zu extrahierende Seiten (z. B. 1-3,5,8)', fr:'Pages à extraire (ex. 1-3,5,8)', es:'Páginas a extraer (p. ej. 1-3,5,8)', 'es-MX':'Páginas a extraer (p. ej. 1-3,5,8)', it:'Pagine da estrarre (es. 1-3,5,8)', pt:'Páginas a extrair (ex. 1-3,5,8)', ar:'الصفحات المراد استخراجها (مثل 1-3,5,8)', hi:'निकालने हेतु पेज (जैसे 1-3,5,8)', ja:'抽出するページ（例: 1-3,5,8）', ky:'Чыгаруу үчүн барактар (мис. 1-3,5,8)', 'zh-Hant':'要擷取的頁面（例如 1-3,5,8）' },
  pdf_split_btn: { bg:'Извлечи страници', ru:'Извлечь страницы', uk:'Витягти сторінки', en:'Extract pages', de:'Seiten extrahieren', fr:'Extraire les pages', es:'Extraer páginas', 'es-MX':'Extraer páginas', it:'Estrai pagine', pt:'Extrair páginas', ar:'استخراج الصفحات', hi:'पेज निकालें', ja:'ページを抽出', ky:'Барактарды чыгаруу', 'zh-Hant':'擷取頁面' },
  pdf_split_invalid: { bg:'Невалиден диапазон.', ru:'Неверный диапазон.', uk:'Невірний діапазон.', en:'Invalid range.', de:'Ungültiger Bereich.', fr:'Plage invalide.', es:'Rango no válido.', 'es-MX':'Rango no válido.', it:'Intervallo non valido.', pt:'Intervalo inválido.', ar:'نطاق غير صالح.', hi:'अमान्य रेंज।', ja:'範囲が無効です。', ky:'Жараксыз диапазон.', 'zh-Hant':'範圍無效。' },
  pdf_split_done: { bg:'Готово — {0} страници извлечени.', ru:'Готово — извлечено {0} страниц.', uk:'Готово — витягнуто {0} сторінок.', en:'Done — {0} pages extracted.', de:'Fertig — {0} Seiten extrahiert.', fr:'Terminé — {0} pages extraites.', es:'Listo — {0} páginas extraídas.', 'es-MX':'Listo — {0} páginas extraídas.', it:'Fatto — {0} pagine estratte.', pt:'Pronto — {0} páginas extraídas.', ar:'تم — استخراج {0} صفحات.', hi:'पूर्ण — {0} पेज निकाले गए।', ja:'完了 — {0}ページを抽出しました。', ky:'Даяр — {0} барак чыгарылды.', 'zh-Hant':'完成 — 已擷取 {0} 頁。' },

  pdf_wm_text: { bg:'Текст на водния знак (латиница)', ru:'Текст водяного знака (латиница)', uk:'Текст водяного знака (латиниця)', en:'Watermark text (Latin)', de:'Wasserzeichen-Text (lateinisch)', fr:'Texte du filigrane (latin)', es:'Texto de la marca de agua (latino)', 'es-MX':'Texto de la marca de agua (latino)', it:'Testo della filigrana (latino)', pt:'Texto da marca d’água (latino)', ar:'نص العلامة المائية (لاتيني)', hi:'वॉटरमार्क टेक्स्ट (लैटिन)', ja:'透かし文字（ラテン）', ky:'Суу белгисинин тексти (латын)', 'zh-Hant':'浮水印文字（拉丁）' },
  pdf_wm_default: { bg:'ПОВЕРИТЕЛНО', ru:'КОНФИДЕНЦИАЛЬНО', uk:'КОНФІДЕНЦІЙНО', en:'CONFIDENTIAL', de:'VERTRAULICH', fr:'CONFIDENTIEL', es:'CONFIDENCIAL', 'es-MX':'CONFIDENCIAL', it:'RISERVATO', pt:'CONFIDENCIAL', ar:'سري', hi:'गोपनीय', ja:'機密', ky:'КУПУЯ', 'zh-Hant':'機密' },
  pdf_wm_hint: { bg:'Вграденият стандартен шрифт поддържа латиница. За кирилица използвай латински текст.', ru:'Встроенный стандартный шрифт поддерживает латиницу. Для кириллицы используйте латинский текст.', uk:'Вбудований стандартний шрифт підтримує латиницю. Для кирилиці використовуйте латинський текст.', en:'The built-in standard font supports Latin. For Cyrillic, use Latin text.', de:'Die eingebettete Standardschrift unterstützt Latein. Für Kyrillisch verwende lateinischen Text.', fr:'La police standard intégrée prend en charge le latin. Pour le cyrillique, utilise du texte latin.', es:'La fuente estándar integrada admite latín. Para cirílico, usa texto latino.', 'es-MX':'La fuente estándar integrada admite latín. Para cirílico, usa texto latino.', it:'Il carattere standard incorporato supporta il latino. Per il cirillico usa testo latino.', pt:'A fonte padrão integrada suporta latim. Para cirílico, use texto latino.', ar:'يدعم الخط القياسي المدمج الأحرف اللاتينية. للأحرف السيريلية استخدم نصًا لاتينيًا.', hi:'अंतर्निहित मानक फ़ॉन्ट लैटिन का समर्थन करता है। सिरिलिक हेतु लैटिन टेक्स्ट उपयोग करें।', ja:'内蔵の標準フォントはラテン文字に対応しています。キリル文字にはラテン文字をお使いください。', ky:'Камтылган стандарттык шрифт латынды колдойт. Кириллица үчүн латын текстин колдонуңуз.', 'zh-Hant':'內建標準字型支援拉丁字母。如需西里爾字母，請使用拉丁文字。' },
  pdf_wm_btn: { bg:'Добави воден знак', ru:'Добавить водяной знак', uk:'Додати водяний знак', en:'Add watermark', de:'Wasserzeichen hinzufügen', fr:'Ajouter un filigrane', es:'Añadir marca de agua', 'es-MX':'Añadir marca de agua', it:'Aggiungi filigrana', pt:'Adicionar marca d’água', ar:'إضافة علامة مائية', hi:'वॉटरमार्क जोड़ें', ja:'透かしを追加', ky:'Суу белгисин кошуу', 'zh-Hant':'加入浮水印' },
  pdf_wm_done: { bg:'Готово — воден знак на {0} страници.', ru:'Готово — водяной знак на {0} страницах.', uk:'Готово — водяний знак на {0} сторінках.', en:'Done — watermark on {0} pages.', de:'Fertig — Wasserzeichen auf {0} Seiten.', fr:'Terminé — filigrane sur {0} pages.', es:'Listo — marca de agua en {0} páginas.', 'es-MX':'Listo — marca de agua en {0} páginas.', it:'Fatto — filigrana su {0} pagine.', pt:'Pronto — marca d’água em {0} páginas.', ar:'تم — علامة مائية على {0} صفحات.', hi:'पूर्ण — {0} पेज पर वॉटरमार्क।', ja:'完了 — {0}ページに透かしを追加しました。', ky:'Даяр — {0} баракта суу белгиси.', 'zh-Hant':'完成 — {0} 頁已加浮水印。' },

  pdf_sign_notice: { bg:'<b>Внимание:</b> това е визуален подпис (изображение върху PDF), НЕ е електронен/криптографски подпис и не е правно валиден е-подпис.', ru:'<b>Внимание:</b> это визуальная подпись (изображение поверх PDF), НЕ электронная/криптографическая подпись и не юридически действительная э-подпись.', uk:'<b>Увага:</b> це візуальний підпис (зображення поверх PDF), НЕ електронний/криптографічний підпис і не юридично дійсний е-підпис.', en:'<b>Note:</b> this is a visual signature (an image on the PDF), NOT an electronic/cryptographic signature and not a legally valid e-signature.', de:'<b>Hinweis:</b> Dies ist eine visuelle Signatur (Bild auf dem PDF), KEINE elektronische/kryptografische Signatur und keine rechtsgültige E-Signatur.', fr:'<b>Attention :</b> il s’agit d’une signature visuelle (image sur le PDF), PAS d’une signature électronique/cryptographique ni d’une e-signature juridiquement valable.', es:'<b>Atención:</b> esta es una firma visual (imagen sobre el PDF), NO una firma electrónica/criptográfica ni una firma electrónica legalmente válida.', 'es-MX':'<b>Atención:</b> esta es una firma visual (imagen sobre el PDF), NO una firma electrónica/criptográfica ni una firma electrónica legalmente válida.', it:'<b>Attenzione:</b> questa è una firma visiva (immagine sul PDF), NON una firma elettronica/crittografica né una firma elettronica legalmente valida.', pt:'<b>Atenção:</b> esta é uma assinatura visual (imagem sobre o PDF), NÃO uma assinatura eletrônica/criptográfica nem uma assinatura eletrônica juridicamente válida.', ar:'<b>تنبيه:</b> هذا توقيع مرئي (صورة على ملف PDF)، وليس توقيعًا إلكترونيًا/تشفيريًا ولا توقيعًا إلكترونيًا صالحًا قانونيًا.', hi:'<b>ध्यान दें:</b> यह एक दृश्य हस्ताक्षर (PDF पर छवि) है, यह इलेक्ट्रॉनिक/क्रिप्टोग्राफ़िक हस्ताक्षर नहीं है और कानूनी रूप से मान्य ई-हस्ताक्षर नहीं है।', ja:'<b>注意:</b> これは視覚的な署名（PDF上の画像）であり、電子/暗号署名ではなく、法的に有効な電子署名ではありません。', ky:'<b>Эскертүү:</b> бул көрүнүштүү кол тамга (PDF үстүндөгү сүрөт), электрондук/криптографиялык кол тамга ЭМЕС жана юридикалык жактан жарактуу э-кол тамга эмес.', 'zh-Hant':'<b>注意：</b>這是視覺簽名（PDF 上的圖片），並非電子／加密簽名，也不是具法律效力的電子簽章。' },
  pdf_sign_step1: { bg:'Стъпка 1 — извлечи подпис от документ', ru:'Шаг 1 — извлеките подпись из документа', uk:'Крок 1 — витягніть підпис із документа', en:'Step 1 — extract a signature from a document', de:'Schritt 1 — Signatur aus einem Dokument extrahieren', fr:'Étape 1 — extraire une signature d’un document', es:'Paso 1 — extrae una firma de un documento', 'es-MX':'Paso 1 — extrae una firma de un documento', it:'Passo 1 — estrai una firma da un documento', pt:'Passo 1 — extraia uma assinatura de um documento', ar:'الخطوة 1 — استخرج توقيعًا من مستند', hi:'चरण 1 — दस्तावेज़ से हस्ताक्षर निकालें', ja:'ステップ1 — 文書から署名を抽出', ky:'1-кадам — документтен кол тамга чыгарыңыз', 'zh-Hant':'步驟 1 — 從文件擷取簽名' },
  pdf_sign_src: { bg:'PDF с подписа', ru:'PDF с подписью', uk:'PDF із підписом', en:'PDF with the signature', de:'PDF mit der Signatur', fr:'PDF avec la signature', es:'PDF con la firma', 'es-MX':'PDF con la firma', it:'PDF con la firma', pt:'PDF com a assinatura', ar:'PDF يحتوي على التوقيع', hi:'हस्ताक्षर वाली PDF', ja:'署名のあるPDF', ky:'Кол тамгасы бар PDF', 'zh-Hant':'含簽名的 PDF' },
  pdf_sign_page: { bg:'Страница с подписа', ru:'Страница с подписью', uk:'Сторінка з підписом', en:'Page with the signature', de:'Seite mit der Signatur', fr:'Page avec la signature', es:'Página con la firma', 'es-MX':'Página con la firma', it:'Pagina con la firma', pt:'Página com a assinatura', ar:'الصفحة التي تحتوي على التوقيع', hi:'हस्ताक्षर वाला पेज', ja:'署名のあるページ', ky:'Кол тамгасы бар барак', 'zh-Hant':'含簽名的頁面' },
  pdf_sign_show: { bg:'Покажи страницата', ru:'Показать страницу', uk:'Показати сторінку', en:'Show the page', de:'Seite anzeigen', fr:'Afficher la page', es:'Mostrar la página', 'es-MX':'Mostrar la página', it:'Mostra la pagina', pt:'Mostrar a página', ar:'إظهار الصفحة', hi:'पेज दिखाएं', ja:'ページを表示', ky:'Баракты көрсөтүү', 'zh-Hant':'顯示頁面' },
  pdf_sign_draw_hint: { bg:'След като се покаже, очертай с пръст/мишка правоъгълник около подписа.', ru:'После показа обведите пальцем/мышью прямоугольник вокруг подписи.', uk:'Після показу обведіть пальцем/мишею прямокутник навколо підпису.', en:'Once shown, draw a rectangle around the signature with your finger/mouse.', de:'Nach dem Anzeigen ziehe mit Finger/Maus ein Rechteck um die Signatur.', fr:'Une fois affichée, trace un rectangle autour de la signature avec le doigt/la souris.', es:'Una vez mostrada, dibuja un rectángulo alrededor de la firma con el dedo/ratón.', 'es-MX':'Una vez mostrada, dibuja un rectángulo alrededor de la firma con el dedo/ratón.', it:'Una volta mostrata, disegna un rettangolo attorno alla firma con dito/mouse.', pt:'Após exibida, desenhe um retângulo ao redor da assinatura com o dedo/mouse.', ar:'بعد العرض، ارسم مستطيلاً حول التوقيع بإصبعك/الفأرة.', hi:'दिखने पर, उंगली/माउस से हस्ताक्षर के चारों ओर आयत बनाएं।', ja:'表示されたら、指やマウスで署名の周りに四角形を描いてください。', ky:'Көрсөтүлгөндөн кийин манжаңыз/чычканыңыз менен кол тамганын айланасына төрт бурчтук тартыңыз.', 'zh-Hant':'顯示後，用手指／滑鼠在簽名周圍框出矩形。' },
  pdf_sign_crop: { bg:'Изрежи подписа', ru:'Обрезать подпись', uk:'Обрізати підпис', en:'Crop the signature', de:'Signatur zuschneiden', fr:'Recadrer la signature', es:'Recortar la firma', 'es-MX':'Recortar la firma', it:'Ritaglia la firma', pt:'Recortar a assinatura', ar:'قص التوقيع', hi:'हस्ताक्षर क्रॉप करें', ja:'署名を切り抜く', ky:'Кол тамганы кесүү', 'zh-Hant':'裁切簽名' },
  pdf_sign_step2: { bg:'Стъпка 2 — постави подписа', ru:'Шаг 2 — вставьте подпись', uk:'Крок 2 — вставте підпис', en:'Step 2 — place the signature', de:'Schritt 2 — Signatur platzieren', fr:'Étape 2 — placer la signature', es:'Paso 2 — coloca la firma', 'es-MX':'Paso 2 — coloca la firma', it:'Passo 2 — posiziona la firma', pt:'Passo 2 — coloque a assinatura', ar:'الخطوة 2 — ضع التوقيع', hi:'चरण 2 — हस्ताक्षर रखें', ja:'ステップ2 — 署名を配置', ky:'2-кадам — кол тамганы коюңуз', 'zh-Hant':'步驟 2 — 放置簽名' },
  pdf_sign_target: { bg:'PDF за подписване', ru:'PDF для подписи', uk:'PDF для підпису', en:'PDF to sign', de:'Zu signierendes PDF', fr:'PDF à signer', es:'PDF a firmar', 'es-MX':'PDF a firmar', it:'PDF da firmare', pt:'PDF a assinar', ar:'PDF المراد توقيعه', hi:'हस्ताक्षर हेतु PDF', ja:'署名するPDF', ky:'Кол коюлуучу PDF', 'zh-Hant':'要簽名的 PDF' },
  pdf_sign_target_page: { bg:'Страница (1 = първа, -1 = последна)', ru:'Страница (1 = первая, -1 = последняя)', uk:'Сторінка (1 = перша, -1 = остання)', en:'Page (1 = first, -1 = last)', de:'Seite (1 = erste, -1 = letzte)', fr:'Page (1 = première, -1 = dernière)', es:'Página (1 = primera, -1 = última)', 'es-MX':'Página (1 = primera, -1 = última)', it:'Pagina (1 = prima, -1 = ultima)', pt:'Página (1 = primeira, -1 = última)', ar:'الصفحة (1 = الأولى، -1 = الأخيرة)', hi:'पेज (1 = पहला, -1 = अंतिम)', ja:'ページ（1 = 最初、-1 = 最後）', ky:'Барак (1 = биринчи, -1 = акыркы)', 'zh-Hant':'頁面（1 = 第一頁，-1 = 最後一頁）' },
  pdf_sign_size: { bg:'Размер (% от ширината)', ru:'Размер (% от ширины)', uk:'Розмір (% від ширини)', en:'Size (% of width)', de:'Größe (% der Breite)', fr:'Taille (% de la largeur)', es:'Tamaño (% del ancho)', 'es-MX':'Tamaño (% del ancho)', it:'Dimensione (% della larghezza)', pt:'Tamanho (% da largura)', ar:'الحجم (% من العرض)', hi:'आकार (चौड़ाई का %)', ja:'サイズ（幅の%）', ky:'Өлчөмү (туурасынын %)', 'zh-Hant':'尺寸（寬度的 %）' },
  pdf_sign_apply: { bg:'Постави подписа', ru:'Вставить подпись', uk:'Вставити підпис', en:'Place the signature', de:'Signatur platzieren', fr:'Placer la signature', es:'Colocar la firma', 'es-MX':'Colocar la firma', it:'Posiziona la firma', pt:'Colocar a assinatura', ar:'وضع التوقيع', hi:'हस्ताक्षर रखें', ja:'署名を配置', ky:'Кол тамганы коюу', 'zh-Hant':'放置簽名' },
  pdf_sign_pick_src: { bg:'Избери PDF с подпис.', ru:'Выберите PDF с подписью.', uk:'Виберіть PDF із підписом.', en:'Choose a PDF with a signature.', de:'Wähle ein PDF mit Signatur.', fr:'Choisis un PDF avec une signature.', es:'Elige un PDF con firma.', 'es-MX':'Elige un PDF con firma.', it:'Scegli un PDF con firma.', pt:'Escolha um PDF com assinatura.', ar:'اختر ملف PDF يحتوي على توقيع.', hi:'हस्ताक्षर वाली PDF चुनें।', ja:'署名のあるPDFを選択してください。', ky:'Кол тамгасы бар PDF тандаңыз.', 'zh-Hant':'請選擇含簽名的 PDF。' },
  pdf_sign_loaded: { bg:'Страницата е заредена — очертай подписа.', ru:'Страница загружена — обведите подпись.', uk:'Сторінка завантажена — обведіть підпис.', en:'Page loaded — outline the signature.', de:'Seite geladen — umrahme die Signatur.', fr:'Page chargée — entoure la signature.', es:'Página cargada — delinea la firma.', 'es-MX':'Página cargada — delinea la firma.', it:'Pagina caricata — delinea la firma.', pt:'Página carregada — contorne a assinatura.', ar:'تم تحميل الصفحة — حدّد التوقيع.', hi:'पेज लोड हुआ — हस्ताक्षर रेखांकित करें।', ja:'ページを読み込みました — 署名を囲んでください。', ky:'Барак жүктөлдү — кол тамганы белгилеңиз.', 'zh-Hant':'頁面已載入 — 框出簽名。' },
  pdf_sign_draw_first: { bg:'Първо очертай правоъгълник.', ru:'Сначала обведите прямоугольник.', uk:'Спершу обведіть прямокутник.', en:'Draw a rectangle first.', de:'Ziehe zuerst ein Rechteck.', fr:'Trace d’abord un rectangle.', es:'Primero dibuja un rectángulo.', 'es-MX':'Primero dibuja un rectángulo.', it:'Disegna prima un rettangolo.', pt:'Desenhe primeiro um retângulo.', ar:'ارسم مستطيلاً أولاً.', hi:'पहले एक आयत बनाएं।', ja:'まず四角形を描いてください。', ky:'Адегенде төрт бурчтук тартыңыз.', 'zh-Hant':'請先框出矩形。' },
  pdf_sign_cropped_label: { bg:'Изрязан подпис:', ru:'Обрезанная подпись:', uk:'Обрізаний підпис:', en:'Cropped signature:', de:'Zugeschnittene Signatur:', fr:'Signature recadrée :', es:'Firma recortada:', 'es-MX':'Firma recortada:', it:'Firma ritagliata:', pt:'Assinatura recortada:', ar:'التوقيع المقصوص:', hi:'क्रॉप किया गया हस्ताक्षर:', ja:'切り抜いた署名：', ky:'Кесилген кол тамга:', 'zh-Hant':'已裁切的簽名：' },
  pdf_sign_cropped_ok: { bg:'Подписът е изрязан. Премини към Стъпка 2.', ru:'Подпись обрезана. Перейдите к Шагу 2.', uk:'Підпис обрізано. Перейдіть до Кроку 2.', en:'Signature cropped. Go to Step 2.', de:'Signatur zugeschnitten. Weiter zu Schritt 2.', fr:'Signature recadrée. Passe à l’étape 2.', es:'Firma recortada. Pasa al Paso 2.', 'es-MX':'Firma recortada. Pasa al Paso 2.', it:'Firma ritagliata. Vai al Passo 2.', pt:'Assinatura recortada. Vá para o Passo 2.', ar:'تم قص التوقيع. انتقل إلى الخطوة 2.', hi:'हस्ताक्षर क्रॉप हुआ। चरण 2 पर जाएं।', ja:'署名を切り抜きました。ステップ2へ進んでください。', ky:'Кол тамга кесилди. 2-кадамга өтүңүз.', 'zh-Hant':'簽名已裁切。前往步驟 2。' },
  pdf_sign_crop_first: { bg:'Първо изрежи подпис (Стъпка 1).', ru:'Сначала обрежьте подпись (Шаг 1).', uk:'Спершу обріжте підпис (Крок 1).', en:'Crop a signature first (Step 1).', de:'Schneide zuerst eine Signatur zu (Schritt 1).', fr:'Recadre d’abord une signature (étape 1).', es:'Primero recorta una firma (Paso 1).', 'es-MX':'Primero recorta una firma (Paso 1).', it:'Ritaglia prima una firma (Passo 1).', pt:'Recorte primeiro uma assinatura (Passo 1).', ar:'قص التوقيع أولاً (الخطوة 1).', hi:'पहले हस्ताक्षर क्रॉप करें (चरण 1)।', ja:'まず署名を切り抜いてください（ステップ1）。', ky:'Адегенде кол тамганы кесиңиз (1-кадам).', 'zh-Hant':'請先裁切簽名（步驟 1）。' },
  pdf_sign_pick_target: { bg:'Избери PDF за подписване.', ru:'Выберите PDF для подписи.', uk:'Виберіть PDF для підпису.', en:'Choose a PDF to sign.', de:'Wähle ein zu signierendes PDF.', fr:'Choisis un PDF à signer.', es:'Elige un PDF para firmar.', 'es-MX':'Elige un PDF para firmar.', it:'Scegli un PDF da firmare.', pt:'Escolha um PDF para assinar.', ar:'اختر PDF لتوقيعه.', hi:'हस्ताक्षर हेतु PDF चुनें।', ja:'署名するPDFを選択してください。', ky:'Кол коюлуучу PDF тандаңыз.', 'zh-Hant':'請選擇要簽名的 PDF。' },
  pdf_sign_done: { bg:'Подписът е поставен на страница {0}.', ru:'Подпись вставлена на страницу {0}.', uk:'Підпис вставлено на сторінку {0}.', en:'Signature placed on page {0}.', de:'Signatur auf Seite {0} platziert.', fr:'Signature placée sur la page {0}.', es:'Firma colocada en la página {0}.', 'es-MX':'Firma colocada en la página {0}.', it:'Firma posizionata sulla pagina {0}.', pt:'Assinatura colocada na página {0}.', ar:'تم وضع التوقيع في الصفحة {0}.', hi:'पेज {0} पर हस्ताक्षर रखा गया।', ja:'{0}ページに署名を配置しました。', ky:'Кол тамга {0}-бетке коюлду.', 'zh-Hant':'簽名已放置於第 {0} 頁。' },

  pdf_err: { bg:'Грешка: {0}', ru:'Ошибка: {0}', uk:'Помилка: {0}', en:'Error: {0}', de:'Fehler: {0}', fr:'Erreur : {0}', es:'Error: {0}', 'es-MX':'Error: {0}', it:'Errore: {0}', pt:'Erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'Ката: {0}', 'zh-Hant':'錯誤：{0}' }
});

export const title = t('pdf_title');

let _cyrFontBytes = null;
async function getCyrFontBytes() {
  if (_cyrFontBytes) return _cyrFontBytes;
  const r = await fetch(cyrFontUrl);
  if (!r.ok) throw new Error('шрифтът не се зареди');
  _cyrFontBytes = await r.arrayBuffer();
  return _cyrFontBytes;
}

function parseRange(str, max) {
  const pages = [];
  str.split(',').forEach((part) => {
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

export function render(root) {
  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="merge">${t('pdf_tab_merge')}</button>
      <button class="tab" data-tab="split">${t('pdf_tab_split')}</button>
      <button class="tab" data-tab="wm">${t('pdf_tab_wm')}</button>
      <button class="tab" data-tab="sign">${t('pdf_tab_sign')}</button>
    </div>

    <div class="tool-card" data-panel="merge">
      <label>${t('pdf_merge_pick')}</label>
      <input type="file" id="mFiles" accept="application/pdf" multiple />
      <button class="btn" id="mBtn">${t('pdf_merge_btn')}</button>
      <div class="status" id="mStatus"></div>
    </div>

    <div class="tool-card" data-panel="split" style="display:none">
      <label>${t('pdf_pick_one')}</label>
      <input type="file" id="sFile" accept="application/pdf" />
      <label>${t('pdf_split_pages')}</label>
      <input type="text" id="sRange" placeholder="1-3,5,8" value="1" />
      <button class="btn" id="sBtn">${t('pdf_split_btn')}</button>
      <div class="status" id="sStatus"></div>
    </div>

    <div class="tool-card" data-panel="wm" style="display:none">
      <label>${t('pdf_pick_one')}</label>
      <input type="file" id="wFile" accept="application/pdf" />
      <label>${t('pdf_wm_text')}</label>
      <input type="text" id="wText" value="${t('pdf_wm_default')}" />
      <p class="hint">${t('pdf_wm_hint')}</p>
      <button class="btn" id="wBtn">${t('pdf_wm_btn')}</button>
      <div class="status" id="wStatus"></div>
    </div>

    <div class="tool-card" data-panel="sign" style="display:none">
      <div class="notice">${t('pdf_sign_notice')}</div>
      <h3 style="margin:14px 0 8px">${t('pdf_sign_step1')}</h3>
      <label>${t('pdf_sign_src')}</label>
      <input type="file" id="sigSrc" accept="application/pdf" />
      <label>${t('pdf_sign_page')}</label>
      <input type="number" id="sigPage" value="1" min="1" />
      <button class="btn sec" id="showPage">${t('pdf_sign_show')}</button>
      <p class="hint">${t('pdf_sign_draw_hint')}</p>
      <div id="sigCanvasWrap" style="position:relative;display:none;overflow:auto;border:1px solid var(--line);border-radius:8px;margin-top:10px">
        <canvas id="sigCanvas" style="display:block;max-width:100%"></canvas>
        <div id="sigSel" style="position:absolute;border:2px dashed var(--err);background:rgba(248,81,73,.2);display:none;pointer-events:none"></div>
      </div>
      <button class="btn" id="cropBtn" style="display:none">${t('pdf_sign_crop')}</button>
      <div id="sigPreview" style="margin-top:10px"></div>

      <h3 style="margin:18px 0 8px">${t('pdf_sign_step2')}</h3>
      <label>${t('pdf_sign_target')}</label>
      <input type="file" id="tgtPdf" accept="application/pdf" />
      <label>${t('pdf_sign_target_page')}</label>
      <input type="number" id="tgtPage" value="-1" />
      <label>${t('pdf_sign_size')}</label>
      <input type="number" id="sigScale" value="25" min="5" max="100" />
      <button class="btn" id="applySig">${t('pdf_sign_apply')}</button>
      <div class="status" id="signStatus"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  root.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      root.querySelectorAll('[data-panel]').forEach((p) => {
        p.style.display = p.dataset.panel === t.dataset.tab ? 'block' : 'none';
      });
    });
  });

  function save(bytes, name) { downloadBlob(bytes, name, 'application/pdf'); }

  // --- Сливане ---
  $('#mBtn').addEventListener('click', async () => {
    const files = $('#mFiles').files;
    if (files.length < 2) { setStatus($('#mStatus'), 'err', t('pdf_merge_min')); return; }
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const doc = await PDFDocument.load(await files[i].arrayBuffer());
        const pages = await out.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      save(await out.save(), 'merged.pdf');
      setStatus($('#mStatus'), 'ok', tf('pdf_merge_done', files.length));
    } catch (e) { setStatus($('#mStatus'), 'err', tf('pdf_err', e.message)); }
  });

  // --- Разделяне ---
  $('#sBtn').addEventListener('click', async () => {
    const f = $('#sFile').files[0];
    if (!f) { setStatus($('#sStatus'), 'err', t('pdf_pick_one')); return; }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      const idx = parseRange($('#sRange').value, doc.getPageCount());
      if (!idx.length) { setStatus($('#sStatus'), 'err', t('pdf_split_invalid')); return; }
      const out = await PDFDocument.create();
      const pages = await out.copyPages(doc, idx);
      pages.forEach((p) => out.addPage(p));
      save(await out.save(), 'extracted.pdf');
      setStatus($('#sStatus'), 'ok', tf('pdf_split_done', idx.length));
    } catch (e) { setStatus($('#sStatus'), 'err', tf('pdf_err', e.message)); }
  });

  // --- Воден знак (вграден Unicode шрифт — кирилица работи офлайн) ---
  $('#wBtn').addEventListener('click', async () => {
    const f = $('#wFile').files[0];
    if (!f) { setStatus($('#wStatus'), 'err', t('pdf_pick_one')); return; }
    const text = $('#wText').value || t('pdf_wm_default');
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      // вграждаме кирилски TTF чрез fontkit (бандълван локално → офлайн)
      doc.registerFontkit(fontkit);
      const font = await doc.embedFont(await getCyrFontBytes(), { subset: true });
      const pages = doc.getPages();
      pages.forEach((page) => {
        const w = page.getWidth(), h = page.getHeight();
        const tw = font.widthOfTextAtSize(text, 42);
        page.drawText(text, {
          x: w / 2 - tw / 2, y: h / 2, size: 42, font,
          color: rgb(0.6, 0.6, 0.6), opacity: 0.35, rotate: degrees(45)
        });
      });
      save(await doc.save(), 'watermarked.pdf');
      setStatus($('#wStatus'), 'ok', tf('pdf_wm_done', pages.length));
    } catch (e) { setStatus($('#wStatus'), 'err', tf('pdf_err', e.message)); }
  });

  // --- Визуален подпис ---
  let sigCroppedDataURL = null, selStart = null;

  $('#showPage').addEventListener('click', async () => {
    const f = $('#sigSrc').files[0];
    if (!f) { setStatus($('#signStatus'), 'err', t('pdf_sign_pick_src')); return; }
    try {
      const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      const pageNum = Math.min(Math.max(parseInt($('#sigPage').value, 10) || 1, 1), pdf.numPages);
      const page = await pdf.getPage(pageNum);
      const vp = page.getViewport({ scale: 2 });
      const canvas = $('#sigCanvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      $('#sigCanvasWrap').style.display = 'block';
      $('#cropBtn').style.display = 'block';
      setupSelection();
      setStatus($('#signStatus'), 'ok', t('pdf_sign_loaded'));
    } catch (e) { setStatus($('#signStatus'), 'err', tf('pdf_err', e.message)); }
  });

  function setupSelection() {
    const canvas = $('#sigCanvas'), sel = $('#sigSel');
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return { x: cx * (canvas.width / r.width), y: cy * (canvas.height / r.height), dx: cx, dy: cy };
    }
    function down(e) { e.preventDefault(); selStart = pos(e); sel.style.display = 'block'; }
    function move(e) {
      if (!selStart) return; e.preventDefault();
      const p = pos(e);
      const x = Math.min(selStart.dx, p.dx), y = Math.min(selStart.dy, p.dy);
      const w = Math.abs(p.dx - selStart.dx), h = Math.abs(p.dy - selStart.dy);
      sel.style.left = x + 'px'; sel.style.top = y + 'px';
      sel.style.width = w + 'px'; sel.style.height = h + 'px';
      sel._rect = { x: Math.min(selStart.x, p.x), y: Math.min(selStart.y, p.y), w: Math.abs(p.x - selStart.x), h: Math.abs(p.y - selStart.y) };
    }
    function up() { selStart = null; }
    canvas.onmousedown = down; canvas.onmousemove = move; window.addEventListener('mouseup', up);
    canvas.ontouchstart = down; canvas.ontouchmove = move; window.addEventListener('touchend', up);
  }

  $('#cropBtn').addEventListener('click', () => {
    const sel = $('#sigSel'); const r = sel._rect;
    if (!r || r.w < 5 || r.h < 5) { setStatus($('#signStatus'), 'err', t('pdf_sign_draw_first')); return; }
    const src = $('#sigCanvas');
    const c = document.createElement('canvas');
    c.width = Math.round(r.w); c.height = Math.round(r.h);
    c.getContext('2d').drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    sigCroppedDataURL = c.toDataURL('image/png');
    $('#sigPreview').innerHTML = '<p class="hint">' + t('pdf_sign_cropped_label') + '</p><img src="' + sigCroppedDataURL + '" style="max-width:260px;border:1px solid var(--line);border-radius:6px;background:#fff" />';
    setStatus($('#signStatus'), 'ok', t('pdf_sign_cropped_ok'));
  });

  $('#applySig').addEventListener('click', async () => {
    if (!sigCroppedDataURL) { setStatus($('#signStatus'), 'err', t('pdf_sign_crop_first')); return; }
    const f = $('#tgtPdf').files[0];
    if (!f) { setStatus($('#signStatus'), 'err', t('pdf_sign_pick_target')); return; }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      const pngBytes = await (await fetch(sigCroppedDataURL)).arrayBuffer();
      const png = await doc.embedPng(pngBytes);
      const pages = doc.getPages();
      let idx = parseInt($('#tgtPage').value, 10);
      if (idx === -1 || idx > pages.length) idx = pages.length;
      if (idx < 1) idx = 1;
      const page = pages[idx - 1];
      const pw = page.getWidth();
      const scalePct = Math.min(Math.max(parseInt($('#sigScale').value, 10) || 25, 5), 100) / 100;
      const imgW = pw * scalePct;
      const imgH = imgW * (png.height / png.width);
      page.drawImage(png, { x: pw - imgW - 40, y: 40, width: imgW, height: imgH });
      save(await doc.save(), 'signed.pdf');
      setStatus($('#signStatus'), 'ok', tf('pdf_sign_done', idx));
    } catch (e) { setStatus($('#signStatus'), 'err', tf('pdf_err', e.message)); }
  });
}
