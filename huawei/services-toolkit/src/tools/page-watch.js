// Version: 1.0021
// „Наблюдател на страници" — НОВА СЪРЦЕВИНА (Huawei 4.1, 11.09.2026): запазени цели (адрес + какво да следи:
// имейли / телефони / цени / заглавия), повторно сканиране по желание, ИСТОРИЯ на всяко сканиране и сравнение
// (ново / изчезнало / променено), известие на телефона при промяна, износ CSV. Всичко се пази на устройството
// (localStorage). При първо пускане има 2 примерни цели (вградени страници от public/samples — работят и офлайн),
// ясно маркирани „пример", с бутон за изтриване. Свалянето на чужди страници: направо (CapacitorHttp), при неуспех
// през relay (виж getText в scraper-lite.js).
import { esc, downloadBlob } from '../core/ui.js';
import { t, tf, register, getLang } from '../core/i18n.js';
import { extract, getText, isLocalPage, SAMPLE_PAGES } from './scraper-lite.js';

register({
  pw_hint: { bg:'Запази адреси и какво да следиш (имейли, телефони, цени, заглавия). Сканирай отново, когато поискаш — апът пази история и показва какво е ново, изчезнало или променено.', ru:'Сохраните адреса и что отслеживать (email, телефоны, цены, заголовки). Сканируйте повторно, когда захотите — приложение хранит историю и показывает, что появилось, исчезло или изменилось.', uk:'Збережіть адреси й що відстежувати (email, телефони, ціни, заголовки). Скануйте повторно, коли забажаєте — застосунок зберігає історію та показує, що з’явилося, зникло чи змінилося.', en:'Save page addresses and what to track (e-mails, phones, prices, headings). Re-scan whenever you like — the app keeps a history and shows what is new, gone or changed.', de:'Adressen speichern und festlegen, was verfolgt wird (E-Mails, Telefone, Preise, Überschriften). Jederzeit neu scannen — die App führt eine Historie und zeigt, was neu, weg oder geändert ist.', fr:'Enregistrez des adresses et ce qu’il faut suivre (e-mails, téléphones, prix, titres). Relancez quand vous voulez — l’app garde un historique et montre ce qui est nouveau, disparu ou modifié.', es:'Guarda direcciones y qué seguir (correos, teléfonos, precios, títulos). Vuelve a escanear cuando quieras — la app guarda un historial y muestra qué es nuevo, desapareció o cambió.', 'es-MX':'Guarda direcciones y qué seguir (correos, teléfonos, precios, títulos). Vuelve a escanear cuando quieras — la app guarda un historial y muestra qué es nuevo, desapareció o cambió.', it:'Salva indirizzi e cosa seguire (e-mail, telefoni, prezzi, titoli). Riscansiona quando vuoi — l’app conserva la cronologia e mostra cosa è nuovo, sparito o cambiato.', pt:'Guarde endereços e o que seguir (e-mails, telefones, preços, títulos). Volte a analisar quando quiser — a app guarda o histórico e mostra o que é novo, desapareceu ou mudou.', ar:'احفظ عناوين الصفحات وما تريد تتبعه (البريد، الهواتف، الأسعار، العناوين). أعد الفحص متى شئت — يحتفظ التطبيق بسجل ويعرض الجديد والمختفي والمتغيّر.', hi:'पेज के पते और क्या ट्रैक करना है (ईमेल, फ़ोन, कीमतें, शीर्षक) सहेजें। जब चाहें दोबारा स्कैन करें — ऐप इतिहास रखता है और दिखाता है कि क्या नया, गायब या बदला है।', ja:'ページのアドレスと追跡する項目（メール・電話・価格・見出し）を保存。いつでも再スキャン — 履歴を保持し、新規・消滅・変更を表示します。', ky:'Даректерди жана эмнени көзөмөлдөөнү сакта (email, телефон, баа, аталыш). Каалаган убакта кайра скандоо — колдонмо тарыхты сактап, эмне жаңы, жоголгон же өзгөргөнүн көрсөтөт.', 'zh-Hant':'儲存網址與要追蹤的項目（電郵、電話、價格、標題）。隨時重新掃描 — 應用程式保留歷史並顯示新增、消失或變更。' },
  pw_tab_targets: { bg:'Цели', ru:'Цели', uk:'Цілі', en:'Targets', de:'Ziele', fr:'Cibles', es:'Objetivos', 'es-MX':'Objetivos', it:'Obiettivi', pt:'Alvos', ar:'الأهداف', hi:'लक्ष्य', ja:'対象', ky:'Максаттар', 'zh-Hant':'目標' },
  pw_tab_history: { bg:'История', ru:'История', uk:'Історія', en:'History', de:'Verlauf', fr:'Historique', es:'Historial', 'es-MX':'Historial', it:'Cronologia', pt:'Histórico', ar:'السجل', hi:'इतिहास', ja:'履歴', ky:'Тарых', 'zh-Hant':'歷史' },
  pw_tab_export: { bg:'Износ и известия', ru:'Экспорт и уведомления', uk:'Експорт і сповіщення', en:'Export & alerts', de:'Export & Hinweise', fr:'Export & alertes', es:'Exportar y avisos', 'es-MX':'Exportar y avisos', it:'Esporta e avvisi', pt:'Exportar e alertas', ar:'التصدير والتنبيهات', hi:'निर्यात और अलर्ट', ja:'書き出しと通知', ky:'Экспорт жана эскертүү', 'zh-Hant':'匯出與通知' },
  pw_sample_banner: { bg:'Примерни цели (вградени страници, работят и офлайн) — изтрий ги, когато добавиш свои.', ru:'Примерные цели (встроенные страницы, работают и офлайн) — удалите их, когда добавите свои.', uk:'Приклади цілей (вбудовані сторінки, працюють і офлайн) — видаліть їх, коли додасте свої.', en:'Sample targets (built-in pages, work offline too) — delete them once you add your own.', de:'Beispielziele (eingebaute Seiten, auch offline) — löschen, sobald eigene hinzugefügt sind.', fr:'Cibles d’exemple (pages intégrées, aussi hors ligne) — supprimez-les après avoir ajouté les vôtres.', es:'Objetivos de ejemplo (páginas integradas, también sin conexión) — bórralos cuando añadas los tuyos.', 'es-MX':'Objetivos de ejemplo (páginas integradas, también sin conexión) — bórralos cuando agregues los tuyos.', it:'Obiettivi di esempio (pagine integrate, anche offline) — eliminali quando aggiungi i tuoi.', pt:'Alvos de exemplo (páginas incorporadas, também offline) — apague-os quando adicionar os seus.', ar:'أهداف نموذجية (صفحات مدمجة تعمل دون اتصال) — احذفها بعد إضافة أهدافك.', hi:'नमूना लक्ष्य (अंतर्निहित पेज, ऑफ़लाइन भी) — अपने जोड़ने के बाद इन्हें हटा दें।', ja:'サンプル対象（内蔵ページ、オフラインでも動作）— 自分の対象を追加したら削除してください。', ky:'Мисал максаттар (орнотулган барактар, оффлайн да иштейт) — өзүңдүкүн кошкондо өчүр.', 'zh-Hant':'範例目標（內建頁面，離線也可用）— 新增自己的目標後可刪除。' },
  pw_sample_badge: { bg:'пример', ru:'пример', uk:'приклад', en:'sample', de:'Beispiel', fr:'exemple', es:'ejemplo', 'es-MX':'ejemplo', it:'esempio', pt:'exemplo', ar:'مثال', hi:'नमूना', ja:'サンプル', ky:'мисал', 'zh-Hant':'範例' },
  pw_del_samples: { bg:'Изтрий примерите', ru:'Удалить примеры', uk:'Видалити приклади', en:'Delete samples', de:'Beispiele löschen', fr:'Supprimer les exemples', es:'Borrar ejemplos', 'es-MX':'Borrar ejemplos', it:'Elimina esempi', pt:'Apagar exemplos', ar:'حذف الأمثلة', hi:'नमूने हटाएँ', ja:'サンプルを削除', ky:'Мисалдарды өчүрүү', 'zh-Hant':'刪除範例' },
  pw_add_samples: { bg:'Добави примерни цели', ru:'Добавить примерные цели', uk:'Додати приклади цілей', en:'Add sample targets', de:'Beispielziele hinzufügen', fr:'Ajouter des cibles d’exemple', es:'Añadir objetivos de ejemplo', 'es-MX':'Agregar objetivos de ejemplo', it:'Aggiungi obiettivi di esempio', pt:'Adicionar alvos de exemplo', ar:'إضافة أهداف نموذجية', hi:'नमूना लक्ष्य जोड़ें', ja:'サンプル対象を追加', ky:'Мисал максаттарды кошуу', 'zh-Hant':'新增範例目標' },
  pw_scan_all: { bg:'Сканирай всички', ru:'Сканировать все', uk:'Сканувати всі', en:'Scan all', de:'Alle scannen', fr:'Tout scanner', es:'Escanear todo', 'es-MX':'Escanear todo', it:'Scansiona tutti', pt:'Analisar todos', ar:'فحص الكل', hi:'सभी स्कैन करें', ja:'すべてスキャン', ky:'Баарын скандоо', 'zh-Hant':'全部掃描' },
  pw_scan: { bg:'Сканирай', ru:'Сканировать', uk:'Сканувати', en:'Scan', de:'Scannen', fr:'Scanner', es:'Escanear', 'es-MX':'Escanear', it:'Scansiona', pt:'Analisar', ar:'فحص', hi:'स्कैन', ja:'スキャン', ky:'Скандоо', 'zh-Hant':'掃描' },
  pw_delete: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Borrar', 'es-MX':'Borrar', it:'Elimina', pt:'Apagar', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  pw_add_title: { bg:'Нова цел', ru:'Новая цель', uk:'Нова ціль', en:'New target', de:'Neues Ziel', fr:'Nouvelle cible', es:'Nuevo objetivo', 'es-MX':'Nuevo objetivo', it:'Nuovo obiettivo', pt:'Novo alvo', ar:'هدف جديد', hi:'नया लक्ष्य', ja:'新しい対象', ky:'Жаңы максат', 'zh-Hant':'新目標' },
  pw_name: { bg:'Име (по избор)', ru:'Название (необязательно)', uk:'Назва (необов’язково)', en:'Name (optional)', de:'Name (optional)', fr:'Nom (facultatif)', es:'Nombre (opcional)', 'es-MX':'Nombre (opcional)', it:'Nome (facoltativo)', pt:'Nome (opcional)', ar:'الاسم (اختياري)', hi:'नाम (वैकल्पिक)', ja:'名前（任意）', ky:'Аты (милдеттүү эмес)', 'zh-Hant':'名稱（選填）' },
  pw_url: { bg:'Адрес на страницата', ru:'Адрес страницы', uk:'Адреса сторінки', en:'Page address (URL)', de:'Seitenadresse (URL)', fr:'Adresse de la page (URL)', es:'Dirección de la página (URL)', 'es-MX':'Dirección de la página (URL)', it:'Indirizzo della pagina (URL)', pt:'Endereço da página (URL)', ar:'عنوان الصفحة (URL)', hi:'पेज का पता (URL)', ja:'ページのアドレス（URL）', ky:'Барактын дареги (URL)', 'zh-Hant':'頁面網址（URL）' },
  pw_kinds: { bg:'Какво да следи', ru:'Что отслеживать', uk:'Що відстежувати', en:'What to track', de:'Was verfolgen', fr:'Quoi suivre', es:'Qué seguir', 'es-MX':'Qué seguir', it:'Cosa seguire', pt:'O que seguir', ar:'ما يجب تتبعه', hi:'क्या ट्रैक करें', ja:'追跡する項目', ky:'Эмнени көзөмөлдөө', 'zh-Hant':'追蹤項目' },
  pw_k_emails: { bg:'Имейли', ru:'Email', uk:'Email', en:'E-mails', de:'E-Mails', fr:'E-mails', es:'Correos', 'es-MX':'Correos', it:'E-mail', pt:'E-mails', ar:'البريد', hi:'ईमेल', ja:'メール', ky:'Email', 'zh-Hant':'電郵' },
  pw_k_phones: { bg:'Телефони', ru:'Телефоны', uk:'Телефони', en:'Phones', de:'Telefone', fr:'Téléphones', es:'Teléfonos', 'es-MX':'Teléfonos', it:'Telefoni', pt:'Telefones', ar:'الهواتف', hi:'फ़ोन', ja:'電話', ky:'Телефондор', 'zh-Hant':'電話' },
  pw_k_prices: { bg:'Цени', ru:'Цены', uk:'Ціни', en:'Prices', de:'Preise', fr:'Prix', es:'Precios', 'es-MX':'Precios', it:'Prezzi', pt:'Preços', ar:'الأسعار', hi:'कीमतें', ja:'価格', ky:'Баалар', 'zh-Hant':'價格' },
  pw_k_titles: { bg:'Заглавия', ru:'Заголовки', uk:'Заголовки', en:'Headings', de:'Überschriften', fr:'Titres', es:'Títulos', 'es-MX':'Títulos', it:'Titoli', pt:'Títulos', ar:'العناوين', hi:'शीर्षक', ja:'見出し', ky:'Аталыштар', 'zh-Hant':'標題' },
  pw_add_go: { bg:'Добави и сканирай', ru:'Добавить и сканировать', uk:'Додати й сканувати', en:'Add and scan', de:'Hinzufügen und scannen', fr:'Ajouter et scanner', es:'Añadir y escanear', 'es-MX':'Agregar y escanear', it:'Aggiungi e scansiona', pt:'Adicionar e analisar', ar:'إضافة وفحص', hi:'जोड़ें और स्कैन करें', ja:'追加してスキャン', ky:'Кошуп скандоо', 'zh-Hant':'新增並掃描' },
  pw_need_url: { bg:'Въведи адрес на страница.', ru:'Введите адрес страницы.', uk:'Введіть адресу сторінки.', en:'Enter a page address.', de:'Seitenadresse eingeben.', fr:'Saisissez l’adresse d’une page.', es:'Escribe la dirección de una página.', 'es-MX':'Escribe la dirección de una página.', it:'Inserisci l’indirizzo di una pagina.', pt:'Introduza o endereço de uma página.', ar:'أدخل عنوان صفحة.', hi:'पेज का पता दर्ज करें।', ja:'ページのアドレスを入力してください。', ky:'Барактын дарегин киргиз.', 'zh-Hant':'請輸入頁面網址。' },
  pw_need_kind: { bg:'Избери поне едно нещо за следене.', ru:'Выберите хотя бы один пункт для отслеживания.', uk:'Виберіть хоча б один пункт для відстеження.', en:'Pick at least one thing to track.', de:'Mindestens ein Element zum Verfolgen wählen.', fr:'Choisissez au moins un élément à suivre.', es:'Elige al menos un elemento para seguir.', 'es-MX':'Elige al menos un elemento para seguir.', it:'Scegli almeno un elemento da seguire.', pt:'Escolha pelo menos um item para seguir.', ar:'اختر عنصراً واحداً على الأقل للتتبع.', hi:'ट्रैक करने के लिए कम से कम एक चीज़ चुनें।', ja:'追跡する項目を1つ以上選んでください。', ky:'Көзөмөлдөө үчүн кеминде бирди танда.', 'zh-Hant':'請至少選擇一個追蹤項目。' },
  pw_scanning: { bg:'Сканирам: {0}…', ru:'Сканирую: {0}…', uk:'Сканую: {0}…', en:'Scanning: {0}…', de:'Scanne: {0}…', fr:'Analyse : {0}…', es:'Escaneando: {0}…', 'es-MX':'Escaneando: {0}…', it:'Scansione: {0}…', pt:'A analisar: {0}…', ar:'جارٍ الفحص: {0}…', hi:'स्कैन हो रहा है: {0}…', ja:'スキャン中: {0}…', ky:'Скандоо: {0}…', 'zh-Hant':'掃描中：{0}…' },
  pw_fail: { bg:'Неуспешно сваляне (няма връзка или страницата блокира).', ru:'Не удалось загрузить (нет связи или страница блокирует).', uk:'Не вдалося завантажити (немає зв’язку або сторінка блокує).', en:'Download failed (no connection or the page blocks).', de:'Download fehlgeschlagen (keine Verbindung oder Seite blockiert).', fr:'Téléchargement impossible (pas de connexion ou page bloquée).', es:'Descarga fallida (sin conexión o la página bloquea).', 'es-MX':'Descarga fallida (sin conexión o la página bloquea).', it:'Download fallito (nessuna connessione o la pagina blocca).', pt:'Falha ao descarregar (sem ligação ou a página bloqueia).', ar:'فشل التنزيل (لا اتصال أو الصفحة تحظر).', hi:'डाउनलोड विफल (कनेक्शन नहीं या पेज ब्लॉक करता है)।', ja:'取得に失敗（接続なし、またはページがブロック）。', ky:'Жүктөө ишке ашкан жок (байланыш жок же барак бөгөттөйт).', 'zh-Hant':'下載失敗（無連線或頁面封鎖）。' },
  pw_first: { bg:'Първо сканиране — имейли: {0}, телефони: {1}, цени: {2}, заглавия: {3}', ru:'Первое сканирование — email: {0}, телефоны: {1}, цены: {2}, заголовки: {3}', uk:'Перше сканування — email: {0}, телефони: {1}, ціни: {2}, заголовки: {3}', en:'First scan — e-mails: {0}, phones: {1}, prices: {2}, headings: {3}', de:'Erster Scan — E-Mails: {0}, Telefone: {1}, Preise: {2}, Überschriften: {3}', fr:'Premier scan — e-mails : {0}, téléphones : {1}, prix : {2}, titres : {3}', es:'Primer escaneo — correos: {0}, teléfonos: {1}, precios: {2}, títulos: {3}', 'es-MX':'Primer escaneo — correos: {0}, teléfonos: {1}, precios: {2}, títulos: {3}', it:'Prima scansione — e-mail: {0}, telefoni: {1}, prezzi: {2}, titoli: {3}', pt:'Primeira análise — e-mails: {0}, telefones: {1}, preços: {2}, títulos: {3}', ar:'أول فحص — البريد: {0}، الهواتف: {1}، الأسعار: {2}، العناوين: {3}', hi:'पहला स्कैन — ईमेल: {0}, फ़ोन: {1}, कीमतें: {2}, शीर्षक: {3}', ja:'初回スキャン — メール: {0}、電話: {1}、価格: {2}、見出し: {3}', ky:'Биринчи скандоо — email: {0}, телефон: {1}, баа: {2}, аталыш: {3}', 'zh-Hant':'首次掃描 — 電郵：{0}、電話：{1}、價格：{2}、標題：{3}' },
  pw_nochange: { bg:'Без промени', ru:'Без изменений', uk:'Без змін', en:'No changes', de:'Keine Änderungen', fr:'Aucun changement', es:'Sin cambios', 'es-MX':'Sin cambios', it:'Nessuna modifica', pt:'Sem alterações', ar:'لا تغييرات', hi:'कोई बदलाव नहीं', ja:'変更なし', ky:'Өзгөрүү жок', 'zh-Hant':'無變更' },
  pw_summary: { bg:'{0} нови · {1} изчезнали · {2} променени', ru:'{0} новых · {1} исчезло · {2} изменено', uk:'{0} нових · {1} зникло · {2} змінено', en:'{0} new · {1} gone · {2} changed', de:'{0} neu · {1} weg · {2} geändert', fr:'{0} nouveaux · {1} disparus · {2} modifiés', es:'{0} nuevos · {1} desaparecidos · {2} cambiados', 'es-MX':'{0} nuevos · {1} desaparecidos · {2} cambiados', it:'{0} nuovi · {1} spariti · {2} cambiati', pt:'{0} novos · {1} desaparecidos · {2} alterados', ar:'{0} جديد · {1} مختفٍ · {2} متغيّر', hi:'{0} नए · {1} गायब · {2} बदले', ja:'新規 {0} · 消滅 {1} · 変更 {2}', ky:'{0} жаңы · {1} жоголду · {2} өзгөрдү', 'zh-Hant':'新增 {0} · 消失 {1} · 變更 {2}' },
  pgw_last: { bg:'Последно сканиране: {0}', ru:'Последнее сканирование: {0}', uk:'Останнє сканування: {0}', en:'Last scan: {0}', de:'Letzter Scan: {0}', fr:'Dernier scan : {0}', es:'Último escaneo: {0}', 'es-MX':'Último escaneo: {0}', it:'Ultima scansione: {0}', pt:'Última análise: {0}', ar:'آخر فحص: {0}', hi:'अंतिम स्कैन: {0}', ja:'最終スキャン: {0}', ky:'Акыркы скандоо: {0}', 'zh-Hant':'上次掃描：{0}' },
  pw_never: { bg:'още не е сканирано', ru:'ещё не сканировано', uk:'ще не скановано', en:'not scanned yet', de:'noch nicht gescannt', fr:'pas encore scanné', es:'aún sin escanear', 'es-MX':'aún sin escanear', it:'non ancora scansionato', pt:'ainda não analisado', ar:'لم يُفحص بعد', hi:'अभी स्कैन नहीं हुआ', ja:'未スキャン', ky:'али скандалган жок', 'zh-Hant':'尚未掃描' },
  pw_added: { bg:'Ново', ru:'Новое', uk:'Нове', en:'New', de:'Neu', fr:'Nouveau', es:'Nuevo', 'es-MX':'Nuevo', it:'Nuovo', pt:'Novo', ar:'جديد', hi:'नया', ja:'新規', ky:'Жаңы', 'zh-Hant':'新增' },
  pw_removed: { bg:'Изчезнало', ru:'Исчезло', uk:'Зникло', en:'Gone', de:'Weg', fr:'Disparu', es:'Desapareció', 'es-MX':'Desapareció', it:'Sparito', pt:'Desapareceu', ar:'اختفى', hi:'गायब', ja:'消滅', ky:'Жоголду', 'zh-Hant':'消失' },
  pw_changed: { bg:'Променено', ru:'Изменено', uk:'Змінено', en:'Changed', de:'Geändert', fr:'Modifié', es:'Cambiado', 'es-MX':'Cambiado', it:'Cambiato', pt:'Alterado', ar:'تغيّر', hi:'बदला', ja:'変更', ky:'Өзгөрдү', 'zh-Hant':'變更' },
  pw_pick_target: { bg:'Цел', ru:'Цель', uk:'Ціль', en:'Target', de:'Ziel', fr:'Cible', es:'Objetivo', 'es-MX':'Objetivo', it:'Obiettivo', pt:'Alvo', ar:'الهدف', hi:'लक्ष्य', ja:'対象', ky:'Максат', 'zh-Hant':'目標' },
  pw_no_targets: { bg:'Няма цели. Добави адрес в „Цели“ или върни примерите.', ru:'Целей нет. Добавьте адрес в «Цели» или верните примеры.', uk:'Цілей немає. Додайте адресу в «Цілі» або поверніть приклади.', en:'No targets. Add an address under “Targets” or bring back the samples.', de:'Keine Ziele. Adresse unter „Ziele“ hinzufügen oder Beispiele zurückholen.', fr:'Aucune cible. Ajoutez une adresse dans « Cibles » ou restaurez les exemples.', es:'Sin objetivos. Añade una dirección en «Objetivos» o recupera los ejemplos.', 'es-MX':'Sin objetivos. Agrega una dirección en «Objetivos» o recupera los ejemplos.', it:'Nessun obiettivo. Aggiungi un indirizzo in «Obiettivi» o ripristina gli esempi.', pt:'Sem alvos. Adicione um endereço em «Alvos» ou reponha os exemplos.', ar:'لا أهداف. أضف عنواناً في «الأهداف» أو أعد الأمثلة.', hi:'कोई लक्ष्य नहीं। “लक्ष्य” में पता जोड़ें या नमूने वापस लाएँ।', ja:'対象がありません。「対象」でアドレスを追加するか、サンプルを戻してください。', ky:'Максат жок. «Максаттар» бөлүмүнө дарек кош же мисалдарды кайтар.', 'zh-Hant':'沒有目標。請在「目標」新增網址或還原範例。' },
  pw_no_history: { bg:'Няма история — натисни „Сканирай“.', ru:'Истории нет — нажмите «Сканировать».', uk:'Історії немає — натисніть «Сканувати».', en:'No history yet — press “Scan”.', de:'Noch kein Verlauf — „Scannen“ drücken.', fr:'Pas encore d’historique — appuyez sur « Scanner ».', es:'Sin historial — pulsa «Escanear».', 'es-MX':'Sin historial — pulsa «Escanear».', it:'Nessuna cronologia — premi «Scansiona».', pt:'Sem histórico — toque em «Analisar».', ar:'لا سجل بعد — اضغط «فحص».', hi:'अभी इतिहास नहीं — “स्कैन” दबाएँ।', ja:'履歴なし — 「スキャン」を押してください。', ky:'Тарых жок — «Скандоо» бас.', 'zh-Hant':'尚無歷史 — 請按「掃描」。' },
  pw_current: { bg:'Текущи данни (последно сканиране)', ru:'Текущие данные (последнее сканирование)', uk:'Поточні дані (останнє сканування)', en:'Current data (latest scan)', de:'Aktuelle Daten (letzter Scan)', fr:'Données actuelles (dernier scan)', es:'Datos actuales (último escaneo)', 'es-MX':'Datos actuales (último escaneo)', it:'Dati attuali (ultima scansione)', pt:'Dados atuais (última análise)', ar:'البيانات الحالية (آخر فحص)', hi:'वर्तमान डेटा (अंतिम स्कैन)', ja:'現在のデータ（最新スキャン）', ky:'Учурдагы маалымат (акыркы скандоо)', 'zh-Hant':'目前資料（最新掃描）' },
  pw_compare: { bg:'Сравни две сканирания', ru:'Сравнить два сканирования', uk:'Порівняти два сканування', en:'Compare two scans', de:'Zwei Scans vergleichen', fr:'Comparer deux scans', es:'Comparar dos escaneos', 'es-MX':'Comparar dos escaneos', it:'Confronta due scansioni', pt:'Comparar duas análises', ar:'مقارنة فحصين', hi:'दो स्कैन की तुलना', ja:'2つのスキャンを比較', ky:'Эки скандоону салыштыруу', 'zh-Hant':'比較兩次掃描' },
  pw_cmp_a: { bg:'От', ru:'От', uk:'Від', en:'From', de:'Von', fr:'De', es:'Desde', 'es-MX':'Desde', it:'Da', pt:'De', ar:'من', hi:'से', ja:'比較元', ky:'Кайдан', 'zh-Hant':'從' },
  pw_cmp_b: { bg:'До', ru:'До', uk:'До', en:'To', de:'Bis', fr:'À', es:'Hasta', 'es-MX':'Hasta', it:'A', pt:'Até', ar:'إلى', hi:'तक', ja:'比較先', ky:'Кайда', 'zh-Hant':'至' },
  pw_cmp_go: { bg:'Сравни', ru:'Сравнить', uk:'Порівняти', en:'Compare', de:'Vergleichen', fr:'Comparer', es:'Comparar', 'es-MX':'Comparar', it:'Confronta', pt:'Comparar', ar:'قارن', hi:'तुलना करें', ja:'比較', ky:'Салыштыруу', 'zh-Hant':'比較' },
  pw_timeline: { bg:'Хронология на сканиранията', ru:'Хронология сканирований', uk:'Хронологія сканувань', en:'Scan timeline', de:'Scan-Chronik', fr:'Chronologie des scans', es:'Cronología de escaneos', 'es-MX':'Cronología de escaneos', it:'Cronologia delle scansioni', pt:'Cronologia das análises', ar:'الجدول الزمني للفحوصات', hi:'स्कैन समयरेखा', ja:'スキャンの時系列', ky:'Скандоолордун хронологиясы', 'zh-Hant':'掃描時間軸' },
  pw_csv_hist: { bg:'Свали CSV — история на промените', ru:'Скачать CSV — история изменений', uk:'Завантажити CSV — історія змін', en:'Download CSV — change history', de:'CSV laden — Änderungsverlauf', fr:'Télécharger CSV — historique des changements', es:'Descargar CSV — historial de cambios', 'es-MX':'Descargar CSV — historial de cambios', it:'Scarica CSV — cronologia modifiche', pt:'Transferir CSV — histórico de alterações', ar:'تنزيل CSV — سجل التغييرات', hi:'CSV डाउनलोड — बदलाव इतिहास', ja:'CSVをダウンロード — 変更履歴', ky:'CSV жүктөө — өзгөрүү тарыхы', 'zh-Hant':'下載 CSV — 變更歷史' },
  pw_csv_now: { bg:'Свали CSV — текущи данни на всички цели', ru:'Скачать CSV — текущие данные всех целей', uk:'Завантажити CSV — поточні дані всіх цілей', en:'Download CSV — current data of all targets', de:'CSV laden — aktuelle Daten aller Ziele', fr:'Télécharger CSV — données actuelles de toutes les cibles', es:'Descargar CSV — datos actuales de todos los objetivos', 'es-MX':'Descargar CSV — datos actuales de todos los objetivos', it:'Scarica CSV — dati attuali di tutti gli obiettivi', pt:'Transferir CSV — dados atuais de todos os alvos', ar:'تنزيل CSV — البيانات الحالية لكل الأهداف', hi:'CSV डाउनलोड — सभी लक्ष्यों का वर्तमान डेटा', ja:'CSVをダウンロード — 全対象の現在データ', ky:'CSV жүктөө — бардык максаттардын учурдагы маалыматы', 'zh-Hant':'下載 CSV — 所有目標的目前資料' },
  pw_notify: { bg:'Известие на телефона при промяна', ru:'Уведомление на телефон при изменении', uk:'Сповіщення на телефон при зміні', en:'Phone notification on change', de:'Telefon-Benachrichtigung bei Änderung', fr:'Notification sur le téléphone en cas de changement', es:'Notificación en el teléfono al cambiar', 'es-MX':'Notificación en el teléfono al cambiar', it:'Notifica sul telefono in caso di modifica', pt:'Notificação no telemóvel ao mudar', ar:'إشعار على الهاتف عند التغيير', hi:'बदलाव पर फ़ोन सूचना', ja:'変更時に端末へ通知', ky:'Өзгөрүүдө телефонго билдирүү', 'zh-Hant':'變更時手機通知' },
  pw_notify_hint: { bg:'Когато сканиране намери нещо ново, изчезнало или променено, апът изпраща известие на телефона (иска разрешение при включване).', ru:'Когда сканирование находит новое, исчезнувшее или изменённое, приложение отправляет уведомление на телефон (запрашивает разрешение при включении).', uk:'Коли сканування знаходить нове, зникле або змінене, застосунок надсилає сповіщення на телефон (просить дозвіл при увімкненні).', en:'When a scan finds something new, gone or changed, the app sends a phone notification (asks for permission when enabled).', de:'Findet ein Scan etwas Neues, Verschwundenes oder Geändertes, sendet die App eine Benachrichtigung (fragt beim Einschalten nach Erlaubnis).', fr:'Quand un scan trouve du nouveau, du disparu ou du modifié, l’app envoie une notification (demande l’autorisation à l’activation).', es:'Cuando un escaneo encuentra algo nuevo, desaparecido o cambiado, la app envía una notificación (pide permiso al activarlo).', 'es-MX':'Cuando un escaneo encuentra algo nuevo, desaparecido o cambiado, la app envía una notificación (pide permiso al activarlo).', it:'Quando una scansione trova qualcosa di nuovo, sparito o cambiato, l’app invia una notifica (chiede il permesso all’attivazione).', pt:'Quando uma análise encontra algo novo, desaparecido ou alterado, a app envia uma notificação (pede permissão ao ativar).', ar:'عندما يجد الفحص شيئاً جديداً أو مختفياً أو متغيّراً، يرسل التطبيق إشعاراً (يطلب الإذن عند التفعيل).', hi:'जब स्कैन में कुछ नया, गायब या बदला मिलता है, ऐप फ़ोन सूचना भेजता है (चालू करने पर अनुमति माँगता है)।', ja:'スキャンで新規・消滅・変更が見つかると通知を送ります（有効化時に許可を求めます）。', ky:'Скандоо жаңы, жоголгон же өзгөргөн нерсе тапканда колдонмо билдирүү жөнөтөт (күйгүзгөндө уруксат сурайт).', 'zh-Hant':'掃描發現新增、消失或變更時，應用程式會發送通知（啟用時會請求權限）。' },
  pgw_notif_title: { bg:'Промяна в наблюдавана страница', ru:'Изменение на отслеживаемой странице', uk:'Зміна на відстежуваній сторінці', en:'Watched page changed', de:'Beobachtete Seite geändert', fr:'Page surveillée modifiée', es:'Página vigilada cambió', 'es-MX':'Página vigilada cambió', it:'Pagina monitorata cambiata', pt:'Página vigiada mudou', ar:'تغيّرت صفحة مراقبة', hi:'निगरानी वाला पेज बदला', ja:'監視ページが変更', ky:'Байкалган барак өзгөрдү', 'zh-Hant':'監看頁面已變更' },
  pw_scan_done: { bg:'Готово: {0}', ru:'Готово: {0}', uk:'Готово: {0}', en:'Done: {0}', de:'Fertig: {0}', fr:'Terminé : {0}', es:'Listo: {0}', 'es-MX':'Listo: {0}', it:'Fatto: {0}', pt:'Pronto: {0}', ar:'تم: {0}', hi:'हो गया: {0}', ja:'完了: {0}', ky:'Даяр: {0}', 'zh-Hant':'完成：{0}' },
  pw_offline_note: { bg:'Примерните страници са вградени в апа и се сканират и без интернет.', ru:'Примерные страницы встроены в приложение и сканируются и без интернета.', uk:'Приклади сторінок вбудовані в застосунок і скануються і без інтернету.', en:'The sample pages are built into the app and scan without internet too.', de:'Die Beispielseiten sind in der App eingebaut und werden auch offline gescannt.', fr:'Les pages d’exemple sont intégrées à l’app et se scannent aussi hors ligne.', es:'Las páginas de ejemplo están integradas en la app y se escanean también sin conexión.', 'es-MX':'Las páginas de ejemplo están integradas en la app y se escanean también sin conexión.', it:'Le pagine di esempio sono integrate nell’app e si scansionano anche offline.', pt:'As páginas de exemplo estão incorporadas na app e analisam-se também offline.', ar:'الصفحات النموذجية مدمجة في التطبيق وتُفحص دون إنترنت أيضاً.', hi:'नमूना पेज ऐप में अंतर्निहित हैं और बिना इंटरनेट भी स्कैन होते हैं।', ja:'サンプルページはアプリに内蔵され、オフラインでもスキャンできます。', ky:'Мисал барактар колдонмого орнотулган жана интернетсиз да сканданат.', 'zh-Hant':'範例頁面內建於應用程式，離線也能掃描。' },
  pw_items: { bg:'{0} записа', ru:'{0} записей', uk:'{0} записів', en:'{0} items', de:'{0} Einträge', fr:'{0} éléments', es:'{0} elementos', 'es-MX':'{0} elementos', it:'{0} elementi', pt:'{0} itens', ar:'{0} عناصر', hi:'{0} आइटम', ja:'{0} 件', ky:'{0} жазуу', 'zh-Hant':'{0} 項' },
  pw_sample_clinic: { bg:'Пример: зъболекарска клиника (контакти и цени)', ru:'Пример: стоматологическая клиника (контакты и цены)', uk:'Приклад: стоматологічна клініка (контакти й ціни)', en:'Sample: dental clinic (contacts and prices)', de:'Beispiel: Zahnklinik (Kontakte und Preise)', fr:'Exemple : clinique dentaire (contacts et prix)', es:'Ejemplo: clínica dental (contactos y precios)', 'es-MX':'Ejemplo: clínica dental (contactos y precios)', it:'Esempio: clinica dentale (contatti e prezzi)', pt:'Exemplo: clínica dentária (contactos e preços)', ar:'مثال: عيادة أسنان (جهات اتصال وأسعار)', hi:'नमूना: डेंटल क्लिनिक (संपर्क और कीमतें)', ja:'サンプル：歯科クリニック（連絡先と価格）', ky:'Мисал: тиш клиникасы (байланыш жана баалар)', 'zh-Hant':'範例：牙科診所（聯絡資訊與價格）' },
  pw_sample_shop: { bg:'Пример: онлайн магазин (цени на слушалки)', ru:'Пример: интернет-магазин (цены на наушники)', uk:'Приклад: інтернет-магазин (ціни на навушники)', en:'Sample: online shop (headphone prices)', de:'Beispiel: Online-Shop (Kopfhörerpreise)', fr:'Exemple : boutique en ligne (prix des casques)', es:'Ejemplo: tienda en línea (precios de auriculares)', 'es-MX':'Ejemplo: tienda en línea (precios de audífonos)', it:'Esempio: negozio online (prezzi delle cuffie)', pt:'Exemplo: loja online (preços de auscultadores)', ar:'مثال: متجر إلكتروني (أسعار سماعات)', hi:'नमूना: ऑनलाइन दुकान (हेडफ़ोन की कीमतें)', ja:'サンプル：オンラインショップ（ヘッドホン価格）', ky:'Мисал: онлайн дүкөн (кулакчын баалары)', 'zh-Hant':'範例：網路商店（耳機價格）' }
});

