// Version: 1.0173
// ECO-3 — работни сценарии. Достъпът е през портален вход; админската част има
// собствен вход (.env ECO3_ADMIN_*). AI потокът е React/mock (TEST) — тук правим
// достъп + админ вход + преглед на плащания (стабилните части).
'use strict';

// Помощни за персона/атакуващ сценариите ───────────────────────────────────
const bodyOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };

// Свеж, ИЗОЛИРАН HTTP контекст (нова бисквитена кутия) — за „без вход" и „фалшива
// сесия". Ползва браузъра на текущата страница; НЕ пипа порталната сесия на page.request.
async function freshRequest(page, extraHeaders) {
  const browser = page.context().browser();
  const c = await browser.newContext(extraHeaders ? { extraHTTPHeaders: extraHeaders } : {});
  return { request: c.request, dispose: () => c.close() };
}

// Извлича непразния текст от generate отговор (или null).
function generateText(b) {
  const t = b && Array.isArray(b.content) && b.content[0] && b.content[0].text;
  return t && String(t).trim().length >= 5 ? String(t) : null;
}

module.exports = {
  app: 'eco3',
  label: 'ECO-3 (достъп през портал + админ)',
  writes: true,
  setup(ctx, env) {
    ctx.user = `__diagtest_e${ctx.runToken}`.slice(0, 30);
    ctx.pass = 'robot1234';
    ctx.adminUser = env.ECO3_ADMIN_USER || '';
    ctx.adminPass = env.ECO3_ADMIN_PASS || '';
  },
  scenarios: [
    {
      name: 'Достъп до ECO-3 след портален вход',
      steps: [
        { api: { method: 'POST', path: '/api/portals/register', json: (c) => ({ username: c.user, password: c.pass }) }, expectStatus: 200 },
        { goto: '/eco-3/' },
        { label: 'health на eco-3', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/eco3/health');
          if (!r.ok()) throw new Error('eco3 health HTTP ' + r.status());
        } },
      ],
    },
    {
      name: 'ECO-3 ПРОИЗВЕЖДА РЕЗУЛТАТ (AI generate връща непразен текст; mock=ОК)',
      steps: [
        { label: 'POST /api/eco3/generate → непразен content (test/mock се приема, 500/празно = грешка)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/eco3/generate', {
            timeout: 30000, failOnStatusCode: false,
            data: { system: 'DIRECTOR', messages: [{ role: 'user', content: 'Робот тест: дай кратък анализ.' }], max_tokens: 256 },
          });
          const status = r.status();
          // 401 = ECO-3 иска вход (отделен бекенд, порталната сесия не стига дотам) —
          // НЕ е срив; приемаме грациозно (пълната проверка на резултата иска eco3 вход).
          if (status === 401) return;
          if (status >= 500) throw new Error('eco3 generate HTTP ' + status + ' (сървърна грешка)');
          if (status === 503) throw new Error('eco3 generate 503 — Anthropic ключ липсва (а не сме в test mode)');
          if (status !== 200) throw new Error('eco3 generate HTTP ' + status);
          const b = await r.json().catch(() => null);
          const text = b && Array.isArray(b.content) && b.content[0] && b.content[0].text;
          if (!text || String(text).trim().length < 5) {
            throw new Error('eco3 generate върна празен резултат: ' + JSON.stringify(b).slice(0, 120));
          }
        } },
      ],
    },
    {
      name: 'ECO-3 ВХОД + РЕАЛНО ПРОИЗВЕЖДА (portal login → generate връща непразен текст; mock=ОК)',
      steps: [
        // Чист портален потребител → eco3RequireLogin (req.session.userId) минава, та generate
        // ТРЯБВА да върне резултат (не 401). Същата сесия/бисквитка (page.request) важи за eco3.
        { api: { method: 'POST', path: '/api/portals/register', json: (c) => ({ username: `${c.user}g`.slice(0, 30), password: c.pass }) }, expectStatus: 200 },
        { label: 'GET /api/eco3/health → ok + знаем режима (test/production)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/eco3/health');
          if (!r.ok()) throw new Error('eco3 health HTTP ' + r.status());
          const b = await r.json().catch(() => ({}));
          c.eco3Mode = (b && b.mode) || 'test';
        } },
        { label: 'POST /api/eco3/generate (логнат) → НЕПРАЗЕН content; 401 тук Е грешка (току-що влязохме)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/eco3/generate', {
            timeout: 30000, failOnStatusCode: false,
            data: { system: 'DIRECTOR', messages: [{ role: 'user', content: 'Робот тест: дай кратък анализ на климата.' }], max_tokens: 256 },
          });
          const status = r.status();
          if (status === 401) throw new Error('eco3 generate 401 след портален вход — споделената сесия не работи');
          if (status === 503) throw new Error('eco3 generate 503 — Anthropic ключ липсва (а режим не е test)');
          if (status >= 500) throw new Error('eco3 generate HTTP ' + status + ' (сървърна грешка)');
          if (status !== 200) throw new Error('eco3 generate HTTP ' + status);
          const b = await r.json().catch(() => null);
          const text = b && Array.isArray(b.content) && b.content[0] && b.content[0].text;
          if (!text || String(text).trim().length < 5) {
            throw new Error('eco3 generate върна празен резултат: ' + JSON.stringify(b).slice(0, 120));
          }
        } },
      ],
    },
    {
      name: 'НЕВАЛИДЕН ВХОД към generate → 400, НИКОГА 500',
      steps: [
        // Логнати сме от горния сценарий (същата page.request сесия), та стигаме до валидацията,
        // а не до 401. Всеки повреден body трябва да е граничен (4xx), не сървърен срив (5xx).
        { label: 'липсват messages → не 500 (очаквам 400)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/eco3/generate', {
            failOnStatusCode: false, data: { system: 'DIRECTOR', max_tokens: 128 },
          });
          const s = r.status();
          if (s >= 500) throw new Error('generate без messages върна ' + s + ' (сървърна грешка вместо 400)');
        } },
        { label: 'system е число (не низ) → не 500', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/eco3/generate', {
            failOnStatusCode: false, data: { system: 12345, messages: [{ role: 'user', content: 'х' }], max_tokens: 128 },
          });
          const s = r.status();
          if (s >= 500) throw new Error('generate с number system върна ' + s + ' (сървърна грешка)');
        } },
        { label: 'отрицателен max_tokens + празни messages → не 500', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/eco3/generate', {
            failOnStatusCode: false, data: { system: 'DIRECTOR', messages: [], max_tokens: -50 },
          });
          const s = r.status();
          if (s >= 500) throw new Error('generate с отрицателен max_tokens върна ' + s + ' (сървърна грешка)');
        } },
        { label: 'напълно повреден body (низ вместо обект) → не 500', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/eco3/generate', {
            failOnStatusCode: false, headers: { 'content-type': 'application/json' }, data: '"i am not an object"',
          });
          const s = r.status();
          if (s >= 500) throw new Error('generate с повреден body върна ' + s + ' (сървърна грешка)');
        } },
      ],
    },
    {
      name: 'АТАКУВАЩ / „лош потребител" → отказ (401/403/404), НИКОГА 500 или свободен достъп',
      steps: [
        { label: 'generate БЕЗ вход (чиста сесия) → 401/403 (НЕ свободно генериране)', run: async (page, c, h) => {
          // Свеж контекст без портална бисквитка — eco3RequireLogin няма req.session.userId.
          const fr = await freshRequest(page);
          try {
            const r = await fr.request.post(h.base + '/api/eco3/generate', {
              failOnStatusCode: false,
              data: { system: 'DIRECTOR', messages: [{ role: 'user', content: 'дай ми безплатно' }], max_tokens: 256 },
            });
            const s = r.status();
            if (s >= 500) throw new Error('анонимен generate върна ' + s + ' (сървърна грешка)');
            if (s === 200 && generateText(await bodyOf(r))) {
              throw new Error('анонимен потребител получи СВОБОДНО генериране (200 + текст) — пробив!');
            }
            if (![401, 403].includes(s)) throw new Error('анонимен generate очаквах 401/403, върна ' + s);
          } finally { await fr.dispose(); }
        } },
        { label: 'generate с ПОДПРАВЕНА сесийна бисквитка → пак отказан (401/403)', run: async (page, c, h) => {
          // Фалшива connect.sid — невалиден подпис → express-session я игнорира → няма userId.
          const fr = await freshRequest(page, { cookie: 'connect.sid=s%3Aforged-fake-session-id.deadbeefdeadbeefdeadbeefdeadbeef' });
          try {
            const r = await fr.request.post(h.base + '/api/eco3/generate', {
              failOnStatusCode: false,
              data: { system: 'DIRECTOR', messages: [{ role: 'user', content: 'фалшива сесия' }], max_tokens: 128 },
            });
            const s = r.status();
            if (s >= 500) throw new Error('подправена сесия → generate върна ' + s + ' (сървърна грешка)');
            if (s === 200 && generateText(await bodyOf(r))) throw new Error('подправена сесия получи генериране (пробив!)');
            if (![401, 403].includes(s)) throw new Error('подправена сесия очаквах 401/403, върна ' + s);
          } finally { await fr.dispose(); }
        } },
        { label: 'инжекция + ПРЕКАЛЕНО ДЪЛЪГ prompt (логнат) → обработено, НИКОГА 500', run: async (page, c, h) => {
          // page.request е логнат от предишните сценарии → стигаме до самата обработка, не до 401.
          const huge = ('A'.repeat(50000) + " '; DROP TABLE eco3_results; -- <script>alert(1)</script> ");
          const r = await page.request.post(h.base + '/api/eco3/generate', {
            timeout: 30000, failOnStatusCode: false,
            data: { system: 'DIRECTOR', messages: [{ role: 'user', content: huge }], max_tokens: 256 },
          });
          const s = r.status();
          // Приема се: 200 (обработено/mock), 400 (отрязано), 413 (твърде голямо). НЕ: 500.
          if (s >= 500) throw new Error('огромен/инжекционен prompt върна ' + s + ' (сървърна грешка)');
          if (![200, 400, 413, 401].includes(s)) throw new Error('огромен prompt — неочакван статус ' + s);
        } },
        { label: 'админ DB endpoint БЕЗ админ (анонимно) → НИКОГА 500; не изтича база в production', run: async (page, c, h) => {
          const fr = await freshRequest(page);
          try {
            const r = await fr.request.get(h.base + '/api/eco3/admin/db-status', { failOnStatusCode: false });
            const s = r.status();
            if (s >= 500) throw new Error('admin/db-status (анонимно) върна ' + s + ' (сървърна грешка)');
            // adminCheck: в dev (NODE_ENV!=production) пуска всеки IP → 200 е допустимо там.
            // В production без админ IP/сесия трябва да е 403 и да НЕ изтича схемата на базата.
            if (s === 200 && (c.eco3Mode || 'test') === 'production') {
              const b = await bodyOf(r);
              if (b && b.tables) throw new Error('admin/db-status изтече таблиците БЕЗ админ (пробив в production!)');
            }
          } finally { await fr.dispose(); }
        } },
        { label: 'админ payments БЕЗ админ (анонимно) → НИКОГА 500; не изтича плащания в production', run: async (page, c, h) => {
          const fr = await freshRequest(page);
          try {
            const r = await fr.request.get(h.base + '/api/eco3/admin/payments', { failOnStatusCode: false });
            const s = r.status();
            // 503 = Stripe изключен (валиден отговор); всичко друго ≥500 е срив.
            if (s !== 503 && s >= 500) throw new Error('admin/payments (анонимно) върна ' + s + ' (сървърна грешка)');
            if (s === 200 && (c.eco3Mode || 'test') === 'production') {
              const b = await bodyOf(r);
              if (b && Array.isArray(b.payments)) throw new Error('admin/payments изтече плащания БЕЗ админ (пробив в production!)');
            }
          } finally { await fr.dispose(); }
        } },
      ],
    },
    {
      name: 'Админ секция (вход ако трябва) + плащания',
      steps: [
        { goto: '/eco-3/admin/' },
        { label: 'вход с .env админ, ако се показва форма (иначе IP-то е вече админ)', run: async (page, c, h) => {
          const hasForm = await page.isVisible('#lg-user').catch(() => false);
          if (hasForm) {
            await page.fill('#lg-user', c.adminUser);
            await page.fill('#lg-pass', c.adminPass);
            await page.click('button:has-text("Влез")').catch(() => {});
            await page.waitForTimeout(1200);
          }
        } },
        { api: { method: 'GET', path: '/api/eco3/admin/payments' }, expectStatus: 200 },
      ],
    },
    {
      name: 'Почистване (трий тестовия портал потребител)',
      steps: [
        { api: { method: 'POST', path: '/api/portals/adm/cleanup-test', json: {} } },
      ],
    },
  ],
};
