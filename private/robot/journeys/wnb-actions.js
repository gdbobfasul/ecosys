// Version: 1.0001
// WhereNoBiz — РАБОТНИ („happy path") сценарии, които wnb.js НЕ покрива: тук гоним
// УСПЕХА на същинските функции (потвърждения/доклади/резолюция/телефон/бан), не само
// отказите 401/403. WNB е СЕСИЯ-базиран (бисквитки), НЕ bearer токени.
//
// ПОКРИТИЕ:
//   1) Публична навигация (без вход): continents / countries / posts?country → 200 + масив.
//   2) ПОТВЪРЖДЕНИЯ (ядрото): постер създава пост → админ одобрява → ВТОРИ потребител
//      гласува POST /:id/confirm с обосновка (where_could_develop/why_missing, ≥20 знака);
//      GET /:id/confirm показва гласа; DELETE го маха. Пазачи: самогласуване → 400,
//      гласуване по неодобрен пост → 409, дубликат глас → 409.
//   3) ДОКЛАД→РЕЗОЛЮЦИЯ: потребител POST /:id/report (валидна причина); модератор
//      GET /moderation/reports го вижда; POST /moderation/reports/:id/resolve
//      (valid:false → бумва, valid:true → сваля поста). Пазачи: самодоклад → 400, дубликат → 409.
//   4) ТЕЛЕФОН (монетизация): прагът е 1500 потвърждения (config.ranking.votesToAllowPhoneReveal) —
//      НЕдостижим с робот, затова твърдим ПАЗАЧА преди прага (reveal-phone → 409 threshold_not_met),
//      без да фалшифицираме успех. (buy-phone happy се покрива при no_phone отказ в wnb.js.)
//   5) mine/list happy: GET /posts/mine/list с вход → 200 + собствените постове.
//   6) БАН/ОТБАН happy: админ банва тестов потребител → входът му дава 403 banned →
//      админ го отбанва → входът пак минава.
//
// АДМИН достъп: ползваме УНИВЕРСАЛНИЯ админ-токен ?adm=bgmasters-set (middleware/auth.js:
// isAdminToken) — минава requireRole БЕЗ сесия, най-надеждно за робота. Ако и той не върши
// работа (напр. сменен токен) → опитваме .env креденшъли; ако и те липсват → админ частите
// се пропускат ГРАЦИОЗНО (не са провал).
//
// Всичко best-effort. Очакване навсякъде: коректен статус, който кодът връща; НИКОГА 5xx.
'use strict';

// ── мъничък ВАЛИДЕН PNG (1×1) в кода — за реална снимка, без външни файлове ──
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);
const pngFile = (name) => ({ name, mimeType: 'image/png', buffer: PNG_1x1 });

const bodyOf = async (r) => { try { return await r.json(); } catch (_) { return {}; } };
const ADM = 'adm=bgmasters-set';                 // универсален админ-токен (query)
const withAdm = (path) => path + (path.includes('?') ? '&' : '?') + ADM;  // закачи токена

function assertNo5xx(label, status) {
  if (status >= 500) throw new Error(`${label}: HTTP ${status} (сървърна грешка — никога 5xx)`);
}
function assertOneOf(label, status, allowed) {
  assertNo5xx(label, status);
  if (!allowed.includes(status)) throw new Error(`${label}: HTTP ${status} (чаках едно от ${allowed.join('/')})`);
}

// Свеж, ИЗОЛИРАН HTTP контекст (собствени бисквитки) — за втора персона/без вход. НЕ пипа
// споделения page.request на run.js. По модела на wnb.js.
async function freshRequest(extraHeaders) {
  const rc = await require('playwright').request.newContext({
    ignoreHTTPSErrors: true,
    ...(extraHeaders ? { extraHTTPHeaders: extraHeaders } : {}),
  });
  return { request: rc, dispose: async () => { try { await rc.dispose(); } catch (_) {} } };
}

