// Version: 1.0173
// Закача слушатели към Playwright страница и събира всичко съмнително:
// console грешки, необработени изключения, провалени заявки, HTTP 4xx/5xx.
'use strict';

// Позната безобидна шумка, която НЕ е бъг (favicon/sourcemap).
const IGNORE = [/favicon\.ico(\?|$)/i, /\.map(\?|$)/i];
const noise = (u) => IGNORE.some((r) => r.test(u || ''));

// getCtx() връща актуалния контекст {app, scenario, targetUrl} в момента на събитието.
function attachMonitor(page, getCtx) {
  const findings = [];
  const add = (f) => findings.push({ ts: new Date().toISOString(), pageUrl: page.url(), ...getCtx(), ...f });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (noise(text)) return;
    // „Failed to load resource" дублира HTTP находката от response слушателя (със
    // същия статус и URL) → пропусни го, за да няма двойно броене/шум.
    if (/Failed to load resource/i.test(text)) return;
    add({ severity: 'error', kind: 'console', detail: text.slice(0, 500) });
  });

  page.on('pageerror', (err) => {
    add({ severity: 'error', kind: 'pageerror', detail: (err && err.message ? err.message : String(err)).slice(0, 500) });
  });

  page.on('requestfailed', (req) => {
    const u = req.url();
    if (noise(u)) return;
    const why = (req.failure() && req.failure().errorText) || 'неуспешна заявка';
    // ERR_ABORTED обикновено е прекъсване, защото роботът навигира нататък/затваря
    // страницата (шрифтове, lazy ресурси, CDN) → информативно, не истинска грешка.
    const sev = /ABORTED|ERR_ABORTED/i.test(why) ? 'info' : 'error';
    add({ severity: sev, kind: 'requestfailed', detail: why, resourceUrl: u.slice(0, 300) });
  });

  page.on('response', (resp) => {
    const s = resp.status();
    if (s < 400) return;
    const u = resp.url();
    if (noise(u)) return;
    // 5xx = сървърен срив (грешка). 401/403 при анонимно обхождане е ОЧАКВАНО
    // (проверки „логнат ли съм" /me /prefs) → информативно, не предупреждение.
    // Останалите 4xx (404 и пр.) = предупреждение.
    const severity = s >= 500 ? 'error' : (s === 401 || s === 403) ? 'info' : 'warn';
    add({ severity, kind: 'http', status: s, resourceUrl: u.slice(0, 300) });
  });

  return findings;
}

module.exports = { attachMonitor };
