// Web скрапер — РЕАЛЕН инструмент в рамките на възможното от браузъра.
//
// Какво ПРАВИ реално:
//   • Изтегля съдържанието на подаден URL през fetch().
//   • Ако сайтът връща JSON → показва форматиран (pretty) JSON.
//   • Ако връща HTML → парсва го с DOMParser и извлича заглавие, мета описание,
//     видим текст и списък с връзки.
//   • Показва кода на статуса и типа на съдържанието.
//
// ЧЕСТНО ограничение (CORS): браузърът позволява четене само на отговори от
// сайтове, които ИЗРИЧНО пращат `Access-Control-Allow-Origin`. Повечето сайтове
// НЕ го правят, затова заявката се проваля със CORS грешка. Това е ограничение
// на платформата, не на инструмента — затова при такава грешка показваме ясно
// съобщение, а НЕ измислен резултат.
//
// По избор: потребителят може да въведе СВОЙ безплатен CORS прокси (поле, празно
// по подразбиране — НИЩО не е вградено). Тогава заявката минава през него:
//   <прокси><целевия URL>   напр.  https://corsproxy.io/?  +  https://...
// Така инструментът работи и за сайтове без CORS, без да зависи от платена услуга
// или вграден сървър.
//
// БЕЗ ключове, БЕЗ акаунти, БЕЗ tracking. Само публични keyless ендпойнти.

import { t, tf, register } from '../core/i18n.js';

