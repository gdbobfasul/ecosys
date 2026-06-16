// Version: 1.0001
// ECO-3 ДОПЪЛНИТЕЛНО — НЕпокритите досега ендпойнти на AI студиото (Директор→Архитект→
// Изпълнител; Anthropic proxy; Stripe; SQLite). Всичко през /api/eco3.
//
// Какво покрива (happy където е евтино/локално; ВЪНШНОТО = само-предпазител):
//   1) Конфиг/статус четения (200 + форма, без 500): /anthropic-status, /stripe-key,
//      /payment-links, /search-status, /health.
//   2) Админ вход (ECO-3 собствен .env админ): /admin/login (лош → 401; .env → успех ако има;
//      иначе грациозен пропуск), /admin/me, /admin/logout.
//   3) /create-payment — САМО ПРЕДПАЗИТЕЛ: при изключен Stripe → 503; повреден body НИКОГА 500
//      (никога не довеждаме реален Stripe charge докрай).
//   4) /search — login-gated: без query → 400 query_required; без вход → 401; реален резултат
//      само ако работи без външна квота (иначе предпазител).
//   5) /generate — клоновете ARCHITECT и EXECUTOR (DIRECTOR вече е в eco3.js): в test mode →
//      непразен mock; в production без ключ → 503 (предпазител).
//   6) Персистентност (ЛОКАЛЕН SQLite — пълни кръгове): /results POST→GET→GET/:id (+bad id 404,
//      +resale), /history POST→GET (+?category), /uniqueness check→add→count (insert вдига броя).
//   7) Админ табла (при наличен админ): /admin/stats, /admin/db-status (УСПЕШЕН път),
//      /admin/logs (четене); DELETE /admin/logs — само anon-предпазител (НЕ трием реално).
//
// ВЪНШНО (реален Stripe/Anthropic/Google) = само-предпазител: никога не завършваме реален
// charge, не разчитаме на жива квота. Падаме на грациозен пропуск, не на провал.
// Очакване навсякъде: само статусите, които кодът връща; >=500 = провал; без фалшиви позитиви.
'use strict';

const E = '/api/eco3';
const jsonOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };

// Свеж, ИЗОЛИРАН HTTP контекст — за „без вход". Независим APIRequestContext (не пипа
// споделената сесия на робота); затварянето му не сваля цялата сесия.
async function freshRequest(extraHeaders) {
  const rc = await require('playwright').request.newContext({
    ignoreHTTPSErrors: true,
    ...(extraHeaders ? { extraHTTPHeaders: extraHeaders } : {}),
  });
  return { request: rc, dispose: async () => { try { await rc.dispose(); } catch (_) {} } };
}

// Непразен generate текст (или null) — за проверка на mock агентните клонове.
function generateText(b) {
  const t = b && Array.isArray(b.content) && b.content[0] && b.content[0].text;
  return t && String(t).trim().length >= 5 ? String(t) : null;
}

