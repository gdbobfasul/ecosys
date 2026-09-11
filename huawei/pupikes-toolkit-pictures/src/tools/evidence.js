// Version: 1.0021
// „Снимки като доказателство" — НОВА СЪРЦЕВИНА (Huawei 4.3, 11.09.2026). Самостоятелен модул (може да се
// копира и в Pupikes Toolkit заедно с core/sha256.js, core/exif.js, core/blobstore.js).
// Дела (случаи): наем, кола, доставка, ремонт, показания на уреди, застрахователна щета. Всяка снимка
// (от камерата през системното приложение или от галерията) получава:
//   • SHA-256 отпечатък на оригиналните байтове (файлът се пази непроменен в IndexedDB);
//   • EXIF данни (кога е заснета, устройство, GPS на камерата — само четене);
//   • по избор място от GPS на телефона (само ако потребителят го включи в „Настройки");
//   • видим воден знак (дата, час, място, отпечатък, № в дневника) при записване на копие.
// Дневник: всеки запис носи отпечатъка на предишния (верига) → промяна/изтриване на запис или подмяна
// на снимка се вижда при проверка. „Проверка": отпечатък на произволен файл → търсене в дневника; ако не
// е идентичен — карта на разликите спрямо оригинала (червено = променено, жълта рамка = зона).
// Подписан PDF протокол: страниците се рисуват на canvas (за да излизат хинди/японски/китайски/арабски
// със системните шрифтове), подписите се рисуват с пръст, отпечатъците са и като ТЕКСТ в PDF-а.
// При първо пускане: 1 ясно маркирано примерно дело с 5 генерирани снимки (бутон „Изтрий примера").
// Всичко е на устройството, офлайн; нищо не се изпраща никъде.
import { esc, fmtSize } from '../core/ui.js';
import { saveFile } from '../core/filesave.js';
import { t, tf, register, getLang, isRTL } from '../core/i18n.js';
import { sha256Hex } from '../core/sha256.js';
import { readExif, exifDateText } from '../core/exif.js';
import { putBlob, getBlob, delBlob, blobUsage } from '../core/blobstore.js';

