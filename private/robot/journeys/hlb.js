// Version: 1.0173
// House-Look-Book — работни сценарии „като човек": регистрация → създай къща →
// подай за модерация; после АДМИН одобрява и отказва. Накрая чисти след себе си.
'use strict';

const HOUSE = {
  footprint: 'square', roof: 'gabled', floors: 1, windowsPerFloor: 2,
  wallColor: '#e8d9c0', roofColor: '#8a4b3b', accentColor: '#3b6ea5',
  extras: { pool: false, boat: false, pier: false }, rooms: [[]],
};

// Минимален ВАЛИДЕН PNG (1×1) — sharp трябва да го обработи (иначе 500). Качваме го
// като реална снимка за покритие на „качване на изображение".
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);
const pngFile = (name) => ({ name, mimeType: 'image/png', buffer: PNG_1x1 });

// Помощни за персона-сценариите ────────────────────────────────────────
// „Никога 500/изтичане": статусът трябва да е < 500 И в очаквания набор.
function assertStatusIn(status, allowed, what, body) {
  if (status >= 500) {
    throw new Error(`${what}: HTTP ${status} (сървърна грешка — НЕ бива 500)`);
  }
  if (!allowed.includes(status)) {
    throw new Error(`${what}: HTTP ${status} (чаках ${allowed.join('/')})${body && body.error ? ' / ' + body.error : ''}`);
  }
}
const bodyOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };

// Свеж, ИЗОЛИРАН HTTP контекст — за „без вход" и „фалшива сесия". Ползва НЕЗАВИСИМ
// Playwright APIRequestContext (НЕ пипа браузъра/споделения контекст на run.js), та
// затварянето му не сваля сесията на основния page.request.
async function freshRequest(page, extraHeaders) {
  const rc = await require('playwright').request.newContext({
    ignoreHTTPSErrors: true,
    ...(extraHeaders ? { extraHTTPHeaders: extraHeaders } : {}),
  });
  return { request: rc, dispose: async () => { try { await rc.dispose(); } catch (_) {} } };
}

