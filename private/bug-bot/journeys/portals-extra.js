// Version: 1.0202
// Портали — ДОПЪЛНИТЕЛНИ работни сценарии: покриват ендпойнти, които portals.js
// НЕ докосва — billing (плащане/такси/портфейли/Stripe конфиг + декларация + admin-grant),
// модерация на доклади (маркирай „оправено"), УСПЕШНО админ триене, игрова класация,
// watch20 предпочитания, списъци на услуги/игри.
//
// Сесия: като portals.js — cookie-базиран express-session (page.request пази бисквитката),
// .env админ/мод вход по username, и детекция дали IP-то е третирано като админ
// (/api/portals/ip-admin). Без .env админ → админ-частите се пропускат грациозно.
//
// Игрите вървят САМО през /gms (portal_games.js — нива/прогрес/класация). Старият
// дублиран /api/portals/games (routes/games.js) е премахнат от кода.
//
// Префикси (от server.js):
//   auth=/api/portals · billing=/api/portals/billing · adm=/api/portals/adm
//   gms=/api/portals/gms · svc=/api/portals/svc
//   services=/api/portals/services · bug-report=/api/portals/bug-report
//
// Външни плащания (Stripe) = САМО guard: НИКОГА не завършваме реално плащане. Само
// проверяваме документирания отказ (503 stripe_not_configured / 400 / 401 / 402 / 403).
// Очакване навсякъде: коректен статус, който кодът връща; НИКОГА 500.
'use strict';

const P = '/api/portals';
const jsonOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };

// влез/излез помощници върху page.request (cookie-сесия)
async function logout(page, base) { await page.request.post(base + P + '/logout').catch(() => {}); }
async function login(page, base, username, password) {
  return page.request.post(base + P + '/login', { failOnStatusCode: false, data: { username, password } });
}

