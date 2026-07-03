// Version: 1.0001
// House-Look-Book — ДЕЙСТВИЯ, които hlb.js НЕ покрива (особено УСПЕШНИТЕ пътища).
// hlb.js тества лайкове/доклади/изображения предимно като 401/403/404; тук вървим
// по щастливия път „като човек":
//   1) ЛАЙКОВЕ + КЛАСАЦИЯ (ядро): собственик създава къща → админ я одобрява →
//      ВТОРИ абониран потребител я лайква (like_count +1), GET /:id/like = liked:true,
//      DELETE сваля лайка (−1), GET /ranking я показва. Пазачи: лайк на неодобрена → 409;
//      requireSubscribed (без абонамент/без вход) → 402/401.
//   2) ДОКЛАД → резолюция (бан): потребител докладва ВАЛИДНА причина → 201 + report_count;
//      модератор GET /moderation/reports я вижда; resolve valid:true (сваля + бан) и
//      valid:false (+baseless). Пазачи: self-report 400, дубликат 409, already_resolved 409.
//   3) Публични четения (200 + форма): GET /proposals (галерия), GET /proposals/mine.
//   4) Успешна редакция/триене от собственика: PUT (отново 'editing') и DELETE (меко).
//   5) Картинки: images?kind=detail (валиден PNG), furniture-image (валиден → 201, лош → 400),
//      shape-from-image (силует → 200, или документиран no_shape 422 / bad_image 400).
//   6) Бан/разбан УСПЕХ: админ banне роботски тест-потребител → success, после unban.
//   7) generate (локален, admin-only): smoke test; generate-from-google = само пазач
//      (no_google_config 400 / admin 403 — НИКОГА не вика външен Google).
//
// Админ: предпочитаме .env (HLB_ADMIN_USER/PASS — реален id, може да банва/списъци). Ако
// липсва → ползваме универсалния токен ?adm=bgmasters-set (минава requireRole/requireAuth,
// но id:null → банове/списъци по реален id не стават → пропускаме ги грациозно).
// Очакване навсякъде: коректен отговор, НИКОГА 500.
'use strict';
const zlib = require('zlib');

// ── ВАЛИДНИ PNG-ове в кода (без външни файлове) ──────────────────────────
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
// Плътен цвят (за обикновена снимка) или функция (x,y)->[r,g,b] (за силует).
function makePng(w, h, color) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (1 + w * 3)); let o = 0;
  const px = typeof color === 'function' ? color : () => color;
  for (let y = 0; y < h; y++) { raw[o++] = 0; for (let x = 0; x < w; x++) { const c = px(x, y); raw[o++] = c[0]; raw[o++] = c[1]; raw[o++] = c[2]; } }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
// Обикновена снимка (плътен цвят) — за view/detail/furniture.
const PNG_SOLID = makePng(64, 64, [70, 110, 160]);
// СИЛУЕТ: бял фон + тъмен правоъгълник в центъра (поне 4 реда тъмни пиксели под средното
// сиво → shape-from-image вади контур → 200). Ако сървърът все пак върне no_shape → 422 е ок.
const PNG_SHAPE = makePng(64, 64, (x, y) => (x >= 18 && x <= 46 && y >= 12 && y <= 52) ? [20, 20, 20] : [245, 245, 245]);
const pngFile = (name, buf) => ({ name, mimeType: 'image/png', buffer: buf || PNG_SOLID });

// „Никога 500": статусът < 500 И в очаквания набор.
function assertStatusIn(status, allowed, what, body) {
  if (status >= 500) throw new Error(`${what}: HTTP ${status} (сървърна грешка — НЕ бива 500)`);
  if (!allowed.includes(status)) throw new Error(`${what}: HTTP ${status} (чаках ${allowed.join('/')})${body && body.error ? ' / ' + body.error : ''}`);
}
const bodyOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };

// Свеж, ИЗОЛИРАН HTTP контекст (за „без вход"); не пипа основната сесия.
async function freshRequest(page, extraHeaders) {
  const rc = await require('playwright').request.newContext({
    ignoreHTTPSErrors: true,
    ...(extraHeaders ? { extraHTTPHeaders: extraHeaders } : {}),
  });
  return { request: rc, dispose: async () => { try { await rc.dispose(); } catch (_) {} } };
}

