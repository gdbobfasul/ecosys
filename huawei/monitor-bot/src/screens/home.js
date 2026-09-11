// Version: 1.0029
// home.js — ПЪРВИ ЕКРАН „Общ преглед" (Huawei 4.1, 11.09.2026): табло с ВСИЧКИТЕ инструменти на едно
// място — 6-те от „Инструменти" (Достъпност, SSL, Цена, Промени, Табло, Пренос) + търсене + ежедневните
// наблюдатели + RSS/JSON мониторите + каталога — всяка карта с 1–2 реда живо съдържание от пазените
// данни (при чиста инсталация — от примерите, виж core/samples.js). Докосване на карта → съответния екран/таб.
// БЕЗ мрежа при рисуване: всичко идва от локалното хранилище; единствено „Търси сега" е ръчно действие.
import { el, fmtTime } from '../ui/styles.js';
import { getLang } from '../core/i18n.js';
import { saveState } from '../core/storage.js';
import { searchAllNow } from '../core/scheduler.js';
import { loadTools, upStats } from './tools.js';
import { LSK_SITES, hasSamples, removeSamples, addSamples, sampleLabel } from '../core/samples.js';
import { OUTLETS } from '../data/rss-directory.js';

// ── 15-езичен локален речник ──
const L = {
  title:     { bg:'Общ преглед', ru:'Обзор', uk:'Огляд', en:'Overview', de:'Überblick', fr:'Vue d\'ensemble', es:'Resumen', 'es-MX':'Resumen', it:'Panoramica', pt:'Visão geral', ar:'نظرة عامة', hi:'अवलोकन', ja:'概要', ky:'Жалпы көрүнүш', 'zh-Hant':'總覽' },
  subtitle:  { bg:'Всичко следено с един поглед — сайтове, сертификати, цени, промени в страници, новинарски емисии и ежедневни наблюдатели.', ru:'Всё отслеживаемое одним взглядом — сайты, сертификаты, цены, изменения страниц, новостные ленты и ежедневные наблюдатели.', uk:'Усе відстежуване одним поглядом — сайти, сертифікати, ціни, зміни сторінок, стрічки новин і щоденні спостерігачі.', en:'Everything you watch at a glance — sites, certificates, prices, page changes, news feeds and daily watches.', de:'Alles Überwachte auf einen Blick — Seiten, Zertifikate, Preise, Seitenänderungen, Nachrichten-Feeds und tägliche Wächter.', fr:'Tout ce que vous surveillez en un coup d\'œil — sites, certificats, prix, changements de pages, flux d\'actualités et veilles quotidiennes.', es:'Todo lo que vigilas de un vistazo: sitios, certificados, precios, cambios de páginas, fuentes de noticias y vigilancias diarias.', 'es-MX':'Todo lo que vigilas de un vistazo: sitios, certificados, precios, cambios de páginas, fuentes de noticias y vigilancias diarias.', it:'Tutto ciò che monitori a colpo d\'occhio: siti, certificati, prezzi, modifiche alle pagine, feed di notizie e controlli giornalieri.', pt:'Tudo o que segue num relance — sites, certificados, preços, alterações de páginas, feeds de notícias e vigilâncias diárias.', ar:'كل ما تراقبه بنظرة واحدة — المواقع والشهادات والأسعار وتغييرات الصفحات وخلاصات الأخبار والمراقبات اليومية.', hi:'एक नज़र में सब कुछ — साइटें, प्रमाणपत्र, कीमतें, पेज बदलाव, न्यूज़ फ़ीड और दैनिक निगरानी।', ja:'監視中のすべてを一目で — サイト、証明書、価格、ページの変更、ニュースフィード、毎日の監視。', ky:'Көзөмөлдөгөндүн баары бир караганда — сайттар, сертификаттар, баалар, барак өзгөрүүлөрү, жаңылык агымдары жана күндөлүк байкоочулар.', 'zh-Hant':'一眼掌握所有監控項目 — 網站、憑證、價格、頁面變更、新聞訂閱與每日監看。' },
  smp_note:  { bg:'Примерни данни: 5 примерни сайта с генерирана история за 14 дни, за да видиш приложението в действие веднага. Махни ги, когато решиш.', ru:'Примерные данные: 5 сайтов-примеров с сгенерированной историей за 14 дней, чтобы сразу увидеть приложение в работе. Удалите их, когда захотите.', uk:'Приклади даних: 5 сайтів-прикладів зі згенерованою історією за 14 днів, щоб одразу побачити застосунок у роботі. Видаліть їх, коли захочете.', en:'Sample data: 5 example sites with 14 days of generated history, so you can see the app at work right away. Remove them whenever you like.', de:'Beispieldaten: 5 Beispielseiten mit 14 Tagen generierter Historie, damit du die App sofort in Aktion siehst. Entferne sie jederzeit.', fr:'Données d\'exemple : 5 sites d\'exemple avec 14 jours d\'historique généré, pour voir l\'application à l\'œuvre tout de suite. Supprimez-les quand vous voulez.', es:'Datos de ejemplo: 5 sitios de ejemplo con 14 días de historial generado para ver la app en acción de inmediato. Elimínalos cuando quieras.', 'es-MX':'Datos de ejemplo: 5 sitios de ejemplo con 14 días de historial generado para ver la app en acción de inmediato. Elimínalos cuando quieras.', it:'Dati di esempio: 5 siti di esempio con 14 giorni di cronologia generata, per vedere subito l\'app in azione. Rimuovili quando vuoi.', pt:'Dados de exemplo: 5 sites de exemplo com 14 dias de histórico gerado, para ver a app a funcionar de imediato. Remova-os quando quiser.', ar:'بيانات نموذجية: 5 مواقع مثال مع سجل مُولَّد لمدة 14 يومًا لترى التطبيق يعمل فورًا. احذفها متى شئت.', hi:'नमूना डेटा: 5 उदाहरण साइटें 14 दिनों के जनरेट किए इतिहास के साथ, ताकि ऐप को तुरंत काम करते देखें। जब चाहें हटा दें।', ja:'サンプルデータ：14日分の生成履歴付きのサンプルサイト5件。すぐにアプリの動作を確認できます。いつでも削除できます。', ky:'Үлгү маалымат: 14 күндүк түзүлгөн тарыхы бар 5 үлгү сайт — колдонмону дароо иш үстүндө көрүү үчүн. Каалаган убакта өчүрүңүз.', 'zh-Hant':'範例資料：5 個範例網站與 14 天生成的歷史，讓你立即看到 App 的運作。隨時可以移除。' },
  smp_remove:{ bg:'Махни примерите', ru:'Удалить примеры', uk:'Видалити приклади', en:'Remove samples', de:'Beispiele entfernen', fr:'Supprimer les exemples', es:'Quitar ejemplos', 'es-MX':'Quitar ejemplos', it:'Rimuovi esempi', pt:'Remover exemplos', ar:'إزالة الأمثلة', hi:'नमूने हटाएँ', ja:'サンプルを削除', ky:'Үлгүлөрдү өчүрүү', 'zh-Hant':'移除範例' },
  smp_add:   { bg:'Върни примерите', ru:'Вернуть примеры', uk:'Повернути приклади', en:'Add samples again', de:'Beispiele wieder hinzufügen', fr:'Remettre les exemples', es:'Volver a añadir ejemplos', 'es-MX':'Volver a agregar ejemplos', it:'Riaggiungi esempi', pt:'Repor exemplos', ar:'إعادة الأمثلة', hi:'नमूने फिर जोड़ें', ja:'サンプルを再追加', ky:'Үлгүлөрдү кайра кошуу', 'zh-Hant':'重新加入範例' },
  search_t:  { bg:'Търсене', ru:'Поиск', uk:'Пошук', en:'Search', de:'Suche', fr:'Recherche', es:'Búsqueda', 'es-MX':'Búsqueda', it:'Ricerca', pt:'Pesquisa', ar:'بحث', hi:'खोज', ja:'検索', ky:'Издөө', 'zh-Hant':'搜尋' },
  search_ph: { bg:'дума или израз във всички новини…', ru:'слово или фраза во всех новостях…', uk:'слово або фраза в усіх новинах…', en:'a word or phrase in all news…', de:'ein Wort oder Ausdruck in allen Nachrichten…', fr:'un mot ou une expression dans toutes les actualités…', es:'una palabra o frase en todas las noticias…', 'es-MX':'una palabra o frase en todas las noticias…', it:'una parola o frase in tutte le notizie…', pt:'uma palavra ou frase em todas as notícias…', ar:'كلمة أو عبارة في كل الأخبار…', hi:'सभी खबरों में शब्द या वाक्यांश…', ja:'すべてのニュースから単語やフレーズ…', ky:'бардык жаңылыктардан сөз же сөз айкашы…', 'zh-Hant':'在所有新聞中搜尋字詞…' },
  search_go: { bg:'Търси сега', ru:'Искать сейчас', uk:'Шукати зараз', en:'Search now', de:'Jetzt suchen', fr:'Chercher', es:'Buscar ahora', 'es-MX':'Buscar ahora', it:'Cerca ora', pt:'Pesquisar agora', ar:'ابحث الآن', hi:'अभी खोजें', ja:'今すぐ検索', ky:'Азыр изде', 'zh-Hant':'立即搜尋' },
  search_site:{ bg:'Текст в сайт', ru:'Текст на сайте', uk:'Текст на сайті', en:'Text on a site', de:'Text auf einer Seite', fr:'Texte sur un site', es:'Texto en un sitio', 'es-MX':'Texto en un sitio', it:'Testo in un sito', pt:'Texto num site', ar:'نص في موقع', hi:'साइट पर टेक्स्ट', ja:'サイト内のテキスト', ky:'Сайттагы текст', 'zh-Hant':'網站上的文字' },
  searching: { bg:'Търся…', ru:'Ищу…', uk:'Шукаю…', en:'Searching…', de:'Suche…', fr:'Recherche…', es:'Buscando…', 'es-MX':'Buscando…', it:'Ricerca…', pt:'A pesquisar…', ar:'جارٍ البحث…', hi:'खोज रहा है…', ja:'検索中…', ky:'Изделүүдө…', 'zh-Hant':'搜尋中…' },
  results:   { bg:'{0} резултата', ru:'{0} результатов', uk:'{0} результатів', en:'{0} results', de:'{0} Ergebnisse', fr:'{0} résultats', es:'{0} resultados', 'es-MX':'{0} resultados', it:'{0} risultati', pt:'{0} resultados', ar:'{0} نتائج', hi:'{0} परिणाम', ja:'{0} 件', ky:'{0} натыйжа', 'zh-Hant':'{0} 筆結果' },
  no_results:{ bg:'Няма резултати', ru:'Нет результатов', uk:'Немає результатів', en:'No results', de:'Keine Ergebnisse', fr:'Aucun résultat', es:'Sin resultados', 'es-MX':'Sin resultados', it:'Nessun risultato', pt:'Sem resultados', ar:'لا نتائج', hi:'कोई परिणाम नहीं', ja:'結果なし', ky:'Натыйжа жок', 'zh-Hant':'沒有結果' },
  c_up:      { bg:'Достъпност', ru:'Доступность', uk:'Доступність', en:'Uptime', de:'Verfügbarkeit', fr:'Disponibilité', es:'Disponibilidad', 'es-MX':'Disponibilidad', it:'Disponibilità', pt:'Disponibilidade', ar:'التوفر', hi:'अपटाइम', ja:'稼働状況', ky:'Жеткиликтүүлүк', 'zh-Hant':'可用性' },
  c_ssl:     { bg:'SSL сертификати', ru:'SSL-сертификаты', uk:'SSL-сертифікати', en:'SSL certificates', de:'SSL-Zertifikate', fr:'Certificats SSL', es:'Certificados SSL', 'es-MX':'Certificados SSL', it:'Certificati SSL', pt:'Certificados SSL', ar:'شهادات SSL', hi:'SSL प्रमाणपत्र', ja:'SSL証明書', ky:'SSL сертификаттар', 'zh-Hant':'SSL 憑證' },
  c_price:   { bg:'Цени', ru:'Цены', uk:'Ціни', en:'Prices', de:'Preise', fr:'Prix', es:'Precios', 'es-MX':'Precios', it:'Prezzi', pt:'Preços', ar:'الأسعار', hi:'कीमतें', ja:'価格', ky:'Баалар', 'zh-Hant':'價格' },
  c_diff:    { bg:'Промени в страници', ru:'Изменения страниц', uk:'Зміни сторінок', en:'Page changes', de:'Seitenänderungen', fr:'Changements de pages', es:'Cambios de páginas', 'es-MX':'Cambios de páginas', it:'Modifiche alle pagine', pt:'Alterações de páginas', ar:'تغييرات الصفحات', hi:'पेज बदलाव', ja:'ページの変更', ky:'Барак өзгөрүүлөрү', 'zh-Hant':'頁面變更' },
  c_board:   { bg:'Табло и седмичен отчет', ru:'Сводка и недельный отчёт', uk:'Зведення і тижневий звіт', en:'Board & weekly report', de:'Übersicht & Wochenbericht', fr:'Tableau et rapport hebdo', es:'Tablero e informe semanal', 'es-MX':'Tablero e informe semanal', it:'Quadro e rapporto settimanale', pt:'Painel e relatório semanal', ar:'اللوحة والتقرير الأسبوعي', hi:'बोर्ड और साप्ताहिक रिपोर्ट', ja:'ボードと週間レポート', ky:'Такта жана жумалык отчет', 'zh-Hant':'總覽與每週報告' },
  c_io:      { bg:'Пренос и шаблони', ru:'Перенос и шаблоны', uk:'Перенесення і шаблони', en:'Transfer & templates', de:'Übertragen & Vorlagen', fr:'Transfert et modèles', es:'Transferir y plantillas', 'es-MX':'Transferir y plantillas', it:'Trasferimento e modelli', pt:'Transferir e modelos', ar:'النقل والقوالب', hi:'ट्रांसफ़र और टेम्पलेट', ja:'転送とテンプレート', ky:'Көчүрүү жана үлгүлөр', 'zh-Hant':'轉移與範本' },
  c_mon:     { bg:'RSS/JSON монитори', ru:'RSS/JSON-мониторы', uk:'RSS/JSON-монітори', en:'RSS/JSON monitors', de:'RSS/JSON-Monitore', fr:'Moniteurs RSS/JSON', es:'Monitores RSS/JSON', 'es-MX':'Monitores RSS/JSON', it:'Monitor RSS/JSON', pt:'Monitores RSS/JSON', ar:'مراقبات RSS/JSON', hi:'RSS/JSON मॉनिटर', ja:'RSS/JSONモニター', ky:'RSS/JSON мониторлор', 'zh-Hant':'RSS/JSON 監控' },
  c_watch:   { bg:'Ежедневни наблюдатели', ru:'Ежедневные наблюдатели', uk:'Щоденні спостерігачі', en:'Daily watches', de:'Tägliche Wächter', fr:'Veilles quotidiennes', es:'Vigilancias diarias', 'es-MX':'Vigilancias diarias', it:'Controlli giornalieri', pt:'Vigilâncias diárias', ar:'المراقبات اليومية', hi:'दैनिक निगरानी', ja:'毎日の監視', ky:'Күндөлүк байкоочулар', 'zh-Hant':'每日監看' },
  c_cat:     { bg:'Каталог с емисии', ru:'Каталог лент', uk:'Каталог стрічок', en:'Feed catalog', de:'Feed-Katalog', fr:'Catalogue de flux', es:'Catálogo de fuentes', 'es-MX':'Catálogo de fuentes', it:'Catalogo dei feed', pt:'Catálogo de feeds', ar:'دليل الخلاصات', hi:'फ़ीड सूची', ja:'フィードカタログ', ky:'Агымдар каталогу', 'zh-Hant':'訂閱源目錄' },
  c_new:     { bg:'Нов монитор', ru:'Новый монитор', uk:'Новий монітор', en:'New monitor', de:'Neuer Monitor', fr:'Nouveau moniteur', es:'Nuevo monitor', 'es-MX':'Nuevo monitor', it:'Nuovo monitor', pt:'Novo monitor', ar:'مراقب جديد', hi:'नया मॉनिटर', ja:'新しいモニター', ky:'Жаңы монитор', 'zh-Hant':'新增監控' },
  c_new_l:   { bg:'RSS/Atom емисия или JSON API, по нови записи или ключови думи', ru:'RSS/Atom-лента или JSON API, по новым записям или ключевым словам', uk:'RSS/Atom-стрічка або JSON API, за новими записами чи ключовими словами', en:'RSS/Atom feed or JSON API, by new entries or keywords', de:'RSS/Atom-Feed oder JSON-API, nach neuen Einträgen oder Stichwörtern', fr:'Flux RSS/Atom ou API JSON, par nouvelles entrées ou mots-clés', es:'Fuente RSS/Atom o API JSON, por entradas nuevas o palabras clave', 'es-MX':'Fuente RSS/Atom o API JSON, por entradas nuevas o palabras clave', it:'Feed RSS/Atom o API JSON, per nuove voci o parole chiave', pt:'Feed RSS/Atom ou API JSON, por novas entradas ou palavras-chave', ar:'خلاصة RSS/Atom أو واجهة JSON، حسب الإدخالات الجديدة أو الكلمات المفتاحية', hi:'RSS/Atom फ़ीड या JSON API, नई प्रविष्टियों या कीवर्ड से', ja:'RSS/AtomフィードまたはJSON API、新着項目やキーワードで', ky:'RSS/Atom агымы же JSON API, жаңы жазуулар же ачкыч сөздөр боюнча', 'zh-Hant':'RSS/Atom 訂閱源或 JSON API，依新項目或關鍵字' },
  sites_n:   { bg:'{0} сайта', ru:'{0} сайтов', uk:'{0} сайтів', en:'{0} sites', de:'{0} Seiten', fr:'{0} sites', es:'{0} sitios', 'es-MX':'{0} sitios', it:'{0} siti', pt:'{0} sites', ar:'{0} مواقع', hi:'{0} साइटें', ja:'{0} サイト', ky:'{0} сайт', 'zh-Hant':'{0} 個網站' },
  domains_n: { bg:'{0} домейна', ru:'{0} доменов', uk:'{0} доменів', en:'{0} domains', de:'{0} Domains', fr:'{0} domaines', es:'{0} dominios', 'es-MX':'{0} dominios', it:'{0} domini', pt:'{0} domínios', ar:'{0} نطاقات', hi:'{0} डोमेन', ja:'{0} ドメイン', ky:'{0} домен', 'zh-Hant':'{0} 個網域' },
  items_n:   { bg:'{0} следени', ru:'{0} отслеживаемых', uk:'{0} відстежуваних', en:'{0} tracked', de:'{0} verfolgt', fr:'{0} suivis', es:'{0} seguidos', 'es-MX':'{0} seguidos', it:'{0} monitorati', pt:'{0} seguidos', ar:'{0} متتبَّعة', hi:'{0} ट्रैक', ja:'{0} 件追跡中', ky:'{0} көзөмөлдө', 'zh-Hant':'{0} 項追蹤中' },
  pages_n:   { bg:'{0} страници', ru:'{0} страниц', uk:'{0} сторінок', en:'{0} pages', de:'{0} Seiten', fr:'{0} pages', es:'{0} páginas', 'es-MX':'{0} páginas', it:'{0} pagine', pt:'{0} páginas', ar:'{0} صفحات', hi:'{0} पेज', ja:'{0} ページ', ky:'{0} барак', 'zh-Hant':'{0} 個頁面' },
  mons_n:    { bg:'{0} монитора', ru:'{0} мониторов', uk:'{0} моніторів', en:'{0} monitors', de:'{0} Monitore', fr:'{0} moniteurs', es:'{0} monitores', 'es-MX':'{0} monitores', it:'{0} monitor', pt:'{0} monitores', ar:'{0} مراقبات', hi:'{0} मॉनिटर', ja:'{0} モニター', ky:'{0} монитор', 'zh-Hant':'{0} 個監控' },
  watch_n:   { bg:'{0} наблюдатели', ru:'{0} наблюдателей', uk:'{0} спостерігачів', en:'{0} watches', de:'{0} Wächter', fr:'{0} veilles', es:'{0} vigilancias', 'es-MX':'{0} vigilancias', it:'{0} controlli', pt:'{0} vigilâncias', ar:'{0} مراقبات', hi:'{0} निगरानी', ja:'{0} 件の監視', ky:'{0} байкоочу', 'zh-Hant':'{0} 項監看' },
  sources_n: { bg:'{0} проверени източника в {1} държави', ru:'{0} проверенных источников в {1} странах', uk:'{0} перевірених джерел у {1} країнах', en:'{0} verified sources in {1} countries', de:'{0} geprüfte Quellen in {1} Ländern', fr:'{0} sources vérifiées dans {1} pays', es:'{0} fuentes verificadas en {1} países', 'es-MX':'{0} fuentes verificadas en {1} países', it:'{0} fonti verificate in {1} paesi', pt:'{0} fontes verificadas em {1} países', ar:'{0} مصدرًا موثوقًا في {1} دولة', hi:'{1} देशों में {0} सत्यापित स्रोत', ja:'{1}か国の{0}件の検証済みソース', ky:'{1} өлкөдө {0} текшерилген булак', 'zh-Hant':'{1} 個國家的 {0} 個已驗證來源' },
  uptime:    { bg:'достъпност', ru:'доступность', uk:'доступність', en:'uptime', de:'Verfügbarkeit', fr:'disponibilité', es:'disponibilidad', 'es-MX':'disponibilidad', it:'disponibilità', pt:'disponibilidade', ar:'توفر', hi:'अपटाइम', ja:'稼働率', ky:'жеткиликтүүлүк', 'zh-Hant':'可用率' },
  incidents: { bg:'прекъсвания', ru:'сбоев', uk:'збоїв', en:'incidents', de:'Ausfälle', fr:'incidents', es:'incidencias', 'es-MX':'incidencias', it:'incidenti', pt:'incidentes', ar:'أعطال', hi:'घटनाएँ', ja:'障害', ky:'үзгүлтүк', 'zh-Hant':'次事件' },
  soonest:   { bg:'най-скоро изтича', ru:'скорее всего истечёт', uk:'найшвидше спливає', en:'soonest expiry', de:'läuft zuerst ab', fr:'expire en premier', es:'vence antes', 'es-MX':'vence antes', it:'scade prima', pt:'expira primeiro', ar:'الأقرب انتهاءً', hi:'सबसे पहले समाप्त', ja:'最初に期限切れ', ky:'эң эрте бүтөт', 'zh-Hant':'最早到期' },
  days:      { bg:'дни', ru:'дн.', uk:'дн.', en:'days', de:'Tage', fr:'jours', es:'días', 'es-MX':'días', it:'giorni', pt:'dias', ar:'أيام', hi:'दिन', ja:'日', ky:'күн', 'zh-Hant':'天' },
  online:    { bg:'онлайн', ru:'онлайн', uk:'онлайн', en:'online', de:'online', fr:'en ligne', es:'en línea', 'es-MX':'en línea', it:'online', pt:'online', ar:'متصل', hi:'ऑनलाइन', ja:'オンライン', ky:'онлайн', 'zh-Hant':'線上' },
  offline:   { bg:'офлайн', ru:'офлайн', uk:'офлайн', en:'offline', de:'offline', fr:'hors ligne', es:'sin conexión', 'es-MX':'sin conexión', it:'offline', pt:'offline', ar:'غير متصل', hi:'ऑफ़लाइन', ja:'オフライン', ky:'офлайн', 'zh-Hant':'離線' },
  last_match:{ bg:'последно съвпадение', ru:'последнее совпадение', uk:'останній збіг', en:'last match', de:'letzter Treffer', fr:'dernière correspondance', es:'última coincidencia', 'es-MX':'última coincidencia', it:'ultima corrispondenza', pt:'última correspondência', ar:'آخر تطابق', hi:'अंतिम मिलान', ja:'最新の一致', ky:'акыркы дал келүү', 'zh-Hant':'最近符合' },
  found_n:   { bg:'{0} сработили', ru:'{0} сработало', uk:'{0} спрацювало', en:'{0} triggered', de:'{0} ausgelöst', fr:'{0} déclenchées', es:'{0} activadas', 'es-MX':'{0} activadas', it:'{0} attivati', pt:'{0} disparadas', ar:'{0} مُفعَّلة', hi:'{0} ट्रिगर', ja:'{0} 件作動', ky:'{0} иштеди', 'zh-Hant':'{0} 項已觸發' },
  none:      { bg:'още нищо — докосни, за да добавиш', ru:'пока ничего — коснитесь, чтобы добавить', uk:'поки нічого — торкніться, щоб додати', en:'nothing yet — tap to add', de:'noch nichts — tippen zum Hinzufügen', fr:'rien pour l\'instant — touchez pour ajouter', es:'nada aún — toca para añadir', 'es-MX':'nada aún — toca para agregar', it:'ancora nulla — tocca per aggiungere', pt:'ainda nada — toque para adicionar', ar:'لا شيء بعد — انقر للإضافة', hi:'अभी कुछ नहीं — जोड़ने के लिए टैप करें', ja:'まだありません — タップして追加', ky:'азырынча жок — кошуу үчүн басыңыз', 'zh-Hant':'尚無 — 點擊新增' },
  io_line:   { bg:'Експорт/импорт JSON · Telegram, YouTube, Reddit, GitHub', ru:'Экспорт/импорт JSON · Telegram, YouTube, Reddit, GitHub', uk:'Експорт/імпорт JSON · Telegram, YouTube, Reddit, GitHub', en:'Export/import JSON · Telegram, YouTube, Reddit, GitHub', de:'Export/Import JSON · Telegram, YouTube, Reddit, GitHub', fr:'Export/import JSON · Telegram, YouTube, Reddit, GitHub', es:'Exportar/importar JSON · Telegram, YouTube, Reddit, GitHub', 'es-MX':'Exportar/importar JSON · Telegram, YouTube, Reddit, GitHub', it:'Esporta/importa JSON · Telegram, YouTube, Reddit, GitHub', pt:'Exportar/importar JSON · Telegram, YouTube, Reddit, GitHub', ar:'تصدير/استيراد JSON · Telegram, YouTube, Reddit, GitHub', hi:'JSON निर्यात/आयात · Telegram, YouTube, Reddit, GitHub', ja:'JSONエクスポート/インポート · Telegram, YouTube, Reddit, GitHub', ky:'JSON экспорт/импорт · Telegram, YouTube, Reddit, GitHub', 'zh-Hant':'匯出/匯入 JSON · Telegram、YouTube、Reddit、GitHub' },
  board_line:{ bg:'{0} записа · общ статус и отчет за споделяне', ru:'{0} записей · общий статус и отчёт для отправки', uk:'{0} записів · загальний статус і звіт для надсилання', en:'{0} entries · overall status and a report to share', de:'{0} Einträge · Gesamtstatus und Bericht zum Teilen', fr:'{0} entrées · état global et rapport à partager', es:'{0} entradas · estado general e informe para compartir', 'es-MX':'{0} entradas · estado general e informe para compartir', it:'{0} voci · stato complessivo e rapporto da condividere', pt:'{0} entradas · estado geral e relatório para partilhar', ar:'{0} مدخلات · الحالة العامة وتقرير للمشاركة', hi:'{0} प्रविष्टियाँ · कुल स्थिति और साझा करने योग्य रिपोर्ट', ja:'{0} 件 · 全体の状態と共有用レポート', ky:'{0} жазуу · жалпы абал жана бөлүшүү үчүн отчет', 'zh-Hant':'{0} 筆 · 整體狀態與可分享的報告' },
  recent:    { bg:'Последни събития', ru:'Последние события', uk:'Останні події', en:'Recent events', de:'Letzte Ereignisse', fr:'Événements récents', es:'Eventos recientes', 'es-MX':'Eventos recientes', it:'Eventi recenti', pt:'Eventos recentes', ar:'أحدث الأحداث', hi:'हाल की घटनाएँ', ja:'最近のイベント', ky:'Акыркы окуялар', 'zh-Hant':'最近事件' },
  about:     { bg:'За робота', ru:'О боте', uk:'Про бота', en:'About the bot', de:'Über den Bot', fr:'À propos du bot', es:'Acerca del bot', 'es-MX':'Acerca del bot', it:'Info sul bot', pt:'Sobre o bot', ar:'حول البوت', hi:'बॉट के बारे में', ja:'ボットについて', ky:'Бот жөнүндө', 'zh-Hant':'關於機器人' }
};
function tr(k) { const e = L[k]; return e ? (e[getLang()] || e.en) : k; }
function trf(k) { let s = tr(k); for (let i = 1; i < arguments.length; i++) s = s.replace('{' + (i - 1) + '}', arguments[i]); return s; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return String(u || ''); } }
function loadSites() { try { return JSON.parse(localStorage.getItem(LSK_SITES) || '[]'); } catch (_) { return []; } }