export const title = t('t_pwatch_name');

const LS = 'pupikes.scraper.watch.v1';
const KINDS = ['emails', 'phones', 'prices', 'titles'];
const KLABEL = { emails: 'pw_k_emails', phones: 'pw_k_phones', prices: 'pw_k_prices', titles: 'pw_k_titles' };
const MAX_HISTORY = 60;

// ── Съхранение ───────────────────────────────────────────────────────────────
function load() {
  try { const s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s && Array.isArray(s.targets)) return s; } catch (_) {}
  const s = { targets: [], notify: false, seeded: false };
  return s;
}
function save(st) { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (_) {} }
const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const D = 86400000;

// Примерни цели: 2 вградени страници + история от 2 предишни сканирания (ясно маркирани „пример").
// Стойностите са като в public/samples/*.html, но с малки разлики → „Сканирай" показва реални промени.
function sampleTargets() {
  const now = Date.now();
  const clinicA = { emails: ['info@northwind-dental.example', 'reception@northwind-dental.example'], phones: ['+44 20 7946 0958'],
    prices: [{ label: 'Consultation', value: '£40' }, { label: 'Hygiene visit', value: '£65' }, { label: 'Teeth whitening', value: '£199' }],
    titles: ['Northwind Dental Clinic — Contact', 'Contact Northwind Dental Clinic', 'Opening hours', 'Prices', 'Our team', 'Dr. Elena Marsh', 'Get in touch'] };
  const clinicB = { emails: ['info@northwind-dental.example', 'booking@northwind-dental.example'], phones: ['+44 20 7946 0958', '+44 7700 900123'],
    prices: [{ label: 'Consultation', value: '£45' }, { label: 'Hygiene visit', value: '£65' }, { label: 'Teeth whitening', value: '£199' }],
    titles: ['Northwind Dental Clinic — Contact', 'Contact Northwind Dental Clinic', 'Opening hours', 'Prices', 'Our team', 'Dr. Elena Marsh', 'Dr. Tomas Reyes', 'Get in touch'] };
  const shopA = { emails: ['support@pupikes-store.example'], phones: ['+359 2 123 4567'],
    prices: [{ label: 'AeroBuds Pro', value: '€139' }, { label: 'StudioMax 2', value: '€249' }, { label: 'RunLite Sport', value: '€59' }, { label: 'Shipping', value: '€4.90' }],
    titles: ['Pupikes Demo Store — Wireless headphones', 'Wireless headphones', 'AeroBuds Pro', 'StudioMax 2', 'RunLite Sport', 'Delivery', 'Customer service'] };
  const shopB = { emails: ['support@pupikes-store.example'], phones: ['+359 2 123 4567'],
    prices: [{ label: 'AeroBuds Pro', value: '€129' }, { label: 'StudioMax 2', value: '€249' }, { label: 'RunLite Sport', value: '€59' }, { label: 'QuietOne ANC', value: '€199' }, { label: 'Shipping', value: '€4.90' }],
    titles: ['Pupikes Demo Store — Wireless headphones', 'Wireless headphones', 'AeroBuds Pro', 'StudioMax 2', 'RunLite Sport', 'QuietOne ANC', 'Delivery', 'Customer service'] };
  const mk = (id, nameKey, url, kinds, a, b, dA, dB) => ({ id, nameKey, name: '', url, kinds, sample: true, created: now - dA,
    history: [{ ts: now - dA, snap: a, diff: null }, { ts: now - dB, snap: b, diff: diffSnaps(a, b, kinds) }] });
  return [
    mk('sample-clinic', 'pw_sample_clinic', SAMPLE_PAGES[0], ['emails', 'phones', 'prices', 'titles'], clinicA, clinicB, 6 * D + 3600000 * 5, 2 * D + 3600000 * 2),
    mk('sample-shop', 'pw_sample_shop', SAMPLE_PAGES[1], ['prices', 'titles', 'emails'], shopA, shopB, 4 * D + 3600000 * 7, 1 * D + 3600000 * 3)
  ];
}
function ensureSeed(st) { if (!st.seeded && !st.targets.length) { st.targets = sampleTargets(); st.seeded = true; save(st); } }
const tname = (tg) => tg.name || (tg.nameKey ? t(tg.nameKey) : '') || tg.url;

