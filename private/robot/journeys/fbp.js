// Version: 1.0200
// Find Best Price — работен сценарий „като човек": регистрация → вход (UI) → създай
// обект → добави продукт → търсене → ZERO PRICE (публикувай заявка + прати оферта).
// FBP няма модерация (продуктите са публични веднага), затова няма админ стъпка.
'use strict';

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
  ],
};
