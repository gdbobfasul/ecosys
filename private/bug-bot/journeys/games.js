// Version: 1.0173
// ИГРИ — порталните игри са зад вход + плащане. Затова:
//   1) Регистрираме/влизаме портал потребител (както portals.js).
//   2) Списъкът с игри (/api/portals/gms/list) връща игри.
//   3) Поне една игрова страница (/portals/games/<slug>.html) зарежда HTTP 200.
//
// Достъпът се отваря с ?adm=bgmasters-set (admin URL токен от access-control.js) —
// не пишем фалшиво плащане, само отключваме за теста. Флагваме ако страница 404-не
// или списъкът е празен.
'use strict';

const ADM = 'adm=bgmasters-set';

module.exports = {
  app: 'games',
  label: 'Игри (вход портал → списък игри → игрова страница зарежда)',
  writes: true,
  setup(ctx) {
    // префикс __diagtest → хваща се от /api/portals/adm/cleanup-test
    ctx.user = `__diagtest_g${ctx.runToken}`.slice(0, 30);
    ctx.pass = 'robot1234';
  },
  scenarios: [
    {
      name: 'Регистрация/вход на портал потребител',
      steps: [
        { api: { method: 'POST', path: '/api/portals/register', json: (c) => ({ username: c.user, password: c.pass }) }, expectStatus: 200 },
        { api: { method: 'GET', path: '/api/portals/me' }, expectStatus: 200 },
      ],
    },
    {
      name: 'Списъкът с игри връща игри (gms/list)',
      steps: [
        { label: 'GET /api/portals/gms/list?adm → 200 + непразен games[]', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/portals/gms/list?' + ADM, { timeout: 20000, failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('gms/list HTTP ' + r.status());
          const b = await r.json().catch(() => null);
          if (!b || !Array.isArray(b.games) || b.games.length === 0) {
            throw new Error('списъкът с игри е празен: ' + JSON.stringify(b).slice(0, 120));
          }
          // Запази първия slug за зареждане на страницата.
          c.gameSlug = (b.games[0] && b.games[0].slug) || 'plane-dodge';
        } },
      ],
    },
    {
      name: 'Игрова страница зарежда (HTTP 200, не 404)',
      steps: [
        { label: 'GET /portals/games/<slug>.html?adm → 200', run: async (page, c, h) => {
          const slug = c.gameSlug || 'plane-dodge';
          const resp = await page.goto(`${h.base}/portals/games/${slug}.html?${ADM}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
          const status = resp ? resp.status() : 0;
          if (status === 404) throw new Error(`игрова страница ${slug}.html → 404`);
          if (status !== 200) throw new Error(`игрова страница ${slug}.html → HTTP ${status}`);
          // Очаквай нетривиален резултат (платно/скрипт за играта), не празнина.
          await page.waitForTimeout(400);
          const has = await page.evaluate(() => !!document.querySelector('canvas, script') && document.body.innerHTML.length > 50).catch(() => false);
          if (!has) throw new Error(`игрова страница ${slug}.html е празна (без canvas/script)`);
        } },
      ],
    },
    {
      name: 'Играй → спечели (прати висок резултат) → влез в ранглистата',
      steps: [
        { label: 'POST /api/portals/gms/score — симулирай печалба', run: async (page, c, h) => {
          const slug = c.gameSlug || 'plane-dodge';
          c.winScore = 99001;
          const r = await page.request.post(h.base + '/api/portals/gms/score', { data: { game_slug: slug, score: c.winScore, level: 7 }, failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('score HTTP ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (!b.ok || Number(b.best_score) < c.winScore) throw new Error('прогресът не отрази печалбата: ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'GET /api/portals/gms/leaderboard/<slug> — печелившият е в класацията с верния резултат', run: async (page, c, h) => {
          const slug = c.gameSlug || 'plane-dodge';
          const r = await page.request.get(h.base + '/api/portals/gms/leaderboard/' + slug + '?' + ADM, { failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('leaderboard HTTP ' + r.status());
          const b = await r.json().catch(() => ({}));
          const me = (b.top || []).find((t) => t.username === c.user);
          if (!me) throw new Error('потребителят не е в ранглистата след печалба');
          if (Number(me.score) < c.winScore) throw new Error('резултатът в ранглистата е по-нисък от спечеления: ' + me.score);
        } },
      ],
    },
    {
      name: '„Лош" вход: невалидни резултати → грациозен отказ (НЕ 500)',
      steps: [
        { label: 'POST score с отрицателен резултат → 400, не 500', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/gms/score', { data: { game_slug: c.gameSlug || 'plane-dodge', score: -5, level: 1 }, failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('отрицателен резултат върна ' + r.status() + ' (трябва 400)');
          if (r.status() !== 400) throw new Error('отрицателен резултат: очаквах 400, върна ' + r.status());
        } },
        { label: 'POST score за измислена игра → отказ, не 500', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/gms/score', { data: { game_slug: 'robot-hack-game', score: 1, level: 1 }, failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('непозната игра върна ' + r.status() + ' (трябва 400)');
        } },
      ],
    },
    {
      name: 'Почистване (трий тестовите потребители)',
      steps: [
        { api: { method: 'POST', path: '/api/portals/adm/cleanup-test', json: {} } },
      ],
    },
  ],
};