// ── Извличане на цени: „етикет → стойност" (етикетът е текстът в същия блок преди цената, иначе най-близкото заглавие) ──
const PRICE_RE = /(?:(?:[$€£₽₴¥₹]|USD|EUR|GBP|BGN|RUB|UAH|JPY|INR|CNY|лв\.?|руб\.?|грн\.?)\s?\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})?|\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})?\s?(?:[$€£₽₴¥₹]|USD|EUR|GBP|BGN|RUB|UAH|JPY|INR|CNY|лв\.?|руб\.?|грн\.?|€))/g;
export function extractPrices(html) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<head[\s\S]*?<\/head>/gi, ' ');
  // блокови граници → „¶", заглавия → „¶§…¶" (за етикет на цена, която стои сама в блок)
  const marked = noScript.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (m, x) => '¶§' + x.replace(/<[^>]+>/g, ' ') + '¶')
    .replace(/<\/(p|li|tr|td|th|div|section|article|dt|dd|label|span)>|<br\s*\/?>/gi, '¶').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t\r\n]+/g, ' ');
  const blocks = marked.split('¶').map((b) => b.trim());
  const out = []; const seen = new Set();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]; if (!b || b[0] === '§' && !PRICE_RE.test(b)) { PRICE_RE.lastIndex = 0; continue; }
    PRICE_RE.lastIndex = 0; let m, prev = 0;
    while ((m = PRICE_RE.exec(b))) {
      let label = b.slice(prev, m.index).replace(/^§/, '').replace(/[\s—–\-:•·|,;]+$/g, '').trim();
      if (!label) { for (let j = i - 1; j >= 0 && j > i - 6; j--) { if (blocks[j][0] === '§') { label = blocks[j].slice(1).trim(); break; } } }
      if (!label) { for (let j = i - 1; j >= 0 && j > i - 3; j--) { if (blocks[j] && !PRICE_RE.test(blocks[j])) { label = blocks[j].replace(/^§/, '').trim(); PRICE_RE.lastIndex = 0; break; } PRICE_RE.lastIndex = 0; } }
      label = (label || '#' + (out.length + 1)).slice(0, 40);
      const value = m[0].replace(/\s+/g, '');
      const key = label + '=' + value; if (!seen.has(key)) { seen.add(key); out.push({ label, value }); }
      prev = m.index + m[0].length; if (out.length >= 60) return out;
    }
  }
  return out;
}

