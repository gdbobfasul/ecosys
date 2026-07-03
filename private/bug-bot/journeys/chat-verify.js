// Version: 1.0001
// Чат — НОВИТЕ функции от тази сесия, които другите журита НЕ покриват:
//   1) Подготовка: A, B (и C за UI) се регистрират (API), админ ги маркира платени, влизат → токени.
//   2) SERVICE-CATEGORIES: ендпойнтът връща all/public_offerings/need_services; верифицируемите
//      услуги (Лекар/Болница/Линейка/Полиция) НЕ са в публичните offerings (защита на падащото меню).
//   3) ВЕРИФИКАЦИЯ — кандидатстване: валидации (празно/невалидна услуга/без име → 400, дубликат → 409),
//      ВАЛИДНА заявка с прикачен документ (multipart), статус „моята".
//   4) ВЕРИФИКАЦИЯ — админ: списък по статус, сваляне на документа, ОДОБРИ (потребителят става
//      верифициран + offerings), ОТКАЖИ (с бележка), повторно одобрение → 409 (идемпотентност).
//   5) СИГНАЛИ — реално подаване (multipart снимка), валидации (без снимка/без заглавие → 400,
//      втори за деня → 429), и админ модерация: pending списък, ОТКАЖИ (нулира деня), ОДОБРИ
//      (създава статичен обект), повторно одобрение → 400.
//   6) UI „като човек": попълва формата verification.html (чекбокс + име + бутон) и проверява, че
//      падащото меню в signal.html НЕ показва суровия литерал KCY_I18N.t(... (регресия за преводите).
//   7) Изход.
//
// Всичко best-effort: без .env админ → админ частите се пропускат грациозно (не са провал).
// Очакване навсякъде: коректен отказ (400/401/403/409/429), НИКОГА 500.
'use strict';
const zlib = require('zlib');

// ── мъничък валиден PNG в кода (за снимка на сигнал / документ) — без външни файлове ──
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePng(w, h, color) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (1 + w * 3)); let o = 0;
  for (let y = 0; y < h; y++) { raw[o++] = 0; for (let x = 0; x < w; x++) { raw[o++] = color[0]; raw[o++] = color[1]; raw[o++] = color[2]; } }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
const PNG = makePng(48, 48, [70, 110, 160]);
const pngFile = (name) => ({ name, mimeType: 'image/png', buffer: PNG });

const bearer = (t) => ({ Authorization: 'Bearer ' + (t || '') });
const adminH = (c) => (c.adminToken ? bearer(c.adminToken) : {}); // VM: по IP; прод: по токен
const blocked = (c) => c.rateLimited || !c.tokenA || !c.tokenB;
const jsonOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };

module.exports = {
  app: 'chat',
  label: 'Чат ВЕРИФИКАЦИЯ + СИГНАЛИ (форми, документ, админ одобри/откажи/проверява)',
  writes: true,
  setup(ctx, env) {
    ctx.phoneA = '+94' + String(100000000 + (ctx.runNum % 800000000));
    ctx.phoneB = '+94' + String(100000000 + ((ctx.runNum + 17) % 800000000));
    ctx.phoneC = '+94' + String(100000000 + ((ctx.runNum + 29) % 800000000));
    ctx.pass = 'Robot12345!';
    ctx.nameA = 'Робот Верификация А';
    ctx.nameB = 'Робот Верификация Б';
    ctx.nameC = 'Робот Верификация В';
    ctx.orgA = 'Робот болница А ' + ctx.runToken;
    ctx.orgB = 'Робот полиция Б ' + ctx.runToken;
    ctx.adminUser = (env && (env.CHAT_ADMIN_USER || env.CHAT_MOD1)) || '';
    ctx.adminPass = (env && (env.CHAT_ADMIN_PASS || env.CHAT_MOD1_PASS)) || '';
  },
  scenarios: [
    {
      name: 'Подготовка: A, B, C (API) → админ платени → вход → токени',
      steps: [
        { label: 'регистрирай A, B, C', run: async (page, c, h) => {
          for (const who of ['A', 'B', 'C']) {
            const r = await page.request.post(h.base + '/api/auth/register', { data: {
              phone: c['phone' + who], password: c.pass, fullName: c['name' + who],
              gender: who === 'B' ? 'female' : 'male', heightCm: 178, weightKg: 74,
              country: 'България', city: 'София',
            } });
            if (r.status() === 429) { c.rateLimited = true; return; }
            const b = await jsonOf(r);
            if (!(b.success || b.userId)) throw new Error(`register ${who} HTTP ${r.status()} ${b.error || ''}`);
            c['userId' + who] = b.userId;
          }
        } },
        { label: 'админ-вход (от .env) → токен (по избор)', run: async (page, c, h) => {
          if (!c.adminUser || !c.adminPass) return;
          const r = await page.request.post(h.base + '/api/admin/login', { data: { username: c.adminUser, password: c.adminPass } });
          if (r.status() >= 500) throw new Error('админ-вход гръмна HTTP ' + r.status());
          const b = await jsonOf(r);
          if (b.token) c.adminToken = b.token;
        } },
        { label: 'админ: маркирай A, B, C платени', run: async (page, c, h) => {
          if (c.rateLimited) return;
          for (const uid of [c.userIdA, c.userIdB, c.userIdC]) {
            if (!uid) continue;
            const r = await page.request.post(h.base + '/api/admin/update-payment', { headers: adminH(c), data: { userId: uid, months: 1 } });
            if (r.status() >= 500) throw new Error(`update-payment(${uid}) HTTP ${r.status()}`);
          }
        } },
        { label: 'вход A, B, C → токени', run: async (page, c, h) => {
          if (c.rateLimited) return;
          for (const who of ['A', 'B', 'C']) {
            const r = await page.request.post(h.base + '/api/auth/login', { data: { phone: c['phone' + who], password: c.pass, client: 'web' } });
            if (r.status() === 429) { c.rateLimited = true; return; }
            const b = await jsonOf(r);
            if (r.status() >= 500) throw new Error(`login ${who} HTTP ${r.status()} ${b.error || ''}`);
            if (!b.token) throw new Error(`няма токен за ${who}: ${JSON.stringify(b).slice(0, 120)}`);
            c['token' + who] = b.token;
          }
        } },
      ],
    },
    {
      name: 'SERVICE-CATEGORIES: верифицируемите услуги НЕ са в публичните offerings',
      steps: [
        { label: 'GET /api/profile/service-categories → структура + Болница/Лекар НЕ са публични', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/profile/service-categories', { headers: bearer(c.tokenA) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('service-categories HTTP ' + r.status());
          if (!b.all || !Array.isArray(b.public_offerings) || !Array.isArray(b.need_services)) {
            throw new Error('service-categories: липсва all/public_offerings/need_services');
          }
          const leaked = ['Doctor', 'Hospital', 'Ambulance', 'Police'].filter(s => b.public_offerings.includes(s));
          if (leaked.length) throw new Error('верифицируеми услуги изтичат в публичните offerings: ' + leaked.join(', '));
        } },
      ],
    },
    {
      name: 'ВЕРИФИКАЦИЯ — кандидатстване: валидации + ВАЛИДНА заявка (с документ)',
      steps: [
        { label: 'apply без токен → 401', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/verification/apply', { multipart: { requested_services: 'Hospital', org_name: 'Без токен' } });
          if (r.status() >= 500) throw new Error('apply без токен гръмна HTTP ' + r.status());
          if (r.status() !== 401) throw new Error('apply без токен: очаквах 401, върна ' + r.status());
        } },
        { label: 'apply празни услуги → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/verification/apply', { headers: bearer(c.tokenA), multipart: { requested_services: '', org_name: 'Болница' } });
          if (r.status() >= 500) throw new Error('apply празни услуги гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('apply празни услуги: очаквах 400, върна ' + r.status());
        } },
        { label: 'apply НЕвалидна (не-верифицируема) услуга → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/verification/apply', { headers: bearer(c.tokenA), multipart: { requested_services: 'Plumber', org_name: 'Болница' } });
          if (r.status() >= 500) throw new Error('apply невалидна услуга гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('apply невалидна услуга: очаквах 400, върна ' + r.status());
        } },
        { label: 'apply без име на организация → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/verification/apply', { headers: bearer(c.tokenA), multipart: { requested_services: 'Hospital', org_name: '' } });
          if (r.status() >= 500) throw new Error('apply без име гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('apply без име: очаквах 400, върна ' + r.status());
        } },
        { label: 'ВАЛИДНА заявка A (Болница+Лекар) с прикачен документ → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/verification/apply', { headers: bearer(c.tokenA), multipart: {
            requested_services: 'Hospital,Doctor',
            org_name: c.orgA,
            license_number: 'LIC-' + c.runToken,
            contact_phone: c.phoneA,
            contact_email: 'robot@example.com',
            address: 'ул. Тестова 1, София',
            details: 'Робот тест заявка за верификация.',
            document: pngFile('license.png'),
          } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`валидна заявка A HTTP ${r.status()} ${b.error || ''}`);
          c.verRequestA = b.request_id;
        } },
        { label: 'apply повторно (A вече има висяща) → 409', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/verification/apply', { headers: bearer(c.tokenA), multipart: { requested_services: 'Hospital', org_name: c.orgA } });
          if (r.status() >= 500) throw new Error('apply дубликат гръмна HTTP ' + r.status());
          if (r.status() !== 409) throw new Error('apply дубликат: очаквах 409, върна ' + r.status());
        } },
        { label: 'GET /api/verification/my (A) → висяща заявка', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/verification/my', { headers: bearer(c.tokenA) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('verification/my HTTP ' + r.status());
          if (!b.request || b.request.status !== 'pending') throw new Error('verification/my: очаквах висяща заявка, върна ' + JSON.stringify(b.request || null).slice(0, 120));
        } },
        { label: 'ВАЛИДНА заявка B (Полиция) → success (за теста на отказ)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/verification/apply', { headers: bearer(c.tokenB), multipart: {
            requested_services: 'Police', org_name: c.orgB, details: 'Робот заявка Б за отказ.',
          } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`валидна заявка B HTTP ${r.status()} ${b.error || ''}`);
          c.verRequestB = b.request_id;
        } },
      ],
    },
    {
      name: 'ВЕРИФИКАЦИЯ — админ: списък, документ, ОДОБРИ A, ОТКАЖИ B, повторно → 409',
      steps: [
        { label: 'админ списък ?status=pending → съдържа A и B', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/admin/verification-requests?status=pending', { headers: adminH(c) });
          if (r.status() === 401 || r.status() === 403) { c.adminNoAccess = true; return; }
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('verification-requests HTTP ' + r.status());
          const rows = b.requests || [];
          // подсигури ID-тата от списъка по име на организацията (надеждно и при двата диалекта)
          const findBy = (org) => { const row = rows.find(x => x.org_name === org); return row ? row.id : null; };
          c.verRequestA = c.verRequestA || findBy(c.orgA);
          c.verRequestB = c.verRequestB || findBy(c.orgB);
          if (!c.verRequestA) throw new Error('заявката на A липсва в pending списъка');
        } },
        { label: 'админ сваля документа на A → 200', run: async (page, c, h) => {
          if (blocked(c) || c.adminNoAccess || !c.verRequestA) return;
          const r = await page.request.get(h.base + '/api/admin/verification-requests/' + c.verRequestA + '/document', { headers: adminH(c) });
          if (r.status() >= 500) throw new Error('сваляне на документ гръмна HTTP ' + r.status());
          if (r.status() !== 200) throw new Error('сваляне на документ: очаквах 200 (прикачихме документ), върна ' + r.status());
        } },
        { label: 'админ ОДОБРИ A → потребителят става верифициран + offerings', run: async (page, c, h) => {
          if (blocked(c) || c.adminNoAccess || !c.verRequestA) return;
          const r = await page.request.put(h.base + '/api/admin/verification-requests/' + c.verRequestA + '/approve', { headers: adminH(c), data: { reviewed_by: 'робот-админ' } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`approve A HTTP ${r.status()} ${b.error || ''}`);
          // провери, че A е верифициран (през собствения му профил)
          const pr = await page.request.get(h.base + '/api/profile', { headers: bearer(c.tokenA) });
          const pb = await jsonOf(pr);
          if (!pr.ok()) throw new Error('profile след одобрение HTTP ' + pr.status());
          const verified = pb.is_verified || (pb.user && pb.user.is_verified);
          if (!verified) throw new Error('A не е верифициран след одобрение (is_verified фалшиво)');
        } },
        { label: 'админ повторно ОДОБРИ A → 409 (вече обработена)', run: async (page, c, h) => {
          if (blocked(c) || c.adminNoAccess || !c.verRequestA) return;
          const r = await page.request.put(h.base + '/api/admin/verification-requests/' + c.verRequestA + '/approve', { headers: adminH(c), data: { reviewed_by: 'робот-админ' } });
          if (r.status() >= 500) throw new Error('повторно approve гръмна HTTP ' + r.status());
          if (r.status() !== 409) throw new Error('повторно approve: очаквах 409, върна ' + r.status());
        } },
        { label: 'админ ОТКАЖИ B (с бележка) → success', run: async (page, c, h) => {
          if (blocked(c) || c.adminNoAccess || !c.verRequestB) return;
          const r = await page.request.put(h.base + '/api/admin/verification-requests/' + c.verRequestB + '/reject', { headers: adminH(c), data: { admin_notes: 'Робот тест отказ — липсва лиценз.', reviewed_by: 'робот-админ' } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`reject B HTTP ${r.status()} ${b.error || ''}`);
        } },
      ],
    },
    {
      name: 'СИГНАЛИ — реално подаване (снимка) + валидации',
      steps: [
        { label: 'GET /api/signals/can-submit (A)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/signals/can-submit', { headers: bearer(c.tokenA) });
          if (r.status() >= 500) throw new Error('can-submit HTTP ' + r.status());
        } },
        { label: 'submit без снимка → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/signals/submit', { headers: bearer(c.tokenA), multipart: {
            signal_type: 'Pharmacy', title: 'Без снимка', latitude: '42.6977', longitude: '23.3219',
          } });
          if (r.status() >= 500) throw new Error('submit без снимка гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('submit без снимка: очаквах 400, върна ' + r.status());
        } },
        { label: 'submit без заглавие → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/signals/submit', { headers: bearer(c.tokenA), multipart: {
            signal_type: 'Pharmacy', title: '', latitude: '42.6977', longitude: '23.3219', photo: pngFile('p.png'),
          } });
          if (r.status() >= 500) throw new Error('submit без заглавие гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('submit без заглавие: очаквах 400, върна ' + r.status());
        } },
        { label: 'ВАЛИДНО подаване A (Аптека + снимка) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          c.titleA = 'Робот аптека ' + c.runToken;
          const r = await page.request.post(h.base + '/api/signals/submit', { headers: bearer(c.tokenA), multipart: {
            signal_type: 'Pharmacy', title: c.titleA, working_hours: '08:00-20:00',
            latitude: '42.6977', longitude: '23.3219', photo: pngFile('pharmacy.png'),
          } });
          const b = await jsonOf(r);
          if (r.status() === 429) { c.signalDoneA = false; return; } // вече подал днес — приемливо при повтаряне
          if (!r.ok() || !b.success) throw new Error(`submit A HTTP ${r.status()} ${b.error || ''}`);
          c.signalDoneA = true;
        } },
        { label: 'втори сигнал за деня (A) → 429', run: async (page, c, h) => {
          if (blocked(c) || !c.signalDoneA) return;
          const r = await page.request.post(h.base + '/api/signals/submit', { headers: bearer(c.tokenA), multipart: {
            signal_type: 'Bar', title: 'Втори за деня', latitude: '42.70', longitude: '23.32', photo: pngFile('p2.png'),
          } });
          if (r.status() >= 500) throw new Error('втори сигнал гръмна HTTP ' + r.status());
          if (r.status() !== 429) throw new Error('втори сигнал за деня: очаквах 429, върна ' + r.status());
        } },
        { label: 'ВАЛИДНО подаване B (Бар + снимка) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          c.titleB = 'Робот бар ' + c.runToken;
          const r = await page.request.post(h.base + '/api/signals/submit', { headers: bearer(c.tokenB), multipart: {
            signal_type: 'Bar', title: c.titleB, latitude: '42.6980', longitude: '23.3225', photo: pngFile('bar.png'),
          } });
          const b = await jsonOf(r);
          if (r.status() === 429) { c.signalDoneB = false; return; }
          if (!r.ok() || !b.success) throw new Error(`submit B HTTP ${r.status()} ${b.error || ''}`);
          c.signalDoneB = true;
        } },
      ],
    },
    {
      name: 'СИГНАЛИ — админ модерация: pending списък, ОТКАЖИ B, ОДОБРИ A, повторно → 400',
      steps: [
        { label: 'админ /api/signals/admin/pending → намери ID-тата по заглавие', run: async (page, c, h) => {
          if (blocked(c)) return;
          if (!c.adminToken) { c.sigAdminSkip = true; return; } // сигналите-админ искат staff токен
          const r = await page.request.get(h.base + '/api/signals/admin/pending', { headers: bearer(c.adminToken) });
          if (r.status() === 401 || r.status() === 403) { c.sigAdminSkip = true; return; }
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('signals/admin/pending HTTP ' + r.status());
          const rows = b.signals || [];
          const findBy = (t) => { const row = rows.find(x => x.title === t); return row ? row.id : null; };
          if (c.signalDoneA) c.signalIdA = findBy(c.titleA);
          if (c.signalDoneB) c.signalIdB = findBy(c.titleB);
        } },
        { label: 'админ ОТКАЖИ сигнала на B (нулира деня) → success', run: async (page, c, h) => {
          if (blocked(c) || c.sigAdminSkip || !c.signalIdB) return;
          const r = await page.request.post(h.base + '/api/signals/admin/reject/' + c.signalIdB, { headers: bearer(c.adminToken), data: { reason: 'Робот тест — дубликат.' } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`reject signal B HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'админ ОДОБРИ сигнала на A → създава статичен обект', run: async (page, c, h) => {
          if (blocked(c) || c.sigAdminSkip || !c.signalIdA) return;
          const r = await page.request.post(h.base + '/api/signals/admin/approve/' + c.signalIdA, { headers: bearer(c.adminToken) });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`approve signal A HTTP ${r.status()} ${b.error || ''}`);
          if (!b.staticObject || !b.staticObject.id) throw new Error('approve signal A: не върна създадения статичен обект');
        } },
        { label: 'админ повторно ОДОБРИ A → 400 (вече обработен)', run: async (page, c, h) => {
          if (blocked(c) || c.sigAdminSkip || !c.signalIdA) return;
          const r = await page.request.post(h.base + '/api/signals/admin/approve/' + c.signalIdA, { headers: bearer(c.adminToken) });
          if (r.status() >= 500) throw new Error('повторно approve signal гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('повторно approve signal: очаквах 400, върна ' + r.status());
        } },
      ],
    },
    {
      name: 'UI „като човек": попълни formата verification.html + регресия на падащото меню в signal.html',
      steps: [
        { label: 'C попълва и ИЗПРАЩА формата за верификация (UI бутон)', run: async (page, c, h) => {
          if (c.rateLimited || !c.tokenC) return;
          // verification.html пренасочва към index.html без токен → зареди първо същия произход, после сложи токена.
          await page.goto(h.base + '/chat/', { waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.evaluate((t) => { try { localStorage.setItem('token', t); } catch (e) {} }, c.tokenC);
          await page.goto(h.base + '/chat/public/verification.html', { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.svc-check', { timeout: 8000 });
          // ако вече е останала висяща заявка от предишно пускане → бутонът е disabled (легитимно), пропусни тихо
          const disabled = await page.evaluate(() => { const b = document.getElementById('submitBtn'); return !!(b && b.disabled); }).catch(() => false);
          if (disabled) return;
          await page.check('.svc-check >> nth=0').catch(() => {}); // първата услуга (Лекар)
          await page.fill('#orgName', 'Робот UI кабинет ' + c.runToken);
          await page.click('#submitBtn');
          // изчакай резултат: зелено (успех) ИЛИ червено (валиден отказ, напр. 409 дубликат) — но НЕ да виси
          await page.waitForFunction(() => { const m = document.getElementById('formMsg'); return m && /✅|⚠️/.test(m.textContent); }, { timeout: 9000 }).catch(() => {});
          const msg = await page.textContent('#formMsg').catch(() => '');
          if (!/✅|⚠️/.test(msg || '')) throw new Error('UI формата за верификация не върна резултат (нито успех, нито отказ)');
        } },
        { label: 'signal.html: падащото меню НЕ показва суровия литерал „KCY_I18N.t("', run: async (page, c, h) => {
          if (c.rateLimited || !c.tokenA) return;
          await page.evaluate((t) => { try { localStorage.setItem('token', t); } catch (e) {} }, c.tokenA).catch(() => {});
          await page.goto(h.base + '/chat/public/signal.html', { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('#signalType optgroup', { timeout: 8000 }).catch(() => {});
          const labels = await page.$$eval('#signalType optgroup', els => els.map(e => e.getAttribute('label') || '')).catch(() => []);
          const broken = labels.filter(l => /KCY_I18N\.t\(/.test(l));
          if (broken.length) throw new Error('падащото меню показва суров литерал вместо превод: ' + broken.join(' | '));
          if (!labels.length) throw new Error('signal.html: няма групи в падащото меню (#signalType optgroup)');
        } },
      ],
    },
    {
      name: 'Изход (A, B, C)',
      steps: [
        { label: 'logout A, B, C', run: async (page, c, h) => {
          for (const who of ['A', 'B', 'C']) {
            if (c['token' + who]) await page.request.post(h.base + '/api/auth/logout', { headers: bearer(c['token' + who]) }).catch(() => {});
          }
        } },
      ],
    },
  ],
};
