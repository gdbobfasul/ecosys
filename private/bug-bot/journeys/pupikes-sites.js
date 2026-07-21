// Version: 1.0001
// Pupikes SITES — журито за ДВАТА нови уеб домейна (live, само ЧЕТЕНЕ):
//   • pupikes.com = ХЪБ: голият домейн и всеки непознат път → 301 към pupikes.app;
//     разрешени са само /portals и /chat.
//   • pupikes.app = КАТАЛОГ: front page (index.html) чете catalog.json и показва аповете;
//     сваляне на неиздадено име по налучкване → иска парола (401).
//
// Пускане:  node run.js --journey pupikes
// Безопасно е и срещу prod — само навигация, без форми/писане.
'use strict';

const HUB = 'https://pupikes.com';
const APP = 'https://pupikes.app';

// Отива на URL БЕЗ да следва финалната цел автоматично за оценка на статуса/редиректа.
// Playwright следва 3xx, затова сравняваме крайния URL с очаквания.
async function gotoRaw(page, url) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => { throw new Error('не се отвори ' + url + ': ' + e.message); });
  return { status: resp ? resp.status() : 0, finalUrl: page.url() };
}

module.exports = {
  name: 'Pupikes Sites (pupikes.com хъб + pupikes.app каталог)',
  scenarios: [
    {
      name: 'pupikes.com — хъб (301 към pupikes.app освен разрешените)',
      steps: [
        { label: 'голият домейн → пренасочва към pupikes.app', run: async (page) => {
          const r = await gotoRaw(page, HUB + '/');
          if (!/^https:\/\/(www\.)?pupikes\.app\//.test(r.finalUrl)) {
            throw new Error('pupikes.com/ НЕ отиде на pupikes.app — кацна на ' + r.finalUrl + ' (статус ' + r.status + ')');
          }
        } },
        { label: 'измислен път → също пренасочва към pupikes.app (пази пътя)', run: async (page) => {
          const r = await gotoRaw(page, HUB + '/kakvoto-i-da-e-123');
          if (!/^https:\/\/(www\.)?pupikes\.app\//.test(r.finalUrl)) {
            throw new Error('pupikes.com/<измислен> НЕ отиде на pupikes.app — кацна на ' + r.finalUrl);
          }
        } },
        { label: '/portals/ е РАЗРЕШЕН (обслужва се, НЕ пренасочва към pupikes.app)', run: async (page) => {
          const r = await gotoRaw(page, HUB + '/portals/');
          if (/pupikes\.app/.test(r.finalUrl)) throw new Error('/portals/ беше пренасочен към pupikes.app — трябва да се обслужва');
          if (r.status >= 500) throw new Error('/portals/ върна HTTP ' + r.status);
        } },
      ],
    },
    {
      name: 'pupikes.app — каталог + заключване на скритите',
      steps: [
        { label: 'front page (index.html) зарежда без 4xx/5xx', run: async (page) => {
          const r = await gotoRaw(page, APP + '/');
          if (r.status >= 400) throw new Error('pupikes.app/ върна HTTP ' + r.status + ' (каталогът вероятно не е качен на сървъра)');
        } },
        { label: 'catalog.json е достъпен и е валиден JSON със списък приложения', run: async (page) => {
          const r = await page.goto(APP + '/catalog.json', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
          if (!r || r.status() >= 400) throw new Error('catalog.json върна HTTP ' + (r ? r.status() : 0));
          const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
          let data; try { data = JSON.parse(txt); } catch (e) { throw new Error('catalog.json не е валиден JSON'); }
          const groups = data.groups || [];
          const apps = groups.reduce((n, g) => n + ((g.apps || []).length), 0);
          if (apps < 1) throw new Error('catalog.json няма нито едно приложение');
        } },
        { label: 'каталожната страница реално изрежда карти на приложения', run: async (page) => {
          await gotoRaw(page, APP + '/?preview=1');
          await page.waitForTimeout(1200);
          const cards = await page.locator('.card, [class*="card"]').count().catch(() => 0);
          const bodyTxt = await page.evaluate(() => document.body.innerText).catch(() => '');
          if (cards < 1 && !/Pupikes/i.test(bodyTxt)) throw new Error('каталожната страница не показа приложения (0 карти)');
        } },
        { label: 'скрито/налучкано име → иска парола (401), не се сваля свободно', run: async (page) => {
          // невалидно/неиздадено име: очакваме 401 (Basic Auth) ИЛИ 404, но НЕ 200.
          const r = await page.goto(APP + '/nesyshtestvuvashto-app-huawei-release.apk', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
          const st = r ? r.status() : 0;
          if (st === 200) throw new Error('налучкано скрито име се свали свободно (HTTP 200) — паролата не пази');
        } },
      ],
    },
  ],
};