// ── Снимка на страница по избраните видове ───────────────────────────────────
function makeSnap(html, url, kinds) {
  const r = extract(html, url); const snap = {};
  if (kinds.includes('emails')) snap.emails = r.emails;
  if (kinds.includes('phones')) snap.phones = r.phones;
  if (kinds.includes('prices')) snap.prices = extractPrices(html);
  if (kinds.includes('titles')) snap.titles = Array.from(new Set([r.title].concat(r.heads).filter(Boolean))).slice(0, 30);
  return snap;
}
// Разлика между две снимки: ново / изчезнало / променено (цените се съпоставят по етикет).
export function diffSnaps(a, b, kinds) {
  const added = [], removed = [], changed = [];
  for (const k of kinds) {
    if (k === 'prices') {
      const pa = (a && a.prices) || [], pb = (b && b.prices) || [];
      const ma = new Map(pa.map((p) => [p.label, p.value])), mb = new Map(pb.map((p) => [p.label, p.value]));
      for (const [l, v] of mb) { if (!ma.has(l)) added.push({ kind: k, value: l + ': ' + v }); else if (ma.get(l) !== v) changed.push({ kind: k, label: l, from: ma.get(l), to: v }); }
      for (const [l, v] of ma) if (!mb.has(l)) removed.push({ kind: k, value: l + ': ' + v });
    } else {
      const sa = new Set((a && a[k]) || []), sb = new Set((b && b[k]) || []);
      for (const v of sb) if (!sa.has(v)) added.push({ kind: k, value: v });
      for (const v of sa) if (!sb.has(v)) removed.push({ kind: k, value: v });
    }
  }
  return { added, removed, changed };
}
const hasChanges = (d) => !!d && (d.added.length + d.removed.length + d.changed.length) > 0;
const cnt = (snap, k) => ((snap && snap[k]) || []).length;