register({
  ev_tab_cases: { bg:'Дела', ru:'Дела', uk:'Справи', en:'Cases', de:'Fälle', fr:'Dossiers', es:'Casos', 'es-MX':'Casos', it:'Pratiche', pt:'Casos', ar:'القضايا', hi:'मामले', ja:'ケース', ky:'Иштер', 'zh-Hant':'案件' },
  ev_tab_verify: { bg:'Проверка', ru:'Проверка', uk:'Перевірка', en:'Verify', de:'Prüfen', fr:'Vérifier', es:'Verificar', 'es-MX':'Verificar', it:'Verifica', pt:'Verificar', ar:'تحقّق', hi:'जाँच', ja:'検証', ky:'Текшерүү', 'zh-Hant':'驗證' },
  ev_tab_log: { bg:'Дневник', ru:'Журнал', uk:'Журнал', en:'Journal', de:'Protokoll', fr:'Journal', es:'Registro', 'es-MX':'Registro', it:'Registro', pt:'Registo', ar:'السجل', hi:'लॉग', ja:'ログ', ky:'Журнал', 'zh-Hant':'日誌' },
  ev_tab_set: { bg:'Настройки', ru:'Настройки', uk:'Налаштування', en:'Settings', de:'Einstellungen', fr:'Réglages', es:'Ajustes', 'es-MX':'Ajustes', it:'Impostazioni', pt:'Definições', ar:'الإعدادات', hi:'सेटिंग्स', ja:'設定', ky:'Жөндөөлөр', 'zh-Hant':'設定' },
  ev_intro: { bg:'Снимки като доказателство: всяка снимка получава воден знак с дата, час и място и SHA-256 отпечатък в дневник, който не може да се подправи незабелязано. После доказваш, че не е променяна, и даваш подписан PDF протокол.', ru:'Фото как доказательство: каждый снимок получает водяной знак с датой, временем и местом и отпечаток SHA-256 в журнале, который нельзя незаметно подделать. Потом вы доказываете, что фото не менялось, и выдаёте подписанный PDF-протокол.', uk:'Фото як доказ: кожен знімок отримує водяний знак із датою, часом і місцем та відбиток SHA-256 у журналі, який не можна непомітно підробити. Потім доводите, що фото не змінювали, і видаєте підписаний PDF-протокол.', en:'Photos as proof: every photo gets a watermark with date, time and place and a SHA-256 fingerprint in a journal that cannot be altered unnoticed. Later you prove it was not changed and hand over a signed PDF report.', de:'Fotos als Beweis: Jedes Foto erhält ein Wasserzeichen mit Datum, Uhrzeit und Ort und einen SHA-256-Fingerabdruck in einem Protokoll, das sich nicht unbemerkt ändern lässt. Später beweist du, dass es unverändert ist, und übergibst ein unterschriebenes PDF-Protokoll.', fr:'Photos comme preuve : chaque photo reçoit un filigrane avec date, heure et lieu et une empreinte SHA-256 dans un journal impossible à modifier sans que cela se voie. Ensuite, vous prouvez qu’elle n’a pas été modifiée et remettez un rapport PDF signé.', es:'Fotos como prueba: cada foto recibe una marca de agua con fecha, hora y lugar y una huella SHA-256 en un registro que no se puede alterar sin que se note. Después demuestras que no se modificó y entregas un informe PDF firmado.', 'es-MX':'Fotos como prueba: cada foto recibe una marca de agua con fecha, hora y lugar y una huella SHA-256 en un registro que no se puede alterar sin que se note. Después demuestras que no se modificó y entregas un informe PDF firmado.', it:'Foto come prova: ogni foto riceve una filigrana con data, ora e luogo e un’impronta SHA-256 in un registro che non si può alterare senza lasciare traccia. Poi dimostri che non è stata modificata e consegni un verbale PDF firmato.', pt:'Fotos como prova: cada foto recebe uma marca de água com data, hora e local e uma impressão SHA-256 num registo que não pode ser alterado sem se notar. Depois provas que não foi modificada e entregas um relatório PDF assinado.', ar:'الصور كدليل: تحصل كل صورة على علامة مائية بالتاريخ والوقت والمكان وبصمة SHA-256 في سجل لا يمكن تعديله دون أن يُكتشف. لاحقًا تثبت أنها لم تُعدَّل وتسلّم تقريرًا موقّعًا بصيغة PDF.', hi:'सबूत के तौर पर फ़ोटो: हर फ़ोटो पर तारीख, समय और जगह का वॉटरमार्क और SHA-256 फ़िंगरप्रिंट लगता है, जो ऐसे लॉग में दर्ज होता है जिसे चुपचाप बदला नहीं जा सकता। बाद में आप साबित करते हैं कि फ़ोटो बदली नहीं गई और हस्ताक्षरित PDF रिपोर्ट देते हैं।', ja:'証拠としての写真：各写真に日付・時刻・場所の透かしと SHA-256 指紋が付き、気付かれずに改ざんできないログに記録されます。後で変更されていないことを証明し、署名入り PDF 報告書を渡せます。', ky:'Сүрөт далил катары: ар бир сүрөткө күнү, убактысы жана жери жазылган суу белгиси жана байкалбай өзгөртүүгө мүмкүн болбогон журналга SHA-256 изи берилет. Кийин анын өзгөрбөгөнүн далилдеп, кол коюлган PDF протокол бересиз.', 'zh-Hant':'照片即證據：每張照片都會加上日期、時間與地點浮水印，並把 SHA-256 指紋記入無法被悄悄竄改的日誌。之後可證明照片未被修改，並交出已簽名的 PDF 報告。' },
  ev_stats: { bg:'{0} дела · {1} снимки · дневник: {2} записа', ru:'{0} дел · {1} фото · журнал: {2} записей', uk:'{0} справ · {1} фото · журнал: {2} записів', en:'{0} cases · {1} photos · journal: {2} entries', de:'{0} Fälle · {1} Fotos · Protokoll: {2} Einträge', fr:'{0} dossiers · {1} photos · journal : {2} entrées', es:'{0} casos · {1} fotos · registro: {2} entradas', 'es-MX':'{0} casos · {1} fotos · registro: {2} entradas', it:'{0} pratiche · {1} foto · registro: {2} voci', pt:'{0} casos · {1} fotos · registo: {2} entradas', ar:'{0} قضايا · {1} صور · السجل: {2} إدخالات', hi:'{0} मामले · {1} फ़ोटो · लॉग: {2} प्रविष्टियाँ', ja:'ケース {0} 件 · 写真 {1} 枚 · ログ {2} 件', ky:'{0} иш · {1} сүрөт · журнал: {2} жазуу', 'zh-Hant':'{0} 個案件 · {1} 張照片 · 日誌：{2} 筆' },
  ev_chain_ok_short: { bg:'✓ ненарушен', ru:'✓ не нарушен', uk:'✓ не порушено', en:'✓ intact', de:'✓ unversehrt', fr:'✓ intact', es:'✓ íntegro', 'es-MX':'✓ íntegro', it:'✓ integro', pt:'✓ íntegro', ar:'✓ سليم', hi:'✓ अक्षुण्ण', ja:'✓ 改ざんなし', ky:'✓ бузулган эмес', 'zh-Hant':'✓ 完整' },
  ev_chain_bad_short: { bg:'✗ нарушен', ru:'✗ нарушен', uk:'✗ порушено', en:'✗ broken', de:'✗ verletzt', fr:'✗ rompu', es:'✗ roto', 'es-MX':'✗ roto', it:'✗ violato', pt:'✗ quebrado', ar:'✗ مكسور', hi:'✗ टूटा हुआ', ja:'✗ 破損', ky:'✗ бузулган', 'zh-Hant':'✗ 已破壞' },
  ev_new_case: { bg:'＋ Ново дело', ru:'＋ Новое дело', uk:'＋ Нова справа', en:'＋ New case', de:'＋ Neuer Fall', fr:'＋ Nouveau dossier', es:'＋ Nuevo caso', 'es-MX':'＋ Nuevo caso', it:'＋ Nuova pratica', pt:'＋ Novo caso', ar:'＋ قضية جديدة', hi:'＋ नया मामला', ja:'＋ 新しいケース', ky:'＋ Жаңы иш', 'zh-Hant':'＋ 新案件' },
  ev_case_title: { bg:'Име на делото', ru:'Название дела', uk:'Назва справи', en:'Case title', de:'Titel des Falls', fr:'Titre du dossier', es:'Título del caso', 'es-MX':'Título del caso', it:'Titolo della pratica', pt:'Título do caso', ar:'عنوان القضية', hi:'मामले का नाम', ja:'ケース名', ky:'Иштин аталышы', 'zh-Hant':'案件名稱' },
  ev_case_title_ph: { bg:'напр. Наем на апартамент / Колата преди сервиза', ru:'напр. Аренда квартиры / Машина перед сервисом', uk:'напр. Оренда квартири / Авто перед сервісом', en:'e.g. Flat rental / Car before the service', de:'z. B. Wohnungsmiete / Auto vor der Werkstatt', fr:'ex. Location d’appartement / Voiture avant le garage', es:'p. ej. Alquiler de piso / Coche antes del taller', 'es-MX':'p. ej. Renta de departamento / Auto antes del taller', it:'es. Affitto appartamento / Auto prima dell’officina', pt:'ex. Arrendamento / Carro antes da oficina', ar:'مثال: استئجار شقة / السيارة قبل الصيانة', hi:'जैसे फ़्लैट किराया / सर्विस से पहले कार', ja:'例：賃貸マンション／整備前の車', ky:'мис. Батир ижарасы / Сервиске чейинки унаа', 'zh-Hant':'例如：租屋／送修前的汽車' },
  ev_kind: { bg:'Вид', ru:'Тип', uk:'Тип', en:'Type', de:'Art', fr:'Type', es:'Tipo', 'es-MX':'Tipo', it:'Tipo', pt:'Tipo', ar:'النوع', hi:'प्रकार', ja:'種類', ky:'Түрү', 'zh-Hant':'類型' },
  ev_k_rent: { bg:'Наем / жилище', ru:'Аренда / жильё', uk:'Оренда / житло', en:'Rental / home', de:'Miete / Wohnung', fr:'Location / logement', es:'Alquiler / vivienda', 'es-MX':'Renta / vivienda', it:'Affitto / casa', pt:'Arrendamento / casa', ar:'إيجار / سكن', hi:'किराया / घर', ja:'賃貸／住まい', ky:'Ижара / турак жай', 'zh-Hant':'租賃／住家' },
  ev_k_car: { bg:'Автомобил', ru:'Автомобиль', uk:'Автомобіль', en:'Car', de:'Auto', fr:'Voiture', es:'Coche', 'es-MX':'Auto', it:'Auto', pt:'Carro', ar:'سيارة', hi:'कार', ja:'車', ky:'Унаа', 'zh-Hant':'汽車' },
  ev_k_delivery: { bg:'Доставка / пратка', ru:'Доставка / посылка', uk:'Доставка / посилка', en:'Delivery / parcel', de:'Lieferung / Paket', fr:'Livraison / colis', es:'Entrega / paquete', 'es-MX':'Entrega / paquete', it:'Consegna / pacco', pt:'Entrega / encomenda', ar:'توصيل / طرد', hi:'डिलीवरी / पार्सल', ja:'配達／荷物', ky:'Жеткирүү / посылка', 'zh-Hant':'配送／包裹' },
  ev_k_repair: { bg:'Ремонт / работа', ru:'Ремонт / работы', uk:'Ремонт / роботи', en:'Repair / works', de:'Reparatur / Arbeiten', fr:'Réparation / travaux', es:'Reparación / obra', 'es-MX':'Reparación / obra', it:'Riparazione / lavori', pt:'Reparação / obras', ar:'إصلاح / أعمال', hi:'मरम्मत / काम', ja:'修理／工事', ky:'Оңдоо / иштер', 'zh-Hant':'維修／工程' },
  ev_k_meter: { bg:'Показания на уреди', ru:'Показания счётчиков', uk:'Показники лічильників', en:'Meter readings', de:'Zählerstände', fr:'Relevés de compteurs', es:'Lecturas de contadores', 'es-MX':'Lecturas de medidores', it:'Letture contatori', pt:'Leituras de contadores', ar:'قراءات العدادات', hi:'मीटर रीडिंग', ja:'メーター値', ky:'Эсептегич көрсөткүчтөрү', 'zh-Hant':'儀表讀數' },
  ev_k_insurance: { bg:'Застрахователна щета', ru:'Страховой ущерб', uk:'Страховий збиток', en:'Insurance damage', de:'Versicherungsschaden', fr:'Sinistre d’assurance', es:'Siniestro de seguro', 'es-MX':'Siniestro de seguro', it:'Sinistro assicurativo', pt:'Sinistro de seguro', ar:'ضرر تأميني', hi:'बीमा क्षति', ja:'保険の損害', ky:'Камсыздандыруу зыяны', 'zh-Hant':'保險損害' },
  ev_k_other: { bg:'Друго', ru:'Другое', uk:'Інше', en:'Other', de:'Sonstiges', fr:'Autre', es:'Otro', 'es-MX':'Otro', it:'Altro', pt:'Outro', ar:'أخرى', hi:'अन्य', ja:'その他', ky:'Башка', 'zh-Hant':'其他' },
  ev_place: { bg:'Място / адрес', ru:'Место / адрес', uk:'Місце / адреса', en:'Place / address', de:'Ort / Adresse', fr:'Lieu / adresse', es:'Lugar / dirección', 'es-MX':'Lugar / dirección', it:'Luogo / indirizzo', pt:'Local / morada', ar:'المكان / العنوان', hi:'जगह / पता', ja:'場所／住所', ky:'Жер / дарек', 'zh-Hant':'地點／地址' },
  ev_place_ph: { bg:'напр. ул. Липа 5, ап. 12', ru:'напр. ул. Липовая 5, кв. 12', uk:'напр. вул. Липова 5, кв. 12', en:'e.g. 5 Oak Street, flat 12', de:'z. B. Lindenstr. 5, Whg. 12', fr:'ex. 5 rue des Tilleuls, appt 12', es:'p. ej. C/ Tilo 5, piso 12', 'es-MX':'p. ej. Calle Tilo 5, depto 12', it:'es. Via dei Tigli 5, int. 12', pt:'ex. Rua das Tílias 5, apt. 12', ar:'مثال: شارع الزيزفون 5، شقة 12', hi:'जैसे 5 ओक स्ट्रीट, फ़्लैट 12', ja:'例：オーク通り5、12号室', ky:'мис. Жөкө көч. 5, 12-батир', 'zh-Hant':'例如：橡樹街 5 號 12 室' },
  ev_save: { bg:'Запази', ru:'Сохранить', uk:'Зберегти', en:'Save', de:'Speichern', fr:'Enregistrer', es:'Guardar', 'es-MX':'Guardar', it:'Salva', pt:'Guardar', ar:'حفظ', hi:'सहेजें', ja:'保存', ky:'Сактоо', 'zh-Hant':'儲存' },
  ev_cancel: { bg:'Отказ', ru:'Отмена', uk:'Скасувати', en:'Cancel', de:'Abbrechen', fr:'Annuler', es:'Cancelar', 'es-MX':'Cancelar', it:'Annulla', pt:'Cancelar', ar:'إلغاء', hi:'रद्द करें', ja:'キャンセル', ky:'Жокко чыгаруу', 'zh-Hant':'取消' },
  ev_back_cases: { bg:'← Дела', ru:'← Дела', uk:'← Справи', en:'← Cases', de:'← Fälle', fr:'← Dossiers', es:'← Casos', 'es-MX':'← Casos', it:'← Pratiche', pt:'← Casos', ar:'→ القضايا', hi:'← मामले', ja:'← ケース', ky:'← Иштер', 'zh-Hant':'← 案件' },
  ev_back_case: { bg:'← Към делото', ru:'← К делу', uk:'← До справи', en:'← Back to case', de:'← Zum Fall', fr:'← Retour au dossier', es:'← Volver al caso', 'es-MX':'← Volver al caso', it:'← Alla pratica', pt:'← Voltar ao caso', ar:'→ العودة إلى القضية', hi:'← मामले पर वापस', ja:'← ケースへ戻る', ky:'← Ишке кайтуу', 'zh-Hant':'← 返回案件' },
  ev_empty: { bg:'Още няма дела. Създай първото — напр. апартамент под наем или колата преди ремонт.', ru:'Дел пока нет. Создайте первое — например, съёмная квартира или машина перед ремонтом.', uk:'Справ поки немає. Створіть першу — напр. орендована квартира чи авто перед ремонтом.', en:'No cases yet. Create the first one — e.g. a flat you rent or your car before a repair.', de:'Noch keine Fälle. Lege den ersten an — z. B. eine Mietwohnung oder das Auto vor der Reparatur.', fr:'Aucun dossier. Créez le premier — ex. un logement loué ou la voiture avant une réparation.', es:'Aún no hay casos. Crea el primero — p. ej. un piso de alquiler o el coche antes de una reparación.', 'es-MX':'Aún no hay casos. Crea el primero — p. ej. un departamento rentado o el auto antes de una reparación.', it:'Nessuna pratica. Crea la prima — ad es. un appartamento in affitto o l’auto prima di una riparazione.', pt:'Ainda não há casos. Cria o primeiro — ex. uma casa arrendada ou o carro antes de uma reparação.', ar:'لا توجد قضايا بعد. أنشئ أول قضية — مثل شقة مستأجرة أو السيارة قبل الإصلاح.', hi:'अभी कोई मामला नहीं। पहला बनाएँ — जैसे किराए का फ़्लैट या मरम्मत से पहले कार।', ja:'ケースはまだありません。賃貸住宅や修理前の車など、最初のケースを作成しましょう。', ky:'Азырынча иш жок. Биринчисин түзүңүз — мис. ижарадагы батир же оңдоого чейинки унаа.', 'zh-Hant':'尚無案件。建立第一個——例如租來的房子或維修前的汽車。' },
  ev_photos_n: { bg:'{0} снимки', ru:'{0} фото', uk:'{0} фото', en:'{0} photos', de:'{0} Fotos', fr:'{0} photos', es:'{0} fotos', 'es-MX':'{0} fotos', it:'{0} foto', pt:'{0} fotos', ar:'{0} صور', hi:'{0} फ़ोटो', ja:'写真 {0} 枚', ky:'{0} сүрөт', 'zh-Hant':'{0} 張照片' },
  ev_sample_badge: { bg:'пример', ru:'пример', uk:'приклад', en:'sample', de:'Beispiel', fr:'exemple', es:'ejemplo', 'es-MX':'ejemplo', it:'esempio', pt:'exemplo', ar:'مثال', hi:'उदाहरण', ja:'サンプル', ky:'үлгү', 'zh-Hant':'範例' },
  ev_sample_note: { bg:'Примерно дело с 5 генерирани снимки — за да видиш как работи. Изтрий го, когато добавиш свои.', ru:'Пример дела с 5 сгенерированными фото — чтобы увидеть, как это работает. Удалите его, когда добавите свои.', uk:'Приклад справи з 5 згенерованими фото — щоб побачити, як це працює. Видаліть його, коли додасте свої.', en:'Sample case with 5 generated photos — to show how it works. Delete it once you add your own.', de:'Beispielfall mit 5 erzeugten Fotos — zum Ausprobieren. Lösche ihn, sobald du eigene hinzufügst.', fr:'Dossier d’exemple avec 5 photos générées, pour voir comment ça marche. Supprimez-le quand vous ajoutez les vôtres.', es:'Caso de ejemplo con 5 fotos generadas, para ver cómo funciona. Bórralo cuando añadas los tuyos.', 'es-MX':'Caso de ejemplo con 5 fotos generadas, para ver cómo funciona. Bórralo cuando agregues los tuyos.', it:'Pratica di esempio con 5 foto generate, per vedere come funziona. Eliminala quando aggiungi le tue.', pt:'Caso de exemplo com 5 fotos geradas, para veres como funciona. Apaga-o quando adicionares os teus.', ar:'قضية تجريبية بخمس صور مولَّدة لتوضيح طريقة العمل. احذفها عندما تضيف قضاياك.', hi:'5 बनाई गई फ़ोटो वाला उदाहरण मामला — काम समझने के लिए। अपने जोड़ने के बाद इसे हटा दें।', ja:'生成した写真5枚のサンプルケースです。自分のケースを追加したら削除してください。', ky:'Кантип иштээрин көрсөтүүчү 5 сүрөттүү үлгү иш. Өзүңүздүкүн кошкондо өчүрүңүз.', 'zh-Hant':'含 5 張生成照片的範例案件，用來展示功能。新增自己的案件後即可刪除。' },
  ev_sample_del: { bg:'Изтрий примера', ru:'Удалить пример', uk:'Видалити приклад', en:'Delete sample', de:'Beispiel löschen', fr:'Supprimer l’exemple', es:'Borrar ejemplo', 'es-MX':'Borrar ejemplo', it:'Elimina esempio', pt:'Apagar exemplo', ar:'حذف المثال', hi:'उदाहरण हटाएँ', ja:'サンプルを削除', ky:'Үлгүнү өчүрүү', 'zh-Hant':'刪除範例' },
  ev_add_title: { bg:'Добави снимки', ru:'Добавить фото', uk:'Додати фото', en:'Add photos', de:'Fotos hinzufügen', fr:'Ajouter des photos', es:'Añadir fotos', 'es-MX':'Agregar fotos', it:'Aggiungi foto', pt:'Adicionar fotos', ar:'إضافة صور', hi:'फ़ोटो जोड़ें', ja:'写真を追加', ky:'Сүрөт кошуу', 'zh-Hant':'新增照片' },
  ev_tag: { bg:'Какво показва снимката', ru:'Что на фото', uk:'Що на фото', en:'What the photo shows', de:'Was das Foto zeigt', fr:'Ce que montre la photo', es:'Qué muestra la foto', 'es-MX':'Qué muestra la foto', it:'Cosa mostra la foto', pt:'O que a foto mostra', ar:'ماذا تُظهر الصورة', hi:'फ़ोटो में क्या है', ja:'写真の内容', ky:'Сүрөттө эмне бар', 'zh-Hant':'照片內容' },
  ev_t_before: { bg:'Преди', ru:'До', uk:'До', en:'Before', de:'Vorher', fr:'Avant', es:'Antes', 'es-MX':'Antes', it:'Prima', pt:'Antes', ar:'قبل', hi:'पहले', ja:'前', ky:'Мурун', 'zh-Hant':'之前' },
  ev_t_after: { bg:'След', ru:'После', uk:'Після', en:'After', de:'Nachher', fr:'Après', es:'Después', 'es-MX':'Después', it:'Dopo', pt:'Depois', ar:'بعد', hi:'बाद', ja:'後', ky:'Кийин', 'zh-Hant':'之後' },
  ev_t_damage: { bg:'Щета', ru:'Повреждение', uk:'Пошкодження', en:'Damage', de:'Schaden', fr:'Dommage', es:'Daño', 'es-MX':'Daño', it:'Danno', pt:'Dano', ar:'ضرر', hi:'क्षति', ja:'損傷', ky:'Зыян', 'zh-Hant':'損壞' },
  ev_t_meter: { bg:'Показание на уред', ru:'Показание счётчика', uk:'Показник лічильника', en:'Meter reading', de:'Zählerstand', fr:'Relevé de compteur', es:'Lectura de contador', 'es-MX':'Lectura de medidor', it:'Lettura contatore', pt:'Leitura de contador', ar:'قراءة عداد', hi:'मीटर रीडिंग', ja:'メーター値', ky:'Эсептегич көрсөткүчү', 'zh-Hant':'儀表讀數' },
  ev_t_doc: { bg:'Документ', ru:'Документ', uk:'Документ', en:'Document', de:'Dokument', fr:'Document', es:'Documento', 'es-MX':'Documento', it:'Documento', pt:'Documento', ar:'مستند', hi:'दस्तावेज़', ja:'書類', ky:'Документ', 'zh-Hant':'文件' },
  ev_t_other: { bg:'Друго', ru:'Другое', uk:'Інше', en:'Other', de:'Sonstiges', fr:'Autre', es:'Otro', 'es-MX':'Otro', it:'Altro', pt:'Outro', ar:'أخرى', hi:'अन्य', ja:'その他', ky:'Башка', 'zh-Hant':'其他' },
  ev_note: { bg:'Бележка', ru:'Заметка', uk:'Нотатка', en:'Note', de:'Notiz', fr:'Note', es:'Nota', 'es-MX':'Nota', it:'Nota', pt:'Nota', ar:'ملاحظة', hi:'नोट', ja:'メモ', ky:'Эскертүү', 'zh-Hant':'備註' },
  ev_note_ph: { bg:'напр. драскотина на вратата, стената в хола', ru:'напр. царапина на двери, стена в гостиной', uk:'напр. подряпина на дверях, стіна у вітальні', en:'e.g. scratch on the door, living room wall', de:'z. B. Kratzer an der Tür, Wohnzimmerwand', fr:'ex. rayure sur la porte, mur du salon', es:'p. ej. arañazo en la puerta, pared del salón', 'es-MX':'p. ej. rayón en la puerta, pared de la sala', it:'es. graffio sulla porta, parete del soggiorno', pt:'ex. risco na porta, parede da sala', ar:'مثال: خدش على الباب، جدار غرفة المعيشة', hi:'जैसे दरवाज़े पर खरोंच, बैठक की दीवार', ja:'例：ドアの傷、リビングの壁', ky:'мис. эшиктеги тырмак, конок бөлмөсүнүн дубалы', 'zh-Hant':'例如：門上的刮痕、客廳牆面' },
  ev_meter_val: { bg:'Стойност на уреда', ru:'Значение счётчика', uk:'Значення лічильника', en:'Meter value', de:'Zählerwert', fr:'Valeur du compteur', es:'Valor del contador', 'es-MX':'Valor del medidor', it:'Valore del contatore', pt:'Valor do contador', ar:'قيمة العداد', hi:'मीटर मान', ja:'メーターの数値', ky:'Эсептегичтин мааниси', 'zh-Hant':'儀表數值' },
  ev_camera: { bg:'📷 Снимай', ru:'📷 Снять', uk:'📷 Зняти', en:'📷 Take photo', de:'📷 Foto aufnehmen', fr:'📷 Prendre une photo', es:'📷 Hacer foto', 'es-MX':'📷 Tomar foto', it:'📷 Scatta foto', pt:'📷 Tirar foto', ar:'📷 التقاط صورة', hi:'📷 फ़ोटो लें', ja:'📷 撮影', ky:'📷 Сүрөткө тартуу', 'zh-Hant':'📷 拍照' },
  ev_gallery: { bg:'🖼 От галерията', ru:'🖼 Из галереи', uk:'🖼 З галереї', en:'🖼 From gallery', de:'🖼 Aus der Galerie', fr:'🖼 Depuis la galerie', es:'🖼 De la galería', 'es-MX':'🖼 De la galería', it:'🖼 Dalla galleria', pt:'🖼 Da galeria', ar:'🖼 من المعرض', hi:'🖼 गैलरी से', ja:'🖼 ギャラリーから', ky:'🖼 Галереядан', 'zh-Hant':'🖼 從相簿' },
  ev_adding: { bg:'Добавям {0}/{1}: отпечатък, дата, място…', ru:'Добавляю {0}/{1}: отпечаток, дата, место…', uk:'Додаю {0}/{1}: відбиток, дата, місце…', en:'Adding {0}/{1}: fingerprint, date, place…', de:'Füge {0}/{1} hinzu: Fingerabdruck, Datum, Ort…', fr:'Ajout {0}/{1} : empreinte, date, lieu…', es:'Añadiendo {0}/{1}: huella, fecha, lugar…', 'es-MX':'Agregando {0}/{1}: huella, fecha, lugar…', it:'Aggiungo {0}/{1}: impronta, data, luogo…', pt:'A adicionar {0}/{1}: impressão, data, local…', ar:'جارٍ الإضافة {0}/{1}: البصمة، التاريخ، المكان…', hi:'जोड़ रहे हैं {0}/{1}: फ़िंगरप्रिंट, तारीख, जगह…', ja:'追加中 {0}/{1}：指紋・日時・場所…', ky:'Кошулууда {0}/{1}: из, күн, жер…', 'zh-Hant':'新增中 {0}/{1}：指紋、日期、地點…' },
  ev_added: { bg:'Добавени {0} снимки в дневника.', ru:'Добавлено {0} фото в журнал.', uk:'Додано {0} фото до журналу.', en:'Added {0} photos to the journal.', de:'{0} Fotos ins Protokoll aufgenommen.', fr:'{0} photos ajoutées au journal.', es:'{0} fotos añadidas al registro.', 'es-MX':'{0} fotos agregadas al registro.', it:'{0} foto aggiunte al registro.', pt:'{0} fotos adicionadas ao registo.', ar:'أُضيفت {0} صور إلى السجل.', hi:'लॉग में {0} फ़ोटो जोड़ी गईं।', ja:'ログに写真 {0} 枚を追加しました。', ky:'Журналга {0} сүрөт кошулду.', 'zh-Hant':'已將 {0} 張照片加入日誌。' },
  ev_gps_fail: { bg:'Местоположението не е достъпно — снимката е записана без него.', ru:'Местоположение недоступно — фото сохранено без него.', uk:'Місцезнаходження недоступне — фото збережено без нього.', en:'Location not available — the photo was saved without it.', de:'Standort nicht verfügbar — Foto ohne Ort gespeichert.', fr:'Position indisponible — photo enregistrée sans elle.', es:'Ubicación no disponible — la foto se guardó sin ella.', 'es-MX':'Ubicación no disponible — la foto se guardó sin ella.', it:'Posizione non disponibile — foto salvata senza.', pt:'Localização indisponível — foto guardada sem ela.', ar:'الموقع غير متاح — حُفظت الصورة بدونه.', hi:'स्थान उपलब्ध नहीं — फ़ोटो बिना स्थान के सहेजी गई।', ja:'位置情報を取得できません — 位置なしで保存しました。', ky:'Жайгашкан жер жеткиликсиз — сүрөт ансыз сакталды.', 'zh-Hant':'無法取得位置——照片已在無位置下儲存。' },
  ev_meters: { bg:'Показания: {0} → {1} (разлика {2})', ru:'Показания: {0} → {1} (разница {2})', uk:'Показники: {0} → {1} (різниця {2})', en:'Readings: {0} → {1} (difference {2})', de:'Zählerstände: {0} → {1} (Differenz {2})', fr:'Relevés : {0} → {1} (différence {2})', es:'Lecturas: {0} → {1} (diferencia {2})', 'es-MX':'Lecturas: {0} → {1} (diferencia {2})', it:'Letture: {0} → {1} (differenza {2})', pt:'Leituras: {0} → {1} (diferença {2})', ar:'القراءات: {0} ← {1} (الفرق {2})', hi:'रीडिंग: {0} → {1} (अंतर {2})', ja:'メーター値：{0} → {1}（差 {2}）', ky:'Көрсөткүчтөр: {0} → {1} (айырма {2})', 'zh-Hant':'讀數：{0} → {1}（差額 {2}）' },
  ev_pdf_btn: { bg:'📄 PDF протокол', ru:'📄 PDF-протокол', uk:'📄 PDF-протокол', en:'📄 PDF report', de:'📄 PDF-Protokoll', fr:'📄 Rapport PDF', es:'📄 Informe PDF', 'es-MX':'📄 Informe PDF', it:'📄 Verbale PDF', pt:'📄 Relatório PDF', ar:'📄 تقرير PDF', hi:'📄 PDF रिपोर्ट', ja:'📄 PDF 報告書', ky:'📄 PDF протокол', 'zh-Hant':'📄 PDF 報告' },
  ev_del_case: { bg:'Изтрий делото', ru:'Удалить дело', uk:'Видалити справу', en:'Delete case', de:'Fall löschen', fr:'Supprimer le dossier', es:'Borrar caso', 'es-MX':'Borrar caso', it:'Elimina pratica', pt:'Apagar caso', ar:'حذف القضية', hi:'मामला हटाएँ', ja:'ケースを削除', ky:'Ишти өчүрүү', 'zh-Hant':'刪除案件' },
  ev_del_case_q: { bg:'Да изтрия ли делото и снимките му? Изтриването остава записано в дневника.', ru:'Удалить дело и его фото? Удаление останется записанным в журнале.', uk:'Видалити справу та її фото? Видалення залишиться записаним у журналі.', en:'Delete the case and its photos? The deletion stays recorded in the journal.', de:'Fall und Fotos löschen? Das Löschen bleibt im Protokoll vermerkt.', fr:'Supprimer le dossier et ses photos ? La suppression reste inscrite au journal.', es:'¿Borrar el caso y sus fotos? El borrado queda anotado en el registro.', 'es-MX':'¿Borrar el caso y sus fotos? El borrado queda anotado en el registro.', it:'Eliminare la pratica e le sue foto? L’eliminazione resta nel registro.', pt:'Apagar o caso e as fotos? A eliminação fica registada.', ar:'حذف القضية وصورها؟ يبقى الحذف مسجلًا في السجل.', hi:'मामला और उसकी फ़ोटो हटाएँ? हटाना लॉग में दर्ज रहेगा।', ja:'ケースと写真を削除しますか？削除はログに記録されます。', ky:'Ишти жана сүрөттөрүн өчүрөсүзбү? Өчүрүү журналда жазылып калат.', 'zh-Hant':'要刪除案件及其照片嗎？刪除動作會記錄在日誌中。' },
  ev_no_photos: { bg:'В това дело още няма снимки.', ru:'В этом деле ещё нет фото.', uk:'У цій справі ще немає фото.', en:'No photos in this case yet.', de:'In diesem Fall gibt es noch keine Fotos.', fr:'Pas encore de photos dans ce dossier.', es:'Aún no hay fotos en este caso.', 'es-MX':'Aún no hay fotos en este caso.', it:'Nessuna foto in questa pratica.', pt:'Ainda não há fotos neste caso.', ar:'لا توجد صور في هذه القضية بعد.', hi:'इस मामले में अभी कोई फ़ोटो नहीं।', ja:'このケースにはまだ写真がありません。', ky:'Бул иште азырынча сүрөт жок.', 'zh-Hant':'此案件尚無照片。' },
  ev_wm_preview: { bg:'Снимка с воден знак', ru:'Фото с водяным знаком', uk:'Фото з водяним знаком', en:'Photo with watermark', de:'Foto mit Wasserzeichen', fr:'Photo avec filigrane', es:'Foto con marca de agua', 'es-MX':'Foto con marca de agua', it:'Foto con filigrana', pt:'Foto com marca de água', ar:'صورة بعلامة مائية', hi:'वॉटरमार्क वाली फ़ोटो', ja:'透かし入り写真', ky:'Суу белгиси бар сүрөт', 'zh-Hant':'含浮水印的照片' },
  ev_sha: { bg:'SHA-256 отпечатък', ru:'Отпечаток SHA-256', uk:'Відбиток SHA-256', en:'SHA-256 fingerprint', de:'SHA-256-Fingerabdruck', fr:'Empreinte SHA-256', es:'Huella SHA-256', 'es-MX':'Huella SHA-256', it:'Impronta SHA-256', pt:'Impressão SHA-256', ar:'بصمة SHA-256', hi:'SHA-256 फ़िंगरप्रिंट', ja:'SHA-256 指紋', ky:'SHA-256 изи', 'zh-Hant':'SHA-256 指紋' },
  ev_added_at: { bg:'Записана', ru:'Записано', uk:'Записано', en:'Recorded', de:'Erfasst', fr:'Enregistrée', es:'Registrada', 'es-MX':'Registrada', it:'Registrata', pt:'Registada', ar:'سُجّلت', hi:'दर्ज', ja:'記録日時', ky:'Жазылган', 'zh-Hant':'記錄時間' },
  ev_taken: { bg:'Заснета (EXIF)', ru:'Снято (EXIF)', uk:'Знято (EXIF)', en:'Taken (EXIF)', de:'Aufgenommen (EXIF)', fr:'Prise (EXIF)', es:'Tomada (EXIF)', 'es-MX':'Tomada (EXIF)', it:'Scattata (EXIF)', pt:'Tirada (EXIF)', ar:'التُقطت (EXIF)', hi:'ली गई (EXIF)', ja:'撮影 (EXIF)', ky:'Тартылган (EXIF)', 'zh-Hant':'拍攝 (EXIF)' },
  ev_device: { bg:'Устройство', ru:'Устройство', uk:'Пристрій', en:'Device', de:'Gerät', fr:'Appareil', es:'Dispositivo', 'es-MX':'Dispositivo', it:'Dispositivo', pt:'Dispositivo', ar:'الجهاز', hi:'डिवाइस', ja:'機種', ky:'Түзмөк', 'zh-Hant':'裝置' },
  ev_location: { bg:'Място', ru:'Место', uk:'Місце', en:'Location', de:'Ort', fr:'Lieu', es:'Ubicación', 'es-MX':'Ubicación', it:'Posizione', pt:'Local', ar:'الموقع', hi:'स्थान', ja:'場所', ky:'Жер', 'zh-Hant':'位置' },
  ev_size: { bg:'Размер', ru:'Размер', uk:'Розмір', en:'Size', de:'Größe', fr:'Taille', es:'Tamaño', 'es-MX':'Tamaño', it:'Dimensione', pt:'Tamanho', ar:'الحجم', hi:'आकार', ja:'サイズ', ky:'Өлчөм', 'zh-Hant':'大小' },
  ev_entry: { bg:'Запис в дневника', ru:'Запись в журнале', uk:'Запис у журналі', en:'Journal entry', de:'Protokolleintrag', fr:'Entrée du journal', es:'Entrada del registro', 'es-MX':'Entrada del registro', it:'Voce del registro', pt:'Entrada do registo', ar:'إدخال السجل', hi:'लॉग प्रविष्टि', ja:'ログ番号', ky:'Журналдагы жазуу', 'zh-Hant':'日誌紀錄' },
  ev_save_wm: { bg:'Запази с воден знак', ru:'Сохранить с водяным знаком', uk:'Зберегти з водяним знаком', en:'Save with watermark', de:'Mit Wasserzeichen speichern', fr:'Enregistrer avec filigrane', es:'Guardar con marca de agua', 'es-MX':'Guardar con marca de agua', it:'Salva con filigrana', pt:'Guardar com marca de água', ar:'حفظ بالعلامة المائية', hi:'वॉटरमार्क के साथ सहेजें', ja:'透かし付きで保存', ky:'Суу белгиси менен сактоо', 'zh-Hant':'含浮水印儲存' },
  ev_save_orig: { bg:'Запази оригинала (същия отпечатък)', ru:'Сохранить оригинал (тот же отпечаток)', uk:'Зберегти оригінал (той самий відбиток)', en:'Save original (same fingerprint)', de:'Original speichern (gleicher Fingerabdruck)', fr:'Enregistrer l’original (même empreinte)', es:'Guardar original (misma huella)', 'es-MX':'Guardar original (misma huella)', it:'Salva l’originale (stessa impronta)', pt:'Guardar original (mesma impressão)', ar:'حفظ الأصل (البصمة نفسها)', hi:'मूल सहेजें (वही फ़िंगरप्रिंट)', ja:'原本を保存（同じ指紋）', ky:'Түп нускасын сактоо (ошол эле из)', 'zh-Hant':'儲存原檔（相同指紋）' },
  ev_del_photo: { bg:'Изтрий снимката', ru:'Удалить фото', uk:'Видалити фото', en:'Delete photo', de:'Foto löschen', fr:'Supprimer la photo', es:'Borrar foto', 'es-MX':'Borrar foto', it:'Elimina foto', pt:'Apagar foto', ar:'حذف الصورة', hi:'फ़ोटो हटाएँ', ja:'写真を削除', ky:'Сүрөттү өчүрүү', 'zh-Hant':'刪除照片' },
  ev_del_photo_q: { bg:'Да изтрия ли снимката? Изтриването се записва в дневника.', ru:'Удалить фото? Удаление записывается в журнал.', uk:'Видалити фото? Видалення записується в журнал.', en:'Delete this photo? The deletion is recorded in the journal.', de:'Foto löschen? Das Löschen wird protokolliert.', fr:'Supprimer la photo ? La suppression est inscrite au journal.', es:'¿Borrar la foto? El borrado se anota en el registro.', 'es-MX':'¿Borrar la foto? El borrado se anota en el registro.', it:'Eliminare la foto? L’eliminazione viene registrata.', pt:'Apagar a foto? A eliminação é registada.', ar:'حذف الصورة؟ يُسجَّل الحذف في السجل.', hi:'फ़ोटो हटाएँ? हटाना लॉग में दर्ज होगा।', ja:'写真を削除しますか？削除はログに記録されます。', ky:'Сүрөттү өчүрөсүзбү? Өчүрүү журналга жазылат.', 'zh-Hant':'要刪除照片嗎？刪除動作會記錄在日誌中。' },
  ev_no_loc: { bg:'не е записано', ru:'не записано', uk:'не записано', en:'not recorded', de:'nicht erfasst', fr:'non enregistré', es:'no registrada', 'es-MX':'no registrada', it:'non registrata', pt:'não registado', ar:'غير مسجل', hi:'दर्ज नहीं', ja:'記録なし', ky:'жазылган эмес', 'zh-Hant':'未記錄' },
  ev_saved_fp: { bg:'Запазено. Отпечатък на записания файл: {0}', ru:'Сохранено. Отпечаток сохранённого файла: {0}', uk:'Збережено. Відбиток збереженого файлу: {0}', en:'Saved. Fingerprint of the saved file: {0}', de:'Gespeichert. Fingerabdruck der Datei: {0}', fr:'Enregistré. Empreinte du fichier : {0}', es:'Guardado. Huella del archivo: {0}', 'es-MX':'Guardado. Huella del archivo: {0}', it:'Salvato. Impronta del file: {0}', pt:'Guardado. Impressão do ficheiro: {0}', ar:'تم الحفظ. بصمة الملف المحفوظ: {0}', hi:'सहेजा गया। फ़ाइल का फ़िंगरप्रिंट: {0}', ja:'保存しました。ファイルの指紋：{0}', ky:'Сакталды. Файлдын изи: {0}', 'zh-Hant':'已儲存。檔案指紋：{0}' },
  ev_wm_rec: { bg:'Записано', ru:'Записано', uk:'Записано', en:'Recorded', de:'Erfasst', fr:'Enregistré', es:'Registrado', 'es-MX':'Registrado', it:'Registrato', pt:'Registado', ar:'سُجّل', hi:'दर्ज', ja:'記録', ky:'Жазылды', 'zh-Hant':'記錄' },
  ev_wm_entry: { bg:'Дневник №{0}', ru:'Журнал №{0}', uk:'Журнал №{0}', en:'Journal #{0}', de:'Protokoll Nr. {0}', fr:'Journal n° {0}', es:'Registro n.º {0}', 'es-MX':'Registro n.º {0}', it:'Registro n. {0}', pt:'Registo n.º {0}', ar:'السجل رقم {0}', hi:'लॉग #{0}', ja:'ログ No.{0}', ky:'Журнал №{0}', 'zh-Hant':'日誌 #{0}' },
  ev_err_read: { bg:'Файлът не може да се прочете.', ru:'Не удалось прочитать файл.', uk:'Не вдалося прочитати файл.', en:'The file could not be read.', de:'Die Datei konnte nicht gelesen werden.', fr:'Impossible de lire le fichier.', es:'No se pudo leer el archivo.', 'es-MX':'No se pudo leer el archivo.', it:'Impossibile leggere il file.', pt:'Não foi possível ler o ficheiro.', ar:'تعذّرت قراءة الملف.', hi:'फ़ाइल पढ़ी नहीं जा सकी।', ja:'ファイルを読み込めませんでした。', ky:'Файлды окуу мүмкүн болбоду.', 'zh-Hant':'無法讀取檔案。' },
  ev_loading_s: { bg:'Подготвям примерните снимки…', ru:'Готовлю примеры фото…', uk:'Готую приклади фото…', en:'Preparing the sample photos…', de:'Beispielfotos werden vorbereitet…', fr:'Préparation des photos d’exemple…', es:'Preparando las fotos de ejemplo…', 'es-MX':'Preparando las fotos de ejemplo…', it:'Preparo le foto di esempio…', pt:'A preparar as fotos de exemplo…', ar:'جارٍ تجهيز الصور التجريبية…', hi:'उदाहरण फ़ोटो तैयार हो रही हैं…', ja:'サンプル写真を準備中…', ky:'Үлгү сүрөттөр даярдалууда…', 'zh-Hant':'正在準備範例照片…' },
  ev_v_intro: { bg:'Избери снимка — апът изчислява нейния SHA-256 отпечатък и го търси в дневника. Ако не е идентична, сравни я с оригинала и виж къде е променяна.', ru:'Выберите фото — приложение вычислит его отпечаток SHA-256 и найдёт его в журнале. Если оно не идентично, сравните с оригиналом и посмотрите, где оно изменено.', uk:'Виберіть фото — застосунок обчислить його відбиток SHA-256 і шукатиме в журналі. Якщо воно не ідентичне, порівняйте з оригіналом і подивіться, де його змінено.', en:'Choose a photo — the app computes its SHA-256 fingerprint and looks it up in the journal. If it is not identical, compare it with the original and see where it was changed.', de:'Wähle ein Foto — die App berechnet seinen SHA-256-Fingerabdruck und sucht ihn im Protokoll. Ist es nicht identisch, vergleiche es mit dem Original und sieh, wo es verändert wurde.', fr:'Choisissez une photo — l’appli calcule son empreinte SHA-256 et la cherche dans le journal. Si elle n’est pas identique, comparez-la à l’original pour voir où elle a été modifiée.', es:'Elige una foto: la app calcula su huella SHA-256 y la busca en el registro. Si no es idéntica, compárala con el original y mira dónde se modificó.', 'es-MX':'Elige una foto: la app calcula su huella SHA-256 y la busca en el registro. Si no es idéntica, compárala con el original y mira dónde se modificó.', it:'Scegli una foto: l’app calcola la sua impronta SHA-256 e la cerca nel registro. Se non è identica, confrontala con l’originale e guarda dove è stata modificata.', pt:'Escolhe uma foto: a app calcula a impressão SHA-256 e procura-a no registo. Se não for idêntica, compara-a com o original e vê onde foi alterada.', ar:'اختر صورة — يحسب التطبيق بصمة SHA-256 لها ويبحث عنها في السجل. إن لم تكن مطابقة، قارنها بالأصل وشاهد أين عُدّلت.', hi:'फ़ोटो चुनें — ऐप उसका SHA-256 फ़िंगरप्रिंट निकालकर लॉग में खोजता है। अगर वह हूबहू नहीं है, तो मूल से तुलना करके देखें कि कहाँ बदली गई।', ja:'写真を選ぶと SHA-256 指紋を計算してログ内を検索します。一致しない場合は原本と比較し、どこが変更されたかを確認できます。', ky:'Сүрөт тандаңыз — колдонмо анын SHA-256 изин эсептеп, журналдан издейт. Эгер бирдей болбосо, түп нускасы менен салыштырып, кайсы жери өзгөргөнүн көрүңүз.', 'zh-Hant':'選擇照片——App 會計算其 SHA-256 指紋並在日誌中比對。若不相同，可與原檔比較，查看哪裡被修改。' },
  ev_v_pick: { bg:'Избери снимка за проверка', ru:'Выбрать фото для проверки', uk:'Вибрати фото для перевірки', en:'Choose a photo to verify', de:'Foto zum Prüfen wählen', fr:'Choisir une photo à vérifier', es:'Elegir foto para verificar', 'es-MX':'Elegir foto para verificar', it:'Scegli foto da verificare', pt:'Escolher foto para verificar', ar:'اختر صورة للتحقق', hi:'जाँच के लिए फ़ोटो चुनें', ja:'検証する写真を選択', ky:'Текшерүү үчүн сүрөт тандаңыз', 'zh-Hant':'選擇要驗證的照片' },
  ev_v_try: { bg:'Пробвай с пример (ретуширано копие на примерна снимка)', ru:'Попробовать на примере (отретушированная копия)', uk:'Спробувати на прикладі (відретушована копія)', en:'Try with an example (retouched copy of a sample photo)', de:'Mit Beispiel testen (retuschierte Kopie eines Beispielfotos)', fr:'Essayer avec un exemple (copie retouchée d’une photo d’exemple)', es:'Probar con un ejemplo (copia retocada de una foto de ejemplo)', 'es-MX':'Probar con un ejemplo (copia retocada de una foto de ejemplo)', it:'Prova con un esempio (copia ritoccata di una foto di esempio)', pt:'Experimentar com exemplo (cópia retocada de uma foto de exemplo)', ar:'جرّب بمثال (نسخة معدَّلة من صورة تجريبية)', hi:'उदाहरण से आज़माएँ (उदाहरण फ़ोटो की रीटच की गई कॉपी)', ja:'例で試す（サンプル写真のレタッチ版）', ky:'Мисал менен сынап көрүү (үлгү сүрөттүн ретуштолгон көчүрмөсү)', 'zh-Hant':'用範例試試（範例照片的修圖副本）' },
  ev_v_hash: { bg:'Отпечатък на проверявания файл', ru:'Отпечаток проверяемого файла', uk:'Відбиток файлу, що перевіряється', en:'Fingerprint of the checked file', de:'Fingerabdruck der geprüften Datei', fr:'Empreinte du fichier vérifié', es:'Huella del archivo verificado', 'es-MX':'Huella del archivo verificado', it:'Impronta del file verificato', pt:'Impressão do ficheiro verificado', ar:'بصمة الملف المفحوص', hi:'जाँची गई फ़ाइल का फ़िंगरप्रिंट', ja:'検証ファイルの指紋', ky:'Текшерилген файлдын изи', 'zh-Hant':'受檢檔案的指紋' },
  ev_v_match: { bg:'НЕПРОМЕНЕНА ✓ Идентична със снимка „{0}“ от дело „{1}“, записана на {2} (дневник №{3}).', ru:'НЕ ИЗМЕНЕНО ✓ Идентично фото «{0}» из дела «{1}», записанному {2} (журнал №{3}).', uk:'НЕ ЗМІНЕНО ✓ Ідентичне фото «{0}» зі справи «{1}», записаному {2} (журнал №{3}).', en:'UNCHANGED ✓ Identical to photo “{0}” in case “{1}”, recorded {2} (journal #{3}).', de:'UNVERÄNDERT ✓ Identisch mit Foto „{0}“ im Fall „{1}“, erfasst am {2} (Protokoll Nr. {3}).', fr:'NON MODIFIÉE ✓ Identique à la photo « {0} » du dossier « {1} », enregistrée le {2} (journal n° {3}).', es:'SIN CAMBIOS ✓ Idéntica a la foto «{0}» del caso «{1}», registrada el {2} (registro n.º {3}).', 'es-MX':'SIN CAMBIOS ✓ Idéntica a la foto «{0}» del caso «{1}», registrada el {2} (registro n.º {3}).', it:'NON MODIFICATA ✓ Identica alla foto «{0}» della pratica «{1}», registrata il {2} (registro n. {3}).', pt:'SEM ALTERAÇÕES ✓ Idêntica à foto «{0}» do caso «{1}», registada em {2} (registo n.º {3}).', ar:'غير معدَّلة ✓ مطابقة للصورة «{0}» في القضية «{1}»، المسجلة في {2} (السجل رقم {3}).', hi:'अपरिवर्तित ✓ मामले “{1}” की फ़ोटो “{0}” से हूबहू मेल, दर्ज {2} (लॉग #{3})।', ja:'変更なし ✓ ケース「{1}」の写真「{0}」と完全一致（{2} 記録、ログ No.{3}）。', ky:'ӨЗГӨРБӨГӨН ✓ «{1}» ишиндеги «{0}» сүрөтү менен бирдей, {2} жазылган (журнал №{3}).', 'zh-Hant':'未修改 ✓ 與案件「{1}」中的照片「{0}」完全相同，記錄於 {2}（日誌 #{3}）。' },
  ev_v_match_del: { bg:'Идентична със снимка, ИЗТРИТА от дело „{0}“ на {1} — дневникът пази отпечатъка ѝ.', ru:'Идентично фото, УДАЛЁННОМУ из дела «{0}» {1} — журнал хранит его отпечаток.', uk:'Ідентичне фото, ВИДАЛЕНОМУ зі справи «{0}» {1} — журнал зберігає його відбиток.', en:'Identical to a photo DELETED from case “{0}” on {1} — the journal still keeps its fingerprint.', de:'Identisch mit einem Foto, das am {1} aus dem Fall „{0}“ GELÖSCHT wurde — das Protokoll bewahrt den Fingerabdruck.', fr:'Identique à une photo SUPPRIMÉE du dossier « {0} » le {1} — le journal garde son empreinte.', es:'Idéntica a una foto BORRADA del caso «{0}» el {1}; el registro conserva su huella.', 'es-MX':'Idéntica a una foto BORRADA del caso «{0}» el {1}; el registro conserva su huella.', it:'Identica a una foto ELIMINATA dalla pratica «{0}» il {1}: il registro ne conserva l’impronta.', pt:'Idêntica a uma foto APAGADA do caso «{0}» em {1}; o registo guarda a impressão.', ar:'مطابقة لصورة حُذفت من القضية «{0}» في {1} — لا يزال السجل يحتفظ ببصمتها.', hi:'मामले “{0}” से {1} को हटाई गई फ़ोटो से मेल — लॉग में उसका फ़िंगरप्रिंट अब भी है।', ja:'{1} にケース「{0}」から削除された写真と一致 — ログに指紋が残っています。', ky:'«{0}» ишинен {1} ӨЧҮРҮЛГӨН сүрөт менен бирдей — журнал анын изин сактайт.', 'zh-Hant':'與 {1} 從案件「{0}」刪除的照片相同——日誌仍保留其指紋。' },
  ev_v_nomatch: { bg:'Няма идентичен файл в дневника — този файл се различава от всички записани снимки.', ru:'В журнале нет идентичного файла — этот файл отличается от всех записанных фото.', uk:'У журналі немає ідентичного файлу — цей файл відрізняється від усіх записаних фото.', en:'No identical file in the journal — this file differs from every recorded photo.', de:'Keine identische Datei im Protokoll — diese Datei unterscheidet sich von allen erfassten Fotos.', fr:'Aucun fichier identique dans le journal — ce fichier diffère de toutes les photos enregistrées.', es:'No hay un archivo idéntico en el registro: este archivo difiere de todas las fotos registradas.', 'es-MX':'No hay un archivo idéntico en el registro: este archivo difiere de todas las fotos registradas.', it:'Nessun file identico nel registro: questo file è diverso da tutte le foto registrate.', pt:'Nenhum ficheiro idêntico no registo: este ficheiro difere de todas as fotos registadas.', ar:'لا يوجد ملف مطابق في السجل — هذا الملف يختلف عن كل الصور المسجلة.', hi:'लॉग में कोई हूबहू फ़ाइल नहीं — यह फ़ाइल हर दर्ज फ़ोटो से अलग है।', ja:'ログに一致するファイルはありません — 記録済みのどの写真とも異なります。', ky:'Журналда бирдей файл жок — бул файл жазылган бардык сүрөттөрдөн айырмаланат.', 'zh-Hant':'日誌中沒有相同檔案——此檔案與所有已記錄的照片都不同。' },
  ev_v_cmp_with: { bg:'Сравни с оригинал', ru:'Сравнить с оригиналом', uk:'Порівняти з оригіналом', en:'Compare with original', de:'Mit Original vergleichen', fr:'Comparer à l’original', es:'Comparar con el original', 'es-MX':'Comparar con el original', it:'Confronta con l’originale', pt:'Comparar com o original', ar:'قارن بالأصل', hi:'मूल से तुलना करें', ja:'原本と比較', ky:'Түп нускасы менен салыштыруу', 'zh-Hant':'與原檔比較' },
  ev_v_cmp_btn: { bg:'Покажи разликите', ru:'Показать различия', uk:'Показати відмінності', en:'Show differences', de:'Unterschiede zeigen', fr:'Montrer les différences', es:'Mostrar diferencias', 'es-MX':'Mostrar diferencias', it:'Mostra differenze', pt:'Mostrar diferenças', ar:'أظهر الفروق', hi:'अंतर दिखाएँ', ja:'差分を表示', ky:'Айырмачылыктарды көрсөтүү', 'zh-Hant':'顯示差異' },
  ev_v_diff_pct: { bg:'Променени: {0}% от площта на снимката', ru:'Изменено: {0}% площади снимка', uk:'Змінено: {0}% площі знімка', en:'Changed: {0}% of the image area', de:'Verändert: {0} % der Bildfläche', fr:'Modifié : {0} % de la surface', es:'Modificado: {0} % del área de la imagen', 'es-MX':'Modificado: {0} % del área de la imagen', it:'Modificato: {0}% dell’area', pt:'Alterado: {0}% da área da imagem', ar:'تغيَّر: {0}% من مساحة الصورة', hi:'बदला गया: छवि क्षेत्र का {0}%', ja:'変更：画像面積の {0}%', ky:'Өзгөргөнү: сүрөт аянтынын {0}%', 'zh-Hant':'已變更：影像面積的 {0}%' },
  ev_v_local: { bg:'ЛОКАЛНА ПРОМЯНА — в маркираната зона нещо е добавено, премахнато или ретуширано.', ru:'ЛОКАЛЬНОЕ ИЗМЕНЕНИЕ — в отмеченной зоне что-то добавлено, удалено или отретушировано.', uk:'ЛОКАЛЬНА ЗМІНА — у позначеній зоні щось додано, прибрано або відретушовано.', en:'LOCAL CHANGE — something was added, removed or retouched in the marked area.', de:'LOKALE ÄNDERUNG — im markierten Bereich wurde etwas hinzugefügt, entfernt oder retuschiert.', fr:'MODIFICATION LOCALE — quelque chose a été ajouté, retiré ou retouché dans la zone marquée.', es:'CAMBIO LOCAL: en la zona marcada se añadió, quitó o retocó algo.', 'es-MX':'CAMBIO LOCAL: en la zona marcada se agregó, quitó o retocó algo.', it:'MODIFICA LOCALE: nella zona evidenziata è stato aggiunto, rimosso o ritoccato qualcosa.', pt:'ALTERAÇÃO LOCAL: na zona marcada algo foi acrescentado, removido ou retocado.', ar:'تغيير موضعي — أُضيف شيء أو أُزيل أو عُدّل في المنطقة المحددة.', hi:'स्थानीय बदलाव — चिह्नित क्षेत्र में कुछ जोड़ा, हटाया या रीटच किया गया।', ja:'局所的な変更 — 枠内で何かが追加・削除・レタッチされています。', ky:'ЖЕРГИЛИКТҮҮ ӨЗГӨРТҮҮ — белгиленген аймакта бир нерсе кошулган, алынган же ретуштолгон.', 'zh-Hant':'局部變更——標示區域內有東西被新增、移除或修圖。' },
  ev_v_global: { bg:'ЦЯЛОСТНА ПРОМЯНА — филтър, изрязване или друга снимка.', ru:'ИЗМЕНЕНИЕ ВСЕГО КАДРА — фильтр, обрезка или другое фото.', uk:'ЗМІНА ВСЬОГО КАДРУ — фільтр, обрізання або інше фото.', en:'WHOLE-IMAGE CHANGE — a filter, crop or a different photo.', de:'ÄNDERUNG DES GANZEN BILDES — Filter, Zuschnitt oder ein anderes Foto.', fr:'MODIFICATION GLOBALE — filtre, recadrage ou autre photo.', es:'CAMBIO GLOBAL: filtro, recorte u otra foto.', 'es-MX':'CAMBIO GLOBAL: filtro, recorte u otra foto.', it:'MODIFICA GLOBALE: filtro, ritaglio o un’altra foto.', pt:'ALTERAÇÃO GLOBAL: filtro, recorte ou outra foto.', ar:'تغيير شامل — مرشح أو قص أو صورة مختلفة.', hi:'पूरी छवि में बदलाव — फ़िल्टर, क्रॉप या कोई दूसरी फ़ोटो।', ja:'画像全体の変更 — フィルター、切り抜き、または別の写真です。', ky:'БҮТҮН СҮРӨТ ӨЗГӨРГӨН — фильтр, кесүү же башка сүрөт.', 'zh-Hant':'整體變更——套用濾鏡、裁切或是另一張照片。' },
  ev_v_same: { bg:'Визуално еднакви — файлът е пресъхранен или компресиран, съдържанието не е променено.', ru:'Визуально одинаковы — файл пересохранён или сжат, содержимое не изменено.', uk:'Візуально однакові — файл перезбережено або стиснуто, вміст не змінено.', en:'Visually identical — the file was re-saved or compressed; the content is not changed.', de:'Optisch gleich — die Datei wurde neu gespeichert oder komprimiert, der Inhalt ist unverändert.', fr:'Visuellement identiques — fichier réenregistré ou compressé, contenu inchangé.', es:'Visualmente iguales: el archivo se volvió a guardar o comprimir; el contenido no cambió.', 'es-MX':'Visualmente iguales: el archivo se volvió a guardar o comprimir; el contenido no cambió.', it:'Visivamente uguali: il file è stato risalvato o compresso, il contenuto non è cambiato.', pt:'Visualmente iguais: o ficheiro foi regravado ou comprimido; o conteúdo não mudou.', ar:'متطابقتان بصريًا — أُعيد حفظ الملف أو ضُغط، والمحتوى لم يتغير.', hi:'दिखने में एक जैसी — फ़ाइल दोबारा सहेजी या कंप्रेस की गई, सामग्री नहीं बदली।', ja:'見た目は同一 — 再保存または圧縮されただけで内容は変わっていません。', ky:'Көрүнүшү бирдей — файл кайра сакталган же кысылган, мазмуну өзгөргөн эмес.', 'zh-Hant':'視覺上相同——檔案只是重新儲存或壓縮，內容未改變。' },
  ev_v_sizes: { bg:'Оригинал {0} · проверяван {1}', ru:'Оригинал {0} · проверяемый {1}', uk:'Оригінал {0} · перевірюваний {1}', en:'Original {0} · checked {1}', de:'Original {0} · geprüft {1}', fr:'Original {0} · vérifié {1}', es:'Original {0} · verificado {1}', 'es-MX':'Original {0} · verificado {1}', it:'Originale {0} · verificato {1}', pt:'Original {0} · verificado {1}', ar:'الأصل {0} · المفحوص {1}', hi:'मूल {0} · जाँची गई {1}', ja:'原本 {0} · 検証 {1}', ky:'Түп нуска {0} · текшерилген {1}', 'zh-Hant':'原檔 {0} · 受檢 {1}' },
  ev_v_legend: { bg:'Червено = променено, жълта рамка = зона на промяната.', ru:'Красное = изменено, жёлтая рамка = зона изменения.', uk:'Червоне = змінено, жовта рамка = зона зміни.', en:'Red = changed, yellow frame = area of the change.', de:'Rot = verändert, gelber Rahmen = Bereich der Änderung.', fr:'Rouge = modifié, cadre jaune = zone de modification.', es:'Rojo = modificado, marco amarillo = zona del cambio.', 'es-MX':'Rojo = modificado, marco amarillo = zona del cambio.', it:'Rosso = modificato, cornice gialla = zona della modifica.', pt:'Vermelho = alterado, moldura amarela = zona da alteração.', ar:'الأحمر = معدَّل، الإطار الأصفر = منطقة التغيير.', hi:'लाल = बदला गया, पीला फ़्रेम = बदलाव का क्षेत्र।', ja:'赤＝変更箇所、黄色の枠＝変更範囲。', ky:'Кызыл = өзгөргөн, сары алкак = өзгөрүү аймагы.', 'zh-Hant':'紅色＝已變更，黃框＝變更範圍。' },
  ev_v_try_name: { bg:'ретуширано копие (пример)', ru:'отретушированная копия (пример)', uk:'відретушована копія (приклад)', en:'retouched copy (example)', de:'retuschierte Kopie (Beispiel)', fr:'copie retouchée (exemple)', es:'copia retocada (ejemplo)', 'es-MX':'copia retocada (ejemplo)', it:'copia ritoccata (esempio)', pt:'cópia retocada (exemplo)', ar:'نسخة معدَّلة (مثال)', hi:'रीटच की गई कॉपी (उदाहरण)', ja:'レタッチ版（例）', ky:'ретуштолгон көчүрмө (мисал)', 'zh-Hant':'修圖副本（範例）' },
  ev_l_intro: { bg:'Всяко действие получава запис, който съдържа отпечатъка на предишния. Ако някой промени или изтрие запис или подмени снимка, веригата се прекъсва и това се вижда тук.', ru:'Каждое действие получает запись с отпечатком предыдущей. Если кто-то изменит или удалит запись или подменит фото, цепочка рвётся, и это видно здесь.', uk:'Кожна дія отримує запис із відбитком попереднього. Якщо хтось змінить чи видалить запис або підмінить фото, ланцюжок рветься, і це видно тут.', en:'Every action gets an entry that contains the fingerprint of the previous one. If anyone edits or deletes an entry or swaps a photo, the chain breaks and it shows here.', de:'Jede Aktion erhält einen Eintrag mit dem Fingerabdruck des vorherigen. Ändert oder löscht jemand einen Eintrag oder tauscht ein Foto aus, reißt die Kette — das siehst du hier.', fr:'Chaque action crée une entrée contenant l’empreinte de la précédente. Si quelqu’un modifie ou supprime une entrée ou remplace une photo, la chaîne se rompt et cela apparaît ici.', es:'Cada acción crea una entrada que contiene la huella de la anterior. Si alguien edita o borra una entrada o cambia una foto, la cadena se rompe y se ve aquí.', 'es-MX':'Cada acción crea una entrada que contiene la huella de la anterior. Si alguien edita o borra una entrada o cambia una foto, la cadena se rompe y se ve aquí.', it:'Ogni azione crea una voce che contiene l’impronta della precedente. Se qualcuno modifica o elimina una voce o sostituisce una foto, la catena si spezza e lo vedi qui.', pt:'Cada ação cria uma entrada com a impressão da anterior. Se alguém editar ou apagar uma entrada ou trocar uma foto, a cadeia quebra-se e isso aparece aqui.', ar:'كل إجراء يُنشئ إدخالًا يحمل بصمة الإدخال السابق. إذا عدّل أحد إدخالًا أو حذفه أو استبدل صورة، تنقطع السلسلة ويظهر ذلك هنا.', hi:'हर कार्रवाई की प्रविष्टि में पिछली प्रविष्टि का फ़िंगरप्रिंट होता है। अगर कोई प्रविष्टि बदले, हटाए या फ़ोटो बदल दे, तो कड़ी टूट जाती है और यहाँ दिखता है।', ja:'各操作の記録には直前の記録の指紋が含まれます。記録の編集・削除や写真の差し替えがあると連鎖が切れ、ここに表示されます。', ky:'Ар бир аракет мурунку жазуунун изин камтыган жазуу алат. Кимдир бирөө жазууну өзгөртсө, өчүрсө же сүрөттү алмаштырса, чынжыр үзүлүп, бул жерде көрүнөт.', 'zh-Hant':'每個動作都會產生一筆包含前一筆指紋的紀錄。若有人修改或刪除紀錄、或替換照片，鏈就會斷裂並顯示在這裡。' },
  ev_l_ok: { bg:'Дневникът е ненарушен: {0} записа, всички {1} снимки съвпадат със своите отпечатъци.', ru:'Журнал не нарушен: {0} записей, все {1} фото совпадают со своими отпечатками.', uk:'Журнал не порушено: {0} записів, усі {1} фото збігаються зі своїми відбитками.', en:'Journal intact: {0} entries; all {1} photos match their fingerprints.', de:'Protokoll unversehrt: {0} Einträge, alle {1} Fotos stimmen mit ihren Fingerabdrücken überein.', fr:'Journal intact : {0} entrées, les {1} photos correspondent à leurs empreintes.', es:'Registro íntegro: {0} entradas; las {1} fotos coinciden con sus huellas.', 'es-MX':'Registro íntegro: {0} entradas; las {1} fotos coinciden con sus huellas.', it:'Registro integro: {0} voci; tutte le {1} foto corrispondono alle impronte.', pt:'Registo íntegro: {0} entradas; as {1} fotos correspondem às impressões.', ar:'السجل سليم: {0} إدخالات، وكل الصور ({1}) تطابق بصماتها.', hi:'लॉग अक्षुण्ण: {0} प्रविष्टियाँ, सभी {1} फ़ोटो अपने फ़िंगरप्रिंट से मेल खाती हैं।', ja:'ログは改ざんなし：{0} 件、写真 {1} 枚すべてが指紋と一致。', ky:'Журнал бузулган эмес: {0} жазуу, бардык {1} сүрөт өз изине дал келет.', 'zh-Hant':'日誌完整：{0} 筆紀錄，{1} 張照片皆與指紋相符。' },
  ev_l_bad_entry: { bg:'Дневникът е НАРУШЕН при запис №{0} — бил е променян или премахнат.', ru:'Журнал НАРУШЕН на записи №{0} — её изменили или удалили.', uk:'Журнал ПОРУШЕНО на записі №{0} — його змінили або видалили.', en:'Journal BROKEN at entry #{0} — it was edited or removed.', de:'Protokoll VERLETZT bei Eintrag Nr. {0} — er wurde geändert oder entfernt.', fr:'Journal ROMPU à l’entrée n° {0} — elle a été modifiée ou supprimée.', es:'Registro ROTO en la entrada n.º {0}: se editó o eliminó.', 'es-MX':'Registro ROTO en la entrada n.º {0}: se editó o eliminó.', it:'Registro VIOLATO alla voce n. {0}: è stata modificata o rimossa.', pt:'Registo QUEBRADO na entrada n.º {0}: foi editada ou removida.', ar:'السجل مكسور عند الإدخال رقم {0} — عُدِّل أو حُذف.', hi:'लॉग प्रविष्टि #{0} पर टूटा — इसे बदला या हटाया गया।', ja:'ログ No.{0} で破損 — 編集または削除されています。', ky:'Журнал №{0} жазууда БУЗУЛГАН — ал өзгөртүлгөн же өчүрүлгөн.', 'zh-Hant':'日誌在第 {0} 筆處斷裂——該紀錄被修改或移除。' },
  ev_l_bad_photo: { bg:'Снимка „{0}“ вече не съвпада със своя отпечатък — файлът е подменен.', ru:'Фото «{0}» больше не совпадает со своим отпечатком — файл подменён.', uk:'Фото «{0}» більше не збігається зі своїм відбитком — файл підмінено.', en:'Photo “{0}” no longer matches its fingerprint — the file was swapped.', de:'Foto „{0}“ stimmt nicht mehr mit seinem Fingerabdruck überein — die Datei wurde ausgetauscht.', fr:'La photo « {0} » ne correspond plus à son empreinte — le fichier a été remplacé.', es:'La foto «{0}» ya no coincide con su huella: el archivo fue sustituido.', 'es-MX':'La foto «{0}» ya no coincide con su huella: el archivo fue sustituido.', it:'La foto «{0}» non corrisponde più alla sua impronta: il file è stato sostituito.', pt:'A foto «{0}» já não corresponde à impressão: o ficheiro foi trocado.', ar:'الصورة «{0}» لم تعد تطابق بصمتها — استُبدل الملف.', hi:'फ़ोटो “{0}” अब अपने फ़िंगरप्रिंट से मेल नहीं खाती — फ़ाइल बदली गई।', ja:'写真「{0}」が指紋と一致しません — ファイルが差し替えられています。', ky:'«{0}» сүрөтү изине дал келбей калды — файл алмаштырылган.', 'zh-Hant':'照片「{0}」已與指紋不符——檔案已被替換。' },
  ev_l_recheck: { bg:'Провери отново', ru:'Проверить снова', uk:'Перевірити знову', en:'Check again', de:'Erneut prüfen', fr:'Vérifier à nouveau', es:'Comprobar de nuevo', 'es-MX':'Comprobar de nuevo', it:'Controlla di nuovo', pt:'Verificar de novo', ar:'تحقق مجددًا', hi:'फिर से जाँचें', ja:'再検証', ky:'Кайра текшерүү', 'zh-Hant':'重新檢查' },
  ev_l_export: { bg:'Изнеси дневника (JSON)', ru:'Экспорт журнала (JSON)', uk:'Експорт журналу (JSON)', en:'Export journal (JSON)', de:'Protokoll exportieren (JSON)', fr:'Exporter le journal (JSON)', es:'Exportar registro (JSON)', 'es-MX':'Exportar registro (JSON)', it:'Esporta registro (JSON)', pt:'Exportar registo (JSON)', ar:'تصدير السجل (JSON)', hi:'लॉग निर्यात करें (JSON)', ja:'ログを書き出す (JSON)', ky:'Журналды экспорттоо (JSON)', 'zh-Hant':'匯出日誌 (JSON)' },
  ev_a_case: { bg:'Създадено дело', ru:'Создано дело', uk:'Створено справу', en:'Case created', de:'Fall angelegt', fr:'Dossier créé', es:'Caso creado', 'es-MX':'Caso creado', it:'Pratica creata', pt:'Caso criado', ar:'أُنشئت قضية', hi:'मामला बनाया', ja:'ケース作成', ky:'Иш түзүлдү', 'zh-Hant':'建立案件' },
  ev_a_add: { bg:'Добавена снимка', ru:'Добавлено фото', uk:'Додано фото', en:'Photo added', de:'Foto hinzugefügt', fr:'Photo ajoutée', es:'Foto añadida', 'es-MX':'Foto agregada', it:'Foto aggiunta', pt:'Foto adicionada', ar:'أُضيفت صورة', hi:'फ़ोटो जोड़ी', ja:'写真追加', ky:'Сүрөт кошулду', 'zh-Hant':'新增照片' },
  ev_a_note: { bg:'Променена бележка', ru:'Изменена заметка', uk:'Змінено нотатку', en:'Note changed', de:'Notiz geändert', fr:'Note modifiée', es:'Nota cambiada', 'es-MX':'Nota cambiada', it:'Nota modificata', pt:'Nota alterada', ar:'تغيّرت الملاحظة', hi:'नोट बदला', ja:'メモ変更', ky:'Эскертүү өзгөрдү', 'zh-Hant':'備註已變更' },
  ev_a_del: { bg:'Изтрита снимка', ru:'Удалено фото', uk:'Видалено фото', en:'Photo deleted', de:'Foto gelöscht', fr:'Photo supprimée', es:'Foto borrada', 'es-MX':'Foto borrada', it:'Foto eliminata', pt:'Foto apagada', ar:'حُذفت صورة', hi:'फ़ोटो हटाई', ja:'写真削除', ky:'Сүрөт өчүрүлдү', 'zh-Hant':'刪除照片' },
  ev_a_delcase: { bg:'Изтрито дело', ru:'Удалено дело', uk:'Видалено справу', en:'Case deleted', de:'Fall gelöscht', fr:'Dossier supprimé', es:'Caso borrado', 'es-MX':'Caso borrado', it:'Pratica eliminata', pt:'Caso apagado', ar:'حُذفت قضية', hi:'मामला हटाया', ja:'ケース削除', ky:'Иш өчүрүлдү', 'zh-Hant':'刪除案件' },
  ev_a_export: { bg:'Запазено копие с воден знак', ru:'Сохранена копия с водяным знаком', uk:'Збережено копію з водяним знаком', en:'Watermarked copy saved', de:'Kopie mit Wasserzeichen gespeichert', fr:'Copie avec filigrane enregistrée', es:'Copia con marca de agua guardada', 'es-MX':'Copia con marca de agua guardada', it:'Copia con filigrana salvata', pt:'Cópia com marca de água guardada', ar:'حُفظت نسخة بعلامة مائية', hi:'वॉटरमार्क कॉपी सहेजी', ja:'透かし付きコピー保存', ky:'Суу белгиси бар көчүрмө сакталды', 'zh-Hant':'已儲存浮水印副本' },
  ev_a_orig: { bg:'Запазен оригинал', ru:'Сохранён оригинал', uk:'Збережено оригінал', en:'Original saved', de:'Original gespeichert', fr:'Original enregistré', es:'Original guardado', 'es-MX':'Original guardado', it:'Originale salvato', pt:'Original guardado', ar:'حُفظ الأصل', hi:'मूल सहेजा', ja:'原本保存', ky:'Түп нуска сакталды', 'zh-Hant':'已儲存原檔' },
  ev_a_pdf: { bg:'Създаден PDF протокол', ru:'Создан PDF-протокол', uk:'Створено PDF-протокол', en:'PDF report created', de:'PDF-Protokoll erstellt', fr:'Rapport PDF créé', es:'Informe PDF creado', 'es-MX':'Informe PDF creado', it:'Verbale PDF creato', pt:'Relatório PDF criado', ar:'أُنشئ تقرير PDF', hi:'PDF रिपोर्ट बनी', ja:'PDF 報告書作成', ky:'PDF протокол түзүлдү', 'zh-Hant':'已建立 PDF 報告' },
  ev_s_gps: { bg:'Записвай местоположение (GPS) към новите снимки', ru:'Записывать местоположение (GPS) для новых фото', uk:'Записувати місцезнаходження (GPS) для нових фото', en:'Record location (GPS) with new photos', de:'Standort (GPS) zu neuen Fotos speichern', fr:'Enregistrer la position (GPS) des nouvelles photos', es:'Guardar la ubicación (GPS) con las fotos nuevas', 'es-MX':'Guardar la ubicación (GPS) con las fotos nuevas', it:'Registra la posizione (GPS) con le nuove foto', pt:'Registar a localização (GPS) nas novas fotos', ar:'سجّل الموقع (GPS) مع الصور الجديدة', hi:'नई फ़ोटो के साथ स्थान (GPS) दर्ज करें', ja:'新しい写真に位置情報 (GPS) を記録', ky:'Жаңы сүрөттөргө жайгашкан жерди (GPS) жазуу', 'zh-Hant':'新照片記錄位置 (GPS)' },
  ev_s_gps_hint: { bg:'Изключено по подразбиране. Когато го включиш, телефонът пита веднъж за разрешение за местоположение; координатите отиват само във водния знак, дневника и протокола на това устройство — нищо не се изпраща никъде.', ru:'По умолчанию выключено. При включении телефон один раз спросит разрешение на местоположение; координаты попадают только в водяной знак, журнал и протокол на этом устройстве — ничего никуда не отправляется.', uk:'За замовчуванням вимкнено. Коли увімкнете, телефон один раз запитає дозвіл на місцезнаходження; координати потрапляють лише у водяний знак, журнал і протокол на цьому пристрої — нічого нікуди не надсилається.', en:'Off by default. When you turn it on, the phone asks once for location permission; the coordinates go only into the watermark, the journal and the report on this device — nothing is sent anywhere.', de:'Standardmäßig aus. Beim Einschalten fragt das Telefon einmal nach der Standortberechtigung; die Koordinaten landen nur im Wasserzeichen, im Protokoll und im Bericht auf diesem Gerät — nichts wird gesendet.', fr:'Désactivé par défaut. À l’activation, le téléphone demande une fois l’autorisation de localisation ; les coordonnées vont seulement dans le filigrane, le journal et le rapport sur cet appareil — rien n’est envoyé.', es:'Desactivado por defecto. Al activarlo, el teléfono pide una vez el permiso de ubicación; las coordenadas solo van a la marca de agua, el registro y el informe en este dispositivo; no se envía nada.', 'es-MX':'Desactivado por defecto. Al activarlo, el teléfono pide una vez el permiso de ubicación; las coordenadas solo van a la marca de agua, el registro y el informe en este dispositivo; no se envía nada.', it:'Disattivato di default. Quando lo attivi, il telefono chiede una volta il permesso di posizione; le coordinate finiscono solo nella filigrana, nel registro e nel verbale su questo dispositivo: non viene inviato nulla.', pt:'Desligado por omissão. Ao ligar, o telefone pede uma vez a permissão de localização; as coordenadas vão apenas para a marca de água, o registo e o relatório neste dispositivo — nada é enviado.', ar:'مُعطّل افتراضيًا. عند تفعيله يطلب الهاتف مرة واحدة إذن الموقع؛ تذهب الإحداثيات فقط إلى العلامة المائية والسجل والتقرير على هذا الجهاز — لا يُرسل أي شيء.', hi:'डिफ़ॉल्ट रूप से बंद। चालू करने पर फ़ोन एक बार स्थान की अनुमति माँगता है; निर्देशांक सिर्फ़ इसी डिवाइस पर वॉटरमार्क, लॉग और रिपोर्ट में जाते हैं — कहीं कुछ नहीं भेजा जाता।', ja:'初期設定はオフ。オンにすると位置情報の許可を一度だけ求めます。座標はこの端末の透かし・ログ・報告書にのみ使われ、どこにも送信されません。', ky:'Демейки өчүк. Күйгүзгөндө телефон бир жолу жайгашкан жерге уруксат сурайт; координаттар ушул түзмөктөгү суу белгисине, журналга жана протоколго гана жазылат — эч нерсе жөнөтүлбөйт.', 'zh-Hant':'預設關閉。開啟後手機會詢問一次位置權限；座標只寫入本機的浮水印、日誌與報告——不會傳送到任何地方。' },
  ev_s_wm_place: { bg:'Показвай мястото във водния знак', ru:'Показывать место в водяном знаке', uk:'Показувати місце у водяному знаку', en:'Show the place on the watermark', de:'Ort im Wasserzeichen zeigen', fr:'Afficher le lieu dans le filigrane', es:'Mostrar el lugar en la marca de agua', 'es-MX':'Mostrar el lugar en la marca de agua', it:'Mostra il luogo nella filigrana', pt:'Mostrar o local na marca de água', ar:'أظهر المكان في العلامة المائية', hi:'वॉटरमार्क पर जगह दिखाएँ', ja:'透かしに場所を表示', ky:'Суу белгисинде жерди көрсөтүү', 'zh-Hant':'在浮水印顯示地點' },
  ev_s_wm_hash: { bg:'Показвай SHA-256 отпечатъка във водния знак', ru:'Показывать отпечаток SHA-256 в водяном знаке', uk:'Показувати відбиток SHA-256 у водяному знаку', en:'Show the SHA-256 fingerprint on the watermark', de:'SHA-256-Fingerabdruck im Wasserzeichen zeigen', fr:'Afficher l’empreinte SHA-256 dans le filigrane', es:'Mostrar la huella SHA-256 en la marca de agua', 'es-MX':'Mostrar la huella SHA-256 en la marca de agua', it:'Mostra l’impronta SHA-256 nella filigrana', pt:'Mostrar a impressão SHA-256 na marca de água', ar:'أظهر بصمة SHA-256 في العلامة المائية', hi:'वॉटरमार्क पर SHA-256 फ़िंगरप्रिंट दिखाएँ', ja:'透かしに SHA-256 指紋を表示', ky:'Суу белгисинде SHA-256 изин көрсөтүү', 'zh-Hant':'在浮水印顯示 SHA-256 指紋' },
  ev_s_author: { bg:'Твоето име (за протоколите)', ru:'Ваше имя (для протоколов)', uk:'Ваше ім’я (для протоколів)', en:'Your name (for reports)', de:'Dein Name (für Protokolle)', fr:'Votre nom (pour les rapports)', es:'Tu nombre (para los informes)', 'es-MX':'Tu nombre (para los informes)', it:'Il tuo nome (per i verbali)', pt:'O teu nome (para relatórios)', ar:'اسمك (للتقارير)', hi:'आपका नाम (रिपोर्ट के लिए)', ja:'あなたの名前（報告書用）', ky:'Сиздин атыңыз (протоколдор үчүн)', 'zh-Hant':'你的姓名（用於報告）' },
  ev_s_saved: { bg:'Запазено.', ru:'Сохранено.', uk:'Збережено.', en:'Saved.', de:'Gespeichert.', fr:'Enregistré.', es:'Guardado.', 'es-MX':'Guardado.', it:'Salvato.', pt:'Guardado.', ar:'تم الحفظ.', hi:'सहेजा गया।', ja:'保存しました。', ky:'Сакталды.', 'zh-Hant':'已儲存。' },
  ev_s_storage: { bg:'На устройството: {0} снимки, {1}', ru:'На устройстве: {0} фото, {1}', uk:'На пристрої: {0} фото, {1}', en:'On this device: {0} photos, {1}', de:'Auf dem Gerät: {0} Fotos, {1}', fr:'Sur l’appareil : {0} photos, {1}', es:'En el dispositivo: {0} fotos, {1}', 'es-MX':'En el dispositivo: {0} fotos, {1}', it:'Sul dispositivo: {0} foto, {1}', pt:'No dispositivo: {0} fotos, {1}', ar:'على الجهاز: {0} صور، {1}', hi:'डिवाइस पर: {0} फ़ोटो, {1}', ja:'端末内：写真 {0} 枚、{1}', ky:'Түзмөктө: {0} сүрөт, {1}', 'zh-Hant':'本機：{0} 張照片，{1}' },
  ev_p_title: { bg:'Протокол за снимково доказателство', ru:'Протокол фотодоказательства', uk:'Протокол фотодоказу', en:'Photo evidence report', de:'Fotobeweis-Protokoll', fr:'Rapport de preuve photographique', es:'Informe de prueba fotográfica', 'es-MX':'Informe de prueba fotográfica', it:'Verbale di prova fotografica', pt:'Relatório de prova fotográfica', ar:'تقرير الدليل المصوَّر', hi:'फ़ोटो साक्ष्य रिपोर्ट', ja:'写真証拠報告書', ky:'Сүрөт далилинин протоколу', 'zh-Hant':'照片證據報告' },
  ev_p_author: { bg:'Съставил', ru:'Составил', uk:'Склав', en:'Prepared by', de:'Erstellt von', fr:'Établi par', es:'Elaborado por', 'es-MX':'Elaborado por', it:'Redatto da', pt:'Elaborado por', ar:'أعدّه', hi:'तैयारकर्ता', ja:'作成者', ky:'Түзгөн', 'zh-Hant':'製作人' },
  ev_p_party: { bg:'Втора страна (по избор)', ru:'Вторая сторона (необязательно)', uk:'Друга сторона (необов’язково)', en:'Other party (optional)', de:'Andere Partei (optional)', fr:'Autre partie (facultatif)', es:'Otra parte (opcional)', 'es-MX':'Otra parte (opcional)', it:'Altra parte (facoltativo)', pt:'Outra parte (opcional)', ar:'الطرف الآخر (اختياري)', hi:'दूसरा पक्ष (वैकल्पिक)', ja:'相手方（任意）', ky:'Экинчи тарап (милдеттүү эмес)', 'zh-Hant':'另一方（選填）' },
  ev_p_sign: { bg:'Подпис на съставителя — рисувай с пръст', ru:'Подпись составителя — рисуйте пальцем', uk:'Підпис укладача — малюйте пальцем', en:'Signature of the author — draw with your finger', de:'Unterschrift des Erstellers — mit dem Finger zeichnen', fr:'Signature de l’auteur — dessinez au doigt', es:'Firma del autor: dibuja con el dedo', 'es-MX':'Firma del autor: dibuja con el dedo', it:'Firma dell’autore: disegna con il dito', pt:'Assinatura do autor — desenha com o dedo', ar:'توقيع المُعِدّ — ارسم بإصبعك', hi:'तैयारकर्ता के हस्ताक्षर — उँगली से बनाएँ', ja:'作成者の署名 — 指で書く', ky:'Түзгөндүн колу — манжа менен тартыңыз', 'zh-Hant':'製作人簽名——用手指書寫' },
  ev_p_sign2: { bg:'Подпис на втората страна', ru:'Подпись второй стороны', uk:'Підпис другої сторони', en:'Signature of the other party', de:'Unterschrift der anderen Partei', fr:'Signature de l’autre partie', es:'Firma de la otra parte', 'es-MX':'Firma de la otra parte', it:'Firma dell’altra parte', pt:'Assinatura da outra parte', ar:'توقيع الطرف الآخر', hi:'दूसरे पक्ष के हस्ताक्षर', ja:'相手方の署名', ky:'Экинчи тараптын колу', 'zh-Hant':'另一方簽名' },
  ev_p_clear: { bg:'Изчисти', ru:'Очистить', uk:'Очистити', en:'Clear', de:'Löschen', fr:'Effacer', es:'Borrar', 'es-MX':'Borrar', it:'Cancella', pt:'Limpar', ar:'مسح', hi:'साफ़ करें', ja:'消去', ky:'Тазалоо', 'zh-Hant':'清除' },
  ev_p_make: { bg:'Създай подписан PDF', ru:'Создать подписанный PDF', uk:'Створити підписаний PDF', en:'Create signed PDF', de:'Unterschriebenes PDF erstellen', fr:'Créer le PDF signé', es:'Crear PDF firmado', 'es-MX':'Crear PDF firmado', it:'Crea PDF firmato', pt:'Criar PDF assinado', ar:'إنشاء PDF موقّع', hi:'हस्ताक्षरित PDF बनाएँ', ja:'署名入り PDF を作成', ky:'Кол коюлган PDF түзүү', 'zh-Hant':'建立已簽名 PDF' },
  ev_p_making: { bg:'Създавам PDF…', ru:'Создаю PDF…', uk:'Створюю PDF…', en:'Creating PDF…', de:'PDF wird erstellt…', fr:'Création du PDF…', es:'Creando PDF…', 'es-MX':'Creando PDF…', it:'Creo il PDF…', pt:'A criar PDF…', ar:'جارٍ إنشاء PDF…', hi:'PDF बन रही है…', ja:'PDF を作成中…', ky:'PDF түзүлүүдө…', 'zh-Hant':'正在建立 PDF…' },
  ev_p_done: { bg:'PDF е създаден — {0} страници. Отпечатък на PDF: {1}', ru:'PDF создан — {0} стр. Отпечаток PDF: {1}', uk:'PDF створено — {0} стор. Відбиток PDF: {1}', en:'PDF created — {0} pages. PDF fingerprint: {1}', de:'PDF erstellt — {0} Seiten. PDF-Fingerabdruck: {1}', fr:'PDF créé — {0} pages. Empreinte du PDF : {1}', es:'PDF creado: {0} páginas. Huella del PDF: {1}', 'es-MX':'PDF creado: {0} páginas. Huella del PDF: {1}', it:'PDF creato: {0} pagine. Impronta del PDF: {1}', pt:'PDF criado: {0} páginas. Impressão do PDF: {1}', ar:'أُنشئ ملف PDF — {0} صفحات. بصمة PDF: {1}', hi:'PDF बनी — {0} पेज। PDF फ़िंगरप्रिंट: {1}', ja:'PDF を作成しました（{0} ページ）。PDF の指紋：{1}', ky:'PDF түзүлдү — {0} бет. PDF изи: {1}', 'zh-Hant':'已建立 PDF——共 {0} 頁。PDF 指紋：{1}' },
  ev_p_case: { bg:'Дело', ru:'Дело', uk:'Справа', en:'Case', de:'Fall', fr:'Dossier', es:'Caso', 'es-MX':'Caso', it:'Pratica', pt:'Caso', ar:'القضية', hi:'मामला', ja:'ケース', ky:'Иш', 'zh-Hant':'案件' },
  ev_p_created: { bg:'Дело открито', ru:'Дело открыто', uk:'Справу відкрито', en:'Case opened', de:'Fall eröffnet', fr:'Dossier ouvert', es:'Caso abierto', 'es-MX':'Caso abierto', it:'Pratica aperta', pt:'Caso aberto', ar:'فُتحت القضية', hi:'मामला खोला', ja:'ケース開始', ky:'Иш ачылды', 'zh-Hant':'案件建立' },
  ev_p_generated: { bg:'Протоколът е създаден', ru:'Протокол создан', uk:'Протокол створено', en:'Report generated', de:'Protokoll erstellt', fr:'Rapport généré', es:'Informe generado', 'es-MX':'Informe generado', it:'Verbale generato', pt:'Relatório gerado', ar:'تاريخ إنشاء التقرير', hi:'रिपोर्ट बनी', ja:'報告書作成日時', ky:'Протокол түзүлгөн', 'zh-Hant':'報告產生時間' },
  ev_p_fp: { bg:'Отпечатък на протокола (SHA-256 на всички отпечатъци + последния запис в дневника)', ru:'Отпечаток протокола (SHA-256 всех отпечатков + последней записи журнала)', uk:'Відбиток протоколу (SHA-256 усіх відбитків + останнього запису журналу)', en:'Report fingerprint (SHA-256 of all photo fingerprints + last journal entry)', de:'Protokoll-Fingerabdruck (SHA-256 aller Fingerabdrücke + letzter Protokolleintrag)', fr:'Empreinte du rapport (SHA-256 de toutes les empreintes + dernière entrée du journal)', es:'Huella del informe (SHA-256 de todas las huellas + última entrada del registro)', 'es-MX':'Huella del informe (SHA-256 de todas las huellas + última entrada del registro)', it:'Impronta del verbale (SHA-256 di tutte le impronte + ultima voce del registro)', pt:'Impressão do relatório (SHA-256 de todas as impressões + última entrada do registo)', ar:'بصمة التقرير (SHA-256 لكل البصمات + آخر إدخال في السجل)', hi:'रिपोर्ट फ़िंगरप्रिंट (सभी फ़िंगरप्रिंट + अंतिम लॉग प्रविष्टि का SHA-256)', ja:'報告書の指紋（全写真の指紋＋最終ログの SHA-256）', ky:'Протоколдун изи (бардык издердин + акыркы журнал жазуусунун SHA-256)', 'zh-Hant':'報告指紋（所有照片指紋＋最後一筆日誌的 SHA-256）' },
  ev_p_page: { bg:'Страница {0} / {1}', ru:'Страница {0} / {1}', uk:'Сторінка {0} / {1}', en:'Page {0} / {1}', de:'Seite {0} / {1}', fr:'Page {0} / {1}', es:'Página {0} / {1}', 'es-MX':'Página {0} / {1}', it:'Pagina {0} / {1}', pt:'Página {0} / {1}', ar:'صفحة {0} / {1}', hi:'पेज {0} / {1}', ja:'{0} / {1} ページ', ky:'Бет {0} / {1}', 'zh-Hant':'第 {0} / {1} 頁' },
  ev_p_howto: { bg:'Как се проверява: изчисли SHA-256 на оригиналния файл на снимката и го сравни с отпечатъка до нея.', ru:'Как проверить: вычислите SHA-256 оригинального файла фото и сравните с отпечатком рядом.', uk:'Як перевірити: обчисліть SHA-256 оригінального файлу фото й порівняйте з відбитком поруч.', en:'How to check: compute the SHA-256 of the original photo file and compare it with the fingerprint printed next to it.', de:'Prüfung: SHA-256 der Originaldatei berechnen und mit dem daneben gedruckten Fingerabdruck vergleichen.', fr:'Vérification : calculez le SHA-256 du fichier original et comparez-le à l’empreinte imprimée à côté.', es:'Cómo comprobar: calcula el SHA-256 del archivo original y compáralo con la huella impresa al lado.', 'es-MX':'Cómo comprobar: calcula el SHA-256 del archivo original y compáralo con la huella impresa al lado.', it:'Verifica: calcola lo SHA-256 del file originale e confrontalo con l’impronta stampata accanto.', pt:'Como verificar: calcula o SHA-256 do ficheiro original e compara-o com a impressão ao lado.', ar:'طريقة التحقق: احسب SHA-256 لملف الصورة الأصلي وقارنه بالبصمة المطبوعة بجانبها.', hi:'कैसे जाँचें: मूल फ़ोटो फ़ाइल का SHA-256 निकालें और साथ छपे फ़िंगरप्रिंट से मिलाएँ।', ja:'確認方法：元の写真ファイルの SHA-256 を計算し、横に印刷された指紋と比べてください。', ky:'Текшерүү: түп нуска файлдын SHA-256 эсептеп, жанындагы из менен салыштырыңыз.', 'zh-Hant':'驗證方式：計算原始照片檔的 SHA-256，並與旁邊印出的指紋比對。' },
  ev_p_list: { bg:'Списък на снимките', ru:'Список фото', uk:'Список фото', en:'List of photos', de:'Fotoliste', fr:'Liste des photos', es:'Lista de fotos', 'es-MX':'Lista de fotos', it:'Elenco foto', pt:'Lista de fotos', ar:'قائمة الصور', hi:'फ़ोटो सूची', ja:'写真一覧', ky:'Сүрөттөрдүн тизмеси', 'zh-Hant':'照片清單' },
  ev_s_case: { bg:'Наем на апартамент — ул. Липа 5, ап. 12', ru:'Аренда квартиры — ул. Липовая 5, кв. 12', uk:'Оренда квартири — вул. Липова 5, кв. 12', en:'Flat rental — 5 Oak Street, flat 12', de:'Wohnungsmiete — Lindenstr. 5, Whg. 12', fr:'Location — 5 rue des Tilleuls, appt 12', es:'Alquiler de piso — C/ Tilo 5, piso 12', 'es-MX':'Renta de departamento — Calle Tilo 5, depto 12', it:'Affitto — Via dei Tigli 5, int. 12', pt:'Arrendamento — Rua das Tílias 5, apt. 12', ar:'استئجار شقة — شارع الزيزفون 5، شقة 12', hi:'फ़्लैट किराया — 5 ओक स्ट्रीट, फ़्लैट 12', ja:'賃貸マンション — オーク通り5、12号室', ky:'Батир ижарасы — Жөкө көч. 5, 12-батир', 'zh-Hant':'租屋——橡樹街 5 號 12 室' },
  ev_s_place: { bg:'ул. Липа 5, ап. 12', ru:'ул. Липовая 5, кв. 12', uk:'вул. Липова 5, кв. 12', en:'5 Oak Street, flat 12', de:'Lindenstr. 5, Whg. 12', fr:'5 rue des Tilleuls, appt 12', es:'C/ Tilo 5, piso 12', 'es-MX':'Calle Tilo 5, depto 12', it:'Via dei Tigli 5, int. 12', pt:'Rua das Tílias 5, apt. 12', ar:'شارع الزيزفون 5، شقة 12', hi:'5 ओक स्ट्रीट, फ़्लैट 12', ja:'オーク通り5、12号室', ky:'Жөкө көч. 5, 12-батир', 'zh-Hant':'橡樹街 5 號 12 室' },
  ev_s1: { bg:'Стената в хола — при нанасяне', ru:'Стена в гостиной — при заселении', uk:'Стіна у вітальні — під час заселення', en:'Living room wall — at move-in', de:'Wohnzimmerwand — beim Einzug', fr:'Mur du salon — à l’entrée', es:'Pared del salón — al entrar', 'es-MX':'Pared de la sala — al mudarse', it:'Parete del soggiorno — all’ingresso', pt:'Parede da sala — na entrada', ar:'جدار غرفة المعيشة — عند الانتقال', hi:'बैठक की दीवार — आते समय', ja:'リビングの壁 — 入居時', ky:'Конок бөлмөсүнүн дубалы — көчүп келгенде', 'zh-Hant':'客廳牆面——入住時' },
  ev_s2: { bg:'Електромер — при нанасяне', ru:'Электросчётчик — при заселении', uk:'Електролічильник — під час заселення', en:'Electricity meter — at move-in', de:'Stromzähler — beim Einzug', fr:'Compteur électrique — à l’entrée', es:'Contador de luz — al entrar', 'es-MX':'Medidor de luz — al mudarse', it:'Contatore elettrico — all’ingresso', pt:'Contador de eletricidade — na entrada', ar:'عداد الكهرباء — عند الانتقال', hi:'बिजली मीटर — आते समय', ja:'電気メーター — 入居時', ky:'Электр эсептегич — көчүп келгенде', 'zh-Hant':'電錶——入住時' },
  ev_s3: { bg:'Драскотина на входната врата', ru:'Царапина на входной двери', uk:'Подряпина на вхідних дверях', en:'Scratch on the entrance door', de:'Kratzer an der Wohnungstür', fr:'Rayure sur la porte d’entrée', es:'Arañazo en la puerta de entrada', 'es-MX':'Rayón en la puerta de entrada', it:'Graffio sulla porta d’ingresso', pt:'Risco na porta de entrada', ar:'خدش على باب المدخل', hi:'मुख्य दरवाज़े पर खरोंच', ja:'玄関ドアの傷', ky:'Кире бериш эшиктеги тырмак', 'zh-Hant':'大門上的刮痕' },
  ev_s4: { bg:'Електромер — при напускане', ru:'Электросчётчик — при выезде', uk:'Електролічильник — під час виїзду', en:'Electricity meter — at move-out', de:'Stromzähler — beim Auszug', fr:'Compteur électrique — à la sortie', es:'Contador de luz — al salir', 'es-MX':'Medidor de luz — al salir', it:'Contatore elettrico — all’uscita', pt:'Contador de eletricidade — na saída', ar:'عداد الكهرباء — عند المغادرة', hi:'बिजली मीटर — जाते समय', ja:'電気メーター — 退去時', ky:'Электр эсептегич — чыгып кеткенде', 'zh-Hant':'電錶——退租時' },
  ev_s5: { bg:'Стената в хола — при напускане (петно)', ru:'Стена в гостиной — при выезде (пятно)', uk:'Стіна у вітальні — під час виїзду (пляма)', en:'Living room wall — at move-out (stain)', de:'Wohnzimmerwand — beim Auszug (Fleck)', fr:'Mur du salon — à la sortie (tache)', es:'Pared del salón — al salir (mancha)', 'es-MX':'Pared de la sala — al salir (mancha)', it:'Parete del soggiorno — all’uscita (macchia)', pt:'Parede da sala — na saída (mancha)', ar:'جدار غرفة المعيشة — عند المغادرة (بقعة)', hi:'बैठक की दीवार — जाते समय (दाग)', ja:'リビングの壁 — 退去時（しみ）', ky:'Конок бөлмөсүнүн дубалы — чыгып кеткенде (так)', 'zh-Hant':'客廳牆面——退租時（污漬）' }
});

