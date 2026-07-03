// Version: 1.0001
// Чат — АДМИН МОДЕРАЦИЯ: УСПЕШНИЯТ път на ендпойнтите, които другите журита НЕ покриват.
// Всичко е САМОСТОЯТЕЛНО: роботът сам си създава потребители A и B и сам си създава
// предусловията (приятелство, съобщение, плащане, спешна заявка, задача-спор, сигнал),
// после АДМИН действа върху тях. Целта е реалният успешен сценарий, не само отказите.
//
// Покрива (за всеки: ПЪРВО предусловие през потребителския API, ПОСЛЕ админ действие):
//   1) edit-message: A↔B приятелство (покана+приемане) + A праща съобщение →
//      админ POST /api/admin/edit-message сменя текста → проверка през GET /api/messages/:B.
//   2) mark-unpaid: админ маркира A неплатен (след update-payment) → success.
//   3) capture-location: админ POST /api/admin/capture-location за A → success + location.
//   4) HELP: A (платен) пуска POST /api/help/emergency → админ GET /api/admin/help-requests,
//      GET .../:id/nearby-services, PUT .../:id/resolve.
//   5) ЗАДАЧИ спор→бан: A създава+публикува 2 задачи, B ги хваща (free_mode), заключва,
//      готово, report-nonpayment → админ GET /api/admin/task-disputes,
//      POST /api/admin/task-ban (1-вата), POST /api/admin/task-dispute-dismiss (2-рата).
//   6) СИГНАЛИ остарели: A подава сигнал (multipart PNG) → админ ОДОБРИ (създава статичен
//      обект) → админ POST /api/signals/admin/obsolete/:signalId (нов сигнал, същият тип/място).
//   7) Legacy верификация: PUT /api/admin/users/:id/verify → /offerings → /unverify за A;
//      проверка на is_verified през GET /api/profile.
//   8) Админ табла (само 200 + структура, без 500): stats, flagged-users, all-users,
//      users-with-messages, user-details/:id.
//   9) payment-override: GET .../user/:phone, POST .../apply (grant дни), GET .../history.
//
// Админ достъп: на VM по IP (без токен), на прод по админ токен от .env. Ако няма нито токен,
// нито IP-достъп → adminSkip и админ стъпките се връщат тихо (НЕ е провал). Никога не
// гръмваме при коректен статус; гръмваме само при >=500 или при разминаване от очакваното.
'use strict';
const zlib = require('zlib');

// ── мъничък валиден PNG в кода (за снимка на сигнал) — без външни файлове ──
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
const PNG = makePng(40, 40, [90, 130, 170]);
const pngFile = (name) => ({ name, mimeType: 'image/png', buffer: PNG });

const bearer = (t) => ({ Authorization: 'Bearer ' + (t || '') });
const adminH = (c) => (c.adminToken ? bearer(c.adminToken) : {}); // VM: по IP; прод: по токен
const blocked = (c) => c.rateLimited || !c.tokenA || !c.tokenB;
const jsonOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };
// Админ е недостъпен (нито токен, нито IP) → пропусни админ частта грациозно (не провал).
const noAdmin = (c) => c.adminSkip;

