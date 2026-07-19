// Version: 1.0014
// Price Watch — наблюдение на цени (крипто + валути) с прагове и известия.
// Пренесено от самостоятелното приложение price-watch-bot по молба „всички услуги
// в едно приложение": същите безплатни публични API без ключове и без акаунти.
//
// Източници (редът е важен — поука от watch20):
//   крипто: 1) https://data-api.binance.vision (публичен Binance proxy — работи и
//              където api.binance.com е блокиран) 2) api.binance.com 3) CoinGecko
//   валути: https://open.er-api.com/v6/latest/USD (кеш 60с)
//
// Известия: Capacitor LocalNotifications (СИНХРОННО от window.Capacitor.Plugins —
// динамичният import увисва в WebView), иначе Web Notifications; иначе само визуално.
// Всичко се пази ЛОКАЛНО (localStorage) — без облак, без акаунт.
import { esc, setStatus } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  pw_title: { bg:'Price Watch — следи цени', ru:'Price Watch — следи за ценами', uk:'Price Watch — стеж за цінами', en:'Price Watch — track prices', de:'Price Watch — Preise beobachten', fr:'Price Watch — suivre les prix', es:'Price Watch — vigila precios', 'es-MX':'Price Watch — vigila precios', it:'Price Watch — monitora i prezzi', pt:'Price Watch — acompanhe preços', ar:'Price Watch — راقب الأسعار', hi:'Price Watch — कीमतें देखें', ja:'Price Watch — 価格を監視', ky:'Price Watch — бааларды байкоо', 'zh-Hant':'Price Watch — 追蹤價格' },
  pw_notice: { bg:'Постави праг на крипто или валутен курс и получи известие, когато се достигне. Курсове от Binance / CoinGecko / open.er-api.com — безплатни публични API без ключ. Всичко се пази локално, без акаунт. Не е финансов съвет.', ru:'Задай порог для криптовалюты или курса валюты и получи уведомление при его достижении. Курсы от Binance / CoinGecko / open.er-api.com — бесплатные публичные API без ключа. Всё хранится локально, без аккаунта. Не финансовый совет.', uk:'Задай поріг для криптовалюти або курсу валюти й отримай сповіщення при досягненні. Курси від Binance / CoinGecko / open.er-api.com — безкоштовні публічні API без ключа. Усе зберігається локально, без акаунта. Не фінансова порада.', en:'Set a threshold on a crypto or currency rate and get notified when it is reached. Rates from Binance / CoinGecko / open.er-api.com — free public APIs, no key. Everything is stored locally, no account. Not financial advice.', de:'Setze eine Schwelle für Krypto- oder Wechselkurse und werde benachrichtigt, wenn sie erreicht wird. Kurse von Binance / CoinGecko / open.er-api.com — kostenlose öffentliche APIs ohne Schlüssel. Alles wird lokal gespeichert, kein Konto. Keine Anlageberatung.', fr:'Fixe un seuil sur une crypto ou un taux de change et sois averti quand il est atteint. Taux de Binance / CoinGecko / open.er-api.com — API publiques gratuites sans clé. Tout est stocké localement, sans compte. Pas un conseil financier.', es:'Pon un umbral a una cripto o tipo de cambio y recibe un aviso cuando se alcance. Tasas de Binance / CoinGecko / open.er-api.com — API públicas gratuitas sin clave. Todo se guarda localmente, sin cuenta. No es asesoramiento financiero.', 'es-MX':'Pon un umbral a una cripto o tipo de cambio y recibe un aviso cuando se alcance. Tasas de Binance / CoinGecko / open.er-api.com — API públicas gratuitas sin clave. Todo se guarda localmente, sin cuenta. No es asesoría financiera.', it:'Imposta una soglia su una cripto o un tasso di cambio e ricevi una notifica al raggiungimento. Tassi da Binance / CoinGecko / open.er-api.com — API pubbliche gratuite senza chiave. Tutto è salvato localmente, senza account. Non è un consiglio finanziario.', pt:'Defina um limite para uma cripto ou taxa de câmbio e receba um aviso quando for atingido. Taxas de Binance / CoinGecko / open.er-api.com — APIs públicas gratuitas sem chave. Tudo fica local, sem conta. Não é aconselhamento financeiro.', ar:'ضع حدًا لسعر عملة رقمية أو سعر صرف واحصل على إشعار عند بلوغه. الأسعار من Binance / CoinGecko / open.er-api.com — واجهات عامة مجانية دون مفتاح. كل شيء محفوظ محليًا دون حساب. ليست نصيحة مالية.', hi:'क्रिप्टो या मुद्रा दर पर सीमा लगाएं और पहुंचने पर सूचना पाएं। दरें Binance / CoinGecko / open.er-api.com से — मुफ़्त सार्वजनिक API, बिना key। सब कुछ लोकल रहता है, बिना खाते। वित्तीय सलाह नहीं।', ja:'暗号資産や為替レートにしきい値を設定し、到達時に通知を受け取ります。レートは Binance / CoinGecko / open.er-api.com — キー不要の無料公開 API。すべて端末内に保存、アカウント不要。投資助言ではありません。', ky:'Крипто же валюта курсуна чек кой да, жеткенде билдирүү ал. Курстар Binance / CoinGecko / open.er-api.com — ачкычсыз акысыз ачык API. Баары жергиликтүү сакталат, аккаунтсуз. Каржы кеңеши эмес.', 'zh-Hant':'為加密貨幣或匯率設定門檻，達到時收到通知。匯率來自 Binance / CoinGecko / open.er-api.com — 免費公開 API，無需金鑰。全部儲存在本機，無需帳號。非投資建議。' },
  pw_master: { bg:'Наблюдението е включено', ru:'Наблюдение включено', uk:'Спостереження увімкнено', en:'Watching is ON', de:'Beobachtung ist AN', fr:'Surveillance activée', es:'Vigilancia activada', 'es-MX':'Vigilancia activada', it:'Monitoraggio attivo', pt:'Monitoramento ligado', ar:'المراقبة مفعّلة', hi:'निगरानी चालू है', ja:'監視オン', ky:'Байкоо күйүк', 'zh-Hant':'監看已開啟' },
  pw_kind_crypto: { bg:'Крипто (USD)', ru:'Крипто (USD)', uk:'Крипто (USD)', en:'Crypto (USD)', de:'Krypto (USD)', fr:'Crypto (USD)', es:'Cripto (USD)', 'es-MX':'Cripto (USD)', it:'Cripto (USD)', pt:'Cripto (USD)', ar:'كريبتو (USD)', hi:'क्रिप्टो (USD)', ja:'暗号資産（USD）', ky:'Крипто (USD)', 'zh-Hant':'加密貨幣（USD）' },
  pw_kind_fx: { bg:'Валута (за 1 USD)', ru:'Валюта (за 1 USD)', uk:'Валюта (за 1 USD)', en:'Currency (per 1 USD)', de:'Währung (pro 1 USD)', fr:'Devise (pour 1 USD)', es:'Divisa (por 1 USD)', 'es-MX':'Divisa (por 1 USD)', it:'Valuta (per 1 USD)', pt:'Moeda (por 1 USD)', ar:'عملة (لكل 1 USD)', hi:'मुद्रा (प्रति 1 USD)', ja:'通貨（1 USD あたり）', ky:'Валюта (1 USD үчүн)', 'zh-Hant':'貨幣（每 1 USD）' },
  pw_cond_below: { bg:'падне под', ru:'опустится ниже', uk:'опуститься нижче', en:'drops below', de:'fällt unter', fr:'descend sous', es:'cae por debajo de', 'es-MX':'cae por debajo de', it:'scende sotto', pt:'cai abaixo de', ar:'ينخفض دون', hi:'नीचे गिरे', ja:'以下に下落', ky:'төмөн түшсө', 'zh-Hant':'跌破' },
  pw_cond_above: { bg:'се качи над', ru:'поднимется выше', uk:'підніметься вище', en:'rises above', de:'steigt über', fr:'monte au-dessus de', es:'sube por encima de', 'es-MX':'sube por encima de', it:'sale sopra', pt:'sobe acima de', ar:'يرتفع فوق', hi:'ऊपर जाए', ja:'以上に上昇', ky:'жогору көтөрүлсө', 'zh-Hant':'升破' },
  pw_target_ph: { bg:'праг (число)', ru:'порог (число)', uk:'поріг (число)', en:'threshold (number)', de:'Schwelle (Zahl)', fr:'seuil (nombre)', es:'umbral (número)', 'es-MX':'umbral (número)', it:'soglia (numero)', pt:'limite (número)', ar:'الحد (رقم)', hi:'सीमा (संख्या)', ja:'しきい値（数値）', ky:'чек (сан)', 'zh-Hant':'門檻（數字）' },
  pw_freq_15: { bg:'на 15 минути', ru:'каждые 15 минут', uk:'кожні 15 хвилин', en:'every 15 minutes', de:'alle 15 Minuten', fr:'toutes les 15 minutes', es:'cada 15 minutos', 'es-MX':'cada 15 minutos', it:'ogni 15 minuti', pt:'a cada 15 minutos', ar:'كل 15 دقيقة', hi:'हर 15 मिनट', ja:'15分ごと', ky:'ар 15 мүнөт', 'zh-Hant':'每 15 分鐘' },
  pw_freq_1h: { bg:'на 1 час', ru:'каждый час', uk:'щогодини', en:'every hour', de:'jede Stunde', fr:'toutes les heures', es:'cada hora', 'es-MX':'cada hora', it:'ogni ora', pt:'a cada hora', ar:'كل ساعة', hi:'हर घंटे', ja:'1時間ごと', ky:'ар саат', 'zh-Hant':'每小時' },
  pw_freq_daily: { bg:'веднъж дневно', ru:'раз в день', uk:'раз на день', en:'once a day', de:'einmal täglich', fr:'une fois par jour', es:'una vez al día', 'es-MX':'una vez al día', it:'una volta al giorno', pt:'uma vez por dia', ar:'مرة يوميًا', hi:'दिन में एक बार', ja:'1日1回', ky:'күнүнө бир жолу', 'zh-Hant':'每天一次' },
  pw_add: { bg:'➕ Добави наблюдение', ru:'➕ Добавить наблюдение', uk:'➕ Додати спостереження', en:'➕ Add watch', de:'➕ Beobachtung hinzufügen', fr:'➕ Ajouter une surveillance', es:'➕ Añadir vigilancia', 'es-MX':'➕ Añadir vigilancia', it:'➕ Aggiungi monitoraggio', pt:'➕ Adicionar', ar:'➕ أضف مراقبة', hi:'➕ निगरानी जोड़ें', ja:'➕ 監視を追加', ky:'➕ Байкоо кошуу', 'zh-Hant':'➕ 新增監看' },
  pw_check_now: { bg:'↻ Провери сега', ru:'↻ Проверить сейчас', uk:'↻ Перевірити зараз', en:'↻ Check now', de:'↻ Jetzt prüfen', fr:'↻ Vérifier maintenant', es:'↻ Comprobar ahora', 'es-MX':'↻ Comprobar ahora', it:'↻ Controlla ora', pt:'↻ Verificar agora', ar:'↻ تحقق الآن', hi:'↻ अभी जांचें', ja:'↻ 今すぐ確認', ky:'↻ Азыр текшерүү', 'zh-Hant':'↻ 立即檢查' },
  pw_notif_btn: { bg:'🔔 Разреши известия', ru:'🔔 Разрешить уведомления', uk:'🔔 Дозволити сповіщення', en:'🔔 Allow notifications', de:'🔔 Benachrichtigungen erlauben', fr:'🔔 Autoriser les notifications', es:'🔔 Permitir notificaciones', 'es-MX':'🔔 Permitir notificaciones', it:'🔔 Consenti notifiche', pt:'🔔 Permitir notificações', ar:'🔔 السماح بالإشعارات', hi:'🔔 सूचनाएं अनुमति दें', ja:'🔔 通知を許可', ky:'🔔 Билдирүүлөргө уруксат', 'zh-Hant':'🔔 允許通知' },
  pw_empty: { bg:'Няма наблюдения още — добави първото отгоре.', ru:'Наблюдений пока нет — добавь первое выше.', uk:'Спостережень поки немає — додай перше вище.', en:'No watches yet — add the first one above.', de:'Noch keine Beobachtungen — füge oben die erste hinzu.', fr:'Aucune surveillance — ajoute la première ci-dessus.', es:'Aún no hay vigilancias — añade la primera arriba.', 'es-MX':'Aún no hay vigilancias — añade la primera arriba.', it:'Nessun monitoraggio — aggiungi il primo sopra.', pt:'Nenhum monitoramento — adicione o primeiro acima.', ar:'لا مراقبات بعد — أضف الأولى أعلاه.', hi:'अभी कोई निगरानी नहीं — ऊपर पहली जोड़ें।', ja:'まだ監視がありません — 上から追加してください。', ky:'Азырынча байкоо жок — биринчисин жогорудан кош.', 'zh-Hant':'尚無監看項目 — 請在上方新增。' },
  pw_status_watching: { bg:'наблюдавам', ru:'наблюдаю', uk:'спостерігаю', en:'watching', de:'beobachte', fr:'en surveillance', es:'vigilando', 'es-MX':'vigilando', it:'in monitoraggio', pt:'monitorando', ar:'قيد المراقبة', hi:'निगरानी में', ja:'監視中', ky:'байкоодо', 'zh-Hant':'監看中' },
  pw_status_hit: { bg:'ПРАГЪТ Е ДОСТИГНАТ', ru:'ПОРОГ ДОСТИГНУТ', uk:'ПОРІГ ДОСЯГНУТО', en:'THRESHOLD REACHED', de:'SCHWELLE ERREICHT', fr:'SEUIL ATTEINT', es:'UMBRAL ALCANZADO', 'es-MX':'UMBRAL ALCANZADO', it:'SOGLIA RAGGIUNTA', pt:'LIMITE ATINGIDO', ar:'تم بلوغ الحد', hi:'सीमा पहुंची', ja:'しきい値到達', ky:'ЧЕККЕ ЖЕТТИ', 'zh-Hant':'已達門檻' },
  pw_paused: { bg:'на пауза', ru:'на паузе', uk:'на паузі', en:'paused', de:'pausiert', fr:'en pause', es:'en pausa', 'es-MX':'en pausa', it:'in pausa', pt:'pausado', ar:'موقوف مؤقتًا', hi:'रोका गया', ja:'一時停止', ky:'тыныгууда', 'zh-Hant':'已暫停' },
  pw_last: { bg:'последно: {0}', ru:'последнее: {0}', uk:'останнє: {0}', en:'last: {0}', de:'zuletzt: {0}', fr:'dernier : {0}', es:'último: {0}', 'es-MX':'último: {0}', it:'ultimo: {0}', pt:'último: {0}', ar:'آخر قيمة: {0}', hi:'पिछला: {0}', ja:'直近: {0}', ky:'акыркы: {0}', 'zh-Hant':'最近：{0}' },
  pw_del: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Excluir', ar:'حذف', hi:'हटाएं', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  pw_pause: { bg:'Пауза', ru:'Пауза', uk:'Пауза', en:'Pause', de:'Pause', fr:'Pause', es:'Pausa', 'es-MX':'Pausa', it:'Pausa', pt:'Pausar', ar:'إيقاف مؤقت', hi:'रोकें', ja:'一時停止', ky:'Пауза', 'zh-Hant':'暫停' },
  pw_resume: { bg:'Пусни пак', ru:'Возобновить', uk:'Відновити', en:'Resume', de:'Fortsetzen', fr:'Reprendre', es:'Reanudar', 'es-MX':'Reanudar', it:'Riprendi', pt:'Retomar', ar:'استئناف', hi:'फिर शुरू करें', ja:'再開', ky:'Улантуу', 'zh-Hant':'繼續' },
  pw_need_target: { bg:'Въведи числов праг.', ru:'Введите числовой порог.', uk:'Введіть числовий поріг.', en:'Enter a numeric threshold.', de:'Gib eine numerische Schwelle ein.', fr:'Saisis un seuil numérique.', es:'Introduce un umbral numérico.', 'es-MX':'Introduce un umbral numérico.', it:'Inserisci una soglia numerica.', pt:'Digite um limite numérico.', ar:'أدخل حدًا رقميًا.', hi:'संख्यात्मक सीमा दर्ज करें।', ja:'数値のしきい値を入力してください。', ky:'Сандык чек киргиз.', 'zh-Hant':'請輸入數字門檻。' },
  pw_checking: { bg:'Проверявам цените…', ru:'Проверяю цены…', uk:'Перевіряю ціни…', en:'Checking prices…', de:'Prüfe Preise…', fr:'Vérification des prix…', es:'Comprobando precios…', 'es-MX':'Comprobando precios…', it:'Controllo prezzi…', pt:'Verificando preços…', ar:'جارٍ فحص الأسعار…', hi:'कीमतें जांच रहा…', ja:'価格を確認中…', ky:'Баалар текшерилүүдө…', 'zh-Hant':'正在檢查價格…' },
  pw_checked: { bg:'Проверено: {0} наблюдения.', ru:'Проверено: {0} наблюдений.', uk:'Перевірено: {0} спостережень.', en:'Checked: {0} watches.', de:'Geprüft: {0} Beobachtungen.', fr:'Vérifié : {0} surveillances.', es:'Comprobado: {0} vigilancias.', 'es-MX':'Comprobado: {0} vigilancias.', it:'Controllati: {0} monitoraggi.', pt:'Verificado: {0} monitoramentos.', ar:'تم الفحص: {0} مراقبة.', hi:'जांचा गया: {0} निगरानियां।', ja:'確認済み: {0} 件。', ky:'Текшерилди: {0} байкоо.', 'zh-Hant':'已檢查：{0} 項。' },
  pw_notif_title: { bg:'Price Watch — праг достигнат', ru:'Price Watch — порог достигнут', uk:'Price Watch — поріг досягнуто', en:'Price Watch — threshold reached', de:'Price Watch — Schwelle erreicht', fr:'Price Watch — seuil atteint', es:'Price Watch — umbral alcanzado', 'es-MX':'Price Watch — umbral alcanzado', it:'Price Watch — soglia raggiunta', pt:'Price Watch — limite atingido', ar:'Price Watch — تم بلوغ الحد', hi:'Price Watch — सीमा पहुंची', ja:'Price Watch — しきい値到達', ky:'Price Watch — чекке жетти', 'zh-Hant':'Price Watch — 已達門檻' },
  pw_err: { bg:'грешка: {0}', ru:'ошибка: {0}', uk:'помилка: {0}', en:'error: {0}', de:'Fehler: {0}', fr:'erreur : {0}', es:'error: {0}', 'es-MX':'error: {0}', it:'errore: {0}', pt:'erro: {0}', ar:'خطأ: {0}', hi:'त्रुटि: {0}', ja:'エラー: {0}', ky:'ката: {0}', 'zh-Hant':'錯誤：{0}' },
  pw_log_title: { bg:'Дневник', ru:'Журнал', uk:'Журнал', en:'Log', de:'Protokoll', fr:'Journal', es:'Registro', 'es-MX':'Registro', it:'Registro', pt:'Registro', ar:'السجل', hi:'लॉग', ja:'ログ', ky:'Журнал', 'zh-Hant':'記錄' },
  pw_bg_note: { bg:'Проверките вървят, докато приложението е отворено (на всяка минута се гледа кое наблюдение е узряло по своята честота).', ru:'Проверки идут, пока приложение открыто (каждую минуту проверяется, какое наблюдение созрело по своей частоте).', uk:'Перевірки тривають, поки застосунок відкритий (щохвилини перевіряється, яке спостереження дозріло за своєю частотою).', en:'Checks run while the app is open (every minute we see which watch is due per its frequency).', de:'Die Prüfungen laufen, solange die App geöffnet ist (jede Minute wird geprüft, welche Beobachtung laut ihrer Frequenz fällig ist).', fr:'Les vérifications tournent tant que l’app est ouverte (chaque minute, on regarde quelle surveillance est due selon sa fréquence).', es:'Las comprobaciones corren mientras la app está abierta (cada minuto se ve qué vigilancia toca según su frecuencia).', 'es-MX':'Las comprobaciones corren mientras la app está abierta (cada minuto se ve qué vigilancia toca según su frecuencia).', it:'I controlli girano finché l’app è aperta (ogni minuto si vede quale monitoraggio è dovuto secondo la sua frequenza).', pt:'As verificações rodam enquanto o app está aberto (a cada minuto vemos qual monitoramento venceu pela sua frequência).', ar:'تعمل الفحوص أثناء فتح التطبيق (كل دقيقة نرى أي مراقبة حان وقتها حسب تكرارها).', hi:'जांचें तब चलती हैं जब ऐप खुला हो (हर मिनट देखा जाता है कौन सी निगरानी अपनी आवृत्ति से देय है)।', ja:'チェックはアプリを開いている間に実行されます（毎分、各監視の頻度に応じて期限を確認）。', ky:'Текшерүүлөр колдонмо ачык турганда жүрөт (ар мүнөт кайсы байкоонун мөөнөтү келгени каралат).', 'zh-Hant':'檢查在應用程式開啟時執行（每分鐘依各自頻率判斷哪個監看到期）。' }
});