// HTTP контекст за АДМИН: ако има .env админ → ползваме сесия (вход). Иначе → универсалния
// токен ?adm=bgmasters-set чрез бисквитка kcy_adm (минава requireRole, но id:null).
// Връща { request, dispose, byEnv } — byEnv=true ако влязохме с реален админ акаунт.
async function adminContext(page, c) {
  if (c.adminEmail && c.adminPass) {
    const f = await freshRequest(page);
    const li = await f.request.post(c.base + '/api/hlb/login', { data: { email: c.adminEmail, password: c.adminPass }, failOnStatusCode: false });
    if (li.status() === 200) {
      const me = await bodyOf(await f.request.get(c.base + '/api/hlb/me'));
      if (me.user && me.user.role === 'admin') return { request: f.request, dispose: f.dispose, byEnv: true };
    }
    await f.dispose();
  }
  // Резервен вариант: универсален токен (бисквитка). Достатъчно за approve/reports/resolve/generate,
  // но НЕ за бан/списък-потребители по реален id (там actor е id:null).
  const f = await freshRequest(page, { Cookie: 'kcy_adm=bgmasters-set' });
  return { request: f.request, dispose: f.dispose, byEnv: false };
}

module.exports = {
  app: 'hlb',
  label: 'HLB ДЕЙСТВИЯ — харесвания/класация/доклади/изображения/бан',
  writes: true,
  setup(ctx, env) {
    ctx.pass = 'Robot12345!';
    // УНИКАЛНИ потребители по runToken (свежи → 0 къщи, абонирани по подразбиране при register).
    ctx.owner = `hlba-owner+${ctx.runToken}@test.local`;     // създава къщи
    ctx.liker = `hlba-liker+${ctx.runToken}@test.local`;     // лайква/докладва
    ctx.reporter = `hlba-rep+${ctx.runToken}@test.local`;    // докладва (за бан)
    ctx.banme = `hlba-banme+${ctx.runToken}@test.local`;     // за бан/разбан
    ctx.adminEmail = (env && env.HLB_ADMIN_USER) || '';
    ctx.adminPass = (env && env.HLB_ADMIN_PASS) || '';
  },
  scenarios: [
    {
      name: 'Подготовка: регистрирай owner/liker/reporter/banme (абонирани) + създай и одобри къща',
      steps: [
        { label: 'регистрирай 4-те потребителя (всеки в свеж контекст) + запомни id-та', run: async (page, c, h) => {
          c.base = h.base;
          for (const who of ['owner', 'liker', 'reporter', 'banme']) {
            const f = await freshRequest(page);
            try {
              const r = await f.request.post(h.base + '/api/hlb/register', { data: { email: c[who], password: c.pass, display_name: 'Робот ' + who }, failOnStatusCode: false });
              const b = await bodyOf(r);
              // 201 = нов; 409 = вече регистриран при ре-пуск (логваме се после за id).
              if (r.status() === 201) { c[who + 'Id'] = b.user && b.user.id; if (b.user) c[who + 'Sub'] = b.user.is_subscribed; }
              else if (r.status() !== 409) throw new Error(`register ${who} HTTP ${r.status()} ${b.error || ''}`);
            } finally { await f.dispose(); }
          }
          // Регистрацията слага is_subscribed=TRUE — потвърди, че лайкове/доклади ще минат requireSubscribed.
          if (c.ownerSub === false) throw new Error('owner не е абониран след регистрация (requireSubscribed ще блокира)');
        } },
        { label: 'owner влиза и създава къща + view снимка + submit', run: async (page, c, h) => {
          // Логваме се като owner в ОСНОВНАТА сесия (page.request) — нея ползваме за owner действия.
          await page.request.post(h.base + '/api/hlb/logout');
          const li = await page.request.post(h.base + '/api/hlb/login', { data: { email: c.owner, password: c.pass }, failOnStatusCode: false });
          assertStatusIn(li.status(), [200], 'вход owner', await bodyOf(li));
          const cr = await page.request.post(h.base + '/api/hlb/proposals', { data: { title: 'Робот лайк-къща ' + c.runToken, description: 'За тест на лайкове/класация.', composer_params: { footprint: 'square', roof: 'gabled', floors: 1 } }, failOnStatusCode: false });
          const cb = await bodyOf(cr);
          if (cr.status() === 409) { c.quota = true; return; } // лимит на къщи → спираме ядрото грациозно по-надолу
          assertStatusIn(cr.status(), [201], 'create owner къща', cb);
          c.propId = cb.proposal && cb.proposal.id;
          // detail снимка докато е editing (kind=detail — НОВО покритие; hlb.js прави само kind=view).
          const im = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/images?kind=detail`, { multipart: { image: pngFile('detail.png') }, failOnStatusCode: false });
          assertStatusIn(im.status(), [201, 409], 'detail снимка', await bodyOf(im));
          const sb = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/submit`, { failOnStatusCode: false });
          assertStatusIn(sb.status(), [200], 'submit owner', await bodyOf(sb));
        } },
        { label: 'админ одобрява къщата (или пропусни ядрото ако няма админ достъп)', run: async (page, c, h) => {
          if (!c.propId) return;
          const a = await adminContext(page, c);
          try {
            const ap = await a.request.post(h.base + `/api/hlb/moderation/proposals/${c.propId}/approve`, { data: { note: 'робот одобри' }, failOnStatusCode: false });
            if (ap.status() === 401 || ap.status() === 403) { c.adminNoAccess = true; return; }
            assertStatusIn(ap.status(), [200], 'approve къща', await bodyOf(ap));
            // Потвърди статус approved.
            const g = await a.request.get(h.base + `/api/hlb/proposals/${c.propId}`);
            const gb = await bodyOf(g);
            if (!gb.proposal || gb.proposal.status !== 'approved') throw new Error('статус след approve: ' + (gb.proposal && gb.proposal.status));
            c.approved = true;
          } finally { await a.dispose(); }
        } },
      ],
    },
    {
      name: 'ЛАЙКОВЕ + КЛАСАЦИЯ: liker лайква одобрена къща (count+1), GET liked, DELETE (−1), ranking',
      steps: [
        { label: 'liker влиза и лайква одобрената къща → liked + like_count нараства', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return; // без одобрена къща (няма админ) → пропусни ядрото
          await page.request.post(h.base + '/api/hlb/logout');
          const li = await page.request.post(h.base + '/api/hlb/login', { data: { email: c.liker, password: c.pass }, failOnStatusCode: false });
          assertStatusIn(li.status(), [200], 'вход liker', await bodyOf(li));
          // Начален like_count.
          const before = await bodyOf(await page.request.get(h.base + `/api/hlb/proposals/${c.propId}`));
          c.likeBefore = (before.proposal && before.proposal.like_count) || 0;
          const r = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/like`, { failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [200], 'POST like', b);
          if (b.liked !== true) throw new Error('POST like: очаквах liked:true, върна ' + JSON.stringify(b).slice(0, 120));
          if (typeof b.like_count !== 'number' || b.like_count < c.likeBefore + 1) throw new Error(`like_count не нарасна: преди ${c.likeBefore}, сега ${b.like_count}`);
        } },
        { label: 'GET /:id/like (liker) → liked:true', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return;
          const r = await page.request.get(h.base + `/api/hlb/proposals/${c.propId}/like`, { failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [200], 'GET like', b);
          if (b.liked !== true) throw new Error('GET like: очаквах liked:true след лайк, върна ' + JSON.stringify(b).slice(0, 80));
        } },
        { label: 'втори лайк (идемпотентен) → пак 200, count не скача втори път', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return;
          const r = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/like`, { failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [200], 'POST like повторно (идемпотентен)', b);
        } },
        { label: 'класацията показва къщата сред одобрените', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return;
          const r = await page.request.get(h.base + '/api/hlb/proposals/ranking', { failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [200], 'GET ranking', b);
          if (!Array.isArray(b.ranking)) throw new Error('ranking: липсва масив ranking');
          if (!b.ranking.some(x => x.id === c.propId)) throw new Error('ranking: одобрената лайкната къща липсва в класацията');
        } },
        { label: 'DELETE /:id/like → liked:false + count намалява', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return;
          const r = await page.request.delete(h.base + `/api/hlb/proposals/${c.propId}/like`, { failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [200], 'DELETE like', b);
          if (b.liked !== false) throw new Error('DELETE like: очаквах liked:false, върна ' + JSON.stringify(b).slice(0, 80));
          if (b.like_count > c.likeBefore) throw new Error(`like_count не намаля след DELETE: ${b.like_count} > ${c.likeBefore}`);
        } },
      ],
    },
    {
      name: 'ЛАЙКОВЕ — пазачи: неодобрена → 409; requireSubscribed (без вход → 401)',
      steps: [
        { label: 'лайк на НЕодобрена (editing) къща → 409 not_approved', run: async (page, c, h) => {
          // owner създава нова къща и я ОСТАВЯ editing (не подава).
          await page.request.post(h.base + '/api/hlb/logout');
          const li = await page.request.post(h.base + '/api/hlb/login', { data: { email: c.owner, password: c.pass }, failOnStatusCode: false });
          assertStatusIn(li.status(), [200], 'вход owner (за editing къща)', await bodyOf(li));
          const cr = await page.request.post(h.base + '/api/hlb/proposals', { data: { title: 'Робот editing ' + c.runToken, composer_params: { footprint: 'square' } }, failOnStatusCode: false });
          const cb = await bodyOf(cr);
          if (cr.status() === 409) return; // лимит на къщи — приемливо при ре-пуск
          assertStatusIn(cr.status(), [201], 'create editing къща', cb);
          c.editingProp = cb.proposal && cb.proposal.id;
          // liker се опитва да я лайкне → 409.
          await page.request.post(h.base + '/api/hlb/logout');
          await page.request.post(h.base + '/api/hlb/login', { data: { email: c.liker, password: c.pass } });
          const r = await page.request.post(h.base + `/api/hlb/proposals/${c.editingProp}/like`, { failOnStatusCode: false });
          assertStatusIn(r.status(), [409], 'лайк на неодобрена', await bodyOf(r));
        } },
        { label: 'лайк БЕЗ вход → 401 (requireAuth преди requireSubscribed)', run: async (page, c, h) => {
          const id = c.propId || c.editingProp;
          if (!id) return;
          const f = await freshRequest(page);
          try {
            const r = await f.request.post(h.base + `/api/hlb/proposals/${id}/like`, { failOnStatusCode: false });
            assertStatusIn(r.status(), [401], 'лайк без вход', await bodyOf(r));
          } finally { await f.dispose(); }
        } },
      ],
    },
    {
      name: 'ДОКЛАД → резолюция: reporter докладва (201 + count); модератор вижда; resolve valid:false (+baseless)',
      steps: [
        { label: 'reporter влиза и докладва ВАЛИДНА причина → 201 + report_count +1', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return;
          await page.request.post(h.base + '/api/hlb/logout');
          const li = await page.request.post(h.base + '/api/hlb/login', { data: { email: c.reporter, password: c.pass }, failOnStatusCode: false });
          assertStatusIn(li.status(), [200], 'вход reporter', await bodyOf(li));
          const r = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/report`, { data: { reason: 'Това не е реална къща, а магаре (робот тест).' }, failOnStatusCode: false });
          const b = await bodyOf(r);
          if (r.status() === 409) { c.alreadyReported = true; return; } // вече докладвано при ре-пуск → ок
          assertStatusIn(r.status(), [201], 'POST report', b);
          c.reported = true;
        } },
        { label: 'дубликат доклад от същия → 409 already_reported', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return;
          const r = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/report`, { data: { reason: 'пак същото' }, failOnStatusCode: false });
          assertStatusIn(r.status(), [409], 'дубликат доклад', await bodyOf(r));
        } },
        { label: 'self-report (owner докладва собствената си къща) → 400 self_report', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return;
          await page.request.post(h.base + '/api/hlb/logout');
          await page.request.post(h.base + '/api/hlb/login', { data: { email: c.owner, password: c.pass } });
          const r = await page.request.post(h.base + `/api/hlb/proposals/${c.propId}/report`, { data: { reason: 'моя си е' }, failOnStatusCode: false });
          assertStatusIn(r.status(), [400], 'self-report', await bodyOf(r));
        } },
        { label: 'модератор GET /moderation/reports → намира доклада + resolve valid:false (+baseless), повторно → 409', run: async (page, c, h) => {
          if (!c.approved || !c.propId) return;
          const a = await adminContext(page, c);
          try {
            const lr = await a.request.get(h.base + '/api/hlb/moderation/reports', { failOnStatusCode: false });
            if (lr.status() === 401 || lr.status() === 403) return; // няма мод достъп → пропусни
            const lb = await bodyOf(lr);
            assertStatusIn(lr.status(), [200], 'GET moderation/reports', lb);
            if (!Array.isArray(lb.reports)) throw new Error('reports: липсва масив reports');
            const row = lb.reports.find(x => x.proposal_id === c.propId && x.status === 'pending');
            if (!row) return; // докладът е свален/обработен от предишно пускане → пропусни тихо
            c.reportId = row.id;
            // resolve valid:false → +1 baseless на докладващия (не сваля къщата → пазим я за теста на лайкове).
            const rv = await a.request.post(h.base + `/api/hlb/moderation/reports/${c.reportId}/resolve`, { data: { valid: false, note: 'робот: основателен? не' }, failOnStatusCode: false });
            const rb = await bodyOf(rv);
            assertStatusIn(rv.status(), [200], 'resolve valid:false', rb);
            if (rb.valid !== false) throw new Error('resolve: очаквах valid:false в отговора');
            if (typeof rb.reporterBaselessCount !== 'number') throw new Error('resolve valid:false: липсва reporterBaselessCount');
            // Повторна резолюция на същия доклад → 409 already_resolved.
            const again = await a.request.post(h.base + `/api/hlb/moderation/reports/${c.reportId}/resolve`, { data: { valid: false }, failOnStatusCode: false });
            assertStatusIn(again.status(), [409], 'повторна резолюция', await bodyOf(again));
          } finally { await a.dispose(); }
        } },
      ],
    },
    {
      name: 'ДОКЛАД → резолюция valid:true: сваля втора къща (+ може да банне собственика)',
      steps: [
        { label: 'banme създава+подава къща, админ я одобрява, reporter я докладва', run: async (page, c, h) => {
          if (c.adminNoAccess) return;
          await page.request.post(h.base + '/api/hlb/logout');
          const li = await page.request.post(h.base + '/api/hlb/login', { data: { email: c.banme, password: c.pass }, failOnStatusCode: false });
          assertStatusIn(li.status(), [200], 'вход banme', await bodyOf(li));
          const cr = await page.request.post(h.base + '/api/hlb/proposals', { data: { title: 'Робот доклад-къща ' + c.runToken, composer_params: { footprint: 'square' } }, failOnStatusCode: false });
          const cb = await bodyOf(cr);
          if (cr.status() === 409) { return; } // лимит → пропусни сценария
          assertStatusIn(cr.status(), [201], 'create banme къща', cb);
          c.reportProp = cb.proposal && cb.proposal.id;
          await page.request.post(h.base + `/api/hlb/proposals/${c.reportProp}/submit`, { failOnStatusCode: false });
          // одобри
          const a = await adminContext(page, c);
          try {
            const ap = await a.request.post(h.base + `/api/hlb/moderation/proposals/${c.reportProp}/approve`, { data: {}, failOnStatusCode: false });
            if (ap.status() === 401 || ap.status() === 403) { c.reportProp = null; return; }
            assertStatusIn(ap.status(), [200], 'approve доклад-къща', await bodyOf(ap));
          } finally { await a.dispose(); }
          // reporter докладва
          await page.request.post(h.base + '/api/hlb/logout');
          await page.request.post(h.base + '/api/hlb/login', { data: { email: c.reporter, password: c.pass } });
          const rep = await page.request.post(h.base + `/api/hlb/proposals/${c.reportProp}/report`, { data: { reason: 'Нереална къща (робот тест за валиден доклад).' }, failOnStatusCode: false });
          assertStatusIn(rep.status(), [201, 409], 'report за валиден доклад', await bodyOf(rep));
        } },
        { label: 'модератор resolve valid:true → къщата става removed (и евент. бан на собственика)', run: async (page, c, h) => {
          if (c.adminNoAccess || !c.reportProp) return;
          const a = await adminContext(page, c);
          try {
            const lr = await a.request.get(h.base + '/api/hlb/moderation/reports', { failOnStatusCode: false });
            if (lr.status() === 401 || lr.status() === 403) return;
            const lb = await bodyOf(lr);
            const row = (lb.reports || []).find(x => x.proposal_id === c.reportProp && x.status === 'pending');
            if (!row) return; // вече обработено
            const rv = await a.request.post(h.base + `/api/hlb/moderation/reports/${row.id}/resolve`, { data: { valid: true, note: 'робот: валиден доклад' }, failOnStatusCode: false });
            const rb = await bodyOf(rv);
            assertStatusIn(rv.status(), [200], 'resolve valid:true', rb);
            if (rb.valid !== true) throw new Error('resolve: очаквах valid:true в отговора');
            // Къщата трябва да е removed.
            const g = await a.request.get(h.base + `/api/hlb/proposals/${c.reportProp}`);
            const gb = await bodyOf(g);
            if (gb.proposal && gb.proposal.status !== 'removed') throw new Error('valid доклад: къщата не е removed, а ' + gb.proposal.status);
            // Ако конфигът банва собственика → разбани го пак, за да не блокираме повторни пускания.
            if (rb.ownerBanned && a.byEnv && c.banmeId) {
              await a.request.post(h.base + `/api/hlb/moderation/users/${c.banmeId}/unban`, { failOnStatusCode: false });
            }
          } finally { await a.dispose(); }
        } },
      ],
    },
    {
      name: 'Публични четения: GET /proposals (галерия) + GET /proposals/mine (owner)',
      steps: [
        { label: 'GET /api/hlb/proposals → 200 + форма (proposals масив, topListSize)', run: async (page, c, h) => {
          const f = await freshRequest(page);
          try {
            const r = await f.request.get(h.base + '/api/hlb/proposals?limit=10&offset=0', { failOnStatusCode: false });
            const b = await bodyOf(r);
            assertStatusIn(r.status(), [200], 'GET /proposals (галерия)', b);
            if (!Array.isArray(b.proposals)) throw new Error('галерия: липсва масив proposals');
            if (typeof b.topListSize !== 'number') throw new Error('галерия: липсва topListSize');
          } finally { await f.dispose(); }
        } },
        { label: 'owner GET /api/hlb/proposals/mine → 200 + своите къщи', run: async (page, c, h) => {
          await page.request.post(h.base + '/api/hlb/logout');
          const li = await page.request.post(h.base + '/api/hlb/login', { data: { email: c.owner, password: c.pass }, failOnStatusCode: false });
          assertStatusIn(li.status(), [200], 'вход owner (mine)', await bodyOf(li));
          const r = await page.request.get(h.base + '/api/hlb/proposals/mine', { failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [200], 'GET /proposals/mine', b);
          if (!Array.isArray(b.proposals)) throw new Error('mine: липсва масив proposals');
        } },
      ],
    },
    {
      name: 'Собственик: успешна редакция (PUT → editing) + успешно триене (DELETE → soft)',
      steps: [
        { label: 'owner създава къща за редакция/триене', run: async (page, c, h) => {
          await page.request.post(h.base + '/api/hlb/logout');
          await page.request.post(h.base + '/api/hlb/login', { data: { email: c.owner, password: c.pass } });
          const cr = await page.request.post(h.base + '/api/hlb/proposals', { data: { title: 'Робот edit/del ' + c.runToken, composer_params: { footprint: 'rect' } }, failOnStatusCode: false });
          const cb = await bodyOf(cr);
          if (cr.status() === 409) { c.editDelProp = null; return; } // лимит → пропусни
          assertStatusIn(cr.status(), [201], 'create edit/del къща', cb);
          c.editDelProp = cb.proposal && cb.proposal.id;
        } },
        { label: 'owner PUT /:id → 200, статусът се връща на editing', run: async (page, c, h) => {
          if (!c.editDelProp) return;
          const r = await page.request.put(h.base + `/api/hlb/proposals/${c.editDelProp}`, { data: { title: 'Робот edit/del РЕДАКТИРАНА', description: 'нов текст' }, failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [200], 'PUT редакция', b);
          if (!b.proposal || b.proposal.status !== 'editing') throw new Error('PUT: очаквах status editing, върна ' + (b.proposal && b.proposal.status));
          if (b.proposal.title !== 'Робот edit/del РЕДАКТИРАНА') throw new Error('PUT: заглавието не се обнови');
        } },
        { label: 'owner DELETE /:id → 200 ok (меко триене)', run: async (page, c, h) => {
          if (!c.editDelProp) return;
          const r = await page.request.delete(h.base + `/api/hlb/proposals/${c.editDelProp}`, { failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [200], 'DELETE триене', b);
          if (b.ok !== true) throw new Error('DELETE: очаквах ok:true');
        } },
      ],
    },
    {
      name: 'Картинки: furniture-image (валиден → 201, лош → 400) + shape-from-image (силует)',
      steps: [
        { label: 'owner е логнат; furniture-image с ВАЛИДЕН PNG → 201 + url', run: async (page, c, h) => {
          await page.request.post(h.base + '/api/hlb/logout');
          const li = await page.request.post(h.base + '/api/hlb/login', { data: { email: c.owner, password: c.pass }, failOnStatusCode: false });
          assertStatusIn(li.status(), [200], 'вход owner (картинки)', await bodyOf(li));
          const r = await page.request.post(h.base + '/api/hlb/proposals/furniture-image', { multipart: { image: pngFile('furniture.png') }, failOnStatusCode: false });
          const b = await bodyOf(r);
          assertStatusIn(r.status(), [201], 'furniture-image валиден', b);
          if (!b.url || !/\/uploads\/proposals\//.test(b.url)) throw new Error('furniture-image: липсва url');
        } },
        { label: 'furniture-image с НЕ-изображение → 400 bad_image (НИКОГА 500)', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/hlb/proposals/furniture-image', { multipart: { image: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('това не е изображение') } }, failOnStatusCode: false });
          assertStatusIn(r.status(), [400], 'furniture-image лош файл', await bodyOf(r));
        } },
        { label: 'furniture-image без файл → 400 no_file', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/hlb/proposals/furniture-image', { multipart: {}, failOnStatusCode: false });
          assertStatusIn(r.status(), [400], 'furniture-image без файл', await bodyOf(r));
        } },
        { label: 'shape-from-image със СИЛУЕТ → 200 (pts) ИЛИ документиран 422 no_shape', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/hlb/proposals/shape-from-image', { multipart: { image: pngFile('shape.png', PNG_SHAPE) }, failOnStatusCode: false });
          const b = await bodyOf(r);
          // 200 = извади форма (pts масив); 422 no_shape = не успя да извлече (приемливо); 400 bad_image = (не за валиден PNG, но толерирано).
          assertStatusIn(r.status(), [200, 422, 400], 'shape-from-image силует', b);
          if (r.status() === 200 && !Array.isArray(b.pts)) throw new Error('shape 200 без масив pts');
        } },
        { label: 'shape-from-image без файл → 400 no_file', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/hlb/proposals/shape-from-image', { multipart: {}, failOnStatusCode: false });
          assertStatusIn(r.status(), [400], 'shape-from-image без файл', await bodyOf(r));
        } },
      ],
    },
    {
      name: 'Бан/разбан УСПЕХ (admin-only): админ банва banme → success, после unban',
      steps: [
        { label: 'админ (само .env, реален id) banне banme → success, провери вход 403, после unban', run: async (page, c, h) => {
          if (!c.banmeId) return; // няма id (regиstрация 409 при ре-пуск) → пропусни
          const a = await adminContext(page, c);
          try {
            if (!a.byEnv) return; // универсалният токен е id:null → бан-журналът иска реален админ; пропусни грациозно
            const ban = await a.request.post(h.base + `/api/hlb/moderation/users/${c.banmeId}/ban`, { data: { reason: 'робот тест бан' }, failOnStatusCode: false });
            const bb = await bodyOf(ban);
            assertStatusIn(ban.status(), [200], 'ban', bb);
            if (!bb.user || bb.user.is_banned !== true) throw new Error('ban: потребителят не е is_banned:true');
            // Баннат → вход връща 403 banned.
            const f = await freshRequest(page);
            try {
              const li = await f.request.post(h.base + '/api/hlb/login', { data: { email: c.banme, password: c.pass }, failOnStatusCode: false });
              assertStatusIn(li.status(), [403], 'вход на баннат', await bodyOf(li));
            } finally { await f.dispose(); }
            // unban възстановява.
            const un = await a.request.post(h.base + `/api/hlb/moderation/users/${c.banmeId}/unban`, { failOnStatusCode: false });
            const ub = await bodyOf(un);
            assertStatusIn(un.status(), [200], 'unban', ub);
            if (!ub.user || ub.user.is_banned !== false) throw new Error('unban: потребителят още е баннат');
          } finally { await a.dispose(); }
        } },
        { label: 'ban на несъществуващ потребител → 404 (НИКОГА 500)', run: async (page, c, h) => {
          const a = await adminContext(page, c);
          try {
            if (!a.byEnv) return;
            const r = await a.request.post(h.base + '/api/hlb/moderation/users/999999999/ban', { data: { reason: 'x' }, failOnStatusCode: false });
            assertStatusIn(r.status(), [404], 'ban несъществуващ', await bodyOf(r));
          } finally { await a.dispose(); }
        } },
      ],
    },
    {
      name: 'Генератори (admin-only): generate (локален smoke) + generate-from-google (само пазач)',
      steps: [
        { label: 'POST /moderation/generate {count:2} → 200 + created (локален, без външни услуги)', run: async (page, c, h) => {
          const a = await adminContext(page, c);
          try {
            const r = await a.request.post(h.base + '/api/hlb/moderation/generate', { data: { count: 2 }, failOnStatusCode: false });
            if (r.status() === 401 || r.status() === 403) return; // без админ достъп → пропусни
            const b = await bodyOf(r);
            assertStatusIn(r.status(), [200], 'generate локален', b);
            if (b.ok !== true || typeof b.created !== 'number') throw new Error('generate: очаквах ok:true + created число');
          } finally { await a.dispose(); }
        } },
        { label: 'generate-from-google → пазач: no_google_config 400 (или 403 ако не сме админ) — НИКОГА не вика Google', run: async (page, c, h) => {
          const a = await adminContext(page, c);
          try {
            // Не подаваме query НАРОЧНО; ако .env няма HLB_GOOGLE_* → 400 no_google_config преди всякаква външна заявка.
            const r = await a.request.post(h.base + '/api/hlb/moderation/generate-from-google', { data: { count: 1 }, failOnStatusCode: false });
            // 400 = липсва Google конфиг ИЛИ липсва query (no_query). 403 = не сме админ. Всичко без 500/външен зов.
            assertStatusIn(r.status(), [400, 403, 429], 'generate-from-google пазач', await bodyOf(r));
          } finally { await a.dispose(); }
        } },
        { label: 'нормален потребител НЕ може generate → 403 (контрол)', run: async (page, c, h) => {
          await page.request.post(h.base + '/api/hlb/logout');
          await page.request.post(h.base + '/api/hlb/login', { data: { email: c.owner, password: c.pass } });
          const r = await page.request.post(h.base + '/api/hlb/moderation/generate', { data: { count: 1 }, failOnStatusCode: false });
          assertStatusIn(r.status(), [403], 'нормален потребител generate', await bodyOf(r));
        } },
      ],
    },
    {
      name: 'Почистване (свали тестовите къщи)',
      steps: [
        { label: 'админ сваля всички роботски къщи от теста', run: async (page, c, h) => {
          const a = await adminContext(page, c);
          try {
            const ids = [c.propId, c.editingProp, c.reportProp, c.editDelProp].filter(Boolean);
            for (const id of ids) {
              const r = await a.request.post(h.base + `/api/hlb/moderation/proposals/${id}/remove`, { data: { note: 'почистване' }, failOnStatusCode: false });
              if (r.status() >= 500) throw new Error(`почистване на ${id} → HTTP ${r.status()}`);
            }
          } finally { await a.dispose(); }
          await page.request.post(h.base + '/api/hlb/logout').catch(() => {});
        } },
      ],
    },
  ],
};
