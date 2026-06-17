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

export const title = 'Web скрапер';

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
      <label>URL за извличане</label>
      <input type="url" id="scUrl" placeholder="https://example.com" />

      <label style="margin-top:12px">CORS прокси (по избор, празно = директно)</label>
      <input type="url" id="scProxy" placeholder="напр. https://corsproxy.io/?" value="${esc(savedProxy)}" />

      <button class="btn" id="scBtn">Извлечи</button>
      <div class="status" id="scStatus"></div>
      <div class="out-block" id="scOut" style="display:none"></div>

      <div class="notice" style="margin-top:14px">
        <b>За CORS:</b> браузърът чете само сайтове, които разрешават кръстосан достъп.
        За останалите въведи безплатен CORS прокси в полето по-горе. Не вграждаме
        прокси и не държим сървър.
      </div>
      <p class="hint" style="margin-top:8px">Работи изцяло на устройството. Изисква интернет.</p>
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
    if (!target) { setStatus('err', 'Въведи URL.'); return; }
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

    const proxy = $('#scProxy').value.trim();
    try { localStorage.setItem(PROXY_KEY, proxy); } catch (_) { /* без хранилище */ }

    busy = true;
    const btn = $('#scBtn');
    btn.disabled = true;
    $('#scOut').style.display = 'none';
    setStatus('work', 'Изтеглям…');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch(buildUrl(target, proxy), { cache: 'no-store', signal: ctrl.signal });
      const ctype = (r.headers.get('content-type') || '').toLowerCase();
      const body = await r.text();
      hideStatus();

      const out = $('#scOut');
      out.style.display = 'block';

      let html = `<div class="line"><span>Статус</span><span>${r.status} ${esc(r.statusText || '')}</span></div>`;
      html += `<div class="line"><span>Тип</span><span>${esc(ctype || 'неизвестен')}</span></div>`;

      const looksJson = ctype.includes('json') || /^\s*[\[{]/.test(body);
      if (looksJson) {
        let pretty = body;
        try { pretty = JSON.stringify(JSON.parse(body), null, 2); } catch (_) { /* не е валиден JSON */ }
        if (pretty.length > 8000) pretty = pretty.slice(0, 8000) + '\n…';
        html += `<div style="margin-top:10px;font-weight:600">JSON</div>`;
        html += `<pre style="white-space:pre-wrap;word-break:break-word;margin:6px 0 0;font-size:.85em">${esc(pretty)}</pre>`;
      } else {
        const { title, desc, text, links } = extractFromHtml(body, target);
        if (title) html += `<div class="line"><span>Заглавие</span><span>${esc(title)}</span></div>`;
        if (desc) html += `<div style="margin-top:10px;font-weight:600">Описание</div><div style="margin-top:4px">${esc(desc)}</div>`;
        if (text) html += `<div style="margin-top:10px;font-weight:600">Текст</div><div style="margin-top:4px;font-size:.9em">${esc(text)}</div>`;
        if (links.length) {
          html += `<div style="margin-top:10px;font-weight:600">Връзки (${links.length})</div>`;
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
        setStatus('err', 'Заявката отне твърде дълго и беше прекъсната.');
      } else {
        // Типична причина при директна заявка е CORS блокиране (TypeError: Failed to fetch).
        setStatus('err', proxy
          ? 'Грешка при заявката. Провери URL адреса и прокситo, и връзката си.'
          : 'Заявката е блокирана (CORS) или няма връзка. Сайтът не разрешава директен достъп — въведи безплатен CORS прокси в полето по-горе.');
      }
    } finally {
      clearTimeout(timer);
      btn.disabled = false;
      busy = false;
    }
  }

  $('#scBtn').addEventListener('click', run);
}
