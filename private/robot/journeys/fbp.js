// Version: 1.0201
// Find Best Price — работен сценарий „като човек": регистрация → вход (UI) → създай
// обект → добави продукт → търсене → ZERO PRICE (публикувай заявка + прати оферта).
// FBP няма модерация (продуктите са публични веднага), затова няма админ стъпка.
// + НЕГАТИВНИ сценарии: невалиден вход (очаквай 400, НИКОГА 500) и „лош потребител"
//   (без сесия / фалшива бисквитка / чужд обект / инжекции / огромни полета → 401/403/400/404,
//   НИКОГА 500 или изтичане на данни).
'use strict';

// Помощник: прави HTTP заявка БЕЗ сесия (нов чист context, без бисквитки).
// По избор слага фалшива бисквитка, за да симулира подправена сесия.
// Ползва НЕЗАВИСИМ Playwright APIRequestContext (НЕ пипа браузъра/споделения контекст
// на run.js), та затварянето му не сваля цялата сесия на робота.
async function rawRequest(page, h, method, path, { json, forgedCookie } = {}) {
  const ctxOpts = { ignoreHTTPSErrors: true };
  if (forgedCookie) ctxOpts.extraHTTPHeaders = { Cookie: forgedCookie };
  const rc = await require('playwright').request.newContext(ctxOpts);
  try {
    const o = { failOnStatusCode: false };
    if (json !== undefined) o.data = json;
    const res = await rc[method.toLowerCase()](h.base + path, o);
    let body = null;
    try { body = await res.json(); } catch (_) { /* не-JSON */ }
    return { status: res.status(), body };
  } finally {
    try { await rc.dispose(); } catch (_) {}
  }
}

// Помощник: заявка със СЕГАШНАТА сесия (споделя бисквитките на страницата).
async function sessionRequest(page, h, method, path, json) {
  const o = { failOnStatusCode: false };
  if (json !== undefined) o.data = json;
  const res = await page.request[method.toLowerCase()](h.base + path, o);
  let body = null;
  try { body = await res.json(); } catch (_) { /* не-JSON */ }
  return { status: res.status(), body };
}

// Кратки твърдения — хвърлят при грешен изход.
function assertStatusIn(label, status, allowed) {
  if (status >= 500) throw new Error(`${label}: сървърна грешка ${status} (НИКОГА не бива 5xx)`);
  if (!allowed.includes(status)) throw new Error(`${label}: статус ${status}, чаках един от [${allowed.join(',')}]`);
}
function assertNo500(label, status) {
  if (status >= 500) throw new Error(`${label}: сървърна грешка ${status} (НИКОГА не бива 5xx)`);
}