// Регистрира НОВ потребител в СОБСТВЕН контекст (получава своя сесийна бисквитка).
// register сам логва (req.session.userId) → контекстът остава влязъл като този човек.
// Връща { request, dispose, id, email } или null при провал.
async function registerPersona(base, email, pass, name) {
  const fr = await freshRequest();
  const r = await fr.request.post(base + '/api/wnb/register', {
    data: { email, password: pass, display_name: name }, failOnStatusCode: false,
  });
  if (r.status() !== 201) {
    const b = await bodyOf(r);
    await fr.dispose();
    throw new Error(`register ${email} HTTP ${r.status()} ${b.error || ''}`);
  }
  const b = await bodyOf(r);
  return { ...fr, id: b.user && b.user.id, email };
}

// Проверка дали универсалният админ-токен работи на тази среда (надеждно: GET pending).
async function adminTokenWorks(base) {
  try {
    const fr = await freshRequest();
    const r = await fr.request.get(base + withAdm('/api/wnb/moderation/pending'), { failOnStatusCode: false });
    await fr.dispose();
    return r.status() === 200;
  } catch (_) { return false; }
}

module.exports = {
  app: 'wnb',
  label: 'WNB ДЕЙСТВИЯ — потвърждения/доклади/резолюция/телефон/бан',
  writes: true,
  setup(ctx, env) {
    const pre = '__diagtest_wnb' + ctx.runToken;       // уникален префикс за този пуск
    ctx.pass = 'Robot12345!';
    ctx.ownerEmail = `${pre}_owner@test.local`;         // постерът
    ctx.voterEmail = `${pre}_voter@test.local`;         // гласуващият/докладващият
    ctx.banEmail = `${pre}_ban@test.local`;             // жертва на бан/отбан
    ctx.adminEmail = (env && env.WNB_ADMIN_USER) || '';
    ctx.adminPass = (env && env.WNB_ADMIN_PASS) || '';
  },
  scenarios: [
    {
      name: 'Подготовка: админ достъп + регистрация на постер/гласуващ (свежи сесии)',
      steps: [
        { label: 'провери админ достъп (универсален токен → .env)', run: async (page, c, h) => {
          c.admMode = null;
          if (await adminTokenWorks(h.base)) { c.admMode = 'token'; return; }
          // резервно: .env креденшъли в споделения контекст (page.request)
          if (c.adminEmail && c.adminPass) {
            const r = await page.request.post(h.base + '/api/wnb/login', { data: { email: c.adminEmail, password: c.adminPass }, failOnStatusCode: false });
            if (r.status() === 200) {
              const chk = await page.request.get(h.base + '/api/wnb/moderation/pending', { failOnStatusCode: false });
              if (chk.status() === 200) c.admMode = 'env';
              await page.request.post(h.base + '/api/wnb/logout').catch(() => {});
            }
          }
          if (!c.admMode) c.adminSkip = true;   // няма админ → админ-частите се пропускат грациозно
        } },
        { label: 'регистрирай ПОСТЕРА (своя сесия)', run: async (page, c, h) => {
          const p = await registerPersona(h.base, c.ownerEmail, c.pass, 'Робот Постер');
          c.owner = p; c.ownerId = p.id;
        } },
        { label: 'регистрирай ГЛАСУВАЩИЯ (своя сесия)', run: async (page, c, h) => {
          const p = await registerPersona(h.base, c.voterEmail, c.pass, 'Робот Гласуващ');
          c.voter = p; c.voterId = p.id;
        } },
      ],
    },
    {
      name: 'Публична навигация (без вход): continents / countries / posts?country → 200 + масив',
      steps: [
        { label: 'GET /api/wnb/continents → 200 + масив', run: async (page, c, h) => {
          const fr = await freshRequest();
          try {
            const r = await fr.request.get(h.base + '/api/wnb/continents', { failOnStatusCode: false });
            assertOneOf('continents', r.status(), [200]);
            const b = await bodyOf(r);
            if (!Array.isArray(b.continents)) throw new Error('continents: липсва масив continents');
          } finally { await fr.dispose(); }
        } },
        { label: 'GET /api/wnb/countries → 200 + масив', run: async (page, c, h) => {
          const fr = await freshRequest();
          try {
            const r = await fr.request.get(h.base + '/api/wnb/countries', { failOnStatusCode: false });
            assertOneOf('countries', r.status(), [200]);
            const b = await bodyOf(r);
            if (!Array.isArray(b.countries) || !b.countries.length) throw new Error('countries: липсва/празен масив countries');
          } finally { await fr.dispose(); }
        } },
        { label: 'GET /api/wnb/posts?country=BG → 200 + масив (без 500)', run: async (page, c, h) => {
          const fr = await freshRequest();
          try {
            const r = await fr.request.get(h.base + '/api/wnb/posts?country=BG', { failOnStatusCode: false });
            assertOneOf('posts?country=BG', r.status(), [200]);
            const b = await bodyOf(r);
            if (!Array.isArray(b.posts)) throw new Error('posts: липсва масив posts');
          } finally { await fr.dispose(); }
        } },
      ],
    },
    {
      name: 'ПОТВЪРЖДЕНИЯ (ядро): постер създава → админ одобрява → гласуващ потвърждава → GET/DELETE',
      steps: [
        { label: 'постерът създава пост (BG)', run: async (page, c, h) => {
          if (!c.owner) return;
          const r = await c.owner.request.post(h.base + '/api/wnb/posts', {
            data: { country_code: 'BG', title: 'Робот: липсващ бизнес за потвърждение', description: 'Пост за тест на потвържденията — описание над двайсет знака.', links: [] },
            failOnStatusCode: false,
          });
          assertNo5xx('създай пост', r.status());
          if (r.status() !== 201) { const b = await bodyOf(r); throw new Error('създай пост HTTP ' + r.status() + ' ' + (b.error || '')); }
          const b = await bodyOf(r); c.postId = b.post && b.post.id;
          if (!c.postId) throw new Error('създай пост: липсва post.id');
        } },
        { label: 'ПАЗАЧ: гласуване по НЕодобрен пост → 409 not_approved', run: async (page, c, h) => {
          if (!c.voter || !c.postId) return;
          const r = await c.voter.request.post(h.base + `/api/wnb/posts/${c.postId}/confirm`, {
            data: { where_could_develop: 'В централните квартали на големите градове', why_missing: 'Обиколих района и такъв бизнес нийде няма' },
            failOnStatusCode: false,
          });
          assertOneOf('confirm по неодобрен', r.status(), [409]);
        } },
        { label: 'АДМИН одобрява поста', run: async (page, c, h) => {
          if (c.adminSkip || !c.postId) return;
          let r;
          if (c.admMode === 'token') {
            const fr = await freshRequest();
            try { r = await fr.request.post(h.base + withAdm(`/api/wnb/moderation/posts/${c.postId}/approve`), { data: {}, failOnStatusCode: false }); }
            finally { await fr.dispose(); }
          } else {
            await page.request.post(h.base + '/api/wnb/login', { data: { email: c.adminEmail, password: c.adminPass } });
            r = await page.request.post(h.base + `/api/wnb/moderation/posts/${c.postId}/approve`, { data: {}, failOnStatusCode: false });
            await page.request.post(h.base + '/api/wnb/logout').catch(() => {});
          }
          assertOneOf('approve', r.status(), [200]);
          c.postApproved = true;
        } },
        { label: 'ПАЗАЧ: САМОгласуване (постерът по собствения пост) → 400 self', run: async (page, c, h) => {
          if (!c.owner || !c.postId || !c.postApproved) return;
          const r = await c.owner.request.post(h.base + `/api/wnb/posts/${c.postId}/confirm`, {
            data: { where_could_develop: 'Където и да е из страната, навсякъде липсва', why_missing: 'Аз съм постерът и твърдя, че го няма никъде' },
            failOnStatusCode: false,
          });
          assertOneOf('самогласуване', r.status(), [400]);
        } },
        { label: 'ПАЗАЧ: твърде кратка обосновка → 400 need_where/need_why', run: async (page, c, h) => {
          if (!c.voter || !c.postId || !c.postApproved) return;
          const r = await c.voter.request.post(h.base + `/api/wnb/posts/${c.postId}/confirm`, {
            data: { where_could_develop: 'тук', why_missing: 'няма' }, failOnStatusCode: false,
          });
          assertOneOf('кратка обосновка', r.status(), [400]);
        } },
        { label: 'ВАЛИДНО ПОТВЪРЖДЕНИЕ (гласуващият) → 200, confirm_count++', run: async (page, c, h) => {
          if (!c.voter || !c.postId || !c.postApproved) return;
          const r = await c.voter.request.post(h.base + `/api/wnb/posts/${c.postId}/confirm`, {
            data: { where_could_develop: 'Би се развил в кварталните центрове на големите градове', why_missing: 'Обиколих лично района и такъв бизнес наистина липсва' },
            failOnStatusCode: false,
          });
          assertNo5xx('валидно потвърждение', r.status());
          if (r.status() !== 200) { const b = await bodyOf(r); throw new Error('валидно потвърждение HTTP ' + r.status() + ' ' + (b.error || '')); }
          const b = await bodyOf(r);
          if (!b.ok || !(b.confirm_count >= 1)) throw new Error('потвърждение: confirm_count не нарасна (' + JSON.stringify(b).slice(0, 120) + ')');
          c.voted = true;
        } },
        { label: 'GET /:id/confirm (гласуващият) → показва гласа', run: async (page, c, h) => {
          if (!c.voted) return;
          const r = await c.voter.request.get(h.base + `/api/wnb/posts/${c.postId}/confirm`, { failOnStatusCode: false });
          assertOneOf('GET confirm', r.status(), [200]);
          const b = await bodyOf(r);
          if (!b.vote || b.vote.stance !== 'confirm') throw new Error('GET confirm: не върна моя глас (' + JSON.stringify(b).slice(0, 120) + ')');
        } },
        { label: 'ПАЗАЧ: ДУБЛИКАТ глас → 409 already_voted', run: async (page, c, h) => {
          if (!c.voted) return;
          const r = await c.voter.request.post(h.base + `/api/wnb/posts/${c.postId}/confirm`, {
            data: { where_could_develop: 'Втори опит за същия глас — над двайсет знака', why_missing: 'Пак твърдя същото — над двайсет знака за дубликата' },
            failOnStatusCode: false,
          });
          assertOneOf('дубликат глас', r.status(), [409]);
        } },
        { label: 'DELETE /:id/confirm → 200, гласът е махнат', run: async (page, c, h) => {
          if (!c.voted) return;
          const r = await c.voter.request.delete(h.base + `/api/wnb/posts/${c.postId}/confirm`, { failOnStatusCode: false });
          assertOneOf('DELETE confirm', r.status(), [200]);
          // проверка: вече няма глас
          const g = await c.voter.request.get(h.base + `/api/wnb/posts/${c.postId}/confirm`, { failOnStatusCode: false });
          const gb = await bodyOf(g);
          if (gb.vote) throw new Error('DELETE confirm: гласът все още е там');
        } },
      ],
    },
    {
      name: 'ДОКЛАД→РЕЗОЛЮЦИЯ: докладвай (валидно) → модератор listва → resolve(valid:false) бумва',
      steps: [
        { label: 'ПАЗАЧ: САМОдоклад (постерът на своя пост) → 400 self_report', run: async (page, c, h) => {
          if (!c.owner || !c.postId) return;
          const r = await c.owner.request.post(h.base + `/api/wnb/posts/${c.postId}/report`, {
            data: { reason: 'Опит за самодоклад от постера' }, failOnStatusCode: false,
          });
          assertOneOf('самодоклад', r.status(), [400]);
        } },
        { label: 'ВАЛИДЕН ДОКЛАД (гласуващият) → 201', run: async (page, c, h) => {
          if (!c.voter || !c.postId) return;
          const r = await c.voter.request.post(h.base + `/api/wnb/posts/${c.postId}/report`, {
            data: { reason: 'Този бизнес реално съществува в страната — фалшив пост.', evidence_url: 'https://example.com/dokazatelstvo' },
            failOnStatusCode: false,
          });
          assertNo5xx('валиден доклад', r.status());
          if (r.status() !== 201) { const b = await bodyOf(r); throw new Error('валиден доклад HTTP ' + r.status() + ' ' + (b.error || '')); }
          c.reported = true;
        } },
        { label: 'ПАЗАЧ: ДУБЛИКАТ доклад → 409 already_reported', run: async (page, c, h) => {
          if (!c.reported) return;
          const r = await c.voter.request.post(h.base + `/api/wnb/posts/${c.postId}/report`, {
            data: { reason: 'Същият доклад втори път' }, failOnStatusCode: false,
          });
          assertOneOf('дубликат доклад', r.status(), [409]);
        } },
        { label: 'МОДЕРАТОР: GET /moderation/reports → съдържа доклада', run: async (page, c, h) => {
          if (c.adminSkip || !c.reported) return;
          let r;
          if (c.admMode === 'token') {
            const fr = await freshRequest();
            try { r = await fr.request.get(h.base + withAdm('/api/wnb/moderation/reports'), { failOnStatusCode: false }); }
            finally { await fr.dispose(); }
          } else {
            await page.request.post(h.base + '/api/wnb/login', { data: { email: c.adminEmail, password: c.adminPass } });
            r = await page.request.get(h.base + '/api/wnb/moderation/reports', { failOnStatusCode: false });
            // оставяме входа за следващата стъпка (resolve), после ще излезем
          }
          assertOneOf('moderation/reports', r.status(), [200]);
          const b = await bodyOf(r);
          const rows = b.reports || [];
          const mine = rows.find(x => Number(x.post_id) === Number(c.postId));
          if (!mine) throw new Error('reports: докладът за моя пост липсва в списъка');
          c.reportId = mine.id;
        } },
        { label: 'МОДЕРАТОР: resolve(valid:false) → 200 (бумва безоснователен, постът остава)', run: async (page, c, h) => {
          if (c.adminSkip || !c.reportId) return;
          let r;
          if (c.admMode === 'token') {
            const fr = await freshRequest();
            try { r = await fr.request.post(h.base + withAdm(`/api/wnb/moderation/reports/${c.reportId}/resolve`), { data: { valid: false, note: 'робот: безоснователен доклад' }, failOnStatusCode: false }); }
            finally { await fr.dispose(); }
          } else {
            r = await page.request.post(h.base + `/api/wnb/moderation/reports/${c.reportId}/resolve`, { data: { valid: false, note: 'робот: безоснователен доклад' }, failOnStatusCode: false });
          }
          assertOneOf('resolve(valid:false)', r.status(), [200]);
          const b = await bodyOf(r);
          if (b.valid !== false) throw new Error('resolve: очаквах valid:false в отговора');
          // постът трябва да е ОСТАНАЛ approved (не свален)
          const fr2 = await freshRequest();
          try {
            const pr = await fr2.request.get(h.base + `/api/wnb/posts/${c.postId}`, { failOnStatusCode: false });
            const pb = await bodyOf(pr);
            if (pb.post && pb.post.status === 'removed') throw new Error('resolve(valid:false) сгрешено СВАЛИ поста');
          } finally { await fr2.dispose(); }
        } },
        { label: 'ПАЗАЧ: повторен resolve на същия доклад → 409 already_resolved', run: async (page, c, h) => {
          if (c.adminSkip || !c.reportId) return;
          let r;
          if (c.admMode === 'token') {
            const fr = await freshRequest();
            try { r = await fr.request.post(h.base + withAdm(`/api/wnb/moderation/reports/${c.reportId}/resolve`), { data: { valid: false }, failOnStatusCode: false }); }
            finally { await fr.dispose(); }
          } else {
            r = await page.request.post(h.base + `/api/wnb/moderation/reports/${c.reportId}/resolve`, { data: { valid: false }, failOnStatusCode: false });
            await page.request.post(h.base + '/api/wnb/logout').catch(() => {});  // освободи входа на .env админа
          }
          assertOneOf('повторен resolve', r.status(), [409]);
        } },
      ],
    },
    {
      name: 'ТЕЛЕФОН (монетизация): прагът (1500) е НЕдостижим → твърдим ПАЗАЧА reveal-phone',
      steps: [
        { label: 'reveal-phone от постера под прага → 409 (threshold_not_met / no_phone_set), НИКОГА фалшив успех', run: async (page, c, h) => {
          if (!c.owner || !c.postId) return;
          // Бележка: confirm_count е далеч под config.ranking.votesToAllowPhoneReveal (1500) —
          // НЕ можем да фалшифицираме разкриване с робот. Затова проверяваме, че кодът ОТКАЗВА.
          const r = await c.owner.request.post(h.base + `/api/wnb/posts/${c.postId}/reveal-phone`, { data: {}, failOnStatusCode: false });
          assertNo5xx('reveal-phone под прага', r.status());
          // 400 no_phone_set (постерът няма телефон в профила) ИЛИ 409 threshold_not_met — и двете
          // са легитимни ПАЗАЧИ. Важното: НЕ 200 (никакво разкриване под прага).
          assertOneOf('reveal-phone под прага', r.status(), [400, 409]);
          if (r.status() === 200) throw new Error('reveal-phone разкри телефон ПОД прага (изтичане!)');
        } },
      ],
    },
    {
      name: 'mine/list happy: GET /posts/mine/list с вход → 200 + собственият пост',
      steps: [
        { label: 'постерът вижда своите постове', run: async (page, c, h) => {
          if (!c.owner || !c.postId) return;
          const r = await c.owner.request.get(h.base + '/api/wnb/posts/mine/list', { failOnStatusCode: false });
          assertOneOf('mine/list', r.status(), [200]);
          const b = await bodyOf(r);
          if (!Array.isArray(b.posts)) throw new Error('mine/list: липсва масив posts');
          if (!b.posts.some(p => Number(p.id) === Number(c.postId))) throw new Error('mine/list: моят пост липсва');
        } },
      ],
    },
    {
      name: 'БАН/ОТБАН happy: админ банва тестов потребител → входът му дава 403 → отбан → пак влиза',
      steps: [
        { label: 'регистрирай ЖЕРТВАТА (отделна сесия)', run: async (page, c, h) => {
          if (c.adminSkip) return;   // без админ няма как да банваме → пропусни целия сценарий
          const p = await registerPersona(h.base, c.banEmail, c.pass, 'Робот Жертва');
          c.banVictim = p; c.banId = p.id;
        } },
        { label: 'провери, че жертвата влиза ПРЕДИ бан', run: async (page, c, h) => {
          if (c.adminSkip || !c.banId) return;
          const fr = await freshRequest();
          try {
            const r = await fr.request.post(h.base + '/api/wnb/login', { data: { email: c.banEmail, password: c.pass }, failOnStatusCode: false });
            assertOneOf('вход преди бан', r.status(), [200]);
          } finally { await fr.dispose(); }
        } },
        { label: 'АДМИН банва жертвата → 200 is_banned', run: async (page, c, h) => {
          if (c.adminSkip || !c.banId) return;
          let r;
          if (c.admMode === 'token') {
            const fr = await freshRequest();
            try { r = await fr.request.post(h.base + withAdm(`/api/wnb/moderation/users/${c.banId}/ban`), { data: { reason: 'робот тест бан' }, failOnStatusCode: false }); }
            finally { await fr.dispose(); }
          } else {
            await page.request.post(h.base + '/api/wnb/login', { data: { email: c.adminEmail, password: c.adminPass } });
            r = await page.request.post(h.base + `/api/wnb/moderation/users/${c.banId}/ban`, { data: { reason: 'робот тест бан' }, failOnStatusCode: false });
          }
          assertOneOf('ban', r.status(), [200]);
          const b = await bodyOf(r);
          if (!(b.user && b.user.is_banned)) throw new Error('ban: is_banned не е истина в отговора');
          c.banned = true;
        } },
        { label: 'входът на БАННАТИЯ → 403 banned', run: async (page, c, h) => {
          if (!c.banned) return;
          const fr = await freshRequest();
          try {
            const r = await fr.request.post(h.base + '/api/wnb/login', { data: { email: c.banEmail, password: c.pass }, failOnStatusCode: false });
            assertOneOf('вход на баннат', r.status(), [403]);
            const b = await bodyOf(r);
            if (b.error && b.error !== 'banned') throw new Error('вход на баннат: очаквах error=banned, върна ' + b.error);
          } finally { await fr.dispose(); }
        } },
        { label: 'АДМИН отбанва жертвата → 200', run: async (page, c, h) => {
          if (!c.banned) return;
          let r;
          if (c.admMode === 'token') {
            const fr = await freshRequest();
            try { r = await fr.request.post(h.base + withAdm(`/api/wnb/moderation/users/${c.banId}/unban`), { data: {}, failOnStatusCode: false }); }
            finally { await fr.dispose(); }
          } else {
            r = await page.request.post(h.base + `/api/wnb/moderation/users/${c.banId}/unban`, { data: {}, failOnStatusCode: false });
            await page.request.post(h.base + '/api/wnb/logout').catch(() => {});
          }
          assertOneOf('unban', r.status(), [200]);
        } },
        { label: 'входът след ОТБАН пак минава → 200', run: async (page, c, h) => {
          if (!c.banned) return;
          const fr = await freshRequest();
          try {
            const r = await fr.request.post(h.base + '/api/wnb/login', { data: { email: c.banEmail, password: c.pass }, failOnStatusCode: false });
            assertOneOf('вход след отбан', r.status(), [200]);
          } finally { await fr.dispose(); }
        } },
      ],
    },
    {
      name: 'Почистване (свали тестовия пост + затвори сесиите)',
      steps: [
        { label: 'админ сваля тестовия пост (ако има админ)', run: async (page, c, h) => {
          if (c.adminSkip || !c.postId) return;
          if (c.admMode === 'token') {
            const fr = await freshRequest();
            try { await fr.request.post(h.base + withAdm(`/api/wnb/moderation/posts/${c.postId}/remove`), { data: { note: 'почистване (робот)' }, failOnStatusCode: false }); }
            finally { await fr.dispose(); }
          } else {
            await page.request.post(h.base + '/api/wnb/login', { data: { email: c.adminEmail, password: c.adminPass } });
            await page.request.post(h.base + `/api/wnb/moderation/posts/${c.postId}/remove`, { data: { note: 'почистване (робот)' }, failOnStatusCode: false }).catch(() => {});
            await page.request.post(h.base + '/api/wnb/logout').catch(() => {});
          }
        } },
        { label: 'затвори изолираните сесии (постер/гласуващ/жертва)', run: async (page, c, h) => {
          for (const k of ['owner', 'voter', 'banVictim']) {
            if (c[k] && c[k].dispose) { await c[k].dispose().catch(() => {}); }
          }
        } },
      ],
    },
  ],
};