register({
  scr_title: { bg:'Web скрапер', ru:'Веб-скрапер', uk:'Веб-скрапер', en:'Web scraper', de:'Web-Scraper', fr:'Scraper web', es:'Web scraper', 'es-MX':'Web scraper', it:'Web scraper', pt:'Web scraper', ar:'كاشط ويب', hi:'वेब स्क्रैपर', ja:'ウェブスクレイパー', ky:'Веб скрапер', 'zh-Hant':'網頁擷取器' },
  scr_url_label: { bg:'URL за извличане', ru:'URL для извлечения', uk:'URL для витягу', en:'URL to extract', de:'URL zum Extrahieren', fr:'URL à extraire', es:'URL para extraer', 'es-MX':'URL para extraer', it:'URL da estrarre', pt:'URL para extrair', ar:'الرابط المراد استخراجه', hi:'निकालने हेतु URL', ja:'抽出するURL', ky:'Алуу үчүн URL', 'zh-Hant':'要擷取的網址' },
  scr_proxy_label: { bg:'CORS прокси (по избор, празно = директно)', ru:'CORS-прокси (по желанию, пусто = напрямую)', uk:'CORS-проксі (за бажанням, порожнє = напряму)', en:'CORS proxy (optional, empty = direct)', de:'CORS-Proxy (optional, leer = direkt)', fr:'Proxy CORS (facultatif, vide = direct)', es:'Proxy CORS (opcional, vacío = directo)', 'es-MX':'Proxy CORS (opcional, vacío = directo)', it:'Proxy CORS (opzionale, vuoto = diretto)', pt:'Proxy CORS (opcional, vazio = direto)', ar:'وكيل CORS (اختياري، فارغ = مباشر)', hi:'CORS प्रॉक्सी (वैकल्पिक, खाली = सीधे)', ja:'CORSプロキシ（任意、空＝直接）', ky:'CORS прокси (милдеттүү эмес, бош = түз)', 'zh-Hant':'CORS 代理（選填，留空＝直接）' },
  scr_proxy_ph: { bg:'напр. https://corsproxy.io/?', ru:'напр. https://corsproxy.io/?', uk:'напр. https://corsproxy.io/?', en:'e.g. https://corsproxy.io/?', de:'z. B. https://corsproxy.io/?', fr:'ex. https://corsproxy.io/?', es:'p. ej. https://corsproxy.io/?', 'es-MX':'p. ej. https://corsproxy.io/?', it:'es. https://corsproxy.io/?', pt:'ex. https://corsproxy.io/?', ar:'مثال https://corsproxy.io/?', hi:'जैसे https://corsproxy.io/?', ja:'例 https://corsproxy.io/?', ky:'мис. https://corsproxy.io/?', 'zh-Hant':'例如 https://corsproxy.io/?' },
  scr_btn: { bg:'Извлечи', ru:'Извлечь', uk:'Витягти', en:'Extract', de:'Extrahieren', fr:'Extraire', es:'Extraer', 'es-MX':'Extraer', it:'Estrai', pt:'Extrair', ar:'استخرج', hi:'निकालें', ja:'抽出', ky:'Алуу', 'zh-Hant':'擷取' },
  scr_notice: { bg:'<b>За CORS:</b> браузърът чете само сайтове, които разрешават кръстосан достъп. За останалите въведи безплатен CORS прокси в полето по-горе. Не вграждаме прокси и не държим сървър.', ru:'<b>О CORS:</b> браузер читает только сайты, разрешающие кросс-доступ. Для остальных введи бесплатный CORS-прокси в поле выше. Мы не встраиваем прокси и не держим сервер.', uk:'<b>Про CORS:</b> браузер читає лише сайти, що дозволяють крос-доступ. Для решти введи безкоштовний CORS-проксі в поле вище. Ми не вбудовуємо проксі й не тримаємо сервер.', en:'<b>About CORS:</b> the browser only reads sites that allow cross-origin access. For the rest, enter a free CORS proxy in the field above. We embed no proxy and run no server.', de:'<b>Zu CORS:</b> der Browser liest nur Seiten, die Cross-Origin-Zugriff erlauben. Für die übrigen gib oben einen kostenlosen CORS-Proxy ein. Wir betten keinen Proxy ein und betreiben keinen Server.', fr:'<b>À propos de CORS :</b> le navigateur ne lit que les sites autorisant l’accès cross-origin. Pour les autres, saisis un proxy CORS gratuit ci-dessus. Aucun proxy intégré, aucun serveur.', es:'<b>Sobre CORS:</b> el navegador solo lee sitios que permiten acceso de origen cruzado. Para el resto, escribe un proxy CORS gratuito en el campo de arriba. No integramos proxy ni mantenemos servidor.', 'es-MX':'<b>Sobre CORS:</b> el navegador solo lee sitios que permiten acceso de origen cruzado. Para el resto, escribe un proxy CORS gratuito en el campo de arriba. No integramos proxy ni mantenemos servidor.', it:'<b>Su CORS:</b> il browser legge solo siti che consentono l’accesso cross-origin. Per gli altri inserisci un proxy CORS gratuito nel campo sopra. Non incorporiamo proxy né gestiamo server.', pt:'<b>Sobre CORS:</b> o navegador só lê sites que permitem acesso de origem cruzada. Para os demais, insira um proxy CORS gratuito no campo acima. Não embutimos proxy nem mantemos servidor.', ar:'<b>حول CORS:</b> يقرأ المتصفح فقط المواقع التي تسمح بالوصول عبر المصادر. للباقي أدخل وكيل CORS مجاني في الحقل أعلاه. لا ندمج وكيلاً ولا نشغّل خادمًا.', hi:'<b>CORS के बारे में:</b> ब्राउज़र केवल वे साइटें पढ़ता है जो क्रॉस-ओरिजिन पहुंच देती हैं। बाकी के लिए ऊपर के फ़ील्ड में मुफ़्त CORS प्रॉक्सी डालें। हम न प्रॉक्सी एम्बेड करते हैं न सर्वर चलाते हैं।', ja:'<b>CORSについて：</b> ブラウザはクロスオリジンを許可するサイトのみ読み込みます。それ以外は上の欄に無料のCORSプロキシを入力してください。プロキシは内蔵せず、サーバーも持ちません。', ky:'<b>CORS жөнүндө:</b> браузер кросс-доступка уруксат берген сайттарды гана окуйт. Калгандары үчүн жогорудагы талаага акысыз CORS прокси киргиз. Биз прокси кыстарбайбыз жана сервер кармабайбыз.', 'zh-Hant':'<b>關於 CORS：</b>瀏覽器只讀取允許跨來源存取的網站。其餘請在上方欄位輸入免費的 CORS 代理。我們不內嵌代理，也不運行伺服器。' },
  scr_hint: { bg:'Работи изцяло на устройството. Изисква интернет.', ru:'Работает полностью на устройстве. Требуется интернет.', uk:'Працює повністю на пристрої. Потрібен інтернет.', en:'Runs entirely on your device. Requires internet.', de:'Läuft vollständig auf dem Gerät. Internet erforderlich.', fr:'Fonctionne entièrement sur l’appareil. Internet requis.', es:'Funciona enteramente en el dispositivo. Requiere internet.', 'es-MX':'Funciona enteramente en el dispositivo. Requiere internet.', it:'Funziona interamente sul dispositivo. Richiede internet.', pt:'Funciona inteiramente no dispositivo. Requer internet.', ar:'يعمل بالكامل على جهازك. يتطلب إنترنت.', hi:'पूरी तरह आपके डिवाइस पर चलता है। इंटरनेट आवश्यक।', ja:'すべて端末上で動作します。インターネットが必要です。', ky:'Толугу менен түзмөктө иштейт. Интернет талап кылынат.', 'zh-Hant':'完全在裝置上執行。需要網路。' },
  scr_err_no_url: { bg:'Въведи URL.', ru:'Введи URL.', uk:'Введи URL.', en:'Enter a URL.', de:'URL eingeben.', fr:'Saisis une URL.', es:'Ingresa una URL.', 'es-MX':'Ingresa una URL.', it:'Inserisci un URL.', pt:'Insira uma URL.', ar:'أدخل رابطًا.', hi:'URL दर्ज करें।', ja:'URLを入力してください。', ky:'URL киргиз.', 'zh-Hant':'請輸入網址。' },
  scr_fetching: { bg:'Изтеглям…', ru:'Загружаю…', uk:'Завантажую…', en:'Fetching…', de:'Wird abgerufen…', fr:'Récupération…', es:'Descargando…', 'es-MX':'Descargando…', it:'Recupero…', pt:'Baixando…', ar:'جارٍ الجلب…', hi:'प्राप्त कर रहा…', ja:'取得中…', ky:'Жүктөлүүдө…', 'zh-Hant':'擷取中…' },
  scr_lbl_status: { bg:'Статус', ru:'Статус', uk:'Статус', en:'Status', de:'Status', fr:'Statut', es:'Estado', 'es-MX':'Estado', it:'Stato', pt:'Status', ar:'الحالة', hi:'स्थिति', ja:'ステータス', ky:'Абал', 'zh-Hant':'狀態' },
  scr_lbl_type: { bg:'Тип', ru:'Тип', uk:'Тип', en:'Type', de:'Typ', fr:'Type', es:'Tipo', 'es-MX':'Tipo', it:'Tipo', pt:'Tipo', ar:'النوع', hi:'प्रकार', ja:'タイプ', ky:'Түрү', 'zh-Hant':'類型' },
  scr_unknown: { bg:'неизвестен', ru:'неизвестен', uk:'невідомий', en:'unknown', de:'unbekannt', fr:'inconnu', es:'desconocido', 'es-MX':'desconocido', it:'sconosciuto', pt:'desconhecido', ar:'غير معروف', hi:'अज्ञात', ja:'不明', ky:'белгисиз', 'zh-Hant':'未知' },
  scr_lbl_desc: { bg:'Описание', ru:'Описание', uk:'Опис', en:'Description', de:'Beschreibung', fr:'Description', es:'Descripción', 'es-MX':'Descripción', it:'Descrizione', pt:'Descrição', ar:'الوصف', hi:'विवरण', ja:'説明', ky:'Сүрөттөмө', 'zh-Hant':'描述' },
  scr_lbl_title: { bg:'Заглавие', ru:'Заголовок', uk:'Заголовок', en:'Title', de:'Titel', fr:'Titre', es:'Título', 'es-MX':'Título', it:'Titolo', pt:'Título', ar:'العنوان', hi:'शीर्षक', ja:'タイトル', ky:'Аталыш', 'zh-Hant':'標題' },
  scr_lbl_text: { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'本文', ky:'Текст', 'zh-Hant':'文字' },
  scr_lbl_links: { bg:'Връзки ({0})', ru:'Ссылки ({0})', uk:'Посилання ({0})', en:'Links ({0})', de:'Links ({0})', fr:'Liens ({0})', es:'Enlaces ({0})', 'es-MX':'Enlaces ({0})', it:'Link ({0})', pt:'Links ({0})', ar:'الروابط ({0})', hi:'लिंक ({0})', ja:'リンク ({0})', ky:'Шилтемелер ({0})', 'zh-Hant':'連結 ({0})' },
  scr_err_timeout: { bg:'Заявката отне твърде дълго и беше прекъсната.', ru:'Запрос занял слишком много времени и был прерван.', uk:'Запит тривав надто довго і був перерваний.', en:'The request took too long and was aborted.', de:'Die Anfrage dauerte zu lange und wurde abgebrochen.', fr:'La requête a pris trop de temps et a été interrompue.', es:'La solicitud tardó demasiado y se canceló.', 'es-MX':'La solicitud tardó demasiado y se canceló.', it:'La richiesta ha richiesto troppo tempo ed è stata annullata.', pt:'A solicitação demorou demais e foi cancelada.', ar:'استغرق الطلب وقتًا طويلاً وتم إيقافه.', hi:'अनुरोध में बहुत समय लगा और रद्द कर दिया गया।', ja:'リクエストに時間がかかりすぎたため中断しました。', ky:'Сурам өтө узак убакыт алып, токтотулду.', 'zh-Hant':'請求耗時過長，已中止。' },
  scr_err_proxy: { bg:'Грешка при заявката. Провери URL адреса и прокситo, и връзката си.', ru:'Ошибка запроса. Проверь URL, прокси и соединение.', uk:'Помилка запиту. Перевір URL, проксі та з’єднання.', en:'Request error. Check the URL, the proxy, and your connection.', de:'Anfragefehler. Prüfe die URL, den Proxy und deine Verbindung.', fr:'Erreur de requête. Vérifie l’URL, le proxy et ta connexion.', es:'Error de solicitud. Revisa la URL, el proxy y tu conexión.', 'es-MX':'Error de solicitud. Revisa la URL, el proxy y tu conexión.', it:'Errore di richiesta. Controlla l’URL, il proxy e la connessione.', pt:'Erro na solicitação. Verifique a URL, o proxy e sua conexão.', ar:'خطأ في الطلب. تحقق من الرابط والوكيل والاتصال.', hi:'अनुरोध त्रुटि। URL, प्रॉक्सी और कनेक्शन जांचें।', ja:'リクエストエラー。URL、プロキシ、接続を確認してください。', ky:'Сурам катасы. URL, прокси жана байланышыңды текшер.', 'zh-Hant':'請求錯誤。請檢查網址、代理與連線。' },
  scr_err_cors: { bg:'Заявката е блокирана (CORS) или няма връзка. Сайтът не разрешава директен достъп — въведи безплатен CORS прокси в полето по-горе.', ru:'Запрос заблокирован (CORS) или нет связи. Сайт не разрешает прямой доступ — введи бесплатный CORS-прокси в поле выше.', uk:'Запит заблоковано (CORS) або немає зв’язку. Сайт не дозволяє прямий доступ — введи безкоштовний CORS-проксі в поле вище.', en:'The request was blocked (CORS) or there is no connection. The site does not allow direct access — enter a free CORS proxy in the field above.', de:'Die Anfrage wurde blockiert (CORS) oder es besteht keine Verbindung. Die Seite erlaubt keinen direkten Zugriff — gib oben einen kostenlosen CORS-Proxy ein.', fr:'La requête a été bloquée (CORS) ou il n’y a pas de connexion. Le site n’autorise pas l’accès direct — saisis un proxy CORS gratuit ci-dessus.', es:'La solicitud fue bloqueada (CORS) o no hay conexión. El sitio no permite acceso directo: escribe un proxy CORS gratuito en el campo de arriba.', 'es-MX':'La solicitud fue bloqueada (CORS) o no hay conexión. El sitio no permite acceso directo: escribe un proxy CORS gratuito en el campo de arriba.', it:'La richiesta è stata bloccata (CORS) o non c’è connessione. Il sito non consente l’accesso diretto — inserisci un proxy CORS gratuito nel campo sopra.', pt:'A solicitação foi bloqueada (CORS) ou não há conexão. O site não permite acesso direto — insira um proxy CORS gratuito no campo acima.', ar:'تم حظر الطلب (CORS) أو لا يوجد اتصال. الموقع لا يسمح بالوصول المباشر — أدخل وكيل CORS مجاني في الحقل أعلاه.', hi:'अनुरोध अवरुद्ध (CORS) या कोई कनेक्शन नहीं। साइट सीधी पहुंच नहीं देती — ऊपर के फ़ील्ड में मुफ़्त CORS प्रॉक्सी डालें।', ja:'リクエストがブロックされた（CORS）か、接続がありません。サイトが直接アクセスを許可していません — 上の欄に無料のCORSプロキシを入力してください。', ky:'Сурам бөгөттөлдү (CORS) же байланыш жок. Сайт түз кирүүгө уруксат бербейт — жогорудагы талаага акысыз CORS прокси киргиз.', 'zh-Hant':'請求被封鎖（CORS）或無連線。該網站不允許直接存取——請在上方欄位輸入免費的 CORS 代理。' }
});