// Сваляне: вградените примери → локално; чужди → направо, при неуспех през relay.
async function fetchPage(url) {
  if (isLocalPage(url)) return getText(url, false);
  try { return await getText(url, false); } catch (_) { return await getText(url, true); }
}

// ── Известия (като pricewatch: Capacitor LocalNotifications, иначе Web Notifications) ──
function getLN() { try { const c = window.Capacitor; return (c && c.Plugins && c.Plugins.LocalNotifications) || null; } catch (_) { return null; } }
async function askNotifPermission() {
  const ln = getLN();
  if (ln) { try { const r = await ln.requestPermissions(); return !r || r.display !== 'denied'; } catch (_) { return false; } }
  if (typeof Notification !== 'undefined') { try { return (await Notification.requestPermission()) === 'granted'; } catch (_) { return false; } }
  return false;
}
async function notify(title, body) {
  const ln = getLN();
  if (ln) { try { await ln.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e6), title, body }] }); return; } catch (_) {} }
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body }); } catch (_) {}
}

// Едно сканиране на цел: сваля → снимка → разлика с последната → в историята → известие при промяна.
async function scanTarget(st, tg) {
  const html = await fetchPage(tg.url);
  const snap = makeSnap(html, tg.url, tg.kinds);
  const last = tg.history.length ? tg.history[tg.history.length - 1].snap : null;
  const diff = last ? diffSnaps(last, snap, tg.kinds) : null;
  tg.history.push({ ts: Date.now(), snap, diff });
  if (tg.history.length > MAX_HISTORY) tg.history.splice(0, tg.history.length - MAX_HISTORY);
  save(st);
  if (st.notify && hasChanges(diff)) notify(t('pgw_notif_title'), tname(tg) + ' — ' + summary(diff));
  return diff;
}
const summary = (d) => hasChanges(d) ? tf('pw_summary', d.added.length, d.removed.length, d.changed.length) : t('pw_nochange');
const fmtTs = (ts) => { try { return new Date(ts).toLocaleString(getLang()); } catch (_) { return new Date(ts).toLocaleString(); } };
const entrySummary = (e) => e.diff ? summary(e.diff) : tf('pw_first', cnt(e.snap, 'emails'), cnt(e.snap, 'phones'), cnt(e.snap, 'prices'), cnt(e.snap, 'titles'));