module.exports = {
  app: 'hlb',
  label: 'House-Look-Book (потребител + админ модерация)',
  writes: true,
  setup(ctx, env) {
    ctx.email = `robot+${ctx.runToken}@test.local`;
    ctx.pass = 'Robot12345!';
    ctx.adminEmail = env.HLB_ADMIN_USER || '';
    ctx.adminPass = env.HLB_ADMIN_PASS || '';
    // Първият конфигуриран модератор (ако има) — за разделянето мод vs admin-only.
    ctx.modEmail = env.HLB_MOD1_USER || '';
    ctx.modPass = env.HLB_MOD1_PASS || '';
  },
  scenarios: [
    {
      name: 'Потребител: регистрация (API) + вход (UI)',
      steps: [
        { api: { method: 'POST', path: '/api/hlb/register', json: (c) => ({ email: c.email, password: c.pass, display_name: 'Робот Тест' }) },
          expectStatus: 201, saveAs: 'userId', extract: (b) => b.user && b.user.id },
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
        { label: 'КАЧВАНЕ НА ИЗОБРАЖЕНИЕ: качи view снимка (докато е editing)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/images?kind=view`, {
            multipart: { image: pngFile('robot-view.png') }, failOnStatusCode: false,
          });
          // 201 = качено. 409 = лимит/не-editing (приемливо при ре-пуск). 500 = счупено.
          if (r.status() >= 500) throw new Error('качване на HLB снимка HTTP ' + r.status());
          if (r.status() !== 201 && r.status() !== 409) {
            const b = await r.json().catch(() => ({}));
            throw new Error('качване на HLB снимка HTTP ' + r.status() + ' ' + (b.error || ''));
          }
        } },
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
    // ── ПЕРСОНА 1: валиден + невалиден вход (никога 500) ──────────────────
    {
      name: 'Персона 1 — валиден потребител: валиден + невалиден вход (никога 500)',
      steps: [
        // Връщаме се като нормалния потребител (не админа).
        { api: { method: 'POST', path: '/api/hlb/logout' } },
        { api: { method: 'POST', path: '/api/hlb/login', json: (c) => ({ email: c.email, password: c.pass }) }, expectStatus: 200 },

        // ВАЛИДНО създаване → 201 (и го пазим за чистене).
        { api: { method: 'POST', path: '/api/hlb/proposals', json: () => ({ title: 'Робот валидна къща', description: 'Валиден вход.', composer_params: HOUSE }) },
          expectStatus: 201, saveAs: 'propValid', extract: (b) => b.proposal && b.proposal.id },

        { label: 'НЕВАЛИДНИ входове при създаване → 400, НИКОГА 500', run: async (page, c, h) => {
          const cases = [
            { name: 'липсва заглавие', json: { description: 'без заглавие', composer_params: HOUSE } },
            { name: 'празно заглавие', json: { title: '   ', composer_params: HOUSE } },
            { name: 'твърде дълго заглавие', json: { title: 'Х'.repeat(20000), composer_params: HOUSE } },
            { name: 'счупени composer_params (низ)', json: { title: 'Лоши параметри', composer_params: 'не-обект-а-низ' } },
            { name: 'счупени composer_params (число)', json: { title: 'Лоши параметри 2', composer_params: 1234567 } },
          ];
          for (const t of cases) {
            const r = await page.request.post(h.base + '/api/hlb/proposals', { data: t.json, failOnStatusCode: false });
            const b = await bodyOf(r);
            // Дълго/лошо composer_params може да мине (clamp/JSONB) — но НИКОГА 500.
            if (r.status() >= 500) throw new Error(`създаване „${t.name}" → HTTP ${r.status()} (НЕ бива 500)`);
            // Липсващо/празно заглавие ТРЯБВА да е 400.
            if ((t.name === 'липсва заглавие' || t.name === 'празно заглавие') && r.status() !== 400) {
              throw new Error(`създаване „${t.name}" → HTTP ${r.status()} (чаках 400)${b.error ? ' / ' + b.error : ''}`);
            }
            // Ако случайно е минало → запомни го за чистене.
            if (r.status() === 201 && b.proposal && b.proposal.id) c.badCreated = (c.badCreated || []).concat(b.proposal.id);
          }
        } },

        { label: 'НЕВАЛИДНО качване на изображение → 400, НИКОГА 500', run: async (page, c, h) => {
          // Празен файл — sharp не може да го обработи → graceful 400 (не 500).
          const r1 = await page.request.post(h.base + `/api/hlb/proposals/${c.propValid}/images?kind=view`, {
            multipart: { image: { name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) } }, failOnStatusCode: false,
          });
          assertStatusIn(r1.status(), [400, 409], 'качване на празен файл', await bodyOf(r1));
          // „Не-изображение" (текст, представено като .png) → graceful 400 (не 500).
          const r2 = await page.request.post(h.base + `/api/hlb/proposals/${c.propValid}/images?kind=view`, {
            multipart: { image: { name: 'notimg.png', mimeType: 'image/png', buffer: Buffer.from('това НЕ е изображение, а текст') } }, failOnStatusCode: false,
          });
          assertStatusIn(r2.status(), [400, 409], 'качване на не-изображение', await bodyOf(r2));
          // Заявка без файл изобщо → 400 no_file.
          const r3 = await page.request.post(h.base + `/api/hlb/proposals/${c.propValid}/images?kind=view`, {
            multipart: {}, failOnStatusCode: false,
          });
          assertStatusIn(r3.status(), [400, 409], 'качване без файл', await bodyOf(r3));
        } },
      ],
    },

    // ── ПЕРСОНА 2: атакуващ / „лош потребител" (401/403/400/404, НИКОГА 500) ──
    {
      name: 'Персона 2 — атакуващ: модерация без права/без вход → 401/403',
      steps: [
        { label: 'нормален потребител НЕ може да модерира → 403', run: async (page, c, h) => {
          // Логнат сме като нормалния потребител от Персона 1.
          for (const act of ['approve', 'reject', 'remove']) {
            const r = await page.request.post(h.base + `/api/hlb/moderation/proposals/${c.propId}/${act}`, { data: { note: 'опит за атака' }, failOnStatusCode: false });
            assertStatusIn(r.status(), [403], `нормален потребител ${act}`, await bodyOf(r));
          }
          // Админ-само end-points → 403 за нормален потребител.
          const rUsers = await page.request.get(h.base + '/api/hlb/moderation/users', { failOnStatusCode: false });
          assertStatusIn(rUsers.status(), [403], 'нормален потребител GET /moderation/users', await bodyOf(rUsers));
          const rBan = await page.request.post(h.base + `/api/hlb/moderation/users/${c.userId}/ban`, { data: { reason: 'x' }, failOnStatusCode: false });
          assertStatusIn(rBan.status(), [403], 'нормален потребител ban', await bodyOf(rBan));
        } },

        { label: 'БЕЗ вход модерация → 401', run: async (page, c, h) => {
          const f = await freshRequest(page);
          try {
            for (const act of ['approve', 'reject', 'remove']) {
              const r = await f.request.post(h.base + `/api/hlb/moderation/proposals/${c.propId}/${act}`, { data: {}, failOnStatusCode: false });
              assertStatusIn(r.status(), [401], `без вход ${act}`, await bodyOf(r));
            }
            const rPending = await f.request.get(h.base + '/api/hlb/moderation/pending', { failOnStatusCode: false });
            assertStatusIn(rPending.status(), [401], 'без вход GET /moderation/pending', await bodyOf(rPending));
          } finally { await f.dispose(); }
        } },

        { label: 'ФАЛШИВА/боклук сесия → 401', run: async (page, c, h) => {
          // Подправена сесийна бисквитка (невалиден подпис) → трябва да е 401, не 500.
          const f = await freshRequest(page, { Cookie: 'connect.sid=s%3Abokluk-falshiva-sesiya.podpisXYZ123' });
          try {
            const r = await f.request.get(h.base + '/api/hlb/me', { failOnStatusCode: false });
            assertStatusIn(r.status(), [401], 'фалшива сесия GET /me', await bodyOf(r));
            const r2 = await f.request.post(h.base + `/api/hlb/moderation/proposals/${c.propId}/approve`, { data: {}, failOnStatusCode: false });
            assertStatusIn(r2.status(), [401], 'фалшива сесия approve', await bodyOf(r2));
          } finally { await f.dispose(); }
        } },
      ],
    },
    {
      name: 'Персона 2 — атакуващ: чужда къща (редакция/триене) → 403/404',
      steps: [
        // Създаваме „жертва" — друг потребител с негова къща.
        { api: { method: 'POST', path: '/api/hlb/logout' } },
        { api: { method: 'POST', path: '/api/hlb/register', json: (c) => ({ email: `victim+${c.runToken}@test.local`, password: c.pass, display_name: 'Жертва' }) }, expectStatus: 201 },
        { api: { method: 'POST', path: '/api/hlb/proposals', json: () => ({ title: 'Къща на жертвата', composer_params: HOUSE }) },
          expectStatus: 201, saveAs: 'victimProp', extract: (b) => b.proposal && b.proposal.id },
        { api: { method: 'POST', path: '/api/hlb/logout' } },
        // Влизаме като атакуващия (нормалния потребител) и пипаме ЧУЖДАТА къща.
        { api: { method: 'POST', path: '/api/hlb/login', json: (c) => ({ email: c.email, password: c.pass }) }, expectStatus: 200 },
        { label: 'редакция/триене/качване/submit на ЧУЖДА къща → 403; несъществуваща → 404', run: async (page, c, h) => {
          const put = await page.request.put(h.base + `/api/hlb/proposals/${c.victimProp}`, { data: { title: 'превзета' }, failOnStatusCode: false });
          assertStatusIn(put.status(), [403], 'PUT чужда къща', await bodyOf(put));
          const del = await page.request.delete(h.base + `/api/hlb/proposals/${c.victimProp}`, { failOnStatusCode: false });
          assertStatusIn(del.status(), [403], 'DELETE чужда къща', await bodyOf(del));
          const sub = await page.request.post(h.base + `/api/hlb/proposals/${c.victimProp}/submit`, { failOnStatusCode: false });
          assertStatusIn(sub.status(), [403], 'submit чужда къща', await bodyOf(sub));
          const img = await page.request.post(h.base + `/api/hlb/proposals/${c.victimProp}/images?kind=view`, { multipart: { image: pngFile('x.png') }, failOnStatusCode: false });
          assertStatusIn(img.status(), [403], 'качване в чужда къща', await bodyOf(img));
          // Несъществуващ id → 404 (не 500).
          const missing = await page.request.delete(h.base + '/api/hlb/proposals/999999999', { failOnStatusCode: false });
          assertStatusIn(missing.status(), [403, 404], 'DELETE несъществуваща', await bodyOf(missing));
        } },
        { label: 'инжекция/огромен текст в поле → обработено (400/handled), НИКОГА 500', run: async (page, c, h) => {
          const payloads = [
            { title: "Robert'); DROP TABLE proposals;--", description: "1' OR '1'='1", composer_params: HOUSE },
            { title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>', composer_params: HOUSE },
            { title: 'Огромно: ' + 'A'.repeat(100000), description: 'B'.repeat(200000), composer_params: HOUSE },
            { title: 'Отчет', reason: 'x', description: 'Я'.repeat(50000), composer_params: { rooms: 'счупено', floors: 'НЕ-число' } },
          ];
          for (const p of payloads) {
            const r = await page.request.post(h.base + '/api/hlb/proposals', { data: p, failOnStatusCode: false });
            const b = await bodyOf(r);
            if (r.status() >= 500) throw new Error(`инжекция/огромен текст → HTTP ${r.status()} (НЕ бива 500)`);
            // Запомни всичко минало за чистене.
            if (r.status() === 201 && b.proposal && b.proposal.id) c.badCreated = (c.badCreated || []).concat(b.proposal.id);
          }
          // Доклад с празна причина → 400 (не 500).
          const rep = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/report`, { data: { reason: '' }, failOnStatusCode: false });
          assertStatusIn(rep.status(), [400, 404, 409], 'доклад с празна причина', await bodyOf(rep));
        } },
      ],
    },

    // ── ПЕРСОНА 3: админ + модератор (права vs отказ) ─────────────────────
    {
      name: 'Персона 3 — админ: модерацията работи; за нормален потребител е 403',
      steps: [
        // Нормалният потребител създава къща и я подава — после админ ще я свали.
        { api: { method: 'POST', path: '/api/hlb/logout' } },
        { api: { method: 'POST', path: '/api/hlb/login', json: (c) => ({ email: c.email, password: c.pass }) }, expectStatus: 200 },
        { api: { method: 'POST', path: '/api/hlb/proposals', json: () => ({ title: 'Къща за админ тест', composer_params: HOUSE }) },
          expectStatus: 201, saveAs: 'propAdmin', extract: (b) => b.proposal && b.proposal.id },
        { api: { method: 'POST', path: (c) => `/api/hlb/proposals/${c.propAdmin}/submit` }, expectStatus: 200 },

        { label: 'нормален потребител НЕ може да approve → 403 (контрол)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + `/api/hlb/moderation/proposals/${c.propAdmin}/approve`, { data: {}, failOnStatusCode: false });
          assertStatusIn(r.status(), [403], 'нормален потребител approve (контрол)', await bodyOf(r));
        } },

        // Влизаме като АДМИН (от .env) и същото действие ТРЯБВА да мине.
        { api: { method: 'POST', path: '/api/hlb/logout' } },
        { api: { method: 'POST', path: '/api/hlb/login', json: (c) => ({ email: c.adminEmail, password: c.adminPass }) }, expectStatus: 200 },
        { label: 'админ ролята е admin', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/hlb/me');
          const b = await bodyOf(r);
          if (!b.user || b.user.role !== 'admin') throw new Error('очаквах role=admin, видях: ' + (b.user && b.user.role));
        } },
        { api: { method: 'POST', path: (c) => `/api/hlb/moderation/proposals/${c.propAdmin}/approve`, json: { note: 'админ одобри' } }, expectStatus: 200 },
        { label: 'същото действие мина за админ (статус approved)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + `/api/hlb/proposals/${c.propAdmin}`);
          const b = await bodyOf(r);
          if (!b.proposal || b.proposal.status !== 'approved') throw new Error('статус: ' + (b.proposal && b.proposal.status));
        } },
        // Админ-само end-point (списък потребители) работи за админа.
        { api: { method: 'GET', path: '/api/hlb/moderation/users' }, expectStatus: 200 },
      ],
    },
    {
      name: 'Персона 3 — модератор: модерира, но НЕ admin-only действия',
      steps: [
        { label: 'модератор може да модерира, но не admin-only (или пропусни ако няма мод в .env)', run: async (page, c, h) => {
          if (!c.modEmail || !c.modPass) { return; } // няма конфигуриран модератор → пропусни
          // Влез като модератор.
          await page.request.post(h.base + '/api/hlb/logout');
          const li = await page.request.post(h.base + '/api/hlb/login', { data: { email: c.modEmail, password: c.modPass }, failOnStatusCode: false });
          assertStatusIn(li.status(), [200], 'вход на модератор', await bodyOf(li));
          const me = await bodyOf(await page.request.get(h.base + '/api/hlb/me'));
          if (!me.user || me.user.role !== 'moderator') throw new Error('очаквах role=moderator, видях: ' + (me.user && me.user.role));
          // МОДЕРАЦИЯ (pending) — позволено.
          const pend = await page.request.get(h.base + '/api/hlb/moderation/pending', { failOnStatusCode: false });
          assertStatusIn(pend.status(), [200], 'модератор GET /moderation/pending', await bodyOf(pend));
          // ADMIN-ONLY (списък потребители / бан) — забранено за модератор → 403.
          const users = await page.request.get(h.base + '/api/hlb/moderation/users', { failOnStatusCode: false });
          assertStatusIn(users.status(), [403], 'модератор GET /moderation/users (admin-only)', await bodyOf(users));
          const ban = await page.request.post(h.base + `/api/hlb/moderation/users/${c.userId}/ban`, { data: { reason: 'x' }, failOnStatusCode: false });
          assertStatusIn(ban.status(), [403], 'модератор ban (admin-only)', await bodyOf(ban));
        } },
      ],
    },

    {
      name: 'Почистване (свали тестовите къщи)',
      steps: [
        // Уверяваме се, че сме АДМИН (за да минат remove-овете).
        { api: { method: 'POST', path: '/api/hlb/logout' } },
        { api: { method: 'POST', path: '/api/hlb/login', json: (c) => ({ email: c.adminEmail, password: c.adminPass }) }, expectStatus: 200 },
        { api: { method: 'POST', path: (c) => `/api/hlb/moderation/proposals/${c.propId}/remove`, json: { note: 'почистване' } } },
        { api: { method: 'POST', path: (c) => `/api/hlb/moderation/proposals/${c.propId2}/remove`, json: { note: 'почистване' } } },
        { label: 'свали и тестовите къщи от персоните', run: async (page, c, h) => {
          const ids = [c.propValid, c.victimProp, c.propAdmin].concat(c.badCreated || []).filter(Boolean);
          for (const id of ids) {
            // Идемпотентно: 200/404/409 са ок; 500 не бива.
            const r = await page.request.post(h.base + `/api/hlb/moderation/proposals/${id}/remove`, { data: { note: 'почистване' }, failOnStatusCode: false });
            if (r.status() >= 500) throw new Error(`почистване на ${id} → HTTP ${r.status()}`);
          }
        } },
      ],
    },
  ],
};
