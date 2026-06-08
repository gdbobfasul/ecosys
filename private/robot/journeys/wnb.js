// Version: 1.0173
// WhereNoBiz — работни сценарии „като човек": регистрация → създай пост (минава
// модерация) → АДМИН одобрява/отказва. Накрая чисти.
'use strict';

// Минимален ВАЛИДЕН PNG (1×1) — sharp трябва да го обработи; качваме го като реална снимка.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);
const pngFile = (name) => ({ name, mimeType: 'image/png', buffer: PNG_1x1 });

module.exports = {
  app: 'wnb',
  label: 'WhereNoBiz (потребител + админ модерация)',
  writes: true,
  setup(ctx, env) {
    ctx.email = `robot+${ctx.runToken}@test.local`;
    ctx.pass = 'Robot12345!';
    ctx.adminEmail = env.WNB_ADMIN_USER || '';
    ctx.adminPass = env.WNB_ADMIN_PASS || '';
  },
  scenarios: [
    {
      name: 'Потребител: регистрация (API) + вход (UI)',
      steps: [
        { api: { method: 'POST', path: '/api/wnb/register', json: (c) => ({ email: c.email, password: c.pass, display_name: 'Робот Тест' }) }, expectStatus: 201 },
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { goto: '/wherenobiz/login.html' },
        { wait: 1000 },
        { fill: '#email', value: (c) => c.email },
        { fill: '#password', value: (c) => c.pass },
        { click: '#btnSubmit' },
        { wait: 1500 },
        { api: { method: 'GET', path: '/api/wnb/me' }, expectStatus: 200 },
      ],
    },
    {
      name: 'Потребител: създай пост (минава модерация)',
      steps: [
        { api: { method: 'POST', path: '/api/wnb/posts', json: () => ({ country_code: 'BG', title: 'Робот липсващ бизнес', description: 'Автоматичен тест от робота — описание над двайсет знака.', links: [] }) },
          expectStatus: 201, saveAs: 'postId', extract: (b) => b.post && b.post.id },
        { label: 'КАЧВАНЕ НА ИЗОБРАЖЕНИЕ: качи снимка към поста', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/posts/${c.postId}/images`, {
            multipart: { image: pngFile('robot-post.png') }, failOnStatusCode: false,
          });
          if (r.status() >= 500) throw new Error('качване на WNB снимка HTTP ' + r.status());
          if (r.status() !== 201 && r.status() !== 409) {
            const b = await r.json().catch(() => ({}));
            throw new Error('качване на WNB снимка HTTP ' + r.status() + ' ' + (b.error || ''));
          }
        } },
      ],
    },
    {
      name: 'Админ: вход + одобри поста',
      steps: [
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.adminEmail, password: c.adminPass }) }, expectStatus: 200 },
        { api: { method: 'GET', path: '/api/wnb/moderation/pending' }, expectStatus: 200 },
        { api: { method: 'POST', path: (c) => `/api/wnb/moderation/posts/${c.postId}/approve`, json: {} }, expectStatus: 200 },
        { label: 'провери, че е approved', run: async (page, c, h) => {
          const r = await page.request.get(h.base + `/api/wnb/posts/${c.postId}`);
          const b = await r.json().catch(() => ({}));
          if (!b.post || b.post.status !== 'approved') throw new Error('статус: ' + (b.post && b.post.status));
        } },
      ],
    },
    {
      name: 'Админ: създай втори пост (друг потребител) и го откажи',
      steps: [
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        // нов потребител за втория пост (един активен пост на държава на потребител)
        { api: { method: 'POST', path: '/api/wnb/register', json: (c) => ({ email: `robot2+${c.runToken}@test.local`, password: c.pass, display_name: 'Робот 2' }) }, expectStatus: 201 },
        { api: { method: 'POST', path: '/api/wnb/posts', json: () => ({ country_code: 'BG', title: 'Робот пост за отказ', description: 'Този ще бъде отказан от модератора — над двайсет знака.', links: [] }) },
          expectStatus: 201, saveAs: 'postId2', extract: (b) => b.post && b.post.id },
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.adminEmail, password: c.adminPass }) }, expectStatus: 200 },
        { api: { method: 'POST', path: (c) => `/api/wnb/moderation/posts/${c.postId2}/reject`, json: { note: 'робот отказа' } }, expectStatus: 200 },
      ],
    },
    {
      name: 'Почистване (свали тестовите постове)',
      steps: [
        { api: { method: 'POST', path: (c) => `/api/wnb/moderation/posts/${c.postId}/remove`, json: { note: 'почистване' } } },
        { api: { method: 'POST', path: (c) => `/api/wnb/moderation/posts/${c.postId2}/remove`, json: { note: 'почистване' } } },
      ],
    },
  ],
};
