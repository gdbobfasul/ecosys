// Version: 1.0002
// Web скрапер — търси ДУМА/ФРАЗА в интернет (търсачка) и/или извлича конкретен URL.
//
// РЕЖИМ „Търсене" (основен): въвеждаш дума → пита търсачка и връща списък резултати
//   (заглавие + описание + линк). На ТЕЛЕФОНА заявката минава през CapacitorHttp, който
//   ЗАОБИКАЛЯ CORS (затова вече няма „CORS" грешка в апа). В браузър пада към Wikipedia
//   (keyless, CORS-разрешено). Тап върху резултат → извлича страницата.
// РЕЖИМ „URL" (по избор): извлича конкретен адрес — заглавие, описание, текст, връзки.
//
// БЕЗ ключове, БЕЗ акаунти, БЕЗ tracking. Само публични keyless ендпойнти.
import { t, tf, register, getLang } from '../core/i18n.js';

register({
  scr_title: { bg:'Web скрапер', ru:'Веб-скрапер', uk:'Веб-скрапер', en:'Web scraper', de:'Web-Scraper', fr:'Scraper web', es:'Web scraper', 'es-MX':'Web scraper', it:'Web scraper', pt:'Web scraper', ar:'كاشط ويب', hi:'वेब स्क्रैपर', ja:'ウェブスクレイパー', ky:'Веб скрапер', 'zh-Hant':'網頁擷取器' },
  scr_kw_label: { bg:'Дума или фраза за търсене', ru:'Слово или фраза для поиска', uk:'Слово або фраза для пошуку', en:'Word or phrase to search', de:'Wort oder Phrase zum Suchen', fr:'Mot ou phrase à rechercher', es:'Palabra o frase a buscar', 'es-MX':'Palabra o frase a buscar', it:'Parola o frase da cercare', pt:'Palavra ou frase para pesquisar', ar:'كلمة أو عبارة للبحث', hi:'खोजने हेतु शब्द या वाक्यांश', ja:'検索する語句', ky:'Издөө үчүн сөз же сөз айкашы', 'zh-Hant':'要搜尋的字詞' },
  scr_kw_ph: { bg:'напр. рецепта за баница', ru:'напр. рецепт пирога', uk:'напр. рецепт пирога', en:'e.g. banana bread recipe', de:'z. B. Rezept für Bananenbrot', fr:'ex. recette de pain', es:'p. ej. receta de pan', 'es-MX':'p. ej. receta de pan', it:'es. ricetta del pane', pt:'ex. receita de pão', ar:'مثال وصفة خبز', hi:'जैसे केक की विधि', ja:'例 パンのレシピ', ky:'мис. нан рецепти', 'zh-Hant':'例如 麵包食譜' },
  scr_search_btn: { bg:'Търси', ru:'Искать', uk:'Шукати', en:'Search', de:'Suchen', fr:'Rechercher', es:'Buscar', 'es-MX':'Buscar', it:'Cerca', pt:'Pesquisar', ar:'بحث', hi:'खोजें', ja:'検索', ky:'Издөө', 'zh-Hant':'搜尋' },
  scr_url_label: { bg:'…или извлечи конкретен URL', ru:'…или извлечь конкретный URL', uk:'…або витягти конкретний URL', en:'…or extract a specific URL', de:'…oder eine bestimmte URL extrahieren', fr:'…ou extraire une URL précise', es:'…o extraer una URL específica', 'es-MX':'…o extraer una URL específica', it:'…o estrai un URL specifico', pt:'…ou extrair uma URL específica', ar:'…أو استخرج رابطًا محددًا', hi:'…या कोई विशिष्ट URL निकालें', ja:'…または特定のURLを抽出', ky:'…же белгилүү URL алуу', 'zh-Hant':'…或擷取特定網址' },
  scr_btn: { bg:'Извлечи', ru:'Извлечь', uk:'Витягти', en:'Extract', de:'Extrahieren', fr:'Extraire', es:'Extraer', 'es-MX':'Extraer', it:'Estrai', pt:'Extrair', ar:'استخرج', hi:'निकालें', ja:'抽出', ky:'Алуу', 'zh-Hant':'擷取' },
  scr_searching: { bg:'Търся…', ru:'Ищу…', uk:'Шукаю…', en:'Searching…', de:'Suche…', fr:'Recherche…', es:'Buscando…', 'es-MX':'Buscando…', it:'Ricerca…', pt:'Pesquisando…', ar:'جارٍ البحث…', hi:'खोज रहा…', ja:'検索中…', ky:'Изделүүдө…', 'zh-Hant':'搜尋中…' },
  scr_fetching: { bg:'Изтеглям…', ru:'Загружаю…', uk:'Завантажую…', en:'Fetching…', de:'Wird abgerufen…', fr:'Récupération…', es:'Descargando…', 'es-MX':'Descargando…', it:'Recupero…', pt:'Baixando…', ar:'جارٍ الجلب…', hi:'प्राप्त कर रहा…', ja:'取得中…', ky:'Жүктөлүүдө…', 'zh-Hant':'擷取中…' },
  scr_results: { bg:'Резултати ({0})', ru:'Результаты ({0})', uk:'Результати ({0})', en:'Results ({0})', de:'Ergebnisse ({0})', fr:'Résultats ({0})', es:'Resultados ({0})', 'es-MX':'Resultados ({0})', it:'Risultati ({0})', pt:'Resultados ({0})', ar:'النتائج ({0})', hi:'परिणाम ({0})', ja:'結果 ({0})', ky:'Жыйынтыктар ({0})', 'zh-Hant':'結果 ({0})' },
  scr_no_results: { bg:'Няма резултати. Опитай друга дума.', ru:'Нет результатов. Попробуй другое слово.', uk:'Немає результатів. Спробуй інше слово.', en:'No results. Try another word.', de:'Keine Ergebnisse. Versuche ein anderes Wort.', fr:'Aucun résultat. Essaie un autre mot.', es:'Sin resultados. Prueba otra palabra.', 'es-MX':'Sin resultados. Prueba otra palabra.', it:'Nessun risultato. Prova un’altra parola.', pt:'Sem resultados. Tente outra palavra.', ar:'لا نتائج. جرّب كلمة أخرى.', hi:'कोई परिणाम नहीं। दूसरा शब्द आज़माएं।', ja:'結果なし。別の語で試してください。', ky:'Жыйынтык жок. Башка сөз менен аракет кыл.', 'zh-Hant':'沒有結果，換個字詞試試。' },
  scr_err_kw: { bg:'Въведи дума за търсене.', ru:'Введи слово для поиска.', uk:'Введи слово для пошуку.', en:'Enter a word to search.', de:'Gib ein Suchwort ein.', fr:'Saisis un mot à rechercher.', es:'Ingresa una palabra a buscar.', 'es-MX':'Ingresa una palabra a buscar.', it:'Inserisci una parola da cercare.', pt:'Insira uma palavra para pesquisar.', ar:'أدخل كلمة للبحث.', hi:'खोजने हेतु शब्द दर्ज करें।', ja:'検索語を入力してください。', ky:'Издөө үчүн сөз киргиз.', 'zh-Hant':'請輸入要搜尋的字詞。' },
  scr_err_search: { bg:'Търсенето не успя. Провери интернет връзката си.', ru:'Поиск не удался. Проверь интернет-соединение.', uk:'Пошук не вдався. Перевір інтернет-зʼєднання.', en:'Search failed. Check your internet connection.', de:'Suche fehlgeschlagen. Prüfe deine Internetverbindung.', fr:'Échec de la recherche. Vérifie ta connexion internet.', es:'La búsqueda falló. Revisa tu conexión a internet.', 'es-MX':'La búsqueda falló. Revisa tu conexión a internet.', it:'Ricerca non riuscita. Controlla la connessione internet.', pt:'A pesquisa falhou. Verifique sua conexão de internet.', ar:'فشل البحث. تحقق من اتصال الإنترنت.', hi:'खोज विफल। अपना इंटरनेट कनेक्शन जांचें।', ja:'検索に失敗しました。インターネット接続を確認してください。', ky:'Издөө ийгиликсиз. Интернет байланышыңды текшер.', 'zh-Hant':'搜尋失敗，請檢查網路連線。' },
  scr_lbl_status: { bg:'Статус', ru:'Статус', uk:'Статус', en:'Status', de:'Status', fr:'Statut', es:'Estado', 'es-MX':'Estado', it:'Stato', pt:'Status', ar:'الحالة', hi:'स्थिति', ja:'ステータス', ky:'Абал', 'zh-Hant':'狀態' },
  scr_lbl_desc: { bg:'Описание', ru:'Описание', uk:'Опис', en:'Description', de:'Beschreibung', fr:'Description', es:'Descripción', 'es-MX':'Descripción', it:'Descrizione', pt:'Descrição', ar:'الوصف', hi:'विवरण', ja:'説明', ky:'Сүрөттөмө', 'zh-Hant':'描述' },
  scr_lbl_title: { bg:'Заглавие', ru:'Заголовок', uk:'Заголовок', en:'Title', de:'Titel', fr:'Titre', es:'Título', 'es-MX':'Título', it:'Titolo', pt:'Título', ar:'العنوان', hi:'शीर्षक', ja:'タイトル', ky:'Аталыш', 'zh-Hant':'標題' },
  scr_lbl_text: { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'本文', ky:'Текст', 'zh-Hant':'文字' },
  scr_lbl_links: { bg:'Връзки ({0})', ru:'Ссылки ({0})', uk:'Посилання ({0})', en:'Links ({0})', de:'Links ({0})', fr:'Liens ({0})', es:'Enlaces ({0})', 'es-MX':'Enlaces ({0})', it:'Link ({0})', pt:'Links ({0})', ar:'الروابط ({0})', hi:'लिंक ({0})', ja:'リンク ({0})', ky:'Шилтемелер ({0})', 'zh-Hant':'連結 ({0})' },
  scr_open: { bg:'↗ Отвори в браузър', ru:'↗ Открыть в браузере', uk:'↗ Відкрити у браузері', en:'↗ Open in browser', de:'↗ Im Browser öffnen', fr:'↗ Ouvrir dans le navigateur', es:'↗ Abrir en el navegador', 'es-MX':'↗ Abrir en el navegador', it:'↗ Apri nel browser', pt:'↗ Abrir no navegador', ar:'↗ افتح في المتصفح', hi:'↗ ब्राउज़र में खोलें', ja:'↗ ブラウザで開く', ky:'↗ Браузерде ачуу', 'zh-Hant':'↗ 在瀏覽器開啟' },
  scr_hint: { bg:'Работи на устройството. Изисква интернет. Резултатите са от публична търсачка.', ru:'Работает на устройстве. Требуется интернет. Результаты — из публичного поиска.', uk:'Працює на пристрої. Потрібен інтернет. Результати — з публічного пошуку.', en:'Runs on your device. Requires internet. Results come from a public search engine.', de:'Läuft auf dem Gerät. Internet erforderlich. Ergebnisse aus einer öffentlichen Suchmaschine.', fr:'Fonctionne sur l’appareil. Internet requis. Résultats d’un moteur de recherche public.', es:'Funciona en el dispositivo. Requiere internet. Resultados de un buscador público.', 'es-MX':'Funciona en el dispositivo. Requiere internet. Resultados de un buscador público.', it:'Funziona sul dispositivo. Richiede internet. Risultati da un motore di ricerca pubblico.', pt:'Funciona no dispositivo. Requer internet. Resultados de um buscador público.', ar:'يعمل على جهازك. يتطلب إنترنت. النتائج من محرك بحث عام.', hi:'आपके डिवाइस पर चलता है। इंटरनेट आवश्यक। परिणाम सार्वजनिक सर्च इंजन से।', ja:'端末上で動作。インターネットが必要。結果は公開検索エンジンから。', ky:'Түзмөктө иштейт. Интернет керек. Жыйынтыктар ачык издөө системасынан.', 'zh-Hant':'在裝置上執行。需要網路。結果來自公開搜尋引擎。' },
  scr_err_cors: { bg:'Заявката е блокирана (CORS) или няма връзка. В браузър някои сайтове не разрешават директен достъп — в приложението на телефона това не е проблем.', ru:'Запрос заблокирован (CORS) или нет связи. В браузере некоторые сайты не разрешают прямой доступ — в приложении на телефоне это не проблема.', uk:'Запит заблоковано (CORS) або немає зв’язку. У браузері деякі сайти не дозволяють прямий доступ — у застосунку на телефоні це не проблема.', en:'The request was blocked (CORS) or there is no connection. In a browser some sites block direct access — in the phone app this is not an issue.', de:'Die Anfrage wurde blockiert (CORS) oder keine Verbindung. Im Browser blockieren manche Seiten den direkten Zugriff — in der Telefon-App ist das kein Problem.', fr:'Requête bloquée (CORS) ou pas de connexion. Dans un navigateur, certains sites bloquent l’accès direct — dans l’app mobile ce n’est pas un souci.', es:'La solicitud fue bloqueada (CORS) o no hay conexión. En un navegador algunos sitios bloquean el acceso directo — en la app del teléfono no es problema.', 'es-MX':'La solicitud fue bloqueada (CORS) o no hay conexión. En un navegador algunos sitios bloquean el acceso directo — en la app del teléfono no es problema.', it:'Richiesta bloccata (CORS) o nessuna connessione. Nel browser alcuni siti bloccano l’accesso diretto — nell’app del telefono non è un problema.', pt:'A solicitação foi bloqueada (CORS) ou não há conexão. No navegador alguns sites bloqueiam o acesso direto — no app do telefone isso não é problema.', ar:'تم حظر الطلب (CORS) أو لا يوجد اتصال. في المتصفح تمنع بعض المواقع الوصول المباشر — في تطبيق الهاتف ليست مشكلة.', hi:'अनुरोध अवरुद्ध (CORS) या कनेक्शन नहीं। ब्राउज़र में कुछ साइटें सीधी पहुंच रोकती हैं — फ़ोन ऐप में यह समस्या नहीं है।', ja:'リクエストがブロック（CORS）されたか接続がありません。ブラウザでは一部サイトが直接アクセスを拒否します — 電話アプリでは問題ありません。', ky:'Сурам бөгөттөлдү (CORS) же байланыш жок. Браузерде кээ бир сайттар түз кирүүнү бөгөттөйт — телефон колдонмосунда бул көйгөй эмес.', 'zh-Hant':'請求被封鎖（CORS）或無連線。在瀏覽器中部分網站封鎖直接存取——在手機 App 中則沒有此問題。' }
});

