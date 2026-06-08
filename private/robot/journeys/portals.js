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
      name: 'Вход с Facebook + Google (бутони съществуват, потокът не дава 500)',
      steps: [
        { goto: '/portals/login.html' },
        { wait: 800 },
        { label: 'Facebook бутон присъства (или конфигът казва изключен)', run: async (page, c, h) => {
          // Бутонът #btn-fb се показва само ако fb-config има App ID. И в двата случая
          // искаме сан отговор: бутон ИЛИ изричен disabled — без 500/празнина.
          const cfgR = await page.request.get(h.base + '/api/portals/fb-config', { failOnStatusCode: false });
          if (cfgR.status() >= 500) throw new Error('fb-config HTTP ' + cfgR.status());
          const cfg = await cfgR.json().catch(() => ({}));
          const hasBtn = await page.evaluate(() => !!document.getElementById('btn-fb')).catch(() => false);
          if (!hasBtn) throw new Error('Facebook бутонът (#btn-fb) липсва в login.html');
          c.fbEnabled = !!cfg.enabled || !!cfg.appId;
        } },
        { label: 'Facebook вход потокът не дава 500 (изключен/невалиден токен = ОК)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/facebook-login', {
            failOnStatusCode: false, data: { accessToken: 'robot-invalid-token' },
          });
          // Приемливо: 503 fb_disabled (не е настроен) ИЛИ 401 bad_token (грациозен отказ).
          // НЕприемливо: 500 (счупено) или мъртъв отговор.
          if (r.status() >= 500 && r.status() !== 503) throw new Error('facebook-login HTTP ' + r.status() + ' (500 — счупено)');
          const b = await r.json().catch(() => null);
          if (!b) throw new Error('facebook-login върна непарсваем/празен отговор (статус ' + r.status() + ')');
        } },
        { label: 'Google вход потокът не дава 500 (изключен/невалиден токен = ОК)', run: async (page, c, h) => {
          const cfgR = await page.request.get(h.base + '/api/portals/google-config', { failOnStatusCode: false });
          if (cfgR.status() >= 500) throw new Error('google-config HTTP ' + cfgR.status());
          const r = await page.request.post(h.base + '/api/portals/google-login', {
            failOnStatusCode: false, data: { credential: 'robot-invalid-credential' },
          });
          if (r.status() >= 500) throw new Error('google-login HTTP ' + r.status() + ' (500 — счупено)');
          const b = await r.json().catch(() => null);
          if (!b) throw new Error('google-login върна непарсваем/празен отговор (статус ' + r.status() + ')');
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
