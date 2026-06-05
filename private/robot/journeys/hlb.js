// Version: 1.0173
// House-Look-Book — работни сценарии „като човек": регистрация → създай къща →
// подай за модерация; после АДМИН одобрява и отказва. Накрая чисти след себе си.
'use strict';

const HOUSE = {
  footprint: 'square', roof: 'gabled', floors: 1, windowsPerFloor: 2,
  wallColor: '#e8d9c0', roofColor: '#8a4b3b', accentColor: '#3b6ea5',
  extras: { pool: false, boat: false, pier: false }, rooms: [[]],
};

module.exports = {
  app: 'hlb',
  label: 'House-Look-Book (потребител + админ модерация)',
  writes: true,
  setup(ctx, env) {
    ctx.email = `robot+${ctx.runToken}@test.local`;
    ctx.pass = 'Robot12345!';
    ctx.adminEmail = env.HLB_ADMIN_USER || '';
    ctx.adminPass = env.HLB_ADMIN_PASS || '';
  },
  scenarios: [
    {
      name: 'Потребител: регистрация (API) + вход (UI)',
      steps: [
        { api: { method: 'POST', path: '/api/hlb/register', json: (c) => ({ email: c.email, password: c.pass, display_name: 'Робот Тест' }) }, expectStatus: 201 },
        { api: { method: 'POST', path: '/api/hlb/logout' } },
        { goto: '/houselookbook/login.html' },
        { wait: 1000 },
        { fill: '#email', value: (c) => c.email },
        { fill: '#password', value: (c) => c.pass },
        { click: '#btnSubmit' },
        { wait: 1500 },
        { api: { method: 'GET', path: '/api/hlb/me' }, expectStatus: 200 },
      ],
    },
    {
      name: 'Потребител: създай къща + подай за модерация',
      steps: [
        { api: { method: 'POST', path: '/api/hlb/proposals', json: () => ({ title: 'Робот къща', description: 'Автоматичен тест.', composer_params: HOUSE }) },
          expectStatus: 201, saveAs: 'propId', extract: (b) => b.proposal && b.proposal.id },
        { api: { method: 'POST', path: (c) => `/api/hlb/proposals/${c.propId}/submit` }, expectStatus: 200 },
      ],
    },
    {
      name: 'Админ: вход + одобри къщата',
      steps: [
        { api: { method: 'POST', path: '/api/hlb/logout' } },
        { api: { method: 'POST', path: '/api/hlb/login', json: (c) => ({ email: c.adminEmail, password: c.adminPass }) }, expectStatus: 200 },
        { api: { method: 'GET', path: '/api/hlb/moderation/pending' }, expectStatus: 200 },
        { api: { method: 'POST', path: (c) => `/api/hlb/moderation/proposals/${c.propId}/approve`, json: { note: 'робот одобри' } }, expectStatus: 200 },
        { label: 'провери, че е approved', run: async (page, c, h) => {
          const r = await page.request.get(h.base + `/api/hlb/proposals/${c.propId}`);
          const b = await r.json().catch(() => ({}));
          if (!b.proposal || b.proposal.status !== 'approved') throw new Error('статус: ' + (b.proposal && b.proposal.status));
        } },
      ],
    },
    {
      name: 'Админ: създай втора, после я откажи',
      steps: [
        { api: { method: 'POST', path: '/api/hlb/proposals', json: () => ({ title: 'Робот къща 2', composer_params: HOUSE }) },
          expectStatus: 201, saveAs: 'propId2', extract: (b) => b.proposal && b.proposal.id },
        { api: { method: 'POST', path: (c) => `/api/hlb/proposals/${c.propId2}/submit` }, expectStatus: 200 },
        { api: { method: 'POST', path: (c) => `/api/hlb/moderation/proposals/${c.propId2}/reject`, json: { note: 'робот отказа' } }, expectStatus: 200 },
      ],
    },
    {
      name: 'Почистване (свали тестовите къщи)',
      steps: [
        { api: { method: 'POST', path: (c) => `/api/hlb/moderation/proposals/${c.propId}/remove`, json: { note: 'почистване' } } },
        { api: { method: 'POST', path: (c) => `/api/hlb/moderation/proposals/${c.propId2}/remove`, json: { note: 'почистване' } } },
      ],
    },
  ],
};
