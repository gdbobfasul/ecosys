// Version: 1.0173
// Закача слушатели към Playwright страница и събира всичко съмнително:
// console грешки, необработени изключения, провалени заявки, HTTP 4xx/5xx.
'use strict';

// Позната безобидна шумка, която НЕ е бъг (favicon/sourcemap).
const IGNORE = [/favicon\.ico(\?|$)/i, /\.map(\?|$)/i];
const noise = (u) => IGNORE.some((r) => r.test(u || ''));

// Външни джаджи (TradingView, CoinGlass, Google GSI, Facebook SDK) товарят СВОИ скриптове,
// които сами си правят заявки и сами си логват грешки/4xx в конзолата (напр. графиките в
// charts.html). Тези НЕ са наши бъгове → свеждаме ги до 'info' (виждат се, но не се броят
// за грешка). Мачваме и по домейн, и по характерен път (support-portal-problems, pine-facade).
const THIRD_PARTY = [
  /tradingview\.com/i, /tradingview-widget\.com/i, /pine-facade/i, /pine_perm/i, /support-portal-problems/i, /\/pine\//i,
  /coinglass\.com/i,
  /google\.com/i, /withgoogle\.com/i, /\/gsi\//i, /gstatic\.com/i, /googleapis\.com/i, /googlesyndication\.com/i,
  /doubleclick\.net/i, /connect\.facebook\.net/i,
  // Report-only CSP нарушенията са по дефиниция безобидни (браузърът само логва, „no further
  // action has been taken") — обикновено идват от вградени външни рамки.
  /report-only Content Security Policy/i,
];
const thirdParty = (s) => THIRD_PARTY.some((r) => r.test(s || ''));

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
    // Грешка от външна джаджа (по източника на лога или по текста) → 'info', не наша грешка.
    const loc = (msg.location && msg.location() && msg.location().url) || '';
    if (thirdParty(loc) || thirdParty(text)) { add({ severity: 'info', kind: 'console-3rd', detail: text.slice(0, 300), resourceUrl: loc.slice(0, 300) }); return; }
    add({ severity: 'error', kind: 'console', detail: text.slice(0, 500) });
  });

  page.on('pageerror', (err) => {
    const blob = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    const sev = thirdParty(blob) ? 'info' : 'error';
    add({ severity: sev, kind: 'pageerror', detail: (err && err.message ? err.message : String(err)).slice(0, 500) });
  });

  page.on('requestfailed', (req) => {
    const u = req.url();
    if (noise(u)) return;
    const why = (req.failure() && req.failure().errorText) || 'неуспешна заявка';
    // ERR_ABORTED обикновено е прекъсване, защото роботът навигира нататък/затваря
    // страницата (шрифтове, lazy ресурси, CDN) → информативно, не истинска грешка.
    // Заявка на външна джаджа (TradingView и пр.) също е 'info', не наша грешка.
    const sev = (/ABORTED|ERR_ABORTED/i.test(why) || thirdParty(u)) ? 'info' : 'error';
    add({ severity: sev, kind: 'requestfailed', detail: why, resourceUrl: u.slice(0, 300) });
  });

  page.on('response', (resp) => {
    const s = resp.status();
    if (s < 400) return;
    const u = resp.url();
    if (noise(u)) return;
    // 5xx = сървърен срив (грешка). 401/403 при анонимно обхождане е ОЧАКВАНО
    // (проверки „логнат ли съм" /me /prefs) → информативно, не предупреждение.
    // Останалите 4xx (404 и пр.) = предупреждение. Външна джаджа → винаги 'info'.
    const severity = thirdParty(u) ? 'info' : (s >= 500 ? 'error' : (s === 401 || s === 403) ? 'info' : 'warn');
    add({ severity, kind: 'http', status: s, resourceUrl: u.slice(0, 300) });
  });

  return findings;
}

module.exports = { attachMonitor };