let styled = false;
function injectHomeStyles() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
  .home .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}
  .home .hc{display:block;width:100%;text-align:left;background:#141a23;border:1px solid #1e2530;border-radius:14px;padding:12px;color:inherit;cursor:pointer;min-height:96px}
  .home .hc:active{transform:translateY(1px)}
  .home .hc .ic{font-size:22px;display:block;margin-bottom:4px}
  .home .hc b{font-size:14px;display:block;margin-bottom:4px}
  .home .hc .ln{font-size:12px;color:#9aa6b5;line-height:1.4;word-break:break-word}
  .home .hc .ln .ok{color:#5be584}.home .hc .ln .bad{color:#ff9a9a}.home .hc .ln .wrn{color:#f5a623}
  .home .hc.wide{grid-column:1 / -1;min-height:0}
  .home .smp{background:rgba(245,166,35,.10);border:1px solid rgba(245,166,35,.45);border-radius:12px;padding:10px 12px;margin:8px 0;font-size:13px;color:#f0d39a}
  `;
  document.head.appendChild(s);
}

// Кратки редове „живо съдържание" за всяка карта — само от пазените данни.
function lines(state) {
  const d = loadTools(); const sites = loadSites().filter((w) => w.tab !== 'now'); const mons = state.monitors || [];
  const out = {};
  // Достъпност: брой сайтове, средна достъпност за 7 дни, прекъсвания, кой е офлайн сега
  if (d.up.length) {
    const st = d.up.map((it) => Object.assign({ url: it.url }, upStats(it.history)));
    const withPct = st.filter((s) => s.pct != null);
    const avg = withPct.length ? Math.round(withPct.reduce((a, s) => a + s.pct, 0) / withPct.length) : null;
    const inc = st.reduce((a, s) => a + s.inc, 0);
    const down = st.filter((s) => s.last && !s.last.ok);
    out.up = trf('sites_n', d.up.length) + (avg != null ? ' · <span class="' + (avg >= 99 ? 'ok' : (avg >= 95 ? 'wrn' : 'bad')) + '">' + avg + '% ' + esc(tr('uptime')) + '</span>' : '') + ' · ' + inc + ' ' + esc(tr('incidents')) +
      '<br>' + (down.length ? '<span class="bad">● ' + esc(host(down[0].url)) + ' ' + esc(tr('offline')) + '</span>' : '<span class="ok">● ' + esc(host(st[0].url)) + ' ' + esc(tr('online')) + ' · ' + st[0].ms + ' ms</span>');
  }
  // SSL: най-скоро изтичащ
  if (d.ssl.length) {
    const known = d.ssl.filter((it) => it.notAfter).map((it) => ({ host: it.host, days: Math.floor((it.notAfter - Date.now()) / 864e5) })).sort((a, b) => a.days - b.days);
    out.ssl = trf('domains_n', d.ssl.length) + (known.length ? '<br>' + esc(tr('soonest')) + ': <span class="' + (known[0].days < 7 ? 'bad' : (known[0].days < 30 ? 'wrn' : 'ok')) + '">🔒 ' + esc(known[0].host) + ' · ' + known[0].days + ' ' + esc(tr('days')) + '</span>' : '');
  }
  // Цени: последна цена + промяна на първия със история
  if (d.price.length) {
    const it = d.price.find((x) => (x.history || []).length) || d.price[0]; const h = it.history || []; const l = h[h.length - 1], p = h.length > 1 ? h[0] : null;
    const delta = l && p ? l.value - p.value : 0;
    out.price = trf('items_n', d.price.length) + '<br>' + esc(host(it.url)) + (l ? ': <b style="display:inline">' + esc(l.raw) + '</b>' + (p && delta ? ' <span class="' + (delta > 0 ? 'bad' : 'ok') + '">' + (delta > 0 ? '▲' : '▼') + ' ' + Math.abs(delta).toFixed(2) + '</span>' : '') : '');
  }
  // Промени
  if (d.diff.length) {
    const it = d.diff.find((x) => (x.added || []).length || (x.removed || []).length) || d.diff[0];
    out.diff = trf('pages_n', d.diff.length) + '<br>' + esc(host(it.url)) + ': <span class="ok">+' + (it.added || []).length + '</span> / <span class="bad">−' + (it.removed || []).length + '</span>';
  }
  // Табло: общ брой записи
  const total = d.up.length + d.ssl.length + d.price.length + d.diff.length + sites.length + mons.length;
  out.board = trf('board_line', total);
  out.io = tr('io_line');
  // Монитори
  if (mons.length) {
    const lm = mons.filter((m) => m.lastMatch).sort((a, b) => b.lastMatch - a.lastMatch)[0];
    out.mon = trf('mons_n', mons.length) + '<br>' + (lm ? '<span class="ok">✅ ' + esc(lm.name) + '</span> · ' + esc(tr('last_match')) + ' ' + esc(fmtTime(lm.lastMatch)) : esc(mons[0].name));
  }
  // Ежедневни наблюдатели
  if (sites.length) {
    const trig = sites.filter((w) => w.triggered).length; const w0 = sites.find((w) => w.triggered) || sites[0];
    out.watch = trf('watch_n', sites.length) + ' · ' + trf('found_n', trig) + '<br>' + esc(host(w0.url)) + (w0.phrase ? ' „' + esc(w0.phrase) + '"' : '') + ': ' + (w0.triggered ? '<span class="ok">' : '<span>') + esc(w0.lastResult || '—') + '</span>';
  }
  return out;
}

export function renderHome(ctx) {
  injectHomeStyles();
  const { state, go, refresh } = ctx;
  const ln = lines(state);
  const wrap = el('div', { class: 'content home' });
  wrap.appendChild(el('h2', { style: 'margin:4px 0 2px' }, '🗂 ' + tr('title')));
  wrap.appendChild(el('p', { class: 'muted', style: 'margin:0 0 8px' }, tr('subtitle')));

  // Банер за примерните данни (само докато ги има) / бутон за връщане (ако са махнати и няма нищо)
  if (hasSamples(state)) {
    wrap.appendChild(el('div', { class: 'smp' }, [
      el('div', {}, '📦 ' + tr('smp_note')),
      el('button', { class: 'btn small', style: 'margin-top:8px', onclick: async () => { removeSamples(state); await saveState(state); refresh(); } }, '🗑 ' + tr('smp_remove'))
    ]));
  } else if (!(state.monitors || []).length && !loadTools().up.length && !loadSites().length) {
    wrap.appendChild(el('button', { class: 'btn small', onclick: async () => { addSamples(state); await saveState(state); refresh(); } }, '📦 ' + tr('smp_add')));
  }

  // Търсене (ръчно действие — единствената мрежа на този екран)
  const inp = el('input', { placeholder: tr('search_ph'), value: state.globalSearch || '' });
  const res = el('div', {});
  wrap.appendChild(el('div', { class: 'card', style: 'border:1px solid #2a86d8' }, [
    el('b', {}, '🔍 ' + tr('search_t')),
    el('div', { class: 'gap' }), inp, el('div', { class: 'gap' }),
    el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, [
      el('button', { class: 'btn small primary', onclick: async (e) => {
        const q = inp.value.trim(); if (!q) { res.replaceChildren(); return; }
        const b = e.target; b.disabled = true; b.textContent = tr('searching');
        const r = await searchAllNow(state, q);
        b.disabled = false; b.textContent = tr('search_go');
        const kids = [el('p', { class: 'small', style: 'margin:8px 0 4px' }, r.hits.length ? trf('results', r.hits.length) : tr('no_results'))];
        for (const h of r.hits.slice(0, 20)) kids.push(el('div', { class: 'log-entry match' }, [el('b', {}, h.source + ': '), h.link ? el('a', { href: h.link, target: '_blank', style: 'color:#9fc3ff' }, h.title || h.link) : el('span', {}, h.title || '—')]));
        res.replaceChildren(...kids);
      } }, tr('search_go')),
      el('button', { class: 'btn small', onclick: () => go('sites', { tab: 'now' }) }, '🌐 ' + tr('search_site'))
    ]),
    res
  ]));

  // Карти на инструментите
  const card = (ic, title, line, onclick, wide) => el('button', { class: 'hc' + (wide ? ' wide' : ''), onclick }, [
    el('span', { class: 'ic' }, ic), el('b', {}, title), el('div', { class: 'ln', html: line || '<span>' + esc(tr('none')) + '</span>' })
  ]);
  const grid = el('div', { class: 'grid' }, [
    card('⏱', tr('c_up'), ln.up, () => go('tools', { tab: 'up' })),
    card('🔒', tr('c_ssl'), ln.ssl, () => go('tools', { tab: 'ssl' })),
    card('💰', tr('c_price'), ln.price, () => go('tools', { tab: 'price' })),
    card('📝', tr('c_diff'), ln.diff, () => go('tools', { tab: 'diff' })),
    card('📡', tr('c_mon'), ln.mon, () => go('dashboard')),
    card('🌐', tr('c_watch'), ln.watch, () => go('sites', { tab: 'text' })),
    card('📊', tr('c_board'), ln.board, () => go('tools', { tab: 'board' })),
    card('🔁', tr('c_io'), ln.io, () => go('tools', { tab: 'io' })),
    card('📚', tr('c_cat'), esc(trf('sources_n', OUTLETS.length, new Set(OUTLETS.map((o) => o.c).filter(Boolean)).size)), () => go('directory'), true),
    card('＋', tr('c_new'), esc(tr('c_new_l')), () => go('monitor-config'), true)
  ]);
  wrap.appendChild(grid);

  // Последни събития (от дневника)
  const log = (state.log || []).slice(0, 5);
  if (log.length) {
    wrap.appendChild(el('h2', { style: 'margin:12px 0 6px;font-size:16px' }, tr('recent')));
    wrap.appendChild(el('div', { class: 'card' }, log.map((l) => el('div', { class: 'log-entry ' + (l.kind || 'info') }, [
      fmtTime(l.ts) + ' — ' + l.text, l.sample ? el('span', { class: 'smp-tag' }, sampleLabel()) : null
    ]))));
  }
  wrap.appendChild(el('p', { class: 'small center', style: 'margin-top:12px' }, [
    el('a', { href: '#', style: 'color:#9aa6b5', onclick: (e) => { e.preventDefault(); go('onboarding'); } }, 'ℹ️ ' + tr('about'))
  ]));
  return wrap;
}
