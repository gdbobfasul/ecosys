// Version: 1.0028
// reading.js — раздел „📖 Четене" (обогатяване по Huawei 4.3). Три НАПЪЛНО ОФЛАЙН
// инструмента за работа с текст — без мрежа, без AI, без акаунти. Отличават апа от
// обикновените новинарски четци: тук читателят обработва текста, не само го чете.
//   1) Анализ на статия — брой думи/изречения, време за четене, средна дължина на
//      изречение и груба оценка за четимост (лесно/средно/трудно) по прости правила.
//   2) Конструктор на резюме/план — разбива текста на изречения, отмятат се ключовите,
//      сглобява се кратко резюме/план и се копира. Изцяло на устройството.
//   3) Личен речник/глосар — {термин → превод/значение}; търсене, изтриване, копиране/
//      износ. Пази се в localStorage (независимо от състоянието на приложението).
// ПОЛИТИКА: нищо тук не праща мрежови заявки — работи и в самолетен режим.
import { el, clear } from '../ui/dom.js';
import { getLang } from '../core/i18n.js';

// ── Надписи на 15 езика (ФИКС Huawei 3.1: преди бяха само на български → при избран друг
//    език част от съдържанието оставаше непреведена). `S.xxx` резолвва по ТЕКУЩИЯ език чрез
//    Proxy, затова при смяна на език и прерисуване екранът се показва на избрания език. ──
const TR = {
  tab_analyze: { bg:'Анализ', ru:'Анализ', uk:'Аналіз', en:'Analysis', de:'Analyse', fr:'Analyse', es:'Análisis', 'es-MX':'Análisis', it:'Analisi', pt:'Análise', ar:'تحليل', hi:'विश्लेषण', ja:'分析', ky:'Талдоо', 'zh-Hant':'分析' },
  tab_summary: { bg:'Резюме', ru:'Резюме', uk:'Резюме', en:'Summary', de:'Zusammenfassung', fr:'Résumé', es:'Resumen', 'es-MX':'Resumen', it:'Riassunto', pt:'Resumo', ar:'ملخّص', hi:'सारांश', ja:'要約', ky:'Корутунду', 'zh-Hant':'摘要' },
  tab_glossary: { bg:'Речник', ru:'Словарь', uk:'Словник', en:'Glossary', de:'Glossar', fr:'Glossaire', es:'Glosario', 'es-MX':'Glosario', it:'Glossario', pt:'Glossário', ar:'مسرد', hi:'शब्दावली', ja:'用語集', ky:'Сөздүк', 'zh-Hant':'詞彙表' },
  offline_note: { bg:'Всички инструменти тук работят изцяло на устройството — без интернет и без изпращане на данни.', ru:'Все инструменты здесь работают полностью на устройстве — без интернета и без отправки данных.', uk:'Усі інструменти тут працюють повністю на пристрої — без інтернету й без надсилання даних.', en:'All tools here work entirely on your device — no internet and no data sent.', de:'Alle Werkzeuge hier arbeiten vollständig auf dem Gerät — ohne Internet und ohne Datenversand.', fr:'Tous les outils ici fonctionnent entièrement sur l\'appareil — sans internet ni envoi de données.', es:'Todas las herramientas aquí funcionan por completo en el dispositivo — sin internet y sin enviar datos.', 'es-MX':'Todas las herramientas aquí funcionan por completo en el dispositivo — sin internet y sin enviar datos.', it:'Tutti gli strumenti qui funzionano interamente sul dispositivo — senza internet e senza inviare dati.', pt:'Todas as ferramentas aqui funcionam inteiramente no dispositivo — sem internet e sem enviar dados.', ar:'جميع الأدوات هنا تعمل بالكامل على جهازك — بلا إنترنت وبلا إرسال بيانات.', hi:'यहाँ के सभी टूल पूरी तरह आपके डिवाइस पर काम करते हैं — न इंटरनेट, न डेटा भेजा जाता है।', ja:'ここのツールはすべて端末内だけで動作します — インターネット不要、データ送信なし。', ky:'Бул жердеги бардык куралдар толугу менен түзмөктө иштейт — интернетсиз жана маалымат жөнөтүүсүз.', 'zh-Hant':'這裡的所有工具完全在你的裝置上運作 — 無需網路，也不傳送資料。' },
  paste_ph: { bg:'Поставете или напишете текста тук…', ru:'Вставьте или введите текст здесь…', uk:'Вставте або введіть текст тут…', en:'Paste or type the text here…', de:'Text hier einfügen oder eingeben…', fr:'Collez ou saisissez le texte ici…', es:'Pega o escribe el texto aquí…', 'es-MX':'Pega o escribe el texto aquí…', it:'Incolla o scrivi il testo qui…', pt:'Cole ou digite o texto aqui…', ar:'الصق النص أو اكتبه هنا…', hi:'यहाँ टेक्स्ट पेस्ट करें या लिखें…', ja:'ここにテキストを貼り付けるか入力してください…', ky:'Текстти бул жерге коюңуз же жазыңыз…', 'zh-Hant':'在此貼上或輸入文字…' },
  analyze_note: { bg:'Поставете текст на статия, за да видите бърза статистика и груба оценка за четимост.', ru:'Вставьте текст статьи, чтобы увидеть быструю статистику и примерную оценку читабельности.', uk:'Вставте текст статті, щоб побачити швидку статистику й приблизну оцінку читабельності.', en:'Paste an article\'s text to see quick stats and a rough readability estimate.', de:'Füge den Artikeltext ein, um Schnellstatistiken und eine grobe Lesbarkeitsschätzung zu sehen.', fr:'Collez le texte d\'un article pour voir des statistiques rapides et une estimation approximative de lisibilité.', es:'Pega el texto de un artículo para ver estadísticas rápidas y una estimación aproximada de legibilidad.', 'es-MX':'Pega el texto de un artículo para ver estadísticas rápidas y una estimación aproximada de legibilidad.', it:'Incolla il testo di un articolo per vedere statistiche rapide e una stima approssimativa di leggibilità.', pt:'Cole o texto de um artigo para ver estatísticas rápidas e uma estimativa aproximada de legibilidade.', ar:'الصق نص مقال لرؤية إحصاءات سريعة وتقدير تقريبي لسهولة القراءة.', hi:'त्वरित आँकड़े और अनुमानित पठनीयता देखने के लिए किसी लेख का टेक्स्ट पेस्ट करें।', ja:'記事のテキストを貼り付けると、簡易統計とおおよその読みやすさが表示されます。', ky:'Тез статистика жана болжолдуу окулуу баасын көрүү үчүн макаланын текстин коюңуз.', 'zh-Hant':'貼上文章內容即可看到快速統計與粗略的可讀性評估。' },
  analyze_btn: { bg:'Анализирай', ru:'Анализировать', uk:'Аналізувати', en:'Analyze', de:'Analysieren', fr:'Analyser', es:'Analizar', 'es-MX':'Analizar', it:'Analizza', pt:'Analisar', ar:'حلّل', hi:'विश्लेषण करें', ja:'分析', ky:'Талдоо', 'zh-Hant':'分析' },
  clear_btn: { bg:'Изчисти', ru:'Очистить', uk:'Очистити', en:'Clear', de:'Löschen', fr:'Effacer', es:'Borrar', 'es-MX':'Borrar', it:'Cancella', pt:'Limpar', ar:'مسح', hi:'साफ़ करें', ja:'クリア', ky:'Тазалоо', 'zh-Hant':'清除' },
  words: { bg:'Думи', ru:'Слова', uk:'Слова', en:'Words', de:'Wörter', fr:'Mots', es:'Palabras', 'es-MX':'Palabras', it:'Parole', pt:'Palavras', ar:'كلمات', hi:'शब्द', ja:'単語', ky:'Сөздөр', 'zh-Hant':'字數' },
  sentences: { bg:'Изречения', ru:'Предложения', uk:'Речення', en:'Sentences', de:'Sätze', fr:'Phrases', es:'Oraciones', 'es-MX':'Oraciones', it:'Frasi', pt:'Frases', ar:'جُمل', hi:'वाक्य', ja:'文', ky:'Сүйлөмдөр', 'zh-Hant':'句子' },
  chars: { bg:'Знаци', ru:'Символы', uk:'Символи', en:'Characters', de:'Zeichen', fr:'Caractères', es:'Caracteres', 'es-MX':'Caracteres', it:'Caratteri', pt:'Caracteres', ar:'أحرف', hi:'अक्षर', ja:'文字', ky:'Белгилер', 'zh-Hant':'字元' },
  read_time: { bg:'Време за четене', ru:'Время чтения', uk:'Час читання', en:'Reading time', de:'Lesezeit', fr:'Temps de lecture', es:'Tiempo de lectura', 'es-MX':'Tiempo de lectura', it:'Tempo di lettura', pt:'Tempo de leitura', ar:'زمن القراءة', hi:'पढ़ने का समय', ja:'読む時間', ky:'Окуу убактысы', 'zh-Hant':'閱讀時間' },
  avg_sentence: { bg:'Средна дължина на изречение', ru:'Средняя длина предложения', uk:'Середня довжина речення', en:'Average sentence length', de:'Durchschnittliche Satzlänge', fr:'Longueur moyenne de phrase', es:'Longitud media de oración', 'es-MX':'Longitud media de oración', it:'Lunghezza media della frase', pt:'Comprimento médio da frase', ar:'متوسط طول الجملة', hi:'औसत वाक्य लंबाई', ja:'平均文長', ky:'Орточо сүйлөм узундугу', 'zh-Hant':'平均句長' },
  avg_word: { bg:'Средна дължина на дума', ru:'Средняя длина слова', uk:'Середня довжина слова', en:'Average word length', de:'Durchschnittliche Wortlänge', fr:'Longueur moyenne de mot', es:'Longitud media de palabra', 'es-MX':'Longitud media de palabra', it:'Lunghezza media della parola', pt:'Comprimento médio da palavra', ar:'متوسط طول الكلمة', hi:'औसत शब्द लंबाई', ja:'平均語長', ky:'Орточо сөз узундугу', 'zh-Hant':'平均詞長' },
  readability: { bg:'Четимост', ru:'Читабельность', uk:'Читабельність', en:'Readability', de:'Lesbarkeit', fr:'Lisibilité', es:'Legibilidad', 'es-MX':'Legibilidad', it:'Leggibilità', pt:'Legibilidade', ar:'سهولة القراءة', hi:'पठनीयता', ja:'読みやすさ', ky:'Окулуу', 'zh-Hant':'可讀性' },
  read_easy: { bg:'лесно', ru:'легко', uk:'легко', en:'easy', de:'leicht', fr:'facile', es:'fácil', 'es-MX':'fácil', it:'facile', pt:'fácil', ar:'سهل', hi:'आसान', ja:'やさしい', ky:'оңой', 'zh-Hant':'容易' },
  read_medium: { bg:'средно', ru:'средне', uk:'середньо', en:'medium', de:'mittel', fr:'moyen', es:'medio', 'es-MX':'medio', it:'medio', pt:'médio', ar:'متوسط', hi:'मध्यम', ja:'ふつう', ky:'орточо', 'zh-Hant':'中等' },
  read_hard: { bg:'трудно', ru:'трудно', uk:'важко', en:'hard', de:'schwer', fr:'difficile', es:'difícil', 'es-MX':'difícil', it:'difficile', pt:'difícil', ar:'صعب', hi:'कठिन', ja:'むずかしい', ky:'татаал', 'zh-Hant':'困難' },
  min_short: { bg:'мин', ru:'мин', uk:'хв', en:'min', de:'Min', fr:'min', es:'min', 'es-MX':'min', it:'min', pt:'min', ar:'د', hi:'मिनट', ja:'分', ky:'мүн', 'zh-Hant':'分鐘' },
  under_min: { bg:'под 1 мин', ru:'менее 1 мин', uk:'менше 1 хв', en:'under 1 min', de:'unter 1 Min', fr:'moins d\'1 min', es:'menos de 1 min', 'es-MX':'menos de 1 min', it:'meno di 1 min', pt:'menos de 1 min', ar:'أقل من دقيقة', hi:'1 मिनट से कम', ja:'1分未満', ky:'1 мүнөттөн аз', 'zh-Hant':'不到 1 分鐘' },
  words_unit: { bg:'думи', ru:'слов', uk:'слів', en:'words', de:'Wörter', fr:'mots', es:'palabras', 'es-MX':'palabras', it:'parole', pt:'palavras', ar:'كلمة', hi:'शब्द', ja:'語', ky:'сөз', 'zh-Hant':'字' },
  chars_unit: { bg:'знака', ru:'символов', uk:'символів', en:'chars', de:'Zeichen', fr:'caractères', es:'caracteres', 'es-MX':'caracteres', it:'caratteri', pt:'caracteres', ar:'حرف', hi:'अक्षर', ja:'文字', ky:'белги', 'zh-Hant':'字元' },
  empty_text: { bg:'Няма текст за анализ.', ru:'Нет текста для анализа.', uk:'Немає тексту для аналізу.', en:'No text to analyze.', de:'Kein Text zum Analysieren.', fr:'Aucun texte à analyser.', es:'No hay texto para analizar.', 'es-MX':'No hay texto para analizar.', it:'Nessun testo da analizzare.', pt:'Nenhum texto para analisar.', ar:'لا يوجد نص للتحليل.', hi:'विश्लेषण के लिए कोई टेक्स्ट नहीं।', ja:'分析するテキストがありません。', ky:'Талдоо үчүн текст жок.', 'zh-Hant':'沒有可分析的文字。' },
  summary_note: { bg:'Отметнете ключовите изречения — от тях се сглобява кратко резюме/план, което можете да копирате.', ru:'Отметьте ключевые предложения — из них собирается краткое резюме/план, который можно скопировать.', uk:'Позначте ключові речення — з них збирається короткий підсумок/план, який можна скопіювати.', en:'Check the key sentences — a short summary/outline is built from them, which you can copy.', de:'Markiere die wichtigsten Sätze — daraus wird eine kurze Zusammenfassung/Gliederung erstellt, die du kopieren kannst.', fr:'Cochez les phrases clés — un court résumé/plan en est construit, que vous pouvez copier.', es:'Marca las oraciones clave — con ellas se construye un breve resumen/esquema que puedes copiar.', 'es-MX':'Marca las oraciones clave — con ellas se construye un breve resumen/esquema que puedes copiar.', it:'Seleziona le frasi chiave — da esse si costruisce un breve riassunto/schema che puoi copiare.', pt:'Marque as frases-chave — delas é montado um breve resumo/esquema que você pode copiar.', ar:'حدّد الجُمل الأساسية — يُبنى منها ملخّص/مخطّط قصير يمكنك نسخه.', hi:'मुख्य वाक्य चुनें — उनसे एक छोटा सारांश/रूपरेखा बनती है, जिसे आप कॉपी कर सकते हैं।', ja:'重要な文にチェックを入れると、それらから短い要約／アウトラインが作られ、コピーできます。', ky:'Негизги сүйлөмдөрдү белгилеңиз — алардан көчүрө ала турган кыска корутунду/план түзүлөт.', 'zh-Hant':'勾選關鍵句子 — 系統會據此組成可複製的簡短摘要／大綱。' },
  split_btn: { bg:'Раздели на изречения', ru:'Разбить на предложения', uk:'Розбити на речення', en:'Split into sentences', de:'In Sätze aufteilen', fr:'Découper en phrases', es:'Dividir en oraciones', 'es-MX':'Dividir en oraciones', it:'Dividi in frasi', pt:'Dividir em frases', ar:'التقسيم إلى جُمل', hi:'वाक्यों में बाँटें', ja:'文に分割', ky:'Сүйлөмдөргө бөлүү', 'zh-Hant':'拆分成句子' },
  build_hint: { bg:'Изберете изреченията, които да влязат в резюмето.', ru:'Выберите предложения, которые войдут в резюме.', uk:'Виберіть речення, які увійдуть до підсумку.', en:'Select the sentences to include in the summary.', de:'Wähle die Sätze aus, die in die Zusammenfassung aufgenommen werden sollen.', fr:'Sélectionnez les phrases à inclure dans le résumé.', es:'Selecciona las oraciones que se incluirán en el resumen.', 'es-MX':'Selecciona las oraciones que se incluirán en el resumen.', it:'Seleziona le frasi da includere nel riassunto.', pt:'Selecione as frases a incluir no resumo.', ar:'اختر الجُمل التي ستُدرَج في الملخّص.', hi:'सारांश में शामिल करने के लिए वाक्य चुनें।', ja:'要約に含める文を選択してください。', ky:'Корутундуга кире турган сүйлөмдөрдү тандаңыз.', 'zh-Hant':'選擇要納入摘要的句子。' },
  no_sentences: { bg:'Не бяха намерени изречения.', ru:'Предложения не найдены.', uk:'Речень не знайдено.', en:'No sentences found.', de:'Keine Sätze gefunden.', fr:'Aucune phrase trouvée.', es:'No se encontraron oraciones.', 'es-MX':'No se encontraron oraciones.', it:'Nessuna frase trovata.', pt:'Nenhuma frase encontrada.', ar:'لم يُعثر على جُمل.', hi:'कोई वाक्य नहीं मिला।', ja:'文が見つかりませんでした。', ky:'Сүйлөмдөр табылган жок.', 'zh-Hant':'找不到句子。' },
  selected: { bg:'Избрани', ru:'Выбрано', uk:'Вибрано', en:'Selected', de:'Ausgewählt', fr:'Sélectionnées', es:'Seleccionadas', 'es-MX':'Seleccionadas', it:'Selezionate', pt:'Selecionadas', ar:'المحدّد', hi:'चयनित', ja:'選択済み', ky:'Тандалды', 'zh-Hant':'已選' },
  result: { bg:'Резюме / план', ru:'Резюме / план', uk:'Підсумок / план', en:'Summary / outline', de:'Zusammenfassung / Gliederung', fr:'Résumé / plan', es:'Resumen / esquema', 'es-MX':'Resumen / esquema', it:'Riassunto / schema', pt:'Resumo / esquema', ar:'ملخّص / مخطّط', hi:'सारांश / रूपरेखा', ja:'要約／アウトライン', ky:'Корутунду / план', 'zh-Hant':'摘要／大綱' },
  copy_btn: { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
  copied: { bg:'Копирано!', ru:'Скопировано!', uk:'Скопійовано!', en:'Copied!', de:'Kopiert!', fr:'Copié !', es:'¡Copiado!', 'es-MX':'¡Copiado!', it:'Copiato!', pt:'Copiado!', ar:'تم النسخ!', hi:'कॉपी हो गया!', ja:'コピーしました！', ky:'Көчүрүлдү!', 'zh-Hant':'已複製！' },
  select_some: { bg:'Отметнете поне едно изречение.', ru:'Отметьте хотя бы одно предложение.', uk:'Позначте хоча б одне речення.', en:'Select at least one sentence.', de:'Wähle mindestens einen Satz aus.', fr:'Sélectionnez au moins une phrase.', es:'Selecciona al menos una oración.', 'es-MX':'Selecciona al menos una oración.', it:'Seleziona almeno una frase.', pt:'Selecione pelo menos uma frase.', ar:'حدّد جملة واحدة على الأقل.', hi:'कम से कम एक वाक्य चुनें।', ja:'少なくとも 1 文を選択してください。', ky:'Жок дегенде бир сүйлөм тандаңыз.', 'zh-Hant':'至少選擇一個句子。' },
  glossary_note: { bg:'Личен речник от термини и техните значения/преводи. Пази се само на това устройство.', ru:'Личный словарь терминов и их значений/переводов. Хранится только на этом устройстве.', uk:'Особистий словник термінів та їх значень/перекладів. Зберігається лише на цьому пристрої.', en:'A personal glossary of terms and their meanings/translations. Stored only on this device.', de:'Ein persönliches Glossar von Begriffen und ihren Bedeutungen/Übersetzungen. Nur auf diesem Gerät gespeichert.', fr:'Un glossaire personnel de termes et de leurs significations/traductions. Stocké uniquement sur cet appareil.', es:'Un glosario personal de términos y sus significados/traducciones. Se guarda solo en este dispositivo.', 'es-MX':'Un glosario personal de términos y sus significados/traducciones. Se guarda solo en este dispositivo.', it:'Un glossario personale di termini e dei loro significati/traduzioni. Memorizzato solo su questo dispositivo.', pt:'Um glossário pessoal de termos e seus significados/traduções. Guardado apenas neste dispositivo.', ar:'مسرد شخصي للمصطلحات ومعانيها/ترجماتها. يُحفظ على هذا الجهاز فقط.', hi:'शब्दों और उनके अर्थ/अनुवाद की निजी शब्दावली। केवल इसी डिवाइस पर सहेजी जाती है।', ja:'用語とその意味・訳の個人用語集。この端末にのみ保存されます。', ky:'Терминдердин жана алардын маанилеринин/котормолорунун жеке сөздүгү. Бул түзмөктө гана сакталат.', 'zh-Hant':'個人術語與其意義／翻譯的詞彙表。僅儲存在此裝置上。' },
  term_ph: { bg:'термин', ru:'термин', uk:'термін', en:'term', de:'Begriff', fr:'terme', es:'término', 'es-MX':'término', it:'termine', pt:'termo', ar:'مصطلح', hi:'शब्द', ja:'用語', ky:'термин', 'zh-Hant':'術語' },
  meaning_ph: { bg:'превод / значение', ru:'перевод / значение', uk:'переклад / значення', en:'translation / meaning', de:'Übersetzung / Bedeutung', fr:'traduction / signification', es:'traducción / significado', 'es-MX':'traducción / significado', it:'traduzione / significato', pt:'tradução / significado', ar:'ترجمة / معنى', hi:'अनुवाद / अर्थ', ja:'訳／意味', ky:'котормо / мааниси', 'zh-Hant':'翻譯／意義' },
  add_btn: { bg:'Добави', ru:'Добавить', uk:'Додати', en:'Add', de:'Hinzufügen', fr:'Ajouter', es:'Añadir', 'es-MX':'Agregar', it:'Aggiungi', pt:'Adicionar', ar:'إضافة', hi:'जोड़ें', ja:'追加', ky:'Кошуу', 'zh-Hant':'新增' },
  search_ph: { bg:'търсене в речника…', ru:'поиск в словаре…', uk:'пошук у словнику…', en:'search the glossary…', de:'im Glossar suchen…', fr:'rechercher dans le glossaire…', es:'buscar en el glosario…', 'es-MX':'buscar en el glosario…', it:'cerca nel glossario…', pt:'pesquisar no glossário…', ar:'ابحث في المسرد…', hi:'शब्दावली में खोजें…', ja:'用語集を検索…', ky:'сөздүктөн издөө…', 'zh-Hant':'搜尋詞彙表…' },
  empty_glossary: { bg:'Речникът е празен. Добавете първия термин.', ru:'Словарь пуст. Добавьте первый термин.', uk:'Словник порожній. Додайте перший термін.', en:'The glossary is empty. Add the first term.', de:'Das Glossar ist leer. Füge den ersten Begriff hinzu.', fr:'Le glossaire est vide. Ajoutez le premier terme.', es:'El glosario está vacío. Añade el primer término.', 'es-MX':'El glosario está vacío. Agrega el primer término.', it:'Il glossario è vuoto. Aggiungi il primo termine.', pt:'O glossário está vazio. Adicione o primeiro termo.', ar:'المسرد فارغ. أضِف المصطلح الأول.', hi:'शब्दावली खाली है। पहला शब्द जोड़ें।', ja:'用語集は空です。最初の用語を追加してください。', ky:'Сөздүк бош. Биринчи терминди кошуңуз.', 'zh-Hant':'詞彙表是空的。新增第一個術語。' },
  no_match: { bg:'Няма съвпадения.', ru:'Совпадений нет.', uk:'Збігів немає.', en:'No matches.', de:'Keine Treffer.', fr:'Aucune correspondance.', es:'Sin coincidencias.', 'es-MX':'Sin coincidencias.', it:'Nessuna corrispondenza.', pt:'Sem correspondências.', ar:'لا توجد نتائج.', hi:'कोई मिलान नहीं।', ja:'一致なし。', ky:'Дал келүүлөр жок.', 'zh-Hant':'沒有相符項目。' },
  delete_title: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Excluir', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  export_btn: { bg:'Копирай/износ на речника', ru:'Копировать/экспорт словаря', uk:'Копіювати/експорт словника', en:'Copy/export the glossary', de:'Glossar kopieren/exportieren', fr:'Copier/exporter le glossaire', es:'Copiar/exportar el glosario', 'es-MX':'Copiar/exportar el glosario', it:'Copia/esporta il glossario', pt:'Copiar/exportar o glossário', ar:'نسخ/تصدير المسرد', hi:'शब्दावली कॉपी/निर्यात करें', ja:'用語集をコピー／エクスポート', ky:'Сөздүктү көчүрүү/экспорттоо', 'zh-Hant':'複製／匯出詞彙表' },
  need_both: { bg:'Попълнете и термин, и значение.', ru:'Заполните и термин, и значение.', uk:'Заповніть і термін, і значення.', en:'Fill in both the term and its meaning.', de:'Fülle sowohl den Begriff als auch die Bedeutung aus.', fr:'Renseignez le terme et sa signification.', es:'Rellena tanto el término como su significado.', 'es-MX':'Llena tanto el término como su significado.', it:'Compila sia il termine sia il significato.', pt:'Preencha o termo e o significado.', ar:'املأ المصطلح ومعناه معًا.', hi:'शब्द और उसका अर्थ दोनों भरें।', ja:'用語と意味の両方を入力してください。', ky:'Терминди да, маанисин да толтуруңуз.', 'zh-Hant':'請同時填寫術語與其意義。' }
};
// `S.xxx` → стойността за текущия език (fallback en→bg). Резолвва се при всяко четене,
// затова след смяна на език и прерисуване екранът е на избрания език.
const S = new Proxy({}, { get(_t, k) { const e = TR[k]; if (!e) return (typeof k === 'string' ? k : ''); let l; try { l = getLang(); } catch (_) { l = 'bg'; } return e[l] || e.en || e.bg; } });

// ── Помощни ──
// Разделяне на изречения (по препинателни знаци и нови редове). Изцяло офлайн.
function splitSentences(text) {
  const parts = String(text || '')
    .replace(/\s+/g, ' ')
    .match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}
function countWords(text) {
  const m = String(text || '').trim().match(/\S+/g);
  return m ? m.length : 0;
}
function copyText(str) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).catch(() => fallbackCopy(str));
      return true;
    }
  } catch (_) {}
  return fallbackCopy(str);
}
function fallbackCopy(str) {
  try {
    const ta = document.createElement('textarea');
    ta.value = str; ta.setAttribute('readonly', '');
    ta.style.position = 'absolute'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (_) { return false; }
}
function flash(btn, label) {
  const old = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { try { btn.textContent = old; } catch (_) {} }, 1400);
}