module.exports = {
  app: 'chat',
  label: 'Чат АДМИН модерация — edit/ban/resolve/verify/override/обяви остарели',
  writes: true,
  setup(ctx, env) {
    // Уникални телефони с префикс +96 (различни от другите чат журита: +93/+94).
    ctx.phoneA = '+96' + String(100000000 + (ctx.runNum % 800000000));
    ctx.phoneB = '+96' + String(100000000 + ((ctx.runNum + 13) % 800000000));
    ctx.pass = 'Robot12345!';
    ctx.nameA = 'Робот Админ А';
    ctx.nameB = 'Робот Админ Б';
    ctx.adminUser = (env && (env.CHAT_ADMIN_USER || env.CHAT_MOD1)) || '';
    ctx.adminPass = (env && (env.CHAT_ADMIN_PASS || env.CHAT_MOD1_PASS)) || '';
  },
  scenarios: [
    {
      name: 'Подготовка: A, B (API) → админ-вход → платени → вход → токени',
      steps: [
        { label: 'регистрирай A и B', run: async (page, c, h) => {
          for (const who of ['A', 'B']) {
            const r = await page.request.post(h.base + '/api/auth/register', { data: {
              phone: c['phone' + who], password: c.pass, fullName: c['name' + who],
              gender: who === 'B' ? 'female' : 'male', heightCm: 180, weightKg: 76,
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
        { label: 'провери админ достъп (токен ИЛИ IP) → иначе adminSkip', run: async (page, c, h) => {
          if (c.rateLimited) return;
          // Лек сонда: GET /api/admin/stats. 200 → имаме достъп (по токен или IP).
          // 401/403 → нямаме → пропускаме всички админ стъпки грациозно.
          const r = await page.request.get(h.base + '/api/admin/stats', { headers: adminH(c) });
          if (r.status() === 401 || r.status() === 403) { c.adminSkip = true; return; }
          if (r.status() >= 500) throw new Error('admin/stats сонда гръмна HTTP ' + r.status());
        } },
        { label: 'админ: маркирай A и B платени', run: async (page, c, h) => {
          if (c.rateLimited || noAdmin(c)) return;
          for (const uid of [c.userIdA, c.userIdB]) {
            if (!uid) continue;
            const r = await page.request.post(h.base + '/api/admin/update-payment', { headers: adminH(c), data: { userId: uid, months: 1 } });
            if (r.status() >= 500) throw new Error(`update-payment(${uid}) HTTP ${r.status()}`);
            const b = await jsonOf(r);
            if (!b.success) throw new Error(`update-payment(${uid}) не успя: HTTP ${r.status()} ${b.error || ''}`);
          }
          c.paid = true;
        } },
        { label: 'вход A и B → токени', run: async (page, c, h) => {
          if (c.rateLimited) return;
          for (const who of ['A', 'B']) {
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
      name: 'EDIT-MESSAGE: A↔B приятелство + A праща съобщение → админ сменя текста',
      steps: [
        { label: 'A кани B, B приема → приятелство (за да може чат)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const ri = await page.request.post(h.base + '/api/matchmaking/invite', { headers: bearer(c.tokenA), data: { receiverId: c.userIdB } });
          if (ri.status() >= 500) throw new Error('invite HTTP ' + ri.status());
          const bi = await jsonOf(ri);
          if (!(bi.success || /already/i.test(bi.error || ''))) throw new Error(`invite не успя: ${JSON.stringify(bi).slice(0, 120)}`);
          // B намира получената покана и я приема (създава приятелство в queries-а на accept)
          const rr = await page.request.get(h.base + '/api/matchmaking/invitations/received', { headers: bearer(c.tokenB) });
          const br = await jsonOf(rr);
          const inv = (br.invitations || []).find(i => Number(i.sender_id) === Number(c.userIdA));
          if (inv && inv.id) {
            const ra = await page.request.post(h.base + '/api/matchmaking/invitations/' + inv.id + '/accept', { headers: bearer(c.tokenB) });
            if (ra.status() >= 500) throw new Error('accept HTTP ' + ra.status());
            const ba = await jsonOf(ra);
            if (ba.success || /accepted/i.test(ba.message || '')) c.friends = true;
          } else {
            // поканата може вече да е приета от предишно пускане → приятелството съществува
            c.friends = true;
          }
        } },
        { label: 'A праща съобщение до B → пазим messageId', run: async (page, c, h) => {
          if (blocked(c) || !c.friends) return;
          c.origText = 'Робот оригинал ' + c.runToken;
          const r = await page.request.post(h.base + '/api/messages/' + c.userIdB, { headers: bearer(c.tokenA), data: { text: c.origText } });
          const b = await jsonOf(r);
          if (r.status() >= 500) throw new Error('изпращане на съобщение гръмна HTTP ' + r.status());
          if (!b.success || !b.messageId) { c.msgSkip = true; return; } // напр. лимит/неприятели → пропусни тихо
          c.messageId = b.messageId;
        } },
        { label: 'админ edit-message → сменя текста (success)', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.messageId) return;
          c.newText = 'Робот РЕДАКТИРАН ' + c.runToken;
          const r = await page.request.post(h.base + '/api/admin/edit-message', { headers: adminH(c), data: { messageId: c.messageId, newText: c.newText } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`edit-message HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'проверка: разговорът A↔B вече показва редактирания текст', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.messageId) return;
          const r = await page.request.get(h.base + '/api/messages/' + c.userIdB, { headers: bearer(c.tokenA) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('GET messages след edit HTTP ' + r.status());
          const texts = (b.messages || []).map(m => m.text);
          if (!texts.includes(c.newText)) throw new Error('редактираният текст не се вижда в разговора');
          if (texts.includes(c.origText)) throw new Error('оригиналният текст още стои — редакцията не е приложена');
        } },
      ],
    },
    {
      name: 'MARK-UNPAID + CAPTURE-LOCATION (върху A)',
      steps: [
        { label: 'админ mark-unpaid за A → success', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.userIdA) return;
          const r = await page.request.post(h.base + '/api/admin/mark-unpaid', { headers: adminH(c), data: { userId: c.userIdA } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`mark-unpaid HTTP ${r.status()} ${b.error || ''}`);
          c.aMarkedUnpaid = true;
        } },
        { label: 'възстанови платения статус на A (за по-нататъшните стъпки)', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.userIdA || !c.aMarkedUnpaid) return;
          const r = await page.request.post(h.base + '/api/admin/update-payment', { headers: adminH(c), data: { userId: c.userIdA, months: 1 } });
          if (r.status() >= 500) throw new Error('повторно update-payment(A) HTTP ' + r.status());
        } },
        { label: 'админ capture-location за A → success + location', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.userIdA) return;
          const r = await page.request.post(h.base + '/api/admin/capture-location', { headers: adminH(c), data: {
            userId: c.userIdA, latitude: 42.6977, longitude: 23.3219,
            country: 'България', city: 'София', village: null, street: 'ул. Тестова', number: '1', ip: '203.0.113.7',
          } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`capture-location HTTP ${r.status()} ${b.error || ''}`);
          if (!b.location) throw new Error('capture-location: липсва location в отговора');
        } },
      ],
    },
    {
      name: 'HELP: A пуска спешна заявка → админ списък/услуги/реши',
      steps: [
        { label: 'A (платен) пуска POST /api/help/emergency → запомни request_id', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/help/emergency', { headers: bearer(c.tokenA), data: { latitude: 42.6977, longitude: 23.3219 } });
          const b = await jsonOf(r);
          if (r.status() >= 500) throw new Error('emergency гръмна HTTP ' + r.status());
          // 200 → създадена; 429 „веднъж месечно" / 403 „недостатъчен абонамент" → легитимно, без request_id
          if (r.status() === 200 && b.success) { c.helpReqId = b.request_id; c.helpDone = true; }
          else if (![429, 403].includes(r.status())) throw new Error('emergency: неочакван HTTP ' + r.status());
        } },
        { label: 'админ GET /api/admin/help-requests → намери заявката на A', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c)) return;
          const r = await page.request.get(h.base + '/api/admin/help-requests', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('help-requests HTTP ' + r.status());
          if (!Array.isArray(b.requests)) throw new Error('help-requests: липсва масив requests');
          // ако сме създали заявка → трябва да е в списъка; иначе вземи най-новата на A по телефон
          if (c.helpReqId && !b.requests.some(x => Number(x.id) === Number(c.helpReqId))) {
            throw new Error('създадената спешна заявка липсва в админ списъка');
          }
          if (!c.helpReqId) {
            const mine = b.requests.find(x => x.phone === c.phoneA);
            if (mine) c.helpReqId = mine.id;
          }
        } },
        { label: 'админ GET nearby-services за заявката → 200 + структура', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.helpReqId) return;
          const r = await page.request.get(h.base + '/api/admin/help-requests/' + c.helpReqId + '/nearby-services', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('nearby-services HTTP ' + r.status());
          if (!b.request || !Array.isArray(b.nearby_services)) throw new Error('nearby-services: липсва request/nearby_services');
        } },
        { label: 'админ PUT resolve за заявката → success', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.helpReqId) return;
          const r = await page.request.put(h.base + '/api/admin/help-requests/' + c.helpReqId + '/resolve', { headers: adminH(c), data: { admin_notes: 'Робот тест — обработено.' } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`resolve HTTP ${r.status()} ${b.error || ''}`);
        } },
      ],
    },
    {
      name: 'ЗАДАЧИ спор→бан: 2 задачи (B хваща/готово/докладва) → админ бан + отхвърли',
      steps: [
        { label: 'A създава + публикува 2 задачи (BG, free_mode)', run: async (page, c, h) => {
          if (blocked(c)) return;
          c.taskIds = [];
          for (let i = 0; i < 2; i++) {
            const cr = await page.request.post(h.base + '/api/tasks', { headers: bearer(c.tokenA), data: {
              type: 'local_hands', country: 'България', city: 'София',
              title: 'Робот спор ' + (i + 1) + ' ' + c.runToken, content: 'Тестова задача за спор.',
              reward_amount: 50, reward_currency: 'EUR',
            } });
            const cb = await jsonOf(cr);
            if (cr.status() !== 201 || !cb.id) throw new Error(`create task ${i + 1} HTTP ${cr.status()} ${cb.error || ''}`);
            const pr = await page.request.post(h.base + '/api/tasks/' + cb.id + '/publish', { headers: bearer(c.tokenA) });
            if (!pr.ok()) throw new Error(`publish task ${i + 1} HTTP ${pr.status()}`);
            c.taskIds.push(cb.id);
          }
        } },
        { label: 'B хваща→заключва→готово→докладва неплащане (за всяка)', run: async (page, c, h) => {
          if (blocked(c) || !c.taskIds || !c.taskIds.length) return;
          c.disputedTasks = [];
          for (const id of c.taskIds) {
            const tk = await page.request.post(h.base + '/api/tasks/' + id + '/take', { headers: bearer(c.tokenB) });
            if (tk.status() >= 500) throw new Error('take HTTP ' + tk.status());
            const tb = await jsonOf(tk);
            if (tb.payment_required) { c.taskNeedsPay = true; continue; } // не е free → не можем да направим спор тук
            if (!tb.ok) throw new Error(`take не успя: ${JSON.stringify(tb).slice(0, 120)}`);
            const lk = await page.request.post(h.base + '/api/tasks/' + id + '/lock', { headers: bearer(c.tokenB) });
            if (!lk.ok()) throw new Error('lock HTTP ' + lk.status());
            const dn = await page.request.post(h.base + '/api/tasks/' + id + '/done', { headers: bearer(c.tokenB), data: { report: 'Готово.' } });
            if (!dn.ok()) throw new Error('done HTTP ' + dn.status());
            const rp = await page.request.post(h.base + '/api/tasks/' + id + '/report-nonpayment', { headers: bearer(c.tokenB) });
            if (!rp.ok()) throw new Error('report-nonpayment HTTP ' + rp.status());
            c.disputedTasks.push(id);
          }
        } },
        { label: 'админ GET /api/admin/task-disputes → съдържа нашите спорове', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.disputedTasks || !c.disputedTasks.length) return;
          const r = await page.request.get(h.base + '/api/admin/task-disputes', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('task-disputes HTTP ' + r.status());
          const ids = (b.disputes || []).map(d => Number(d.id));
          if (!c.disputedTasks.every(id => ids.includes(Number(id)))) throw new Error('спор(ове)те ни липсват в списъка task-disputes');
        } },
        { label: 'админ POST /api/admin/task-ban (1-вата задача) → банва автора', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.disputedTasks || !c.disputedTasks.length) return;
          const r = await page.request.post(h.base + '/api/admin/task-ban', { headers: adminH(c), data: { taskId: c.disputedTasks[0] } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`task-ban HTTP ${r.status()} ${b.error || ''}`);
          if (b.banned !== c.phoneA) throw new Error('task-ban: баннатият телефон не е на автора A');
          c.aBanned = true;
        } },
        { label: 'админ POST /api/admin/task-dispute-dismiss (2-рата) → success', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.disputedTasks || c.disputedTasks.length < 2) return;
          const r = await page.request.post(h.base + '/api/admin/task-dispute-dismiss', { headers: adminH(c), data: { taskId: c.disputedTasks[1] } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`task-dispute-dismiss HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'почистване: отблокирай A (ако сме го баннали)', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.aBanned || !c.userIdA) return;
          const r = await page.request.post(h.base + '/api/admin/unblock-user', { headers: adminH(c), data: { userId: c.userIdA } });
          if (r.status() >= 500) throw new Error('unblock-user HTTP ' + r.status());
        } },
      ],
    },
    {
      name: 'СИГНАЛИ: A подава → админ ОДОБРИ (статичен обект) → админ обяви остарял',
      steps: [
        { label: 'A подава сигнал (Аптека + снимка) → success/429', run: async (page, c, h) => {
          if (blocked(c)) return;
          c.sigTitle = 'Робот аптека-админ ' + c.runToken;
          c.sigLat = '42.6981'; c.sigLng = '23.3221';
          const r = await page.request.post(h.base + '/api/signals/submit', { headers: bearer(c.tokenA), multipart: {
            signal_type: 'Pharmacy', title: c.sigTitle, working_hours: '09:00-21:00',
            latitude: c.sigLat, longitude: c.sigLng, photo: pngFile('pharmacy.png'),
          } });
          const b = await jsonOf(r);
          if (r.status() === 429) { c.sigSkip = true; return; } // вече подал днес — приемливо
          if (!r.ok() || !b.success) throw new Error(`signal submit HTTP ${r.status()} ${b.error || ''}`);
          c.signalId = b.signalId;
        } },
        { label: 'админ намира сигнала в pending → потвърждава ID', run: async (page, c, h) => {
          if (blocked(c) || c.sigSkip) return;
          if (!c.adminToken) { c.sigAdminSkip = true; return; } // сигналите-админ искат staff токен (не само IP)
          const r = await page.request.get(h.base + '/api/signals/admin/pending', { headers: bearer(c.adminToken) });
          if (r.status() === 401 || r.status() === 403) { c.sigAdminSkip = true; return; }
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('signals/admin/pending HTTP ' + r.status());
          const row = (b.signals || []).find(x => x.title === c.sigTitle);
          if (row) c.signalId = row.id;
          if (!c.signalId) throw new Error('сигналът на A липсва в pending списъка');
        } },
        { label: 'админ ОДОБРИ сигнала на A → създава статичен обект', run: async (page, c, h) => {
          if (blocked(c) || c.sigSkip || c.sigAdminSkip || !c.signalId) return;
          const r = await page.request.post(h.base + '/api/signals/admin/approve/' + c.signalId, { headers: bearer(c.adminToken) });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`approve signal HTTP ${r.status()} ${b.error || ''}`);
          if (!b.staticObject || !b.staticObject.id) throw new Error('approve: не върна създадения статичен обект');
          c.staticObjId = b.staticObject.id;
        } },
        { label: 'A подава ВТОРИ сигнал (нов ден би трябвало) → за „остарял"', run: async (page, c, h) => {
          if (blocked(c) || c.sigSkip || c.sigAdminSkip || !c.staticObjId) return;
          // вторият сигнал в същия ден връща 429 — тогава пропускаме „остаряването" тихо.
          const r = await page.request.post(h.base + '/api/signals/submit', { headers: bearer(c.tokenA), multipart: {
            signal_type: 'Pharmacy', title: c.sigTitle + ' (остарял)', latitude: c.sigLat, longitude: c.sigLng, photo: pngFile('obsolete.png'),
          } });
          const b = await jsonOf(r);
          if (r.status() === 429) { c.obsSkip = true; return; }
          if (!r.ok() || !b.success) throw new Error(`втори сигнал HTTP ${r.status()} ${b.error || ''}`);
          c.obsoleteSignalId = b.signalId;
        } },
        { label: 'админ POST /api/signals/admin/obsolete/:id → изтрива съвпадащия обект', run: async (page, c, h) => {
          if (blocked(c) || c.sigSkip || c.sigAdminSkip || c.obsSkip || !c.obsoleteSignalId) return;
          const r = await page.request.post(h.base + '/api/signals/admin/obsolete/' + c.obsoleteSignalId, { headers: bearer(c.adminToken) });
          const b = await jsonOf(r);
          if (r.status() >= 500) throw new Error('obsolete гръмна HTTP ' + r.status());
          if (!r.ok()) throw new Error('obsolete HTTP ' + r.status());
          // success:true (изтрит единствен съвпадащ обект) ИЛИ success:false (0/няколко съвпадения) — и двете са валидни,
          // важно е да не е 500 и да върне очаквания контракт.
          if (typeof b.success !== 'boolean') throw new Error('obsolete: липсва булев success в отговора');
        } },
      ],
    },
    {
      name: 'LEGACY верификация: verify → offerings → unverify (върху A) + проверка',
      steps: [
        { label: 'админ PUT /users/:id/verify (offerings) → success + is_verified', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.userIdA) return;
          const r = await page.request.put(h.base + '/api/admin/users/' + c.userIdA + '/verify', { headers: adminH(c), data: { offerings: 'Hospital,Doctor' } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`users/:id/verify HTTP ${r.status()} ${b.error || ''}`);
          const pr = await page.request.get(h.base + '/api/profile', { headers: bearer(c.tokenA) });
          const pb = await jsonOf(pr);
          if (!pr.ok()) throw new Error('profile след verify HTTP ' + pr.status());
          const verified = pb.is_verified || (pb.user && pb.user.is_verified);
          if (!verified) throw new Error('A не е верифициран след legacy verify (is_verified фалшиво)');
        } },
        { label: 'админ PUT /users/:id/offerings → success', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.userIdA) return;
          const r = await page.request.put(h.base + '/api/admin/users/' + c.userIdA + '/offerings', { headers: adminH(c), data: { offerings: 'Hospital' } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`users/:id/offerings HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'админ PUT /users/:id/unverify → success + is_verified пада', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.userIdA) return;
          const r = await page.request.put(h.base + '/api/admin/users/' + c.userIdA + '/unverify', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`users/:id/unverify HTTP ${r.status()} ${b.error || ''}`);
          const pr = await page.request.get(h.base + '/api/profile', { headers: bearer(c.tokenA) });
          const pb = await jsonOf(pr);
          if (!pr.ok()) throw new Error('profile след unverify HTTP ' + pr.status());
          const verified = pb.is_verified || (pb.user && pb.user.is_verified);
          if (verified) throw new Error('A още е верифициран след unverify (is_verified не падна)');
        } },
      ],
    },
    {
      name: 'АДМИН ТАБЛА: stats/flagged-users/all-users/users-with-messages/user-details (200 + структура)',
      steps: [
        { label: 'GET /api/admin/stats → числови полета', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c)) return;
          const r = await page.request.get(h.base + '/api/admin/stats', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('stats HTTP ' + r.status());
          for (const k of ['totalUsers', 'totalMessages', 'helpRequests']) {
            if (typeof b[k] !== 'number') throw new Error('stats: липсва числово поле ' + k);
          }
        } },
        { label: 'GET /api/admin/flagged-users → users[] + pagination', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c)) return;
          const r = await page.request.get(h.base + '/api/admin/flagged-users', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('flagged-users HTTP ' + r.status());
          if (!Array.isArray(b.users) || !b.pagination) throw new Error('flagged-users: липсва users/pagination');
        } },
        { label: 'GET /api/admin/all-users → users[] + pagination', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c)) return;
          const r = await page.request.get(h.base + '/api/admin/all-users', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('all-users HTTP ' + r.status());
          if (!Array.isArray(b.users) || !b.pagination) throw new Error('all-users: липсва users/pagination');
        } },
        { label: 'GET /api/admin/users-with-messages → users[] + pagination', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c)) return;
          const r = await page.request.get(h.base + '/api/admin/users-with-messages', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('users-with-messages HTTP ' + r.status());
          if (!Array.isArray(b.users) || !b.pagination) throw new Error('users-with-messages: липсва users/pagination');
        } },
        { label: 'GET /api/admin/user-details/:id (A) → user + contacts', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.userIdA) return;
          const r = await page.request.get(h.base + '/api/admin/user-details/' + c.userIdA, { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('user-details HTTP ' + r.status());
          if (!b.user || !Array.isArray(b.contacts)) throw new Error('user-details: липсва user/contacts');
        } },
      ],
    },
    {
      name: 'PAYMENT-OVERRIDE: user/:phone → apply (grant дни) → history',
      steps: [
        { label: 'GET /api/admin/payment-override/user/:phone (A) → намери userId', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c)) return;
          const r = await page.request.get(h.base + '/api/admin/payment-override/user/' + encodeURIComponent(c.phoneA), { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('payment-override/user HTTP ' + r.status());
          if (!b.id) throw new Error('payment-override/user: липсва id за A');
          c.overrideUserId = b.id;
        } },
        { label: 'POST /api/admin/payment-override/apply (login, +30 дни) → success', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c) || !c.overrideUserId) return;
          const r = await page.request.post(h.base + '/api/admin/payment-override/apply', { headers: adminH(c), data: {
            userId: c.overrideUserId, action: 'login', days: 30, reason: 'Робот тест override на достъпа.',
          } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`payment-override/apply HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'GET /api/admin/payment-override/history → масив', run: async (page, c, h) => {
          if (blocked(c) || noAdmin(c)) return;
          const r = await page.request.get(h.base + '/api/admin/payment-override/history', { headers: adminH(c) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('payment-override/history HTTP ' + r.status());
          if (!Array.isArray(b)) throw new Error('payment-override/history: очаквах масив');
        } },
      ],
    },
    {
      name: 'Изход (A, B)',
      steps: [
        { label: 'logout A и B', run: async (page, c, h) => {
          for (const who of ['A', 'B']) {
            if (c['token' + who]) await page.request.post(h.base + '/api/auth/logout', { headers: bearer(c['token' + who]) }).catch(() => {});
          }
        } },
      ],
    },
  ],
};
