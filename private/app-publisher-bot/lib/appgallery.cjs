// appgallery.cjs — ТОЧНО четене на Huawei AppGallery търсене.
// AppGallery зарежда резултатите с AJAX (getTabDetail JSON, странициран reqPageNum=1,2,…),
// а НЕ в HTML-а. Затова зареждаме страницата през браузър, прихващаме JSON отговорите,
// скролваме за следващите страници и вадим РЕАЛНИТЕ имена на приложения (без китайските
// етикети за секции „相关应用"/„搜索应用N-M"). Работи и за търсене по ИМЕ, и по ФУНКЦИЯ
// (двойка думи, напр. „news translator").
const { loadPlaywright, norm } = require('./util.cjs');

// Етикети/шум, които API-то връща като заглавия на секции — не са приложения
// (напр. „相关应用" = свързани, „搜索应用7-10"/„搜索应用11-200" = секции с резултати).
const LABEL_RE = /^(相关应用|搜索应用|为您推荐|搜索结果|推荐|更多|더\s?보기|Приложения\/Игри|Приложения|Игри|Apps\/Games|Apps|Games|More)$|^(相关应用|搜索应用|为您推荐|搜索结果|推荐|更多)/;

async function searchAppGallery(term, opts = {}) {
  let pw;
  try { pw = loadPlaywright(); } catch (e) { return { ok: false, note: e.message, apps: [], total: 0 }; }
  const url = 'https://appgallery.huawei.com/search/' + encodeURIComponent(term);
  let browser;
  try {
    browser = await pw.chromium.launch();
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36' });
    const page = await ctx.newPage();
    const names = [];
    page.on('response', async (res) => {
      if (!res.url().includes('getTabDetail')) return;
      let txt = ''; try { txt = await res.text(); } catch (_) { return; }
      for (const m of txt.matchAll(/"name":"([^"]{1,60})"/g)) names.push(m[1]);
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
    await page.waitForTimeout(3500);
    // скролваме, за да зареди следващите страници (AJAX)
    const passes = opts.scrollPasses || 8;
    for (let i = 0; i < passes; i++) { await page.mouse.wheel(0, 4000); await page.waitForTimeout(1200); }
    await browser.close();
    // Чистене: махаме етикетите за секции и дубли; пазим реда.
    const seen = new Set(); const apps = [];
    for (const nm of names) {
      const t = nm.trim();
      if (!t || t.length < 2 || LABEL_RE.test(t)) continue;
      const key = norm(t) || t;
      if (seen.has(key)) continue; seen.add(key); apps.push(t);
    }
    return { ok: true, url, apps, total: apps.length };
  } catch (e) {
    if (browser) try { await browser.close(); } catch (_) {}
    return { ok: false, url, note: String(e.message || e), apps: [], total: 0 };
  }
}

module.exports = { searchAppGallery };