export const title = 'Photo evidence';

// ---------- Съхранение: описанието (JSON) в localStorage, байтовете на снимките в IndexedDB ----------
const LS = 'pupikes.evidence.v1';
const LS_HEAD = 'pupikes.evidence.head';   // последният отпечатък отделно → отрязан край на дневника се вижда
const LS_SET = 'pupikes.evidence.settings';
const ZERO = '0'.repeat(64);
const TAGS = ['before', 'after', 'damage', 'meter', 'doc', 'other'];
const KINDS = ['rent', 'car', 'delivery', 'repair', 'meter', 'insurance', 'other'];
const ACTS = { case: 'ev_a_case', add: 'ev_a_add', note: 'ev_a_note', del: 'ev_a_del', delcase: 'ev_a_delcase', export: 'ev_a_export', orig: 'ev_a_orig', pdf: 'ev_a_pdf' };

let db = null;
let set = null;
let ready = null;

function loadDb() { try { const d = JSON.parse(localStorage.getItem(LS)); if (d && Array.isArray(d.cases) && Array.isArray(d.log)) return d; } catch (e) {} return null; }
function saveDb() { try { localStorage.setItem(LS, JSON.stringify(db)); localStorage.setItem(LS_HEAD, db.log.length ? db.log[db.log.length - 1].h : ZERO); } catch (e) {} }
function loadSet() { const d = { gps: false, wmPlace: true, wmHash: true, author: '' }; try { Object.assign(d, JSON.parse(localStorage.getItem(LS_SET)) || {}); } catch (e) {} return d; }
function saveSet() { try { localStorage.setItem(LS_SET, JSON.stringify(set)); } catch (e) {} }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function nowISO() { return new Date().toISOString(); }
function fmtTime(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleString(getLang(), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return String(iso); } }
function shortSha(s) { return s ? s.slice(0, 12) + '…' + s.slice(-6) : ''; }
function allItems() { const out = []; for (const c of db.cases) for (const it of c.items) out.push({ c, it }); return out; }
function findCase(id) { return db.cases.find((c) => c.id === id) || null; }
function itemLabel(it) { return t('ev_t_' + it.tag) + (it.note ? ' — ' + it.note : ''); }
function placeText(it, c) {
  const parts = [];
  if (it.lat != null && it.lon != null) parts.push(it.lat.toFixed(5) + ', ' + it.lon.toFixed(5) + (it.acc ? ' ±' + it.acc + ' m' : ''));
  if (c && c.place) parts.push(c.place);
  return parts.join(' · ');
}

