// Version: 1.0003
// Web скрапер — ФРОНТЕНД към бекенда `private/scraper-bot` (истинската мощ).
// Трите варианта: 1) търсене (14 търсачки) 2) какво събираме (контакти/съдържание/линкове,
// с филтри за точност/тематика и ~30 типа) 3) обработка (на екрана / CSV / имейл до себе си /
// уточняване = многостепенно търсене). Телефонните заявки минават през CapacitorHttp (без CORS).
//
// Бекендът се задава от потребителя (URL + по избор токен) и се пази ЛОКАЛНО. Ако не е зададен
// или е недостъпен — честно съобщение, без да чупи.
import { t, tf, register, getLang } from '../core/i18n.js';

register({
  scr_title: { bg:'Web скрапер', ru:'Веб-скрапер', uk:'Веб-скрапер', en:'Web scraper', de:'Web-Scraper', fr:'Scraper web', es:'Web scraper', 'es-MX':'Web scraper', it:'Web scraper', pt:'Web scraper', ar:'كاشط ويب', hi:'वेब स्क्रैपर', ja:'ウェブスクレイパー', ky:'Веб скрапер', 'zh-Hant':'網頁擷取器' },
  scr_backend: { bg:'Адрес на услугата (бекенд)', ru:'Адрес сервиса (бэкенд)', uk:'Адреса сервісу (бекенд)', en:'Service (backend) URL', de:'Dienst-URL (Backend)', fr:'URL du service (backend)', es:'URL del servicio (backend)', 'es-MX':'URL del servicio (backend)', it:'URL del servizio (backend)', pt:'URL do serviço (backend)', ar:'عنوان الخدمة (الخلفية)', hi:'सेवा (बैकएंड) URL', ja:'サービス(バックエンド)URL', ky:'Кызматтын дареги (бекенд)', 'zh-Hant':'服務(後端)網址' },
  scr_backend_ph: { bg:'напр. https://pupikes.com/api/scraper', ru:'напр. https://pupikes.com/api/scraper', uk:'напр. https://pupikes.com/api/scraper', en:'e.g. https://pupikes.com/api/scraper', de:'z. B. https://pupikes.com/api/scraper', fr:'ex. https://pupikes.com/api/scraper', es:'p. ej. https://pupikes.com/api/scraper', 'es-MX':'p. ej. https://pupikes.com/api/scraper', it:'es. https://pupikes.com/api/scraper', pt:'ex. https://pupikes.com/api/scraper', ar:'مثال https://pupikes.com/api/scraper', hi:'उदा. https://pupikes.com/api/scraper', ja:'例 https://pupikes.com/api/scraper', ky:'мис. https://pupikes.com/api/scraper', 'zh-Hant':'例如 https://pupikes.com/api/scraper' },
  scr_token: { bg:'Токен (по избор)', ru:'Токен (необязательно)', uk:'Токен (необовʼязково)', en:'Token (optional)', de:'Token (optional)', fr:'Jeton (facultatif)', es:'Token (opcional)', 'es-MX':'Token (opcional)', it:'Token (facoltativo)', pt:'Token (opcional)', ar:'الرمز (اختياري)', hi:'टोकन (वैकल्पिक)', ja:'トークン(任意)', ky:'Токен (милдеттүү эмес)', 'zh-Hant':'權杖(選填)' },
  scr_save_cfg: { bg:'Запази', ru:'Сохранить', uk:'Зберегти', en:'Save', de:'Speichern', fr:'Enregistrer', es:'Guardar', 'es-MX':'Guardar', it:'Salva', pt:'Salvar', ar:'حفظ', hi:'सहेजें', ja:'保存', ky:'Сактоо', 'zh-Hant':'儲存' },
  scr_settings: { bg:'⚙️ Настройки на услугата', ru:'⚙️ Настройки сервиса', uk:'⚙️ Налаштування сервісу', en:'⚙️ Service settings', de:'⚙️ Dienst-Einstellungen', fr:'⚙️ Paramètres du service', es:'⚙️ Ajustes del servicio', 'es-MX':'⚙️ Configuración del servicio', it:'⚙️ Impostazioni del servizio', pt:'⚙️ Configurações do serviço', ar:'⚙️ إعدادات الخدمة', hi:'⚙️ सेवा सेटिंग्स', ja:'⚙️ サービス設定', ky:'⚙️ Кызмат жөндөөлөрү', 'zh-Hant':'⚙️ 服務設定' },
  scr_kw_label: { bg:'Какво търсим', ru:'Что ищем', uk:'Що шукаємо', en:'What to search', de:'Suchbegriff', fr:'Que chercher', es:'Qué buscar', 'es-MX':'Qué buscar', it:'Cosa cercare', pt:'O que buscar', ar:'ماذا نبحث', hi:'क्या खोजें', ja:'検索語', ky:'Эмне издейбиз', 'zh-Hant':'搜尋內容' },
  scr_kw_ph: { bg:'напр. адвокат София / български рецепти майонеза', ru:'напр. адвокат Москва / рецепты', uk:'напр. адвокат Київ / рецепти', en:'e.g. lawyer London / recipes', de:'z. B. Anwalt Berlin / Rezepte', fr:'ex. avocat Paris / recettes', es:'p. ej. abogado Madrid / recetas', 'es-MX':'p. ej. abogado CDMX / recetas', it:'es. avvocato Roma / ricette', pt:'ex. advogado Lisboa / receitas', ar:'مثال محامٍ لندن / وصفات', hi:'उदा. वकील दिल्ली / रेसिपी', ja:'例 弁護士 東京 / レシピ', ky:'мис. адвокат Бишкек / рецепттер', 'zh-Hant':'例如 律師 台北 / 食譜' },
  scr_collect: { bg:'Какво събираме', ru:'Что собираем', uk:'Що збираємо', en:'What to collect', de:'Was sammeln', fr:'Quoi collecter', es:'Qué recopilar', 'es-MX':'Qué recopilar', it:'Cosa raccogliere', pt:'O que coletar', ar:'ماذا نجمع', hi:'क्या एकत्र करें', ja:'収集する内容', ky:'Эмнени чогултабыз', 'zh-Hant':'收集內容' },
  scr_c_emails: { bg:'Имейли', ru:'Имейлы', uk:'Імейли', en:'Emails', de:'E-Mails', fr:'E-mails', es:'Correos', 'es-MX':'Correos', it:'Email', pt:'E-mails', ar:'رسائل البريد', hi:'ईमेल', ja:'メール', ky:'Имейлдер', 'zh-Hant':'電子郵件' },
  scr_c_phones: { bg:'Телефони', ru:'Телефоны', uk:'Телефони', en:'Phones', de:'Telefonnummern', fr:'Téléphones', es:'Teléfonos', 'es-MX':'Teléfonos', it:'Telefoni', pt:'Telefones', ar:'أرقام الهاتف', hi:'फ़ोन', ja:'電話番号', ky:'Телефондор', 'zh-Hant':'電話' },
  scr_c_both: { bg:'Имейли + телефони', ru:'Имейлы + телефоны', uk:'Імейли + телефони', en:'Emails + phones', de:'E-Mails + Telefonnummern', fr:'E-mails + téléphones', es:'Correos + teléfonos', 'es-MX':'Correos + teléfonos', it:'Email + telefoni', pt:'E-mails + telefones', ar:'رسائل البريد + الهواتف', hi:'ईमेल + फ़ोन', ja:'メール + 電話番号', ky:'Имейлдер + телефондор', 'zh-Hant':'電子郵件 + 電話' },
  scr_c_content: { bg:'Съдържание (текст+автор)', ru:'Содержимое (текст+автор)', uk:'Вміст (текст+автор)', en:'Content (text+author)', de:'Inhalt (Text+Autor)', fr:'Contenu (texte+auteur)', es:'Contenido (texto+autor)', 'es-MX':'Contenido (texto+autor)', it:'Contenuto (testo+autore)', pt:'Conteúdo (texto+autor)', ar:'المحتوى (نص+مؤلف)', hi:'सामग्री (पाठ+लेखक)', ja:'コンテンツ(本文+著者)', ky:'Мазмун (текст+автор)', 'zh-Hant':'內容(文字+作者)' },
  scr_c_links: { bg:'Само линкове (дърво)', ru:'Только ссылки', uk:'Лише посилання (дерево)', en:'Links only (tree)', de:'Nur Links (Baum)', fr:'Liens seulement (arbre)', es:'Solo enlaces (árbol)', 'es-MX':'Solo enlaces (árbol)', it:'Solo link (albero)', pt:'Somente links (árvore)', ar:'الروابط فقط (شجرة)', hi:'केवल लिंक (वृक्ष)', ja:'リンクのみ(ツリー)', ky:'Шилтемелер гана (дарак)', 'zh-Hant':'僅連結(樹狀)' },
  scr_adv: { bg:'🎯 Точност и тематика', ru:'🎯 Точность и тематика', uk:'🎯 Точність і тематика', en:'🎯 Precision & topic', de:'🎯 Präzision & Thema', fr:'🎯 Précision et thème', es:'🎯 Precisión y tema', 'es-MX':'🎯 Precisión y tema', it:'🎯 Precisione e tema', pt:'🎯 Precisão e tema', ar:'🎯 الدقة والموضوع', hi:'🎯 सटीकता और विषय', ja:'🎯 精度とトピック', ky:'🎯 Тактык жана тема', 'zh-Hant':'🎯 精準度與主題' },
  scr_must: { bg:'Задължителни думи (всички, със запетая)', ru:'Обязательные слова (все, через запятую)', uk:'Обовʼязкові слова (усі, через кому)', en:'Required words (all, comma)', de:'Pflichtwörter (alle, mit Komma)', fr:'Mots requis (tous, virgule)', es:'Palabras obligatorias (todas, coma)', 'es-MX':'Palabras obligatorias (todas, coma)', it:'Parole obbligatorie (tutte, virgola)', pt:'Palavras obrigatórias (todas, vírgula)', ar:'كلمات مطلوبة (الكل، بفاصلة)', hi:'आवश्यक शब्द (सभी, अल्पविराम)', ja:'必須語(すべて、カンマ区切り)', ky:'Милдеттүү сөздөр (баары, үтүр менен)', 'zh-Hant':'必含詞(全部，逗號分隔)' },
  scr_excl: { bg:'Забранени думи (със запетая)', ru:'Запрещённые слова (через запятую)', uk:'Виключені слова (через кому)', en:'Excluded words (comma)', de:'Ausgeschlossene Wörter (mit Komma)', fr:'Mots exclus (virgule)', es:'Palabras excluidas (coma)', 'es-MX':'Palabras excluidas (coma)', it:'Parole escluse (virgola)', pt:'Palavras excluídas (vírgula)', ar:'كلمات مستبعدة (بفاصلة)', hi:'बहिष्कृत शब्द (अल्पविराम)', ja:'除外語(カンマ区切り)', ky:'Алынып салынган сөздөр (үтүр менен)', 'zh-Hant':'排除詞(逗號分隔)' },
  scr_focus: { bg:'Целева дума в контекст (focus)', ru:'Целевое слово в контексте', uk:'Цільове слово в контексті', en:'Focus word (in context)', de:'Fokuswort (im Kontext)', fr:'Mot cible (en contexte)', es:'Palabra objetivo (en contexto)', 'es-MX':'Palabra objetivo (en contexto)', it:'Parola chiave (nel contesto)', pt:'Palavra-alvo (no contexto)', ar:'الكلمة المستهدفة (في السياق)', hi:'लक्ष्य शब्द (संदर्भ में)', ja:'注目語(文脈内)', ky:'Максаттуу сөз (контекстте)', 'zh-Hant':'目標詞(於上下文)' },
  scr_ctx: { bg:'Контекстни думи (за focus, със запетая)', ru:'Контекстные слова', uk:'Контекстні слова (через кому)', en:'Context words (comma)', de:'Kontextwörter (mit Komma)', fr:'Mots de contexte (virgule)', es:'Palabras de contexto (coma)', 'es-MX':'Palabras de contexto (coma)', it:'Parole di contesto (virgola)', pt:'Palavras de contexto (vírgula)', ar:'كلمات السياق (بفاصلة)', hi:'संदर्भ शब्द (अल्पविराम)', ja:'文脈語(カンマ区切り)', ky:'Контексттик сөздөр (үтүр менен)', 'zh-Hant':'上下文詞(逗號分隔)' },
  scr_types: { bg:'Само типове (напр. recipe,classified — със запетая)', ru:'Только типы (recipe,classified…)', uk:'Лише типи (recipe,classified…)', en:'Only types (recipe,classified…)', de:'Nur Typen (recipe,classified…)', fr:'Types seulement (recipe,classified…)', es:'Solo tipos (recipe,classified…)', 'es-MX':'Solo tipos (recipe,classified…)', it:'Solo tipi (recipe,classified…)', pt:'Somente tipos (recipe,classified…)', ar:'الأنواع فقط (recipe,classified…)', hi:'केवल प्रकार (recipe,classified…)', ja:'タイプのみ(recipe,classified…)', ky:'Түрлөр гана (recipe,classified…)', 'zh-Hant':'僅類型(recipe,classified…)' },
  scr_extopics: { bg:'Изключи теми', ru:'Исключить темы', uk:'Виключити теми', en:'Exclude topics', de:'Themen ausschließen', fr:'Exclure des thèmes', es:'Excluir temas', 'es-MX':'Excluir temas', it:'Escludi temi', pt:'Excluir temas', ar:'استبعاد المواضيع', hi:'विषय बाहर करें', ja:'トピックを除外', ky:'Темаларды алып салуу', 'zh-Hant':'排除主題' },
  scr_max: { bg:'Макс. резултати', ru:'Макс. результатов', uk:'Макс. результатів', en:'Max results', de:'Max. Ergebnisse', fr:'Résultats max.', es:'Máx. resultados', 'es-MX':'Máx. resultados', it:'Risultati max', pt:'Máx. resultados', ar:'أقصى عدد للنتائج', hi:'अधिकतम परिणाम', ja:'最大結果数', ky:'Максимум жыйынтык', 'zh-Hant':'最多結果數' },
  scr_search_btn: { bg:'Търси', ru:'Искать', uk:'Шукати', en:'Search', de:'Suchen', fr:'Rechercher', es:'Buscar', 'es-MX':'Buscar', it:'Cerca', pt:'Pesquisar', ar:'بحث', hi:'खोजें', ja:'検索', ky:'Издөө', 'zh-Hant':'搜尋' },
  scr_searching: { bg:'Търся през търсачките… (може да отнеме време)', ru:'Ищу через поисковики…', uk:'Шукаю через пошуковики… (може зайняти час)', en:'Searching engines… (may take a while)', de:'Suche über Suchmaschinen… (kann dauern)', fr:'Recherche via les moteurs… (peut prendre du temps)', es:'Buscando en los buscadores… (puede tardar)', 'es-MX':'Buscando en los buscadores… (puede tardar)', it:'Ricerca tramite i motori… (può richiedere tempo)', pt:'Pesquisando nos buscadores… (pode demorar)', ar:'أبحث عبر محركات البحث… (قد يستغرق وقتًا)', hi:'सर्च इंजनों में खोज रहे हैं… (समय लग सकता है)', ja:'検索エンジンで検索中…(時間がかかる場合があります)', ky:'Издөө системалары аркылуу издеп жатам… (убакыт алышы мүмкүн)', 'zh-Hant':'正在透過搜尋引擎搜尋…(可能需要一些時間)' },
  scr_results: { bg:'Резултати ({0})', ru:'Результаты ({0})', uk:'Результати ({0})', en:'Results ({0})', de:'Ergebnisse ({0})', fr:'Résultats ({0})', es:'Resultados ({0})', 'es-MX':'Resultados ({0})', it:'Risultati ({0})', pt:'Resultados ({0})', ar:'النتائج ({0})', hi:'परिणाम ({0})', ja:'結果 ({0})', ky:'Жыйынтыктар ({0})', 'zh-Hant':'結果 ({0})' },
  scr_none: { bg:'Няма резултати. Разхлаби филтрите или смени думите.', ru:'Нет результатов.', uk:'Немає результатів. Послабте фільтри.', en:'No results. Loosen filters.', de:'Keine Ergebnisse. Filter lockern.', fr:'Aucun résultat. Assouplissez les filtres.', es:'Sin resultados. Afloja los filtros.', 'es-MX':'Sin resultados. Afloja los filtros.', it:'Nessun risultato. Allenta i filtri.', pt:'Sem resultados. Afrouxe os filtros.', ar:'لا نتائج. خفف المرشحات.', hi:'कोई परिणाम नहीं। फ़िल्टर ढीले करें।', ja:'結果なし。フィルターを緩めてください。', ky:'Жыйынтык жок. Чыпкаларды бошоңдотуңуз.', 'zh-Hant':'沒有結果。放寬篩選條件。' },
  scr_dl_csv: { bg:'⬇ Свали CSV (Excel)', ru:'⬇ Скачать CSV', uk:'⬇ Завантажити CSV (Excel)', en:'⬇ Download CSV (Excel)', de:'⬇ CSV herunterladen (Excel)', fr:'⬇ Télécharger CSV (Excel)', es:'⬇ Descargar CSV (Excel)', 'es-MX':'⬇ Descargar CSV (Excel)', it:'⬇ Scarica CSV (Excel)', pt:'⬇ Baixar CSV (Excel)', ar:'⬇ تنزيل CSV (Excel)', hi:'⬇ CSV डाउनलोड करें (Excel)', ja:'⬇ CSVをダウンロード(Excel)', ky:'⬇ CSV жүктөп алуу (Excel)', 'zh-Hant':'⬇ 下載 CSV(Excel)' },
  scr_email_self: { bg:'✉ Прати на моя имейл', ru:'✉ Отправить на мой имейл', uk:'✉ Надіслати на мій імейл', en:'✉ Email to myself', de:'✉ An mich selbst senden', fr:'✉ Envoyer à moi-même', es:'✉ Enviar a mi correo', 'es-MX':'✉ Enviar a mi correo', it:'✉ Invia a me stesso', pt:'✉ Enviar para meu e-mail', ar:'✉ إرسال إلى بريدي', hi:'✉ मुझे ईमेल करें', ja:'✉ 自分にメール送信', ky:'✉ Өз имейлиме жөнөтүү', 'zh-Hant':'✉ 寄到我的信箱' },
  scr_email_ph: { bg:'моят@имейл', ru:'мой@имейл', uk:'мій@імейл', en:'my@email', de:'meine@mail', fr:'mon@email', es:'mi@correo', 'es-MX':'mi@correo', it:'mia@email', pt:'meu@email', ar:'بريدي@مثال', hi:'मेरा@ईमेल', ja:'my@email', ky:'менин@имейл', 'zh-Hant':'我的@信箱' },
  scr_refine: { bg:'🔎 Уточни в намереното (2-ра стъпка)', ru:'🔎 Уточнить в найденном', uk:'🔎 Уточнити в знайденому', en:'🔎 Refine within results', de:'🔎 In den Ergebnissen verfeinern', fr:'🔎 Affiner dans les résultats', es:'🔎 Refinar en los resultados', 'es-MX':'🔎 Refinar en los resultados', it:'🔎 Affina nei risultati', pt:'🔎 Refinar nos resultados', ar:'🔎 تنقيح ضمن النتائج', hi:'🔎 परिणामों में परिष्कृत करें', ja:'🔎 結果内で絞り込み', ky:'🔎 Жыйынтыктын ичинде тактоо', 'zh-Hant':'🔎 在結果中細化' },
  scr_refine_ph: { bg:'нова дума-филтър, напр. мусака', ru:'новое слово-фильтр', uk:'нове слово-фільтр, напр. мусака', en:'new filter word, e.g. moussaka', de:'neues Filterwort, z. B. Moussaka', fr:'nouveau mot-filtre, ex. moussaka', es:'nueva palabra-filtro, p. ej. musaca', 'es-MX':'nueva palabra-filtro, p. ej. musaca', it:'nuova parola-filtro, es. moussaka', pt:'nova palavra-filtro, ex. musaca', ar:'كلمة تصفية جديدة، مثال مسقعة', hi:'नया फ़िल्टर शब्द, उदा. मूसाका', ja:'新しいフィルター語、例 ムサカ', ky:'жаңы чыпка сөзү, мис. мусака', 'zh-Hant':'新篩選詞，例如 慕沙卡' },
  scr_need_backend: { bg:'Първо задай адрес на услугата (⚙️ Настройки).', ru:'Сначала задай адрес сервиса.', uk:'Спершу задайте адресу сервісу (⚙️ Налаштування).', en:'Set the service URL first (⚙️ Settings).', de:'Zuerst die Dienst-URL festlegen (⚙️ Einstellungen).', fr:"Définissez d'abord l'URL du service (⚙️ Paramètres).", es:'Primero define la URL del servicio (⚙️ Ajustes).', 'es-MX':'Primero define la URL del servicio (⚙️ Configuración).', it:"Imposta prima l'URL del servizio (⚙️ Impostazioni).", pt:'Defina primeiro a URL do serviço (⚙️ Configurações).', ar:'حدد عنوان الخدمة أولاً (⚙️ الإعدادات).', hi:'पहले सेवा URL सेट करें (⚙️ सेटिंग्स)।', ja:'先にサービスURLを設定してください(⚙️ 設定)。', ky:'Адегенде кызматтын дарегин коюңуз (⚙️ Жөндөөлөр).', 'zh-Hant':'請先設定服務網址(⚙️ 設定)。' },
  scr_err: { bg:'Грешка: {0}', ru:'Ошибка: {0}', uk:'Помилка: {0}', en:'Error: {0}', de:'Fehler: {0}', fr:'Erreur : {0}', es:'Error: {0}', 'es-MX':'Error: {0}', it:'Errore: {0}', pt:'Erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'Ката: {0}', 'zh-Hant':'錯誤：{0}' },
  scr_sent: { bg:'✓ Изпратено на {0}', ru:'✓ Отправлено на {0}', uk:'✓ Надіслано на {0}', en:'✓ Sent to {0}', de:'✓ Gesendet an {0}', fr:'✓ Envoyé à {0}', es:'✓ Enviado a {0}', 'es-MX':'✓ Enviado a {0}', it:'✓ Inviato a {0}', pt:'✓ Enviado para {0}', ar:'✓ أُرسل إلى {0}', hi:'✓ {0} को भेजा गया', ja:'✓ {0} に送信しました', ky:'✓ {0} дарегине жөнөтүлдү', 'zh-Hant':'✓ 已寄至 {0}' },
  scr_hint: { bg:'Мощта е в услугата (бекенд): 14 търсачки, филтри, ~30 типа, изпращане. Този екран само я управлява.', ru:'Мощь — в сервисе (бэкенд).', uk:'Уся потужність — у сервісі (бекенд); цей екран лише керує ним.', en:'The power is in the backend service; this screen drives it.', de:'Die Leistung steckt im Backend-Dienst; dieser Bildschirm steuert ihn nur.', fr:'La puissance est dans le service (backend) ; cet écran ne fait que le piloter.', es:'La potencia está en el servicio (backend); esta pantalla solo lo controla.', 'es-MX':'La potencia está en el servicio (backend); esta pantalla solo lo controla.', it:'La potenza è nel servizio (backend); questa schermata lo gestisce soltanto.', pt:'A potência está no serviço (backend); esta tela apenas o controla.', ar:'القوة في الخدمة (الخلفية)؛ هذه الشاشة تتحكم بها فقط.', hi:'ताकत बैकएंड सेवा में है; यह स्क्रीन बस उसे चलाती है।', ja:'本当の力はバックエンドのサービスにあり、この画面はそれを操作するだけです。', ky:'Күч бекенд кызматта; бул экран аны башкарат гана.', 'zh-Hant':'真正的能力在後端服務；此畫面只是操作它。' }
});

export const title = t('scr_title');

const LS_URL = 'scraper_api_url';
const LS_TOKEN = 'scraper_api_token';
const TOPICS = ['crime', 'weapons', 'adult', 'gambling', 'violence', 'drugs'];
const TOPIC_BG = { crime:'престъпност', weapons:'оръжия', adult:'възрастни', gambling:'хазарт', violence:'насилие', drugs:'наркотици' };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function apiBase() { try { return (localStorage.getItem(LS_URL) || '').replace(/\/+$/, ''); } catch (_) { return ''; } }
function apiToken() { try { return localStorage.getItem(LS_TOKEN) || ''; } catch (_) { return ''; } }

async function apiPost(pathname, payload) {
  const base = apiBase();
  if (!base) throw new Error(t('scr_need_backend'));
  const url = base + pathname;
  const headers = { 'Content-Type': 'application/json' };
  const tok = apiToken(); if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  if (CH && CH.post) {
    const r = await CH.post({ url, headers, data: payload, connectTimeout: 120000, readTimeout: 120000 });
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    if (r.status >= 400) throw new Error((d && d.error) || ('HTTP ' + r.status));
    return d;
  }
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
  return d;
}

function csvOf(results) {
  const isContent = results.some((r) => r.type === 'content' || r.type === 'link');
  const cols = isContent ? ['source', 'contentType', 'title', 'author', 'date', 'score', 'snippet', 'text']
                         : ['type', 'value', 'source'];
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [cols.join(',')].concat(results.map((r) => cols.map((c) => q(r[c])).join(',')));
  return '﻿' + rows.join('\r\n');
}
function download(name, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch (_) {}
}
function openExternal(url) {
  try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url }); return; } } catch (e) {}
  try { window.open(url, '_blank'); } catch (e) { try { location.href = url; } catch (_) {} }
}
function csvList(v) { return String(v || '').split(',').map((s) => s.trim()).filter(Boolean); }

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <details style="margin-bottom:10px"><summary style="cursor:pointer;font-weight:600">${esc(t('scr_settings'))}</summary>
        <label>${esc(t('scr_backend'))}</label>
        <input type="url" id="scUrl" placeholder="${esc(t('scr_backend_ph'))}" value="${esc(apiBase())}" />
        <label>${esc(t('scr_token'))}</label>
        <input type="password" id="scTok" value="${esc(apiToken())}" />
        <button class="btn sec" id="scSaveCfg" style="margin-top:8px">${esc(t('scr_save_cfg'))}</button>
      </details>

      <label>${esc(t('scr_kw_label'))}</label>
      <input type="text" id="scKw" placeholder="${esc(t('scr_kw_ph'))}" autocomplete="off" />

      <label style="margin-top:10px">${esc(t('scr_collect'))}</label>
      <select id="scCollect">
        <option value="emails">${esc(t('scr_c_emails'))}</option>
        <option value="phones">${esc(t('scr_c_phones'))}</option>
        <option value="both">${esc(t('scr_c_both'))}</option>
        <option value="content">${esc(t('scr_c_content'))}</option>
        <option value="links">${esc(t('scr_c_links'))}</option>
      </select>

      <details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">${esc(t('scr_adv'))}</summary>
        <label>${esc(t('scr_must'))}</label><input type="text" id="scMust" />
        <label>${esc(t('scr_excl'))}</label><input type="text" id="scExcl" />
        <label>${esc(t('scr_focus'))}</label><input type="text" id="scFocus" />
        <label>${esc(t('scr_ctx'))}</label><input type="text" id="scCtx" />
        <label>${esc(t('scr_types'))}</label><input type="text" id="scTypes" placeholder="recipe,classified,medical" />
        <label style="margin-top:6px">${esc(t('scr_extopics'))}</label>
        <div id="scTopics" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px">
          ${TOPICS.map((tp) => `<label style="font-weight:400;display:flex;align-items:center;gap:4px"><input type="checkbox" class="scTopic" value="${tp}"> ${esc(TOPIC_BG[tp] || tp)}</label>`).join('')}
        </div>
      </details>

      <label style="margin-top:10px">${esc(t('scr_max'))}</label>
      <input type="number" id="scMax" value="50" min="1" max="500" />
      <button class="btn" id="scSearch" style="margin-top:10px">🔎 ${esc(t('scr_search_btn'))}</button>

      <div class="status" id="scStatus"></div>
      <div id="scActions" style="display:none;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn sec inline" id="scCsv">${esc(t('scr_dl_csv'))}</button>
        <input type="email" id="scEmail" placeholder="${esc(t('scr_email_ph'))}" style="max-width:180px;display:inline-block;margin:0 6px" />
        <button class="btn sec inline" id="scMail">${esc(t('scr_email_self'))}</button>
        <div style="flex-basis:100%;height:0"></div>
        <input type="text" id="scRefine" placeholder="${esc(t('scr_refine_ph'))}" style="max-width:180px;display:inline-block;margin:0 6px" />
        <button class="btn sec inline" id="scRefineBtn">${esc(t('scr_refine'))}</button>
      </div>
      <div class="out-block" id="scOut" style="display:none;margin-top:10px"></div>
      <p class="hint" style="margin-top:10px">${esc(t('scr_hint'))}</p>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#scStatus');
  const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };
  const clearStatus = () => { statusEl.className = 'status'; };
  let lastResults = [];

  $('#scSaveCfg').addEventListener('click', () => {
    try { localStorage.setItem(LS_URL, $('#scUrl').value.trim()); localStorage.setItem(LS_TOKEN, $('#scTok').value.trim()); } catch (_) {}
    setStatus('ok', t('scr_save_cfg'));
  });

  function buildFilters() {
    const f = {};
    const must = csvList($('#scMust').value); if (must.length) f.must_all = must;
    const excl = csvList($('#scExcl').value); if (excl.length) f.exclude = excl;
    const focus = csvList($('#scFocus').value); if (focus.length) f.focus = focus;
    const ctx = csvList($('#scCtx').value); if (ctx.length) f.context = ctx;
    const topics = Array.from(root.querySelectorAll('.scTopic:checked')).map((c) => c.value);
    if (topics.length) f.exclude_topics = topics;
    return f;
  }
  function payloadBase() {
    const p = { collect: $('#scCollect').value, max: Math.min(500, parseInt($('#scMax').value, 10) || 50) };
    const f = buildFilters(); if (Object.keys(f).length) p.filters = f;
    const types = csvList($('#scTypes').value); if (types.length) p.types = types;
    return p;
  }

  function renderResults(results) {
    lastResults = results || [];
    const out = $('#scOut');
    if (!lastResults.length) { out.style.display = 'block'; out.innerHTML = `<p class="hint">${esc(t('scr_none'))}</p>`; $('#scActions').style.display = 'none'; return; }
    $('#scActions').style.display = 'flex';
    out.style.display = 'block';
    out.innerHTML = lastResults.map((r) => {
      const src = r.source || r.value || '';
      if (r.type === 'email' || r.type === 'phone') {
        return `<div class="line"><span>${r.type === 'email' ? '✉' : '📞'} ${esc(r.value)}</span><a href="#" class="scLink" data-u="${esc(src)}" style="font-size:.8em">↗</a></div>`;
      }
      const head = `${esc(r.title || src)} <span style="color:var(--text-dim);font-size:.8em">[${esc(r.contentType || '')}]</span>`;
      const who = r.author ? ` · 👤 ${esc(r.author)}` : '';
      const sn = r.snippet ? `<div class="hint" style="margin:2px 0">${esc(r.snippet)}</div>` : '';
      return `<div class="out-block" style="margin:0 0 8px;padding:8px 12px"><div><strong>${head}</strong>${who}</div>${sn}<a href="#" class="scLink" data-u="${esc(src)}" style="font-size:.8em">${esc(src)}</a></div>`;
    }).join('');
    out.querySelectorAll('.scLink').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); if (a.dataset.u) openExternal(a.dataset.u); }));
  }

  async function run(pathname, payload) {
    if (!apiBase()) { setStatus('err', t('scr_need_backend')); return; }
    setStatus('work', t('scr_searching'));
    $('#scSearch').disabled = true;
    try {
      const d = await apiPost(pathname, payload);
      clearStatus();
      renderResults(d.results || []);
      setStatus('ok', tf('scr_results', d.count || 0));
    } catch (e) {
      setStatus('err', tf('scr_err', e && e.message ? e.message : e));
    } finally {
      $('#scSearch').disabled = false;
    }
  }

  $('#scSearch').addEventListener('click', () => {
    const q = $('#scKw').value.trim();
    if (!q) return;
    run('/scrape', Object.assign({ query: q }, payloadBase()));
  });

  $('#scCsv').addEventListener('click', () => { if (lastResults.length) download('scraper-results.csv', csvOf(lastResults), 'text/csv'); });

  $('#scMail').addEventListener('click', async () => {
    const email = $('#scEmail').value.trim();
    if (!email || !lastResults.length) return;
    const body = lastResults.map((r, i) => `${i + 1}. ${r.value || r.title || ''} — ${r.author ? '👤 ' + r.author + ' — ' : ''}${r.source || ''}`).join('\n');
    setStatus('work', '…');
    try { await apiPost('/send', { emails: [email], subject: 'Scraper results', body, delay: false }); setStatus('ok', tf('scr_sent', email)); }
    catch (e) { setStatus('err', tf('scr_err', e && e.message ? e.message : e)); }
  });

  // Уточняване = 2-ра стъпка: /extract върху намерените URL-та + нова задължителна дума.
  $('#scRefineBtn').addEventListener('click', () => {
    const word = $('#scRefine').value.trim();
    const urls = lastResults.map((r) => r.source || r.value).filter(Boolean);
    if (!word || !urls.length) return;
    const p = payloadBase();
    p.collect = p.collect === 'links' ? 'content' : p.collect;
    p.filters = Object.assign({}, p.filters);
    p.filters.must_all = (p.filters.must_all || []).concat([word]);
    run('/extract', { urls, collect: p.collect, filters: p.filters, types: p.types, max: p.max });
  });
}
