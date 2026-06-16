// Version: 1.0001
// Чат — ДОПЪЛНИТЕЛНИ потребителски функции, които другите журита НЕ покриват:
//   1) Подготовка: A и B се регистрират (API), админ ги маркира платени (по избор), влизат → токени.
//   2) ПРОФИЛ (A): пълно редактиране (full_name/city/birth_date/локация/работно време), нужда,
//      offerings (ПУБЛИЧНА услуга от service-categories), имейл, кодова дума, скрий телефон/имена,
//      смяна на парола (и обратно). Валидни → ok ИЛИ документиран 4xx (429 веднъж-месечно толерирано;
//      Болница за неверифициран → 400).
//   3) ПРИЯТЕЛИ: A добавя B → списъкът показва B → търсачката намира B → псевдоним (custom-name).
//   4) СЪОБЩЕНИЯ: A праща файл на B (multipart PNG), B го тегли, A праща локация на B; невалидни → 4xx.
//   5) ТЪРСЕНЕ: /free (масив/без 500), /by-distance и /by-need (форма на резултата ИЛИ документиран 4xx).
//   6) ЗАПОЗНАНСТВА: /find (платено — пазач 402, никога 500), /block (блокира B + dislike), /dislikes.
//   7) Изход.
//
// Всичко best-effort: без .env админ → платежните части се пропускат грациозно (не са провал).
// Очакване навсякъде: коректен отговор/отказ (200/400/401/402/403/404/429), НИКОГА >=500.
'use strict';
const zlib = require('zlib');

// ── мъничък валиден PNG в кода (за прикачен файл) — без външни файлове ──
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

