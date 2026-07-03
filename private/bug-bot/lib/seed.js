// Version: 1.0193
// ──────────────────────────────────────────────────────────────────────────
// МАСОВ СИЙДЪР — пълни екосистемата с РЕАЛНИ данни „като хора":
//   стотици потребители, които се регистрират, ЧАТЯТ (контакти + съобщения),
//   МАЧВАТ се (matchmaking критерии), ПОСТВАТ в WNB (различни държави) и правят
//   КЪЩИ в HLB (различни форми/стаи), КАЧВАТ КАРТИНКИ, ползват портал/ECO-3.
//
// За разлика от журитата (1 потребител + почистване), сийдърът НЕ чисти — целта е
// данните да ОСТАНАТ. Всичко е best-effort: грешка по един потребител се брои и
// продължава, не спира цялото пълнене.
//
// Авторизация:
//   chat   → Bearer токен (на заявка) → много потребители без конфликт.
//   wnb/hlb/portals → сесийни БИСКВИТКИ (един общ контекст) → правим ги ПОСЛЕДОВАТЕЛНО
//                     (регистрация → действие → изход), за да не се застъпват сесиите.
// ──────────────────────────────────────────────────────────────────────────
'use strict';
const zlib = require('zlib');

// ── мини PNG енкодер (истински растер за sharp/качване — без външни файлове) ──
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePng(w, h, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(h * (1 + w * 3)); let o = 0;
  for (let y = 0; y < h; y++) { raw[o++] = 0; for (let x = 0; x < w; x++) { const c = px(x, y); raw[o++] = c[0] & 255; raw[o++] = c[1] & 255; raw[o++] = c[2] & 255; } }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
// Цветна снимка (за чат файлове / мебели) и силует (за shape-from-image — кръг на бял фон).
function colorPng(seed) { const a = (seed * 2654435761) >>> 0; return makePng(64, 64, (x, y) => [(x * 4 + a) & 255, (y * 4 + (a >> 8)) & 255, ((x + y) * 3 + (a >> 16)) & 255]); }
function blobPng() { const cx = 24, cy = 24, r = 18; return makePng(48, 48, (x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r ? [40, 60, 90] : [255, 255, 255])); }

// ── данни за случайни, но правдоподобни записи ──
const FIRST = ['Иван', 'Мария', 'Георги', 'Елена', 'Петър', 'Анна', 'Драго', 'Нина', 'Стоян', 'Виктория', 'Никола', 'Радка', 'Борис', 'Цвета', 'Емил', 'Лора'];
const SUR = ['Иванов', 'Петров', 'Георгиев', 'Димитров', 'Колев', 'Стоянов', 'Тодоров', 'Маринов', 'Ангелов', 'Василев'];
const COUNTRIES = [
  { name: 'България', code: 'BG', cities: ['София', 'Пловдив', 'Варна', 'Бургас'] },
  { name: 'Германия', code: 'DE', cities: ['Берлин', 'Мюнхен', 'Хамбург'] },
  { name: 'Франция', code: 'FR', cities: ['Париж', 'Лион', 'Марсилия'] },
  { name: 'Испания', code: 'ES', cities: ['Мадрид', 'Барселона'] },
  { name: 'Италия', code: 'IT', cities: ['Рим', 'Милано'] },
  { name: 'Русия', code: 'RU', cities: ['Москва', 'Санкт Петербург'] },
  { name: 'Турция', code: 'TR', cities: ['Истанбул', 'Анкара'] },
  { name: 'Гърция', code: 'GR', cities: ['Атина', 'Солун'] },
];
const CHAT_LINES = ['Здравей! 👋', 'Как си?', 'Какво ново?', 'Да се видим скоро.', 'Благодаря! 🙏', 'Звучи добре 👍', 'До утре!', 'Може ли да помогнеш?', 'Чакам те.', 'Супер! 🎉'];
const WNB_TITLES = ['Липсва добра пекарна', 'Няма автомивка', 'Търси се ВиК майстор', 'Липсва детски магазин', 'Няма веган ресторант', 'Търси се зъболекар', 'Липсва книжарница', 'Няма фитнес наблизо'];
const HLB_TITLES = ['Семейна къща', 'Модерна вила', 'Малка вила', 'Къща с двор', 'Двуетажна къща', 'Къща на брега'];
const FOOTPRINTS = ['square', 'rect', 'lshape', 'dome', 'cabin'];
const ROOFS = ['gabled', 'flat', 'dome', 'none'];
const ROOM_TYPES = ['living', 'bedroom', 'kitchen', 'bathroom', 'dining', 'kids', 'office'];
const ROOM_SHAPES = ['rect', 'rounded', 'circle', 'hex'];
const FURN_CENTER = ['sofaset', 'coffee', 'table', 'bed', 'armchair', 'desk'];
const FURN_WALL = ['tvstand', 'wardrobe', 'shelves', 'fridge', 'sink'];

// ── HTTP помощник върху Playwright APIRequestContext ──
async function api(request, base, method, pth, opts = {}) {
  const o = {};
  if (opts.json !== undefined) o.data = opts.json;
  if (opts.headers) o.headers = opts.headers;
  if (opts.multipart) o.multipart = opts.multipart;
  try {
    const res = await request[method.toLowerCase()](base + pth, o);
    let body = null; try { body = await res.json(); } catch (_) { /* не-JSON */ }
    return { status: res.status(), ok: res.ok(), body: body || {} };
  } catch (e) { return { status: 0, ok: false, body: { error: (e.message || String(e)).slice(0, 120) } }; }
}
const bearer = (t) => ({ Authorization: 'Bearer ' + t });

// ── главна функция ──
async function runSeed({ request, base, users, actions, env, rng, log }) {
  const rnd = (n) => Math.floor(rng() * n);
  const pick = (a) => a[rnd(a.length)];
  const sum = { chatUsers: 0, friends: 0, messages: 0, match: 0, chatImages: 0,
    wnbUsers: 0, wnbPosts: 0, hlbUsers: 0, hlbHouses: 0, hlbImages: 0,
    portalUsers: 0, eco3: 0, errors: 0 };
  const runTag = Math.floor(rng() * 1e9).toString(36);
  const offset = rnd(700000000);

  // персони (един човек → акаунти в няколко проекта)
  const personas = [];
  for (let i = 0; i < users; i++) {
    const c = pick(COUNTRIES);
    personas.push({
      i, name: pick(FIRST) + ' ' + pick(SUR), gender: rnd(2) ? 'male' : 'female',
      phone: '+9' + String(1000000000 + ((offset + i * 101) % 800000000)),
      email: `seed_${runTag}_${i}@test.local`,
      username: `seed_${runTag}_${i}`,
      pass: 'Robot12345!', country: c, city: pick(c.cities),
    });
  }
  const tick = (n, label) => { if (n % 25 === 0) log(`     …${label}: ${n}/${users}`); };

  // ── ЧАТ (Bearer токени) ──
  if (actions.chat) {
    log('  💬 Чат: регистрация + плащане + вход + matchmaking…');
    const live = [];
    for (const p of personas) {
      const r = await api(request, base, 'POST', '/api/auth/register', { json: {
        phone: p.phone, password: p.pass, fullName: p.name, gender: p.gender,
        heightCm: 150 + rnd(50), weightKg: 50 + rnd(50), country: p.country.name, city: p.city } });
      if (r.status === 429) { sum.errors++; continue; }
      if (!(r.body.success || r.body.userId)) { sum.errors++; continue; }
      p.userId = r.body.userId; sum.chatUsers++;
      if (p.userId) await api(request, base, 'POST', '/api/admin/update-payment', { json: { userId: p.userId, months: 1 } });
      const l = await api(request, base, 'POST', '/api/auth/login', { json: { phone: p.phone, password: p.pass, client: 'web' } });
      if (l.body && l.body.token) {
        p.token = l.body.token; live.push(p);
        await api(request, base, 'POST', '/api/matchmaking/criteria', { headers: bearer(p.token), json: { height_min: 150 + rnd(20), height_max: 180 + rnd(30), age_min: 18, age_max: 60 + rnd(30) } });
        sum.match++;
      }
      tick(sum.chatUsers, 'чат потребители');
    }
    log(`  💬 Чат: ${live.length} активни → контакти + съобщения${actions.images ? ' + картинки' : ''}…`);
    for (const p of live) {
      const nF = 1 + rnd(4);
      for (let k = 0; k < nF; k++) {
        const q = pick(live); if (!q || q === p) continue;
        const fr = await api(request, base, 'POST', '/api/friends', { headers: bearer(p.token), json: { friendPhone: q.phone } });
        if (!fr.ok) { if (fr.status !== 400) sum.errors++; continue; } // 400 = вече приятели/сам себе си
        sum.friends++;
        const nM = 1 + rnd(3);
        for (let m = 0; m < nM; m++) {
          const s = await api(request, base, 'POST', '/api/messages/send', { headers: bearer(p.token), json: { to: q.phone, text: pick(CHAT_LINES) } });
          if (s.ok) sum.messages++;
        }
        if (actions.images && rnd(3) === 0) {
          const up = await api(request, base, 'POST', '/api/messages/upload', { headers: bearer(p.token), multipart: { to: q.phone, file: { name: 'pic.png', mimeType: 'image/png', buffer: colorPng(p.i * 7 + k) } } });
          if (up.ok) sum.chatImages++;
        }
      }
    }
  }

  // ── WNB постове (сесийни бисквитки → последователно) ──
  const wnbPostIds = [];
  if (actions.posts) {
    log('  🌍 WNB: потребители + постове в различни държави…');
    for (const p of personas) {
      const reg = await api(request, base, 'POST', '/api/wnb/register', { json: { email: p.email, password: p.pass, display_name: p.name } });
      if (!(reg.status === 201 || reg.ok)) { sum.errors++; continue; }
      sum.wnbUsers++;
      const nP = 1 + rnd(2);
      for (let k = 0; k < nP; k++) {
        const c = pick(COUNTRIES);
        const post = await api(request, base, 'POST', '/api/wnb/posts', { json: { country_code: c.code, title: pick(WNB_TITLES), description: `Автоматичен сийд запис за ${c.name} — описание над двайсет знака. #${runTag}`, links: [] } });
        if (post.ok && post.body.post) { sum.wnbPosts++; wnbPostIds.push(post.body.post.id); }
        else sum.errors++;
      }
      await api(request, base, 'POST', '/api/wnb/logout');
      tick(sum.wnbUsers, 'WNB потребители');
    }
  }

  // ── HLB къщи + мебелни снимки (сесийни бисквитки → последователно) ──
  const hlbPropIds = [];
  if (actions.posts) {
    log('  🏠 HLB: потребители + къщи (форми/стаи)' + (actions.images ? ' + мебелни снимки' : '') + '…');
    for (const p of personas) {
      const reg = await api(request, base, 'POST', '/api/hlb/register', { json: { email: p.email, password: p.pass, display_name: p.name } });
      if (!(reg.status === 201 || reg.ok)) { sum.errors++; continue; }
      sum.hlbUsers++;
      // по желание: качи мебелна снимка → URL за composer_params
      let furnImg = null;
      if (actions.images && rnd(2) === 0) {
        const up = await api(request, base, 'POST', '/api/hlb/proposals/furniture-image', { multipart: { image: { name: 'furn.png', mimeType: 'image/png', buffer: colorPng(p.i * 13) } } });
        if (up.ok && up.body.url) { furnImg = up.body.url; sum.hlbImages++; }
      }
      const params = randomHouse(rnd, pick, furnImg);
      const prop = await api(request, base, 'POST', '/api/hlb/proposals', { json: { title: pick(HLB_TITLES), description: `Сийд къща #${runTag}`, composer_params: JSON.stringify(params) } });
      if (prop.ok && prop.body.proposal) {
        const id = prop.body.proposal.id; sum.hlbHouses++; hlbPropIds.push(id);
        // понякога добави и „изгледна" снимка към къщата
        if (actions.images && rnd(3) === 0) {
          await api(request, base, 'POST', `/api/hlb/proposals/${id}/images?kind=view`, { multipart: { image: { name: 'view.png', mimeType: 'image/png', buffer: colorPng(id || p.i) } } });
        }
        await api(request, base, 'POST', `/api/hlb/proposals/${id}/submit`, { json: {} });
      } else sum.errors++;
      await api(request, base, 'POST', '/api/hlb/logout');
      tick(sum.hlbUsers, 'HLB потребители');
    }
  }

  // ── модерация: одобри част от постовете/къщите (ако има админ данни) ──
  if (actions.posts) {
    await approveFraction(request, base, env, wnbPostIds, hlbPropIds, rng, sum, log);
  }

  // ── Портал услуги + ECO-3 (сесийни бисквитки → последователно) ──
  if (actions.portal) {
    log('  🛠️ Портал: регистрация на потребители (достъп до услуги/ECO-3)…');
    for (const p of personas) {
      const reg = await api(request, base, 'POST', '/api/portals/register', { json: { username: p.username, password: p.pass } });
      if (reg.ok || reg.status === 200 || reg.status === 201) {
        sum.portalUsers++;
        // ECO-3 е зад порталния вход — маркираме достъпа (без скъпи AI заявки)
        const e = await api(request, base, 'GET', '/api/eco3/health');
        if (e.ok) sum.eco3++;
      } else sum.errors++;
      await api(request, base, 'POST', '/api/portals/logout');
      tick(sum.portalUsers, 'портал потребители');
    }
  }

  return sum;
}

// Случайни параметри за HLB къща (съвместими с composer_params на HouseRender).
function randomHouse(rnd, pick, furnImg) {
  const floors = 1 + rnd(2);
  const rooms = [];
  for (let f = 0; f < floors; f++) {
    const n = 2 + rnd(3);
    const fl = [];
    for (let i = 0; i < n; i++) {
      const items = [];
      const nc = 1 + rnd(2), nw = rnd(2);
      for (let k = 0; k < nc; k++) items.push({ type: pick(FURN_CENTER), place: 'center', wall: 0, color: '#' + (0x445566 + rnd(0x99999)).toString(16).slice(0, 6) });
      for (let k = 0; k < nw; k++) items.push({ type: pick(FURN_WALL), place: 'wall', wall: 0 });
      if (furnImg && items.length) items[0].img = furnImg;
      fl.push({ type: pick(ROOM_TYPES), shape: pick(ROOM_SHAPES), walls: [{ doors: 1, windows: 1 + rnd(2) }, { doors: 0, windows: rnd(2) }, { doors: 0, windows: 1 }, { doors: 0, windows: rnd(2) }], items });
    }
    rooms.push(fl);
  }
  return { footprint: pick(FOOTPRINTS), roof: pick(ROOFS), floors, windowsPerFloor: 2 + rnd(2),
    wallColor: '#e8d9c0', roofColor: '#8a4b3b', accentColor: '#3b6ea5', extras: {}, rooms };
}

// Одобрява случайна част (≈60%) от постовете/къщите чрез админ (ако има .env данни).
async function approveFraction(request, base, env, wnbIds, hlbIds, rng, sum, log) {
  // WNB
  if (wnbIds.length && env.WNB_ADMIN_USER && env.WNB_ADMIN_PASS) {
    await api(request, base, 'POST', '/api/wnb/logout');
    const lg = await api(request, base, 'POST', '/api/wnb/login', { json: { email: env.WNB_ADMIN_USER, password: env.WNB_ADMIN_PASS } });
    if (lg.ok) {
      let ok = 0;
      for (const id of wnbIds) { if (rng() < 0.6) { const r = await api(request, base, 'POST', `/api/wnb/moderation/posts/${id}/approve`, { json: {} }); if (r.ok) ok++; } }
      await api(request, base, 'POST', '/api/wnb/logout');
      log(`  ✅ WNB: одобрени ${ok}/${wnbIds.length} поста`);
      sum.wnbApproved = ok;
    }
  }
  // HLB
  if (hlbIds.length && env.HLB_ADMIN_USER && env.HLB_ADMIN_PASS) {
    await api(request, base, 'POST', '/api/hlb/logout');
    const lg = await api(request, base, 'POST', '/api/hlb/login', { json: { email: env.HLB_ADMIN_USER, password: env.HLB_ADMIN_PASS } });
    if (lg.ok) {
      let ok = 0;
      for (const id of hlbIds) { if (rng() < 0.6) { const r = await api(request, base, 'POST', `/api/hlb/moderation/proposals/${id}/approve`, { json: { note: 'сийд одобри' } }); if (r.ok) ok++; } }
      await api(request, base, 'POST', '/api/hlb/logout');
      log(`  ✅ HLB: одобрени ${ok}/${hlbIds.length} къщи`);
      sum.hlbApproved = ok;
    }
  }
}

module.exports = { runSeed };