// HTML на разликата (списъци ново/изчезнало/променено)
function diffHTML(d) {
  if (!hasChanges(d)) return `<div class="hint">${esc(t('pw_nochange'))}</div>`;
  const li = (cls, sign, txt) => `<div class="pw-d ${cls}"><b>${sign}</b> ${esc(txt)}</div>`;
  return d.added.map((x) => li('pw-add', '+', t(KLABEL[x.kind]) + ': ' + x.value)).join('') +
    d.removed.map((x) => li('pw-rm', '−', t(KLABEL[x.kind]) + ': ' + x.value)).join('') +
    d.changed.map((x) => li('pw-ch', '~', t(KLABEL[x.kind]) + ': ' + x.label + ' ' + x.from + ' → ' + x.to)).join('');
}
function snapHTML(snap, kinds) {
  return kinds.map((k) => { const arr = (snap && snap[k]) || []; return `<div style="margin-top:6px"><b>${esc(t(KLABEL[k]))}</b> <span class="hint">(${esc(tf('pw_items', arr.length))})</span><div class="hint" style="margin-top:2px">${arr.length ? arr.map((v) => esc(typeof v === 'string' ? v : v.label + ': ' + v.value)).join(' · ') : '—'}</div></div>`; }).join('');
}

const CSS = `<style>
.pw-tabs{display:flex;gap:6px;margin-bottom:10px}.pw-tabs .tab{margin:0}
.pw-card{padding:10px;margin:8px 0;border:1px solid rgba(127,127,127,.35);border-radius:10px}
.pw-badge{font-size:.72em;padding:1px 7px;border-radius:8px;background:rgba(210,153,34,.25);vertical-align:middle;margin-inline-start:6px}
.pw-chip{display:inline-block;font-size:.75em;padding:2px 7px;border-radius:8px;background:var(--bg-3);margin:2px 3px 0 0}
.pw-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pw-btns .btn{margin-top:0;width:auto;padding:8px 12px;font-size:.88em}
.pw-d{padding:3px 6px;margin:3px 0;border-radius:6px;font-size:.88em}.pw-add{background:rgba(46,160,67,.18)}.pw-rm{background:rgba(248,81,73,.18)}.pw-ch{background:rgba(210,153,34,.2)}
.pw-entry{padding:8px 10px;margin:6px 0;border-inline-start:3px solid var(--accent);background:var(--bg)}
.pw-banner{padding:9px 11px;border-radius:10px;background:rgba(210,153,34,.14);border:1px solid rgba(210,153,34,.4);font-size:.86em;margin-bottom:8px}
.pw-sum{font-size:.86em;margin-top:4px}
</style>`;

