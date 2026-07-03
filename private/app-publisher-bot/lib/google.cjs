// google.cjs — търсене в Google за робота.
//   googlePlay(name) — рендерира Google Play (Android магазин) и вади имена на апове.
//     Това е „Google" частта за сблъсък на име на приложение (допълва Apple App Store + AppGallery).
//   googleWeb(query) — опит за общо Google търсене; headless често дава consent/празно →
//     при неуспех викащият пада към DuckDuckGo.
const { loadPlaywright, ddg, norm } = require('./util.cjs');

async function googlePlay(name) {
  let pw;
  try { pw = loadPlaywright(); } catch (e) { return { ok: false, titles: [], note: e.message, exactish: [] }; }
  let browser;
  try {
    browser = await pw.chromium.launch();
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
    const page = await ctx.newPage();
    await page.goto('https://play.google.com/store/search?q=' + encodeURIComponent(name) + '&c=apps', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3200);
    const titles = await page.evaluate(() => {
      const s = new Set();
      document.querySelectorAll('a[href*="/store/apps/details"]').forEach((a) => {
        // Заглавието на картата е в дъщерен елемент; вземаме първия къс текст.
        let t = '';
        const span = a.querySelector('span, div');
        if (span) t = (span.textContent || '').trim();
        if (!t) t = (a.getAttribute('aria-label') || a.textContent || '').trim();
        if (t && t.length < 80) s.add(t);
      });
      return Array.from(s).slice(0, 15);
    });
    await browser.close();
    const n = norm(name);
    // „Точен-ish": заглавие, чиято нормализирана форма започва с името (следвано от името на разработчика).
    const exactish = titles.filter((t) => norm(t).startsWith(n) && norm(t).length <= n.length + 24);
    return { ok: true, titles, exactish };
  } catch (e) {
    if (browser) try { await browser.close(); } catch (_) {}
    return { ok: false, titles: [], note: String(e.message || e), exactish: [] };
  }
}

// Общо Google търсене (best-effort) с пад към DuckDuckGo.
async function googleWeb(query, limit = 6) {
  let pw;
  try { pw = loadPlaywright(); } catch (_) { return ddg(query, limit); }
  let browser;
  try {
    browser = await pw.chromium.launch();
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
    const page = await ctx.newPage();
    await page.goto('https://www.google.com/search?q=' + encodeURIComponent(query) + '&num=10&hl=en', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1800);
    const res = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a').forEach((a) => {
        const h = a.querySelector('h3');
        if (h && a.href && a.href.startsWith('http') && !a.href.includes('google.')) out.push({ title: h.textContent.trim(), url: a.href });
      });
      return out;
    });
    await browser.close();
    if (res && res.length) return res.slice(0, limit);
  } catch (_) { if (browser) try { await browser.close(); } catch (e) {} }
  // Google блокира/празно → DuckDuckGo
  return ddg(query, limit);
}

module.exports = { googlePlay, googleWeb };
