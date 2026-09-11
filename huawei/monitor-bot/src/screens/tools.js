// Version: 1.0029
// tools.js — екран „Инструменти" (обогатяване по Huawei 4.1). Шест таба:
//  1) Достъпност — история online/offline + време за отговор (графика)   [1 проверка на пускане]
//  2) SSL — до кога е валиден сертификатът на домейна                      [1 проверка на пускане]
//  3) Цена — следене на цена в страница, история и промяна                [1 теглене на пускане]
//  4) Промени — текстова разлика спрямо предишното посещение              [1 теглене на пускане]
//  5) Табло — общ статус на всичко следено + седмичен отчет (от пазените данни, БЕЗ мрежа)
//  6) Пренос — експорт/импорт JSON + готови шаблони (Telegram/YouTube/Reddit/GitHub)
// ПОЛИТИКА: всяка мрежова проверка става най-много ВЕДНЪЖ на пускане на приложението (при първо
// отваряне на таба / добавяне), после само от пазените данни — независимо колко стои отворен.
// 11.09.2026 (v1.0029): примерните записи (sample:true, core/samples.js) се показват с етикет „пример";
// проверяват се по същата политика (веднъж на пускане) и постепенно се превръщат в реална история.
// Екранът приема ctx.params.tab (от таблото „Общ преглед") за пряко отваряне на под-таб.
import { getLang } from '../core/i18n.js';
import { saveState } from '../core/storage.js';
import * as SW from '../core/site-watch.js';
import { sampleTag } from '../core/samples.js';

const LSK = 'monitor-bot.tools.v1';
const LSK_SITES = 'monitor-bot.siteWatch.v1';
const HIST_MAX = 60;