export const title = t('scr_title');

const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

// HTTP GET: на телефон през CapacitorHttp (ЗАОБИКАЛЯ CORS), в браузър — fetch. БЕЗ AbortController
// (чупи CapacitorHttp) — таймаут през Promise.race.
async function httpGet(url) {
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  if (CH && CH.get) {
    const r = await Promise.race([CH.get({ url, headers: { 'User-Agent': UA, accept: 'text/html,application/json' } }), timeout(30000)]);
    const h = r.headers || {};
    const ctype = h['content-type'] || h['Content-Type'] || '';
    const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    return { status: r.status, statusText: '', ctype, body };
  }
  const r = await Promise.race([fetch(url, { cache: 'no-store' }), timeout(30000)]);
  return { status: r.status, statusText: r.statusText || '', ctype: (r.headers.get('content-type') || ''), body: await r.text() };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ── Търсене в интернет ─────────────────────────────────────────────────────────
// 1) DuckDuckGo HTML (без ключ). На телефон минава през CapacitorHttp → без CORS.
async function searchDuck(kw) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(kw);
  const { body } = await httpGet(url);
  const doc = new DOMParser().parseFromString(body, 'text/html');
  const items = [];
  const seen = new Set();
  doc.querySelectorAll('a.result__a').forEach((a) => {
    let href = a.getAttribute('href') || '';
    const m = href.match(/[?&]uddg=([^&]+)/);              // DDG обвива линка в редирект
    if (m) { try { href = decodeURIComponent(m[1]); } catch (_) {} }
    else if (href.startsWith('//')) href = 'https:' + href;
    const title = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!href || !title || seen.has(href)) return;
    seen.add(href);
    const block = a.closest('.result, .result__body, .web-result') || a.parentElement;
    const snip = block ? (block.querySelector('.result__snippet') || {}).textContent || '' : '';
    items.push({ href, title, snippet: snip.replace(/\s+/g, ' ').trim() });
  });
  return items.slice(0, 25);
}
// 2) Резерв (browser/CORS): Wikipedia opensearch (keyless, разрешава origin=*).
async function searchWiki(kw) {
  const lang = String(getLang() || 'en').split('-')[0];
  const url = 'https://' + lang + '.wikipedia.org/w/api.php?action=opensearch&limit=20&namespace=0&format=json&origin=*&search=' + encodeURIComponent(kw);
  const { body } = await httpGet(url);
  let j; try { j = JSON.parse(body); } catch (_) { return []; }
  const titles = j[1] || [], descs = j[2] || [], urls = j[3] || [];
  return titles.map((tt, i) => ({ href: urls[i] || '', title: tt, snippet: descs[i] || '' })).filter((x) => x.href);
}
async function searchWeb(kw) {
  let items = [];
  try { items = await searchDuck(kw); } catch (_) { items = []; }
  if (!items.length) { try { items = await searchWiki(kw); } catch (_) { items = []; } }
  return items;
}

