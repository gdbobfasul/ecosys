// Version: 1.0173
// Портали — работни сценарии „като човек": регистрация (UI) → вход (UI) →
// ползване на услуга (QR, клиентско) → почистване на тестовите потребители.
'use strict';

module.exports = {
  app: 'portals',
  label: 'Портали (регистрация, вход, услуга)',
  writes: true,
  setup(ctx, env) {
    env = env || {};
    // префикс __diagtest → хваща се от /api/portals/adm/cleanup-test
    ctx.user = `__diagtest_${ctx.runToken}`.slice(0, 30);
    ctx.pass = 'robot1234';
    // втори НОРМАЛЕН тестов потребител (за персона „нападател" / „лош потребител")
    ctx.user2 = `__diagtest_b${ctx.runToken}`.slice(0, 30);
    // .env админ/модератор (roles.js: вход по USERNAME). Празно → персоната се пропуска грациозно.
    ctx.adminUser = (env.PORTALS_ADMIN_USER || '').trim();
    ctx.adminPass = (env.PORTALS_ADMIN_PASS || '').trim();
    ctx.modUser = (env.PORTALS_MOD1_USER || '').trim();
    ctx.modPass = (env.PORTALS_MOD1_PASS || '').trim();
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
    // ════════════════════════════════════════════════════════════════════
    // ПЕРСОНА 1 — ВАЛИДЕН + НЕВАЛИДЕН вход (регистрация + доклад за грешка)
    // Очакваме коректни 400/409 за грешка, НИКОГА 500. Валидните минават.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Персона: валиден + невалиден вход (регистрация)',
      steps: [
        { api: { method: 'POST', path: '/api/portals/logout' } },
        // ВАЛИДНО: нов потребител (user2) → 200 ok
        { api: { method: 'POST', path: '/api/portals/register', json: (c) => ({ username: c.user2, password: c.pass }) }, expectStatus: 200 },
        { api: { method: 'POST', path: '/api/portals/logout' } },
        // НЕВАЛИДНО: твърде късо потребителско име → 400 (НЕ 500)
        { label: 'твърде кратко username → 400 username_invalid', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/register', { failOnStatusCode: false, data: { username: 'ab', password: c.pass } });
          if (r.status() >= 500) throw new Error('register (кратко име) HTTP ' + r.status() + ' — 500, счупено');
          if (r.status() !== 400) throw new Error('register (кратко име) очаквах 400, върна ' + r.status());
        } },
        // НЕВАЛИДНО: твърде кратка парола → 400 (НЕ 500)
        { label: 'твърде кратка парола → 400 password_invalid', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/register', { failOnStatusCode: false, data: { username: c.user2 + 'x', password: '1' } });
          if (r.status() >= 500) throw new Error('register (кратка парола) HTTP ' + r.status() + ' — 500, счупено');
          if (r.status() !== 400) throw new Error('register (кратка парола) очаквах 400, върна ' + r.status());
        } },
        // НЕВАЛИДНО: празни полета → 400 (НЕ 500)
        { label: 'празни полета → 400', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/register', { failOnStatusCode: false, data: {} });
          if (r.status() >= 500) throw new Error('register (празно) HTTP ' + r.status() + ' — 500, счупено');
          if (r.status() !== 400) throw new Error('register (празно) очаквах 400, върна ' + r.status());
        } },
        // НЕВАЛИДНО: дублирано име (user2 вече съществува) → 409 (НЕ 500)
        { label: 'дублирано username → 409 username_taken', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/register', { failOnStatusCode: false, data: { username: c.user2, password: c.pass } });
          if (r.status() >= 500) throw new Error('register (дубликат) HTTP ' + r.status() + ' — 500, счупено');
          if (r.status() !== 409) throw new Error('register (дубликат) очаквах 409, върна ' + r.status());
        } },
      ],
    },
    {
      name: 'Персона: валиден + невалиден доклад за грешка',
      steps: [
        // влез като нормалния потребител от първите сценарии
        { api: { method: 'POST', path: '/api/portals/login', json: (c) => ({ username: c.user, password: c.pass }) }, expectStatus: 200 },
        // ВАЛИДНО: пълен доклад → 200 ok
        { api: { method: 'POST', path: '/api/portals/bug-report', json: () => ({ title: 'Робот доклад', body: 'Автоматичен валиден доклад от робота — над двайсет знака описание.' }) }, expectStatus: 200 },
        // НЕВАЛИДНО: празно заглавие → 400 (НЕ 500)
        { label: 'празно заглавие → 400 title_required', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/bug-report', { failOnStatusCode: false, data: { title: '', body: 'тяло без заглавие' } });
          if (r.status() >= 500) throw new Error('bug-report (празно заглавие) HTTP ' + r.status() + ' — 500');
          if (r.status() !== 400) throw new Error('bug-report (празно заглавие) очаквах 400, върна ' + r.status());
        } },
        // НЕВАЛИДНО: празно тяло → 400 (НЕ 500)
        { label: 'празно тяло → 400 body_required', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/bug-report', { failOnStatusCode: false, data: { title: 'само заглавие', body: '' } });
          if (r.status() >= 500) throw new Error('bug-report (празно тяло) HTTP ' + r.status() + ' — 500');
          if (r.status() !== 400) throw new Error('bug-report (празно тяло) очаквах 400, върна ' + r.status());
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // ПЕРСОНА 2 — НАПАДАТЕЛ / „лош потребител"
    // Очакваме 401/403/400/404, НИКОГА 500 и НИКОГА изтичане на защитено съдържание.
    // Бележка: ако сървърът третира робота като админ по IP (0.0.0.0/0 или
    // localhost whitelist), някои блокировки не важат — затова първо питаме
    // /api/portals/ip-admin и затягаме твърдението САМО когато НЕ сме IP-админ.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Персона: нападател — админ ендпойнти без права',
      steps: [
        { label: 'разбери дали IP-то е третирано като админ', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/portals/ip-admin', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('ip-admin HTTP ' + r.status());
          const b = await r.json().catch(() => ({}));
          c.ipAdmin = !!b.ip_admin;
        } },
        // БЕЗ сесия → admin списък: 401/403 (или ако IP-админ → 200, но НИКОГА 500)
        { label: 'GET /adm/users без сесия → 401/403 (не 500/листинг)', run: async (page, c, h) => {
          await page.request.post(h.base + '/api/portals/logout').catch(() => {});
          const r = await page.request.get(h.base + '/api/portals/adm/users', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('adm/users (анон) HTTP ' + r.status() + ' — 500');
          if (!c.ipAdmin && ![401, 403].includes(r.status())) {
            throw new Error('adm/users (анон) очаквах 401/403, върна ' + r.status() + ' (изтича админ листинг!)');
          }
        } },
        // НОРМАЛЕН логнат потребител → admin списък: 403 (или IP-админ → ОК, но не 500)
        { api: { method: 'POST', path: '/api/portals/login', json: (c) => ({ username: c.user, password: c.pass }) }, expectStatus: 200 },
        { label: 'GET /adm/users като НОРМАЛЕН потребител → 403 (не 500/листинг)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/portals/adm/users', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('adm/users (нормален) HTTP ' + r.status() + ' — 500');
          if (!c.ipAdmin && r.status() !== 403) {
            throw new Error('adm/users (нормален потребител) очаквах 403, върна ' + r.status());
          }
        } },
        // DELETE на чужд потребител като нормален → 403 (или IP-админ → друго, но не 500)
        { label: 'DELETE /adm/users/1 като нормален потребител → 403 (не 500)', run: async (page, c, h) => {
          const r = await page.request.delete(h.base + '/api/portals/adm/users/1', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('adm/delete (нормален) HTTP ' + r.status() + ' — 500');
          if (!c.ipAdmin && r.status() !== 403) {
            throw new Error('adm/delete (нормален потребител) очаквах 403, върна ' + r.status());
          }
        } },
      ],
    },
    {
      name: 'Персона: нападател — заобикаляне на платена услуга + фалшива сесия',
      steps: [
        // Достъп до платена услуга БЕЗ плащане и БЕЗ ?adm → 402/403 (или IP-админ → ОК), НЕ 500
        { api: { method: 'POST', path: '/api/portals/logout' } },
        { api: { method: 'POST', path: '/api/portals/login', json: (c) => ({ username: c.user, password: c.pass }) }, expectStatus: 200 },
        { label: 'POST /services/ai-listing без плащане → 402/403 (не съдържание/500)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/services/ai-listing', { failOnStatusCode: false, data: { keywords: 'robot test imot' } });
          if (r.status() >= 500) throw new Error('services/ai-listing (без плащане) HTTP ' + r.status() + ' — 500');
          if (!c.ipAdmin && ![402, 403].includes(r.status())) {
            throw new Error('services/ai-listing (без плащане) очаквах 402/403, върна ' + r.status() + ' (минава без плащане!)');
          }
        } },
        // Защитена СТРАНИЦА без логин и без ?adm → редирект (към login/billing), НЕ самото съдържание
        { label: 'GET /portals/services/ без достъп → редирект, не съдържание', run: async (page, c, h) => {
          await page.request.post(h.base + '/api/portals/logout').catch(() => {});
          const r = await page.request.get(h.base + '/portals/services/', { failOnStatusCode: false, maxRedirects: 0 });
          if (r.status() >= 500) throw new Error('services/ страница HTTP ' + r.status() + ' — 500');
          // IP-админ → 200 (пуска директно). Иначе очакваме редирект 3xx към login/billing.
          if (!c.ipAdmin) {
            const loc = (r.headers()['location'] || '');
            const redirected = r.status() >= 300 && r.status() < 400;
            if (!redirected || !(loc.includes('login') || loc.includes('billing'))) {
              throw new Error('services/ без достъп очаквах редирект към login/billing, върна ' + r.status() + ' loc=' + loc);
            }
          }
        } },
        // Фалшива/боклук сесийна бисквитка → 401 на login-required ендпойнт (никога 500)
        { label: 'фалшива connect.sid бисквитка → 401 (не 500)', run: async (page, c, h) => {
          await page.request.post(h.base + '/api/portals/logout').catch(() => {});
          const r = await page.request.get(h.base + '/api/portals/bug-report/mine', {
            failOnStatusCode: false,
            headers: { cookie: 'connect.sid=s%3Arobot-forged-garbage-session-id.deadbeefdeadbeef' },
          });
          if (r.status() >= 500) throw new Error('bug-report/mine (фалшива сесия) HTTP ' + r.status() + ' — 500');
          if (!c.ipAdmin && r.status() !== 401) {
            throw new Error('bug-report/mine (фалшива сесия) очаквах 401, върна ' + r.status());
          }
        } },
      ],
    },
    {
      name: 'Персона: нападател — инжекции и преголеми входове (без 500)',
      steps: [
        { api: { method: 'POST', path: '/api/portals/login', json: (c) => ({ username: c.user, password: c.pass }) }, expectStatus: 200 },
        // SQL/HTML инжекция в текстово поле → трябва да се обработи (200 ok или 400), НИКОГА 500
        { label: 'инжекция в доклад → обработено (200/400), не 500', run: async (page, c, h) => {
          const evil = `'); DROP TABLE portal_users;-- <script>alert(1)</script>`;
          const r = await page.request.post(h.base + '/api/portals/bug-report', { failOnStatusCode: false, data: { title: evil, body: evil + ' тяло над двайсет знака за валидност' } });
          if (r.status() >= 500) throw new Error('bug-report (инжекция) HTTP ' + r.status() + ' — 500');
          if (![200, 400].includes(r.status())) throw new Error('bug-report (инжекция) очаквах 200/400, върна ' + r.status());
        } },
        // Преголям вход (≫5000 знака) → сървърът реже/обработва, НИКОГА 500
        { label: 'преголям вход в доклад → обработено, не 500', run: async (page, c, h) => {
          const huge = 'x'.repeat(60000);
          const r = await page.request.post(h.base + '/api/portals/bug-report', { failOnStatusCode: false, data: { title: 'Голям', body: huge } });
          if (r.status() >= 500) throw new Error('bug-report (преголям) HTTP ' + r.status() + ' — 500');
          if (![200, 400, 413].includes(r.status())) throw new Error('bug-report (преголям) очаквах 200/400/413, върна ' + r.status());
        } },
        // Логин с боклук тип за полетата → 400 bad_input, НЕ 500
        { label: 'login с не-стрингови полета → 400 (не 500)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/portals/login', { failOnStatusCode: false, data: { username: { $ne: null }, password: [1, 2, 3] } });
          if (r.status() >= 500) throw new Error('login (боклук тип) HTTP ' + r.status() + ' — 500');
          if (![400, 401].includes(r.status())) throw new Error('login (боклук тип) очаквах 400/401, върна ' + r.status());
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // ПЕРСОНА 3 — АДМИН + МОДЕРАТОР (от .env, вход по username)
    // Само ако данните са налични в .env (ctx.adminUser/adminPass). Иначе грациозно
    // се пропуска (без грешка). Твърди: админ върши админ действие; нормален е 403.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Персона: админ (.env) върши админ действие; нормален = 403',
      steps: [
        { label: 'админ: вход + GET /adm/users работи; нормален → 403', run: async (page, c, h) => {
          if (!c.adminUser || !c.adminPass) { return; } // няма .env админ → пропусни грациозно
          await page.request.post(h.base + '/api/portals/logout').catch(() => {});
          const li = await page.request.post(h.base + '/api/portals/login', { failOnStatusCode: false, data: { username: c.adminUser, password: c.adminPass } });
          if (li.status() !== 200) throw new Error('админ вход се провали HTTP ' + li.status() + ' (.env PORTALS_ADMIN_USER/PASS?)');
          const lb = await li.json().catch(() => ({}));
          if (!lb.is_admin) throw new Error('логнат .env админ, но is_admin=false (roles.js/seed?)');
          // админ действие: списък потребители
          const ad = await page.request.get(h.base + '/api/portals/adm/users', { failOnStatusCode: false });
          if (ad.status() !== 200) throw new Error('админ GET /adm/users очаквах 200, върна ' + ad.status());
          // обратно като нормален → 403 (само ако НЕ сме IP-админ, иначе IP бие ролята)
          await page.request.post(h.base + '/api/portals/logout').catch(() => {});
          await page.request.post(h.base + '/api/portals/login', { failOnStatusCode: false, data: { username: c.user, password: c.pass } });
          const norm = await page.request.get(h.base + '/api/portals/adm/users', { failOnStatusCode: false });
          if (norm.status() >= 500) throw new Error('нормален GET /adm/users HTTP ' + norm.status() + ' — 500');
          if (!c.ipAdmin && norm.status() !== 403) throw new Error('нормален GET /adm/users очаквах 403, върна ' + norm.status());
        } },
      ],
    },
    {
      name: 'Персона: модератор (.env) преглежда, но НЕ трие (само ако е настроен)',
      steps: [
        { label: 'модератор: вижда доклади, но cleanup-test/триене → 403', run: async (page, c, h) => {
          if (!c.modUser || !c.modPass) { return; } // няма .env модератор → пропусни грациозно
          await page.request.post(h.base + '/api/portals/logout').catch(() => {});
          const li = await page.request.post(h.base + '/api/portals/login', { failOnStatusCode: false, data: { username: c.modUser, password: c.modPass } });
          if (li.status() !== 200) throw new Error('модератор вход се провали HTTP ' + li.status() + ' (.env PORTALS_MOD1_USER/PASS?)');
          // МОДЕРАТОРСКО действие (преглед): списък доклади → 200
          const view = await page.request.get(h.base + '/api/portals/bug-report/admin/list?fixed=0', { failOnStatusCode: false });
          if (view.status() !== 200) throw new Error('модератор преглед на доклади очаквах 200, върна ' + view.status());
          // АДМИН-само действие (запис/триене): cleanup-test → 403 за модератор
          const wr = await page.request.post(h.base + '/api/portals/adm/cleanup-test', { failOnStatusCode: false, data: {} });
          if (wr.status() >= 500) throw new Error('модератор cleanup-test HTTP ' + wr.status() + ' — 500');
          if (wr.status() !== 403) throw new Error('модератор cleanup-test очаквах 403 (само преглед), върна ' + wr.status());
        } },
      ],
    },
    {
      name: 'Почистване (трий тестовите потребители)',
      steps: [
        // увери се, че сме с админски права за триенето (нормален потребител не може)
        { label: 'влез като .env админ за почистването (ако има)', run: async (page, c, h) => {
          if (c.adminUser && c.adminPass) {
            await page.request.post(h.base + '/api/portals/logout').catch(() => {});
            await page.request.post(h.base + '/api/portals/login', { failOnStatusCode: false, data: { username: c.adminUser, password: c.adminPass } });
          }
        } },
        { api: { method: 'POST', path: '/api/portals/adm/cleanup-test', json: {} } },
      ],
    },
  ],
};