// ---------- Дневник-верига: всеки запис съдържа отпечатъка на предишния ----------
function payload(e) { return [e.n, e.ts, e.act, e.c || '', e.i || '', e.sha || '', e.d || '', e.prev].join('|'); }
let chainQ = Promise.resolve();
function appendLog(act, c, i, sha, d, ts) {
  const run = async () => {
    const last = db.log[db.log.length - 1];
    const e = { n: db.log.length + 1, ts: ts || nowISO(), act, c: c || '', i: i || '', sha: sha || '', d: String(d || '').slice(0, 140), prev: last ? last.h : ZERO };
    e.h = await sha256Hex(payload(e));
    db.log.push(e); saveDb();
    return e;
  };
  chainQ = chainQ.then(run, run);
  return chainQ;
}
// Пълна проверка: веригата (номер, предишен отпечатък, собствен отпечатък, края) + всяка снимка спрямо байтовете ѝ.
async function verifyAll() {
  let prev = ZERO;
  for (let k = 0; k < db.log.length; k++) {
    const e = db.log[k];
    if (e.n !== k + 1 || e.prev !== prev || (await sha256Hex(payload(e))) !== e.h) return { ok: false, badEntry: k + 1, badPhotos: [] };
    prev = e.h;
  }
  let head = null; try { head = localStorage.getItem(LS_HEAD); } catch (e) {}
  if (head && head !== prev) return { ok: false, badEntry: db.log.length + 1, badPhotos: [] };
  const added = {}; db.log.forEach((e) => { if (e.act === 'add') added[e.i] = e; });
  const badPhotos = []; let photos = 0;
  for (const { it } of allItems()) {
    photos++;
    const e = added[it.id]; const b = await getBlob(it.key); const s = b ? await sha256Hex(b) : '';
    if (!e || e.sha !== it.sha || s !== it.sha) badPhotos.push(it);
  }
  return { ok: !badPhotos.length, badEntry: 0, badPhotos, entries: db.log.length, photos };
}
function chainText(r) {
  if (r.badEntry) return tf('ev_l_bad_entry', r.badEntry);
  if (r.badPhotos.length) return r.badPhotos.map((it) => tf('ev_l_bad_photo', itemLabel(it))).join(' ');
  return tf('ev_l_ok', r.entries, r.photos);
}