export const title = t('pw_title');

const LS_KEY = 'st_pricewatch_v1';
const TICK_MS = 60000;
const CRYPTO = {
  BTC: { binance: 'BTCUSDT', gecko: 'bitcoin' }, ETH: { binance: 'ETHUSDT', gecko: 'ethereum' },
  BNB: { binance: 'BNBUSDT', gecko: 'binancecoin' }, SOL: { binance: 'SOLUSDT', gecko: 'solana' },
  XRP: { binance: 'XRPUSDT', gecko: 'ripple' }, ADA: { binance: 'ADAUSDT', gecko: 'cardano' },
  DOGE: { binance: 'DOGEUSDT', gecko: 'dogecoin' }
};
const FX = ['EUR', 'GBP', 'JPY', 'RUB', 'CNY', 'TRY', 'BGN', 'CHF', 'INR', 'BRL', 'KGS'];
const FREQ = { '15min': 15 * 60 * 1000, '1h': 60 * 60 * 1000, 'daily': 24 * 60 * 60 * 1000 };

function loadState() {
  try { const r = localStorage.getItem(LS_KEY); if (r) return Object.assign({ masterOn: true, watches: [], log: [] }, JSON.parse(r)); } catch (e) {}
  return { masterOn: true, watches: [], log: [] };
}
function saveState(st) { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {} }
function pushLog(st, text) { st.log.unshift({ ts: Date.now(), text }); if (st.log.length > 100) st.log.length = 100; }

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(tm); }
}
async function fetchCryptoPrice(symbol) {
  const meta = CRYPTO[symbol];
  for (const host of ['https://data-api.binance.vision', 'https://api.binance.com']) {
    try {
      const d = await fetchJson(host + '/api/v3/ticker/price?symbol=' + meta.binance);
      const p = parseFloat(d.price);
      if (isFinite(p)) return { value: p, source: 'Binance' };
    } catch (e) { /* следващият източник */ }
  }
  const d = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=' + meta.gecko + '&vs_currencies=usd');
  const p = d && d[meta.gecko] && d[meta.gecko].usd;
  if (isFinite(p)) return { value: p, source: 'CoinGecko' };
  throw new Error('no price ' + symbol);
}
let fxCache = { ts: 0, rates: null };
async function fetchFxRate(quote) {
  if (!fxCache.rates || Date.now() - fxCache.ts > 60000) {
    const d = await fetchJson('https://open.er-api.com/v6/latest/USD');
    if (!d || d.result !== 'success' || !d.rates) throw new Error('fx unavailable');
    fxCache = { ts: Date.now(), rates: d.rates };
  }
  const r = fxCache.rates[quote];
  if (!isFinite(r)) throw new Error('no rate ' + quote);
  return { value: r, source: 'open.er-api.com' };
}
function fetchValue(w) { return w.kind === 'crypto' ? fetchCryptoPrice(w.symbol) : fetchFxRate(w.symbol); }
function fmtVal(v) {
  if (!isFinite(v)) return '—';
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

// ── Известия (СИНХРОННО от window.Capacitor.Plugins — като watch20) ──
let _ln = null, _lnReady = false;
function getLocalNotifications() {
  if (_lnReady) return _ln;
  _lnReady = true;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    _ln = (cap && cap.Plugins && cap.Plugins.LocalNotifications) ? cap.Plugins.LocalNotifications : false;
  } catch (e) { _ln = false; }
  return _ln;
}
async function askNotifPermission() {
  const ln = getLocalNotifications();
  if (ln) { try { await ln.requestPermissions(); return true; } catch (e) { return false; } }
  if (typeof Notification !== 'undefined') { try { return (await Notification.requestPermission()) === 'granted'; } catch (e) { return false; } }
  return false;
}
async function notify(title, body) {
  const ln = getLocalNotifications();
  if (ln) {
    try { await ln.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e6), title, body }] }); return; } catch (e) {}
  }
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body }); } catch (e) {}
}

