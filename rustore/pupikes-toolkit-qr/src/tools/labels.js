// Version: 1.0026
// „QR етикети за дома и инвентара" — НОВА СЪРЦЕВИНА (Huawei 4.3, 11.09.2026).
// Всеки предмет/кутия/ключ/лекарство/документ получава собствен QR етикет (уникален код PQL-XXXXXX).
// Листът с етикети се печата на A4/Letter при 300 DPI (PNG или PDF през pdf-lib), етикетът се залепя,
// а сканирането му (камера / снимка / ръчен код) отваря КАРТАТА на предмета: снимка, място/кутия,
// категория, срок на годност, кой го е взел назаем и кога да го върне, бележки. Списък с търсене и
// филтри, история на заемите, напомняне за срок (LocalNotifications + лента в апа).
// Изцяло на устройството (localStorage) — нищо не се праща никъде. При първо пускане има ясно
// маркирани ПРИМЕРНИ предмети с бутон за изтриване.
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { esc, downloadBlob } from '../core/ui.js';
import { saveFile } from '../core/filesave.js';
import { pickBinaryFile } from '../core/filepick.js';
import { t, tf, register } from '../core/i18n.js';

register({
  lb_tab_items: { bg:'Предмети', ru:'Предметы', uk:'Предмети', en:'Items', de:'Gegenstände', fr:'Objets', es:'Objetos', 'es-MX':'Objetos', it:'Oggetti', pt:'Itens', ar:'الأغراض', hi:'वस्तुएँ', ja:'アイテム', ky:'Буюмдар', 'zh-Hant':'物品' },
  lb_tab_scan: { bg:'Сканирай', ru:'Сканировать', uk:'Сканувати', en:'Scan', de:'Scannen', fr:'Scanner', es:'Escanear', 'es-MX':'Escanear', it:'Scansiona', pt:'Digitalizar', ar:'مسح', hi:'स्कैन', ja:'スキャン', ky:'Сканерлөө', 'zh-Hant':'掃描' },
  lb_tab_print: { bg:'Печат', ru:'Печать', uk:'Друк', en:'Print', de:'Drucken', fr:'Imprimer', es:'Imprimir', 'es-MX':'Imprimir', it:'Stampa', pt:'Imprimir', ar:'طباعة', hi:'प्रिंट', ja:'印刷', ky:'Басып чыгаруу', 'zh-Hant':'列印' },
  lb_tab_lend: { bg:'Назаем', ru:'Взаймы', uk:'Позичено', en:'Lent', de:'Verliehen', fr:'Prêtés', es:'Prestados', 'es-MX':'Prestados', it:'In prestito', pt:'Emprestados', ar:'مُعار', hi:'उधार', ja:'貸出中', ky:'Карызга', 'zh-Hant':'外借' },
  lb_intro: { bg:'Всеки предмет, кутия, ключ, лекарство или документ получава QR етикет. Отпечатай листа, залепи етикетите и сканирай — виждаш къде е, срока и кой го е взел.', ru:'Каждый предмет, коробка, ключ, лекарство или документ получает QR-этикетку. Распечатай лист, наклей этикетки и сканируй — видно, где вещь, срок и кто её взял.', uk:'Кожен предмет, коробка, ключ, ліки чи документ отримує QR-етикетку. Роздрукуй аркуш, наклей етикетки і скануй — видно, де річ, термін і хто її взяв.', en:'Every item, box, key, medicine or document gets a QR label. Print the sheet, stick the labels on and scan — you see where it is, its expiry date and who borrowed it.', de:'Jeder Gegenstand, Karton, Schlüssel, jedes Medikament oder Dokument bekommt ein QR-Etikett. Bogen drucken, aufkleben, scannen — du siehst, wo es ist, das Ablaufdatum und wer es ausgeliehen hat.', fr:'Chaque objet, boîte, clé, médicament ou document reçoit une étiquette QR. Imprime la feuille, colle les étiquettes et scanne : tu vois où il est, sa date limite et qui l’a emprunté.', es:'Cada objeto, caja, llave, medicamento o documento recibe una etiqueta QR. Imprime la hoja, pega las etiquetas y escanea: ves dónde está, su caducidad y quién lo tiene prestado.', 'es-MX':'Cada objeto, caja, llave, medicamento o documento recibe una etiqueta QR. Imprime la hoja, pega las etiquetas y escanea: ves dónde está, su caducidad y quién lo tiene prestado.', it:'Ogni oggetto, scatola, chiave, medicinale o documento riceve un’etichetta QR. Stampa il foglio, attacca le etichette e scansiona: vedi dov’è, la scadenza e chi l’ha preso in prestito.', pt:'Cada item, caixa, chave, medicamento ou documento recebe uma etiqueta QR. Imprime a folha, cola as etiquetas e digitaliza — vês onde está, a validade e quem o pediu emprestado.', ar:'كل غرض أو صندوق أو مفتاح أو دواء أو مستند يحصل على ملصق QR. اطبع الورقة، ألصق الملصقات وامسحها — ترى أين هو، تاريخ انتهائه ومن استعاره.', hi:'हर वस्तु, डिब्बा, चाबी, दवा या दस्तावेज़ को QR लेबल मिलता है। शीट प्रिंट करें, लेबल चिपकाएँ और स्कैन करें — पता चलेगा कहाँ है, अवधि कब खत्म है और किसने उधार लिया है।', ja:'すべての物・箱・鍵・薬・書類にQRラベルを付けます。シートを印刷して貼り、スキャンすれば、場所・期限・誰が借りているかが分かります。', ky:'Ар бир буюм, куту, ачкыч, дары же документ QR этикетка алат. Барагын басып чыгар, этикеткаларды чаптап, сканерле — кайда экени, мөөнөтү жана ким алганы көрүнөт.', 'zh-Hant':'每件物品、箱子、鑰匙、藥品或文件都有自己的 QR 標籤。列印標籤紙、貼上並掃描，即可看到位置、有效期限與借用人。' },
  lb_search_ph: { bg:'Търси по име, място, бележка…', ru:'Поиск по названию, месту, заметке…', uk:'Пошук за назвою, місцем, нотаткою…', en:'Search by name, place, note…', de:'Suche nach Name, Ort, Notiz…', fr:'Rechercher par nom, lieu, note…', es:'Buscar por nombre, lugar, nota…', 'es-MX':'Buscar por nombre, lugar, nota…', it:'Cerca per nome, luogo, nota…', pt:'Pesquisar por nome, local, nota…', ar:'ابحث بالاسم أو المكان أو الملاحظة…', hi:'नाम, जगह, नोट से खोजें…', ja:'名前・場所・メモで検索…', ky:'Аты, орду, эскертүү боюнча изде…', 'zh-Hant':'依名稱、位置、備註搜尋…' },
  lb_f_all: { bg:'Всички', ru:'Все', uk:'Усі', en:'All', de:'Alle', fr:'Tous', es:'Todos', 'es-MX':'Todos', it:'Tutti', pt:'Todos', ar:'الكل', hi:'सभी', ja:'すべて', ky:'Баары', 'zh-Hant':'全部' },
  lb_f_lent: { bg:'Назаем', ru:'Взаймы', uk:'Позичено', en:'Lent out', de:'Verliehen', fr:'Prêtés', es:'Prestados', 'es-MX':'Prestados', it:'In prestito', pt:'Emprestados', ar:'مُعار', hi:'उधार', ja:'貸出中', ky:'Карызга', 'zh-Hant':'外借中' },
  lb_f_exp: { bg:'Изтичащи', ru:'Истекают', uk:'Спливають', en:'Expiring', de:'Ablaufend', fr:'Expirant', es:'Por caducar', 'es-MX':'Por caducar', it:'In scadenza', pt:'A expirar', ar:'تنتهي قريبًا', hi:'समाप्त हो रहे', ja:'期限間近', ky:'Мөөнөтү бүтүүдө', 'zh-Hant':'即將到期' },
  lb_f_unprinted: { bg:'Непечатани', ru:'Не напечатаны', uk:'Не надруковані', en:'Not printed', de:'Nicht gedruckt', fr:'Non imprimés', es:'Sin imprimir', 'es-MX':'Sin imprimir', it:'Non stampati', pt:'Não impressos', ar:'غير مطبوعة', hi:'प्रिंट नहीं हुए', ja:'未印刷', ky:'Басылбаган', 'zh-Hant':'未列印' },
  lb_new: { bg:'Нов предмет', ru:'Новый предмет', uk:'Новий предмет', en:'New item', de:'Neuer Gegenstand', fr:'Nouvel objet', es:'Nuevo objeto', 'es-MX':'Nuevo objeto', it:'Nuovo oggetto', pt:'Novo item', ar:'غرض جديد', hi:'नई वस्तु', ja:'新しいアイテム', ky:'Жаңы буюм', 'zh-Hant':'新增物品' },
  lb_empty: { bg:'Няма предмети. Добави първия или сканирай етикет.', ru:'Предметов нет. Добавь первый или отсканируй этикетку.', uk:'Предметів немає. Додай перший або відскануй етикетку.', en:'No items yet. Add the first one or scan a label.', de:'Noch keine Gegenstände. Füge den ersten hinzu oder scanne ein Etikett.', fr:'Aucun objet. Ajoute le premier ou scanne une étiquette.', es:'No hay objetos. Añade el primero o escanea una etiqueta.', 'es-MX':'No hay objetos. Agrega el primero o escanea una etiqueta.', it:'Nessun oggetto. Aggiungi il primo o scansiona un’etichetta.', pt:'Sem itens. Adiciona o primeiro ou digitaliza uma etiqueta.', ar:'لا توجد أغراض. أضف الأول أو امسح ملصقًا.', hi:'कोई वस्तु नहीं। पहली जोड़ें या लेबल स्कैन करें।', ja:'アイテムがありません。追加するかラベルをスキャンしてください。', ky:'Буюм жок. Биринчисин кош же этикетканы сканерле.', 'zh-Hant':'尚無物品。新增第一件或掃描標籤。' },
  lb_sample_badge: { bg:'пример', ru:'пример', uk:'приклад', en:'sample', de:'Beispiel', fr:'exemple', es:'ejemplo', 'es-MX':'ejemplo', it:'esempio', pt:'exemplo', ar:'مثال', hi:'उदाहरण', ja:'サンプル', ky:'үлгү', 'zh-Hant':'範例' },
  lb_sample_note: { bg:'Примерни предмети — за да видиш как работи. Изтрий ги, когато добавиш своите.', ru:'Примерные предметы — чтобы увидеть, как это работает. Удали их, когда добавишь свои.', uk:'Приклади предметів — щоб побачити, як це працює. Видали їх, коли додаси свої.', en:'Sample items — to show how it works. Delete them once you add your own.', de:'Beispiel-Gegenstände zum Ausprobieren. Lösche sie, sobald du eigene hinzufügst.', fr:'Objets d’exemple pour voir comment ça marche. Supprime-les quand tu ajoutes les tiens.', es:'Objetos de ejemplo para ver cómo funciona. Bórralos cuando añadas los tuyos.', 'es-MX':'Objetos de ejemplo para ver cómo funciona. Bórralos cuando agregues los tuyos.', it:'Oggetti di esempio per vedere come funziona. Eliminali quando aggiungi i tuoi.', pt:'Itens de exemplo para veres como funciona. Apaga-os quando adicionares os teus.', ar:'أغراض تجريبية لتوضيح طريقة العمل. احذفها عندما تضيف أغراضك.', hi:'उदाहरण वस्तुएँ — काम समझने के लिए। अपनी जोड़ने के बाद हटा दें।', ja:'動作を示すためのサンプルです。自分のアイテムを追加したら削除してください。', ky:'Кантип иштээрин көрсөтүүчү үлгү буюмдар. Өзүңдүкүн кошкондо өчүрүп сал.', 'zh-Hant':'範例物品，用來展示功能。新增自己的物品後即可刪除。' },
  lb_sample_del: { bg:'Изтрий примерите', ru:'Удалить примеры', uk:'Видалити приклади', en:'Delete samples', de:'Beispiele löschen', fr:'Supprimer les exemples', es:'Borrar ejemplos', 'es-MX':'Borrar ejemplos', it:'Elimina esempi', pt:'Apagar exemplos', ar:'حذف الأمثلة', hi:'उदाहरण हटाएँ', ja:'サンプルを削除', ky:'Үлгүлөрдү өчүрүү', 'zh-Hant':'刪除範例' },
  lb_name: { bg:'Име', ru:'Название', uk:'Назва', en:'Name', de:'Name', fr:'Nom', es:'Nombre', 'es-MX':'Nombre', it:'Nome', pt:'Nome', ar:'الاسم', hi:'नाम', ja:'名前', ky:'Аты', 'zh-Hant':'名稱' },
  lb_name_ph: { bg:'напр. Зимни гуми, Кутия с кабели…', ru:'напр. Зимние шины, Коробка с кабелями…', uk:'напр. Зимові шини, Коробка з кабелями…', en:'e.g. Winter tyres, Cable box…', de:'z. B. Winterreifen, Kabelkiste…', fr:'ex. Pneus hiver, Boîte à câbles…', es:'p. ej. Neumáticos de invierno, Caja de cables…', 'es-MX':'p. ej. Llantas de invierno, Caja de cables…', it:'es. Gomme invernali, Scatola cavi…', pt:'ex. Pneus de inverno, Caixa de cabos…', ar:'مثال: إطارات شتوية، صندوق كابلات…', hi:'जैसे सर्दियों के टायर, केबल बॉक्स…', ja:'例: 冬タイヤ、ケーブル箱…', ky:'мис. Кышкы дөңгөлөктөр, Кабель кутусу…', 'zh-Hant':'例如：冬季輪胎、線材箱…' },
  lb_cat: { bg:'Категория', ru:'Категория', uk:'Категорія', en:'Category', de:'Kategorie', fr:'Catégorie', es:'Categoría', 'es-MX':'Categoría', it:'Categoria', pt:'Categoria', ar:'الفئة', hi:'श्रेणी', ja:'カテゴリ', ky:'Категория', 'zh-Hant':'類別' },
  lb_loc: { bg:'Място / кутия', ru:'Место / коробка', uk:'Місце / коробка', en:'Place / box', de:'Ort / Karton', fr:'Lieu / boîte', es:'Lugar / caja', 'es-MX':'Lugar / caja', it:'Luogo / scatola', pt:'Local / caixa', ar:'المكان / الصندوق', hi:'जगह / डिब्बा', ja:'場所／箱', ky:'Орду / куту', 'zh-Hant':'位置／箱子' },
  lb_loc_ph: { bg:'напр. Гараж, рафт 2, кутия Г-3', ru:'напр. Гараж, полка 2, коробка Г-3', uk:'напр. Гараж, полиця 2, коробка Г-3', en:'e.g. Garage, shelf 2, box G-3', de:'z. B. Garage, Regal 2, Karton G-3', fr:'ex. Garage, étagère 2, boîte G-3', es:'p. ej. Garaje, estante 2, caja G-3', 'es-MX':'p. ej. Garaje, estante 2, caja G-3', it:'es. Garage, scaffale 2, scatola G-3', pt:'ex. Garagem, prateleira 2, caixa G-3', ar:'مثال: المرآب، الرف 2، الصندوق G-3', hi:'जैसे गैराज, शेल्फ 2, बॉक्स G-3', ja:'例: ガレージ、棚2、箱G-3', ky:'мис. Гараж, 2-текче, G-3 кутусу', 'zh-Hant':'例如：車庫、第 2 層架、箱 G-3' },
  lb_expiry: { bg:'Срок на годност / валидност', ru:'Срок годности / действия', uk:'Термін придатності / дії', en:'Expiry / valid until', de:'Ablauf / gültig bis', fr:'Péremption / valide jusqu’au', es:'Caducidad / válido hasta', 'es-MX':'Caducidad / válido hasta', it:'Scadenza / valido fino al', pt:'Validade / válido até', ar:'تاريخ الانتهاء / صالح حتى', hi:'समाप्ति / मान्य तक', ja:'期限／有効期限', ky:'Мөөнөтү / жарактуу', 'zh-Hant':'有效期限' },
  lb_remind: { bg:'Напомни (дни преди срока)', ru:'Напомнить (дней до срока)', uk:'Нагадати (днів до терміну)', en:'Remind (days before)', de:'Erinnern (Tage vorher)', fr:'Rappel (jours avant)', es:'Recordar (días antes)', 'es-MX':'Recordar (días antes)', it:'Promemoria (giorni prima)', pt:'Lembrar (dias antes)', ar:'تذكير (أيام قبل الموعد)', hi:'याद दिलाएँ (कितने दिन पहले)', ja:'通知（何日前）', ky:'Эскертүү (канча күн мурун)', 'zh-Hant':'提醒（提前幾天）' },
  lb_notes: { bg:'Бележки', ru:'Заметки', uk:'Нотатки', en:'Notes', de:'Notizen', fr:'Notes', es:'Notas', 'es-MX':'Notas', it:'Note', pt:'Notas', ar:'ملاحظات', hi:'नोट्स', ja:'メモ', ky:'Эскертүүлөр', 'zh-Hant':'備註' },
  lb_photo: { bg:'Снимка', ru:'Фото', uk:'Фото', en:'Photo', de:'Foto', fr:'Photo', es:'Foto', 'es-MX':'Foto', it:'Foto', pt:'Foto', ar:'صورة', hi:'फ़ोटो', ja:'写真', ky:'Сүрөт', 'zh-Hant':'照片' },
  lb_photo_pick: { bg:'Избери снимка', ru:'Выбрать фото', uk:'Вибрати фото', en:'Choose photo', de:'Foto wählen', fr:'Choisir une photo', es:'Elegir foto', 'es-MX':'Elegir foto', it:'Scegli foto', pt:'Escolher foto', ar:'اختر صورة', hi:'फ़ोटो चुनें', ja:'写真を選ぶ', ky:'Сүрөт тандоо', 'zh-Hant':'選擇照片' },
  lb_photo_del: { bg:'Махни снимката', ru:'Убрать фото', uk:'Прибрати фото', en:'Remove photo', de:'Foto entfernen', fr:'Retirer la photo', es:'Quitar foto', 'es-MX':'Quitar foto', it:'Rimuovi foto', pt:'Remover foto', ar:'إزالة الصورة', hi:'फ़ोटो हटाएँ', ja:'写真を削除', ky:'Сүрөттү алып салуу', 'zh-Hant':'移除照片' },
  lb_code: { bg:'Код на етикета', ru:'Код этикетки', uk:'Код етикетки', en:'Label code', de:'Etikett-Code', fr:'Code de l’étiquette', es:'Código de la etiqueta', 'es-MX':'Código de la etiqueta', it:'Codice etichetta', pt:'Código da etiqueta', ar:'رمز الملصق', hi:'लेबल कोड', ja:'ラベルコード', ky:'Этикетка коду', 'zh-Hant':'標籤代碼' },
  lb_save: { bg:'Запази', ru:'Сохранить', uk:'Зберегти', en:'Save', de:'Speichern', fr:'Enregistrer', es:'Guardar', 'es-MX':'Guardar', it:'Salva', pt:'Guardar', ar:'حفظ', hi:'सहेजें', ja:'保存', ky:'Сактоо', 'zh-Hant':'儲存' },
  lb_cancel: { bg:'Отказ', ru:'Отмена', uk:'Скасувати', en:'Cancel', de:'Abbrechen', fr:'Annuler', es:'Cancelar', 'es-MX':'Cancelar', it:'Annulla', pt:'Cancelar', ar:'إلغاء', hi:'रद्द', ja:'キャンセル', ky:'Жокко чыгаруу', 'zh-Hant':'取消' },
  lb_edit: { bg:'Редактирай', ru:'Изменить', uk:'Змінити', en:'Edit', de:'Bearbeiten', fr:'Modifier', es:'Editar', 'es-MX':'Editar', it:'Modifica', pt:'Editar', ar:'تعديل', hi:'संपादित', ja:'編集', ky:'Түзөтүү', 'zh-Hant':'編輯' },
  lb_del: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Borrar', 'es-MX':'Borrar', it:'Elimina', pt:'Apagar', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  lb_del_confirm: { bg:'Да изтрия ли този предмет?', ru:'Удалить этот предмет?', uk:'Видалити цей предмет?', en:'Delete this item?', de:'Diesen Gegenstand löschen?', fr:'Supprimer cet objet ?', es:'¿Borrar este objeto?', 'es-MX':'¿Borrar este objeto?', it:'Eliminare questo oggetto?', pt:'Apagar este item?', ar:'هل تريد حذف هذا الغرض؟', hi:'यह वस्तु हटाएँ?', ja:'このアイテムを削除しますか？', ky:'Бул буюмду өчүрөйүнбү?', 'zh-Hant':'要刪除這件物品嗎？' },
  lb_need_name: { bg:'Въведи име.', ru:'Введи название.', uk:'Введи назву.', en:'Enter a name.', de:'Namen eingeben.', fr:'Saisis un nom.', es:'Introduce un nombre.', 'es-MX':'Escribe un nombre.', it:'Inserisci un nome.', pt:'Introduz um nome.', ar:'أدخل اسمًا.', hi:'नाम दर्ज करें।', ja:'名前を入力してください。', ky:'Атын киргиз.', 'zh-Hant':'請輸入名稱。' },
  lb_back_list: { bg:'Към списъка', ru:'К списку', uk:'До списку', en:'Back to list', de:'Zur Liste', fr:'Retour à la liste', es:'Volver a la lista', 'es-MX':'Volver a la lista', it:'Torna alla lista', pt:'Voltar à lista', ar:'العودة إلى القائمة', hi:'सूची पर वापस', ja:'一覧へ戻る', ky:'Тизмеге', 'zh-Hant':'返回清單' },
  lb_label_png: { bg:'Етикет PNG', ru:'Этикетка PNG', uk:'Етикетка PNG', en:'Label PNG', de:'Etikett PNG', fr:'Étiquette PNG', es:'Etiqueta PNG', 'es-MX':'Etiqueta PNG', it:'Etichetta PNG', pt:'Etiqueta PNG', ar:'ملصق PNG', hi:'लेबल PNG', ja:'ラベルPNG', ky:'Этикетка PNG', 'zh-Hant':'標籤 PNG' },
  lb_added: { bg:'Добавен', ru:'Добавлен', uk:'Додано', en:'Added', de:'Hinzugefügt', fr:'Ajouté', es:'Añadido', 'es-MX':'Agregado', it:'Aggiunto', pt:'Adicionado', ar:'أُضيف', hi:'जोड़ा गया', ja:'追加日', ky:'Кошулду', 'zh-Hant':'新增於' },
  lb_exp_in: { bg:'Изтича след {0} дни', ru:'Истекает через {0} дн.', uk:'Спливає через {0} дн.', en:'Expires in {0} days', de:'Läuft in {0} Tagen ab', fr:'Expire dans {0} jours', es:'Caduca en {0} días', 'es-MX':'Caduca en {0} días', it:'Scade tra {0} giorni', pt:'Expira em {0} dias', ar:'ينتهي خلال {0} يومًا', hi:'{0} दिनों में समाप्त', ja:'あと{0}日で期限', ky:'{0} күндөн кийин бүтөт', 'zh-Hant':'{0} 天後到期' },
  lb_exp_today: { bg:'Изтича днес', ru:'Истекает сегодня', uk:'Спливає сьогодні', en:'Expires today', de:'Läuft heute ab', fr:'Expire aujourd’hui', es:'Caduca hoy', 'es-MX':'Caduca hoy', it:'Scade oggi', pt:'Expira hoje', ar:'ينتهي اليوم', hi:'आज समाप्त', ja:'今日が期限', ky:'Бүгүн бүтөт', 'zh-Hant':'今天到期' },
  lb_expired: { bg:'Изтекъл преди {0} дни', ru:'Истёк {0} дн. назад', uk:'Сплив {0} дн. тому', en:'Expired {0} days ago', de:'Vor {0} Tagen abgelaufen', fr:'Expiré il y a {0} jours', es:'Caducado hace {0} días', 'es-MX':'Caducado hace {0} días', it:'Scaduto {0} giorni fa', pt:'Expirou há {0} dias', ar:'انتهى قبل {0} يومًا', hi:'{0} दिन पहले समाप्त', ja:'{0}日前に期限切れ', ky:'{0} күн мурун бүткөн', 'zh-Hant':'已於 {0} 天前到期' },
  lb_lent_to: { bg:'Назаем при {0}', ru:'Взял(а): {0}', uk:'Позичено: {0}', en:'Lent to {0}', de:'Verliehen an {0}', fr:'Prêté à {0}', es:'Prestado a {0}', 'es-MX':'Prestado a {0}', it:'Prestato a {0}', pt:'Emprestado a {0}', ar:'مُعار إلى {0}', hi:'{0} को उधार', ja:'{0}に貸出中', ky:'{0} карызга алган', 'zh-Hant':'借給 {0}' },
  lb_due: { bg:'Връщане: {0}', ru:'Вернуть: {0}', uk:'Повернути: {0}', en:'Due: {0}', de:'Rückgabe: {0}', fr:'Retour : {0}', es:'Devolver: {0}', 'es-MX':'Devolver: {0}', it:'Restituire: {0}', pt:'Devolver: {0}', ar:'الإرجاع: {0}', hi:'वापसी: {0}', ja:'返却: {0}', ky:'Кайтаруу: {0}', 'zh-Hant':'歸還：{0}' },
  lb_overdue: { bg:'Просрочено с {0} дни', ru:'Просрочено на {0} дн.', uk:'Прострочено на {0} дн.', en:'Overdue by {0} days', de:'{0} Tage überfällig', fr:'En retard de {0} jours', es:'Atrasado {0} días', 'es-MX':'Atrasado {0} días', it:'In ritardo di {0} giorni', pt:'Atrasado {0} dias', ar:'متأخر {0} يومًا', hi:'{0} दिन विलंबित', ja:'{0}日超過', ky:'{0} күн кечиккен', 'zh-Hant':'逾期 {0} 天' },
  lb_lend_btn: { bg:'Дай назаем', ru:'Дать взаймы', uk:'Позичити', en:'Lend', de:'Verleihen', fr:'Prêter', es:'Prestar', 'es-MX':'Prestar', it:'Presta', pt:'Emprestar', ar:'إعارة', hi:'उधार दें', ja:'貸す', ky:'Карызга берүү', 'zh-Hant':'外借' },
  lb_return_btn: { bg:'Върнат', ru:'Возвращён', uk:'Повернуто', en:'Returned', de:'Zurück', fr:'Rendu', es:'Devuelto', 'es-MX':'Devuelto', it:'Restituito', pt:'Devolvido', ar:'أُعيد', hi:'वापस आया', ja:'返却済み', ky:'Кайтарылды', 'zh-Hant':'已歸還' },
  lb_lend_who: { bg:'На кого', ru:'Кому', uk:'Кому', en:'To whom', de:'An wen', fr:'À qui', es:'A quién', 'es-MX':'A quién', it:'A chi', pt:'A quem', ar:'لمن', hi:'किसे', ja:'誰に', ky:'Кимге', 'zh-Hant':'借給誰' },
  lb_lend_due: { bg:'До кога', ru:'До какого числа', uk:'До якого числа', en:'Until', de:'Bis wann', fr:'Jusqu’au', es:'Hasta', 'es-MX':'Hasta', it:'Fino al', pt:'Até', ar:'حتى', hi:'कब तक', ja:'いつまで', ky:'Качанга чейин', 'zh-Hant':'借到' },
  lb_lend_hist: { bg:'История на заемите', ru:'История займов', uk:'Історія позичань', en:'Lending history', de:'Verleih-Verlauf', fr:'Historique des prêts', es:'Historial de préstamos', 'es-MX':'Historial de préstamos', it:'Storico prestiti', pt:'Histórico de empréstimos', ar:'سجل الإعارة', hi:'उधार इतिहास', ja:'貸出履歴', ky:'Карыз тарыхы', 'zh-Hant':'借用紀錄' },
  lb_lend_none: { bg:'Не е даван назаем.', ru:'Взаймы не давался.', uk:'Не позичався.', en:'Never lent out.', de:'Nie verliehen.', fr:'Jamais prêté.', es:'Nunca prestado.', 'es-MX':'Nunca prestado.', it:'Mai prestato.', pt:'Nunca emprestado.', ar:'لم يُعَر من قبل.', hi:'कभी उधार नहीं दिया।', ja:'貸出履歴なし。', ky:'Карызга берилген эмес.', 'zh-Hant':'從未外借。' },
  lb_lend_need: { bg:'Въведи на кого.', ru:'Укажи, кому.', uk:'Вкажи, кому.', en:'Enter to whom.', de:'An wen eingeben.', fr:'Indique à qui.', es:'Indica a quién.', 'es-MX':'Indica a quién.', it:'Indica a chi.', pt:'Indica a quem.', ar:'أدخل لمن.', hi:'बताएँ किसे।', ja:'誰にを入力してください。', ky:'Кимге экенин киргиз.', 'zh-Hant':'請輸入借給誰。' },
  lb_lend_active: { bg:'В момента назаем', ru:'Сейчас взаймы', uk:'Зараз позичено', en:'Currently lent out', de:'Derzeit verliehen', fr:'Actuellement prêtés', es:'Prestados ahora', 'es-MX':'Prestados ahora', it:'Attualmente in prestito', pt:'Atualmente emprestados', ar:'مُعار حاليًا', hi:'अभी उधार पर', ja:'現在貸出中', ky:'Азыр карызга', 'zh-Hant':'目前外借中' },
  lb_lend_empty: { bg:'Нищо не е дадено назаем.', ru:'Ничего не отдано взаймы.', uk:'Нічого не позичено.', en:'Nothing is lent out.', de:'Nichts verliehen.', fr:'Rien n’est prêté.', es:'No hay nada prestado.', 'es-MX':'No hay nada prestado.', it:'Niente in prestito.', pt:'Nada emprestado.', ar:'لا شيء مُعار.', hi:'कुछ भी उधार नहीं।', ja:'貸出中のものはありません。', ky:'Эч нерсе карызга берилген эмес.', 'zh-Hant':'沒有外借中的物品。' },
  lb_returned_on: { bg:'върнат на {0}', ru:'возвращён {0}', uk:'повернуто {0}', en:'returned on {0}', de:'zurück am {0}', fr:'rendu le {0}', es:'devuelto el {0}', 'es-MX':'devuelto el {0}', it:'restituito il {0}', pt:'devolvido em {0}', ar:'أُعيد في {0}', hi:'{0} को वापस', ja:'{0}に返却', ky:'{0} кайтарылды', 'zh-Hant':'於 {0} 歸還' },
  lb_scan_hint: { bg:'Насочи камерата към етикета. Може и от снимка или като въведеш кода на ръка.', ru:'Наведи камеру на этикетку. Можно также по фото или ввести код вручную.', uk:'Наведи камеру на етикетку. Можна також із фото або ввести код вручну.', en:'Point the camera at the label. You can also use a photo or type the code by hand.', de:'Kamera auf das Etikett richten. Auch per Foto oder Code von Hand eingeben.', fr:'Pointe la caméra vers l’étiquette. Aussi possible depuis une photo ou en tapant le code.', es:'Apunta la cámara a la etiqueta. También desde una foto o escribiendo el código.', 'es-MX':'Apunta la cámara a la etiqueta. También desde una foto o escribiendo el código.', it:'Inquadra l’etichetta con la fotocamera. Anche da foto o digitando il codice.', pt:'Aponta a câmara para a etiqueta. Também a partir de uma foto ou escrevendo o código.', ar:'وجّه الكاميرا نحو الملصق. يمكنك أيضًا استخدام صورة أو كتابة الرمز يدويًا.', hi:'कैमरा लेबल पर रखें। फ़ोटो से या कोड हाथ से भी डाल सकते हैं।', ja:'カメラをラベルに向けてください。写真から、またはコードを手入力でも可能です。', ky:'Камераны этикеткага багытта. Сүрөттөн же кодду кол менен киргизсе да болот.', 'zh-Hant':'將相機對準標籤。也可以從照片讀取或手動輸入代碼。' },
  lb_scan_cam: { bg:'Сканирай с камера', ru:'Сканировать камерой', uk:'Сканувати камерою', en:'Scan with camera', de:'Mit Kamera scannen', fr:'Scanner avec la caméra', es:'Escanear con cámara', 'es-MX':'Escanear con cámara', it:'Scansiona con fotocamera', pt:'Digitalizar com câmara', ar:'مسح بالكاميرا', hi:'कैमरे से स्कैन', ja:'カメラでスキャン', ky:'Камера менен сканерлөө', 'zh-Hant':'用相機掃描' },
  lb_scan_stop: { bg:'Спри', ru:'Стоп', uk:'Стоп', en:'Stop', de:'Stopp', fr:'Arrêter', es:'Detener', 'es-MX':'Detener', it:'Ferma', pt:'Parar', ar:'إيقاف', hi:'रोकें', ja:'停止', ky:'Токтотуу', 'zh-Hant':'停止' },
  lb_scan_file: { bg:'От снимка', ru:'Из фото', uk:'З фото', en:'From photo', de:'Aus Foto', fr:'Depuis une photo', es:'Desde foto', 'es-MX':'Desde foto', it:'Da foto', pt:'De uma foto', ar:'من صورة', hi:'फ़ोटो से', ja:'写真から', ky:'Сүрөттөн', 'zh-Hant':'從照片' },
  lb_scan_code_ph: { bg:'Код от етикета (напр. PQL-7K3M2X)', ru:'Код с этикетки (напр. PQL-7K3M2X)', uk:'Код з етикетки (напр. PQL-7K3M2X)', en:'Code from the label (e.g. PQL-7K3M2X)', de:'Code vom Etikett (z. B. PQL-7K3M2X)', fr:'Code de l’étiquette (ex. PQL-7K3M2X)', es:'Código de la etiqueta (p. ej. PQL-7K3M2X)', 'es-MX':'Código de la etiqueta (p. ej. PQL-7K3M2X)', it:'Codice dell’etichetta (es. PQL-7K3M2X)', pt:'Código da etiqueta (ex. PQL-7K3M2X)', ar:'الرمز من الملصق (مثال PQL-7K3M2X)', hi:'लेबल का कोड (जैसे PQL-7K3M2X)', ja:'ラベルのコード（例: PQL-7K3M2X）', ky:'Этикеткадагы код (мис. PQL-7K3M2X)', 'zh-Hant':'標籤代碼（例如 PQL-7K3M2X）' },
  lb_scan_open: { bg:'Отвори', ru:'Открыть', uk:'Відкрити', en:'Open', de:'Öffnen', fr:'Ouvrir', es:'Abrir', 'es-MX':'Abrir', it:'Apri', pt:'Abrir', ar:'فتح', hi:'खोलें', ja:'開く', ky:'Ачуу', 'zh-Hant':'開啟' },
  lb_scan_unknown: { bg:'Няма предмет с този код.', ru:'Предмета с таким кодом нет.', uk:'Предмета з таким кодом немає.', en:'No item with this code.', de:'Kein Gegenstand mit diesem Code.', fr:'Aucun objet avec ce code.', es:'No hay objeto con este código.', 'es-MX':'No hay objeto con este código.', it:'Nessun oggetto con questo codice.', pt:'Nenhum item com este código.', ar:'لا يوجد غرض بهذا الرمز.', hi:'इस कोड की कोई वस्तु नहीं।', ja:'このコードのアイテムはありません。', ky:'Мындай коддуу буюм жок.', 'zh-Hant':'沒有此代碼的物品。' },
  lb_scan_create: { bg:'Създай предмет с този код', ru:'Создать предмет с этим кодом', uk:'Створити предмет із цим кодом', en:'Create an item with this code', de:'Gegenstand mit diesem Code anlegen', fr:'Créer un objet avec ce code', es:'Crear objeto con este código', 'es-MX':'Crear objeto con este código', it:'Crea un oggetto con questo codice', pt:'Criar item com este código', ar:'إنشاء غرض بهذا الرمز', hi:'इस कोड से वस्तु बनाएँ', ja:'このコードでアイテムを作成', ky:'Бул код менен буюм түзүү', 'zh-Hant':'用此代碼建立物品' },
  lb_scan_notfound: { bg:'В снимката няма QR код.', ru:'На фото нет QR-кода.', uk:'На фото немає QR-коду.', en:'No QR code in the photo.', de:'Kein QR-Code im Foto.', fr:'Aucun code QR dans la photo.', es:'No hay código QR en la foto.', 'es-MX':'No hay código QR en la foto.', it:'Nessun codice QR nella foto.', pt:'Sem código QR na foto.', ar:'لا يوجد رمز QR في الصورة.', hi:'फ़ोटो में QR कोड नहीं।', ja:'写真にQRコードがありません。', ky:'Сүрөттө QR код жок.', 'zh-Hant':'照片中沒有 QR 碼。' },
  lb_scan_camerr: { bg:'Камерата не е достъпна: {0}', ru:'Камера недоступна: {0}', uk:'Камера недоступна: {0}', en:'Camera unavailable: {0}', de:'Kamera nicht verfügbar: {0}', fr:'Caméra indisponible : {0}', es:'Cámara no disponible: {0}', 'es-MX':'Cámara no disponible: {0}', it:'Fotocamera non disponibile: {0}', pt:'Câmara indisponível: {0}', ar:'الكاميرا غير متاحة: {0}', hi:'कैमरा उपलब्ध नहीं: {0}', ja:'カメラが利用できません: {0}', ky:'Камера жеткиликсиз: {0}', 'zh-Hant':'相機無法使用：{0}' },
  lb_scan_found: { bg:'Прочетен код: {0}', ru:'Считан код: {0}', uk:'Зчитано код: {0}', en:'Code read: {0}', de:'Code gelesen: {0}', fr:'Code lu : {0}', es:'Código leído: {0}', 'es-MX':'Código leído: {0}', it:'Codice letto: {0}', pt:'Código lido: {0}', ar:'تمت قراءة الرمز: {0}', hi:'कोड पढ़ा: {0}', ja:'読み取ったコード: {0}', ky:'Окулган код: {0}', 'zh-Hant':'已讀取代碼：{0}' },
  lb_pr_hint: { bg:'Избери размер на етикета и кои предмети. Листът е при 300 DPI — отпечатай го и изрежи по линиите.', ru:'Выбери размер этикетки и предметы. Лист в 300 DPI — распечатай и вырежи по линиям.', uk:'Вибери розмір етикетки і предмети. Аркуш у 300 DPI — роздрукуй і виріж по лініях.', en:'Choose the label size and the items. The sheet is 300 DPI — print it and cut along the lines.', de:'Etikettengröße und Gegenstände wählen. Der Bogen hat 300 DPI — drucken und an den Linien schneiden.', fr:'Choisis la taille d’étiquette et les objets. La feuille est en 300 DPI : imprime-la et découpe le long des lignes.', es:'Elige el tamaño de etiqueta y los objetos. La hoja es de 300 DPI: imprímela y recorta por las líneas.', 'es-MX':'Elige el tamaño de etiqueta y los objetos. La hoja es de 300 DPI: imprímela y recorta por las líneas.', it:'Scegli la dimensione dell’etichetta e gli oggetti. Il foglio è a 300 DPI: stampalo e ritaglia lungo le linee.', pt:'Escolhe o tamanho da etiqueta e os itens. A folha está a 300 DPI — imprime e corta pelas linhas.', ar:'اختر حجم الملصق والأغراض. الورقة بدقة 300 DPI — اطبعها وقصّ على الخطوط.', hi:'लेबल का आकार और वस्तुएँ चुनें। शीट 300 DPI है — प्रिंट करें और लाइनों पर काटें।', ja:'ラベルサイズとアイテムを選びます。シートは300 DPI。印刷して線に沿って切ってください。', ky:'Этикетка өлчөмүн жана буюмдарды танда. Барак 300 DPI — басып чыгарып, сызык боюнча кесип ал.', 'zh-Hant':'選擇標籤大小與物品。標籤紙為 300 DPI，列印後沿線裁切即可。' },
  lb_pr_size: { bg:'Размер на етикета', ru:'Размер этикетки', uk:'Розмір етикетки', en:'Label size', de:'Etikettengröße', fr:'Taille d’étiquette', es:'Tamaño de etiqueta', 'es-MX':'Tamaño de etiqueta', it:'Dimensione etichetta', pt:'Tamanho da etiqueta', ar:'حجم الملصق', hi:'लेबल आकार', ja:'ラベルサイズ', ky:'Этикетка өлчөмү', 'zh-Hant':'標籤大小' },
  lb_pr_s: { bg:'Малък (25 мм)', ru:'Малый (25 мм)', uk:'Малий (25 мм)', en:'Small (25 mm)', de:'Klein (25 mm)', fr:'Petite (25 mm)', es:'Pequeña (25 mm)', 'es-MX':'Pequeña (25 mm)', it:'Piccola (25 mm)', pt:'Pequena (25 mm)', ar:'صغير (25 مم)', hi:'छोटा (25 मिमी)', ja:'小（25 mm）', ky:'Кичине (25 мм)', 'zh-Hant':'小（25 mm）' },
  lb_pr_m: { bg:'Среден (35 мм)', ru:'Средний (35 мм)', uk:'Середній (35 мм)', en:'Medium (35 mm)', de:'Mittel (35 mm)', fr:'Moyenne (35 mm)', es:'Mediana (35 mm)', 'es-MX':'Mediana (35 mm)', it:'Media (35 mm)', pt:'Média (35 mm)', ar:'متوسط (35 مم)', hi:'मध्यम (35 मिमी)', ja:'中（35 mm）', ky:'Орто (35 мм)', 'zh-Hant':'中（35 mm）' },
  lb_pr_l: { bg:'Голям (50 мм)', ru:'Большой (50 мм)', uk:'Великий (50 мм)', en:'Large (50 mm)', de:'Groß (50 mm)', fr:'Grande (50 mm)', es:'Grande (50 mm)', 'es-MX':'Grande (50 mm)', it:'Grande (50 mm)', pt:'Grande (50 mm)', ar:'كبير (50 مم)', hi:'बड़ा (50 मिमी)', ja:'大（50 mm）', ky:'Чоң (50 мм)', 'zh-Hant':'大（50 mm）' },
  lb_pr_page: { bg:'Лист', ru:'Лист', uk:'Аркуш', en:'Sheet', de:'Bogen', fr:'Feuille', es:'Hoja', 'es-MX':'Hoja', it:'Foglio', pt:'Folha', ar:'الورقة', hi:'शीट', ja:'用紙', ky:'Барак', 'zh-Hant':'紙張' },
  lb_pr_which: { bg:'Кои предмети', ru:'Какие предметы', uk:'Які предмети', en:'Which items', de:'Welche Gegenstände', fr:'Quels objets', es:'Qué objetos', 'es-MX':'Qué objetos', it:'Quali oggetti', pt:'Quais itens', ar:'أي أغراض', hi:'कौन सी वस्तुएँ', ja:'対象アイテム', ky:'Кайсы буюмдар', 'zh-Hant':'哪些物品' },
  lb_pr_w_unprinted: { bg:'Само непечатаните', ru:'Только не напечатанные', uk:'Лише не надруковані', en:'Only not yet printed', de:'Nur noch nicht gedruckte', fr:'Seulement non imprimés', es:'Solo sin imprimir', 'es-MX':'Solo sin imprimir', it:'Solo non stampati', pt:'Só os não impressos', ar:'غير المطبوعة فقط', hi:'सिर्फ़ जो प्रिंट नहीं हुए', ja:'未印刷のみ', ky:'Басылбагандар гана', 'zh-Hant':'僅未列印的' },
  lb_pr_w_sel: { bg:'Избрани', ru:'Выбранные', uk:'Вибрані', en:'Selected', de:'Ausgewählte', fr:'Sélectionnés', es:'Seleccionados', 'es-MX':'Seleccionados', it:'Selezionati', pt:'Selecionados', ar:'المحددة', hi:'चुने हुए', ja:'選択したもの', ky:'Тандалгандар', 'zh-Hant':'已選取' },
  lb_pr_fits: { bg:'{0} етикета на лист · {1} листа · {2} етикета', ru:'{0} этикеток на листе · {1} листов · {2} этикеток', uk:'{0} етикеток на аркуші · {1} аркушів · {2} етикеток', en:'{0} labels per sheet · {1} sheets · {2} labels', de:'{0} Etiketten pro Bogen · {1} Bögen · {2} Etiketten', fr:'{0} étiquettes par feuille · {1} feuilles · {2} étiquettes', es:'{0} etiquetas por hoja · {1} hojas · {2} etiquetas', 'es-MX':'{0} etiquetas por hoja · {1} hojas · {2} etiquetas', it:'{0} etichette per foglio · {1} fogli · {2} etichette', pt:'{0} etiquetas por folha · {1} folhas · {2} etiquetas', ar:'{0} ملصقًا في الورقة · {1} ورقة · {2} ملصقًا', hi:'{0} लेबल प्रति शीट · {1} शीट · {2} लेबल', ja:'1枚あたり{0}ラベル · {1}枚 · {2}ラベル', ky:'Баракка {0} этикетка · {1} барак · {2} этикетка', 'zh-Hant':'每張 {0} 個標籤 · {1} 張 · 共 {2} 個標籤' },
  lb_pr_png: { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG laden', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Transferir PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड', ja:'PNGを保存', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  lb_pr_pdf: { bg:'Свали PDF', ru:'Скачать PDF', uk:'Завантажити PDF', en:'Download PDF', de:'PDF laden', fr:'Télécharger PDF', es:'Descargar PDF', 'es-MX':'Descargar PDF', it:'Scarica PDF', pt:'Transferir PDF', ar:'تنزيل PDF', hi:'PDF डाउनलोड', ja:'PDFを保存', ky:'PDF жүктөө', 'zh-Hant':'下載 PDF' },
  lb_pr_none: { bg:'Няма предмети за печат.', ru:'Нет предметов для печати.', uk:'Немає предметів для друку.', en:'No items to print.', de:'Keine Gegenstände zum Drucken.', fr:'Aucun objet à imprimer.', es:'No hay objetos para imprimir.', 'es-MX':'No hay objetos para imprimir.', it:'Nessun oggetto da stampare.', pt:'Sem itens para imprimir.', ar:'لا توجد أغراض للطباعة.', hi:'प्रिंट के लिए कोई वस्तु नहीं।', ja:'印刷するアイテムがありません。', ky:'Басып чыгарууга буюм жок.', 'zh-Hant':'沒有可列印的物品。' },
  lb_pr_done: { bg:'Готово — {0} етикета отбелязани като отпечатани.', ru:'Готово — {0} этикеток отмечены как напечатанные.', uk:'Готово — {0} етикеток позначено як надруковані.', en:'Done — {0} labels marked as printed.', de:'Fertig — {0} Etiketten als gedruckt markiert.', fr:'Terminé : {0} étiquettes marquées comme imprimées.', es:'Listo: {0} etiquetas marcadas como impresas.', 'es-MX':'Listo: {0} etiquetas marcadas como impresas.', it:'Fatto: {0} etichette segnate come stampate.', pt:'Feito — {0} etiquetas marcadas como impressas.', ar:'تم — {0} ملصقًا وُضعت كمطبوعة.', hi:'हो गया — {0} लेबल प्रिंटेड चिह्नित।', ja:'完了 — {0}件のラベルを印刷済みにしました。', ky:'Даяр — {0} этикетка басылган деп белгиленди.', 'zh-Hant':'完成，已將 {0} 個標籤標記為已列印。' },
  lb_pr_preview: { bg:'Преглед (лист 1)', ru:'Предпросмотр (лист 1)', uk:'Перегляд (аркуш 1)', en:'Preview (sheet 1)', de:'Vorschau (Bogen 1)', fr:'Aperçu (feuille 1)', es:'Vista previa (hoja 1)', 'es-MX':'Vista previa (hoja 1)', it:'Anteprima (foglio 1)', pt:'Pré-visualização (folha 1)', ar:'معاينة (الورقة 1)', hi:'पूर्वावलोकन (शीट 1)', ja:'プレビュー（1枚目）', ky:'Алдын ала көрүү (1-барак)', 'zh-Hant':'預覽（第 1 張）' },
  lb_pr_sel_hint: { bg:'Отбележи предметите за печат:', ru:'Отметь предметы для печати:', uk:'Познач предмети для друку:', en:'Tick the items to print:', de:'Gegenstände zum Drucken anhaken:', fr:'Coche les objets à imprimer :', es:'Marca los objetos a imprimir:', 'es-MX':'Marca los objetos a imprimir:', it:'Spunta gli oggetti da stampare:', pt:'Marca os itens a imprimir:', ar:'حدّد الأغراض للطباعة:', hi:'प्रिंट के लिए वस्तुएँ चुनें:', ja:'印刷するアイテムにチェック:', ky:'Басып чыгаруучу буюмдарды белгиле:', 'zh-Hant':'勾選要列印的物品：' },
  lb_cat_item: { bg:'Предмет', ru:'Предмет', uk:'Предмет', en:'Item', de:'Gegenstand', fr:'Objet', es:'Objeto', 'es-MX':'Objeto', it:'Oggetto', pt:'Item', ar:'غرض', hi:'वस्तु', ja:'物品', ky:'Буюм', 'zh-Hant':'物品' },
  lb_cat_box: { bg:'Кутия', ru:'Коробка', uk:'Коробка', en:'Box', de:'Karton', fr:'Boîte', es:'Caja', 'es-MX':'Caja', it:'Scatola', pt:'Caixa', ar:'صندوق', hi:'डिब्बा', ja:'箱', ky:'Куту', 'zh-Hant':'箱子' },
  lb_cat_keys: { bg:'Ключове', ru:'Ключи', uk:'Ключі', en:'Keys', de:'Schlüssel', fr:'Clés', es:'Llaves', 'es-MX':'Llaves', it:'Chiavi', pt:'Chaves', ar:'مفاتيح', hi:'चाबियाँ', ja:'鍵', ky:'Ачкычтар', 'zh-Hant':'鑰匙' },
  lb_cat_med: { bg:'Лекарства', ru:'Лекарства', uk:'Ліки', en:'Medicines', de:'Medikamente', fr:'Médicaments', es:'Medicamentos', 'es-MX':'Medicamentos', it:'Medicinali', pt:'Medicamentos', ar:'أدوية', hi:'दवाइयाँ', ja:'薬', ky:'Дарылар', 'zh-Hant':'藥品' },
  lb_cat_doc: { bg:'Документи', ru:'Документы', uk:'Документи', en:'Documents', de:'Dokumente', fr:'Documents', es:'Documentos', 'es-MX':'Documentos', it:'Documenti', pt:'Documentos', ar:'مستندات', hi:'दस्तावेज़', ja:'書類', ky:'Документтер', 'zh-Hant':'文件' },
  lb_cat_tool: { bg:'Инструменти', ru:'Инструменты', uk:'Інструменти', en:'Tools', de:'Werkzeug', fr:'Outils', es:'Herramientas', 'es-MX':'Herramientas', it:'Attrezzi', pt:'Ferramentas', ar:'أدوات', hi:'औज़ार', ja:'工具', ky:'Аспаптар', 'zh-Hant':'工具' },
  lb_cat_elec: { bg:'Електроника', ru:'Электроника', uk:'Електроніка', en:'Electronics', de:'Elektronik', fr:'Électronique', es:'Electrónica', 'es-MX':'Electrónica', it:'Elettronica', pt:'Eletrónica', ar:'إلكترونيات', hi:'इलेक्ट्रॉनिक्स', ja:'電子機器', ky:'Электроника', 'zh-Hant':'電子產品' },
  lb_cat_cloth: { bg:'Дрехи', ru:'Одежда', uk:'Одяг', en:'Clothes', de:'Kleidung', fr:'Vêtements', es:'Ropa', 'es-MX':'Ropa', it:'Vestiti', pt:'Roupa', ar:'ملابس', hi:'कपड़े', ja:'衣類', ky:'Кийим', 'zh-Hant':'衣物' },
  lb_cat_food: { bg:'Храна', ru:'Еда', uk:'Їжа', en:'Food', de:'Lebensmittel', fr:'Nourriture', es:'Comida', 'es-MX':'Comida', it:'Cibo', pt:'Comida', ar:'طعام', hi:'भोजन', ja:'食品', ky:'Тамак', 'zh-Hant':'食品' },
  lb_cat_other: { bg:'Друго', ru:'Другое', uk:'Інше', en:'Other', de:'Sonstiges', fr:'Autre', es:'Otro', 'es-MX':'Otro', it:'Altro', pt:'Outro', ar:'أخرى', hi:'अन्य', ja:'その他', ky:'Башка', 'zh-Hant':'其他' },
  lb_stats: { bg:'{0} предмета · {1} назаем · {2} изтичащи', ru:'{0} предметов · {1} взаймы · {2} истекают', uk:'{0} предметів · {1} позичено · {2} спливають', en:'{0} items · {1} lent out · {2} expiring', de:'{0} Gegenstände · {1} verliehen · {2} ablaufend', fr:'{0} objets · {1} prêtés · {2} expirant', es:'{0} objetos · {1} prestados · {2} por caducar', 'es-MX':'{0} objetos · {1} prestados · {2} por caducar', it:'{0} oggetti · {1} in prestito · {2} in scadenza', pt:'{0} itens · {1} emprestados · {2} a expirar', ar:'{0} غرض · {1} مُعار · {2} تنتهي قريبًا', hi:'{0} वस्तुएँ · {1} उधार · {2} समाप्त हो रहे', ja:'{0}件 · 貸出中{1} · 期限間近{2}', ky:'{0} буюм · {1} карызга · {2} бүтүүдө', 'zh-Hant':'{0} 件 · 外借 {1} · 即將到期 {2}' },
  lb_alert_title: { bg:'Внимание', ru:'Внимание', uk:'Увага', en:'Attention', de:'Achtung', fr:'Attention', es:'Atención', 'es-MX':'Atención', it:'Attenzione', pt:'Atenção', ar:'تنبيه', hi:'ध्यान दें', ja:'注意', ky:'Көңүл бургула', 'zh-Hant':'注意' },
  lb_notif_exp_title: { bg:'Срокът изтича: {0}', ru:'Истекает срок: {0}', uk:'Спливає термін: {0}', en:'Expiring soon: {0}', de:'Läuft bald ab: {0}', fr:'Expire bientôt : {0}', es:'Caduca pronto: {0}', 'es-MX':'Caduca pronto: {0}', it:'In scadenza: {0}', pt:'A expirar: {0}', ar:'ينتهي قريبًا: {0}', hi:'जल्द समाप्त: {0}', ja:'期限間近: {0}', ky:'Мөөнөтү бүтүүдө: {0}', 'zh-Hant':'即將到期：{0}' },
  lb_notif_exp_body: { bg:'{0} изтича на {1}', ru:'{0} истекает {1}', uk:'{0} спливає {1}', en:'{0} expires on {1}', de:'{0} läuft am {1} ab', fr:'{0} expire le {1}', es:'{0} caduca el {1}', 'es-MX':'{0} caduca el {1}', it:'{0} scade il {1}', pt:'{0} expira em {1}', ar:'{0} ينتهي في {1}', hi:'{0} {1} को समाप्त', ja:'{0}は{1}に期限切れ', ky:'{0} {1} бүтөт', 'zh-Hant':'{0} 將於 {1} 到期' },
  lb_notif_lend_title: { bg:'Време за връщане: {0}', ru:'Пора вернуть: {0}', uk:'Час повернути: {0}', en:'Return due: {0}', de:'Rückgabe fällig: {0}', fr:'Retour attendu : {0}', es:'Devolución: {0}', 'es-MX':'Devolución: {0}', it:'Da restituire: {0}', pt:'Devolução: {0}', ar:'موعد الإرجاع: {0}', hi:'वापसी का समय: {0}', ja:'返却期限: {0}', ky:'Кайтаруу убактысы: {0}', 'zh-Hant':'該歸還了：{0}' },
  lb_notif_lend_body: { bg:'{0} трябва да върне {1} на {2}', ru:'{0} должен вернуть {1} {2}', uk:'{0} має повернути {1} {2}', en:'{0} should return {1} on {2}', de:'{0} soll {1} am {2} zurückgeben', fr:'{0} doit rendre {1} le {2}', es:'{0} debe devolver {1} el {2}', 'es-MX':'{0} debe devolver {1} el {2}', it:'{0} deve restituire {1} il {2}', pt:'{0} deve devolver {1} em {2}', ar:'{0} يجب أن يعيد {1} في {2}', hi:'{0} को {1} {2} तक लौटाना है', ja:'{0}は{1}を{2}に返却', ky:'{0} {1} буюмун {2} кайтарышы керек', 'zh-Hant':'{0} 應於 {2} 歸還 {1}' },
  // Примерни предмети (първо пускане)
  lb_s1n: { bg:'Зимни гуми', ru:'Зимние шины', uk:'Зимові шини', en:'Winter tyres', de:'Winterreifen', fr:'Pneus hiver', es:'Neumáticos de invierno', 'es-MX':'Llantas de invierno', it:'Gomme invernali', pt:'Pneus de inverno', ar:'إطارات شتوية', hi:'सर्दियों के टायर', ja:'冬タイヤ', ky:'Кышкы дөңгөлөктөр', 'zh-Hant':'冬季輪胎' },
  lb_s1l: { bg:'Гараж, горен рафт', ru:'Гараж, верхняя полка', uk:'Гараж, верхня полиця', en:'Garage, top shelf', de:'Garage, oberes Regal', fr:'Garage, étagère du haut', es:'Garaje, estante superior', 'es-MX':'Garaje, estante superior', it:'Garage, ripiano in alto', pt:'Garagem, prateleira de cima', ar:'المرآب، الرف العلوي', hi:'गैराज, ऊपरी शेल्फ', ja:'ガレージ、上の棚', ky:'Гараж, үстүңкү текче', 'zh-Hant':'車庫，最上層架' },
  lb_s2n: { bg:'Кутия с кабели и зарядни', ru:'Коробка с кабелями и зарядками', uk:'Коробка з кабелями і зарядками', en:'Cables and chargers box', de:'Kiste mit Kabeln und Ladegeräten', fr:'Boîte câbles et chargeurs', es:'Caja de cables y cargadores', 'es-MX':'Caja de cables y cargadores', it:'Scatola cavi e caricatori', pt:'Caixa de cabos e carregadores', ar:'صندوق الكابلات والشواحن', hi:'केबल और चार्जर का डिब्बा', ja:'ケーブル・充電器の箱', ky:'Кабель жана заряддагыч кутусу', 'zh-Hant':'線材與充電器箱' },
  lb_s2l: { bg:'Килер, кутия К-2', ru:'Кладовая, коробка К-2', uk:'Комора, коробка К-2', en:'Storage room, box S-2', de:'Abstellraum, Karton A-2', fr:'Cellier, boîte C-2', es:'Trastero, caja T-2', 'es-MX':'Bodega, caja B-2', it:'Ripostiglio, scatola R-2', pt:'Arrecadação, caixa A-2', ar:'غرفة التخزين، الصندوق S-2', hi:'स्टोर रूम, बॉक्स S-2', ja:'物置、箱S-2', ky:'Кампа, K-2 кутусу', 'zh-Hant':'儲藏室，箱 S-2' },
  lb_s3n: { bg:'Резервни ключове — вила', ru:'Запасные ключи — дача', uk:'Запасні ключі — дача', en:'Spare keys — cottage', de:'Ersatzschlüssel — Ferienhaus', fr:'Doubles de clés — maison de campagne', es:'Llaves de repuesto — casa de campo', 'es-MX':'Llaves de repuesto — casa de campo', it:'Chiavi di riserva — casa di campagna', pt:'Chaves suplentes — casa de campo', ar:'مفاتيح احتياطية — البيت الريفي', hi:'अतिरिक्त चाबियाँ — कॉटेज', ja:'予備の鍵 — 別荘', ky:'Кошумча ачкычтар — дача', 'zh-Hant':'備用鑰匙 — 度假屋' },
  lb_s3l: { bg:'Чекмедже в антрето', ru:'Ящик в прихожей', uk:'Шухляда в передпокої', en:'Hallway drawer', de:'Schublade im Flur', fr:'Tiroir de l’entrée', es:'Cajón del recibidor', 'es-MX':'Cajón del recibidor', it:'Cassetto dell’ingresso', pt:'Gaveta da entrada', ar:'درج المدخل', hi:'हॉलवे की दराज', ja:'玄関の引き出し', ky:'Кире бериштеги суурма', 'zh-Hant':'玄關抽屜' },
  lb_s4n: { bg:'Парацетамол 500 mg', ru:'Парацетамол 500 мг', uk:'Парацетамол 500 мг', en:'Paracetamol 500 mg', de:'Paracetamol 500 mg', fr:'Paracétamol 500 mg', es:'Paracetamol 500 mg', 'es-MX':'Paracetamol 500 mg', it:'Paracetamolo 500 mg', pt:'Paracetamol 500 mg', ar:'باراسيتامول 500 ملغ', hi:'पैरासिटामोल 500 mg', ja:'アセトアミノフェン 500 mg', ky:'Парацетамол 500 мг', 'zh-Hant':'撲熱息痛 500 mg' },
  lb_s4l: { bg:'Аптечка в банята', ru:'Аптечка в ванной', uk:'Аптечка у ванній', en:'Bathroom medicine cabinet', de:'Medizinschrank im Bad', fr:'Armoire à pharmacie, salle de bain', es:'Botiquín del baño', 'es-MX':'Botiquín del baño', it:'Armadietto dei medicinali in bagno', pt:'Armário dos medicamentos, casa de banho', ar:'خزانة الأدوية في الحمام', hi:'बाथरूम की दवा अलमारी', ja:'洗面所の薬箱', ky:'Ваннадагы дары кутусу', 'zh-Hant':'浴室藥櫃' },
  lb_s5n: { bg:'Договор за наем', ru:'Договор аренды', uk:'Договір оренди', en:'Rental contract', de:'Mietvertrag', fr:'Contrat de location', es:'Contrato de alquiler', 'es-MX':'Contrato de renta', it:'Contratto di affitto', pt:'Contrato de arrendamento', ar:'عقد الإيجار', hi:'किराया अनुबंध', ja:'賃貸契約書', ky:'Ижара келишими', 'zh-Hant':'租賃合約' },
  lb_s5l: { bg:'Папка „Документи", шкаф в хола', ru:'Папка «Документы», шкаф в гостиной', uk:'Тека «Документи», шафа у вітальні', en:'“Documents” folder, living room cabinet', de:'Ordner „Dokumente“, Wohnzimmerschrank', fr:'Classeur « Documents », meuble du salon', es:'Carpeta «Documentos», mueble del salón', 'es-MX':'Carpeta «Documentos», mueble de la sala', it:'Cartella «Documenti», mobile del soggiorno', pt:'Pasta «Documentos», armário da sala', ar:'ملف «المستندات»، خزانة غرفة المعيشة', hi:'“दस्तावेज़” फ़ोल्डर, लिविंग रूम की अलमारी', ja:'「書類」ファイル、リビングの棚', ky:'«Документтер» папкасы, конок бөлмөдөгү шкаф', 'zh-Hant':'「文件」資料夾，客廳櫃子' },
  lb_s6n: { bg:'Ударна бормашина', ru:'Ударная дрель', uk:'Ударний дриль', en:'Hammer drill', de:'Schlagbohrmaschine', fr:'Perceuse à percussion', es:'Taladro percutor', 'es-MX':'Taladro percutor', it:'Trapano a percussione', pt:'Berbequim de percussão', ar:'مثقاب مطرقي', hi:'हैमर ड्रिल', ja:'振動ドリル', ky:'Урма бургулагыч', 'zh-Hant':'衝擊電鑽' },
  lb_s6l: { bg:'Гараж, стена с инструменти', ru:'Гараж, стена с инструментами', uk:'Гараж, стіна з інструментами', en:'Garage, tool wall', de:'Garage, Werkzeugwand', fr:'Garage, mur à outils', es:'Garaje, pared de herramientas', 'es-MX':'Garaje, pared de herramientas', it:'Garage, parete attrezzi', pt:'Garagem, parede de ferramentas', ar:'المرآب، جدار الأدوات', hi:'गैराज, औज़ार की दीवार', ja:'ガレージ、工具壁', ky:'Гараж, аспаптар дубалы', 'zh-Hant':'車庫，工具牆' },
  lb_s6who: { bg:'Иван (съсед)', ru:'Иван (сосед)', uk:'Іван (сусід)', en:'John (neighbour)', de:'Jonas (Nachbar)', fr:'Julien (voisin)', es:'Juan (vecino)', 'es-MX':'Juan (vecino)', it:'Marco (vicino)', pt:'João (vizinho)', ar:'أحمد (الجار)', hi:'राहुल (पड़ोसी)', ja:'田中さん（隣人）', ky:'Азамат (кошуна)', 'zh-Hant':'小明（鄰居）' },
  lb_s4notes: { bg:'20 таблетки, отворена опаковка', ru:'20 таблеток, открытая упаковка', uk:'20 таблеток, відкрита упаковка', en:'20 tablets, opened pack', de:'20 Tabletten, Packung geöffnet', fr:'20 comprimés, boîte ouverte', es:'20 comprimidos, caja abierta', 'es-MX':'20 tabletas, caja abierta', it:'20 compresse, confezione aperta', pt:'20 comprimidos, embalagem aberta', ar:'20 قرصًا، عبوة مفتوحة', hi:'20 गोलियाँ, खुला पैक', ja:'20錠、開封済み', ky:'20 таблетка, ачылган таңгак', 'zh-Hant':'20 錠，已開封' },
});

export const title = 'QR labels';

// ───────────────────────── данни ─────────────────────────
const LS = 'pupikes.qr.labels.v1';
const CATS = { item: '📦', box: '🗃️', keys: '🔑', med: '💊', doc: '📄', tool: '🛠️', elec: '🔌', cloth: '👕', food: '🥫', other: '🏷️' };
const PAGES = { A4: [210, 297], Letter: [215.9, 279.4] };
const SIZES = { s: 25, m: 35, l: 50 };
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function load() {
  try { const d = JSON.parse(localStorage.getItem(LS)); if (d && Array.isArray(d.items)) return d; } catch (e) {}
  return null;
}
function save(db) { try { localStorage.setItem(LS, JSON.stringify(db)); } catch (e) {} }
function uid() { return 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function newCode(db) {
  for (let tries = 0; tries < 50; tries++) {
    let c = 'PQL-'; for (let i = 0; i < 6; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    if (!db.items.some((x) => x.code === c)) return c;
  }
  return 'PQL-' + Date.now().toString(36).toUpperCase();
}
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// дни от днес до дата (отрицателно = минало)
function daysTo(iso) { if (!iso) return null; const a = new Date(iso + 'T12:00:00'), b = new Date(); b.setHours(12, 0, 0, 0); return Math.round((a - b) / 86400000); }
function fmtDate(iso) { if (!iso) return ''; try { return new Date(iso + 'T12:00:00').toLocaleDateString(); } catch (e) { return iso; } }
const activeLend = (it) => (it.lend || []).find((l) => !l.returned) || null;
const expSoon = (it) => { if (!it.expiry) return false; const d = daysTo(it.expiry); return d !== null && d <= (it.remind || 7); };

// Примерни предмети при първо пускане (ясно маркирани, с бутон за изтриване).
function seed() {
  const db = { v: 1, items: [] };
  const mk = (n, l, cat, extra) => Object.assign({ id: uid(), code: newCode(db), name: t(n), loc: t(l), cat, notes: '', expiry: '', remind: 7, photo: '', lend: [], printed: false, sample: true, created: todayISO() }, extra || {});
  db.items.push(mk('lb_s1n', 'lb_s1l', 'item'));
  db.items.push(mk('lb_s2n', 'lb_s2l', 'box'));
  db.items.push(mk('lb_s3n', 'lb_s3l', 'keys'));
  db.items.push(mk('lb_s4n', 'lb_s4l', 'med', { expiry: plusDays(5), remind: 7, notes: t('lb_s4notes') }));
  db.items.push(mk('lb_s5n', 'lb_s5l', 'doc', { expiry: plusDays(300), remind: 30 }));
  db.items.push(mk('lb_s6n', 'lb_s6l', 'tool', { lend: [{ who: t('lb_s6who'), since: plusDays(-10), due: plusDays(-2), returned: '' }] }));
  save(db); return db;
}

// ───────────────────────── известия (LocalNotifications, синхронно от window.Capacitor.Plugins) ─────────────────────────
let _ln = null, _lnReady = false;
function getLN() {
  if (_lnReady) return _ln; _lnReady = true;
  try { const cap = window.Capacitor; _ln = (cap && cap.Plugins && cap.Plugins.LocalNotifications) ? cap.Plugins.LocalNotifications : false; } catch (e) { _ln = false; }
  return _ln;
}
function nid(id, kind) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return (Math.abs(h) % 1e7) * 2 + kind; }
// (Пре)насрочва известията за един предмет: срок (remind дни преди, 09:00) и връщане на заем (в деня, 09:00).
async function syncNotif(it) {
  const ln = getLN(); if (!ln) return;
  try { await ln.cancel({ notifications: [{ id: nid(it.id, 0) }, { id: nid(it.id, 1) }] }); } catch (e) {}
  const list = [];
  if (it.expiry) { const at = new Date(it.expiry + 'T09:00:00'); at.setDate(at.getDate() - (it.remind || 7)); if (at > new Date()) list.push({ id: nid(it.id, 0), title: tf('lb_notif_exp_title', it.name), body: tf('lb_notif_exp_body', it.name, fmtDate(it.expiry)), schedule: { at } }); }
  const l = activeLend(it);
  if (l && l.due) { const at = new Date(l.due + 'T09:00:00'); if (at > new Date()) list.push({ id: nid(it.id, 1), title: tf('lb_notif_lend_title', it.name), body: tf('lb_notif_lend_body', l.who, it.name, fmtDate(l.due)), schedule: { at } }); }
  if (!list.length) return;
  try { await ln.requestPermissions(); } catch (e) {}
  try { await ln.schedule({ notifications: list }); } catch (e) {}
}
async function cancelNotif(it) { const ln = getLN(); if (!ln) return; try { await ln.cancel({ notifications: [{ id: nid(it.id, 0) }, { id: nid(it.id, 1) }] }); } catch (e) {} }

// ───────────────────────── етикети (рисуване) ─────────────────────────
// Рисува един етикет в платно: QR + име + място. sizeMm = страна на QR частта; текстовата лента е +9 мм.
async function drawLabel(cx, x, y, wPx, hPx, it, dpi) {
  const mm = dpi / 25.4, pad = 1.5 * mm, qrPx = Math.round(wPx - 2 * pad);
  cx.fillStyle = '#fff'; cx.fillRect(x, y, wPx, hPx);
  cx.strokeStyle = '#b8bec8'; cx.lineWidth = Math.max(1, dpi / 300); cx.setLineDash([4 * dpi / 300, 4 * dpi / 300]); cx.strokeRect(x + 0.5, y + 0.5, wPx - 1, hPx - 1); cx.setLineDash([]);
  const tmp = document.createElement('canvas');
  await QRCode.toCanvas(tmp, it.code, { width: qrPx, margin: 0, errorCorrectionLevel: 'M' });
  cx.drawImage(tmp, x + pad, y + pad, qrPx, qrPx);
  const fs1 = Math.max(7, Math.round(wPx * 0.085)), fs2 = Math.max(6, Math.round(wPx * 0.065));
  const fit = (s, f, maxW) => { cx.font = f; let str = String(s || ''); while (str.length > 1 && cx.measureText(str).width > maxW) str = str.slice(0, -2) + '…'; return str; };
  cx.fillStyle = '#111'; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
  const ty = y + pad + qrPx + fs1 + 1.2 * mm;
  cx.fillText(fit(it.name, 'bold ' + fs1 + 'px system-ui, sans-serif', wPx - 2 * pad), x + wPx / 2, ty);
  cx.fillStyle = '#444';
  cx.fillText(fit(it.loc || it.code, fs2 + 'px system-ui, sans-serif', wPx - 2 * pad), x + wPx / 2, ty + fs2 + 0.6 * mm);
  cx.fillStyle = '#888'; cx.font = Math.max(5, Math.round(wPx * 0.05)) + 'px ui-monospace, monospace';
  cx.fillText(it.code, x + wPx / 2, y + hPx - 0.9 * mm);
}
// Разполага етикетите по листове; връща { canvases: [], perSheet }.
async function renderSheets(items, sizeKey, pageKey, dpi, onlyFirst) {
  const mm = dpi / 25.4, [pw, ph] = PAGES[pageKey] || PAGES.A4, s = SIZES[sizeKey] || 35;
  const W = Math.round(pw * mm), H = Math.round(ph * mm), margin = 8 * mm, gap = 2 * mm;
  const lw = Math.round(s * mm), lh = Math.round((s + 9) * mm);
  const cols = Math.max(1, Math.floor((W - 2 * margin + gap) / (lw + gap))), rows = Math.max(1, Math.floor((H - 2 * margin + gap) / (lh + gap)));
  const per = cols * rows, pages = Math.max(1, Math.ceil(items.length / per)), canvases = [];
  for (let p = 0; p < pages; p++) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
    const chunk = items.slice(p * per, (p + 1) * per);
    for (let i = 0; i < chunk.length; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      await drawLabel(cx, Math.round(margin + c * (lw + gap)), Math.round(margin + r * (lh + gap)), lw, lh, chunk[i], dpi);
    }
    canvases.push(cv); if (onlyFirst) break;
  }
  return { canvases, perSheet: per, pages };
}
async function savePng(cv, name) { await new Promise((res) => cv.toBlob(async (b) => { if (b) await saveFile(name, b, 'image/png'); res(); }, 'image/png')); }
async function savePdf(canvases, pageKey, name) {
  const { PDFDocument } = await import('pdf-lib');
  const [pw, ph] = PAGES[pageKey] || PAGES.A4, doc = await PDFDocument.create(), PT = 72 / 25.4;
  for (const cv of canvases) {
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const png = await doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
    const page = doc.addPage([pw * PT, ph * PT]); page.drawImage(png, { x: 0, y: 0, width: pw * PT, height: ph * PT });
  }
  const bytes = await doc.save();
  await saveFile(name, new Blob([bytes], { type: 'application/pdf' }), 'application/pdf');
}
// Снимката се смалява до 480 px и се пази като JPEG data-URL (localStorage).
function shrinkPhoto(dataUrl) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => { const s = Math.min(1, 480 / Math.max(im.naturalWidth, im.naturalHeight)); const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * s)); cv.height = Math.max(1, Math.round(im.naturalHeight * s)); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', 0.8)); };
    im.onerror = () => res(''); im.src = dataUrl;
  });
}
// jsQR връща latin1 низ — за UTF-8 съдържание декодираме суровите байтове.
function qrText(code) { if (!code) return null; try { if (code.binaryData && code.binaryData.length) return new TextDecoder('utf-8').decode(new Uint8Array(code.binaryData)); } catch (e) {} return code.data; }