module.exports = {
  app: 'eco3',
  label: 'ECO-3 ДОПЪЛНИТЕЛНО — конфиг/админ/плащане-guard/агенти/persistence',
  writes: true,
  setup(ctx, env) {
    ctx.user = `__diagtest_x${ctx.runToken}`.slice(0, 30);
    ctx.pass = 'robot1234';
    ctx.adminUser = (env && env.ECO3_ADMIN_USER) || '';
    ctx.adminPass = (env && env.ECO3_ADMIN_PASS) || '';
    ctx.uniqTitle = 'Робот уникалност ' + ctx.runToken;
    ctx.uniqLink = 'https://example.com/robot/' + ctx.runToken;
  },
  scenarios: [
    {
      name: 'КОНФИГ/СТАТУС четения → 200 + форма, НИКОГА 500',
      steps: [
        { label: 'GET /health → ok + знаем режима (test/production)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + E + '/health');
          if (r.status() >= 500) throw new Error('health върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('health HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!b.ok || b.service !== 'eco-3') throw new Error('health: липсва ok/service=eco-3: ' + JSON.stringify(b).slice(0, 120));
          if (!b.database || typeof b.database.connected !== 'boolean') throw new Error('health: липсва database.connected');
          c.eco3Mode = b.mode || 'test';
          c.anthropicConfigured = !!(b.anthropic && b.anthropic.configured);
          c.stripeConfigured = !!(b.stripe && b.stripe.configured);
        } },
        { label: 'GET /anthropic-status → configured(bool) + model(низ)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + E + '/anthropic-status');
          if (r.status() >= 500) throw new Error('anthropic-status върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('anthropic-status HTTP ' + r.status());
          const b = await jsonOf(r);
          if (typeof b.configured !== 'boolean' || !b.model) throw new Error('anthropic-status: липсва configured/model: ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'GET /stripe-key → publishableKey ключ + testMode', run: async (page, c, h) => {
          const r = await page.request.get(h.base + E + '/stripe-key');
          if (r.status() >= 500) throw new Error('stripe-key върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('stripe-key HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!('publishableKey' in b) || !('testMode' in b)) throw new Error('stripe-key: липсва publishableKey/testMode: ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'GET /payment-links → нивата economy/standard/premium/enterprise', run: async (page, c, h) => {
          const r = await page.request.get(h.base + E + '/payment-links');
          if (r.status() >= 500) throw new Error('payment-links върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('payment-links HTTP ' + r.status());
          const b = await jsonOf(r);
          for (const k of ['economy', 'standard', 'premium', 'enterprise']) {
            if (!(k in b)) throw new Error('payment-links: липсва ниво ' + k + ': ' + JSON.stringify(b).slice(0, 120));
          }
        } },
        { label: 'GET /search-status → google + claudeFallback форма', run: async (page, c, h) => {
          const r = await page.request.get(h.base + E + '/search-status');
          if (r.status() >= 500) throw new Error('search-status върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('search-status HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!b.google || typeof b.google.configured !== 'boolean' || !b.claudeFallback) {
            throw new Error('search-status: липсва google.configured/claudeFallback: ' + JSON.stringify(b).slice(0, 120));
          }
        } },
      ],
    },
    {
      name: 'АДМИН ВХОД (ECO-3 собствен .env): лош → 401; .env → успех (иначе грациозно)',
      steps: [
        { label: 'POST /admin/login с грешни данни → 401 bad_credentials (НИКОГА 500)', run: async (page, c, h) => {
          const fr = await freshRequest();
          try {
            const r = await fr.request.post(h.base + E + '/admin/login', { failOnStatusCode: false, data: { username: '__robot_no_such', password: 'wrong-' + c.runToken } });
            const s = r.status();
            if (s >= 500) throw new Error('admin/login (лош) върна ' + s + ' (сървърна грешка)');
            if (s !== 401) throw new Error('admin/login (лош): очаквах 401, върна ' + s);
          } finally { await fr.dispose(); }
        } },
        { label: 'POST /admin/login с .env данни → успех + role (ако има .env; иначе пропусни)', run: async (page, c, h) => {
          if (!c.adminUser || !c.adminPass) { c.eco3AdminSkip = true; return; } // няма .env админ → пропусни успешните стъпки
          // Ползваме СПОДЕЛЕНАТА page.request сесия → бисквитката носи admin сесията нататък.
          const r = await page.request.post(h.base + E + '/admin/login', { failOnStatusCode: false, data: { username: c.adminUser, password: c.adminPass } });
          const s = r.status();
          if (s >= 500) throw new Error('admin/login (.env) върна ' + s + ' (сървърна грешка)');
          if (s === 401) { c.eco3AdminSkip = true; return; } // .env данните не съвпадат с този сървър → грациозно
          if (s !== 200) throw new Error('admin/login (.env): очаквах 200, върна ' + s);
          const b = await jsonOf(r);
          if (!b.ok || !b.user || !b.role) throw new Error('admin/login (.env): липсва ok/user/role: ' + JSON.stringify(b).slice(0, 120));
          c.eco3AdminUser = b.user;
        } },
        { label: 'GET /admin/me → ехо на role (user без вход; lognat → роля)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + E + '/admin/me');
          if (r.status() >= 500) throw new Error('admin/me върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('admin/me HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!('user' in b) || !('role' in b)) throw new Error('admin/me: липсва user/role: ' + JSON.stringify(b).slice(0, 120));
          if (c.eco3AdminUser && b.role === 'user') throw new Error('admin/me: влязохме като админ, но role е "user" (сесията не носи admin)');
        } },
      ],
    },
    {
      name: 'СОЗДАВАНЕ НА ПЛАЩАНЕ = САМО ПРЕДПАЗИТЕЛ (без реален Stripe charge)',
      steps: [
        { label: 'POST /create-payment → 503 ако Stripe е изключен; иначе НИКОГА 500 при валиден tier', run: async (page, c, h) => {
          // Никога не завършваме реален charge. Ако Stripe е ИЗКЛЮЧЕН → 503 (документиран предпазител).
          // Ако е ВКЛЮЧЕН → tier-математиката минава и Stripe връща clientSecret (test ключ); пак
          // НЕ потвърждаваме плащане — само че пътят не гръмва (>=500).
          const r = await page.request.post(h.base + E + '/create-payment', { failOnStatusCode: false, data: { budget: 'standard', duration: 10, topic: 'Робот тест плащане' } });
          const s = r.status();
          if (!c.stripeConfigured) {
            if (s !== 503) throw new Error('create-payment при изключен Stripe: очаквах 503, върна ' + s);
            return;
          }
          // Stripe е включен: 200 (created intent) или 4xx са приемливи; 500 = реален срив.
          if (s >= 500) throw new Error('create-payment (Stripe вкл.) върна ' + s + ' (сървърна грешка)');
        } },
        { label: 'POST /create-payment с повреден body → НИКОГА 500 (503 ако Stripe изкл.)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + E + '/create-payment', { failOnStatusCode: false, headers: { 'content-type': 'application/json' }, data: '"not an object"' });
          const s = r.status();
          // Stripe изкл. → 503 преди да докосне body. Stripe вкл. → guard-нат tier=standard, не 500.
          if (s >= 500) throw new Error('create-payment с повреден body върна ' + s + ' (сървърна грешка вместо предпазител)');
        } },
        { label: 'POST /create-payment с непознат tier → fallback standard, НИКОГА 500', run: async (page, c, h) => {
          const r = await page.request.post(h.base + E + '/create-payment', { failOnStatusCode: false, data: { budget: '__robot_unknown_tier', duration: 5, topic: 'x' } });
          const s = r.status();
          if (s >= 500) throw new Error('create-payment с непознат tier върна ' + s + ' (сървърна грешка)');
        } },
      ],
    },
    {
      name: 'ТЪРСЕНЕ /search = login-gated + query предпазители (външното = guard)',
      steps: [
        { label: 'POST /search БЕЗ вход (чиста сесия) → 401 login_required (НЕ свободно търсене)', run: async (page, c, h) => {
          const fr = await freshRequest();
          try {
            const r = await fr.request.post(h.base + E + '/search', { failOnStatusCode: false, data: { query: 'робот без вход' } });
            const s = r.status();
            if (s >= 500) throw new Error('анонимен search върна ' + s + ' (сървърна грешка)');
            if (s !== 401) throw new Error('анонимен search: очаквах 401, върна ' + s);
          } finally { await fr.dispose(); }
        } },
        { label: 'портален вход (за да минем eco3RequireLogin на /search и /generate)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/register', { failOnStatusCode: false, data: { username: c.user, password: c.pass } });
          if (r.status() >= 500) throw new Error('portals/register върна ' + r.status() + ' (сървърна грешка)');
          // 200 = регистриран и логнат; всичко друго → search/generate ще са 401, маркираме пропуск
          c.eco3LoggedIn = r.ok();
        } },
        { label: 'POST /search логнат БЕЗ query → 400 query_required (валидация преди външното)', run: async (page, c, h) => {
          if (!c.eco3LoggedIn) return; // без вход → не можем да достигнем валидацията (би било 401)
          const r = await page.request.post(h.base + E + '/search', { failOnStatusCode: false, data: { lang: 'bg' } });
          const s = r.status();
          if (s === 401) { c.eco3LoggedIn = false; return; } // споделената сесия не стигна → грациозно
          if (s >= 500) throw new Error('search без query върна ' + s + ' (сървърна грешка)');
          if (s !== 400) throw new Error('search без query: очаквах 400 query_required, върна ' + s);
          const b = await jsonOf(r);
          if (b.error !== 'query_required') throw new Error('search без query: очаквах error=query_required, върна ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'POST /search логнат с query → НИКОГА 500 (резултат зависи от Google квота — guard)', run: async (page, c, h) => {
          // ВЪНШНО: реалните резултати искат Google/Claude квота. Не разчитаме на тях —
          // само че кодът отговаря коректно (200 с results масив), без сървърен срив.
          if (!c.eco3LoggedIn) return;
          const r = await page.request.post(h.base + E + '/search', { timeout: 20000, failOnStatusCode: false, data: { query: 'климат новини', lang: 'bg', num: 3, tier: 'economy' } });
          const s = r.status();
          if (s >= 500) throw new Error('search с query върна ' + s + ' (сървърна грешка)');
          if (s === 200) {
            const b = await jsonOf(r);
            if (!Array.isArray(b.results)) throw new Error('search 200, но results не е масив: ' + JSON.stringify(b).slice(0, 120));
          }
        } },
      ],
    },
    {
      name: 'GENERATE агентни клонове ARCHITECT + EXECUTOR (test=mock; production без ключ=503 guard)',
      steps: [
        { label: 'POST /generate system=ARCHITECT → непразен mock (test) или 503 (production без ключ)', run: async (page, c, h) => {
          if (!c.eco3LoggedIn) return; // login-gated; без вход = 401 (не е новото, което тестваме)
          const r = await page.request.post(h.base + E + '/generate', { timeout: 30000, failOnStatusCode: false, data: { system: 'ARCHITECT', messages: [{ role: 'user', content: 'Робот тест: архитект на структура.' }], max_tokens: 256 } });
          const s = r.status();
          if (s === 401) { c.eco3LoggedIn = false; return; }
          if (s >= 500) throw new Error('generate ARCHITECT върна ' + s + ' (сървърна грешка)');
          if (s === 503) {
            // production без Anthropic ключ → документиран предпазител; не е грешка
            if ((c.eco3Mode || 'test') === 'test') throw new Error('generate ARCHITECT 503 в test mode (mock-ът трябваше да отговори)');
            return;
          }
          if (s !== 200) throw new Error('generate ARCHITECT: очаквах 200/503, върна ' + s);
          const b = await jsonOf(r);
          const text = generateText(b);
          if (!text) throw new Error('generate ARCHITECT върна празен резултат: ' + JSON.stringify(b).slice(0, 120));
          // В test mode mock-ът на архитекта съдържа маркера „Архитект"; проверяваме клона.
          if ((c.eco3Mode || 'test') === 'test' && !/Архитект/.test(text)) throw new Error('generate ARCHITECT mock не е архитектният клон: ' + text.slice(0, 120));
        } },
        { label: 'POST /generate system=EXECUTOR → непразен mock (test) или 503 (production без ключ)', run: async (page, c, h) => {
          if (!c.eco3LoggedIn) return;
          const r = await page.request.post(h.base + E + '/generate', { timeout: 30000, failOnStatusCode: false, data: { system: 'EXECUTOR', messages: [{ role: 'user', content: 'Робот тест: изпълнител на текст.' }], max_tokens: 256 } });
          const s = r.status();
          if (s === 401) { c.eco3LoggedIn = false; return; }
          if (s >= 500) throw new Error('generate EXECUTOR върна ' + s + ' (сървърна грешка)');
          if (s === 503) {
            if ((c.eco3Mode || 'test') === 'test') throw new Error('generate EXECUTOR 503 в test mode (mock-ът трябваше да отговори)');
            return;
          }
          if (s !== 200) throw new Error('generate EXECUTOR: очаквах 200/503, върна ' + s);
          const b = await jsonOf(r);
          const text = generateText(b);
          if (!text) throw new Error('generate EXECUTOR върна празен резултат: ' + JSON.stringify(b).slice(0, 120));
          if ((c.eco3Mode || 'test') === 'test' && !/Изпълнител/.test(text)) throw new Error('generate EXECUTOR mock не е изпълнителният клон: ' + text.slice(0, 120));
        } },
      ],
    },
    {
      name: 'PERSISTENCE (ЛОКАЛЕН SQLite) — /results кръг: POST → GET → GET/:id (+bad id 404, +resale)',
      steps: [
        { label: 'POST /results → ok + id (запазваме за round-trip)', run: async (page, c, h) => {
          c.resultTopic = 'Робот резултат ' + c.runToken;
          const r = await page.request.post(h.base + E + '/results', { failOnStatusCode: false, data: {
            topic: c.resultTopic, category: 'news', director_output: 'D-' + c.runToken,
            architect_output: 'A-' + c.runToken, executor_output: 'E-' + c.runToken,
            language: 'bg', budget_tier: 'economy', duration_min: 10, audience: 'adult', tone: 'original', session_id: 'robot-' + c.runToken,
          } });
          const s = r.status();
          if (s === 503) { c.eco3NoDb = true; return; } // няма база → пропусни кръга грациозно
          if (s >= 500) throw new Error('POST /results върна ' + s + ' (сървърна грешка)');
          const b = await jsonOf(r);
          if (!b.ok || !b.id) throw new Error('POST /results: липсва ok/id: ' + JSON.stringify(b).slice(0, 120));
          c.resultId = b.id;
        } },
        { label: 'GET /results → масив, съдържа нашия запис', run: async (page, c, h) => {
          if (c.eco3NoDb || !c.resultId) return;
          const r = await page.request.get(h.base + E + '/results?limit=100');
          if (r.status() >= 500) throw new Error('GET /results върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('GET /results HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!Array.isArray(b.results)) throw new Error('GET /results: results не е масив');
          if (!b.results.some(x => String(x.id) === String(c.resultId))) throw new Error('GET /results: нашият запис (id=' + c.resultId + ') липсва в списъка');
        } },
        { label: 'GET /results/:id → пълният запис round-trip (topic + executor_output съвпадат)', run: async (page, c, h) => {
          if (c.eco3NoDb || !c.resultId) return;
          const r = await page.request.get(h.base + E + '/results/' + c.resultId);
          if (r.status() >= 500) throw new Error('GET /results/:id върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('GET /results/:id HTTP ' + r.status());
          const b = await jsonOf(r);
          if (b.topic !== c.resultTopic) throw new Error('round-trip провал: topic "' + b.topic + '" != "' + c.resultTopic + '"');
          if (b.executor_output !== 'E-' + c.runToken) throw new Error('round-trip провал: executor_output не съвпада');
        } },
        { label: 'GET /results/:id повторно → resale брояч се увеличава (без срив)', run: async (page, c, h) => {
          if (c.eco3NoDb || !c.resultId) return;
          const r = await page.request.get(h.base + E + '/results/' + c.resultId);
          if (r.status() >= 500) throw new Error('GET /results/:id (resale) върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('GET /results/:id (resale) HTTP ' + r.status());
        } },
        { label: 'GET /results/:id с НЕсъществуващ id → 404', run: async (page, c, h) => {
          if (c.eco3NoDb) return;
          const r = await page.request.get(h.base + E + '/results/999999999');
          const s = r.status();
          if (s >= 500) throw new Error('GET /results/bad-id върна ' + s + ' (сървърна грешка)');
          if (s !== 404) throw new Error('GET /results/bad-id: очаквах 404, върна ' + s);
        } },
      ],
    },
    {
      name: 'PERSISTENCE — /history кръг: POST → GET (+?category филтър)',
      steps: [
        { label: 'POST /history → ok + id', run: async (page, c, h) => {
          c.histTopic = 'Робот история ' + c.runToken;
          const r = await page.request.post(h.base + E + '/history', { failOnStatusCode: false, data: {
            topic: c.histTopic, category: 'robotcat', language: 'bg', budget_tier: 'economy',
            duration_min: 10, audience: 'adult', tone: 'original', session_id: 'robot-' + c.runToken,
          } });
          const s = r.status();
          if (s === 503) { c.eco3NoDb = true; return; }
          if (s >= 500) throw new Error('POST /history върна ' + s + ' (сървърна грешка)');
          const b = await jsonOf(r);
          if (!b.ok) throw new Error('POST /history: липсва ok: ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'GET /history → масив (форма)', run: async (page, c, h) => {
          if (c.eco3NoDb) return;
          const r = await page.request.get(h.base + E + '/history?limit=50');
          if (r.status() >= 500) throw new Error('GET /history върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('GET /history HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!Array.isArray(b.history)) throw new Error('GET /history: history не е масив');
        } },
        { label: 'GET /history?category=robotcat → филтрираният клон, съдържа нашия запис', run: async (page, c, h) => {
          if (c.eco3NoDb) return;
          const r = await page.request.get(h.base + E + '/history?category=robotcat&limit=50');
          if (r.status() >= 500) throw new Error('GET /history?category върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('GET /history?category HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!Array.isArray(b.history)) throw new Error('GET /history?category: history не е масив');
          if (!b.history.some(x => x.topic === c.histTopic)) throw new Error('GET /history?category: нашият запис липсва във филтрирания списък');
        } },
      ],
    },
    {
      name: 'PERSISTENCE — /uniqueness: check → add → count (insert вдига дневния брой)',
      steps: [
        { label: 'POST /uniqueness/check (преди add) → exists:false', run: async (page, c, h) => {
          const r = await page.request.post(h.base + E + '/uniqueness/check', { failOnStatusCode: false, data: { title: c.uniqTitle, link: c.uniqLink, source: 'robot' } });
          if (r.status() >= 500) throw new Error('uniqueness/check върна ' + r.status() + ' (сървърна грешка)');
          const b = await jsonOf(r);
          if (typeof b.exists !== 'boolean') throw new Error('uniqueness/check: липсва exists(bool): ' + JSON.stringify(b).slice(0, 120));
          if (b.exists === true) c.uniqAlready = true; // вече добавен от предишно пускане → пропусни строгите проверки
        } },
        { label: 'GET /uniqueness/count (преди) → запиши базовия брой', run: async (page, c, h) => {
          const r = await page.request.get(h.base + E + '/uniqueness/count');
          if (r.status() >= 500) throw new Error('uniqueness/count върна ' + r.status() + ' (сървърна грешка)');
          const b = await jsonOf(r);
          if (typeof b.count !== 'number') throw new Error('uniqueness/count: липсва count(number): ' + JSON.stringify(b).slice(0, 120));
          c.uniqBefore = b.count;
        } },
        { label: 'POST /uniqueness/add → ok + todayCount (insert)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + E + '/uniqueness/add', { failOnStatusCode: false, data: { title: c.uniqTitle, link: c.uniqLink, source: 'robot', session_id: 'robot-' + c.runToken } });
          if (r.status() >= 500) throw new Error('uniqueness/add върна ' + r.status() + ' (сървърна грешка)');
          const b = await jsonOf(r);
          if (b.ok === false && b.error) throw new Error('uniqueness/add провал: ' + String(b.error).slice(0, 120));
          if (b.ok && typeof b.todayCount !== 'number') throw new Error('uniqueness/add: липсва todayCount(number): ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'GET /uniqueness/count (след add) → броят НЕ е намалял (insert се отрази)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + E + '/uniqueness/count');
          if (r.status() >= 500) throw new Error('uniqueness/count (след) върна ' + r.status() + ' (сървърна грешка)');
          const b = await jsonOf(r);
          if (typeof b.count !== 'number') throw new Error('uniqueness/count (след): липсва count(number)');
          if (b.count < (c.uniqBefore || 0)) throw new Error('uniqueness count намаля след add: ' + (c.uniqBefore || 0) + ' → ' + b.count);
        } },
        { label: 'POST /uniqueness/check (след add) → exists:true (записът се намира)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + E + '/uniqueness/check', { failOnStatusCode: false, data: { title: c.uniqTitle, link: c.uniqLink, source: 'robot' } });
          if (r.status() >= 500) throw new Error('uniqueness/check (след) върна ' + r.status() + ' (сървърна грешка)');
          const b = await jsonOf(r);
          // Ако базата отсъства (db==null), check винаги връща exists:false — приемливо (не сме персистирали).
          if (!c.eco3NoDb && b.exists !== true) throw new Error('uniqueness/check (след add): очаквах exists:true, върна ' + JSON.stringify(b).slice(0, 120));
        } },
      ],
    },
    {
      name: 'АДМИН ТАБЛА — анон отказ (guard) + УСПЕШЕН път при наличен админ',
      steps: [
        { label: 'DELETE /admin/logs БЕЗ админ (анонимно) → отказ (НЕ трием реално логовете)', run: async (page, c, h) => {
          // САМО предпазител: в production без админ → 403; в dev adminCheck пуска всеки → 200 е допустим
          // (логовете и без това се пишат наново). НЕ трием от споделената (евентуално админ) сесия.
          const fr = await freshRequest();
          try {
            const r = await fr.request.delete(h.base + E + '/admin/logs', { failOnStatusCode: false });
            const s = r.status();
            if (s >= 500) throw new Error('DELETE /admin/logs (анон) върна ' + s + ' (сървърна грешка)');
            if ((c.eco3Mode || 'test') === 'production' && ![401, 403].includes(s)) {
              throw new Error('DELETE /admin/logs (анон) в production: очаквах 401/403, върна ' + s + ' (изтриване без админ!)');
            }
          } finally { await fr.dispose(); }
        } },
        { label: 'GET /admin/stats (админ) → 200 + форма (totalRequests, database)', run: async (page, c, h) => {
          // Минаваме adminCheck: dev пуска всеки IP; production иска .env админ сесия (горе влязохме, ако имаше).
          const r = await page.request.get(h.base + E + '/admin/stats', { failOnStatusCode: false });
          const s = r.status();
          if (s === 401 || s === 403) { c.eco3AdminDenied = true; return; } // няма админ достъп → грациозно
          if (s >= 500) throw new Error('admin/stats върна ' + s + ' (сървърна грешка)');
          if (s !== 200) throw new Error('admin/stats: очаквах 200, върна ' + s);
          const b = await jsonOf(r);
          if (typeof b.totalRequests !== 'number' || !b.database) throw new Error('admin/stats: липсва totalRequests/database: ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'GET /admin/db-status (админ, УСПЕШЕН път) → connected:true + tables', run: async (page, c, h) => {
          if (c.eco3AdminDenied) return;
          const r = await page.request.get(h.base + E + '/admin/db-status', { failOnStatusCode: false });
          const s = r.status();
          if (s === 401 || s === 403) { c.eco3AdminDenied = true; return; }
          if (s >= 500) throw new Error('admin/db-status върна ' + s + ' (сървърна грешка)');
          if (s !== 200) throw new Error('admin/db-status: очаквах 200, върна ' + s);
          const b = await jsonOf(r);
          if (!b.connected) { c.eco3NoDb = true; return; } // няма база → connected:false е валидно
          if (!b.tables || typeof b.tables !== 'object') throw new Error('admin/db-status: липсва tables обект: ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'GET /admin/logs (админ) → logs низ', run: async (page, c, h) => {
          if (c.eco3AdminDenied) return;
          const r = await page.request.get(h.base + E + '/admin/logs', { failOnStatusCode: false });
          const s = r.status();
          if (s === 401 || s === 403) return;
          if (s >= 500) throw new Error('admin/logs върна ' + s + ' (сървърна грешка)');
          if (s !== 200) throw new Error('admin/logs: очаквах 200, върна ' + s);
          const b = await jsonOf(r);
          if (typeof b.logs !== 'string') throw new Error('admin/logs: липсва logs(низ): ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'POST /admin/logout → ok (изчиства admin сесията, ако сме влизали)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + E + '/admin/logout');
          if (r.status() >= 500) throw new Error('admin/logout върна ' + r.status() + ' (сървърна грешка)');
          if (!r.ok()) throw new Error('admin/logout HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!b.ok) throw new Error('admin/logout: липсва ok: ' + JSON.stringify(b).slice(0, 120));
        } },
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