// ── Проверки ──
function condMet(w, v) { return w.condition === 'below' ? v <= w.target : v >= w.target; }
async function checkWatch(st, w, force) {
  const due = force || !w.lastCheck || (Date.now() - w.lastCheck) >= (FREQ[w.freq] || FREQ['1h']);
  if (!due || w.paused) return false;
  try {
    const { value, source } = await fetchValue(w);
    w.lastValue = value; w.lastCheck = Date.now(); w.lastSource = source; w.error = null;
    if (condMet(w, value)) {
      if (w.status !== 'hit') {
        w.status = 'hit';
        const label = w.symbol + ' ' + (w.condition === 'below' ? '≤' : '≥') + ' ' + w.target;
        await notify(t('pw_notif_title'), label + ' · ' + fmtVal(value) + ' (' + source + ')');
        pushLog(st, '🎯 ' + label + ' → ' + fmtVal(value));
      }
    } else { w.status = 'watching'; }
    return true;
  } catch (e) {
    w.error = (e && e.message) || 'error'; w.lastCheck = Date.now();
    pushLog(st, '⚠ ' + w.symbol + ': ' + w.error);
    return true;
  }
}
async function tick(st, force) {
  if (!st.masterOn && !force) return false;
  let changed = false;
  for (const w of st.watches) changed = (await checkWatch(st, w, force)) || changed;
  if (changed) saveState(st);
  return changed;
}

