// Version: 1.0173
// УСЛУГИ — реално зарежда порталните услуги (под /portals/services/, напр. графики)
// И самостоятелните приложения, третирани като услуги, и проверява че връщат РЕЗУЛТАТ
// (HTTP 200 + нетривиално съдържание / очакван елемент), а не празно/500.
//
// Покрива: страниците на порталните услуги; основна проверка че Find Best Price
// търсенето (/api/fbp/search) и WhereNoBiz прегледът връщат смислени структури.
'use strict';

// Порталните услуги (страници под /portals/services/). „Защитени от грешки" — но тук
// реално ги зареждаме и искаме истински резултат, не празна/счупена страница.
const SERVICE_PAGES = [
  { path: '/portals/services/charts.html', expect: 'canvas, svg, #chart' },
  { path: '/portals/services/qr.html', expect: '#gentext' },
  { path: '/portals/services/calc.html', expect: 'body' },
  { path: '/portals/services/password.html', expect: 'body' },
  { path: '/portals/services/text.html', expect: 'body' },
  { path: '/portals/services/watch20.html', expect: 'body' },
];

module.exports = {
  app: 'services',
  label: 'Услуги (портални услуги + самостоятелни приложения дават РЕЗУЛТАТ, не празно/500)',
  writes: false,
  scenarios: [
    {
      name: 'Порталните услуги се зареждат с резултат (не празно/500)',
      steps: [
        { label: 'зареди всяка услуга и провери нетривиален резултат', run: async (page, c, h) => {
          const bad = [];
          for (const s of SERVICE_PAGES) {
            const url = h.base + s.path;
            let status = 0;
            try {
              const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
              status = resp ? resp.status() : 0;
            } catch (e) {
              bad.push(`${s.path}: навигация се провали (${(e.message || e).split('\n')[0].slice(0, 60)})`);
              continue;
            }
            if (status >= 500) { bad.push(`${s.path}: HTTP ${status}`); continue; }
            if (status === 404) { bad.push(`${s.path}: 404 (липсва)`); continue; }
            await page.waitForTimeout(500);
            const bodyLen = await page.evaluate(() => (document.body ? document.body.innerText.length : 0)).catch(() => 0);
            const hasEl = await page.isVisible(s.expect).catch(() => false);
            if (bodyLen < 20 && !hasEl) bad.push(`${s.path}: празен резултат (текст ${bodyLen}, без ${s.expect})`);
          }
          if (bad.length) throw new Error('услуги без резултат → ' + bad.join(' · '));
        } },
      ],
    },
    {
      name: 'Графики (charts) реално рисуват елемент',
      steps: [
        { goto: '/portals/services/charts.html' },
        { wait: 800 },
        { label: 'има canvas/svg за графиката', run: async (page) => {
          const has = await page.evaluate(() => !!document.querySelector('canvas, svg'));
          if (!has) throw new Error('графиката не нарисува canvas/svg елемент');
        } },
      ],
    },
    {
      name: 'Find Best Price търсене връща структура {count, results}',
      steps: [
        { label: 'GET /api/fbp/search → 200 + поле results', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/fbp/search?category=&country=', { timeout: 20000, failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('FBP search HTTP ' + r.status());
          const b = await r.json().catch(() => null);
          if (!b || !Array.isArray(b.results)) throw new Error('FBP search не върна масив results: ' + JSON.stringify(b).slice(0, 120));
        } },
      ],
    },
    {
      name: 'WhereNoBiz преглед връща структура {posts}',
      steps: [
        { label: 'GET /api/wnb/posts?country=BG → 200 + поле posts', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/wnb/posts?country=BG', { timeout: 20000, failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('WNB browse HTTP ' + r.status());
          const b = await r.json().catch(() => null);
          if (!b || !Array.isArray(b.posts)) throw new Error('WNB browse не върна масив posts: ' + JSON.stringify(b).slice(0, 120));
        } },
      ],
    },
  ],
};