// ── Личен речник (localStorage, независимо от app state) ──
const GKEY = 'newslator.glossary.v1';
function loadGlossary() {
  try {
    const raw = localStorage.getItem(GKEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function saveGlossary(arr) {
  try { localStorage.setItem(GKEY, JSON.stringify(arr)); } catch (_) {}
}

// ── ЕКРАН ──
let active = 'analyze';
export function renderReading(root, app, nav) {
  clear(root);
  const tabs = ['analyze', 'summary', 'glossary'];
  const bar = el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;margin-bottom:8px' });
  const body = el('div', {});

  function drawBar() {
    clear(bar);
    tabs.forEach((k) => bar.appendChild(el('button', {
      class: 'btn sm' + (active === k ? '' : ' secondary'),
      style: 'white-space:nowrap',
      onclick: () => { active = k; drawBar(); draw(); }
    }, S['tab_' + k])));
  }
  function draw() {
    clear(body);
    body.appendChild(el('p', { class: 'muted', style: 'font-size:12px;margin:0 0 8px' }, S.offline_note));
    if (active === 'analyze') drawAnalyze();
    else if (active === 'summary') drawSummary();
    else drawGlossary();
  }

  // 1) Анализ на статия
  function drawAnalyze() {
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, S.analyze_note));
    const ta = el('textarea', {
      class: 'search',
      placeholder: S.paste_ph,
      style: 'min-height:130px;resize:vertical;line-height:1.4'
    });
    const out = el('div', {});
    body.appendChild(ta);
    body.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-bottom:10px' }, [
      el('button', { class: 'btn sm', onclick: () => run() }, S.analyze_btn),
      el('button', { class: 'btn sm secondary', onclick: () => { ta.value = ''; clear(out); } }, S.clear_btn)
    ]));
    body.appendChild(out);

    function stat(label, value) {
      return el('div', { class: 'row', style: 'justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px' }, [
        el('span', { class: 'muted' }, label),
        el('b', {}, value)
      ]);
    }
    function run() {
      clear(out);
      const text = ta.value || '';
      const words = countWords(text);
      if (!words) { out.appendChild(el('p', { class: 'muted' }, S.empty_text)); return; }
      const sentences = splitSentences(text);
      const nSent = sentences.length || 1;
      const chars = text.replace(/\s/g, '').length;
      const letters = (text.match(/[^\s\d.,!?…;:()"'«»\-–—]/g) || []).length;
      const avgSent = words / nSent;                 // думи на изречение
      const avgWord = letters / words;               // букви на дума
      const minutes = words / 200;                   // ~200 думи/мин
      const readTime = minutes < 1 ? S.under_min : (Math.round(minutes) + ' ' + S.min_short);

      // Груба оценка за четимост по прости правила (по-дълги изречения/думи = по-трудно).
      let read = S.read_medium;
      if (avgSent <= 14 && avgWord <= 5.5) read = S.read_easy;
      else if (avgSent >= 22 || avgWord >= 7) read = S.read_hard;
      const badge = read === S.read_easy ? 'official' : (read === S.read_hard ? 'unofficial' : 'tr');

      const card = el('div', { class: 'card' });
      card.appendChild(stat(S.words, String(words) + ' ' + S.words_unit));
      card.appendChild(stat(S.sentences, String(sentences.length)));
      card.appendChild(stat(S.chars, String(chars) + ' ' + S.chars_unit));
      card.appendChild(stat(S.read_time, readTime));
      card.appendChild(stat(S.avg_sentence, avgSent.toFixed(1) + ' ' + S.words_unit));
      card.appendChild(stat(S.avg_word, avgWord.toFixed(1) + ' ' + S.chars_unit));
      card.appendChild(el('div', { class: 'row', style: 'justify-content:space-between;padding:9px 0 2px;font-size:14px' }, [
        el('span', { class: 'muted' }, S.readability),
        el('span', { class: 'badge ' + badge, style: 'font-size:13px' }, read)
      ]));
      out.appendChild(card);
    }
  }

  // 2) Конструктор на резюме/план
  function drawSummary() {
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, S.summary_note));
    const ta = el('textarea', {
      class: 'search',
      placeholder: S.paste_ph,
      style: 'min-height:120px;resize:vertical;line-height:1.4'
    });
    const list = el('div', {});
    const result = el('div', {});
    body.appendChild(ta);
    body.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-bottom:10px' }, [
      el('button', { class: 'btn sm', onclick: () => split() }, S.split_btn),
      el('button', { class: 'btn sm secondary', onclick: () => { ta.value = ''; clear(list); clear(result); } }, S.clear_btn)
    ]));
    body.appendChild(list);
    body.appendChild(result);

    const chosen = new Set();
    let sents = [];
    function split() {
      clear(list); clear(result); chosen.clear();
      sents = splitSentences(ta.value || '');
      if (!sents.length) { list.appendChild(el('p', { class: 'muted' }, S.no_sentences)); return; }
      list.appendChild(el('p', { class: 'muted', style: 'font-size:12px;margin:0 0 6px' }, S.build_hint));
      sents.forEach((s, i) => {
        const cb = el('input', { type: 'checkbox', style: 'margin-top:3px;flex:none;width:18px;height:18px' });
        cb.addEventListener('change', () => { if (cb.checked) chosen.add(i); else chosen.delete(i); build(); });
        list.appendChild(el('label', {
          class: 'card',
          style: 'display:flex;gap:10px;align-items:flex-start;padding:10px;margin-bottom:8px;cursor:pointer;font-size:14px;line-height:1.35'
        }, [cb, el('span', {}, s)]));
      });
    }
    function build() {
      clear(result);
      if (!chosen.size) return;
      const picked = sents.filter((_, i) => chosen.has(i));
      const text = picked.map((s) => '• ' + s).join('\n');
      const area = el('textarea', {
        class: 'search',
        readonly: 'readonly',
        style: 'min-height:110px;resize:vertical;line-height:1.4;margin-top:6px'
      });
      area.value = text;
      const copyBtn = el('button', { class: 'btn sm', onclick: () => { copyText(text); flash(copyBtn, S.copied); } }, S.copy_btn);
      result.appendChild(el('div', { class: 'row', style: 'justify-content:space-between;margin:4px 0' }, [
        el('h3', { style: 'margin:0' }, S.result),
        el('span', { class: 'badge tr' }, S.selected + ': ' + chosen.size)
      ]));
      result.appendChild(area);
      result.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [copyBtn]));
    }
  }

  // 3) Личен речник/глосар
  function drawGlossary() {
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, S.glossary_note));
    const term = el('input', { class: 'search', type: 'text', placeholder: S.term_ph, style: 'flex:1;min-width:0;margin-bottom:0' });
    const mean = el('input', { class: 'search', type: 'text', placeholder: S.meaning_ph, style: 'flex:1;min-width:0;margin-bottom:0' });
    const search = el('input', { class: 'search', type: 'text', placeholder: S.search_ph, style: 'margin-bottom:8px' });
    const out = el('div', {});

    const add = () => {
      const t = term.value.trim(); const m = mean.value.trim();
      if (!t || !m) { flash(addBtn, S.need_both); return; }
      const arr = loadGlossary();
      arr.unshift({ t, m, at: Date.now() });
      saveGlossary(arr);
      term.value = ''; mean.value = '';
      term.focus();
      list();
    };
    const addBtn = el('button', { class: 'btn sm', onclick: add }, S.add_btn);
    mean.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    search.addEventListener('input', () => list());

    body.appendChild(el('div', { class: 'row', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap' }, [term, mean, addBtn]));
    body.appendChild(search);
    body.appendChild(out);

    function list() {
      clear(out);
      const all = loadGlossary();
      if (!all.length) { out.appendChild(el('p', { class: 'muted' }, S.empty_glossary)); return; }
      const q = search.value.trim().toLowerCase();
      const rows = q
        ? all.filter((e) => (e.t + ' ' + e.m).toLowerCase().indexOf(q) >= 0)
        : all;
      const expBtn = el('button', { class: 'btn sm secondary', style: 'margin-bottom:8px', onclick: () => { copyText(all.map((e) => e.t + ' — ' + e.m).join('\n')); flash(expBtn, S.copied); } }, S.export_btn);
      out.appendChild(expBtn);
      if (!rows.length) { out.appendChild(el('p', { class: 'muted' }, S.no_match)); return; }
      rows.forEach((e) => {
        const del = el('button', {
          class: 'icon-btn', title: S.delete_title, style: 'flex:none;padding:6px 9px',
          onclick: () => {
            const arr = loadGlossary().filter((x) => !(x.t === e.t && x.m === e.m && x.at === e.at));
            saveGlossary(arr); list();
          }
        }, '🗑');
        out.appendChild(el('div', { class: 'card', style: 'padding:11px;margin-bottom:8px' }, [
          el('div', { class: 'row', style: 'gap:10px;align-items:flex-start' }, [
            el('div', { style: 'flex:1;min-width:0' }, [
              el('div', { style: 'font-weight:600;font-size:15px' }, e.t),
              el('div', { class: 'muted', style: 'font-size:14px;margin-top:2px' }, e.m)
            ]),
            del
          ])
        ]));
      });
    }
    list();
  }

  root.appendChild(bar);
  root.appendChild(body);
  drawBar();
  draw();
}