module.exports = {
  app: 'portals',
  label: 'Портали ДОПЪЛНИТЕЛНО — плащания/модерация/админ триене/класация/услуги',
  writes: true,
  setup(ctx, env) {
    env = env || {};
    // префикс __diagtest → почиства се от /api/portals/adm/cleanup-test
    ctx.user = `__diagtest_x${ctx.runToken}`.slice(0, 30);   // главен тестов потребител (плаща, докладва)
    ctx.userDel = `__diagtest_d${ctx.runToken}`.slice(0, 30); // потребител за триене (admin DELETE success)
    ctx.userGrant = `__diagtest_g${ctx.runToken}`.slice(0, 30); // потребител за admin-grant цел
    ctx.pass = 'robot1234';
    // .env админ/модератор (roles.js: вход по USERNAME). Празно → персоната се пропуска грациозно.
    ctx.adminUser = (env.PORTALS_ADMIN_USER || '').trim();
    ctx.adminPass = (env.PORTALS_ADMIN_PASS || '').trim();
    ctx.modUser = (env.PORTALS_MOD1_USER || '').trim();
    ctx.modPass = (env.PORTALS_MOD1_PASS || '').trim();
  },
  scenarios: [
    // ════════════════════════════════════════════════════════════════════
    // ПОДГОТОВКА — регистрирай тестовите потребители + разбери IP-админ статуса.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Подготовка: регистрация + IP-админ детекция',
      steps: [
        { label: 'разбери дали IP-то е третирано като админ', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/ip-admin', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('ip-admin HTTP ' + r.status());
          const b = await jsonOf(r);
          c.ipAdmin = !!b.ip_admin;
        } },
        { label: 'регистрирай главния потребител (user) → пази id', run: async (page, c, h) => {
          await logout(page, h.base);
          const r = await page.request.post(h.base + P + '/register', { failOnStatusCode: false, data: { username: c.user, password: c.pass } });
          const b = await jsonOf(r);
          if (r.status() >= 500) throw new Error('register user HTTP ' + r.status());
          // 200 нов или 409 (вече от предишно пускане) — и двете ок; вземи id през /me ако трябва
          if (r.status() === 200 && b.user) c.userId = b.user.id;
          if (!c.userId) {
            const me = await jsonOf(await page.request.get(h.base + P + '/me'));
            c.userId = me.user_id || (me.user && me.user.id) || null;
          }
        } },
        { label: 'регистрирай „за триене" (userDel) → пази id (за admin DELETE success)', run: async (page, c, h) => {
          await logout(page, h.base);
          const r = await page.request.post(h.base + P + '/register', { failOnStatusCode: false, data: { username: c.userDel, password: c.pass } });
          const b = await jsonOf(r);
          if (r.status() >= 500) throw new Error('register userDel HTTP ' + r.status());
          if (r.status() === 200 && b.user) c.userDelId = b.user.id;
        } },
        { label: 'регистрирай „за admin-grant" (userGrant) → пази id', run: async (page, c, h) => {
          await logout(page, h.base);
          const r = await page.request.post(h.base + P + '/register', { failOnStatusCode: false, data: { username: c.userGrant, password: c.pass } });
          const b = await jsonOf(r);
          if (r.status() >= 500) throw new Error('register userGrant HTTP ' + r.status());
          if (r.status() === 200 && b.user) c.userGrantId = b.user.id;
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 1. BILLING READS — fees/status/wallets/stripe-config (200 + форма).
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Billing reads: fees/status/wallets/stripe-config (200 + форма)',
      steps: [
        { label: 'влез като главния потребител', run: async (page, c, h) => {
          await logout(page, h.base);
          const r = await login(page, h.base, c.user, c.pass);
          if (r.status() !== 200) throw new Error('вход на главния потребител HTTP ' + r.status());
        } },
        { label: 'GET /billing/fees → 200 + monthly_fee.USD', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/billing/fees', { failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('billing/fees HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!b.monthly_fee || b.monthly_fee.USD == null) throw new Error('billing/fees: липсва monthly_fee.USD');
          if (!b.current_month) throw new Error('billing/fees: липсва current_month');
          c.feeUSD = Number(b.monthly_fee.USD);
        } },
        { label: 'GET /billing/status (логнат) → 200 + paid_this_month', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/billing/status', { failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('billing/status HTTP ' + r.status());
          const b = await jsonOf(r);
          if (typeof b.paid_this_month !== 'boolean') throw new Error('billing/status: липсва paid_this_month (булев)');
        } },
        { label: 'GET /billing/wallets → 200 + поне един адрес', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/billing/wallets', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('billing/wallets HTTP ' + r.status() + ' — 500');
          if (r.status() !== 200) throw new Error('billing/wallets очаквах 200, върна ' + r.status());
          const b = await jsonOf(r);
          if (!b || (b.BTC == null && b.ETH == null && b.BNB == null)) throw new Error('billing/wallets: няма BTC/ETH/BNB адреси');
        } },
        { label: 'GET /billing/stripe-config → 200 + enabled (булев)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/billing/stripe-config', { failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('billing/stripe-config HTTP ' + r.status());
          const b = await jsonOf(r);
          if (typeof b.enabled !== 'boolean') throw new Error('billing/stripe-config: липсва enabled (булев)');
          c.stripeEnabled = !!b.enabled;
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 2. BILLING DECLARE — валидна декларация (method=stripe), малка сума → 400,
    //    дубликат за месеца → 409. (btc/eth/bnb имат required=undefined в кода —
    //    затова happy-path е стрипово деклариране, не крипто.)
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Billing declare: валидно → ok; малка сума → 400; дубликат месец → 409',
      steps: [
        { label: 'POST /billing/declare bad_method → 400', run: async (page, c, h) => {
          const r = await page.request.post(h.base + P + '/billing/declare', { failOnStatusCode: false, data: { method: 'paypal', amount: 9999 } });
          if (r.status() >= 500) throw new Error('declare(bad_method) HTTP ' + r.status() + ' — 500');
          if (r.status() !== 400) throw new Error('declare(bad_method) очаквах 400, върна ' + r.status());
        } },
        { label: 'POST /billing/declare малка сума → 400 amount_too_low', run: async (page, c, h) => {
          const r = await page.request.post(h.base + P + '/billing/declare', { failOnStatusCode: false, data: { method: 'stripe', amount: 0.01 } });
          if (r.status() >= 500) throw new Error('declare(малка сума) HTTP ' + r.status() + ' — 500');
          if (r.status() !== 400) throw new Error('declare(малка сума) очаквах 400 amount_too_low, върна ' + r.status());
          const b = await jsonOf(r);
          if (b.error !== 'amount_too_low') throw new Error('declare(малка сума): очаквах error=amount_too_low, върна ' + b.error);
        } },
        { label: 'POST /billing/declare ВАЛИДНО (stripe, >= таксата) → ok ИЛИ 409 (вече платил)', run: async (page, c, h) => {
          const amt = (c.feeUSD || 5) + 1;
          const r = await page.request.post(h.base + P + '/billing/declare', { failOnStatusCode: false, data: { method: 'stripe', amount: amt, tx_reference: 'robot-' + c.runToken } });
          if (r.status() >= 500) throw new Error('declare(валидно) HTTP ' + r.status() + ' — 500');
          // 200 = прието; 409 = вече има плащане за месеца (легитимно при повторно пускане)
          if (![200, 409].includes(r.status())) throw new Error('declare(валидно) очаквах 200/409, върна ' + r.status());
          const b = await jsonOf(r);
          if (r.status() === 200 && !b.ok) throw new Error('declare(валидно) 200 но без ok:true');
          c.declared = true;
        } },
        { label: 'POST /billing/declare пак същия месец → 409 already_paid_this_month', run: async (page, c, h) => {
          if (!c.declared) return;
          const amt = (c.feeUSD || 5) + 1;
          const r = await page.request.post(h.base + P + '/billing/declare', { failOnStatusCode: false, data: { method: 'stripe', amount: amt } });
          if (r.status() >= 500) throw new Error('declare(дубликат) HTTP ' + r.status() + ' — 500');
          if (r.status() !== 409) throw new Error('declare(дубликат) очаквах 409, върна ' + r.status());
          const b = await jsonOf(r);
          if (b.error !== 'already_paid_this_month') throw new Error('declare(дубликат): очаквах error=already_paid_this_month, върна ' + b.error);
        } },
        { label: 'GET /billing/status сега → paid_this_month=true', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/billing/status', { failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('billing/status (след плащане) HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!b.paid_this_month) throw new Error('billing/status: paid_this_month=false след декларация');
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 3. ADMIN-GRANT — нормален потребител → 403; .env админ → success.
    //    (admin-grant ползва isFirstUserAdmin = .env РОЛЯ, НЕ IP-whitelist —
    //    затова дори IP-админ нормален потребител остава 403.)
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Billing admin-grant: нормален → 403; .env админ → success',
      steps: [
        { label: 'нормален потребител: POST /billing/admin-grant → 403 admin_only', run: async (page, c, h) => {
          await logout(page, h.base);
          await login(page, h.base, c.user, c.pass);
          const r = await page.request.post(h.base + P + '/billing/admin-grant', { failOnStatusCode: false, data: { target_user_id: c.userGrantId || 1 } });
          if (r.status() >= 500) throw new Error('admin-grant(нормален) HTTP ' + r.status() + ' — 500');
          // admin-grant НЕ зависи от IP — нормален винаги е 403
          if (r.status() !== 403) throw new Error('admin-grant(нормален) очаквах 403, върна ' + r.status());
        } },
        { label: '.env админ: POST /billing/admin-grant за userGrant → ok (или 409 вече гранатиран)', run: async (page, c, h) => {
          if (!c.adminUser || !c.adminPass) return; // няма .env админ → пропусни грациозно
          await logout(page, h.base);
          const li = await login(page, h.base, c.adminUser, c.adminPass);
          // .env админ може да НЕ е сийднат на тази среда (напр. VM) → входът връща 401.
          // Това е СРЕДОВ проблем (липсва PORTALS_ADMIN_USER/PASS в seed-а), не код-бъг —
          // пропускаме грациозно, стига да не е 5xx.
          if (li.status() >= 500) throw new Error('админ вход HTTP ' + li.status() + ' — 5xx');
          if (li.status() !== 200) { c.adminGrantSkip = true; return; }
          const lb = await jsonOf(li);
          if (!lb.is_admin) { c.adminGrantSkip = true; return; }
          if (!c.userGrantId) return; // без id няма какво да гранатираме
          const r = await page.request.post(h.base + P + '/billing/admin-grant', { failOnStatusCode: false, data: { target_user_id: c.userGrantId } });
          if (r.status() >= 500) throw new Error('admin-grant(админ) HTTP ' + r.status() + ' — 500');
          if (![200, 409].includes(r.status())) throw new Error('admin-grant(админ) очаквах 200/409, върна ' + r.status());
          const b = await jsonOf(r);
          if (r.status() === 200 && !b.ok) throw new Error('admin-grant(админ) 200 но без ok:true');
        } },
        { label: '.env админ: bad_target → 400', run: async (page, c, h) => {
          if (!c.adminUser || !c.adminPass || c.adminGrantSkip) return; // без успешен админ вход няма как
          // все още логнат като админ от горната стъпка
          const r = await page.request.post(h.base + P + '/billing/admin-grant', { failOnStatusCode: false, data: { target_user_id: 0 } });
          if (r.status() >= 500) throw new Error('admin-grant(bad_target) HTTP ' + r.status() + ' — 500');
          if (r.status() !== 400) throw new Error('admin-grant(bad_target) очаквах 400, върна ' + r.status());
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 4. STRIPE CHECKOUT = GUARD-ONLY. НИКОГА реално плащане.
    //    Изключен Stripe → 503 stripe_not_configured. Включен → не извикваме реалния
    //    поток: confirm-checkout без session_id → 400; чужда сесия не може да се случи
    //    с боклук id (Stripe.retrieve гръмва → код връща 500 при включен Stripe — затова
    //    при включен Stripe пробваме само документираните guard-и без валиден session_id).
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Stripe checkout = GUARD-ONLY (никога реално плащане)',
      steps: [
        { label: 'влез като нормален потребител', run: async (page, c, h) => {
          await logout(page, h.base);
          await login(page, h.base, c.user, c.pass);
        } },
        { label: 'POST /billing/create-checkout — guard според конфига', run: async (page, c, h) => {
          const r = await page.request.post(h.base + P + '/billing/create-checkout', { failOnStatusCode: false, data: {} });
          const st = r.status();
          if (c.stripeEnabled === false) {
            // изключен Stripe → документиран 503 stripe_not_configured
            if (st !== 503) throw new Error('create-checkout (Stripe изключен) очаквах 503 stripe_not_configured, върна ' + st);
            const b = await jsonOf(r);
            if (b.error !== 'stripe_not_configured') throw new Error('create-checkout: очаквах error=stripe_not_configured, върна ' + b.error);
          } else {
            // включен Stripe: НЕ завършваме реално плащане. Приемаме 200 (върнат checkout URL,
            // но никой не плаща) ИЛИ грациозен Stripe отказ (4xx). 500 = счупено.
            if (st >= 500 && st !== 503) throw new Error('create-checkout (Stripe включен) HTTP ' + st + ' — 500');
          }
        } },
        { label: 'POST /billing/confirm-checkout без session_id → guard (503 изкл. / 400 вкл.)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + P + '/billing/confirm-checkout', { failOnStatusCode: false, data: {} });
          const st = r.status();
          if (c.stripeEnabled === false) {
            if (st !== 503) throw new Error('confirm-checkout (Stripe изключен) очаквах 503, върна ' + st);
          } else {
            // включен: липсва session_id → документиран 400 missing_session_id (никога реално плащане)
            if (st >= 500 && st !== 503) throw new Error('confirm-checkout (Stripe включен) HTTP ' + st + ' — 500');
            if (st < 500 && st !== 400) throw new Error('confirm-checkout (Stripe включен, без session_id) очаквах 400, върна ' + st);
          }
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 5. BUG-REPORT МОДЕРАЦИЯ — потребител upsert-ва доклад; .env модератор/админ
    //    маркира „оправено"; проверка през admin/list?fixed=1.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Bug-report модерация: маркирай „оправено" → списъкът го отразява',
      steps: [
        { label: 'потребител upsert-ва доклад (POST /bug-report) → ok', run: async (page, c, h) => {
          await logout(page, h.base);
          await login(page, h.base, c.user, c.pass);
          const r = await page.request.post(h.base + P + '/bug-report', { failOnStatusCode: false, data: { title: 'Робот модерация ' + c.runToken, body: 'Доклад за маркиране като оправен — над двайсет знака описание.' } });
          if (r.status() !== 200) throw new Error('bug-report upsert HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!b.ok || !b.report || !b.report.id) throw new Error('bug-report upsert: липсва report.id');
          c.bugId = b.report.id;
        } },
        { label: 'staff: admin/list?fixed=0 съдържа доклада; маркирай fixed; провери fixed=1', run: async (page, c, h) => {
          // staff = .env админ ИЛИ .env модератор ИЛИ IP-whitelist. Без нито едно → пропусни.
          let asStaff = false;
          if (c.adminUser && c.adminPass) {
            await logout(page, h.base);
            const li = await login(page, h.base, c.adminUser, c.adminPass);
            asStaff = li.status() === 200;
          } else if (c.modUser && c.modPass) {
            await logout(page, h.base);
            const li = await login(page, h.base, c.modUser, c.modPass);
            asStaff = li.status() === 200;
          } else if (c.ipAdmin) {
            await logout(page, h.base); // IP-whitelist прави staff view достъпен без сесия
            asStaff = true;
          }
          if (!asStaff) { c.bugModSkip = true; return; } // няма как да модерираме → пропусни грациозно

          // преглед: неоправени
          const lr = await page.request.get(h.base + P + '/bug-report/admin/list?fixed=0', { failOnStatusCode: false });
          if (lr.status() !== 200) throw new Error('bug-report admin/list?fixed=0 HTTP ' + lr.status());
          const lb = await jsonOf(lr);
          if (!Array.isArray(lb.reports)) throw new Error('bug-report admin/list: reports не е масив');
          const present = lb.reports.some((x) => x.id === c.bugId);
          if (!present) throw new Error('докладът липсва в неоправените (fixed=0)');

          // маркирай „оправено" — само админ/IP минават; модератор е 403 (тогава пропусни тихо)
          const fr = await page.request.post(h.base + P + '/bug-report/admin/' + c.bugId + '/fixed', { failOnStatusCode: false, data: { fixed: 1 } });
          if (fr.status() === 403) { c.bugModSkip = true; return; } // вероятно сме модератор → само преглед
          if (fr.status() >= 500) throw new Error('bug-report admin/:id/fixed HTTP ' + fr.status() + ' — 500');
          if (fr.status() !== 200) throw new Error('bug-report admin/:id/fixed очаквах 200, върна ' + fr.status());

          // потвърди: вече е в оправените (fixed=1)
          const vr = await page.request.get(h.base + P + '/bug-report/admin/list?fixed=1', { failOnStatusCode: false });
          if (vr.status() !== 200) throw new Error('bug-report admin/list?fixed=1 HTTP ' + vr.status());
          const vb = await jsonOf(vr);
          if (!(vb.reports || []).some((x) => x.id === c.bugId)) throw new Error('докладът не се появи в оправените след маркиране');
        } },
        { label: 'staff: несъществуващ доклад /admin/0/fixed → 404 (само ако имаме write достъп)', run: async (page, c, h) => {
          if (c.bugModSkip) return;
          const r = await page.request.post(h.base + P + '/bug-report/admin/0/fixed', { failOnStatusCode: false, data: { fixed: 1 } });
          if (r.status() >= 500) throw new Error('bug-report admin/0/fixed HTTP ' + r.status() + ' — 500');
          if (![404, 403].includes(r.status())) throw new Error('bug-report admin/0/fixed очаквах 404, върна ' + r.status());
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 6. ADMIN DELETE SUCCESS — регистрираният за триене потребител се изтрива
    //    като .env админ (или като IP-админ). Нормален потребител е 403 (покрито в
    //    основното journey). Тук покриваме УСПЕХА.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Admin DELETE /adm/users/:id УСПЕХ (като .env админ / IP-админ)',
      steps: [
        { label: 'влез като админ (или разчитай на IP-админ) и изтрий userDel → ok', run: async (page, c, h) => {
          if (!c.userDelId) { c.delSkip = true; return; } // нямаме id (не сме го регистрирали наново) → пропусни
          let canAdmin = false;
          if (c.adminUser && c.adminPass) {
            await logout(page, h.base);
            const li = await login(page, h.base, c.adminUser, c.adminPass);
            canAdmin = li.status() === 200;
          } else if (c.ipAdmin) {
            await logout(page, h.base);
            canAdmin = true; // IP-whitelist дава admin write
          }
          if (!canAdmin) { c.delSkip = true; return; } // нито .env админ, нито IP-админ → пропусни грациозно

          const r = await page.request.delete(h.base + P + '/adm/users/' + c.userDelId, { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('adm DELETE users/:id HTTP ' + r.status() + ' — 500');
          if (r.status() !== 200) throw new Error('adm DELETE users/:id очаквах 200, върна ' + r.status());
          const b = await jsonOf(r);
          if (!b.ok) throw new Error('adm DELETE users/:id: липсва ok:true');
          if (b.deleted !== 1) throw new Error('adm DELETE users/:id: очаквах deleted=1, върна ' + b.deleted);
        } },
        { label: 'bad_id: DELETE /adm/users/0 → 400 (само ако имаме admin write)', run: async (page, c, h) => {
          if (c.delSkip) return;
          const r = await page.request.delete(h.base + P + '/adm/users/0', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('adm DELETE users/0 HTTP ' + r.status() + ' — 500');
          if (r.status() !== 400) throw new Error('adm DELETE users/0 очаквах 400 bad_id, върна ' + r.status());
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 7. ИГРИ — класация (gms/ranking, публична) + прогрес (gms/progress/:slug).
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Игри: класация (gms/ranking) + прогрес (gms/progress/:slug)',
      steps: [
        { label: 'GET /gms/ranking (публична) → 200 + ranking[] + month', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/gms/ranking', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('gms/ranking HTTP ' + r.status() + ' — 500');
          if (r.status() !== 200) throw new Error('gms/ranking очаквах 200 (публична), върна ' + r.status());
          const b = await jsonOf(r);
          if (!Array.isArray(b.ranking)) throw new Error('gms/ranking: ranking не е масив');
          if (!b.month) throw new Error('gms/ranking: липсва month');
        } },
        { label: 'GET /gms/progress/:slug (логнат) → 200 + best_level/best_score', run: async (page, c, h) => {
          await logout(page, h.base);
          await login(page, h.base, c.user, c.pass);
          const r = await page.request.get(h.base + P + '/gms/progress/plane-dodge', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('gms/progress HTTP ' + r.status() + ' — 500');
          if (r.status() !== 200) throw new Error('gms/progress очаквах 200, върна ' + r.status());
          const b = await jsonOf(r);
          if (b.best_level == null || b.best_score == null) throw new Error('gms/progress: липсва best_level/best_score');
        } },
        { label: 'GET /gms/list (портален достъп — нужен е плащане/IP) → 200 или 402', run: async (page, c, h) => {
          // главният потребител е платил (декларация по-горе) → 200. Ако не → 402 (легитимно).
          const r = await page.request.get(h.base + P + '/gms/list', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('gms/list HTTP ' + r.status() + ' — 500');
          if (![200, 402].includes(r.status())) throw new Error('gms/list очаквах 200/402, върна ' + r.status());
          if (r.status() === 200) {
            const b = await jsonOf(r);
            if (!Array.isArray(b.games)) throw new Error('gms/list: games не е масив');
          }
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 8. WATCH20 — запази предпочитания (POST /svc/watch20/prefs), после GET ги отразява.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Watch20: запази предпочитания → GET ги отразява',
      steps: [
        { label: 'влез като главния потребител', run: async (page, c, h) => {
          await logout(page, h.base);
          await login(page, h.base, c.user, c.pass);
        } },
        { label: 'POST /svc/watch20/prefs без slots[] → 400', run: async (page, c, h) => {
          const r = await page.request.post(h.base + P + '/svc/watch20/prefs', { failOnStatusCode: false, data: {} });
          if (r.status() >= 500) throw new Error('watch20 POST (без slots) HTTP ' + r.status() + ' — 500');
          if (r.status() !== 400) throw new Error('watch20 POST (без slots) очаквах 400, върна ' + r.status());
        } },
        { label: 'POST /svc/watch20/prefs ВАЛИДНО → ok', run: async (page, c, h) => {
          const slots = [{ sel: 'FIAT:USD', alerts: [1.05, 0.95] }, { sel: 'CRYPTO:BTC', alerts: [70000] }];
          const r = await page.request.post(h.base + P + '/svc/watch20/prefs', { failOnStatusCode: false, data: { slots } });
          if (r.status() >= 500) throw new Error('watch20 POST (валидно) HTTP ' + r.status() + ' — 500');
          if (r.status() !== 200) throw new Error('watch20 POST (валидно) очаквах 200, върна ' + r.status());
          const b = await jsonOf(r);
          if (!b.ok) throw new Error('watch20 POST: липсва ok:true');
        } },
        { label: 'GET /svc/watch20/prefs → 20 слота, слот 0 = FIAT:USD с праговете', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/svc/watch20/prefs', { failOnStatusCode: false });
          if (r.status() !== 200) throw new Error('watch20 GET HTTP ' + r.status());
          const b = await jsonOf(r);
          if (!Array.isArray(b.slots) || b.slots.length !== 20) throw new Error('watch20 GET: очаквах 20 слота, върна ' + (b.slots ? b.slots.length : 'нищо'));
          const s0 = b.slots[0];
          if (!s0 || s0.sel !== 'FIAT:USD') throw new Error('watch20 GET: слот 0 sel != FIAT:USD (върна ' + (s0 && s0.sel) + ')');
          if (!Array.isArray(s0.alerts) || s0.alerts.length !== 2) throw new Error('watch20 GET: слот 0 праговете не са отразени');
          const s1 = b.slots[1];
          if (!s1 || s1.sel !== 'CRYPTO:BTC') throw new Error('watch20 GET: слот 1 sel != CRYPTO:BTC');
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // 9. УСЛУГИ / СПИСЪЦИ — svc/list, services/list, svc/crypto-ranks (без 500).
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Услуги/списъци: svc/list, services/list, svc/crypto-ranks (без 500)',
      steps: [
        { label: 'влез като главния потребител (платил → портален достъп)', run: async (page, c, h) => {
          await logout(page, h.base);
          await login(page, h.base, c.user, c.pass);
        } },
        { label: 'GET /svc/list → 200 (services[]) или 402 (ако не е платил)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/svc/list', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('svc/list HTTP ' + r.status() + ' — 500');
          if (![200, 402].includes(r.status())) throw new Error('svc/list очаквах 200/402, върна ' + r.status());
          if (r.status() === 200) {
            const b = await jsonOf(r);
            if (!Array.isArray(b.services)) throw new Error('svc/list: services не е масив');
          }
        } },
        { label: 'GET /services/list → 200 (services[]) или 402', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/services/list', { failOnStatusCode: false });
          if (r.status() >= 500) throw new Error('services/list HTTP ' + r.status() + ' — 500');
          if (![200, 402].includes(r.status())) throw new Error('services/list очаквах 200/402, върна ' + r.status());
          if (r.status() === 200) {
            const b = await jsonOf(r);
            if (!Array.isArray(b.services)) throw new Error('services/list: services не е масив');
          }
        } },
        { label: 'GET /svc/crypto-ranks (логнат) → 200 (ranks обект) без 500', run: async (page, c, h) => {
          const r = await page.request.get(h.base + P + '/svc/crypto-ranks', { failOnStatusCode: false });
          // без CMC_API_KEY → 200 { ranks:{}, source:'none' }; с ключ → 200 или 502 (външен срив, не 500 наш)
          if (r.status() === 500) throw new Error('svc/crypto-ranks HTTP 500 — наш срив');
          if (![200, 502].includes(r.status())) throw new Error('svc/crypto-ranks очаквах 200/502, върна ' + r.status());
          if (r.status() === 200) {
            const b = await jsonOf(r);
            if (!b.ranks || typeof b.ranks !== 'object') throw new Error('svc/crypto-ranks: липсва ranks обект');
          }
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // ПОЧИСТВАНЕ — трий тестовите потребители (като .env админ, ако има).
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Почистване (трий тестовите потребители)',
      steps: [
        { label: 'влез като .env админ за почистването (ако има)', run: async (page, c, h) => {
          if (c.adminUser && c.adminPass) {
            await logout(page, h.base);
            await login(page, h.base, c.adminUser, c.adminPass);
          }
        } },
        { api: { method: 'POST', path: P + '/adm/cleanup-test', json: {} } },
      ],
    },
  ],
};