// ---------- Снимки: зареждане, миниатюра, местоположение ----------
function blobImage(blob) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(blob); const img = new Image();
    img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(u), 1000); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); };
    img.src = u;
  });
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasBlob(cv, type, q) { return new Promise((res) => cv.toBlob((b) => res(b), type || 'image/jpeg', q || 0.9)); }
function thumbOf(img) {
  const s = 220 / Math.max(img.naturalWidth, img.naturalHeight); const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
  const cv = canvasOf(w, h); cv.getContext('2d').drawImage(img, 0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.72);
}
// Местоположение — само ако потребителят е включил GPS в „Настройки" (разрешението се иска от системата).
function getPosition() {
  return new Promise((res) => {
    try {
      if (!navigator.geolocation) { res(null); return; }
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy || 0) }),
        () => res(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    } catch (e) { res(null); }
  });
}
async function addItem(c, blob, o) {
  const id = uid('p'); const sha = await sha256Hex(blob); const ex = await readExif(blob); const img = await blobImage(blob);
  const it = { id, key: 'ev:' + id, sha, name: o.name || 'photo.jpg', type: blob.type || 'image/jpeg', size: blob.size, w: img.naturalWidth, h: img.naturalHeight,
    tag: TAGS.includes(o.tag) ? o.tag : 'other', note: o.note || '', meter: o.meter || '', added: o.ts || nowISO(),
    taken: ex && ex.date ? exifDateText(ex.date) : '', device: ex ? [ex.make, ex.model].filter(Boolean).join(' ') : '',
    lat: null, lon: null, acc: null, src: '', thumb: thumbOf(img), sample: !!o.sample, sk: o.sk || '', n: 0 };
  if (o.pos) { it.lat = o.pos.lat; it.lon = o.pos.lon; it.acc = o.pos.acc; it.src = 'gps'; }
  else if (ex && ex.lat != null && ex.lon != null) { it.lat = ex.lat; it.lon = ex.lon; it.src = 'exif'; }
  await putBlob(it.key, blob);
  c.items.push(it);
  const e = await appendLog('add', c.id, id, sha, itemLabel(it), it.added);
  it.n = e.n; saveDb();
  return it;
}