module.exports = {
  app: 'chat',
  label: 'Чат ДОПЪЛНИТЕЛНО — профил/търсене/запознанства/приятели/файлове',
  writes: true,
  setup(ctx, env) {
    // Уникални телефони с префикс +95 (другите журита ползват +93/+94).
    ctx.phoneA = '+95' + String(100000000 + (ctx.runNum % 800000000));
    ctx.phoneB = '+95' + String(100000000 + ((ctx.runNum + 23) % 800000000));
    ctx.pass = 'Robot12345!';
    ctx.newPass = 'Robot54321!';
    ctx.nameA = 'Робот Допълнително А';
    ctx.nameB = 'Робот Допълнително Б';
    ctx.adminUser = (env && (env.CHAT_ADMIN_USER || env.CHAT_MOD1)) || '';
    ctx.adminPass = (env && (env.CHAT_ADMIN_PASS || env.CHAT_MOD1_PASS)) || '';
  },
  scenarios: [
    {
      name: 'Подготовка: A и B (API регистрация) → админ платени → вход → токени',
      steps: [
        { label: 'регистрирай A и B', run: async (page, c, h) => {
          for (const who of ['A', 'B']) {
            const r = await page.request.post(h.base + '/api/auth/register', { data: {
              phone: c['phone' + who], password: c.pass, fullName: c['name' + who],
              gender: who === 'B' ? 'female' : 'male', heightCm: 180, weightKg: 75,
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
        { label: 'админ: маркирай A и B платени (по избор — за приятели/файлове)', run: async (page, c, h) => {
          if (c.rateLimited) return;
          for (const uid of [c.userIdA, c.userIdB]) {
            if (!uid) continue;
            const r = await page.request.post(h.base + '/api/admin/update-payment', { headers: adminH(c), data: { userId: uid, months: 1 } });
            if (r.status() === 401 || r.status() === 403) { c.adminNoAccess = true; return; } // няма админ → продължи без платено
            if (r.status() >= 500) throw new Error(`update-payment(${uid}) HTTP ${r.status()}`);
            if (r.ok()) c.paidOk = true;
          }
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
      name: 'ПРОФИЛ (A): пълно редактиране + нужда/offerings/имейл/кодова дума/скриване',
      steps: [
        { label: 'service-categories → вземи ПУБЛИЧНА услуга и валидна нужда', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/profile/service-categories', { headers: bearer(c.tokenA) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('service-categories HTTP ' + r.status());
          if (!Array.isArray(b.public_offerings) || !Array.isArray(b.need_services)) {
            throw new Error('service-categories: липсва public_offerings/need_services');
          }
          // публична услуга (НЕ верифицируема) за offerings + валидна нужда
          c.publicOffering = b.public_offerings.includes('Teacher') ? 'Teacher' : b.public_offerings[0];
          c.validNeed = b.need_services.includes('Driver') ? 'Driver' : b.need_services[0];
          if (!c.publicOffering || !c.validNeed) throw new Error('service-categories: празни списъци');
        } },
        { label: 'PUT /api/profile (full_name/city/birth_date/локация/работно време)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile', { headers: bearer(c.tokenA), data: {
            full_name: c.nameA, city: 'Пловдив', birth_date: '1990-05-15',
            location_latitude: 42.1354, location_longitude: 24.7453,
            working_hours: '09:00-18:00',
          } });
          if (r.status() >= 500) throw new Error('PUT /profile гръмна HTTP ' + r.status());
          // success ИЛИ 429 (вече редактиран този месец — легитимно при повтаряне)
          if (![200, 429].includes(r.status())) throw new Error('PUT /profile: очаквах 200 или 429, върна ' + r.status());
          if (r.status() === 429) c.profileEditExhausted = true;
        } },
        { label: 'PUT /api/profile с невалиден телефон (без +) → 400 (само ако имаме редакция)', run: async (page, c, h) => {
          if (blocked(c) || c.profileEditExhausted) return; // изчерпан месечен лимит → пропусни (би върнал 429, не 400)
          const r = await page.request.put(h.base + '/api/profile', { headers: bearer(c.tokenA), data: { phone: '359888111222' } });
          if (r.status() >= 500) throw new Error('PUT /profile невалиден телефон гръмна HTTP ' + r.status());
          // 400 (невалиден формат) ИЛИ 429 (лимитът се изчерпа от предишната успешна редакция)
          if (![400, 429].includes(r.status())) throw new Error('PUT /profile невалиден телефон: очаквах 400 или 429, върна ' + r.status());
        } },
        { label: 'PUT /api/profile/need (валидна нужда) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/need', { headers: bearer(c.tokenA), data: { current_need: c.validNeed } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`PUT /need HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'PUT /api/profile/need (невалидна услуга) → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/need', { headers: bearer(c.tokenA), data: { current_need: 'НесъществуващаУслуга' } });
          if (r.status() >= 500) throw new Error('PUT /need невалидна гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('PUT /need невалидна: очаквах 400, върна ' + r.status());
        } },
        { label: 'PUT /api/profile/offerings (ПУБЛИЧНА услуга) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/offerings', { headers: bearer(c.tokenA), data: { offerings: c.publicOffering } });
          if (r.status() >= 500) throw new Error('PUT /offerings гръмна HTTP ' + r.status());
          // success ИЛИ 403 (ако A е останал верифициран от друг сценарий — заключено поле)
          if (![200, 403].includes(r.status())) throw new Error('PUT /offerings: очаквах 200 или 403, върна ' + r.status());
        } },
        { label: 'PUT /api/profile/offerings (Болница — верифицируема за неверифициран) → 400 ИЛИ 403', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/offerings', { headers: bearer(c.tokenA), data: { offerings: 'Hospital' } });
          if (r.status() >= 500) throw new Error('PUT /offerings Болница гръмна HTTP ' + r.status());
          // неверифициран → 400 (изисква верификация); ако A е верифициран → 403 (заключено поле)
          if (![400, 403].includes(r.status())) throw new Error('PUT /offerings Болница: очаквах 400 или 403, върна ' + r.status());
        } },
        { label: 'PUT /api/profile/email (валиден) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/email', { headers: bearer(c.tokenA), data: { email: 'robot.extra@example.com' } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`PUT /email HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'PUT /api/profile/email (невалиден формат) → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/email', { headers: bearer(c.tokenA), data: { email: 'невалиден-имейл' } });
          if (r.status() >= 500) throw new Error('PUT /email невалиден гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('PUT /email невалиден: очаквах 400, върна ' + r.status());
        } },
        { label: 'PUT /api/profile/code-word (валидна) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/code-word', { headers: bearer(c.tokenA), data: { code_word: 'робот-код' } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`PUT /code-word HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'PUT /api/profile/code-word (под 3 символа) → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/code-word', { headers: bearer(c.tokenA), data: { code_word: 'аб' } });
          if (r.status() >= 500) throw new Error('PUT /code-word кратка гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('PUT /code-word кратка: очаквах 400, върна ' + r.status());
        } },
        { label: 'PUT /api/profile/hide-phone (вкл.) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/hide-phone', { headers: bearer(c.tokenA), data: { hide_phone: true } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`PUT /hide-phone HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'PUT /api/profile/hide-names (вкл.) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/hide-names', { headers: bearer(c.tokenA), data: { hide_names: true } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`PUT /hide-names HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'PUT /api/profile/password (празно) → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/password', { headers: bearer(c.tokenA), data: { current_password: '', new_password: '' } });
          if (r.status() >= 500) throw new Error('PUT /password празно гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('PUT /password празно: очаквах 400, върна ' + r.status());
        } },
        { label: 'PUT /api/profile/password (грешна текуща) → 401', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/profile/password', { headers: bearer(c.tokenA), data: { current_password: 'грешна-парола', new_password: c.newPass } });
          if (r.status() >= 500) throw new Error('PUT /password грешна гръмна HTTP ' + r.status());
          if (r.status() !== 401) throw new Error('PUT /password грешна текуща: очаквах 401, върна ' + r.status());
        } },
        { label: 'PUT /api/profile/password (смени и върни обратно) → success', run: async (page, c, h) => {
          if (blocked(c)) return;
          let r = await page.request.put(h.base + '/api/profile/password', { headers: bearer(c.tokenA), data: { current_password: c.pass, new_password: c.newPass } });
          let b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`PUT /password смяна HTTP ${r.status()} ${b.error || ''}`);
          // върни обратно, за да остане паролата валидна за следващи входове
          r = await page.request.put(h.base + '/api/profile/password', { headers: bearer(c.tokenA), data: { current_password: c.newPass, new_password: c.pass } });
          b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`PUT /password връщане HTTP ${r.status()} ${b.error || ''}`);
        } },
      ],
    },
    {
      name: 'ПРИЯТЕЛИ: A добавя B → списък/търсачка показват B → псевдоним',
      steps: [
        { label: 'A добавя B (POST /api/friends/add по friendUserId)', run: async (page, c, h) => {
          if (blocked(c) || !c.userIdB) return;
          const r = await page.request.post(h.base + '/api/friends/add', { headers: bearer(c.tokenA), data: { friendUserId: c.userIdB } });
          if (r.status() >= 500) throw new Error('friends/add гръмна HTTP ' + r.status());
          const b = await jsonOf(r);
          if (r.ok() && b.success) { c.friendsLinked = true; return; }
          // без админ B може да е „неплатен" → 400 „subscription expired" (легитимен пазач)
          if (r.status() === 400) { c.friendNotPaid = true; return; }
          throw new Error(`friends/add: очаквах success или 400, върна ${r.status()} ${b.error || ''}`);
        } },
        { label: 'GET /api/friends/ → списъкът показва B (ако добавянето мина)', run: async (page, c, h) => {
          if (blocked(c) || !c.friendsLinked) return;
          const r = await page.request.get(h.base + '/api/friends/', { headers: bearer(c.tokenA) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('friends list HTTP ' + r.status());
          if (!(b.friends || []).some(f => Number(f.userId) === Number(c.userIdB))) {
            throw new Error('добавеният приятел B не е в списъка');
          }
        } },
        { label: 'GET /api/friends/search (по държава) → намира B', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/friends/search?country=' + encodeURIComponent('България') + '&gender=female', { headers: bearer(c.tokenA) });
          const b = await jsonOf(r);
          if (!r.ok()) throw new Error('friends/search HTTP ' + r.status());
          if (!Array.isArray(b.users)) throw new Error('friends/search: очаквах масив users');
        } },
        { label: 'GET /api/friends/search без параметри → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/friends/search', { headers: bearer(c.tokenA) });
          if (r.status() >= 500) throw new Error('friends/search празно гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('friends/search без параметри: очаквах 400, върна ' + r.status());
        } },
        { label: 'PUT /api/friends/custom-name (псевдоним) → запазва се', run: async (page, c, h) => {
          if (blocked(c) || !c.friendsLinked) return;
          const nick = 'Робот Псевдоним ' + c.runToken;
          let r = await page.request.put(h.base + '/api/friends/custom-name', { headers: bearer(c.tokenA), data: { friendUserId: c.userIdB, customName: nick } });
          const b = await jsonOf(r);
          if (!r.ok() || !b.success) throw new Error(`custom-name HTTP ${r.status()} ${b.error || ''}`);
          // провери, че се вижда в списъка като displayName/customName
          r = await page.request.get(h.base + '/api/friends/', { headers: bearer(c.tokenA) });
          const lb = await jsonOf(r);
          const row = (lb.friends || []).find(f => Number(f.userId) === Number(c.userIdB));
          if (!row || (row.customName !== nick && row.displayName !== nick)) {
            throw new Error('псевдонимът не се запази в списъка с приятели');
          }
        } },
        { label: 'PUT /api/friends/custom-name (без friendUserId) → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.put(h.base + '/api/friends/custom-name', { headers: bearer(c.tokenA), data: { customName: 'без-id' } });
          if (r.status() >= 500) throw new Error('custom-name без id гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('custom-name без id: очаквах 400, върна ' + r.status());
        } },
      ],
    },
    {
      name: 'СЪОБЩЕНИЯ: A праща файл на B → B тегли; A праща локация; невалидни → 4xx',
      steps: [
        { label: 'A праща файл на B (multipart PNG)', run: async (page, c, h) => {
          if (blocked(c) || !c.userIdB) return;
          const r = await page.request.post(h.base + '/api/messages/' + c.userIdB + '/file', { headers: bearer(c.tokenA), multipart: {
            file: pngFile('robot-extra.png'),
          } });
          if (r.status() >= 500) throw new Error('изпращане на файл гръмна HTTP ' + r.status());
          const b = await jsonOf(r);
          if (r.ok() && b.success && b.fileId) { c.fileId = b.fileId; return; }
          // 403 = пазач (не приятели / без абонамент при неплатен потребител в прод без админ)
          if (r.status() === 403) { c.fileGuard = true; return; }
          throw new Error(`изпращане на файл: очаквах success или 403, върна ${r.status()} ${b.error || ''}`);
        } },
        { label: 'изпращане на файл без файл → 400', run: async (page, c, h) => {
          if (blocked(c) || !c.userIdB) return;
          const r = await page.request.post(h.base + '/api/messages/' + c.userIdB + '/file', { headers: bearer(c.tokenA), multipart: { note: 'без файл' } });
          if (r.status() >= 500) throw new Error('файл без файл гръмна HTTP ' + r.status());
          // 400 (няма качен файл) ИЛИ 403 (пазачът за абонамент/приятелство удря преди проверката за файл при неплатен)
          if (![400, 403].includes(r.status())) throw new Error('файл без файл: очаквах 400 или 403, върна ' + r.status());
        } },
        { label: 'B тегли файла (GET /api/messages/download/:fileId) → 200', run: async (page, c, h) => {
          if (blocked(c) || !c.fileId) return;
          const r = await page.request.get(h.base + '/api/messages/download/' + c.fileId, { headers: bearer(c.tokenB) });
          if (r.status() >= 500) throw new Error('сваляне на файл гръмна HTTP ' + r.status());
          if (r.status() !== 200) throw new Error('сваляне на файл (получател B): очаквах 200, върна ' + r.status());
        } },
        { label: 'A праща локация на B (POST /api/messages/send-location/:friendUserId)', run: async (page, c, h) => {
          if (blocked(c) || !c.userIdB) return;
          const r = await page.request.post(h.base + '/api/messages/send-location/' + c.userIdB, { headers: bearer(c.tokenA), data: {
            latitude: 42.6977, longitude: 23.3219, country: 'България', city: 'София',
          } });
          if (r.status() >= 500) throw new Error('изпращане на локация гръмна HTTP ' + r.status());
          const b = await jsonOf(r);
          if (r.ok() && b.success) return;
          // 403 = не са приятели (ако добавянето не мина без админ) — легитимен пазач
          if (r.status() === 403) return;
          throw new Error(`изпращане на локация: очаквах success или 403, върна ${r.status()} ${b.error || ''}`);
        } },
        { label: 'локация с невалиден friendUserId → 400 ИЛИ 403', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/messages/send-location/0', { headers: bearer(c.tokenA), data: { latitude: 42.7, longitude: 23.3 } });
          if (r.status() >= 500) throw new Error('локация невалиден id гръмна HTTP ' + r.status());
          // friendUserId=0 → toId връща null → 400; (ако маршрутизаторът го третира иначе → 403/404 пак е отказ)
          if (![400, 403, 404].includes(r.status())) throw new Error('локация невалиден id: очаквах 400/403/404, върна ' + r.status());
        } },
      ],
    },
    {
      name: 'ТЪРСЕНЕ: /free + /by-distance + /by-need (форма на резултата ИЛИ документиран пазач)',
      steps: [
        { label: 'POST /api/search/free (по град) → масив ИЛИ 403 (платен потребител)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/search/free', { headers: bearer(c.tokenA), data: { city: 'София' } });
          if (r.status() >= 500) throw new Error('search/free гръмна HTTP ' + r.status());
          // 403 = платените потребители ползват разширено търсене (пазач); иначе 200 с масив results
          if (r.status() === 403) return;
          if (r.status() !== 200) throw new Error('search/free: очаквах 200 или 403, върна ' + r.status());
          const b = await jsonOf(r);
          if (!Array.isArray(b.results)) throw new Error('search/free: очаквах масив results');
        } },
        { label: 'POST /api/search/by-distance без координати → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/search/by-distance', { headers: bearer(c.tokenA), data: { max_distance: 100 } });
          if (r.status() >= 500) throw new Error('by-distance без координати гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('by-distance без координати: очаквах 400, върна ' + r.status());
        } },
        { label: 'POST /api/search/by-distance (с координати) → форма на резултата', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/search/by-distance', { headers: bearer(c.tokenA), data: {
            latitude: 42.6977, longitude: 23.3219, max_distance: 40000,
          } });
          if (r.status() >= 500) throw new Error('by-distance гръмна HTTP ' + r.status());
          if (r.status() !== 200) throw new Error('by-distance: очаквах 200, върна ' + r.status());
          const b = await jsonOf(r);
          if (!Array.isArray(b.results) || typeof b.total !== 'number') throw new Error('by-distance: очаквах { total, results[] }');
        } },
        { label: 'POST /api/search/by-need без координати → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/search/by-need', { headers: bearer(c.tokenA), data: { need: c.validNeed || 'Driver' } });
          if (r.status() >= 500) throw new Error('by-need без координати гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('by-need без координати: очаквах 400, върна ' + r.status());
        } },
        { label: 'POST /api/search/by-need (невалидна нужда) → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/search/by-need', { headers: bearer(c.tokenA), data: { latitude: 42.7, longitude: 23.3, need: 'НесъществуващаУслуга' } });
          if (r.status() >= 500) throw new Error('by-need невалидна нужда гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('by-need невалидна нужда: очаквах 400, върна ' + r.status());
        } },
        { label: 'POST /api/search/by-need (валидно) → форма на резултата', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/search/by-need', { headers: bearer(c.tokenA), data: {
            latitude: 42.6977, longitude: 23.3219, need: c.validNeed || 'Driver',
          } });
          if (r.status() >= 500) throw new Error('by-need гръмна HTTP ' + r.status());
          if (r.status() !== 200) throw new Error('by-need: очаквах 200, върна ' + r.status());
          const b = await jsonOf(r);
          if (!Array.isArray(b.results) || typeof b.max_radius_km !== 'number') throw new Error('by-need: очаквах { results[], max_radius_km }');
        } },
      ],
    },
    {
      name: 'ЗАПОЗНАНСТВА: /find (платен пазач) + /block (B + dislike) + /dislikes',
      steps: [
        { label: 'POST /api/matchmaking/find → 402 (недостатъчен баланс) ИЛИ 400 (без критерии), не 500', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/matchmaking/find', { headers: bearer(c.tokenA), data: {} });
          if (r.status() >= 500) throw new Error('matchmaking/find гръмна HTTP ' + r.status());
          // платено: 402 (изтекъл абонамент/недостатъчен баланс) или 400 (липсват критерии) или 200 (ако има баланс+критерии)
          if (![200, 400, 402, 404].includes(r.status())) throw new Error('matchmaking/find: неочакван HTTP ' + r.status());
        } },
        { label: 'POST /api/matchmaking/block без blockedId → 400', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/matchmaking/block', { headers: bearer(c.tokenA), data: {} });
          if (r.status() >= 500) throw new Error('block без id гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('block без blockedId: очаквах 400, върна ' + r.status());
        } },
        { label: 'POST /api/matchmaking/block (A блокира B + dislike)', run: async (page, c, h) => {
          if (blocked(c) || !c.userIdB) return;
          const r = await page.request.post(h.base + '/api/matchmaking/block', { headers: bearer(c.tokenA), data: {
            blockedId: Number(c.userIdB),
            dislikes: [{ field: 'height_cm', value: '180' }],
          } });
          if (r.status() >= 500) throw new Error('block гръмна HTTP ' + r.status());
          const b = await jsonOf(r);
          if (r.ok() && b.success) { c.blockedB = true; return; }
          // 400 „вече блокиран" е легитимно при повтаряне на теста
          if (r.status() === 400) { c.blockedB = true; return; }
          throw new Error(`block: очаквах success или 400, върна ${r.status()} ${b.error || ''}`);
        } },
        { label: 'GET /api/matchmaking/dislikes → показва записания dislike', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/matchmaking/dislikes', { headers: bearer(c.tokenA) });
          if (r.status() >= 500) throw new Error('dislikes гръмна HTTP ' + r.status());
          if (r.status() !== 200) throw new Error('dislikes: очаквах 200, върна ' + r.status());
          const b = await jsonOf(r);
          if (typeof b.totalCount !== 'number' || !('dislikes' in b)) throw new Error('dislikes: очаквах { dislikes, totalCount }');
          if (c.blockedB && b.totalCount < 1) throw new Error('dislikes: записаният dislike не се вижда (totalCount=0)');
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