export const title = t('scr_title');

const PROXY_KEY = 'toolkit.scraper.proxy';

// Сглобява крайния URL: ако има прокси, целевият адрес се добавя след него.
function buildUrl(target, proxy) {
  if (!proxy) return target;
  return proxy + encodeURIComponent(target);
}

// Парсва HTML и извлича заглавие/описание/текст/връзки.
function extractFromHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const desc = (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim();

  // Маха невидими елементи преди да четем текста.
  doc.querySelectorAll('script, style, noscript, template').forEach((el) => el.remove());
  let text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length > 4000) text = text.slice(0, 4000) + ' …';

  const links = [];
  const seen = new Set();
  doc.querySelectorAll('a[href]').forEach((a) => {
    let href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try { href = new URL(href, baseUrl).href; } catch (_) { /* относителен без база */ }
    if (seen.has(href)) return;
    seen.add(href);
    const label = (a.textContent || '').replace(/\s+/g, ' ').trim() || href;
    links.push({ href, label });
  });

  return { title, desc, text, links: links.slice(0, 50) };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function render(root) {
  const savedProxy = (() => { try { return localStorage.getItem(PROXY_KEY) || ''; } catch (_) { return ''; } })();

  root.innerHTML = `
    <div class="tool-card">
      <label>${esc(t('scr_url_label'))}</label>
      <input type="url" id="scUrl" placeholder="https://example.com" />

      <label style="margin-top:12px">${esc(t('scr_proxy_label'))}</label>
      <input type="url" id="scProxy" placeholder="${esc(t('scr_proxy_ph'))}" value="${esc(savedProxy)}" />

      <button class="btn" id="scBtn">${esc(t('scr_btn'))}</button>
      <div class="status" id="scStatus"></div>
      <div class="out-block" id="scOut" style="display:none"></div>

      <div class="notice" style="margin-top:14px">
        ${t('scr_notice')}
      </div>
      <p class="hint" style="margin-top:8px">${esc(t('scr_hint'))}</p>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#scStatus');
  const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };
  const hideStatus = () => { statusEl.className = 'status'; };

  let busy = false;

  async function run() {
    if (busy) return;
    let target = $('#scUrl').value.trim();
    if (!target) { setStatus('err', t('scr_err_no_url')); return; }
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

    const proxy = $('#scProxy').value.trim();
    try { localStorage.setItem(PROXY_KEY, proxy); } catch (_) { /* без хранилище */ }

    busy = true;
    const btn = $('#scBtn');
    btn.disabled = true;
    $('#scOut').style.display = 'none';
    setStatus('work', t('scr_fetching'));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch(buildUrl(target, proxy), { cache: 'no-store', signal: ctrl.signal });
      const ctype = (r.headers.get('content-type') || '').toLowerCase();
      const body = await r.text();
      hideStatus();

      const out = $('#scOut');
      out.style.display = 'block';

      let html = `<div class="line"><span>${esc(t('scr_lbl_status'))}</span><span>${r.status} ${esc(r.statusText || '')}</span></div>`;
      html += `<div class="line"><span>${esc(t('scr_lbl_type'))}</span><span>${esc(ctype || t('scr_unknown'))}</span></div>`;

      const looksJson = ctype.includes('json') || /^\s*[\[{]/.test(body);
      if (looksJson) {
        let pretty = body;
        try { pretty = JSON.stringify(JSON.parse(body), null, 2); } catch (_) { /* не е валиден JSON */ }
        if (pretty.length > 8000) pretty = pretty.slice(0, 8000) + '\n…';
        html += `<div style="margin-top:10px;font-weight:600">JSON</div>`;
        html += `<pre style="white-space:pre-wrap;word-break:break-word;margin:6px 0 0;font-size:.85em">${esc(pretty)}</pre>`;
      } else {
        const { title, desc, text, links } = extractFromHtml(body, target);
        if (title) html += `<div class="line"><span>${esc(t('scr_lbl_title'))}</span><span>${esc(title)}</span></div>`;
        if (desc) html += `<div style="margin-top:10px;font-weight:600">${esc(t('scr_lbl_desc'))}</div><div style="margin-top:4px">${esc(desc)}</div>`;
        if (text) html += `<div style="margin-top:10px;font-weight:600">${esc(t('scr_lbl_text'))}</div><div style="margin-top:4px;font-size:.9em">${esc(text)}</div>`;
        if (links.length) {
          html += `<div style="margin-top:10px;font-weight:600">${esc(tf('scr_lbl_links', links.length))}</div>`;
          html += '<div style="margin-top:4px;font-size:.85em">' +
            links.map((l) => `<div style="padding:3px 0;word-break:break-all">${esc(l.label)}<br><span style="opacity:.6">${esc(l.href)}</span></div>`).join('') +
            '</div>';
        }
        if (!title && !text && !links.length) {
          html += `<pre style="white-space:pre-wrap;word-break:break-word;margin:10px 0 0;font-size:.85em">${esc(body.slice(0, 4000))}</pre>`;
        }
      }
      out.innerHTML = html;
    } catch (e) {
      $('#scOut').style.display = 'none';
      const aborted = e && e.name === 'AbortError';
      if (aborted) {
        setStatus('err', t('scr_err_timeout'));
      } else {
        // Типична причина при директна заявка е CORS блокиране (TypeError: Failed to fetch).
        setStatus('err', proxy ? t('scr_err_proxy') : t('scr_err_cors'));
      }
    } finally {
      clearTimeout(timer);
      btn.disabled = false;
      busy = false;
    }
  }

  $('#scBtn').addEventListener('click', run);
}