// ---------- Примерно дело: 5 генерирани снимки (ясно маркирани „ПРИМЕР") ----------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function grain(ctx, w, h, seed, alpha) { const r = rng(seed); for (let i = 0; i < 9000; i++) { ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`; ctx.fillRect(r() * w, r() * h, 2, 2); } }
function drawWall(ctx, stain) {
  const W = 1200, H = 900;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#efe4cf'); g.addColorStop(1, '#d9c9aa'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  grain(ctx, W, 700, 7, 0.035);
  ctx.fillStyle = '#8a5a35'; ctx.fillRect(0, 700, W, 200);                         // под
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; for (let x = 0; x < W; x += 150) { ctx.beginPath(); ctx.moveTo(x, 700); ctx.lineTo(x - 60, 900); ctx.stroke(); }
  ctx.fillStyle = '#f7f4ee'; ctx.fillRect(0, 684, W, 20);                           // перваз
  ctx.fillStyle = '#ffffff'; ctx.fillRect(90, 150, 330, 420); ctx.fillStyle = '#9fd0f5'; ctx.fillRect(110, 170, 290, 380);   // прозорец
  ctx.fillStyle = '#ffffff'; ctx.fillRect(250, 170, 10, 380); ctx.fillRect(110, 355, 290, 10);
  ctx.fillStyle = '#5b3a1e'; ctx.fillRect(760, 180, 260, 210); ctx.fillStyle = '#7ec07a'; ctx.fillRect(778, 198, 224, 174); // картина
  ctx.fillStyle = '#4f8f4b'; ctx.beginPath(); ctx.moveTo(778, 372); ctx.quadraticCurveTo(880, 250, 1002, 372); ctx.fill();
  ctx.fillStyle = '#f5d142'; ctx.beginPath(); ctx.arc(955, 238, 22, 0, 7); ctx.fill();
  ctx.fillStyle = '#6d4c8f'; ctx.fillRect(600, 520, 520, 170); ctx.fillStyle = '#7d5ca0'; ctx.fillRect(600, 480, 520, 60);     // диван
  if (stain) {
    const s = ctx.createRadialGradient(640, 330, 10, 640, 330, 120); s.addColorStop(0, 'rgba(96,70,35,.75)'); s.addColorStop(0.7, 'rgba(120,90,50,.35)'); s.addColorStop(1, 'rgba(120,90,50,0)');
    ctx.fillStyle = s; ctx.beginPath(); ctx.ellipse(640, 330, 130, 100, 0.3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4b3a28'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(520, 120); ctx.lineTo(560, 190); ctx.lineTo(545, 240); ctx.lineTo(590, 300); ctx.stroke();
  }
}
function drawMeter(ctx, value, seed) {
  const W = 1200, H = 900;
  ctx.fillStyle = '#9aa1a8'; ctx.fillRect(0, 0, W, H); grain(ctx, W, H, seed, 0.05);
  ctx.fillStyle = '#e9ecef'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(330, 110, 540, 680, 28) : ctx.rect(330, 110, 540, 680); ctx.fill();
  ctx.fillStyle = '#1b1f23'; ctx.fillRect(380, 250, 440, 130);
  ctx.font = 'bold 96px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const digits = value.replace('.', ''); const cw = 440 / digits.length;
  for (let i = 0; i < digits.length; i++) { const last = i === digits.length - 1; ctx.fillStyle = last ? '#c0392b' : '#2d333b'; ctx.fillRect(385 + i * cw, 258, cw - 10, 114); ctx.fillStyle = '#ffffff'; ctx.fillText(digits[i], 380 + i * cw + cw / 2 - 5, 318); }
  ctx.fillStyle = '#1b1f23'; ctx.font = 'bold 44px sans-serif'; ctx.fillText('kWh', 600, 440);
  ctx.font = '28px sans-serif'; ctx.fillText('230 V  50 Hz  10(60) A', 600, 500); ctx.fillText('No 4471 2208', 600, 545);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(600, 660, 70, 0, 7); ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.fillRect(595, 590, 10, 40);
}
function drawDoor(ctx) {
  const W = 1200, H = 900;
  ctx.fillStyle = '#d7d2c8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7b4a26'; ctx.fillRect(330, 40, 540, 860); grain(ctx, W, H, 11, 0.04);
  ctx.strokeStyle = '#5e3719'; ctx.lineWidth = 10; ctx.strokeRect(390, 110, 420, 300); ctx.strokeRect(390, 480, 420, 360);
  ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(800, 470, 26, 0, 7); ctx.fill(); ctx.fillRect(740, 460, 70, 18);
  ctx.strokeStyle = '#e8d3b0'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(430, 560); ctx.lineTo(520, 590); ctx.lineTo(610, 600); ctx.lineTo(720, 650); ctx.stroke();  // драскотина
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(450, 580); ctx.lineTo(560, 610); ctx.stroke();
  const d = ctx.createRadialGradient(560, 740, 5, 560, 740, 60); d.addColorStop(0, 'rgba(30,15,5,.7)'); d.addColorStop(1, 'rgba(30,15,5,0)'); ctx.fillStyle = d; ctx.beginPath(); ctx.arc(560, 740, 60, 0, 7); ctx.fill();
}
function drawSample(kind) {
  const cv = canvasOf(1200, 900); const ctx = cv.getContext('2d');
  if (kind === 'wall') drawWall(ctx, false); else if (kind === 'wall2') drawWall(ctx, true);
  else if (kind === 'meter1') drawMeter(ctx, '04512.7', 3); else if (kind === 'meter2') drawMeter(ctx, '04689.3', 5); else drawDoor(ctx);
  const mark = t('ev_sample_badge').toUpperCase();
  ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(mark).width + 44; ctx.fillStyle = 'rgba(200,16,46,.92)'; ctx.fillRect(24, 24, w, 76); ctx.fillStyle = '#fff'; ctx.fillText(mark, 46, 63);
  return cv;
}
async function seedSamples() {
  const t0 = Date.now() - 30 * 86400000, t1 = Date.now() - 3 * 3600000;
  const c = { id: uid('c'), title: t('ev_s_case'), kind: 'rent', place: t('ev_s_place'), created: new Date(t0 - 900000).toISOString(), sample: true, items: [] };
  db.cases.push(c);
  await appendLog('case', c.id, '', '', c.title, c.created);
  const pos = { lat: 42.69771, lon: 23.32192, acc: 9 };
  const defs = [['wall', 'before', 'ev_s1', '', t0], ['meter1', 'meter', 'ev_s2', '04512.7', t0 + 140000], ['door', 'damage', 'ev_s3', '', t0 + 260000], ['meter2', 'meter', 'ev_s4', '04689.3', t1], ['wall2', 'after', 'ev_s5', '', t1 + 150000]];
  for (const [k, tag, nk, meter, ts] of defs) {
    const blob = await canvasBlob(drawSample(k), 'image/jpeg', 0.9);
    await addItem(c, blob, { name: 'sample-' + k + '.jpg', tag, note: t(nk), meter, ts: new Date(ts).toISOString(), sample: true, sk: k, pos });
  }
}
async function ensureDb() {
  if (ready) return ready;
  ready = (async () => {
    set = loadSet();
    db = loadDb() || { cases: [], log: [], seeded: false };
    if (!db.seeded) { db.seeded = true; saveDb(); try { await seedSamples(); } catch (e) { /* без примери */ } }
    return db;
  })();
  return ready;
}

// ---------- Воден знак ----------
function fitFont(ctx, text, maxW, px, weight, family) {
  let s = px; ctx.font = `${weight} ${s}px ${family}`;
  while (s > 8 && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}
async function watermarkCanvas(it, c, maxSide) {
  const blob = await getBlob(it.key); if (!blob) throw new Error('blob');
  const img = await blobImage(blob);
  const k = Math.min(1, (maxSide || 2000) / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const fs = Math.max(13, Math.round(Math.min(w, h) * 0.034)), pad = Math.round(fs * 0.7);
  const lines = [{ s: t('ev_wm_rec') + ': ' + fmtTime(it.added) + ' · ' + t('ev_t_' + it.tag), mono: false }];
  const pl = placeText(it, c); if (set.wmPlace && pl) lines.push({ s: t('ev_location') + ': ' + pl, mono: false });
  if (set.wmHash) lines.push({ s: 'SHA-256 ' + it.sha, mono: true });
  lines.push({ s: tf('ev_wm_entry', it.n || '?') + ' · Pupikes Photo Evidence', mono: false });
  const bandH = Math.round(lines.length * fs * 1.32 + pad * 2);
  const cv = canvasOf(w, h + bandH); const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  ctx.fillStyle = '#111418'; ctx.fillRect(0, h, w, bandH);
  ctx.fillStyle = '#c8102e'; ctx.fillRect(0, h, w, Math.max(3, Math.round(fs * 0.18)));
  const rtl = isRTL(); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.textBaseline = 'top';
  let y = h + pad;
  for (const ln of lines) {
    const fam = ln.mono ? 'monospace' : 'system-ui, sans-serif';
    fitFont(ctx, ln.s, w - pad * 2, ln.mono ? Math.round(fs * 0.86) : fs, ln.mono ? '400' : '600', fam);
    ctx.fillStyle = ln.mono ? '#9fe3a8' : '#ffffff';
    ctx.fillText(ln.s, rtl ? w - pad : pad, y); y += Math.round(fs * 1.32);
  }
  return cv;
}

// ---------- Карта на разликите (проверяван файл спрямо оригинала) ----------
async function diffMap(origBlob, candBlob) {
  const a = await blobImage(origBlob), b = await blobImage(candBlob);
  const W = Math.min(480, a.naturalWidth), H = Math.max(1, Math.round(a.naturalHeight * W / a.naturalWidth));
  const ca = canvasOf(W, H), cb = canvasOf(W, H); const xa = ca.getContext('2d'), xb = cb.getContext('2d');
  xa.drawImage(a, 0, 0, W, H); xb.drawImage(b, 0, 0, W, H);
  const da = xa.getImageData(0, 0, W, H).data, dd = xb.getImageData(0, 0, W, H).data;
  const B = 8, bw = Math.ceil(W / B), bh = Math.ceil(H / B); const sum = new Float32Array(bw * bh), cnt = new Uint16Array(bw * bh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4; const d = Math.max(Math.abs(da[p] - dd[p]), Math.abs(da[p + 1] - dd[p + 1]), Math.abs(da[p + 2] - dd[p + 2]));
    const k = ((y / B) | 0) * bw + ((x / B) | 0); sum[k] += d; cnt[k]++;
  }
  const TH = 22; let changed = 0, x0 = bw, y0 = bh, x1 = -1, y1 = -1;
  const out = canvasOf(W, H); const xo = out.getContext('2d');
  xo.filter = 'grayscale(0.7) brightness(0.8)'; xo.drawImage(a, 0, 0, W, H); xo.filter = 'none';
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const k = by * bw + bx; const m = cnt[k] ? sum[k] / cnt[k] : 0;
    if (m > TH) { changed++; x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx); y1 = Math.max(y1, by); xo.fillStyle = `rgba(255,30,30,${Math.min(0.85, 0.3 + m / 160)})`; xo.fillRect(bx * B, by * B, B, B); }
  }
  const total = bw * bh; const pct = Math.round(changed / total * 1000) / 10;
  const aspectOff = Math.abs(a.naturalWidth / a.naturalHeight - b.naturalWidth / b.naturalHeight) > 0.02;
  let kind = 'same';
  if (changed) {
    xo.strokeStyle = '#ffd400'; xo.lineWidth = 3; xo.strokeRect(x0 * B - 3, y0 * B - 3, (x1 - x0 + 1) * B + 6, (y1 - y0 + 1) * B + 6);
    const boxArea = (x1 - x0 + 1) * (y1 - y0 + 1) / total;
    kind = (!aspectOff && pct < 30 && boxArea < 0.5) ? 'local' : 'global';
  } else if (aspectOff) kind = 'global';
  return { canvas: out, pct, kind, aDims: a.naturalWidth + '×' + a.naturalHeight, bDims: b.naturalWidth + '×' + b.naturalHeight };
}
// „Пробвай с пример": копие на примерната снимка на стената, от което картината е „ретуширана" (замазана).
async function retouchedSample(it) {
  const img = await blobImage(await getBlob(it.key));
  const cv = canvasOf(img.naturalWidth, img.naturalHeight); const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const g = ctx.createLinearGradient(0, 170, 0, 400); g.addColorStop(0, '#ece0c9'); g.addColorStop(1, '#e4d6bb');
  ctx.fillStyle = g; ctx.fillRect(752, 172, 276, 226);
  return canvasBlob(cv, 'image/jpeg', 0.9);
}

// ---------- Подписан PDF протокол (страниците се рисуват на canvas; отпечатъците са и като текст) ----------
function wrapText(ctx, text, maxW) {
  const out = []; const words = /\s/.test(text) ? text.split(/(\s+)/) : Array.from(text);
  let line = '';
  for (const w of words) {
    const test = line + w;
    if (ctx.measureText(test).width > maxW && line.trim()) {
      if (ctx.measureText(w).width > maxW) { for (const ch of Array.from(w)) { if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ''; } line += ch; } continue; }
      out.push(line.trimEnd()); line = w.trimStart();
    } else line = test;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out;
}
function pageCtx(PW, PH) {
  const cv = canvasOf(PW, PH); const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, PW, PH);
  const rtl = isRTL(); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textBaseline = 'top';
  // x е от „началото на реда" (ляво при LTR, дясно при RTL)
  const P = {
    cv, ctx, y: 80, M: 80,
    text(s, size, o) {
      o = o || {}; ctx.font = `${o.bold ? '700' : '400'} ${size}px ${o.mono ? 'monospace' : 'system-ui, sans-serif'}`; ctx.fillStyle = o.color || '#1b1f23';
      const x = o.x != null ? o.x : P.M; const maxW = o.w || (PW - P.M - x);
      ctx.textAlign = rtl ? 'right' : 'left';
      for (const ln of wrapText(ctx, String(s), maxW)) { ctx.fillText(ln, rtl ? PW - x : x, P.y); P.y += Math.round(size * 1.35); }
    },
    rule() { ctx.fillStyle = '#c8102e'; ctx.fillRect(P.M, P.y, PW - P.M * 2, 4); P.y += 18; }
  };
  return P;
}
function footer(P, PW, PH, n, total) {
  const ctx = P.ctx; ctx.font = '400 20px system-ui, sans-serif'; ctx.fillStyle = '#6a737d'; ctx.textAlign = 'center';
  ctx.fillText(tf('ev_p_page', n, total) + ' · Pupikes Photo Evidence', PW / 2, PH - 130);
}
async function makePdf(c, author, party, sig1, sig2) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const PW = 1240, PH = 1754;
  const items = c.items.slice();
  const lastH = db.log.length ? db.log[db.log.length - 1].h : ZERO;
  const fp = await sha256Hex(items.map((i) => i.sha).join('') + lastH);
  const chain = await verifyAll();
  const total = 1 + Math.ceil(items.length / 2);
  const pages = [];
  // --- стр. 1: данни на делото, списък, отпечатък, подписи ---
  const P = pageCtx(PW, PH);
  P.text(t('ev_p_title'), 46, { bold: true }); P.rule();
  const kv = [[t('ev_p_case'), c.title], [t('ev_kind'), t('ev_k_' + c.kind)], [t('ev_place'), c.place || '—'], [t('ev_p_created'), fmtTime(c.created)],
    [t('ev_p_generated'), fmtTime(nowISO())], [t('ev_p_author'), author || '—'], [t('ev_p_party').replace(/\s*[（(].*[)）]\s*$/, ''), party || '—'],
    [t('ev_tab_log'), (chain.ok ? '✓ ' : '✗ ') + chainText(chain)]];
  for (const [k, v] of kv) { P.text(k + ': ' + v, 26, {}); P.y += 2; }
  P.y += 14; P.text(t('ev_p_list'), 30, { bold: true }); P.y += 4;
  items.forEach((it, i) => { P.text(`${i + 1}. ${itemLabel(it)} · ${fmtTime(it.added)}${it.meter ? ' · ' + it.meter : ''}`, 22, {}); P.text('SHA-256 ' + it.sha, 18, { mono: true, color: '#2d6a36', x: P.M + 30 }); P.y += 4; });
  P.y += 12; P.text(t('ev_p_fp'), 22, { bold: true }); P.text(fp, 22, { mono: true, color: '#2d6a36' });
  P.y += 6; P.text(t('ev_p_howto'), 20, { color: '#57606a' });
  // подписи
  const sy = Math.max(P.y + 30, PH - 440); const bw = (PW - P.M * 2 - 40) / 2; const ctx = P.ctx;
  [[t('ev_p_author') + ': ' + (author || ''), sig1], [t('ev_p_party').replace(/\s*[（(].*[)）]\s*$/, '') + ': ' + (party || ''), sig2]].forEach(([lbl, sig], k) => {
    const bx = isRTL() ? PW - P.M - bw - k * (bw + 40) : P.M + k * (bw + 40);
    ctx.strokeStyle = '#8c959f'; ctx.lineWidth = 2; ctx.strokeRect(bx, sy, bw, 250);
    if (sig) ctx.drawImage(sig, bx + 10, sy + 10, bw - 20, 190);
    ctx.font = '400 20px system-ui, sans-serif'; ctx.fillStyle = '#1b1f23'; ctx.textAlign = 'center'; ctx.fillText(lbl, bx + bw / 2, sy + 214);
  });
  footer(P, PW, PH, 1, total); pages.push({ cv: P.cv, text: ['Report fingerprint SHA-256: ' + fp, 'Journal head: ' + lastH] });
  // --- по 2 снимки на страница, с воден знак и данни ---
  for (let p = 0; p < items.length; p += 2) {
    const Q = pageCtx(PW, PH); const txt = [];
    for (const it of items.slice(p, p + 2)) {
      const idx = items.indexOf(it) + 1;
      Q.text(`${idx}. ${itemLabel(it)}`, 28, { bold: true }); Q.y += 4;
      const wm = await watermarkCanvas(it, c, 1400);
      const maxW = PW - Q.M * 2, maxH = 520; const s = Math.min(maxW / wm.width, maxH / wm.height);
      const dw = Math.round(wm.width * s), dh = Math.round(wm.height * s);
      Q.ctx.drawImage(wm, Math.round((PW - dw) / 2), Q.y, dw, dh); Q.y += dh + 12;
      Q.text(`${t('ev_added_at')}: ${fmtTime(it.added)}${it.taken ? ' · ' + t('ev_taken') + ': ' + it.taken : ''}`, 20, {});
      Q.text(`${t('ev_location')}: ${placeText(it, c) || t('ev_no_loc')}${it.device ? ' · ' + t('ev_device') + ': ' + it.device : ''}${it.meter ? ' · ' + t('ev_meter_val') + ': ' + it.meter : ''}`, 20, {});
      Q.text('SHA-256 ' + it.sha + ' · #' + (it.n || '?'), 18, { mono: true, color: '#2d6a36' });
      Q.y += 24; txt.push(`Photo ${idx} SHA-256: ${it.sha} (journal #${it.n || '?'})`);
    }
    footer(Q, PW, PH, pages.length + 1, total); pages.push({ cv: Q.cv, text: txt });
  }
  // --- сглобяване с pdf-lib: страницата е JPEG, отпечатъците — истински текст (Helvetica, ASCII) ---
  const pdf = await PDFDocument.create(); const helv = await pdf.embedFont(StandardFonts.Helvetica);
  for (const pg of pages) {
    const jpg = await pdf.embedJpg(new Uint8Array(await (await canvasBlob(pg.cv, 'image/jpeg', 0.86)).arrayBuffer()));
    const page = pdf.addPage([595.28, 841.89]); page.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 });
    pg.text.forEach((s, i) => page.drawText(s, { x: 24, y: 22 - i * 7 + (pg.text.length - 1) * 7, size: 5.2, font: helv, color: rgb(0.35, 0.35, 0.35) }));
  }
  try { pdf.setTitle(t('ev_p_title') + ' — ' + c.title); pdf.setSubject('SHA-256 ' + fp); pdf.setKeywords(items.map((i) => i.sha)); pdf.setProducer('Pupikes Photo Evidence'); pdf.setCreator('Pupikes Photo Evidence'); pdf.setAuthor(author || ''); } catch (e) {}
  const bytes = await pdf.save();
  const psha = await sha256Hex(bytes);
  const name = 'evidence-' + c.title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) + '.pdf';
  await saveFile(name, new Blob([bytes], { type: 'application/pdf' }), 'application/pdf');
  await appendLog('pdf', c.id, '', psha, c.title);
  return { pages: pages.length, sha: psha };
}