// ── Извличане на конкретна страница ────────────────────────────────────────────
function extractFromHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const desc = (doc.querySelector('meta[name="description"]')?.getAttribute('content') || '').trim();
  doc.querySelectorAll('script, style, noscript, template').forEach((el) => el.remove());
  let text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length > 4000) text = text.slice(0, 4000) + ' …';
  const links = []; const seen = new Set();
  doc.querySelectorAll('a[href]').forEach((a) => {
    let href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try { href = new URL(href, baseUrl).href; } catch (_) {}
    if (seen.has(href)) return; seen.add(href);
    const label = (a.textContent || '').replace(/\s+/g, ' ').trim() || href;
    links.push({ href, label });
  });
  return { title, desc, text, links: links.slice(0, 50) };
}

// Отваряне на линк навън (телефон: Capacitor Browser, иначе window.open).
function openExternal(url) {
  try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url }); return; } } catch (e) {}
  try { window.open(url, '_blank'); } catch (e) { try { location.href = url; } catch (_) {} }
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>${esc(t('scr_kw_label'))}</label>
      <input type="text" id="scKw" placeholder="${esc(t('scr_kw_ph'))}" autocomplete="off" />
      <button class="btn" id="scSearch">🔎 ${esc(t('scr_search_btn'))}</button>

      <label style="margin-top:14px">${esc(t('scr_url_label'))}</label>
      <input type="url" id="scUrl" placeholder="https://example.com" />
      <button class="btn" id="scBtn" style="background:#5b6472">${esc(t('scr_btn'))}</button>

      <div class="status" id="scStatus"></div>
      <div class="out-block" id="scOut" style="display:none"></div>
      <p class="hint" style="margin-top:10px">${esc(t('scr_hint'))}</p>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#scStatus');
  const out = $('#scOut');
  const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };
  const hideStatus = () => { statusEl.className = 'status'; };
  let busy = false;

  // ── Търсене по дума ──
  async function doSearch() {
    if (busy) return;
    const kw = $('#scKw').value.trim();
    if (!kw) { setStatus('err', t('scr_err_kw')); return; }
    busy = true; $('#scSearch').disabled = true; out.style.display = 'none';
    setStatus('work', t('scr_searching'));
    try {
      const items = await searchWeb(kw);
      hideStatus();
      if (!items.length) { setStatus('err', t('scr_no_results')); return; }
      out.style.display = 'block';
      let html = `<div style="font-weight:600;margin-bottom:6px">${esc(tf('scr_results', items.length))}</div>`;
      html += items.map((it, i) => `
        <div class="scr-item" data-i="${i}" style="padding:9px 0;border-top:1px solid rgba(127,127,127,.18)">
          <div style="font-weight:600;color:#4a90d9">${esc(it.title)}</div>
          ${it.snippet ? `<div style="font-size:.88em;opacity:.85;margin:2px 0">${esc(it.snippet)}</div>` : ''}
          <div style="font-size:.78em;opacity:.6;word-break:break-all">${esc(it.href)}</div>
          <div style="margin-top:5px;display:flex;gap:8px">
            <button class="btn scr-extract" data-i="${i}" style="flex:1;padding:6px 8px;font-size:.85em">${esc(t('scr_btn'))}</button>
            <button class="btn scr-openx" data-i="${i}" style="flex:1;padding:6px 8px;font-size:.85em;background:#5b6472">${esc(t('scr_open'))}</button>
          </div>
        </div>`).join('');
      out.innerHTML = html;
      out.querySelectorAll('.scr-extract').forEach((b) => b.addEventListener('click', () => { const it = items[+b.dataset.i]; $('#scUrl').value = it.href; extractUrl(it.href); }));
      out.querySelectorAll('.scr-openx').forEach((b) => b.addEventListener('click', () => openExternal(items[+b.dataset.i].href)));
    } catch (e) {
      setStatus('err', t('scr_err_search'));
    } finally { busy = false; $('#scSearch').disabled = false; }
  }

  // ── Извличане на конкретен URL ──
  async function extractUrl(forced) {
    if (busy) return;
    let target = (forced || $('#scUrl').value).trim();
    if (!target) { setStatus('err', t('scr_err_kw')); return; }
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
    busy = true; $('#scBtn').disabled = true; out.style.display = 'none';
    setStatus('work', t('scr_fetching'));
    try {
      const { status, statusText, ctype, body } = await httpGet(target);
      hideStatus(); out.style.display = 'block';
      let html = `<div class="line"><span>${esc(t('scr_lbl_status'))}</span><span>${status} ${esc(statusText)}</span></div>`;
      const looksJson = (ctype || '').includes('json') || /^\s*[\[{]/.test(body);
      if (looksJson) {
        let pretty = body; try { pretty = JSON.stringify(JSON.parse(body), null, 2); } catch (_) {}
        if (pretty.length > 8000) pretty = pretty.slice(0, 8000) + '\n…';
        html += `<pre style="white-space:pre-wrap;word-break:break-word;margin:8px 0 0;font-size:.85em">${esc(pretty)}</pre>`;
      } else {
        const { title, desc, text, links } = extractFromHtml(body, target);
        if (title) html += `<div class="line"><span>${esc(t('scr_lbl_title'))}</span><span>${esc(title)}</span></div>`;
        if (desc) html += `<div style="margin-top:10px;font-weight:600">${esc(t('scr_lbl_desc'))}</div><div style="margin-top:4px">${esc(desc)}</div>`;
        if (text) html += `<div style="margin-top:10px;font-weight:600">${esc(t('scr_lbl_text'))}</div><div style="margin-top:4px;font-size:.9em">${esc(text)}</div>`;
        if (links.length) {
          html += `<div style="margin-top:10px;font-weight:600">${esc(tf('scr_lbl_links', links.length))}</div>`;
          html += '<div style="margin-top:4px;font-size:.85em">' + links.map((l) => `<div style="padding:3px 0;word-break:break-all">${esc(l.label)}<br><span style="opacity:.6">${esc(l.href)}</span></div>`).join('') + '</div>';
        }
        if (!title && !text && !links.length) html += `<pre style="white-space:pre-wrap;word-break:break-word;margin:10px 0 0;font-size:.85em">${esc(body.slice(0, 4000))}</pre>`;
      }
      out.innerHTML = html;
    } catch (e) {
      out.style.display = 'none';
      setStatus('err', t('scr_err_cors'));
    } finally { busy = false; $('#scBtn').disabled = false; }
  }

  $('#scSearch').addEventListener('click', doSearch);
  $('#scKw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  $('#scBtn').addEventListener('click', () => extractUrl());
  $('#scUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') extractUrl(); });
}
