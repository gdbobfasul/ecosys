// Version: 1.0021
// „Скрапер на устройството" (обогатяване Huawei 4.1, 09.09.2026; 11.09.2026: „Пробвай с пример“ с 2 вградени страници) — работи БЕЗ бекенд: даваш адреси на страници
// (или търсене — резултатите идват от DuckDuckGo през нашия relay) → апът сваля всяка страница (CapacitorHttp)
// и извлича: заглавие, описание, имейли, телефони, връзки (вътрешни/външни), заглавия (H1–H3), тип на
// съдържанието (новина/рецепта/продукт/обява/контакти/работа/статия…), брой думи; филтри „трябва да съдържа" /
// „да не съдържа"; таблица + износ CSV + копиране. Нищо не се пази на сървър.
import { esc, downloadBlob, copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  sl_title: { bg:'Скрапер на устройството', ru:'Скрапер на устройстве', uk:'Скрапер на пристрої', en:'On-device scraper', de:'Scraper auf dem Gerät', fr:'Scraper sur l\'appareil', es:'Scraper en el dispositivo', 'es-MX':'Scraper en el dispositivo', it:'Scraper sul dispositivo', pt:'Scraper no dispositivo', ar:'كاشط على الجهاز', hi:'डिवाइस पर स्क्रैपर', ja:'端末内スクレイパー', ky:'Түзмөктөгү скрепер', 'zh-Hant':'裝置端擷取器' },
  sl_hint: { bg:'Без сървър: страниците се свалят на телефона и се разчитат тук. Въведи адреси (по един на ред) или търси по дума — резултатите от търсенето идват през услугата ни (DuckDuckGo).', ru:'Без сервера: страницы скачиваются на телефон и разбираются здесь. Введите адреса (по одному в строке) или ищите по слову — результаты поиска приходят через наш сервис (DuckDuckGo).', uk:'Без сервера: сторінки завантажуються на телефон і розбираються тут. Введіть адреси (по одній у рядку) або шукайте за словом — результати пошуку надходять через наш сервіс (DuckDuckGo).', en:'No server: pages are downloaded to the phone and parsed here. Enter URLs (one per line) or search by keyword — search results come via our service (DuckDuckGo).', de:'Ohne Server: Seiten werden aufs Telefon geladen und hier ausgewertet. URLs (eine pro Zeile) eingeben oder per Stichwort suchen — Suchergebnisse über unseren Dienst (DuckDuckGo).', fr:'Sans serveur : les pages sont téléchargées sur le téléphone et analysées ici. Saisissez des URL (une par ligne) ou cherchez un mot-clé — résultats via notre service (DuckDuckGo).', es:'Sin servidor: las páginas se descargan al teléfono y se analizan aquí. Escribe URL (una por línea) o busca por palabra — resultados mediante nuestro servicio (DuckDuckGo).', 'es-MX':'Sin servidor: las páginas se descargan al teléfono y se analizan aquí. Escribe URL (una por línea) o busca por palabra — resultados mediante nuestro servicio (DuckDuckGo).', it:'Senza server: le pagine vengono scaricate sul telefono e analizzate qui. Inserisci URL (uno per riga) o cerca per parola — risultati tramite il nostro servizio (DuckDuckGo).', pt:'Sem servidor: as páginas são descarregadas para o telemóvel e analisadas aqui. Introduza URLs (um por linha) ou pesquise por palavra — resultados via o nosso serviço (DuckDuckGo).', ar:'بدون خادم: تُنزَّل الصفحات على الهاتف وتُحلَّل هنا. أدخل عناوين (واحد في كل سطر) أو ابحث بكلمة — نتائج البحث عبر خدمتنا (DuckDuckGo).', hi:'बिना सर्वर: पेज फ़ोन पर डाउनलोड होकर यहीं पार्स होते हैं। URL दर्ज करें (प्रति पंक्ति एक) या कीवर्ड से खोजें — परिणाम हमारी सेवा (DuckDuckGo) से आते हैं।', ja:'サーバー不要：ページを端末に取得しここで解析。URL（1行に1つ）を入力するかキーワード検索 — 検索結果は当社サービス経由（DuckDuckGo）。', ky:'Серверсиз: барактар телефонго жүктөлүп, бул жерде талданат. Даректерди (ар бир сапка бирден) киргиз же сөз менен изде — издөө натыйжалары биздин кызмат аркылуу (DuckDuckGo).', 'zh-Hant':'無需伺服器：頁面下載到手機並在此解析。輸入網址（每行一個）或以關鍵字搜尋 — 搜尋結果經由我們的服務（DuckDuckGo）。' },
  sl_urls: { bg:'Адреси (по един на ред)', ru:'Адреса (по одному в строке)', uk:'Адреси (по одній у рядку)', en:'URLs (one per line)', de:'URLs (eine pro Zeile)', fr:'URL (une par ligne)', es:'URL (una por línea)', 'es-MX':'URL (una por línea)', it:'URL (uno per riga)', pt:'URLs (um por linha)', ar:'عناوين (واحد في كل سطر)', hi:'URL (प्रति पंक्ति एक)', ja:'URL（1行に1つ）', ky:'Даректер (ар бир сапка бирден)', 'zh-Hant':'網址（每行一個）' },
  sl_query: { bg:'…или търсене по дума', ru:'…или поиск по слову', uk:'…або пошук за словом', en:'…or search by keyword', de:'…oder Stichwortsuche', fr:'…ou recherche par mot-clé', es:'…o buscar por palabra', 'es-MX':'…o buscar por palabra', it:'…o cerca per parola', pt:'…ou pesquisar por palavra', ar:'…أو البحث بكلمة', hi:'…या कीवर्ड से खोजें', ja:'…またはキーワード検索', ky:'…же сөз менен издөө', 'zh-Hant':'…或以關鍵字搜尋' },
  sl_must: { bg:'Трябва да съдържа (по избор)', ru:'Должно содержать (необязательно)', uk:'Має містити (необов’язково)', en:'Must contain (optional)', de:'Muss enthalten (optional)', fr:'Doit contenir (facultatif)', es:'Debe contener (opcional)', 'es-MX':'Debe contener (opcional)', it:'Deve contenere (facoltativo)', pt:'Deve conter (opcional)', ar:'يجب أن يحتوي (اختياري)', hi:'शामिल होना चाहिए (वैकल्पिक)', ja:'含むべき語（任意）', ky:'Камтышы керек (милдеттүү эмес)', 'zh-Hant':'必須包含（選填）' },
  sl_excl: { bg:'Да не съдържа (по избор)', ru:'Не должно содержать (необязательно)', uk:'Не має містити (необов’язково)', en:'Must not contain (optional)', de:'Darf nicht enthalten (optional)', fr:'Ne doit pas contenir (facultatif)', es:'No debe contener (opcional)', 'es-MX':'No debe contener (opcional)', it:'Non deve contenere (facoltativo)', pt:'Não deve conter (opcional)', ar:'يجب ألا يحتوي (اختياري)', hi:'शामिल नहीं होना चाहिए (वैकल्पिक)', ja:'含まない語（任意）', ky:'Камтыбашы керек (милдеттүү эмес)', 'zh-Hant':'不得包含（選填）' },
  sl_go: { bg:'Извлечи', ru:'Извлечь', uk:'Витягти', en:'Extract', de:'Extrahieren', fr:'Extraire', es:'Extraer', 'es-MX':'Extraer', it:'Estrai', pt:'Extrair', ar:'استخراج', hi:'निकालें', ja:'抽出', ky:'Чыгаруу', 'zh-Hant':'擷取' },
  sl_need: { bg:'Въведи поне един адрес или дума за търсене.', ru:'Введите хотя бы один адрес или слово для поиска.', uk:'Введіть хоча б одну адресу або слово для пошуку.', en:'Enter at least one URL or a search keyword.', de:'Mindestens eine URL oder ein Stichwort eingeben.', fr:'Saisissez au moins une URL ou un mot-clé.', es:'Escribe al menos una URL o una palabra.', 'es-MX':'Escribe al menos una URL o una palabra.', it:'Inserisci almeno un URL o una parola.', pt:'Introduza pelo menos um URL ou uma palavra.', ar:'أدخل عنواناً واحداً على الأقل أو كلمة بحث.', hi:'कम से कम एक URL या कीवर्ड दर्ज करें।', ja:'URLまたはキーワードを1つ以上入力してください。', ky:'Кеминде бир дарек же издөө сөзүн киргиз.', 'zh-Hant':'請輸入至少一個網址或關鍵字。' },
  sl_working: { bg:'Обработвам {0}/{1}…', ru:'Обрабатываю {0}/{1}…', uk:'Обробляю {0}/{1}…', en:'Processing {0}/{1}…', de:'Verarbeite {0}/{1}…', fr:'Traitement {0}/{1}…', es:'Procesando {0}/{1}…', 'es-MX':'Procesando {0}/{1}…', it:'Elaborazione {0}/{1}…', pt:'A processar {0}/{1}…', ar:'جارٍ المعالجة {0}/{1}…', hi:'प्रोसेस हो रहा है {0}/{1}…', ja:'処理中 {0}/{1}…', ky:'Иштетилүүдө {0}/{1}…', 'zh-Hant':'處理中 {0}/{1}…' },
  sl_none: { bg:'Нищо не е намерено (страницата блокира или е празна).', ru:'Ничего не найдено (страница блокирует или пуста).', uk:'Нічого не знайдено (сторінка блокує або порожня).', en:'Nothing found (the page blocks or is empty).', de:'Nichts gefunden (Seite blockiert oder leer).', fr:'Rien trouvé (page bloquée ou vide).', es:'Nada encontrado (la página bloquea o está vacía).', 'es-MX':'Nada encontrado (la página bloquea o está vacía).', it:'Nulla trovato (la pagina blocca o è vuota).', pt:'Nada encontrado (a página bloqueia ou está vazia).', ar:'لم يُعثر على شيء (الصفحة تحظر أو فارغة).', hi:'कुछ नहीं मिला (पेज ब्लॉक करता है या खाली है)।', ja:'見つかりません（ブロックまたは空ページ）。', ky:'Эч нерсе табылган жок (барак бөгөттөйт же бош).', 'zh-Hant':'找不到內容（頁面封鎖或為空）。' },
  sl_csv: { bg:'Свали CSV', ru:'Скачать CSV', uk:'Завантажити CSV', en:'Download CSV', de:'CSV laden', fr:'Télécharger CSV', es:'Descargar CSV', 'es-MX':'Descargar CSV', it:'Scarica CSV', pt:'Transferir CSV', ar:'تنزيل CSV', hi:'CSV डाउनलोड', ja:'CSVをダウンロード', ky:'CSV жүктөө', 'zh-Hant':'下載 CSV' },
  sl_copy: { bg:'Копирай контактите', ru:'Копировать контакты', uk:'Копіювати контакти', en:'Copy contacts', de:'Kontakte kopieren', fr:'Copier les contacts', es:'Copiar contactos', 'es-MX':'Copiar contactos', it:'Copia contatti', pt:'Copiar contactos', ar:'نسخ جهات الاتصال', hi:'संपर्क कॉपी करें', ja:'連絡先をコピー', ky:'Байланыштарды көчүрүү', 'zh-Hant':'複製聯絡資訊' },
  sl_copied: { bg:'Копирано ✓', ru:'Скопировано ✓', uk:'Скопійовано ✓', en:'Copied ✓', de:'Kopiert ✓', fr:'Copié ✓', es:'Copiado ✓', 'es-MX':'Copiado ✓', it:'Copiato ✓', pt:'Copiado ✓', ar:'تم النسخ ✓', hi:'कॉपी हो गया ✓', ja:'コピーしました ✓', ky:'Көчүрүлдү ✓', 'zh-Hant':'已複製 ✓' },
  sl_type: { bg:'Тип', ru:'Тип', uk:'Тип', en:'Type', de:'Typ', fr:'Type', es:'Tipo', 'es-MX':'Tipo', it:'Tipo', pt:'Tipo', ar:'النوع', hi:'प्रकार', ja:'種類', ky:'Түрү', 'zh-Hant':'類型' },
  sl_words: { bg:'думи', ru:'слов', uk:'слів', en:'words', de:'Wörter', fr:'mots', es:'palabras', 'es-MX':'palabras', it:'parole', pt:'palavras', ar:'كلمات', hi:'शब्द', ja:'語', ky:'сөз', 'zh-Hant':'字' },
  sl_links: { bg:'връзки', ru:'ссылок', uk:'посилань', en:'links', de:'Links', fr:'liens', es:'enlaces', 'es-MX':'enlaces', it:'link', pt:'ligações', ar:'روابط', hi:'लिंक', ja:'リンク', ky:'шилтеме', 'zh-Hant':'連結' },
  sl_try: { bg:'Пробвай с пример', ru:'Попробовать на примере', uk:'Спробувати на прикладі', en:'Try with an example', de:'Mit Beispiel testen', fr:'Essayer avec un exemple', es:'Probar con un ejemplo', 'es-MX':'Probar con un ejemplo', it:'Prova con un esempio', pt:'Experimentar com exemplo', ar:'جرّب مثالاً', hi:'उदाहरण से आज़माएँ', ja:'サンプルで試す', ky:'Мисал менен сынап көр', 'zh-Hant':'用範例試試' },
  sl_try_hint: { bg:'Зарежда 2 вградени примерни страници (клиника и магазин) — работи и без интернет.', ru:'Загружает 2 встроенные примерные страницы (клиника и магазин) — работает и без интернета.', uk:'Завантажує 2 вбудовані приклади сторінок (клініка й магазин) — працює і без інтернету.', en:'Loads 2 built-in sample pages (a clinic and a shop) — works offline too.', de:'Lädt 2 eingebaute Beispielseiten (Klinik und Shop) — funktioniert auch offline.', fr:'Charge 2 pages d’exemple intégrées (clinique et boutique) — fonctionne aussi hors ligne.', es:'Carga 2 páginas de ejemplo integradas (clínica y tienda) — funciona también sin conexión.', 'es-MX':'Carga 2 páginas de ejemplo integradas (clínica y tienda) — funciona también sin conexión.', it:'Carica 2 pagine di esempio integrate (clinica e negozio) — funziona anche offline.', pt:'Carrega 2 páginas de exemplo incorporadas (clínica e loja) — funciona também offline.', ar:'يحمّل صفحتين نموذجيتين مدمجتين (عيادة ومتجر) — يعمل دون اتصال أيضاً.', hi:'2 अंतर्निहित नमूना पेज (क्लिनिक और दुकान) लोड करता है — ऑफ़लाइन भी काम करता है।', ja:'内蔵のサンプルページ2つ（クリニックとショップ）を読み込みます — オフラインでも動作。', ky:'2 орнотулган мисал баракты (клиника жана дүкөн) жүктөйт — интернетсиз да иштейт.', 'zh-Hant':'載入 2 個內建範例頁面（診所與商店）— 離線也可用。' },
  sl_sample: { bg:'пример', ru:'пример', uk:'приклад', en:'sample', de:'Beispiel', fr:'exemple', es:'ejemplo', 'es-MX':'ejemplo', it:'esempio', pt:'exemplo', ar:'مثال', hi:'नमूना', ja:'サンプル', ky:'мисал', 'zh-Hant':'範例' },
  sl_skipped: { bg:'пропусната (филтър)', ru:'пропущена (фильтр)', uk:'пропущено (фільтр)', en:'skipped (filter)', de:'übersprungen (Filter)', fr:'ignorée (filtre)', es:'omitida (filtro)', 'es-MX':'omitida (filtro)', it:'saltata (filtro)', pt:'ignorada (filtro)', ar:'تم التخطي (مرشح)', hi:'छोड़ा गया (फ़िल्टर)', ja:'スキップ（フィルター）', ky:'өткөрүлдү (фильтр)', 'zh-Hant':'已略過（篩選）' }
});