module.exports = {
  app: 'fbp',
  label: 'Find Best Price (вход → обект → продукт → търсене → Zero Price)',
  writes: true,
  setup(ctx) {
    ctx.email = `robot+fbp+${ctx.runToken}@test.local`;
    ctx.pass = 'Robot12345!';
  },
  scenarios: [
    {
      name: 'Потребител: регистрация (API) + вход (UI)',
      steps: [
        { api: { method: 'POST', path: '/api/fbp/register', json: (c) => ({ email: c.email, password: c.pass, display_name: 'Робот FBP' }) }, expectStatus: 201 },
        { api: { method: 'POST', path: '/api/fbp/logout' } },
        { goto: '/find-best-price/add.html' },
        { wait: 1000 },
        { fill: '#l_email', value: (c) => c.email },
        { fill: '#l_pass', value: (c) => c.pass },
        { click: '#btnLogin' },
        { wait: 1500 },
        { api: { method: 'GET', path: '/api/fbp/me' }, expectStatus: 200 },
      ],
    },
    {
      name: 'Създай обект (бизнес)',
      steps: [
        { api: { method: 'POST', path: '/api/fbp/business', json: () => ({ btype: 'online', name: 'Робот магазин', country: 'Bulgaria', city: 'София', location_exact: 'robot-test 42.0,23.0' }) },
          expectStatus: 201, saveAs: 'bizId', extract: (b) => b.business && b.business.id },
      ],
    },
    {
      name: 'Добави продукт под обекта',
      steps: [
        { api: { method: 'POST', path: '/api/fbp/products', json: (c) => ({ business_id: c.bizId, kind: 'product', category: 'food', name: 'Робот хляб', price: 1.23, currency: 'EUR' }) },
          expectStatus: 201, saveAs: 'prodId', extract: (b) => b.product && b.product.id },
        { label: 'провери, че продуктът е в „моите"', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/fbp/products/mine');
          const b = await r.json().catch(() => ({}));
          if (!Array.isArray(b.products) || !b.products.some((p) => p.id === c.prodId)) throw new Error('продуктът не е в /products/mine');
        } },
      ],
    },
    {
      name: 'ТЪРСЕНЕ: публичното търсене връща резултати',
      steps: [
        { label: 'GET /api/fbp/search → 200 + поле results', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/fbp/search?category=&country=', { failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('search HTTP ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (!Array.isArray(b.results)) throw new Error('search: няма масив results');
        } },
      ],
    },
    {
      name: 'ZERO PRICE: публикувай заявка + прати оферта',
      steps: [
        { api: { method: 'POST', path: '/api/fbp/wanted', json: () => ({ title: 'Робот търси рядък продукт', description: 'Автоматичен тест от робота — Zero Price заявка.', country: 'Bulgaria', city: 'София' }) },
          expectStatus: 201, saveAs: 'wantedId', extract: (b) => b.request && b.request.id },
        { api: { method: 'POST', path: (c) => `/api/fbp/wanted/${c.wantedId}/offer`, json: () => ({ price: 9.99, currency: 'EUR', where_country: 'Germany', note: 'робот оферта — има го в Германия' }) },
          expectStatus: 201 },
        { label: 'провери, че офертата е по заявката', run: async (page, c, h) => {
          const r = await page.request.get(h.base + `/api/fbp/wanted/${c.wantedId}`);
          const b = await r.json().catch(() => ({}));
          if (!b.offers || !b.offers.length) throw new Error('Zero Price: офертата не се появи по заявката');
        } },
      ],
    },

    // ───────────────────────── НЕВАЛИДЕН ВХОД (очаквай 400, НИКОГА 500) ──────────────
    {
      name: 'НЕВАЛИДЕН ВХОД: обект/продукт/заявка/оферта дават 400, не 500',
      steps: [
        { label: 'обект без име → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/business',
            { btype: 'online', country: 'Bulgaria', location_exact: 'x 1,2' });
          assertStatusIn('обект без име', r.status, [400]);
        } },
        { label: 'обект без държава → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/business',
            { btype: 'online', name: 'Без държава', location_exact: 'x 1,2' });
          assertStatusIn('обект без държава', r.status, [400]);
        } },
        { label: 'обект без локация → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/business',
            { btype: 'online', name: 'Без локация', country: 'Bulgaria' });
          assertStatusIn('обект без локация', r.status, [400]);
        } },
        { label: 'обект с невалиден тип → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/business',
            { btype: 'няма_такъв', name: 'Лош тип', country: 'Bulgaria', location_exact: 'x 1,2' });
          assertStatusIn('обект лош тип', r.status, [400]);
        } },
        { label: 'продукт с грешна категория за вида → 400', run: async (page, c, h) => {
          // kind=product, но category е услугова (dentist) → bad_category
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'product', category: 'dentist', name: 'Грешна категория', price: 1 });
          assertStatusIn('продукт грешна категория', r.status, [400]);
        } },
        { label: 'продукт с отрицателна цена → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'product', category: 'food', name: 'Минус цена', price: -5 });
          assertStatusIn('продукт минус цена', r.status, [400]);
        } },
        { label: 'продукт без име → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'product', category: 'food', price: 1 });
          assertStatusIn('продукт без име', r.status, [400]);
        } },
        { label: 'продукт с нечислова цена → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'product', category: 'food', name: 'NaN цена', price: 'безценен' });
          assertStatusIn('продукт NaN цена', r.status, [400]);
        } },
        { label: 'Zero Price заявка без заглавие → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/wanted', { country: 'Bulgaria' });
          assertStatusIn('заявка без заглавие', r.status, [400]);
        } },
        { label: 'Zero Price заявка без държава → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/wanted', { title: 'Нещо' });
          assertStatusIn('заявка без държава', r.status, [400]);
        } },
        { label: 'оферта с невалидна (отрицателна) цена → 400', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', `/api/fbp/wanted/${c.wantedId}/offer`,
            { price: -9, currency: 'EUR', where_country: 'Germany', note: 'лоша цена' });
          assertStatusIn('оферта минус цена', r.status, [400]);
        } },
      ],
    },

    // ───────────────────────── ЛОШ ПОТРЕБИТЕЛ / АТАКА (401/403/400/404, НИКОГА 500) ──
    {
      name: 'АТАКА: защитени endpoint-и без сесия / с фалшива бисквитка → 401',
      steps: [
        { label: 'POST /business без сесия → 401', run: async (page, c, h) => {
          const r = await rawRequest(page, h, 'POST', '/api/fbp/business',
            { json: { btype: 'online', name: 'Хакер', country: 'Bulgaria', location_exact: 'x 1,2' } });
          assertStatusIn('POST /business без сесия', r.status, [401]);
        } },
        { label: 'POST /products без сесия → 401', run: async (page, c, h) => {
          const r = await rawRequest(page, h, 'POST', '/api/fbp/products',
            { json: { business_id: c.bizId, kind: 'product', category: 'food', name: 'Х', price: 1 } });
          assertStatusIn('POST /products без сесия', r.status, [401]);
        } },
        { label: 'POST /wanted без сесия → 401', run: async (page, c, h) => {
          const r = await rawRequest(page, h, 'POST', '/api/fbp/wanted',
            { json: { title: 'Х', country: 'Bulgaria' } });
          assertStatusIn('POST /wanted без сесия', r.status, [401]);
        } },
        { label: 'GET /business/mine без сесия → 401', run: async (page, c, h) => {
          const r = await rawRequest(page, h, 'GET', '/api/fbp/business/mine');
          assertStatusIn('GET /business/mine без сесия', r.status, [401]);
        } },
        { label: 'GET /products/mine без сесия → 401', run: async (page, c, h) => {
          const r = await rawRequest(page, h, 'GET', '/api/fbp/products/mine');
          assertStatusIn('GET /products/mine без сесия', r.status, [401]);
        } },
        { label: 'POST /business с ФАЛШИВА бисквитка → 401', run: async (page, c, h) => {
          const forged = 'fbp.sid=s%3Afake-forged-session-id.deadbeefdeadbeefdeadbeefdeadbeef; connect.sid=s%3Afake.forged';
          const r = await rawRequest(page, h, 'POST', '/api/fbp/business',
            { forgedCookie: forged, json: { btype: 'online', name: 'Фалшива сесия', country: 'Bulgaria', location_exact: 'x 1,2' } });
          assertStatusIn('POST /business фалшива бисквитка', r.status, [401]);
        } },
        { label: 'GET /products/mine с ФАЛШИВА бисквитка → 401', run: async (page, c, h) => {
          const forged = 'fbp.sid=s%3Afake-forged.0000000000000000; connect.sid=s%3Aforged.xyz';
          const r = await rawRequest(page, h, 'GET', '/api/fbp/products/mine', { forgedCookie: forged });
          assertStatusIn('GET /products/mine фалшива бисквитка', r.status, [401]);
        } },
      ],
    },
    {
      name: 'АТАКА: втори потребител не може да слага продукт под чужд обект → 403',
      steps: [
        // регистрирай ВТОРИ потребител (това подменя сесията на страницата с неговата)
        { api: { method: 'POST', path: () => '/api/fbp/logout' } },
        { api: { method: 'POST', path: (c) => '/api/fbp/register',
          json: (c) => ({ email: `robot+fbp2+${c.runToken}@test.local`, password: c.pass, display_name: 'Робот FBP №2' }) },
          expectStatus: 201 },
        { label: 'вторият има СВОЯ празна листа с продукти (не вижда чуждите)', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'GET', '/api/fbp/products/mine');
          assertStatusIn('вторият GET /products/mine', r.status, [200]);
          const mine = (r.body && r.body.products) || [];
          if (mine.some((p) => p.id === c.prodId)) throw new Error('изтичане: вторият вижда продукта на първия в /mine');
        } },
        { label: 'вторият слага продукт под ЧУЖДИЯ обект → 403 not_your_business', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'product', category: 'food', name: 'Кражба под чужд обект', price: 2 });
          assertStatusIn('продукт под чужд обект', r.status, [403]);
          if (r.body && r.body.error && r.body.error !== 'not_your_business')
            throw new Error('очаквах error=not_your_business, а върна ' + r.body.error);
        } },
        // върни се в първия акаунт, за да не пречи на нищо след това
        { api: { method: 'POST', path: () => '/api/fbp/logout' } },
        { api: { method: 'POST', path: () => '/api/fbp/login', json: (c) => ({ email: c.email, password: c.pass }) },
          expectStatus: 200 },
      ],
    },
    {
      name: 'АТАКА: инжекции + огромни полета → 400/обработено, НИКОГА 500',
      steps: [
        { label: 'обект с SQL/HTML инжекция в името → не 5xx (400/201 ок)', run: async (page, c, h) => {
          const evil = `Robot'); DROP TABLE businesses;-- <script>alert(1)</script>`;
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/business',
            { btype: 'online', name: evil, country: 'Bulgaria', location_exact: 'x 1,2' });
          assertNo500('обект инжекция', r.status);
          assertStatusIn('обект инжекция', r.status, [201, 400]);
        } },
        { label: 'обект с ОГРОМНО име (100k символа) → не 5xx', run: async (page, c, h) => {
          const huge = 'A'.repeat(100000);
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/business',
            { btype: 'online', name: huge, country: 'Bulgaria', location_exact: 'x 1,2' });
          assertNo500('обект огромно име', r.status);
          // bare Express има лимит 2mb за JSON тяло, а товарът тук е ~100KB → 413 НЕ се връща
          // от приложението (само nginx би върнал 413 при свой по-нисък лимит).
          assertStatusIn('обект огромно име', r.status, [201, 400]);
        } },
        { label: 'продукт с инжекция в name/materials → не 5xx', run: async (page, c, h) => {
          const evil = `"><img src=x onerror=alert(1)>'; DELETE FROM products;--`;
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'product', category: 'food', name: evil, materials: evil, price: 1 });
          assertNo500('продукт инжекция', r.status);
          assertStatusIn('продукт инжекция', r.status, [201, 400]);
        } },
        { label: 'Zero Price заявка с огромно заглавие/описание → не 5xx', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/wanted',
            { title: 'Z'.repeat(50000), description: 'D'.repeat(200000), country: 'Bulgaria' });
          assertNo500('заявка огромна', r.status);
          // ~250KB тяло е под лимита 2mb на bare Express → 413 НЕ се връща от приложението
          // (маршрутът отрязва title/description, така че очаквай 201; 400 ако липсва държава).
          assertStatusIn('заявка огромна', r.status, [201, 400]);
        } },
      ],
    },
    {
      name: 'АТАКА: странни/огромни параметри в търсенето → 200 обработено, НИКОГА 500',
      steps: [
        { label: 'търсене с инжекция в параметрите → 200 + масив results', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'GET',
            `/api/fbp/search?country=${encodeURIComponent("'; DROP TABLE products;--")}&brand=${encodeURIComponent('<script>x</script>')}`);
          assertStatusIn('търсене инжекция', r.status, [200]);
          if (!r.body || !Array.isArray(r.body.results)) throw new Error('търсене инжекция: липсва масив results');
        } },
        { label: 'търсене с огромен параметър → 200, без 5xx', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'GET', `/api/fbp/search?brand=${encodeURIComponent('B'.repeat(20000))}`);
          // bare Express обработва дълъг query string нормално → връща 200. 414 (твърде дълъг URL)
          // се появява САМО зад nginx (свой лимит на ред в заявката), не от самото приложение.
          assertStatusIn('търсене огромно', r.status, [200]);
          if (r.status === 200 && (!r.body || !Array.isArray(r.body.results))) throw new Error('търсене огромно: липсва масив results');
        } },
        { label: 'търсене с нечислов price_min/price_max → 200, без 5xx', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'GET', '/api/fbp/search?price_min=abc&price_max=xyz');
          assertStatusIn('търсене лоша цена', r.status, [200]);
          if (!r.body || !Array.isArray(r.body.results)) throw new Error('търсене лоша цена: липсва масив results');
        } },
        { label: 'оферта по НЕСЪЩЕСТВУВАЩА заявка → 404, не 500', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/wanted/999999999/offer',
            { price: 1, currency: 'EUR', where_country: 'Germany', note: 'няма такава заявка' });
          assertStatusIn('оферта по несъществуваща заявка', r.status, [404]);
        } },
      ],
    },
  ],
};