// Подпис с пръст (canvas, бял фон → излиза чисто в PDF-а).
function sigPad(cv) {
  const ctx = cv.getContext('2d'); let drawing = false, empty = true, last = null;
  const clear = () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height); empty = true; };
  clear();
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
  cv.addEventListener('pointerdown', (e) => { drawing = true; last = pt(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
  cv.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pt(e); ctx.strokeStyle = '#0b2e8a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; empty = false; e.preventDefault(); });
  const up = () => { drawing = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  return { clear, isEmpty: () => empty, canvas: cv };
}

// Стилове само за този екран (не пипаме общия styles.css — той е различен в двете издания).
function injectCss() {
  if (document.getElementById('ev-css')) return;
  const s = document.createElement('style'); s.id = 'ev-css';
  s.textContent = `
  .ev-row{display:flex;gap:10px;align-items:center}
  .ev-case{background:var(--bg-2);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px;cursor:pointer}
  .ev-case .th{display:flex;gap:6px;margin-top:8px}.ev-case .th img{width:56px;height:42px;object-fit:cover;border-radius:6px}
  .ev-item{display:flex;gap:10px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px;margin-top:8px;cursor:pointer}
  .ev-item img{width:78px;height:58px;object-fit:cover;border-radius:6px;flex:none}
  .ev-chip{display:inline-block;font-size:.72em;font-weight:700;padding:2px 8px;border-radius:9px;background:var(--bg-3);color:var(--accent-2);margin-inline-end:6px}
  .ev-chip.s{color:var(--text-dim);border:1px solid var(--line);background:transparent}
  .ev-sha{font-family:monospace;font-size:.74em;color:#7ee787;word-break:break-all}
  .ev-ok{background:rgba(46,160,67,.15);border:1px solid rgba(46,160,67,.45);color:#56d364;border-radius:10px;padding:10px;font-size:.88em;margin-top:10px}
  .ev-bad{background:rgba(248,81,73,.13);border:1px solid rgba(248,81,73,.45);color:#ff7b72;border-radius:10px;padding:10px;font-size:.88em;margin-top:10px}
  .ev-warn{background:rgba(210,153,34,.13);border:1px solid rgba(210,153,34,.45);color:#e3b341;border-radius:10px;padding:10px;font-size:.88em;margin-top:10px}
  .ev-img{width:100%;height:auto;border-radius:10px;display:block;margin-top:8px}
  .ev-log{border-bottom:1px dashed var(--line);padding:7px 0;font-size:.84em}
  .ev-sig{width:100%;height:120px;background:#fff;border-radius:8px;touch-action:none;display:block}
  .ev-btns{display:flex;gap:8px;flex-wrap:wrap}.ev-btns .btn{flex:1;min-width:130px}
  `;
  document.head.appendChild(s);
}

// ---------- Екран ----------
export function render(root) {
  injectCss();
  let tab = 'cases';
  const view = { caseId: null, itemId: null, pdf: false };
  root.innerHTML = `
    <div class="tabs" id="ev-tabs">${['cases', 'verify', 'log', 'set'].map((k) => `<button class="tab${k === tab ? ' active' : ''}" data-tab="${k}">${esc(t('ev_tab_' + k))}</button>`).join('')}</div>
    <div id="ev-body"><div class="hint">${esc(t('ev_loading_s'))}</div></div>`;
  const body = root.querySelector('#ev-body');
  const $ = (s) => body.querySelector(s);
  root.querySelectorAll('#ev-tabs .tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; view.caseId = view.itemId = null; view.pdf = false; draw(); }));
  ensureDb().then(draw);

  function draw() {
    if (!db) return;
    root.querySelectorAll('#ev-tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    window.scrollTo(0, 0);
    if (tab === 'verify') drawVerify(); else if (tab === 'log') drawLog(); else if (tab === 'set') drawSet();
    else if (view.itemId) drawItem(); else if (view.pdf) drawPdf(); else if (view.caseId) drawCase(); else drawCases();
  }
  const kindOpts = (sel) => KINDS.map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(t('ev_k_' + k))}</option>`).join('');
  const tagOpts = (sel) => TAGS.map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(t('ev_t_' + k))}</option>`).join('');
  async function chainInto(el) { const r = await verifyAll(); if (el && el.isConnected) { el.className = r.ok ? 'ev-ok' : 'ev-bad'; el.textContent = (r.ok ? '✓ ' : '✗ ') + chainText(r); } return r; }

  // --- Дела ---
  function drawCases() {
    const nPhotos = allItems().length; const hasSample = db.cases.some((c) => c.sample);
    body.innerHTML = `
      <div class="tool-card">
        <p class="hint" style="margin-top:0">${esc(t('ev_intro'))}</p>
        <div style="margin-top:8px;font-weight:700">${esc(tf('ev_stats', db.cases.length, nPhotos, db.log.length))} <span id="ev-cst"></span></div>
        <button class="btn" id="ev-new">${esc(t('ev_new_case'))}</button>
        <div id="ev-form" hidden>
          <label>${esc(t('ev_case_title'))}</label><input id="ev-ct" placeholder="${esc(t('ev_case_title_ph'))}" />
          <label>${esc(t('ev_kind'))}</label><select id="ev-ck">${kindOpts('rent')}</select>
          <label>${esc(t('ev_place'))}</label><input id="ev-cp" placeholder="${esc(t('ev_place_ph'))}" />
          <div class="ev-btns"><button class="btn" id="ev-csave">${esc(t('ev_save'))}</button><button class="btn sec" id="ev-ccancel">${esc(t('ev_cancel'))}</button></div>
        </div>
      </div>
      ${hasSample ? `<div class="hint" style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:0 0 10px"><span>${esc(t('ev_sample_note'))}</span><button class="btn inline sec" id="ev-delsamples" style="margin:0;padding:8px 12px;font-size:.85em;white-space:nowrap">${esc(t('ev_sample_del'))}</button></div>` : ''}
      <div id="ev-cases">${db.cases.length ? db.cases.slice().reverse().map((c) => `
        <div class="ev-case" data-id="${c.id}">
          <div style="font-weight:700">${esc(c.title)}${c.sample ? ` <span class="ev-chip s">${esc(t('ev_sample_badge'))}</span>` : ''}</div>
          <div class="hint" style="margin-top:2px">${esc(t('ev_k_' + c.kind))} · ${esc(tf('ev_photos_n', c.items.length))} · ${esc(fmtTime(c.created))}</div>
          <div class="th">${c.items.slice(0, 5).map((it) => `<img src="${it.thumb}" alt="" />`).join('')}</div>
        </div>`).join('') : `<div class="empty">${esc(t('ev_empty'))}</div>`}</div>`;
    verifyAll().then((r) => { const el = $('#ev-cst'); if (el) { el.textContent = r.ok ? t('ev_chain_ok_short') : t('ev_chain_bad_short'); el.style.color = r.ok ? 'var(--ok)' : 'var(--err)'; } });
    $('#ev-new').onclick = () => { $('#ev-form').hidden = false; $('#ev-new').hidden = true; $('#ev-ct').focus(); };
    $('#ev-ccancel').onclick = () => { $('#ev-form').hidden = true; $('#ev-new').hidden = false; };
    $('#ev-csave').onclick = async () => {
      const title = $('#ev-ct').value.trim(); if (!title) { $('#ev-ct').focus(); return; }
      const c = { id: uid('c'), title, kind: $('#ev-ck').value, place: $('#ev-cp').value.trim(), created: nowISO(), sample: false, items: [] };
      db.cases.push(c); saveDb(); await appendLog('case', c.id, '', '', title);
      view.caseId = c.id; draw();
    };
    const ds = $('#ev-delsamples'); if (ds) ds.onclick = async () => { for (const c of db.cases.filter((x) => x.sample)) await removeCase(c); draw(); };
    body.querySelectorAll('.ev-case').forEach((el) => el.addEventListener('click', () => { view.caseId = el.dataset.id; draw(); }));
  }
  async function removeCase(c) {
    for (const it of c.items) await delBlob(it.key);
    db.cases = db.cases.filter((x) => x.id !== c.id); saveDb();
    await appendLog('delcase', c.id, '', '', c.title + ' (' + c.items.length + ')');
  }

  // --- Едно дело ---
  function meterLine(c) {
    const m = c.items.filter((it) => it.tag === 'meter' && it.meter && isFinite(parseFloat(String(it.meter).replace(',', '.')))).sort((a, b) => a.added.localeCompare(b.added));
    if (m.length < 2) return '';
    const a = parseFloat(m[0].meter.replace(',', '.')), b = parseFloat(m[m.length - 1].meter.replace(',', '.'));
    const d = Math.round((b - a) * 1000) / 1000;
    return tf('ev_meters', m[0].meter, m[m.length - 1].meter, (d > 0 ? '+' : '') + d);
  }
  function drawCase() {
    const c = findCase(view.caseId); if (!c) { view.caseId = null; drawCases(); return; }
    const ml = meterLine(c);
    body.innerHTML = `
      <button class="btn inline sec" id="ev-back" style="margin:0 0 10px">${esc(t('ev_back_cases'))}</button>
      <div class="tool-card">
        <div style="font-size:1.12em;font-weight:700">${esc(c.title)}${c.sample ? ` <span class="ev-chip s">${esc(t('ev_sample_badge'))}</span>` : ''}</div>
        <div class="hint">${esc(t('ev_k_' + c.kind))}${c.place ? ' · ' + esc(c.place) : ''} · ${esc(fmtTime(c.created))}</div>
        ${ml ? `<div class="ev-warn">${esc(ml)}</div>` : ''}
        <div style="margin-top:12px;font-weight:700">${esc(t('ev_add_title'))}</div>
        <label>${esc(t('ev_tag'))}</label><select id="ev-tag">${tagOpts('before')}</select>
        <div id="ev-mwrap" hidden><label>${esc(t('ev_meter_val'))}</label><input id="ev-meter" inputmode="decimal" placeholder="04512.7" /></div>
        <label>${esc(t('ev_note'))}</label><input id="ev-note" placeholder="${esc(t('ev_note_ph'))}" />
        <div class="ev-btns"><button class="btn" id="ev-cambtn">${esc(t('ev_camera'))}</button><button class="btn sec" id="ev-galbtn">${esc(t('ev_gallery'))}</button></div>
        <input type="file" id="ev-cam" accept="image/*" capture="environment" hidden />
        <input type="file" id="ev-gal" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden />
        <div class="hint" id="ev-st"></div>
      </div>
      <div class="tool-card" id="ev-items">${c.items.length ? c.items.slice().reverse().map((it) => `
        <div class="ev-item" data-id="${it.id}">
          <img src="${it.thumb}" alt="" />
          <div style="min-width:0;flex:1">
            <div><span class="ev-chip">${esc(t('ev_t_' + it.tag))}</span>${it.sample ? `<span class="ev-chip s">${esc(t('ev_sample_badge'))}</span>` : ''}${it.meter ? `<b>${esc(it.meter)}</b>` : ''}</div>
            <div style="font-size:.88em;margin-top:2px">${esc(it.note || '')}</div>
            <div class="hint" style="margin-top:2px">${esc(fmtTime(it.added))}${it.lat != null ? ' · 📍' : ''} · #${it.n || '?'}</div>
            <div class="ev-sha">SHA-256 ${esc(shortSha(it.sha))}</div>
          </div>
        </div>`).join('') : `<div class="hint">${esc(t('ev_no_photos'))}</div>`}
        <div class="ev-btns" style="margin-top:6px"><button class="btn" id="ev-pdf"${c.items.length ? '' : ' disabled'}>${esc(t('ev_pdf_btn'))}</button><button class="btn sec" id="ev-delcase">${esc(t('ev_del_case'))}</button></div>
      </div>`;
    $('#ev-back').onclick = () => { view.caseId = null; draw(); };
    const tagSel = $('#ev-tag'); tagSel.onchange = () => { $('#ev-mwrap').hidden = tagSel.value !== 'meter'; };
    $('#ev-cambtn').onclick = () => $('#ev-cam').click();
    $('#ev-galbtn').onclick = () => $('#ev-gal').click();
    const onFiles = async (inp) => {
      const files = Array.from(inp.files || []); inp.value = ''; if (!files.length) return;
      const st = $('#ev-st'); let pos = null;
      if (set.gps) { pos = await getPosition(); if (!pos && st) st.textContent = t('ev_gps_fail'); }
      let n = 0;
      for (let i = 0; i < files.length; i++) {
        if (st) st.textContent = tf('ev_adding', i + 1, files.length);
        try {
          if (!files[i].size) throw new Error('empty');
          await addItem(c, files[i], { name: files[i].name, tag: tagSel.value, note: $('#ev-note') ? $('#ev-note').value.trim() : '', meter: tagSel.value === 'meter' && $('#ev-meter') ? $('#ev-meter').value.trim() : '', pos }); n++;
        } catch (e) { if (st) st.textContent = t('ev_err_read'); }
      }
      c.sample = c.sample && n === 0; saveDb();
      drawCase(); const s2 = $('#ev-st'); if (s2 && n) s2.textContent = tf('ev_added', n) + (set.gps && !pos ? ' ' + t('ev_gps_fail') : '');
    };
    $('#ev-cam').onchange = (e) => onFiles(e.target);
    $('#ev-gal').onchange = (e) => onFiles(e.target);
    $('#ev-pdf').onclick = () => { view.pdf = true; draw(); };
    $('#ev-delcase').onclick = async () => { if (!confirm(t('ev_del_case_q'))) return; await removeCase(c); view.caseId = null; draw(); };
    body.querySelectorAll('.ev-item').forEach((el) => el.addEventListener('click', () => { view.itemId = el.dataset.id; draw(); }));
  }

  // --- Една снимка: воден знак + данни ---
  function drawItem() {
    const c = findCase(view.caseId); const it = c && c.items.find((x) => x.id === view.itemId);
    if (!it) { view.itemId = null; draw(); return; }
    const row = (k, v, cls) => `<div class="line" style="gap:10px"><span>${esc(k)}</span><span class="${cls || ''}" style="text-align:end;min-width:0">${esc(v)}</span></div>`;
    body.innerHTML = `
      <button class="btn inline sec" id="ev-back" style="margin:0 0 10px">${esc(t('ev_back_case'))}</button>
      <div class="tool-card">
        <div style="font-weight:700">${esc(itemLabel(it))}${it.sample ? ` <span class="ev-chip s">${esc(t('ev_sample_badge'))}</span>` : ''}</div>
        <div class="hint">${esc(t('ev_wm_preview'))}</div>
        <div id="ev-wm"><div class="hint">${esc(t('loading'))}</div></div>
        <div class="out-block" style="margin-top:12px">
          ${row(t('ev_sha'), it.sha, 'ev-sha')}
          ${row(t('ev_added_at'), fmtTime(it.added))}
          ${row(t('ev_taken'), it.taken || '—')}
          ${row(t('ev_device'), it.device || '—')}
          ${row(t('ev_location'), placeText(it, c) || t('ev_no_loc'))}
          ${it.meter ? row(t('ev_meter_val'), it.meter) : ''}
          ${row(t('ev_size'), fmtSize(it.size) + ' · ' + it.w + '×' + it.h)}
          ${row(t('ev_entry'), '#' + (it.n || '?'))}
        </div>
        <label>${esc(t('ev_note'))}</label>
        <div class="ev-row"><input id="ev-inote" value="${esc(it.note)}" /><button class="btn inline sec" id="ev-snote" style="margin:0">${esc(t('ev_save'))}</button></div>
        <div class="ev-btns" style="margin-top:4px"><button class="btn" id="ev-savewm">${esc(t('ev_save_wm'))}</button><button class="btn sec" id="ev-saveorig">${esc(t('ev_save_orig'))}</button></div>
        <button class="btn sec" id="ev-delphoto">${esc(t('ev_del_photo'))}</button>
        <div class="hint" id="ev-ist" style="word-break:break-all"></div>
      </div>`;
    let wmCv = null;
    watermarkCanvas(it, c, 1600).then((cv) => { wmCv = cv; const box = $('#ev-wm'); if (box) { box.innerHTML = ''; cv.className = 'ev-img'; box.appendChild(cv); } })
      .catch(() => { const box = $('#ev-wm'); if (box) box.innerHTML = `<div class="ev-bad">${esc(tf('ev_l_bad_photo', itemLabel(it)))}</div>`; });
    $('#ev-back').onclick = () => { view.itemId = null; draw(); };
    $('#ev-snote').onclick = async () => { it.note = $('#ev-inote').value.trim(); saveDb(); await appendLog('note', c.id, it.id, it.sha, it.note); $('#ev-ist').textContent = t('ev_s_saved'); };
    $('#ev-savewm').onclick = async () => {
      const cv = wmCv || await watermarkCanvas(it, c, 1600); const b = await canvasBlob(cv, 'image/jpeg', 0.92); const s = await sha256Hex(b);
      const name = (it.name.replace(/\.[^.]+$/, '') || 'photo') + '-evidence.jpg';
      await saveFile(name, b, 'image/jpeg'); await appendLog('export', c.id, it.id, s, name);
      $('#ev-ist').textContent = tf('ev_saved_fp', s);
    };
    $('#ev-saveorig').onclick = async () => { const b = await getBlob(it.key); if (!b) return; await saveFile(it.name, b, it.type); await appendLog('orig', c.id, it.id, it.sha, it.name); $('#ev-ist').textContent = tf('ev_saved_fp', it.sha); };
    $('#ev-delphoto').onclick = async () => {
      if (!confirm(t('ev_del_photo_q'))) return;
      await delBlob(it.key); c.items = c.items.filter((x) => x.id !== it.id); saveDb();
      await appendLog('del', c.id, it.id, it.sha, c.title + ' · ' + itemLabel(it));
      view.itemId = null; draw();
    };
  }

  // --- PDF протокол ---
  function drawPdf() {
    const c = findCase(view.caseId); if (!c) { view.pdf = false; draw(); return; }
    body.innerHTML = `
      <button class="btn inline sec" id="ev-back" style="margin:0 0 10px">${esc(t('ev_back_case'))}</button>
      <div class="tool-card">
        <div style="font-size:1.1em;font-weight:700">${esc(t('ev_p_title'))}</div>
        <div class="hint">${esc(c.title)} · ${esc(tf('ev_photos_n', c.items.length))}</div>
        <label>${esc(t('ev_p_author'))}</label><input id="ev-pa" value="${esc(set.author)}" />
        <label>${esc(t('ev_p_sign'))}</label><canvas class="ev-sig" id="ev-sg1" width="600" height="200"></canvas>
        <button class="btn inline sec" id="ev-sc1" style="margin-top:6px">${esc(t('ev_p_clear'))}</button>
        <label>${esc(t('ev_p_party'))}</label><input id="ev-pp" />
        <label>${esc(t('ev_p_sign2'))}</label><canvas class="ev-sig" id="ev-sg2" width="600" height="200"></canvas>
        <button class="btn inline sec" id="ev-sc2" style="margin-top:6px">${esc(t('ev_p_clear'))}</button>
        <button class="btn" id="ev-mkpdf">${esc(t('ev_p_make'))}</button>
        <div class="hint" id="ev-pst" style="word-break:break-all"></div>
      </div>`;
    const s1 = sigPad($('#ev-sg1')), s2 = sigPad($('#ev-sg2'));
    $('#ev-sc1').onclick = s1.clear; $('#ev-sc2').onclick = s2.clear;
    $('#ev-back').onclick = () => { view.pdf = false; draw(); };
    $('#ev-mkpdf').onclick = async () => {
      const btn = $('#ev-mkpdf'); const st = $('#ev-pst'); btn.disabled = true; st.textContent = t('ev_p_making');
      set.author = $('#ev-pa').value.trim(); saveSet();
      try { const r = await makePdf(c, set.author, $('#ev-pp').value.trim(), s1.isEmpty() ? null : s1.canvas, s2.isEmpty() ? null : s2.canvas); st.textContent = tf('ev_p_done', r.pages, r.sha); }
      catch (e) { st.textContent = t('load_error') + ' ' + (e && e.message ? e.message : ''); }
      btn.disabled = false;
    };
  }

  // --- Проверка ---
  function drawVerify() {
    const tryIt = allItems().find(({ it }) => it.sk === 'wall');
    body.innerHTML = `
      <div class="tool-card">
        <p class="hint" style="margin-top:0">${esc(t('ev_v_intro'))}</p>
        <button class="btn" id="ev-vpick">${esc(t('ev_v_pick'))}</button>
        <input type="file" id="ev-vfile" accept="image/*" hidden />
        ${tryIt ? `<button class="btn sec" id="ev-try">${esc(t('ev_v_try'))}</button>` : ''}
        <div id="ev-vres"></div>
      </div>`;
    $('#ev-vpick').onclick = () => $('#ev-vfile').click();
    $('#ev-vfile').onchange = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) check(f, f.name, null); };
    if (tryIt) $('#ev-try').onclick = async () => { const b = await retouchedSample(tryIt.it); check(b, t('ev_v_try_name'), tryIt.it.id); };
  }
  async function check(blob, name, prefId) {
    const res = $('#ev-vres'); if (!res) return;
    res.innerHTML = `<div class="hint">${esc(t('loading'))}</div>`;
    const s = await sha256Hex(blob);
    let html = `<div class="hint" style="margin-top:12px">${esc(name)} · ${esc(fmtSize(blob.size))}</div><div class="hint">${esc(t('ev_v_hash'))}</div><div class="ev-sha">${esc(s)}</div>`;
    const hit = allItems().find(({ it }) => it.sha === s);
    if (hit) { res.innerHTML = html + `<div class="ev-ok">${esc(tf('ev_v_match', itemLabel(hit.it), hit.c.title, fmtTime(hit.it.added), hit.it.n || '?'))}</div>`; return; }
    const addE = db.log.find((e) => e.act === 'add' && e.sha === s);
    if (addE) { const del = db.log.find((e) => (e.act === 'del' && e.i === addE.i) || (e.act === 'delcase' && e.c === addE.c)); res.innerHTML = html + `<div class="ev-warn">${esc(tf('ev_v_match_del', del ? del.d : '', del ? fmtTime(del.ts) : ''))}</div>`; return; }
    const list = allItems();
    html += `<div class="ev-bad">${esc(t('ev_v_nomatch'))}</div>`;
    if (!list.length) { res.innerHTML = html; return; }
    const pre = prefId || list[list.length - 1].it.id;
    html += `<label>${esc(t('ev_v_cmp_with'))}</label><select id="ev-vorig">${list.map(({ c, it }) => `<option value="${it.id}"${it.id === pre ? ' selected' : ''}>${esc(c.title + ' — ' + itemLabel(it) + ' — ' + fmtTime(it.added))}</option>`).join('')}</select>
      <button class="btn" id="ev-vcmp">${esc(t('ev_v_cmp_btn'))}</button><div id="ev-vdiff"></div>`;
    res.innerHTML = html;
    const run = async () => {
      const id = $('#ev-vorig').value; const o = list.find((x) => x.it.id === id); const box = $('#ev-vdiff'); if (!o || !box) return;
      box.innerHTML = `<div class="hint">${esc(t('loading'))}</div>`;
      try {
        const d = await diffMap(await getBlob(o.it.key), blob);
        box.innerHTML = `<div class="${d.kind === 'same' ? 'ev-ok' : d.kind === 'local' ? 'ev-warn' : 'ev-bad'}"><b>${esc(tf('ev_v_diff_pct', d.pct))}</b><br>${esc(t(d.kind === 'same' ? 'ev_v_same' : d.kind === 'local' ? 'ev_v_local' : 'ev_v_global'))}</div>
          <div class="hint">${esc(tf('ev_v_sizes', d.aDims, d.bDims))} · ${esc(t('ev_v_legend'))}</div>`;
        d.canvas.className = 'ev-img'; box.appendChild(d.canvas);
      } catch (e) { box.innerHTML = `<div class="ev-bad">${esc(t('ev_err_read'))}</div>`; }
    };
    $('#ev-vcmp').onclick = run;
    if (prefId) run();
  }

  // --- Дневник ---
  function drawLog() {
    const rows = db.log.slice().reverse().slice(0, 300);
    const caseName = (id) => { const c = findCase(id); return c ? c.title : ''; };
    body.innerHTML = `
      <div class="tool-card">
        <p class="hint" style="margin-top:0">${esc(t('ev_l_intro'))}</p>
        <div id="ev-lst" class="ev-ok">${esc(t('loading'))}</div>
        <div class="ev-btns"><button class="btn sec" id="ev-lre">${esc(t('ev_l_recheck'))}</button><button class="btn sec" id="ev-lexp">${esc(t('ev_l_export'))}</button></div>
      </div>
      <div class="tool-card">${rows.map((e) => `
        <div class="ev-log" data-n="${e.n}">
          <div><b>#${e.n}</b> · ${esc(t(ACTS[e.act] || 'ev_a_add'))} · <span class="hint">${esc(fmtTime(e.ts))}</span></div>
          <div style="opacity:.9">${esc(e.d || caseName(e.c))}</div>
          ${e.sha ? `<div class="ev-sha">SHA-256 ${esc(shortSha(e.sha))}</div>` : ''}
          <div class="hint" style="font-family:monospace;font-size:.72em">h ${esc(e.h.slice(0, 16))}… ← ${esc(e.prev.slice(0, 16))}…</div>
        </div>`).join('')}</div>`;
    const recheck = async () => { const r = await chainInto($('#ev-lst')); if (r.badEntry) { const el = body.querySelector(`.ev-log[data-n="${r.badEntry}"]`); if (el) el.style.background = 'rgba(248,81,73,.15)'; } };
    recheck();
    $('#ev-lre').onclick = recheck;
    $('#ev-lexp').onclick = async () => {
      const data = { app: 'Pupikes Photo Evidence', exported: nowISO(), head: db.log.length ? db.log[db.log.length - 1].h : ZERO,
        cases: db.cases.map((c) => ({ id: c.id, title: c.title, kind: c.kind, place: c.place, created: c.created, photos: c.items.map((it) => ({ id: it.id, sha256: it.sha, tag: it.tag, note: it.note, meter: it.meter, recorded: it.added, taken: it.taken, lat: it.lat, lon: it.lon, journal: it.n })) })),
        journal: db.log };
      await saveFile('evidence-journal.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), 'application/json');
    };
  }

  // --- Настройки ---
  function drawSet() {
    body.innerHTML = `
      <div class="tool-card">
        <label class="check"><input type="checkbox" id="ev-gps"${set.gps ? ' checked' : ''} /> ${esc(t('ev_s_gps'))}</label>
        <p class="hint">${esc(t('ev_s_gps_hint'))}</p>
        <label class="check"><input type="checkbox" id="ev-wmp"${set.wmPlace ? ' checked' : ''} /> ${esc(t('ev_s_wm_place'))}</label>
        <label class="check"><input type="checkbox" id="ev-wmh"${set.wmHash ? ' checked' : ''} /> ${esc(t('ev_s_wm_hash'))}</label>
        <label>${esc(t('ev_s_author'))}</label><input id="ev-auth" value="${esc(set.author)}" />
        <div class="hint" id="ev-sst"></div>
        <div class="hint" id="ev-use" style="margin-top:12px"></div>
      </div>`;
    const done = () => { saveSet(); $('#ev-sst').textContent = t('ev_s_saved'); };
    $('#ev-gps').onchange = async (e) => { set.gps = e.target.checked; done(); if (set.gps) { const p = await getPosition(); if (!p) $('#ev-sst').textContent = t('ev_gps_fail'); } };
    $('#ev-wmp').onchange = (e) => { set.wmPlace = e.target.checked; done(); };
    $('#ev-wmh').onchange = (e) => { set.wmHash = e.target.checked; done(); };
    $('#ev-auth').onchange = (e) => { set.author = e.target.value.trim(); done(); };
    blobUsage(allItems().map(({ it }) => it.key)).then((u) => { const el = $('#ev-use'); if (el) el.textContent = tf('ev_s_storage', u.count, fmtSize(u.bytes)); });
  }
}