// ── 15-езичен локален речник ──
const L = {
  tab_up:    { bg:'Достъпност', ru:'Доступность', uk:'Доступність', en:'Uptime', de:'Verfügbarkeit', fr:'Disponibilité', es:'Disponibilidad', 'es-MX':'Disponibilidad', it:'Disponibilità', pt:'Disponibilidade', ar:'التوفر', hi:'अपटाइम', ja:'稼働状況', ky:'Жеткиликтүүлүк', 'zh-Hant':'可用性' },
  tab_ssl:   { bg:'SSL', ru:'SSL', uk:'SSL', en:'SSL', de:'SSL', fr:'SSL', es:'SSL', 'es-MX':'SSL', it:'SSL', pt:'SSL', ar:'SSL', hi:'SSL', ja:'SSL', ky:'SSL', 'zh-Hant':'SSL' },
  tab_price: { bg:'Цена', ru:'Цена', uk:'Ціна', en:'Price', de:'Preis', fr:'Prix', es:'Precio', 'es-MX':'Precio', it:'Prezzo', pt:'Preço', ar:'السعر', hi:'कीमत', ja:'価格', ky:'Баа', 'zh-Hant':'價格' },
  tab_diff:  { bg:'Промени', ru:'Изменения', uk:'Зміни', en:'Changes', de:'Änderungen', fr:'Changements', es:'Cambios', 'es-MX':'Cambios', it:'Modifiche', pt:'Alterações', ar:'التغييرات', hi:'बदलाव', ja:'変更', ky:'Өзгөрүүлөр', 'zh-Hant':'變更' },
  tab_board: { bg:'Табло', ru:'Сводка', uk:'Зведення', en:'Board', de:'Übersicht', fr:'Tableau', es:'Tablero', 'es-MX':'Tablero', it:'Quadro', pt:'Painel', ar:'اللوحة', hi:'बोर्ड', ja:'ボード', ky:'Такта', 'zh-Hant':'總覽' },
  tab_io:    { bg:'Пренос', ru:'Перенос', uk:'Перенесення', en:'Transfer', de:'Übertragen', fr:'Transfert', es:'Transferir', 'es-MX':'Transferir', it:'Trasferisci', pt:'Transferir', ar:'نقل', hi:'ट्रांसफ़र', ja:'転送', ky:'Көчүрүү', 'zh-Hant':'轉移' },
  once_note: { bg:'Проверява се веднъж при пускане на приложението (при отваряне на таба); после се показват пазените данни и не се праща трафик. „Провери сега" е по твое желание.', ru:'Проверка один раз при запуске приложения (при открытии вкладки); далее показываются сохранённые данные без трафика. «Проверить сейчас» — по желанию.', uk:'Перевірка один раз при запуску застосунку (при відкритті вкладки); далі показуються збережені дані без трафіку. «Перевірити зараз» — за бажанням.', en:'Checked once per app launch (when the tab opens); afterwards stored data is shown and no traffic is sent. "Check now" is on demand.', de:'Einmal pro App-Start geprüft (beim Öffnen des Tabs); danach werden gespeicherte Daten ohne Datenverkehr angezeigt. „Jetzt prüfen" auf Wunsch.', fr:'Vérifié une fois par lancement (à l\'ouverture de l\'onglet) ; ensuite les données enregistrées s\'affichent sans trafic. « Vérifier » à la demande.', es:'Se comprueba una vez por inicio (al abrir la pestaña); después se muestran datos guardados sin tráfico. «Comprobar ahora» a petición.', 'es-MX':'Se comprueba una vez por inicio (al abrir la pestaña); después se muestran datos guardados sin tráfico. «Comprobar ahora» a petición.', it:'Controllato una volta per avvio (all\'apertura della scheda); poi si mostrano i dati salvati senza traffico. «Controlla ora» su richiesta.', pt:'Verificado uma vez por arranque (ao abrir o separador); depois mostram-se dados guardados sem tráfego. «Verificar agora» a pedido.', ar:'يُفحص مرة عند كل تشغيل (عند فتح التبويب)؛ بعدها تُعرض البيانات المحفوظة دون حركة بيانات. «افحص الآن» عند الطلب.', hi:'हर लॉन्च पर एक बार जाँच (टैब खुलने पर); फिर सहेजा डेटा बिना ट्रैफ़िक दिखता है। "अभी जाँचें" इच्छानुसार।', ja:'起動ごとに一度確認（タブを開いた時）。以後は保存データを表示し通信しません。「今すぐ確認」は任意。', ky:'Ар бир ачылганда бир жолу текшерилет (таб ачылганда); андан кийин сакталган маалымат трафиксиз көрсөтүлөт. «Азыр текшер» — каалоо боюнча.', 'zh-Hant':'每次啟動檢查一次（開啟分頁時）；之後顯示已儲存資料，不產生流量。「立即檢查」為手動。' },
  url:       { bg:'Адрес на сайта (https://…)', ru:'Адрес сайта (https://…)', uk:'Адреса сайту (https://…)', en:'Site URL (https://…)', de:'Website-URL (https://…)', fr:'URL du site (https://…)', es:'URL del sitio (https://…)', 'es-MX':'URL del sitio (https://…)', it:'URL del sito (https://…)', pt:'URL do site (https://…)', ar:'عنوان الموقع (https://…)', hi:'साइट URL (https://…)', ja:'サイトURL (https://…)', ky:'Сайттын дареги (https://…)', 'zh-Hant':'網站網址 (https://…)' },
  host:      { bg:'Домейн (пример: pupikes.app)', ru:'Домен (например: pupikes.app)', uk:'Домен (наприклад: pupikes.app)', en:'Domain (e.g. pupikes.app)', de:'Domain (z. B. pupikes.app)', fr:'Domaine (ex. pupikes.app)', es:'Dominio (p. ej. pupikes.app)', 'es-MX':'Dominio (p. ej. pupikes.app)', it:'Dominio (es. pupikes.app)', pt:'Domínio (ex. pupikes.app)', ar:'النطاق (مثال: pupikes.app)', hi:'डोमेन (जैसे pupikes.app)', ja:'ドメイン（例: pupikes.app）', ky:'Домен (мисалы: pupikes.app)', 'zh-Hant':'網域（例：pupikes.app）' },
  hint:      { bg:'Дума до цената (по избор)', ru:'Слово рядом с ценой (необязательно)', uk:'Слово біля ціни (необов\'язково)', en:'Word next to the price (optional)', de:'Wort neben dem Preis (optional)', fr:'Mot près du prix (facultatif)', es:'Palabra junto al precio (opcional)', 'es-MX':'Palabra junto al precio (opcional)', it:'Parola accanto al prezzo (facoltativo)', pt:'Palavra junto ao preço (opcional)', ar:'كلمة بجوار السعر (اختياري)', hi:'कीमत के पास का शब्द (वैकल्पिक)', ja:'価格の近くの語（任意）', ky:'Баанын жанындагы сөз (милдеттүү эмес)', 'zh-Hant':'價格旁的字詞（選填）' },
  add:       { bg:'Добави', ru:'Добавить', uk:'Додати', en:'Add', de:'Hinzufügen', fr:'Ajouter', es:'Añadir', 'es-MX':'Agregar', it:'Aggiungi', pt:'Adicionar', ar:'إضافة', hi:'जोड़ें', ja:'追加', ky:'Кошуу', 'zh-Hant':'新增' },
  check_now: { bg:'Провери сега', ru:'Проверить сейчас', uk:'Перевірити зараз', en:'Check now', de:'Jetzt prüfen', fr:'Vérifier', es:'Comprobar ahora', 'es-MX':'Comprobar ahora', it:'Controlla ora', pt:'Verificar agora', ar:'افحص الآن', hi:'अभी जाँचें', ja:'今すぐ確認', ky:'Азыр текшер', 'zh-Hant':'立即檢查' },
  del:       { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Eliminar', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  online:    { bg:'Онлайн', ru:'Онлайн', uk:'Онлайн', en:'Online', de:'Online', fr:'En ligne', es:'En línea', 'es-MX':'En línea', it:'Online', pt:'Online', ar:'متصل', hi:'ऑनलाइन', ja:'オンライン', ky:'Онлайн', 'zh-Hant':'線上' },
  offline:   { bg:'Офлайн', ru:'Офлайн', uk:'Офлайн', en:'Offline', de:'Offline', fr:'Hors ligne', es:'Sin conexión', 'es-MX':'Sin conexión', it:'Offline', pt:'Offline', ar:'غير متصل', hi:'ऑफ़लाइन', ja:'オフライン', ky:'Офлайн', 'zh-Hant':'離線' },
  uptime7:   { bg:'достъпност 7 дни', ru:'доступность 7 дней', uk:'доступність 7 днів', en:'7-day uptime', de:'Verfügbarkeit 7 Tage', fr:'disponibilité 7 jours', es:'disponibilidad 7 días', 'es-MX':'disponibilidad 7 días', it:'disponibilità 7 giorni', pt:'disponibilidade 7 dias', ar:'التوفر 7 أيام', hi:'7-दिन अपटाइम', ja:'7日間の稼働率', ky:'7 күндүк жеткиликтүүлүк', 'zh-Hant':'7天可用率' },
  resp:      { bg:'отговор', ru:'отклик', uk:'відгук', en:'response', de:'Antwort', fr:'réponse', es:'respuesta', 'es-MX':'respuesta', it:'risposta', pt:'resposta', ar:'الاستجابة', hi:'प्रतिक्रिया', ja:'応答', ky:'жооп', 'zh-Hant':'回應' },
  valid_to:  { bg:'Валиден до', ru:'Действует до', uk:'Дійсний до', en:'Valid until', de:'Gültig bis', fr:'Valide jusqu\'au', es:'Válido hasta', 'es-MX':'Válido hasta', it:'Valido fino al', pt:'Válido até', ar:'صالح حتى', hi:'तक मान्य', ja:'有効期限', ky:'Жарактуу мөөнөтү', 'zh-Hant':'有效期至' },
  days:      { bg:'дни', ru:'дней', uk:'днів', en:'days', de:'Tage', fr:'jours', es:'días', 'es-MX':'días', it:'giorni', pt:'dias', ar:'أيام', hi:'दिन', ja:'日', ky:'күн', 'zh-Hant':'天' },
  ssl_none:  { bg:'Сертификатът не е намерен', ru:'Сертификат не найден', uk:'Сертифікат не знайдено', en:'Certificate not found', de:'Zertifikat nicht gefunden', fr:'Certificat introuvable', es:'Certificado no encontrado', 'es-MX':'Certificado no encontrado', it:'Certificato non trovato', pt:'Certificado não encontrado', ar:'الشهادة غير موجودة', hi:'प्रमाणपत्र नहीं मिला', ja:'証明書が見つかりません', ky:'Сертификат табылган жок', 'zh-Hant':'找不到憑證' },
  price_none:{ bg:'Не открих цена на страницата', ru:'Цена на странице не найдена', uk:'Ціну на сторінці не знайдено', en:'No price found on the page', de:'Kein Preis auf der Seite gefunden', fr:'Aucun prix trouvé sur la page', es:'No se encontró precio en la página', 'es-MX':'No se encontró precio en la página', it:'Nessun prezzo trovato nella pagina', pt:'Nenhum preço encontrado na página', ar:'لم يُعثر على سعر في الصفحة', hi:'पृष्ठ पर कीमत नहीं मिली', ja:'ページに価格が見つかりません', ky:'Барактан баа табылган жок', 'zh-Hant':'頁面上找不到價格' },
  change:    { bg:'промяна', ru:'изменение', uk:'зміна', en:'change', de:'Änderung', fr:'variation', es:'cambio', 'es-MX':'cambio', it:'variazione', pt:'variação', ar:'التغيير', hi:'बदलाव', ja:'変化', ky:'өзгөрүү', 'zh-Hant':'變化' },
  added:     { bg:'Добавено', ru:'Добавлено', uk:'Додано', en:'Added', de:'Hinzugefügt', fr:'Ajouté', es:'Añadido', 'es-MX':'Agregado', it:'Aggiunto', pt:'Adicionado', ar:'مضاف', hi:'जोड़ा गया', ja:'追加', ky:'Кошулду', 'zh-Hant':'新增' },
  removed:   { bg:'Премахнато', ru:'Удалено', uk:'Вилучено', en:'Removed', de:'Entfernt', fr:'Supprimé', es:'Eliminado', 'es-MX':'Eliminado', it:'Rimosso', pt:'Removido', ar:'محذوف', hi:'हटाया गया', ja:'削除', ky:'Өчүрүлдү', 'zh-Hant':'移除' },
  no_change: { bg:'Без промени спрямо предишното посещение', ru:'Без изменений с прошлого раза', uk:'Без змін з минулого разу', en:'No changes since last visit', de:'Keine Änderungen seit dem letzten Besuch', fr:'Aucun changement depuis la dernière visite', es:'Sin cambios desde la última visita', 'es-MX':'Sin cambios desde la última visita', it:'Nessuna modifica dall\'ultima visita', pt:'Sem alterações desde a última visita', ar:'لا تغييرات منذ آخر زيارة', hi:'पिछली बार से कोई बदलाव नहीं', ja:'前回から変更なし', ky:'Акыркы жолудан бери өзгөрүү жок', 'zh-Hant':'自上次以來無變更' },
  first_snap:{ bg:'Първа снимка е записана — промените ще се видят при следващо пускане', ru:'Первый снимок сохранён — изменения будут видны при следующем запуске', uk:'Перший знімок збережено — зміни буде видно при наступному запуску', en:'First snapshot saved — changes will show on the next launch', de:'Erster Schnappschuss gespeichert — Änderungen beim nächsten Start', fr:'Premier instantané enregistré — les changements apparaîtront au prochain lancement', es:'Primera instantánea guardada — los cambios se verán en el próximo inicio', 'es-MX':'Primera instantánea guardada — los cambios se verán en el próximo inicio', it:'Prima istantanea salvata — le modifiche al prossimo avvio', pt:'Primeiro instantâneo guardado — as alterações aparecem no próximo arranque', ar:'حُفظت اللقطة الأولى — ستظهر التغييرات عند التشغيل التالي', hi:'पहला स्नैपशॉट सहेजा — बदलाव अगली बार दिखेंगे', ja:'最初のスナップショットを保存 — 変更は次回起動時に表示', ky:'Биринчи сүрөт сакталды — өзгөрүүлөр кийинки ачылганда көрүнөт', 'zh-Hant':'已儲存首次快照 — 變更將於下次啟動顯示' },
  board_note:{ bg:'Всичко следено на едно място — от пазените данни, без нови заявки.', ru:'Всё отслеживаемое в одном месте — из сохранённых данных, без новых запросов.', uk:'Усе відстежуване в одному місці — зі збережених даних, без нових запитів.', en:'Everything you watch in one place — from stored data, no new requests.', de:'Alles Überwachte an einem Ort — aus gespeicherten Daten, ohne neue Anfragen.', fr:'Tout ce que vous surveillez en un seul endroit — à partir des données enregistrées, sans nouvelles requêtes.', es:'Todo lo que vigilas en un solo lugar — de datos guardados, sin nuevas solicitudes.', 'es-MX':'Todo lo que vigilas en un solo lugar — de datos guardados, sin nuevas solicitudes.', it:'Tutto ciò che monitori in un posto — dai dati salvati, senza nuove richieste.', pt:'Tudo o que segue num só lugar — dos dados guardados, sem novos pedidos.', ar:'كل ما تراقبه في مكان واحد — من البيانات المحفوظة، دون طلبات جديدة.', hi:'सब कुछ एक जगह — सहेजे डेटा से, बिना नए अनुरोध।', ja:'監視中のすべてを一か所に — 保存データから、新規リクエストなし。', ky:'Көзөмөлдөгөндүн баары бир жерде — сакталган маалыматтан, жаңы сурамсыз.', 'zh-Hant':'所有監控項目集中一處 — 來自已儲存資料，不發送新請求。' },
  weekly:    { bg:'Седмичен отчет', ru:'Недельный отчёт', uk:'Тижневий звіт', en:'Weekly report', de:'Wochenbericht', fr:'Rapport hebdomadaire', es:'Informe semanal', 'es-MX':'Informe semanal', it:'Rapporto settimanale', pt:'Relatório semanal', ar:'التقرير الأسبوعي', hi:'साप्ताहिक रिपोर्ट', ja:'週間レポート', ky:'Жумалык отчет', 'zh-Hant':'每週報告' },
  share:     { bg:'Сподели / копирай', ru:'Поделиться / копировать', uk:'Поділитися / копіювати', en:'Share / copy', de:'Teilen / kopieren', fr:'Partager / copier', es:'Compartir / copiar', 'es-MX':'Compartir / copiar', it:'Condividi / copia', pt:'Partilhar / copiar', ar:'مشاركة / نسخ', hi:'साझा / कॉपी', ja:'共有 / コピー', ky:'Бөлүшүү / көчүрүү', 'zh-Hant':'分享 / 複製' },
  copied:    { bg:'Копирано', ru:'Скопировано', uk:'Скопійовано', en:'Copied', de:'Kopiert', fr:'Copié', es:'Copiado', 'es-MX':'Copiado', it:'Copiato', pt:'Copiado', ar:'تم النسخ', hi:'कॉपी हो गया', ja:'コピーしました', ky:'Көчүрүлдү', 'zh-Hant':'已複製' },
  nothing:   { bg:'Още нищо не се следи', ru:'Пока ничего не отслеживается', uk:'Поки нічого не відстежується', en:'Nothing is watched yet', de:'Noch nichts überwacht', fr:'Rien n\'est surveillé pour l\'instant', es:'Aún no se vigila nada', 'es-MX':'Aún no se vigila nada', it:'Non c\'è ancora nulla da monitorare', pt:'Ainda nada é seguido', ar:'لا شيء يُراقب بعد', hi:'अभी कुछ नहीं देखा जा रहा', ja:'まだ何も監視していません', ky:'Азырынча эч нерсе көзөмөлдөнбөйт', 'zh-Hant':'尚未監控任何項目' },
  incidents: { bg:'прекъсвания', ru:'сбоев', uk:'збоїв', en:'incidents', de:'Ausfälle', fr:'incidents', es:'incidencias', 'es-MX':'incidencias', it:'incidenti', pt:'incidentes', ar:'أعطال', hi:'घटनाएँ', ja:'障害', ky:'үзгүлтүктөр', 'zh-Hant':'事件' },
  export:    { bg:'Експорт (JSON)', ru:'Экспорт (JSON)', uk:'Експорт (JSON)', en:'Export (JSON)', de:'Export (JSON)', fr:'Exporter (JSON)', es:'Exportar (JSON)', 'es-MX':'Exportar (JSON)', it:'Esporta (JSON)', pt:'Exportar (JSON)', ar:'تصدير (JSON)', hi:'निर्यात (JSON)', ja:'エクスポート (JSON)', ky:'Экспорт (JSON)', 'zh-Hant':'匯出 (JSON)' },
  import:    { bg:'Импорт', ru:'Импорт', uk:'Імпорт', en:'Import', de:'Import', fr:'Importer', es:'Importar', 'es-MX':'Importar', it:'Importa', pt:'Importar', ar:'استيراد', hi:'आयात', ja:'インポート', ky:'Импорт', 'zh-Hant':'匯入' },
  io_note:   { bg:'Пренеси всички монитори и следения на друго устройство: експортирай, копирай текста, постави го тук на другия телефон и натисни „Импорт".', ru:'Перенесите все мониторы на другое устройство: экспорт → скопируйте текст → вставьте здесь на другом телефоне → «Импорт».', uk:'Перенесіть усі монітори на інший пристрій: експорт → скопіюйте текст → вставте тут на іншому телефоні → «Імпорт».', en:'Move all monitors to another device: export, copy the text, paste it here on the other phone and press "Import".', de:'Alle Monitore auf ein anderes Gerät übertragen: exportieren, Text kopieren, hier auf dem anderen Telefon einfügen und „Import" drücken.', fr:'Transférez tous les moniteurs vers un autre appareil : exportez, copiez le texte, collez-le ici sur l\'autre téléphone et appuyez sur « Importer ».', es:'Lleva todos los monitores a otro dispositivo: exporta, copia el texto, pégalo aquí en el otro teléfono y pulsa «Importar».', 'es-MX':'Lleva todos los monitores a otro dispositivo: exporta, copia el texto, pégalo aquí en el otro teléfono y pulsa «Importar».', it:'Sposta tutti i monitor su un altro dispositivo: esporta, copia il testo, incollalo qui sull\'altro telefono e premi «Importa».', pt:'Leve todos os monitores para outro dispositivo: exporte, copie o texto, cole-o aqui no outro telemóvel e prima «Importar».', ar:'انقل كل المراقبات إلى جهاز آخر: صدّر، انسخ النص، الصقه هنا على الهاتف الآخر واضغط «استيراد».', hi:'सभी मॉनिटर दूसरे डिवाइस पर ले जाएँ: निर्यात करें, टेक्स्ट कॉपी करें, दूसरे फ़ोन में यहाँ पेस्ट करें और "आयात" दबाएँ।', ja:'すべてのモニターを別の端末へ：エクスポート→テキストをコピー→別の端末でここに貼り付け→「インポート」。', ky:'Бардык мониторлорду башка түзмөккө көчүр: экспорттоп, текстти көчүрүп, башка телефондо бул жерге коюп «Импорт» бас.', 'zh-Hant':'將所有監控移至其他裝置：匯出、複製文字、在另一支手機此處貼上並按「匯入」。' },
  imported:  { bg:'Импортирано', ru:'Импортировано', uk:'Імпортовано', en:'Imported', de:'Importiert', fr:'Importé', es:'Importado', 'es-MX':'Importado', it:'Importato', pt:'Importado', ar:'تم الاستيراد', hi:'आयात हो गया', ja:'インポートしました', ky:'Импорттолду', 'zh-Hant':'已匯入' },
  bad_json:  { bg:'Невалиден текст', ru:'Неверный текст', uk:'Невірний текст', en:'Invalid text', de:'Ungültiger Text', fr:'Texte invalide', es:'Texto no válido', 'es-MX':'Texto no válido', it:'Testo non valido', pt:'Texto inválido', ar:'نص غير صالح', hi:'अमान्य टेक्स्ट', ja:'無効なテキスト', ky:'Жараксыз текст', 'zh-Hant':'無效文字' },
  templates: { bg:'Готови шаблони за монитори', ru:'Готовые шаблоны мониторов', uk:'Готові шаблони моніторів', en:'Ready monitor templates', de:'Fertige Monitor-Vorlagen', fr:'Modèles de moniteurs prêts', es:'Plantillas de monitor listas', 'es-MX':'Plantillas de monitor listas', it:'Modelli di monitor pronti', pt:'Modelos de monitor prontos', ar:'قوالب مراقبة جاهزة', hi:'तैयार मॉनिटर टेम्पलेट', ja:'モニターのテンプレート', ky:'Даяр монитор үлгүлөрү', 'zh-Hant':'現成監控範本' },
  tpl_id:    { bg:'Име на канала / потребителя', ru:'Имя канала / пользователя', uk:'Назва каналу / користувача', en:'Channel / user name', de:'Kanal-/Benutzername', fr:'Nom de la chaîne / utilisateur', es:'Nombre del canal / usuario', 'es-MX':'Nombre del canal / usuario', it:'Nome canale / utente', pt:'Nome do canal / utilizador', ar:'اسم القناة / المستخدم', hi:'चैनल / उपयोगकर्ता नाम', ja:'チャンネル / ユーザー名', ky:'Канал / колдонуучу аты', 'zh-Hant':'頻道 / 使用者名稱' },
  tpl_added: { bg:'Мониторът е добавен (виж „Табло")', ru:'Монитор добавлен (см. «Панель»)', uk:'Монітор додано (див. «Панель»)', en:'Monitor added (see "Dashboard")', de:'Monitor hinzugefügt (siehe „Übersicht")', fr:'Moniteur ajouté (voir « Tableau de bord »)', es:'Monitor añadido (ver «Panel»)', 'es-MX':'Monitor agregado (ver «Panel»)', it:'Monitor aggiunto (vedi «Pannello»)', pt:'Monitor adicionado (ver «Painel»)', ar:'أُضيف المراقب (انظر «اللوحة»)', hi:'मॉनिटर जोड़ा गया ("डैशबोर्ड" देखें)', ja:'モニターを追加しました（「ダッシュボード」参照）', ky:'Монитор кошулду («Панель» кара)', 'zh-Hant':'已新增監控（見「儀表板」）' }
};
function tr(k) { const e = L[k]; return e ? (e[getLang()] || e.en) : k; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmt(ts) { try { return new Date(ts).toLocaleString(); } catch (_) { return ''; } }

// ── Хранилище ──
function load() { try { return Object.assign({ up: [], ssl: [], price: [], diff: [] }, JSON.parse(localStorage.getItem(LSK) || '{}')); } catch (_) { return { up: [], ssl: [], price: [], diff: [] }; } }
export function loadTools() { return load(); }   // за таблото „Общ преглед" (home.js)
function save(d) { try { localStorage.setItem(LSK, JSON.stringify(d)); } catch (_) {} }
function loadSites() { try { return JSON.parse(localStorage.getItem(LSK_SITES) || '[]'); } catch (_) { return []; } }
const checked = new Set();   // „<таб>:<id>" проверени в това пускане — не се повтарят

// ── ПРОВЕРКИ ──
async function checkUp(it) {
  const t0 = Date.now();
  const r = await SW.checkUptime(it.url).catch(() => ({ online: false, status: 0 }));
  it.history = (it.history || []).concat([{ ts: Date.now(), ok: !!r.online, ms: Date.now() - t0, status: r.status || 0 }]).slice(-HIST_MAX);
}
async function checkSsl(it) {
  it.ts = Date.now(); const prev = it.notAfter || 0;
  try {
    const raw = await SW.fetchText('https://api.certspotter.com/v1/issuances?domain=' + encodeURIComponent(it.host) + '&include_subdomains=false&expand=dns_names&expand=not_after');
    const arr = JSON.parse(raw || '[]');
    let best = 0;
    (Array.isArray(arr) ? arr : []).forEach((c) => { if (c.revoked) return; const t = Date.parse(c.not_after || ''); if (t > best) best = t; });
    it.notAfter = best || prev;   // при празен/грешен отговор пазим последната известна дата
  } catch (_) { it.notAfter = prev; }
}
const PRICE_RE = /(?:(€|\$|£|₽|₴|₸|¥|₹)\s?(\d{1,3}(?:[ ., ]\d{3})*(?:[.,]\d{1,2})?))|(?:(\d{1,3}(?:[ ., ]\d{3})*(?:[.,]\d{1,2})?)\s?(€|\$|£|₽|₴|₸|¥|₹|лв\.?|USD|EUR|BGN|RUB|KGS|сом|UAH|грн|KZT|GBP|CHF|PLN|TRY|INR|JPY|CNY|BRL))/;
export function extractPrice(text, hint) {
  let hay = text || '';
  if (hint) { const i = hay.toLowerCase().indexOf(String(hint).toLowerCase()); if (i >= 0) hay = hay.slice(i, i + 400); }
  const m = PRICE_RE.exec(hay); if (!m) return null;
  const num = (m[2] || m[3] || '').replace(/[  ]/g, '');
  const cur = m[1] || m[4] || '';
  // 1.234,56 / 1,234.56 / 1234.56 → число
  let n = num;
  if (/[.,]\d{3}(?:[.,]\d{1,2})?$/.test(n) && /[.,]/.test(n.slice(0, -3))) n = n.replace(/[.,](?=\d{3})/g, '');
  n = n.replace(',', '.');
  const v = parseFloat(n);
  return isFinite(v) ? { value: v, raw: num + ' ' + cur } : null;
}
async function checkPrice(it) {
  const html = await SW.fetchText(it.url).catch(() => '');
  const p = html ? extractPrice(SW.htmlToText(html), it.hint) : null;
  it.ts = Date.now();
  if (p) it.history = (it.history || []).concat([{ ts: it.ts, value: p.value, raw: p.raw }]).slice(-HIST_MAX);
  else it.miss = true;
}
function sentences(text) { return (text || '').split(/(?<=[.!?。！？])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 12); }
export function textDiff(oldText, newText) {
  const a = sentences(oldText), b = sentences(newText);
  const sa = new Set(a), sb = new Set(b);
  return { added: b.filter((s) => !sa.has(s)).slice(0, 30), removed: a.filter((s) => !sb.has(s)).slice(0, 30) };
}
async function checkDiff(it) {
  const html = await SW.fetchText(it.url).catch(() => '');
  if (!html) return;
  const text = SW.htmlToText(html).slice(0, 60000);
  if (sentences(text).length < 3) return;   // празна/блокирана страница (или заглушка) — не броим като промяна
  if (it.text == null) { it.text = text; it.first = true; it.added = []; it.removed = []; }
  else { const d = textDiff(it.text, text); it.added = d.added; it.removed = d.removed; it.first = false; it.text = text; }
  it.ts = Date.now();
}
const CHECK = { up: checkUp, ssl: checkSsl, price: checkPrice, diff: checkDiff };

// Проверява само непроверените В ТОВА ПУСКАНЕ (или force за един елемент).
// Проверките вървят ПАРАЛЕЛНО (v1.0029): 5+ сайта с таймаут не бива да чакат един друг.
async function runOnce(tab, onlyId) {
  const d = load(); const list = d[tab] || []; const todo = [];
  for (const it of list) {
    const key = tab + ':' + it.id;
    if (onlyId ? it.id !== onlyId : checked.has(key)) continue;
    checked.add(key); todo.push(it);
  }
  await Promise.all(todo.map(async (it) => {
    try { await CHECK[tab](it); } catch (_) {}
    const cur = load(); const idx = (cur[tab] || []).findIndex((x) => x.id === it.id); if (idx >= 0) { cur[tab][idx] = it; save(cur); }
  }));
  return todo.length > 0;
}

// ── Помощни за „Табло" ──
export function upStats(h) {
  const week = Date.now() - 7 * 864e5; const w = (h || []).filter((x) => x.ts >= week);
  const ok = w.filter((x) => x.ok).length; const ms = w.length ? Math.round(w.reduce((s, x) => s + x.ms, 0) / w.length) : 0;
  let inc = 0; for (let i = 1; i < w.length; i++) if (w[i - 1].ok && !w[i].ok) inc++;
  return { pct: w.length ? Math.round(100 * ok / w.length) : null, ms, inc, last: h && h.length ? h[h.length - 1] : null };
}
function svgBars(h) {
  const last = (h || []).slice(-30); if (!last.length) return '';
  const max = Math.max.apply(null, last.map((x) => x.ms).concat([1]));
  const W = 30 * 8, H = 40;
  const bars = last.map((x, i) => { const hh = Math.max(3, Math.round(H * x.ms / max)); return '<rect x="' + (i * 8) + '" y="' + (H - hh) + '" width="6" height="' + hh + '" rx="1" fill="' + (x.ok ? '#16c784' : '#ea3943') + '"/>'; }).join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="44" preserveAspectRatio="none">' + bars + '</svg>';
}
function weeklyReport(state) {
  const d = load(); const lines = [tr('weekly') + ' — ' + new Date().toLocaleDateString()];
  d.up.forEach((it) => { const s = upStats(it.history); lines.push('• ' + it.url + ': ' + (s.pct == null ? '—' : s.pct + '% ' + tr('uptime7')) + ', ' + s.ms + ' ms, ' + s.inc + ' ' + tr('incidents')); });
  d.ssl.forEach((it) => { const days = it.notAfter ? Math.floor((it.notAfter - Date.now()) / 864e5) : null; lines.push('• SSL ' + it.host + ': ' + (days == null ? tr('ssl_none') : days + ' ' + tr('days'))); });
  d.price.forEach((it) => { const h = it.history || []; const l = h[h.length - 1], p = h.length > 1 ? h[0] : null; lines.push('• ' + it.url + ': ' + (l ? l.raw + (p ? ' (' + tr('change') + ' ' + (l.value - p.value >= 0 ? '+' : '') + (l.value - p.value).toFixed(2) + ')' : '') : tr('price_none'))); });
  d.diff.forEach((it) => lines.push('• ' + it.url + ': +' + (it.added || []).length + ' / −' + (it.removed || []).length));
  loadSites().filter((w) => w.tab !== 'now').forEach((w) => lines.push('• ' + w.url + (w.phrase ? ' „' + w.phrase + '"' : '') + ': ' + (w.lastResult || '—')));
  (state.monitors || []).forEach((m) => lines.push('• ' + (m.name || m.url) + ': ' + (m.lastMatch ? '✅ ' + fmt(m.lastMatch) : (m.lastStatus || '—'))));
  return lines.join('\n');
}
async function shareText(text) {
  try { if (navigator.share) { await navigator.share({ text }); return true; } } catch (_) {}
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  try { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; } catch (_) { return false; }
}
const TPL = [
  { key: 'Telegram', ic: '✈️', url: (v) => 'https://rsshub.app/telegram/channel/' + v },
  { key: 'YouTube', ic: '▶️', url: (v) => 'https://www.youtube.com/feeds/videos.xml?channel_id=' + v },
  { key: 'Reddit', ic: '👽', url: (v) => 'https://www.reddit.com/r/' + v + '/.rss' },
  { key: 'GitHub', ic: '🐙', url: (v) => 'https://github.com/' + v + '/releases.atom' }
];

// ── ЕКРАН ──
const TABS = ['up', 'ssl', 'price', 'diff', 'board', 'io'];
let active = 'up';
let styled = false;
function injectStyles() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
  .tools-wrap .mkt-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:10px;position:sticky;top:0;z-index:5;background:rgba(127,127,127,.08);border-bottom:1px solid rgba(128,128,128,.25);border-radius:0 0 12px 12px}
  .tools-wrap .mkt-tab{flex:1 1 30%;min-width:64px;padding:10px 8px;border-radius:12px;border:1.5px solid rgba(128,128,128,.45);background:rgba(127,127,127,.12);color:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;text-align:center}
  .tools-wrap .mkt-tab.active{background:#2b6cff;border-color:#2b6cff;color:#fff}
  .tools-wrap .mkt-body{padding:10px}
  .tools-wrap .inp{display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:11px 12px;border-radius:10px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font-size:15px}
  .tools-wrap .ok{color:#16c784}.tools-wrap .bad{color:#ea3943}.tools-wrap .warn{color:#f5a623}
  .tools-wrap .diffline{padding:4px 8px;border-radius:6px;margin:3px 0;font-size:13px}
  .tools-wrap .diffline.add{background:rgba(22,199,132,.15)}.tools-wrap .diffline.rm{background:rgba(234,57,67,.15);text-decoration:line-through}
  .tools-wrap textarea.inp{min-height:110px;font-family:monospace;font-size:12px}
  `;
  document.head.appendChild(s);
}

export function renderTools(ctx) {
  injectStyles();
  const { state } = ctx;
  if (ctx.params && ctx.params.tab && TABS.includes(ctx.params.tab)) active = ctx.params.tab;   // от таблото „Общ преглед"
  const wrap = document.createElement('div'); wrap.className = 'tools-wrap';
  draw();
  function draw() {
    wrap.innerHTML = '<div class="mkt-tabs">' + TABS.map((k) => '<button class="mkt-tab' + (k === active ? ' active' : '') + '" data-tab="' + k + '">' + esc(tr('tab_' + k)) + '</button>').join('') + '</div><div class="mkt-body" id="tools-body"></div>';
    wrap.querySelectorAll('.mkt-tab').forEach((b) => b.addEventListener('click', () => { active = b.getAttribute('data-tab'); draw(); }));
    const body = wrap.querySelector('#tools-body');
    if (active === 'board') return drawBoard(body);
    if (active === 'io') return drawIo(body);
    drawList(body, active);
  }

  // Табове 1–4: форма + списък + проверка „веднъж на пускане"
  function drawList(body, tab) {
    const d = load(); const list = d[tab];
    let form = '<p class="muted">' + esc(tr('once_note')) + '</p>';
    form += '<input class="inp" id="t-url" placeholder="' + esc(tr(tab === 'ssl' ? 'host' : 'url')) + '" />';
    if (tab === 'price') form += '<input class="inp" id="t-hint" placeholder="' + esc(tr('hint')) + '" />';
    form += '<button class="btn" id="t-add">' + esc(tr('add')) + '</button>';
    body.innerHTML = form + '<div id="t-list" style="margin-top:12px"></div>';
    body.querySelector('#t-add').addEventListener('click', async () => {
      let v = body.querySelector('#t-url').value.trim(); if (!v) return;
      const it = { id: 't' + Date.now() };
      if (tab === 'ssl') { it.host = v.replace(/^https?:\/\//, '').split('/')[0]; }
      else { if (!/^https?:\/\//i.test(v)) v = 'https://' + v; it.url = v; }
      if (tab === 'price') it.hint = (body.querySelector('#t-hint').value || '').trim();
      const cur = load(); cur[tab].push(it); save(cur);
      body.querySelector('#t-url').value = '';
      drawRows(); await runOnce(tab, it.id); drawRows();
    });
    drawRows();
    // Първо отваряне на таба в това пускане → една проверка на непроверените.
    runOnce(tab).then((ran) => { if (ran && active === tab) drawRows(); });

    function drawRows() {
      const cur = load(); const rows = cur[tab];
      const box = body.querySelector('#t-list'); if (!box) return;
      box.innerHTML = rows.length ? rows.map((it) => '<div class="card">' + rowHtml(tab, it) + '<div class="row" style="gap:8px;margin-top:8px"><button class="btn ghost sm" data-check="' + it.id + '">' + esc(tr('check_now')) + '</button><button class="btn ghost sm" data-del="' + it.id + '">' + esc(tr('del')) + '</button></div></div>').join('') : '<p class="muted">' + esc(tr('nothing')) + '</p>';
      box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const c = load(); c[tab] = c[tab].filter((x) => x.id !== b.getAttribute('data-del')); save(c); drawRows(); }));
      box.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', async () => { b.textContent = '…'; await runOnce(tab, b.getAttribute('data-check')); drawRows(); }));
    }
  }
  function rowHtml(tab, it) {
    if (tab === 'up') {
      const s = upStats(it.history); const last = s.last;
      return '<b>' + esc(it.url) + '</b>' + sampleTag(it) + '<div style="margin:6px 0">' + svgBars(it.history) + '</div><div class="muted" style="font-size:13px">' +
        (last ? '<span class="' + (last.ok ? 'ok' : 'bad') + '">● ' + esc(tr(last.ok ? 'online' : 'offline')) + '</span> · ' + last.ms + ' ms ' + esc(tr('resp')) + ' · ' + esc(fmt(last.ts)) : '…') +
        (s.pct != null ? '<br>' + s.pct + '% ' + esc(tr('uptime7')) + ' · ' + s.ms + ' ms · ' + s.inc + ' ' + esc(tr('incidents')) : '') + '</div>';
    }
    if (tab === 'ssl') {
      const days = it.notAfter ? Math.floor((it.notAfter - Date.now()) / 864e5) : null;
      const cls = days == null ? 'muted' : (days < 7 ? 'bad' : (days < 30 ? 'warn' : 'ok'));
      return '<b>' + esc(it.host) + '</b>' + sampleTag(it) + '<div class="' + cls + '" style="font-size:20px;margin:4px 0">' + (it.ts ? (days == null ? esc(tr('ssl_none')) : '🔒 ' + days + ' ' + esc(tr('days'))) : '…') + '</div><div class="muted" style="font-size:12px">' + (it.notAfter ? esc(tr('valid_to')) + ' ' + esc(new Date(it.notAfter).toLocaleDateString()) : '') + '</div>';
    }
    if (tab === 'price') {
      const h = it.history || []; const l = h[h.length - 1]; const p = h.length > 1 ? h[h.length - 2] : null;
      const delta = l && p ? l.value - p.value : 0;
      return '<b>' + esc(it.url) + '</b>' + sampleTag(it) + (it.hint ? ' <span class="muted">— ' + esc(it.hint) + '</span>' : '') +
        '<div style="font-size:22px;margin:4px 0">' + (l ? esc(l.raw) + (p ? ' <span class="' + (delta > 0 ? 'bad' : (delta < 0 ? 'ok' : 'muted')) + '" style="font-size:14px">' + (delta > 0 ? '▲' : (delta < 0 ? '▼' : '=')) + ' ' + Math.abs(delta).toFixed(2) + '</span>' : '') : (it.ts ? '<span class="muted" style="font-size:14px">' + esc(tr('price_none')) + '</span>' : '…')) + '</div>' +
        (h.length ? '<div class="muted" style="font-size:12px">' + h.slice(-6).map((x) => esc(new Date(x.ts).toLocaleDateString()) + ': ' + esc(x.raw)).join(' · ') + '</div>' : '');
    }
    // diff
    const add = it.added || [], rm = it.removed || [];
    let html = '<b>' + esc(it.url) + '</b>' + sampleTag(it) + '<div class="muted" style="font-size:12px">' + (it.ts ? esc(fmt(it.ts)) : '…') + '</div>';
    if (it.ts && it.first) html += '<p class="muted">' + esc(tr('first_snap')) + '</p>';
    else if (it.ts && !add.length && !rm.length) html += '<p class="muted">' + esc(tr('no_change')) + '</p>';
    else if (it.ts) {
      if (add.length) html += '<div class="ok" style="font-size:12px;margin-top:6px">+ ' + esc(tr('added')) + ' (' + add.length + ')</div>' + add.slice(0, 10).map((s) => '<div class="diffline add">' + esc(s) + '</div>').join('');
      if (rm.length) html += '<div class="bad" style="font-size:12px;margin-top:6px">− ' + esc(tr('removed')) + ' (' + rm.length + ')</div>' + rm.slice(0, 10).map((s) => '<div class="diffline rm">' + esc(s) + '</div>').join('');
    }
    return html;
  }

  // Таб 5: Табло (само от пазени данни)
  function drawBoard(body) {
    const d = load(); const sites = loadSites().filter((w) => w.tab !== 'now'); const mons = state.monitors || [];
    const dot = (ok) => '<span class="' + (ok === null ? 'muted' : (ok ? 'ok' : 'bad')) + '">●</span> ';
    const rows = [];
    d.up.forEach((it) => { const s = upStats(it.history); rows.push(dot(s.last ? s.last.ok : null) + esc(it.url) + ' <span class="muted">' + (s.pct == null ? '' : s.pct + '% · ' + s.ms + ' ms') + '</span>'); });
    d.ssl.forEach((it) => { const days = it.notAfter ? Math.floor((it.notAfter - Date.now()) / 864e5) : null; rows.push(dot(days == null ? null : days > 7) + '🔒 ' + esc(it.host) + ' <span class="muted">' + (days == null ? '' : days + ' ' + esc(tr('days'))) + '</span>'); });
    d.price.forEach((it) => { const h = it.history || []; const l = h[h.length - 1]; rows.push(dot(l ? true : null) + '💰 ' + esc(it.url) + ' <span class="muted">' + (l ? esc(l.raw) : '') + '</span>'); });
    d.diff.forEach((it) => rows.push(dot(it.ts ? !(it.added || []).length && !(it.removed || []).length : null) + '📝 ' + esc(it.url) + ' <span class="muted">+' + (it.added || []).length + ' / −' + (it.removed || []).length + '</span>'));
    sites.forEach((w) => rows.push(dot(w.lastCheck ? !w.triggered : null) + '🌐 ' + esc(w.url) + ' <span class="muted">' + esc(w.lastResult || '') + '</span>'));
    mons.forEach((m) => rows.push(dot(m.lastCheck ? !m.lastError : null) + '📡 ' + esc(m.name || m.url) + ' <span class="muted">' + (m.lastMatch ? '✅ ' + esc(fmt(m.lastMatch)) : esc(m.lastStatus || '')) + '</span>'));
    body.innerHTML = '<p class="muted">' + esc(tr('board_note')) + '</p>' +
      (rows.length ? rows.map((r) => '<div class="card" style="padding:10px;font-size:14px">' + r + '</div>').join('') : '<p class="muted">' + esc(tr('nothing')) + '</p>') +
      '<h3 style="margin:14px 0 6px">' + esc(tr('weekly')) + '</h3><pre class="card" style="white-space:pre-wrap;font-size:12px" id="b-rep"></pre><button class="btn" id="b-share">' + esc(tr('share')) + '</button>';
    const rep = weeklyReport(state); body.querySelector('#b-rep').textContent = rep;
    body.querySelector('#b-share').addEventListener('click', async (e) => { if (await shareText(rep)) e.target.textContent = '✓ ' + tr('copied'); });
  }

  // Таб 6: Пренос (експорт/импорт) + шаблони
  function drawIo(body) {
    body.innerHTML = '<p class="muted">' + esc(tr('io_note')) + '</p>' +
      '<div class="row" style="gap:8px"><button class="btn" id="io-exp">' + esc(tr('export')) + '</button><button class="btn ghost" id="io-imp">' + esc(tr('import')) + '</button></div>' +
      '<textarea class="inp" id="io-txt"></textarea><div class="muted" id="io-msg"></div>' +
      '<h3 style="margin:16px 0 6px">' + esc(tr('templates')) + '</h3><input class="inp" id="tpl-id" placeholder="' + esc(tr('tpl_id')) + '" />' +
      '<div class="row" style="gap:8px;flex-wrap:wrap">' + TPL.map((t) => '<button class="btn ghost sm" data-tpl="' + t.key + '">' + t.ic + ' ' + t.key + '</button>').join('') + '</div><div class="muted" id="tpl-msg"></div>';
    const txt = body.querySelector('#io-txt'), msg = body.querySelector('#io-msg');
    body.querySelector('#io-exp').addEventListener('click', async () => {
      const bundle = { app: 'pupikes-site-monitor', v: 1, ts: Date.now(), monitors: state.monitors || [], siteWatch: loadSites(), tools: load() };
      const s = JSON.stringify(bundle); txt.value = s; if (await shareText(s)) msg.textContent = '✓ ' + tr('copied');
    });
    body.querySelector('#io-imp').addEventListener('click', async () => {
      let b; try { b = JSON.parse(txt.value.trim()); } catch (_) { msg.textContent = tr('bad_json'); return; }
      if (!b || typeof b !== 'object') { msg.textContent = tr('bad_json'); return; }
      if (Array.isArray(b.monitors)) { const have = new Set((state.monitors || []).map((m) => m.url)); b.monitors.forEach((m) => { if (m && m.url && !have.has(m.url)) state.monitors.push(m); }); await saveState(state); }
      if (Array.isArray(b.siteWatch)) { const cur = loadSites(); const have = new Set(cur.map((w) => w.id)); b.siteWatch.forEach((w) => { if (w && w.id && !have.has(w.id)) cur.push(w); }); try { localStorage.setItem(LSK_SITES, JSON.stringify(cur)); } catch (_) {} }
      if (b.tools && typeof b.tools === 'object') { const cur = load(); ['up', 'ssl', 'price', 'diff'].forEach((k) => { const have = new Set(cur[k].map((x) => x.id)); (b.tools[k] || []).forEach((x) => { if (x && x.id && !have.has(x.id)) cur[k].push(x); }); }); save(cur); }
      msg.textContent = '✓ ' + tr('imported');
    });
    body.querySelectorAll('[data-tpl]').forEach((btn) => btn.addEventListener('click', async () => {
      const v = body.querySelector('#tpl-id').value.trim(); if (!v) return;
      const t = TPL.find((x) => x.key === btn.getAttribute('data-tpl'));
      state.monitors = state.monitors || [];
      state.monitors.push({ id: 'm' + Date.now(), name: t.key + ': ' + v, sourceType: 'rss', url: t.url(v), rule: 'new', keywords: '', freq: 'daily', paused: false, lastCheck: null, lastMatch: null, lastStatus: '' });
      await saveState(state); body.querySelector('#tpl-msg').textContent = '✓ ' + tr('tpl_added');
    }));
  }
  return wrap;
}