// ───────────────────────── UI ─────────────────────────
export function render(root) {
  let db = load() || seed();
  let tab = 'items', filter = 'all', query = '', printSel = {};
  let camStream = null, camRAF = null;
  const $ = (s) => root.querySelector(s);
  const catLabel = (c) => (CATS[c] || CATS.other) + ' ' + t('lb_cat_' + (CATS[c] ? c : 'other'));
  const B = (id, label, cls) => `<button class="btn inline ${cls || 'sec'}" id="${id}" style="margin-top:0">${label}</button>`;

  root.innerHTML = `
    <div class="tabs" id="lb-tabs" style="flex-wrap:nowrap">
      <button class="tab active" data-tab="items" style="min-width:0;padding:10px 4px">📦 ${esc(t('lb_tab_items'))}</button>
      <button class="tab" data-tab="scan" style="min-width:0;padding:10px 4px">📷 ${esc(t('lb_tab_scan'))}</button>
      <button class="tab" data-tab="print" style="min-width:0;padding:10px 4px">🖨 ${esc(t('lb_tab_print'))}</button>
      <button class="tab" data-tab="lend" style="min-width:0;padding:10px 4px">🤝 ${esc(t('lb_tab_lend'))}</button>
    </div>
    <div id="lb-body"></div>`;
  const body = $('#lb-body');
  root.querySelectorAll('#lb-tabs .tab').forEach((b) => b.onclick = () => { stopCam(); tab = b.dataset.tab; root.querySelectorAll('#lb-tabs .tab').forEach((x) => x.classList.toggle('active', x === b)); draw(); });

  function draw() { if (tab === 'items') drawList(); else if (tab === 'scan') drawScan(); else if (tab === 'print') drawPrint(); else drawLend(); }

  // статусен ред на предмета (срок / заем)
  function statusHTML(it) {
    const parts = [];
    if (it.expiry) { const d = daysTo(it.expiry); const col = d < 0 ? 'var(--err)' : (d <= (it.remind || 7) ? 'var(--warn)' : 'var(--text-dim)'); parts.push(`<span style="color:${col}">⏳ ${esc(d < 0 ? tf('lb_expired', -d) : (d === 0 ? t('lb_exp_today') : tf('lb_exp_in', d)))}</span>`); }
    const l = activeLend(it);
    if (l) { const d = daysTo(l.due); parts.push(`<span style="color:${d !== null && d < 0 ? 'var(--err)' : 'var(--accent-2)'}">🤝 ${esc(tf('lb_lent_to', l.who))}${l.due ? ' · ' + esc(d !== null && d < 0 ? tf('lb_overdue', -d) : tf('lb_due', fmtDate(l.due))) : ''}</span>`); }
    return parts.join(' &nbsp; ');
  }
  function thumbHTML(it, size) {
    const s = size || 56;
    return it.photo ? `<img src="${it.photo}" style="width:${s}px;height:${s}px;object-fit:cover;border-radius:10px;flex:0 0 auto" alt="">`
      : `<div style="width:${s}px;height:${s}px;border-radius:10px;background:var(--bg-3);display:flex;align-items:center;justify-content:center;font-size:${Math.round(s * 0.5)}px;flex:0 0 auto">${CATS[it.cat] || CATS.other}</div>`;
  }

  // ── Предмети (списък + търсене + филтри) ──
  function drawList() {
    const all = db.items, lentN = all.filter(activeLend).length, expN = all.filter(expSoon).length;
    const q = query.trim().toLowerCase();
    let list = all.filter((it) => !q || [it.name, it.loc, it.notes, it.code, t('lb_cat_' + it.cat)].some((s) => String(s || '').toLowerCase().includes(q)));
    if (filter === 'lent') list = list.filter(activeLend); else if (filter === 'exp') list = list.filter(expSoon); else if (filter === 'unprinted') list = list.filter((x) => !x.printed);
    list = list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const hasSample = all.some((x) => x.sample);
    const alerts = all.filter((it) => expSoon(it) || (activeLend(it) && activeLend(it).due && daysTo(activeLend(it).due) < 0));
    const chip = (k, lbl) => `<button class="tab${filter === k ? ' active' : ''}" data-f="${k}" style="flex:0 0 auto;min-width:0;padding:7px 12px">${esc(lbl)}</button>`;
    body.innerHTML = `
      <p class="hint" style="margin:0 0 10px">${esc(t('lb_intro'))}</p>
      <div class="hint" style="margin:0 0 8px;color:var(--accent-2);font-weight:600">${esc(tf('lb_stats', all.length, lentN, expN))}</div>
      ${alerts.length ? `<div class="notice" style="margin-bottom:10px;padding:10px 12px"><b>${esc(t('lb_alert_title'))}</b><div style="margin-top:4px">${alerts.map((it) => `<div data-open="${esc(it.id)}" style="cursor:pointer;padding:2px 0">• ${esc(it.name)} — ${statusHTML(it)}</div>`).join('')}</div></div>` : ''}
      <div style="display:flex;gap:8px;align-items:center">
        <input class="search" id="lb-q" type="search" placeholder="${esc(t('lb_search_ph'))}" value="${esc(query)}" style="margin:0;flex:1">
        <button class="btn inline" id="lb-new" style="margin:0;white-space:nowrap">＋ ${esc(t('lb_new'))}</button>
      </div>
      <div class="tabs" style="margin:10px 0;overflow-x:auto;flex-wrap:nowrap">${chip('all', t('lb_f_all'))}${chip('lent', t('lb_f_lent') + (lentN ? ' ' + lentN : ''))}${chip('exp', t('lb_f_exp') + (expN ? ' ' + expN : ''))}${chip('unprinted', t('lb_f_unprinted'))}</div>
      ${hasSample ? `<div class="hint" style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:0 0 10px"><span>${esc(t('lb_sample_note'))}</span><button class="btn inline sec" id="lb-delsamples" style="margin:0;padding:8px 12px;font-size:.85em;white-space:nowrap">${esc(t('lb_sample_del'))}</button></div>` : ''}
      <div id="lb-list">${list.length ? list.map((it) => `
        <div class="card" data-open="${esc(it.id)}" style="flex-direction:row;align-items:center;gap:12px;padding:12px;margin-bottom:8px">
          ${thumbHTML(it)}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${esc(it.name)}${it.sample ? `<span class="tag" style="color:var(--text-dim);border-color:var(--line)">${esc(t('lb_sample_badge'))}</span>` : ''}${!it.printed ? `<span class="tag" style="color:var(--text-dim);border-color:var(--line)">${esc(t('lb_f_unprinted'))}</span>` : ''}</div>
            <div style="font-size:.85em;color:var(--text-dim)">${esc(catLabel(it.cat))}${it.loc ? ' · 📍 ' + esc(it.loc) : ''}</div>
            <div style="font-size:.82em;margin-top:2px">${statusHTML(it)}</div>
          </div>
          <div style="font-family:ui-monospace,monospace;font-size:.7em;color:var(--text-dim);writing-mode:vertical-rl;transform:rotate(180deg)">${esc(it.code)}</div>
        </div>`).join('') : `<div class="empty">${esc(t('lb_empty'))}</div>`}</div>`;
    $('#lb-q').oninput = (e) => { query = e.target.value; const pos = e.target.selectionStart; drawList(); const el = $('#lb-q'); el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {} };
    body.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { filter = b.dataset.f; drawList(); });
    $('#lb-new').onclick = () => drawForm(null);
    body.querySelectorAll('[data-open]').forEach((el) => el.onclick = () => drawCard(el.dataset.open));
    const ds = $('#lb-delsamples'); if (ds) ds.onclick = () => { db.items.filter((x) => x.sample).forEach(cancelNotif); db.items = db.items.filter((x) => !x.sample); save(db); drawList(); };
  }

  // ── Форма (нов / редакция) ──
  function drawForm(id, presetCode) {
    const it = id ? db.items.find((x) => x.id === id) : null;
    const e = it ? JSON.parse(JSON.stringify(it)) : { id: uid(), code: presetCode || newCode(db), name: '', loc: '', cat: 'item', notes: '', expiry: '', remind: 7, photo: '', lend: [], printed: false, sample: false, created: todayISO() };
    const opt = Object.keys(CATS).map((k) => `<option value="${k}"${k === e.cat ? ' selected' : ''}>${esc(catLabel(k))}</option>`).join('');
    body.innerHTML = `
      <div class="tool-card">
        <label>${esc(t('lb_name'))}</label><input id="f-name" value="${esc(e.name)}" placeholder="${esc(t('lb_name_ph'))}">
        <div class="row">
          <div><label>${esc(t('lb_cat'))}</label><select id="f-cat">${opt}</select></div>
          <div><label>${esc(t('lb_code'))}</label><input id="f-code" value="${esc(e.code)}" style="font-family:ui-monospace,monospace"></div>
        </div>
        <label>${esc(t('lb_loc'))}</label><input id="f-loc" value="${esc(e.loc)}" placeholder="${esc(t('lb_loc_ph'))}">
        <div class="row">
          <div><label>${esc(t('lb_expiry'))}</label><input id="f-exp" type="date" value="${esc(e.expiry)}"></div>
          <div><label>${esc(t('lb_remind'))}</label><input id="f-rem" type="number" min="0" max="365" value="${esc(e.remind)}"></div>
        </div>
        <label>${esc(t('lb_notes'))}</label><textarea id="f-notes" style="min-height:70px">${esc(e.notes)}</textarea>
        <label>${esc(t('lb_photo'))}</label>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap" id="f-photo-wrap">
          <div id="f-thumb">${thumbHTML(e, 72)}</div>
          ${B('f-pick', '🖼 ' + esc(t('lb_photo_pick')))}
          ${e.photo ? B('f-nophoto', esc(t('lb_photo_del'))) : ''}
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn" id="f-save" style="margin:0;flex:1">${esc(t('lb_save'))}</button>
          <button class="btn sec" id="f-cancel" style="margin:0;flex:1">${esc(t('lb_cancel'))}</button>
        </div>
      </div>`;
    $('#f-pick').onclick = async () => { try { const f = await pickBinaryFile('image/*'); if (f && f.dataUrl) { e.photo = await shrinkPhoto(f.dataUrl); $('#f-thumb').innerHTML = thumbHTML(e, 72); } } catch (err) { alert(String(err && err.message || err)); } };
    const np = $('#f-nophoto'); if (np) np.onclick = () => { e.photo = ''; $('#f-thumb').innerHTML = thumbHTML(e, 72); np.remove(); };
    $('#f-cancel').onclick = () => (it ? drawCard(it.id) : drawList());
    $('#f-save').onclick = () => {
      e.name = $('#f-name').value.trim(); if (!e.name) { alert(t('lb_need_name')); return; }
      e.cat = $('#f-cat').value; e.loc = $('#f-loc').value.trim(); e.expiry = $('#f-exp').value; e.remind = Math.max(0, parseInt($('#f-rem').value, 10) || 0); e.notes = $('#f-notes').value.trim();
      const code = $('#f-code').value.trim(); e.code = code || e.code; e.sample = false;
      const i = db.items.findIndex((x) => x.id === e.id); if (i >= 0) db.items[i] = e; else db.items.push(e);
      save(db); syncNotif(e); drawCard(e.id);
    };
  }

  // ── Карта на предмета ──
  function drawCard(id) {
    const it = db.items.find((x) => x.id === id); if (!it) { drawList(); return; }
    const l = activeLend(it), hist = (it.lend || []).slice().reverse();
    body.innerHTML = `
      <div class="tool-card">
        <div style="display:flex;gap:14px;align-items:flex-start">
          ${thumbHTML(it, 96)}
          <div style="flex:1;min-width:0">
            <div style="font-size:1.2em;font-weight:700">${esc(it.name)}${it.sample ? ` <span class="tag" style="color:var(--text-dim);border-color:var(--line)">${esc(t('lb_sample_badge'))}</span>` : ''}</div>
            <div style="color:var(--text-dim);font-size:.9em">${esc(catLabel(it.cat))}</div>
            ${it.loc ? `<div style="margin-top:4px">📍 ${esc(it.loc)}</div>` : ''}
            <div style="font-size:.88em;margin-top:4px">${statusHTML(it)}</div>
            <div class="hint">${esc(t('lb_added'))}: ${esc(fmtDate(it.created))}</div>
          </div>
        </div>
        ${it.notes ? `<div class="out-block" style="margin-top:12px;white-space:pre-wrap">${esc(it.notes)}</div>` : ''}
        <div style="display:flex;gap:14px;align-items:center;margin-top:14px">
          <canvas id="c-qr" style="width:110px;height:110px;background:#fff;border-radius:10px;padding:6px;flex:0 0 auto"></canvas>
          <div style="flex:1;min-width:0">
            <div class="hint" style="margin:0">${esc(t('lb_code'))}</div>
            <div style="font-family:ui-monospace,monospace;font-weight:700;font-size:1.05em">${esc(it.code)}</div>
            ${B('c-png', '🏷 ' + esc(t('lb_label_png')))}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          ${B('c-edit', '✏️ ' + esc(t('lb_edit')))}${B('c-del', '🗑 ' + esc(t('lb_del')))}${B('c-back', '← ' + esc(t('lb_back_list')))}
        </div>
      </div>
      <div class="tool-card">
        <h3 style="margin:0 0 8px">🤝 ${esc(t('lb_tab_lend'))}</h3>
        ${l ? `<div style="margin-bottom:10px">${statusHTML(it)}</div><button class="btn" id="c-return" style="margin:0">✔ ${esc(t('lb_return_btn'))}</button>`
          : `<div class="row"><div><label>${esc(t('lb_lend_who'))}</label><input id="c-who"></div><div><label>${esc(t('lb_lend_due'))}</label><input id="c-due" type="date" value="${esc(plusDays(7))}"></div></div><button class="btn" id="c-lend">🤝 ${esc(t('lb_lend_btn'))}</button>`}
        <div class="hint" style="margin-top:12px;font-weight:600">${esc(t('lb_lend_hist'))}</div>
        ${hist.length ? hist.map((h) => `<div class="hint" style="margin:2px 0">• ${esc(h.who)} · ${esc(fmtDate(h.since))}${h.due ? ' → ' + esc(fmtDate(h.due)) : ''}${h.returned ? ' · ' + esc(tf('lb_returned_on', fmtDate(h.returned))) : ''}</div>`).join('') : `<div class="hint">${esc(t('lb_lend_none'))}</div>`}
      </div>`;
    QRCode.toCanvas($('#c-qr'), it.code, { width: 220, margin: 1 }).catch(() => {});
    $('#c-png').onclick = async () => { const dpi = 300, mm = dpi / 25.4, w = Math.round(35 * mm), h = Math.round(44 * mm); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; await drawLabel(cv.getContext('2d'), 0, 0, w, h, it, dpi); await savePng(cv, 'label-' + it.code + '.png'); };
    $('#c-edit').onclick = () => drawForm(it.id);
    $('#c-back').onclick = () => { tab = 'items'; root.querySelectorAll('#lb-tabs .tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'items')); drawList(); };
    $('#c-del').onclick = () => { if (!confirm(t('lb_del_confirm'))) return; cancelNotif(it); db.items = db.items.filter((x) => x.id !== it.id); save(db); drawList(); };
    const lendBtn = $('#c-lend'); if (lendBtn) lendBtn.onclick = () => { const who = $('#c-who').value.trim(); if (!who) { alert(t('lb_lend_need')); return; } it.lend = it.lend || []; it.lend.push({ who, since: todayISO(), due: $('#c-due').value || '', returned: '' }); it.sample = false; save(db); syncNotif(it); drawCard(it.id); };
    const retBtn = $('#c-return'); if (retBtn) retBtn.onclick = () => { l.returned = todayISO(); save(db); syncNotif(it); drawCard(it.id); };
  }

  // ── Сканиране ──
  function drawScan() {
    body.innerHTML = `
      <div class="tool-card">
        <p class="hint" style="margin-top:0">${esc(t('lb_scan_hint'))}</p>
        <div class="row"><button class="btn" id="s-cam" style="margin-top:0">📷 ${esc(t('lb_scan_cam'))}</button><button class="btn sec" id="s-stop" style="margin-top:0">${esc(t('lb_scan_stop'))}</button></div>
        <div class="center" id="s-camwrap" style="display:none;margin-top:12px"><video id="s-video" playsinline muted></video></div>
        <button class="btn sec" id="s-file">🖼 ${esc(t('lb_scan_file'))}</button>
        <div style="display:flex;gap:8px;margin-top:12px"><input id="s-code" placeholder="${esc(t('lb_scan_code_ph'))}" style="font-family:ui-monospace,monospace"><button class="btn inline" id="s-open" style="margin:0">${esc(t('lb_scan_open'))}</button></div>
        <div id="s-out" style="margin-top:12px"></div>
      </div>`;
    $('#s-cam').onclick = startCam; $('#s-stop').onclick = stopCam;
    $('#s-open').onclick = () => openCode($('#s-code').value.trim());
    $('#s-code').onkeydown = (e) => { if (e.key === 'Enter') openCode($('#s-code').value.trim()); };
    $('#s-file').onclick = async () => {
      try {
        const f = await pickBinaryFile('image/*'); if (!f || !f.dataUrl) return;
        const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const cx = c.getContext('2d'); cx.drawImage(im, 0, 0); const d = cx.getImageData(0, 0, c.width, c.height); const code = jsQR(d.data, d.width, d.height); if (code) openCode(qrText(code)); else scanMsg(t('lb_scan_notfound'), true); };
        im.src = f.dataUrl;
      } catch (err) { scanMsg(String(err && err.message || err), true); }
    };
  }
  function scanMsg(msg, err) { const o = $('#s-out'); if (o) o.innerHTML = `<div class="readout${err ? ' empty' : ''}">${esc(msg)}</div>`; }
  function openCode(code) {
    if (!code) return; const c = String(code).trim();
    const it = db.items.find((x) => x.code === c || x.code.toLowerCase() === c.toLowerCase());
    if (it) { stopCam(); drawCard(it.id); return; }
    const o = $('#s-out'); if (!o) return;
    o.innerHTML = `<div class="readout empty">${esc(tf('lb_scan_found', c))}<br>${esc(t('lb_scan_unknown'))}</div><button class="btn" id="s-create">＋ ${esc(t('lb_scan_create'))}</button>`;
    $('#s-create').onclick = () => { stopCam(); drawForm(null, c); };
  }
  async function startCam() {
    const v = $('#s-video'); if (!v) return; $('#s-camwrap').style.display = 'block';
    try {
      try { camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
      catch (ePref) { camStream = await navigator.mediaDevices.getUserMedia({ video: true }); } // резерва: коя да е камера
      v.srcObject = camStream; await v.play(); scanLoop();
    } catch (e) { $('#s-camwrap').style.display = 'none'; scanMsg(tf('lb_scan_camerr', e.message || e), true); }
  }
  function stopCam() { if (camRAF) cancelAnimationFrame(camRAF); camRAF = null; if (camStream) { camStream.getTracks().forEach((k) => k.stop()); camStream = null; } const w = $('#s-camwrap'); if (w) w.style.display = 'none'; }
  function scanLoop() {
    const v = $('#s-video'); if (!camStream || !v) return;
    if (v.readyState === v.HAVE_ENOUGH_DATA) {
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const cx = c.getContext('2d'); cx.drawImage(v, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height); const code = jsQR(d.data, d.width, d.height);
      if (code) { openCode(qrText(code)); return; }
    }
    camRAF = requestAnimationFrame(scanLoop);
  }

  // ── Печат на лист с етикети ──
  function drawPrint() {
    let which = 'unprinted';
    body.innerHTML = `
      <div class="tool-card">
        <p class="hint" style="margin-top:0">${esc(t('lb_pr_hint'))}</p>
        <div class="row">
          <div><label>${esc(t('lb_pr_size'))}</label><select id="p-size"><option value="s">${esc(t('lb_pr_s'))}</option><option value="m" selected>${esc(t('lb_pr_m'))}</option><option value="l">${esc(t('lb_pr_l'))}</option></select></div>
          <div><label>${esc(t('lb_pr_page'))}</label><select id="p-page"><option value="A4" selected>A4</option><option value="Letter">Letter</option></select></div>
        </div>
        <label>${esc(t('lb_pr_which'))}</label>
        <select id="p-which"><option value="unprinted" selected>${esc(t('lb_pr_w_unprinted'))}</option><option value="all">${esc(t('lb_f_all'))}</option><option value="sel">${esc(t('lb_pr_w_sel'))}</option></select>
        <div id="p-sel" style="display:none;margin-top:8px"></div>
        <div class="hint" id="p-fits" style="margin-top:10px"></div>
        <div class="hint" style="margin-top:8px;font-weight:600">${esc(t('lb_pr_preview'))}</div>
        <div id="p-prev" style="margin-top:6px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;min-height:60px"></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn sec" id="p-png" style="flex:1;margin-top:0">🖼 ${esc(t('lb_pr_png'))}</button>
          <button class="btn" id="p-pdf" style="flex:1;margin-top:0">📄 ${esc(t('lb_pr_pdf'))}</button>
        </div>
        <div class="status" id="p-status"></div>
      </div>`;
    const selected = () => {
      const all = db.items.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (which === 'all') return all; if (which === 'unprinted') return all.filter((x) => !x.printed);
      return all.filter((x) => printSel[x.id]);
    };
    const drawSel = () => {
      const box = $('#p-sel'); box.style.display = which === 'sel' ? 'block' : 'none';
      if (which !== 'sel') return;
      box.innerHTML = `<div class="hint" style="margin:0 0 4px">${esc(t('lb_pr_sel_hint'))}</div>` + db.items.map((it) => `<label class="check"><input type="checkbox" data-id="${esc(it.id)}"${printSel[it.id] ? ' checked' : ''}> ${esc(it.name)} <span class="hint" style="margin:0">${esc(it.code)}</span></label>`).join('');
      box.querySelectorAll('input[type=checkbox]').forEach((c) => c.onchange = () => { printSel[c.dataset.id] = c.checked; preview(); });
    };
    let busy = false;
    const preview = async () => {
      if (busy) return; busy = true;
      const items = selected(), prev = $('#p-prev'), fits = $('#p-fits');
      try {
        if (!items.length) { prev.innerHTML = `<div class="empty">${esc(t('lb_pr_none'))}</div>`; fits.textContent = ''; return; }
        const r = await renderSheets(items, $('#p-size').value, $('#p-page').value, 96, true); // прегледът е 96 DPI (бърз)
        fits.textContent = tf('lb_pr_fits', r.perSheet, Math.ceil(items.length / r.perSheet), items.length);
        prev.innerHTML = ''; const cv = r.canvases[0]; cv.style.cssText = 'width:100%;display:block'; prev.appendChild(cv);
      } catch (e) { prev.innerHTML = `<div class="empty">${esc(String(e && e.message || e))}</div>`; }
      finally { busy = false; }
    };
    const markPrinted = (items) => { items.forEach((it) => { it.printed = true; }); save(db); const st = $('#p-status'); st.className = 'status show ok'; st.textContent = tf('lb_pr_done', items.length); };
    $('#p-size').onchange = preview; $('#p-page').onchange = preview;
    $('#p-which').onchange = (e) => { which = e.target.value; drawSel(); preview(); };
    $('#p-png').onclick = async () => {
      const items = selected(); if (!items.length) { alert(t('lb_pr_none')); return; }
      const st = $('#p-status'); st.className = 'status show work'; st.textContent = '…';
      try { const r = await renderSheets(items, $('#p-size').value, $('#p-page').value, 300, false); for (let i = 0; i < r.canvases.length; i++) await savePng(r.canvases[i], 'labels-sheet-' + (i + 1) + '.png'); markPrinted(items); }
      catch (e) { st.className = 'status show err'; st.textContent = String(e && e.message || e); }
    };
    $('#p-pdf').onclick = async () => {
      const items = selected(); if (!items.length) { alert(t('lb_pr_none')); return; }
      const st = $('#p-status'); st.className = 'status show work'; st.textContent = '…';
      try { const page = $('#p-page').value; const r = await renderSheets(items, $('#p-size').value, page, 300, false); await savePdf(r.canvases, page, 'labels-' + page + '.pdf'); markPrinted(items); }
      catch (e) { st.className = 'status show err'; st.textContent = String(e && e.message || e); }
    };
    drawSel(); preview();
  }

  // ── Назаем (всички активни заеми + просрочени) ──
  function drawLend() {
    const lent = db.items.filter(activeLend).sort((a, b) => String(activeLend(a).due || '9').localeCompare(String(activeLend(b).due || '9')));
    const past = []; db.items.forEach((it) => (it.lend || []).filter((l) => l.returned).forEach((l) => past.push({ it, l })));
    past.sort((a, b) => String(b.l.returned).localeCompare(String(a.l.returned)));
    body.innerHTML = `
      <h3 style="margin:0 0 8px">${esc(t('lb_lend_active'))}</h3>
      ${lent.length ? lent.map((it) => `<div class="card" data-open="${esc(it.id)}" style="flex-direction:row;align-items:center;gap:12px;padding:12px;margin-bottom:8px">${thumbHTML(it, 48)}<div style="flex:1;min-width:0"><div style="font-weight:700">${esc(it.name)}</div><div style="font-size:.85em">${statusHTML(it)}</div></div></div>`).join('') : `<div class="empty">${esc(t('lb_lend_empty'))}</div>`}
      <h3 style="margin:16px 0 8px">${esc(t('lb_lend_hist'))}</h3>
      ${past.length ? past.slice(0, 50).map(({ it, l }) => `<div class="hint" data-open="${esc(it.id)}" style="cursor:pointer;margin:3px 0">• ${esc(it.name)} — ${esc(l.who)} · ${esc(fmtDate(l.since))} → ${esc(tf('lb_returned_on', fmtDate(l.returned)))}</div>`).join('') : `<div class="hint">${esc(t('lb_lend_none'))}</div>`}`;
    body.querySelectorAll('[data-open]').forEach((el) => el.onclick = () => drawCard(el.dataset.open));
  }

  draw();
}