export const title = 'On-device scraper';

const RELAY = 'https://pupikes.app/api/relay/get?url=';
// Вградените примерни страници (public/samples/*.html) — относителен път, без мрежа.
export const SAMPLE_PAGES = ['samples/demo-contact.html', 'samples/demo-shop.html'];
export const isLocalPage = (u) => !/^https?:\/\//i.test(u);
export async function getText(url, viaRelay) {
  if (isLocalPage(url)) { const r = await fetch(url); if (!r.ok) throw new Error('local ' + r.status); return await r.text(); }
  const target = viaRelay ? RELAY + encodeURIComponent(url) : url;
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  const tmo = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000));
  if (CH && CH.get) { const r = await Promise.race([CH.get({ url: target, headers: { Accept: 'text/html,*/*', 'User-Agent': 'Mozilla/5.0 (Linux; Android 12) PupikesScraper/1.0' } }), tmo]); return typeof r.data === 'string' ? r.data : JSON.stringify(r.data || ''); }
  const r = await Promise.race([fetch(target, { headers: { Accept: 'text/html,*/*' } }), tmo]); return await r.text();
}
const TYPES = [
  ['recipe', /ingredient|recipe|рецепт|съставк|cook|bake|печен|варен/i], ['job', /vacanc|job|career|hiring|работа|вакансия|обява за работа|résumé|cv\b/i],
  ['product', /add to cart|buy now|price|в кошницата|купи|цена|₽|€|\$\s?\d|add to basket/i], ['classified', /for sale|продава|обява|olx|classified|б\/у|second hand/i],
  ['news', /breaking|reported|according to|journalist|новини|новости|news|пресцентър|agency/i], ['contact', /contact us|контакти|телефон|адрес|opening hours|работно време|@/i],
  ['medical', /symptom|treatment|лечение|симптом|diagnos|лекар|doctor|clinic/i], ['event', /tickets|event|събитие|мероприятие|concert|festival|schedule/i],
  ['howto', /how to|step \d|стъпка|как да|guide|tutorial|инструкция/i], ['review', /review|рецензия|отзив|rating|звезд|stars/i], ['article', /./]
];
const uniq = (a) => Array.from(new Set(a));
export function extract(html, baseUrl) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const title = ((noScript.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
  const desc = ((noScript.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)/i) || [])[1] || '').trim();
  const heads = uniq((noScript.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi) || []).map((h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter((h) => h.length > 2)).slice(0, 12);
  const text = noScript.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const emails = uniq((text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map((e) => e.toLowerCase()).filter((e) => !/\.(png|jpg|gif|svg|webp)$/.test(e))).slice(0, 50);
  const phones = uniq((text.match(/(?:\+|00)\d[\d\s().-]{7,17}\d/g) || []).map((p) => p.replace(/\s+/g, ' ').trim())).slice(0, 50);
  try { baseUrl = new URL(baseUrl, location.href).href; } catch (_) {}   // относителен (примерна страница) → абсолютен
  let host = ''; try { host = new URL(baseUrl).hostname; } catch (_) {}
  const links = uniq((html.match(/href=["']([^"'#?]+)["']/gi) || []).map((m) => m.replace(/^href=["']|["']$/g, '')).map((l) => { try { return new URL(l, baseUrl).href; } catch (_) { return ''; } }).filter((l) => /^https?:/.test(l)));
  const internal = links.filter((l) => { try { return new URL(l).hostname === host; } catch (_) { return false; } });
  const type = (TYPES.find(([, re]) => re.test(text.slice(0, 20000))) || ['article'])[0];
  return { title, desc, heads, emails, phones, links: links.length, internal: internal.length, external: links.length - internal.length, words: text.split(' ').filter(Boolean).length, type, text };
}
// DuckDuckGo HTML (през relay — от Китай/без CORS): линкове на резултатите.
export async function searchUrls(q, max) {
  const html = await getText('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), true);
  const out = [];
  const re = /class="result__a"[^>]*href="([^"]+)"/g; let m;
  while ((m = re.exec(html)) && out.length < max) {
    let u = m[1]; const uddg = u.match(/uddg=([^&]+)/); if (uddg) u = decodeURIComponent(uddg[1]);
    if (/^https?:/.test(u) && !out.includes(u)) out.push(u);
  }
  return out;
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <p class="hint">${esc(t('sl_hint'))}</p>
      <label>${esc(t('sl_urls'))}</label>
      <textarea id="sl-urls" rows="4" placeholder="https://example.org/contact&#10;https://…"></textarea>
      <label>${esc(t('sl_query'))}</label>
      <input type="text" id="sl-q" autocomplete="off" />
      <div style="display:flex;gap:8px"><div style="flex:1"><label>${esc(t('sl_must'))}</label><input type="text" id="sl-must" /></div><div style="flex:1"><label>${esc(t('sl_excl'))}</label><input type="text" id="sl-excl" /></div></div>
      <button class="btn" id="sl-go">${esc(t('sl_go'))}</button>
      <button class="btn sec" id="sl-try">${esc(t('sl_try'))}</button><div class="hint">${esc(t('sl_try_hint'))}</div>
      <div class="status" id="sl-status"></div>
      <div id="sl-out" style="margin-top:10px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sec" id="sl-csv" style="display:none">${esc(t('sl_csv'))}</button><button class="btn sec" id="sl-copy" style="display:none">${esc(t('sl_copy'))}</button></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  let results = [];
  $('#sl-go').addEventListener('click', async () => {
    let urls = $('#sl-urls').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((u) => (/^https?:\/\//i.test(u) || /^samples\//.test(u) ? u : 'https://' + u));
    const q = $('#sl-q').value.trim(); const st = $('#sl-status'); const out = $('#sl-out');
    if (!urls.length && !q) { st.textContent = t('sl_need'); return; }
    const btn = $('#sl-go'); btn.disabled = true; out.innerHTML = ''; results = [];
    try {
      if (!urls.length) { st.textContent = '🔎 ' + q; try { urls = await searchUrls(q, 10); } catch (_) { urls = []; } }
      const must = $('#sl-must').value.trim().toLowerCase(), excl = $('#sl-excl').value.trim().toLowerCase();
      for (let i = 0; i < urls.length; i++) {
        st.textContent = t('sl_working').replace('{0}', i + 1).replace('{1}', urls.length);
        let r = null;
        try { r = extract(await getText(urls[i], false), urls[i]); } catch (_) { r = null; }
        if (!r) { results.push({ url: urls[i], error: true }); continue; }
        const low = r.text.toLowerCase();
        if ((must && !low.includes(must)) || (excl && low.includes(excl))) { results.push({ url: urls[i], skipped: true }); continue; }
        delete r.text; r.url = urls[i]; results.push(r);
      }
      st.textContent = '';
      const ok = results.filter((r) => !r.error && !r.skipped);
      out.innerHTML = results.map((r) => r.error ? `<div class="hint">✗ ${esc(r.url)} — ${esc(t('sl_none'))}</div>` : r.skipped ? `<div class="hint">↷ ${esc(r.url)} — ${esc(t('sl_skipped'))}</div>` :
        `<div style="padding:10px;margin:6px 0;border:1px solid rgba(127,127,127,.35);border-radius:10px"><div><b>${esc(r.title || r.url)}</b>${isLocalPage(r.url) ? ` <span style="font-size:.75em;padding:1px 6px;border-radius:8px;background:rgba(210,153,34,.25)">${esc(t('sl_sample'))}</span>` : ''}</div><div class="hint">${esc(r.url)}</div>${r.desc ? `<div style="margin-top:4px">${esc(r.desc.slice(0, 200))}</div>` : ''}
          <div class="hint" style="margin-top:4px">${esc(t('sl_type'))}: <b>${esc(r.type)}</b> · ${r.words} ${esc(t('sl_words'))} · ${r.links} ${esc(t('sl_links'))} (${r.internal}/${r.external})</div>
          ${r.emails.length ? `<div>✉ ${r.emails.map(esc).join(', ')}</div>` : ''}${r.phones.length ? `<div>☎ ${r.phones.map(esc).join(', ')}</div>` : ''}
          ${r.heads.length ? `<div class="hint" style="margin-top:4px">H: ${r.heads.slice(0, 6).map(esc).join(' · ')}</div>` : ''}</div>`).join('');
      $('#sl-csv').style.display = ok.length ? '' : 'none'; $('#sl-copy').style.display = ok.length ? '' : 'none';
    } finally { btn.disabled = false; }
  });
  // „Пробвай с пример": двете вградени страници → в полето → извличане (и офлайн).
  $('#sl-try').addEventListener('click', () => { $('#sl-urls').value = SAMPLE_PAGES.join('\n'); $('#sl-q').value = ''; $('#sl-go').click(); });
  $('#sl-csv').addEventListener('click', () => {
    const ok = results.filter((r) => !r.error && !r.skipped);
    const csv = '﻿url;title;type;words;links;emails;phones;headings\n' + ok.map((r) => [r.url, r.title, r.type, r.words, r.links, r.emails.join(' '), r.phones.join(' '), r.heads.join(' | ')].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'scrape.csv', 'text/csv');
  });
  $('#sl-copy').addEventListener('click', async (e) => {
    const ok = results.filter((r) => !r.error && !r.skipped);
    const txt = ok.map((r) => [r.url].concat(r.emails, r.phones).join('\n')).join('\n\n');
    if (await copyText(txt)) { const o = e.target.textContent; e.target.textContent = t('sl_copied'); setTimeout(() => { e.target.textContent = o; }, 900); }
  });
}
