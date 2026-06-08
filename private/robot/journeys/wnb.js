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

const bodyOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };

// Свеж, ИЗОЛИРАН HTTP контекст (нова бисквитена кутия) — за „без вход" и „фалшива сесия".
// Ползва браузъра на текущата страница; не пипа сесията на основния page.request.
async function freshRequest(page, extraHeaders) {
  const browser = page.context().browser();
  const c = await browser.newContext(extraHeaders ? { extraHTTPHeaders: extraHeaders } : {});
  return { request: c.request, dispose: () => c.close() };
}

// Помощ: заявката НЕ бива да гърми с 5xx, нито да „изтича" статус извън очаквания списък.
function assertNo5xx(label, status) {
  if (status >= 500) throw new Error(`${label}: HTTP ${status} (сървърна грешка — никога 5xx)`);
}
function assertOneOf(label, status, allowed) {
  assertNo5xx(label, status);
  if (!allowed.includes(status)) {
    throw new Error(`${label}: HTTP ${status} (чаках едно от ${allowed.join('/')})`);
  }
}

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
      name: 'НЕВАЛИДЕН ВХОД: пост с грешни данни → 400 (никога 500)',
      steps: [
        // Влез като обикновения първи потребител (него ще ползваме и за атакуващите проби).
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.email, password: c.pass }) }, expectStatus: 200 },
        { label: 'празно заглавие → 400 missing_title', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/wnb/posts',
            { data: { country_code: 'BG', title: '   ', description: 'има описание', links: [] }, failOnStatusCode: false });
          assertOneOf('пост с празно заглавие', r.status(), [400]);
        } },
        { label: 'липсва country_code → 400 bad_country', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/wnb/posts',
            { data: { title: 'Без държава', description: 'има описание над двайсет знака' }, failOnStatusCode: false });
          assertOneOf('пост без country_code', r.status(), [400]);
        } },
        { label: 'невалидна държава → 400 bad_country', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/wnb/posts',
            { data: { country_code: 'ZZ', title: 'Глупава държава', description: 'описание над двайсет знака' }, failOnStatusCode: false });
          assertOneOf('пост с невалидна държава', r.status(), [400]);
        } },
        // Качване на снимка с НЕВалиден файл → грациозно (400/404/403), НЕ 500.
        // Първо създаваме истински пост, после атакуваме каченето му.
        { api: { method: 'POST', path: '/api/wnb/posts', json: (c) => ({ country_code: 'DE', title: 'Робот пост за невалиден файл', description: 'Тест за невалиден качен файл — над двайсет знака.', links: [] }) },
          expectStatus: 201, saveAs: 'badImgPostId', extract: (b) => b.post && b.post.id },
        { label: 'качване БЕЗ файл → 400 no_file (никога 500)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/posts/${c.badImgPostId}/images`,
            { multipart: {}, failOnStatusCode: false });
          assertOneOf('качване без файл', r.status(), [400]);
        } },
        { label: 'качване на НЕ-изображение → грациозно (никога 500)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/posts/${c.badImgPostId}/images`,
            { multipart: { image: { name: 'evil.txt', mimeType: 'text/plain', buffer: Buffer.from('това не е снимка') } }, failOnStatusCode: false });
          // ВАЖНО: каквото и да реши сървърът (400/415/422), НЕ бива да е 5xx (счупен sharp).
          assertNo5xx('качване на не-изображение', r.status());
        } },
        // Почистване на този пост (като админ).
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.adminEmail, password: c.adminPass }) }, expectStatus: 200 },
        { api: { method: 'POST', path: (c) => `/api/wnb/moderation/posts/${c.badImgPostId}/remove`, json: { note: 'почистване (невалиден файл тест)' } } },
      ],
    },
    {
      name: 'АТАКУВАЩ („лош потребител"): модерация без права → 401/403 (никога 500/изтичане)',
      steps: [
        // 1) Модерация БЕЗ вход (свеж контекст без бисквитки) → 401.
        { label: 'pending без вход → 401', run: async (page, c, h) => {
          const fr = await freshRequest(page);
          try {
            const r = await fr.request.get(h.base + '/api/wnb/moderation/pending');
            assertOneOf('pending без вход', r.status(), [401]);
          } finally { await fr.dispose(); }
        } },
        { label: 'approve без вход → 401', run: async (page, c, h) => {
          const fr = await freshRequest(page);
          try {
            const r = await fr.request.post(h.base + `/api/wnb/moderation/posts/${c.postId}/approve`, { data: {} });
            assertOneOf('approve без вход', r.status(), [401]);
          } finally { await fr.dispose(); }
        } },
        // 2) Модерация като ОБИКНОВЕН потребител → 403 (forbidden), не 401, не 500.
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.email, password: c.pass }) }, expectStatus: 200 },
        { label: 'approve като обикновен потребител → 403', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/moderation/posts/${c.postId}/approve`, { data: {}, failOnStatusCode: false });
          assertOneOf('approve като обикновен', r.status(), [403]);
        } },
        { label: 'reject като обикновен потребител → 403', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/moderation/posts/${c.postId}/reject`, { data: { note: 'хак' }, failOnStatusCode: false });
          assertOneOf('reject като обикновен', r.status(), [403]);
        } },
        { label: 'remove като обикновен потребител → 403', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/moderation/posts/${c.postId}/remove`, { data: { note: 'хак' }, failOnStatusCode: false });
          assertOneOf('remove като обикновен', r.status(), [403]);
        } },
        { label: 'ban на потребител като обикновен → 403', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/wnb/moderation/users/1/ban', { data: { reason: 'хак' }, failOnStatusCode: false });
          assertOneOf('ban като обикновен', r.status(), [403]);
        } },
      ],
    },
    {
      name: 'АТАКУВАЩ: чужд пост / телефон / фалшива сесия → 403/404/401',
      steps: [
        // Обикновеният първи потребител е логнат (от предишния сценарий). Атакува ВТОРИЯ пост,
        // който е на „Робот 2" (postId2) — НЕ е негов.
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.email, password: c.pass }) }, expectStatus: 200 },
        { label: 'качи снимка на ЧУЖД пост → 403', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/posts/${c.postId2}/images`,
            { multipart: { image: pngFile('hijack.png') }, failOnStatusCode: false });
          assertOneOf('снимка на чужд пост', r.status(), [403, 404]);
        } },
        { label: 'reveal-phone на ЧУЖД пост → 403', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/posts/${c.postId2}/reveal-phone`, { data: {}, failOnStatusCode: false });
          assertOneOf('reveal-phone на чужд пост', r.status(), [403, 404]);
        } },
        { label: 'reveal-phone на НЕсъществуващ пост → 404', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/wnb/posts/999000999/reveal-phone', { data: {}, failOnStatusCode: false });
          assertOneOf('reveal-phone несъществуващ', r.status(), [404]);
        } },
        // buy-phone злоупотреба: телефонът на чуждия пост НЕ е разкрит → НЕ бива безплатно разкриване.
        { label: 'buy-phone без разкрит телефон → отказ (НЕ безплатно разкриване)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/wnb/posts/${c.postId2}/buy-phone`, { data: {}, failOnStatusCode: false });
          assertNo5xx('buy-phone без разкрит', r.status());
          if (r.status() === 200) {
            const b = await bodyOf(r);
            if (b && b.phone) throw new Error('buy-phone върна ТЕЛЕФОН без разкриване/плащане (изтичане!)');
          }
          // Очаквано: 409 (no_phone) или 404; в краен случай 200 но БЕЗ телефон (проверено горе).
          assertOneOf('buy-phone без разкрит', r.status(), [409, 404, 200]);
        } },
        { label: 'buy-phone на НЕсъществуващ пост → 404', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/wnb/posts/999000999/buy-phone', { data: {}, failOnStatusCode: false });
          assertOneOf('buy-phone несъществуващ', r.status(), [404]);
        } },
        // 3) Фалшива/боклук сесия (подправена бисквитка) → 401, никога 500.
        { label: 'фалшива сесийна бисквитка → 401', run: async (page, c, h) => {
          const fr = await freshRequest(page, { Cookie: 'wnb.sid=s%3Aboklyuk-fake-session.deadbeefdeadbeefdeadbeefdeadbeef' });
          try {
            const r = await fr.request.get(h.base + '/api/wnb/me');
            assertOneOf('фалшива сесия /me', r.status(), [401]);
          } finally { await fr.dispose(); }
        } },
        { label: 'фалшива сесия към моите постове → 401', run: async (page, c, h) => {
          const fr = await freshRequest(page, { Cookie: 'connect.sid=s%3Agarbage.0000000000000000000000000000' });
          try {
            const r = await fr.request.get(h.base + '/api/wnb/posts/mine/list');
            assertOneOf('фалшива сесия mine/list', r.status(), [401]);
          } finally { await fr.dispose(); }
        } },
      ],
    },
    {
      name: 'АТАКУВАЩ: инжекции + огромен текст в тялото на поста → 400/обработено (никога 500)',
      steps: [
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.email, password: c.pass }) }, expectStatus: 200 },
        { label: "SQL-инжекция в заглавие/държава → 400 (никога 500)", run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/wnb/posts',
            { data: { country_code: "BG'; DROP TABLE posts; --", title: "'; DROP TABLE users; --", description: '<script>alert(1)</script> опит за инжекция' }, failOnStatusCode: false });
          // country_code не е във валидния списък → 400 bad_country; параметризираните заявки → без 500.
          assertOneOf('SQL-инжекция в пост', r.status(), [400]);
        } },
        { label: 'XSS/инжекция в иначе ВАЛИДЕН пост → 201, без 500 (екранирането е на изхода)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/wnb/posts',
            { data: { country_code: 'FR', title: "<script>alert('xss')</script>", description: "'; DROP TABLE confirmations; -- <img src=x onerror=alert(1)> над двайсет знака" }, failOnStatusCode: false });
          assertNo5xx('XSS във валиден пост', r.status());
          assertOneOf('XSS във валиден пост', r.status(), [201, 409]);
          if (r.status() === 201) { const b = await bodyOf(r); c.injPostId = b.post && b.post.id; }
        } },
        { label: 'ОГРОМЕН текст в описанието → обработено (никога 500)', run: async (page, c, h) => {
          const huge = 'А'.repeat(200000);
          const r = await page.request.post(h.base + '/api/wnb/posts',
            { data: { country_code: 'IT', title: 'Огромно описание', description: huge }, failOnStatusCode: false });
          // Сървърът реже до maxDescriptionChars → 201 (или 409 лимит/413 payload) — но НЕ 5xx.
          assertNo5xx('огромен текст', r.status());
          assertOneOf('огромен текст', r.status(), [201, 409, 413, 400]);
          if (r.status() === 201) { const b = await bodyOf(r); c.hugePostId = b.post && b.post.id; }
        } },
        // Почистване на евентуално създадените при тестовете постове (като админ).
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.adminEmail, password: c.adminPass }) }, expectStatus: 200 },
        { label: 'свали инжекционните постове (ако са създадени)', run: async (page, c, h) => {
          for (const id of [c.injPostId, c.hugePostId]) {
            if (!id) continue;
            const r = await page.request.post(h.base + `/api/wnb/moderation/posts/${id}/remove`, { data: { note: 'почистване (инжекция тест)' }, failOnStatusCode: false });
            assertNo5xx('почистване инжекционен пост', r.status());
          }
        } },
      ],
    },
    {
      name: 'АВТОРИЗАЦИЯ: обикновен потребител е ОТКАЗАН за админ-само действие → 403',
      steps: [
        // Админ-само листванията (moderation GET /posts, /users) и ban са requireRole('admin').
        // Обикновеният потребител НЕ бива да ги достига (същото действие, което админът прави).
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.email, password: c.pass }) }, expectStatus: 200 },
        { label: 'GET moderation/posts като обикновен → 403', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/wnb/moderation/posts', { failOnStatusCode: false });
          assertOneOf('moderation/posts като обикновен', r.status(), [403]);
        } },
        { label: 'GET moderation/users като обикновен → 403', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/wnb/moderation/users', { failOnStatusCode: false });
          assertOneOf('moderation/users като обикновен', r.status(), [403]);
        } },
        { label: 'GET moderation/db като обикновен → 403 (без изтичане на БД)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/wnb/moderation/db', { failOnStatusCode: false });
          assertOneOf('moderation/db като обикновен', r.status(), [403]);
        } },
        // Връщаме сесията към АДМИН, за да мине финалното почистване по-долу.
        { api: { method: 'POST', path: '/api/wnb/logout' } },
        { api: { method: 'POST', path: '/api/wnb/login', json: (c) => ({ email: c.adminEmail, password: c.adminPass }) }, expectStatus: 200 },
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