export function render(root) {
  const st = load(); ensureSeed(st);
  let tab = 'targets', histId = (st.targets[0] || {}).id || '';
  root.innerHTML = `${CSS}<div class="tool-card"><p class="hint" style="margin-top:0">${esc(t('pw_hint'))}</p>
    <div class="pw-tabs tabs" id="pw-tabs"><button class="tab active" data-tab="targets">${esc(t('pw_tab_targets'))}</button><button class="tab" data-tab="history">${esc(t('pw_tab_history'))}</button><button class="tab" data-tab="export">${esc(t('pw_tab_export'))}</button></div>
    <div class="status" id="pw-status"></div>
    <div id="pw-body"></div></div>`;
  const $ = (s) => root.querySelector(s);
  const status = (kind, msg) => { const n = $('#pw-status'); n.className = 'status ' + (msg ? 'show ' + kind : ''); n.textContent = msg || ''; };
  root.querySelectorAll('#pw-tabs .tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; root.querySelectorAll('#pw-tabs .tab').forEach((x) => x.classList.toggle('active', x === b)); draw(); }));

  async function runScan(list) {
    for (const tg of list) {
      status('work', tf('pw_scanning', tname(tg)));
      try { const d = await scanTarget(st, tg); status('ok', tf('pw_scan_done', tname(tg) + ' — ' + (d ? summary(d) : entrySummary(tg.history[tg.history.length - 1])))); }
      catch (_) { status('err', tname(tg) + ': ' + t('pw_fail')); }
    }
    draw();
  }

  function drawTargets(body) {
    const samples = st.targets.filter((x) => x.sample);
    body.innerHTML = `
      ${samples.length ? `<div class="pw-banner">${esc(t('pw_sample_banner'))} ${esc(t('pw_offline_note'))}<div class="pw-btns"><button class="btn sec" id="pw-del-samples">${esc(t('pw_del_samples'))}</button></div></div>` : ''}
      ${st.targets.length ? `<button class="btn" id="pw-scan-all" style="margin-top:0">${esc(t('pw_scan_all'))}</button>` : `<div class="hint">${esc(t('pw_no_targets'))}</div><button class="btn sec" id="pw-add-samples">${esc(t('pw_add_samples'))}</button>`}
      <div id="pw-list">${st.targets.map((tg) => { const last = tg.history[tg.history.length - 1]; return `
        <div class="pw-card" data-id="${esc(tg.id)}"><div><b>${esc(tname(tg))}</b>${tg.sample ? `<span class="pw-badge">${esc(t('pw_sample_badge'))}</span>` : ''}</div>
          <div class="hint" style="margin-top:2px;word-break:break-all">${esc(tg.url)}</div>
          <div>${tg.kinds.map((k) => `<span class="pw-chip">${esc(t(KLABEL[k]))}</span>`).join('')}</div>
          <div class="pw-sum">${last ? `${esc(tf('pgw_last', fmtTs(last.ts)))}<br><b>${esc(entrySummary(last))}</b>` : esc(t('pw_never'))}</div>
          <div class="pw-btns"><button class="btn" data-act="scan">${esc(t('pw_scan'))}</button><button class="btn sec" data-act="hist">${esc(t('pw_tab_history'))}</button><button class="btn sec" data-act="del">${esc(t('pw_delete'))}</button></div></div>`; }).join('')}</div>
      <div class="pw-card" style="margin-top:14px"><b>${esc(t('pw_add_title'))}</b>
        <label>${esc(t('pw_url'))}</label><input type="url" id="pw-url" placeholder="https://example.org/contact" autocomplete="off" />
        <label>${esc(t('pw_name'))}</label><input type="text" id="pw-name" autocomplete="off" />
        <label>${esc(t('pw_kinds'))}</label>
        ${KINDS.map((k) => `<label class="check"><input type="checkbox" class="pw-kind" value="${k}" ${k !== 'titles' ? 'checked' : ''} /> ${esc(t(KLABEL[k]))}</label>`).join('')}
        <button class="btn" id="pw-add">${esc(t('pw_add_go'))}</button></div>`;
    const del = $('#pw-del-samples'); if (del) del.addEventListener('click', () => { st.targets = st.targets.filter((x) => !x.sample); save(st); draw(); });
    const adds = $('#pw-add-samples'); if (adds) adds.addEventListener('click', () => { st.targets = st.targets.concat(sampleTargets()); save(st); draw(); });
    const all = $('#pw-scan-all'); if (all) all.addEventListener('click', () => runScan(st.targets.slice()));
    body.querySelectorAll('.pw-card[data-id] .btn').forEach((b) => b.addEventListener('click', () => {
      const tg = st.targets.find((x) => x.id === b.closest('.pw-card').dataset.id); if (!tg) return;
      if (b.dataset.act === 'scan') runScan([tg]);
      else if (b.dataset.act === 'del') { st.targets = st.targets.filter((x) => x !== tg); save(st); draw(); }
      else { histId = tg.id; tab = 'history'; root.querySelectorAll('#pw-tabs .tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'history')); draw(); }
    }));
    $('#pw-add').addEventListener('click', () => {
      let url = $('#pw-url').value.trim(); const kinds = Array.from(body.querySelectorAll('.pw-kind:checked')).map((c) => c.value);
      if (!url) { status('err', t('pw_need_url')); return; }
      if (!kinds.length) { status('err', t('pw_need_kind')); return; }
      if (!/^https?:\/\//i.test(url) && !/^samples\//.test(url)) url = 'https://' + url;
      const tg = { id: uid(), name: $('#pw-name').value.trim(), url, kinds, sample: false, created: Date.now(), history: [] };
      st.targets.push(tg); save(st); histId = tg.id; runScan([tg]);
    });
  }

  function drawHistory(body) {
    if (!st.targets.length) { body.innerHTML = `<div class="hint">${esc(t('pw_no_targets'))}</div>`; return; }
    if (!st.targets.some((x) => x.id === histId)) histId = st.targets[0].id;
    const tg = st.targets.find((x) => x.id === histId); const h = tg.history;
    const opt = (e, i) => `<option value="${i}">${esc(fmtTs(e.ts))}</option>`;
    body.innerHTML = `<label>${esc(t('pw_pick_target'))}</label><select id="pw-sel">${st.targets.map((x) => `<option value="${esc(x.id)}" ${x.id === histId ? 'selected' : ''}>${esc(tname(x))}</option>`).join('')}</select>
      <div class="pw-btns"><button class="btn" id="pw-h-scan">${esc(t('pw_scan'))}</button></div>
      ${!h.length ? `<div class="hint" style="margin-top:10px">${esc(t('pw_no_history'))}</div>` : `
      <div class="pw-card"><b>${esc(t('pw_current'))}</b><div class="hint">${esc(fmtTs(h[h.length - 1].ts))}</div>${snapHTML(h[h.length - 1].snap, tg.kinds)}</div>
      <div class="pw-card"><b>${esc(t('pw_timeline'))}</b>${h.slice().reverse().map((e) => `<div class="pw-entry"><div class="hint">${esc(fmtTs(e.ts))}</div><div><b>${esc(entrySummary(e))}</b></div>${e.diff ? diffHTML(e.diff) : ''}</div>`).join('')}</div>
      ${h.length > 1 ? `<div class="pw-card"><b>${esc(t('pw_compare'))}</b><div class="row"><div><label>${esc(t('pw_cmp_a'))}</label><select id="pw-a">${h.map(opt).join('')}</select></div><div><label>${esc(t('pw_cmp_b'))}</label><select id="pw-b">${h.map(opt).join('')}</select></div></div>
        <button class="btn sec" id="pw-cmp">${esc(t('pw_cmp_go'))}</button><div id="pw-cmp-out" style="margin-top:8px"></div></div>` : ''}`}`;
    $('#pw-sel').addEventListener('change', (e) => { histId = e.target.value; draw(); });
    $('#pw-h-scan').addEventListener('click', () => runScan([tg]));
    const cmp = $('#pw-cmp');
    if (cmp) { $('#pw-a').value = String(Math.max(0, h.length - 2)); $('#pw-b').value = String(h.length - 1);
      cmp.addEventListener('click', () => { const a = h[+$('#pw-a').value], b = h[+$('#pw-b').value]; $('#pw-cmp-out').innerHTML = diffHTML(diffSnaps(a.snap, b.snap, tg.kinds)); }); }
  }

  function drawExport(body) {
    body.innerHTML = `<label class="check"><input type="checkbox" id="pw-notify" ${st.notify ? 'checked' : ''} /> ${esc(t('pw_notify'))}</label><div class="hint">${esc(t('pw_notify_hint'))}</div>
      <button class="btn" id="pw-csv-hist">${esc(t('pw_csv_hist'))}</button><button class="btn sec" id="pw-csv-now">${esc(t('pw_csv_now'))}</button>`;
    $('#pw-notify').addEventListener('change', async (e) => { if (e.target.checked) { const ok = await askNotifPermission(); st.notify = ok; e.target.checked = ok; } else st.notify = false; save(st); });
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    $('#pw-csv-hist').addEventListener('click', () => {
      const rows = ['target;url;date;kind;change;label;from;to'];
      for (const tg of st.targets) for (const e of tg.history) {
        if (!e.diff) { rows.push([tname(tg), tg.url, fmtTs(e.ts), '', 'first', '', '', ''].map(q).join(';')); continue; }
        e.diff.added.forEach((x) => rows.push([tname(tg), tg.url, fmtTs(e.ts), x.kind, 'new', '', '', x.value].map(q).join(';')));
        e.diff.removed.forEach((x) => rows.push([tname(tg), tg.url, fmtTs(e.ts), x.kind, 'gone', '', x.value, ''].map(q).join(';')));
        e.diff.changed.forEach((x) => rows.push([tname(tg), tg.url, fmtTs(e.ts), x.kind, 'changed', x.label, x.from, x.to].map(q).join(';')));
      }
      downloadBlob(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv' }), 'page-watch-history.csv', 'text/csv');
    });
    $('#pw-csv-now').addEventListener('click', () => {
      const rows = ['target;url;date;kind;label;value'];
      for (const tg of st.targets) { const e = tg.history[tg.history.length - 1]; if (!e) continue;
        for (const k of tg.kinds) ((e.snap[k]) || []).forEach((v) => rows.push([tname(tg), tg.url, fmtTs(e.ts), k, typeof v === 'string' ? '' : v.label, typeof v === 'string' ? v : v.value].map(q).join(';'))); }
      downloadBlob(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv' }), 'page-watch-current.csv', 'text/csv');
    });
  }

  function draw() { const body = $('#pw-body'); if (tab === 'targets') drawTargets(body); else if (tab === 'history') drawHistory(body); else drawExport(body); }
  draw();
}