let timer = null;

export function render(root) {
  const st = loadState();
  if (timer) { clearInterval(timer); timer = null; }

  root.innerHTML = `
    <div class="tool-card">
      <p class="hint">${t('pw_notice')}</p>
      <label style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="pwMaster" ${st.masterOn ? 'checked' : ''} style="width:18px;height:18px" /> ${t('pw_master')}
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
        <select id="pwKind">
          <option value="crypto">${t('pw_kind_crypto')}</option>
          <option value="fx">${t('pw_kind_fx')}</option>
        </select>
        <select id="pwSymbol"></select>
        <select id="pwCond">
          <option value="below">${t('pw_cond_below')}</option>
          <option value="above">${t('pw_cond_above')}</option>
        </select>
        <input type="number" step="any" id="pwTarget" placeholder="${esc(t('pw_target_ph'))}" />
        <select id="pwFreq" style="grid-column:1 / -1">
          <option value="15min">${t('pw_freq_15')}</option>
          <option value="1h" selected>${t('pw_freq_1h')}</option>
          <option value="daily">${t('pw_freq_daily')}</option>
        </select>
      </div>
      <button class="btn" id="pwAdd">${t('pw_add')}</button>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn" id="pwCheck" style="flex:1">${t('pw_check_now')}</button>
        <button class="btn" id="pwNotif" style="flex:1">${t('pw_notif_btn')}</button>
      </div>
      <div class="status" id="pwStatus"></div>
      <div id="pwList" style="margin-top:12px"></div>
      <p class="hint">${t('pw_bg_note')}</p>
      <div id="pwLogWrap" style="margin-top:10px"></div>
    </div>`;

  const kindSel = root.querySelector('#pwKind');
  const symSel = root.querySelector('#pwSymbol');
  const status = root.querySelector('#pwStatus');

  function fillSymbols() {
    const list = kindSel.value === 'crypto' ? Object.keys(CRYPTO) : FX;
    symSel.innerHTML = list.map((s) => `<option value="${s}">${s}</option>`).join('');
  }
  fillSymbols();
  kindSel.addEventListener('change', fillSymbols);

  function drawList() {
    const box = root.querySelector('#pwList');
    if (!st.watches.length) { box.innerHTML = `<p class="hint">${t('pw_empty')}</p>`; return; }
    box.innerHTML = st.watches.map((w, i) => {
      const cond = (w.condition === 'below' ? t('pw_cond_below') : t('pw_cond_above')) + ' ' + w.target;
      const stateTxt = w.paused ? t('pw_paused')
        : w.error ? tf('pw_err', w.error)
        : w.status === 'hit' ? t('pw_status_hit') : t('pw_status_watching');
      const last = w.lastValue != null ? tf('pw_last', fmtVal(w.lastValue) + (w.lastSource ? ' · ' + w.lastSource : '')) : '';
      const color = w.paused ? '#8aa0b4' : w.error ? '#e0574d' : w.status === 'hit' ? '#28c08a' : '#8aa0b4';
      return `<div class="pw-row" data-i="${i}" style="border:1px solid var(--bd,#24323f);border-radius:10px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <b>${esc(w.symbol)}</b>
          <span style="font-size:.85em;color:${color}">${esc(stateTxt)}</span>
        </div>
        <div class="hint" style="margin:4px 0">${esc(cond)}${last ? ' · ' + esc(last) : ''}</div>
        <div style="display:flex;gap:8px">
          <button class="btn small pw-toggle" style="flex:1">${w.paused ? t('pw_resume') : t('pw_pause')}</button>
          <button class="btn small pw-del" style="flex:1">${t('pw_del')}</button>
        </div>
      </div>`;
    }).join('');
    box.querySelectorAll('.pw-row').forEach((row) => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('.pw-toggle').addEventListener('click', () => {
        st.watches[i].paused = !st.watches[i].paused; saveState(st); drawList();
      });
      row.querySelector('.pw-del').addEventListener('click', () => {
        st.watches.splice(i, 1); saveState(st); drawList();
      });
    });
  }
  function drawLog() {
    const box = root.querySelector('#pwLogWrap');
    if (!st.log.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<b style="font-size:.9em">${t('pw_log_title')}</b>` + st.log.slice(0, 30).map((l) =>
      `<div class="hint">${new Date(l.ts).toLocaleTimeString()} — ${esc(l.text)}</div>`).join('');
  }

  root.querySelector('#pwMaster').addEventListener('change', (e) => { st.masterOn = e.target.checked; saveState(st); });
  root.querySelector('#pwAdd').addEventListener('click', () => {
    const target = parseFloat(root.querySelector('#pwTarget').value);
    if (!isFinite(target)) { setStatus(status, 'err', t('pw_need_target')); return; }
    st.watches.push({
      id: 'w' + Date.now(), kind: kindSel.value, symbol: symSel.value,
      condition: root.querySelector('#pwCond').value, target,
      freq: root.querySelector('#pwFreq').value,
      lastValue: null, lastCheck: null, status: 'watching', paused: false, error: null
    });
    saveState(st); drawList();
    setStatus(status, 'ok', tf('pw_checked', st.watches.length));
  });
  root.querySelector('#pwCheck').addEventListener('click', async () => {
    setStatus(status, 'work', t('pw_checking'));
    await tick(st, true);
    drawList(); drawLog();
    setStatus(status, 'ok', tf('pw_checked', st.watches.length));
  });
  root.querySelector('#pwNotif').addEventListener('click', () => { askNotifPermission(); });

  drawList(); drawLog();
  // проверка на всяка минута, докато инструментът е отворен (узрелите по честота)
  timer = setInterval(async () => {
    if (!document.body.contains(root)) { clearInterval(timer); timer = null; return; }
    const changed = await tick(st, false);
    if (changed) { drawList(); drawLog(); }
  }, TICK_MS);
  tick(st, false).then((c) => { if (c) { drawList(); drawLog(); } });
}
