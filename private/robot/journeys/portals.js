// Version: 1.0173
// Портали — работни сценарии „като човек": регистрация (UI) → вход (UI) →
// ползване на услуга (QR, клиентско) → почистване на тестовите потребители.
'use strict';

module.exports = {
  app: 'portals',
  label: 'Портали (регистрация, вход, услуга)',
  writes: true,
  setup(ctx) {
    // префикс __diagtest → хваща се от /api/portals/adm/cleanup-test
    ctx.user = `__diagtest_${ctx.runToken}`.slice(0, 30);
    ctx.pass = 'robot1234';
  },
  scenarios: [
    {
      name: 'Регистрация (UI)',
      steps: [
        { goto: '/portals/register.html' },
        { fill: '#username', value: (c) => c.user },
        { fill: '#password', value: (c) => c.pass },
        { click: '#btn-register' },
        { wait: 1500 },
        { api: { method: 'GET', path: '/api/portals/me' }, expectStatus: 200 },
      ],
    },
    {
      name: 'Изход + вход отново (UI)',
      steps: [
        { api: { method: 'POST', path: '/api/portals/logout' } },
        { goto: '/portals/login.html' },
        { fill: '#username', value: (c) => c.user },
        { fill: '#password', value: (c) => c.pass },
        { click: '#btn-login' },
        { wait: 1500 },
        { label: 'проверка, че съм логнат', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/portals/me');
          const b = await r.json().catch(() => ({}));
          if (!b.logged_in) throw new Error('не съм логнат след вход');
        } },
      ],
    },
    {
      name: 'Ползвай услуга — QR генератор (клиентско)',
      steps: [
        { goto: '/portals/services/qr.html' },
        { expect: '#gentext' },
        { fill: '#gentext', value: 'robot test qr' },
        { label: 'генерирай QR', run: async (page) => { await page.evaluate(() => window.genQR && window.genQR()); } },
        { wait: 600 },
        { expect: '#genresult' },
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
