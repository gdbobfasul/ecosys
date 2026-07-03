// Version: 1.0001
// Чат — РАЗШИРЕНИ реални действия (новите функции, които сегашният chat journey не покрива):
//   1) Подготовка: А и Б се регистрират (API), админ ги маркира платени, влизат → токени.
//   2) ЗАДАЧИ — пълен жизнен цикъл: А създава чернова → публикува → Б хваща → чат по задачата →
//      заключване → готово с доклад → А потвърждава плащане. + моите задачи + откази (403/400).
//   3) ЗАПОЗНАНСТВА — покани: А кани Б → Б вижда получената → приема; А блокира в matchmaking.
//   4) АДМИН — блок САМО в запознанства (mm_blocked) + новите изгледи: user-overview, задачи, чат по задача.
//   5) HELP/спешност — контакти, наличност, спешен бутон (платен).
//   6) Изход.
// Всичко чрез API с токени (надеждно, не зависи от формата). Админ заявките: на VM минават по IP,
// на прод по админ токен — затова подаваме токена, ако сме го взели.
'use strict';

const bearer = (t) => ({ Authorization: 'Bearer ' + (t || '') });
const adminH = (c) => (c.adminToken ? bearer(c.adminToken) : {}); // VM: по IP; прод: по токен
const blocked = (c) => c.rateLimited || !c.tokenA || !c.tokenB;

module.exports = {
  app: 'chat',
  label: 'Чат РАЗШИРЕН (задачи + покани + mm_blocked + админ изгледи + спешност)',
  writes: true,
  setup(ctx, env) {
    ctx.phoneA = '+93' + String(100000000 + (ctx.runNum % 800000000));
    ctx.phoneB = '+93' + String(100000000 + ((ctx.runNum + 11) % 800000000));
    ctx.pass = 'Robot12345!';
    ctx.nameA = 'Робот Задачи А';
    ctx.nameB = 'Робот Задачи Б';
    ctx.adminUser = (env && (env.CHAT_ADMIN_USER || env.CHAT_MOD1)) || '';
    ctx.adminPass = (env && (env.CHAT_ADMIN_PASS || env.CHAT_MOD1_PASS)) || '';
  },
  scenarios: [
    {
      name: 'Подготовка: А и Б (API регистрация) → админ платени → вход → токени',
      steps: [
        { label: 'регистрирай А и Б', run: async (page, c, h) => {
          for (const who of ['A', 'B']) {
            const r = await page.request.post(h.base + '/api/auth/register', { data: {
              phone: who === 'A' ? c.phoneA : c.phoneB, password: c.pass,
              fullName: who === 'A' ? c.nameA : c.nameB, gender: who === 'A' ? 'male' : 'female',
              heightCm: 180, weightKg: 75, country: 'България', city: 'София',
            } });
            if (r.status() === 429) { c.rateLimited = true; return; }
            const b = await r.json().catch(() => ({}));
            if (!(b.success || b.userId)) throw new Error(`register ${who} HTTP ${r.status()} ${b.error || ''}`);
            c['userId' + who] = b.userId;
          }
        } },
        { label: 'админ-вход (от .env) → токен (по избор)', run: async (page, c, h) => {
          if (!c.adminUser || !c.adminPass) return;
          const r = await page.request.post(h.base + '/api/admin/login', { data: { username: c.adminUser, password: c.adminPass } });
          if (r.status() >= 500) throw new Error('админ-вход гръмна HTTP ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (b.token) c.adminToken = b.token;
        } },
        { label: 'админ: маркирай А и Б платени', run: async (page, c, h) => {
          if (c.rateLimited) return;
          for (const uid of [c.userIdA, c.userIdB]) {
            if (!uid) continue;
            const r = await page.request.post(h.base + '/api/admin/update-payment', { headers: adminH(c), data: { userId: uid, months: 1 } });
            if (!r.ok()) throw new Error(`update-payment(${uid}) HTTP ${r.status()}`);
          }
        } },
        { label: 'вход А и Б → токени', run: async (page, c, h) => {
          if (c.rateLimited) return;
          for (const who of ['A', 'B']) {
            const r = await page.request.post(h.base + '/api/auth/login', { data: { phone: who === 'A' ? c.phoneA : c.phoneB, password: c.pass, client: 'web' } });
            if (r.status() === 429) { c.rateLimited = true; return; }
            const b = await r.json().catch(() => ({}));
            if (r.status() >= 500) throw new Error(`login ${who} HTTP ${r.status()} ${b.error || ''}`);
            if (!b.token) throw new Error(`няма токен за ${who}: ${JSON.stringify(b).slice(0, 120)}`);
            c['token' + who] = b.token;
          }
        } },
      ],
    },
    {
      name: 'ЗАДАЧИ: А създава → публикува → Б хваща → чат → заключи → готово → А потвърждава',
      steps: [
        { label: 'А създава чернова (POST /api/tasks)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/tasks', { headers: bearer(c.tokenA), data: {
            type: 'local_hands', country: 'България', city: 'София',
            title: 'Робот задача ' + c.runToken, content: 'Донеси документ от точка А до Б.',
            reward_amount: 100, reward_currency: 'EUR',
          } });
          const b = await r.json().catch(() => ({}));
          if (r.status() !== 201 || !b.id) throw new Error(`create task HTTP ${r.status()} ${b.error || ''}`);
          c.taskId = b.id;
        } },
        { label: 'Б НЕ може да публикува чужда задача → 403', run: async (page, c, h) => {
          if (blocked(c) || !c.taskId) return;
          const r = await page.request.post(h.base + '/api/tasks/' + c.taskId + '/publish', { headers: bearer(c.tokenB) });
          if (r.status() >= 500) throw new Error('publish от чужд гръмна HTTP ' + r.status());
          if (r.status() !== 403) throw new Error('publish от чужд: очаквах 403, върна ' + r.status());
        } },
        { label: 'А публикува задачата', run: async (page, c, h) => {
          if (blocked(c) || !c.taskId) return;
          const r = await page.request.post(h.base + '/api/tasks/' + c.taskId + '/publish', { headers: bearer(c.tokenA) });
          const b = await r.json().catch(() => ({}));
          if (!r.ok() || !b.ok) throw new Error(`publish HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'списъкът показва публикуваната задача (GET /api/tasks)', run: async (page, c, h) => {
          if (blocked(c) || !c.taskId) return;
          const r = await page.request.get(h.base + '/api/tasks?country=' + encodeURIComponent('България'), { headers: bearer(c.tokenB) });
          const b = await r.json().catch(() => ({}));
          if (!r.ok()) throw new Error('list tasks HTTP ' + r.status());
          if (!(b.tasks || []).some(t => t.id === c.taskId)) throw new Error('публикуваната задача не е в списъка');
        } },
        { label: 'А НЕ може да хване своя задача → 400', run: async (page, c, h) => {
          if (blocked(c) || !c.taskId) return;
          const r = await page.request.post(h.base + '/api/tasks/' + c.taskId + '/take', { headers: bearer(c.tokenA) });
          if (r.status() >= 500) throw new Error('take на своя задача гръмна HTTP ' + r.status());
          if (r.status() !== 400) throw new Error('take на своя задача: очаквах 400, върна ' + r.status());
        } },
        { label: 'Б хваща задачата (free) ИЛИ изисква плащане (записваме)', run: async (page, c, h) => {
          if (blocked(c) || !c.taskId) return;
          const r = await page.request.post(h.base + '/api/tasks/' + c.taskId + '/take', { headers: bearer(c.tokenB) });
          const b = await r.json().catch(() => ({}));
          if (r.status() >= 500) throw new Error('take HTTP ' + r.status());
          if (b.payment_required) { c.taskNeedsPay = true; return; } // не е free → спираме цикъла тихо
          if (!b.ok) throw new Error(`take не успя: ${JSON.stringify(b).slice(0, 120)}`);
          c.taskTaken = true;
        } },
        { label: 'чат по задачата: Б пише, А чете', run: async (page, c, h) => {
          if (blocked(c) || !c.taskTaken) return;
          let r = await page.request.post(h.base + '/api/tasks/' + c.taskId + '/messages', { headers: bearer(c.tokenB), data: { text: 'Кога да дойда?' } });
          if (!r.ok()) throw new Error('task msg POST HTTP ' + r.status());
          r = await page.request.get(h.base + '/api/tasks/' + c.taskId + '/messages', { headers: bearer(c.tokenA) });
          const b = await r.json().catch(() => ({}));
          if (!r.ok()) throw new Error('task msg GET HTTP ' + r.status());
          if (!(b.messages || []).some(m => /Кога да дойда/.test(m.text))) throw new Error('съобщението по задачата не се вижда');
        } },
        { label: 'Б заключва → готово с доклад; А потвърждава плащане', run: async (page, c, h) => {
          if (blocked(c) || !c.taskTaken) return;
          let r = await page.request.post(h.base + '/api/tasks/' + c.taskId + '/lock', { headers: bearer(c.tokenB) });
          if (!r.ok()) throw new Error('lock HTTP ' + r.status());
          r = await page.request.post(h.base + '/api/tasks/' + c.taskId + '/done', { headers: bearer(c.tokenB), data: { report: 'Готово, предадох документа.' } });
          if (!r.ok()) throw new Error('done HTTP ' + r.status());
          r = await page.request.post(h.base + '/api/tasks/' + c.taskId + '/confirm-paid', { headers: bearer(c.tokenA) });
          if (!r.ok()) throw new Error('confirm-paid HTTP ' + r.status());
        } },
        { label: 'моите задачи (А автор / Б изпълнител)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const ra = await page.request.get(h.base + '/api/tasks/mine/list', { headers: bearer(c.tokenA) });
          if (!ra.ok()) throw new Error('mine/list А HTTP ' + ra.status());
          const rb = await page.request.get(h.base + '/api/tasks/mine/list', { headers: bearer(c.tokenB) });
          if (!rb.ok()) throw new Error('mine/list Б HTTP ' + rb.status());
        } },
      ],
    },
    {
      name: 'ЗАПОЗНАНСТВА: А кани Б → Б приема; А блокира в matchmaking',
      steps: [
        { label: 'А кани Б (POST /api/matchmaking/invite)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/matchmaking/invite', { headers: bearer(c.tokenA), data: { receiverId: c.userIdB } });
          const b = await r.json().catch(() => ({}));
          if (r.status() >= 500) throw new Error('invite HTTP ' + r.status());
          // 400 „вече поканен" е ок при повторно пускане
          if (!(b.success || /already/i.test(b.error || ''))) throw new Error(`invite не успя: ${JSON.stringify(b).slice(0, 120)}`);
        } },
        { label: 'Б вижда получената покана и я приема', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/matchmaking/invitations/received', { headers: bearer(c.tokenB) });
          const b = await r.json().catch(() => ({}));
          if (!r.ok()) throw new Error('received HTTP ' + r.status());
          const inv = (b.invitations || b || []).find(i => i.sender_id === Number(c.userIdA) || i.sender_id === c.userIdA);
          if (inv && inv.id) {
            const ra = await page.request.post(h.base + '/api/matchmaking/invitations/' + inv.id + '/accept', { headers: bearer(c.tokenB) });
            if (ra.status() >= 500) throw new Error('accept HTTP ' + ra.status());
          }
        } },
        { label: 'А вижда изпратените покани', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/matchmaking/invitations/sent', { headers: bearer(c.tokenA) });
          if (!r.ok()) throw new Error('sent HTTP ' + r.status());
        } },
      ],
    },
    {
      name: 'АДМИН: блок САМО в matchmaking (mm_blocked) + нови изгледи (user-overview/задачи/чат)',
      steps: [
        { label: 'админ блокира Б само в запознанства', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/admin/matchmaking-block', { headers: adminH(c), data: { userId: Number(c.userIdB), blocked: true } });
          if (r.status() === 401 || r.status() === 403) { c.adminNoAccess = true; return; }
          const b = await r.json().catch(() => ({}));
          if (!r.ok() || !b.success) throw new Error(`matchmaking-block HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'админ user-overview за Б → структура + mmBlocked=true', run: async (page, c, h) => {
          if (blocked(c) || c.adminNoAccess) return;
          const r = await page.request.get(h.base + '/api/admin/user-overview/' + c.userIdB, { headers: adminH(c) });
          const b = await r.json().catch(() => ({}));
          if (!r.ok()) throw new Error('user-overview HTTP ' + r.status());
          if (!b.user || !b.matchmaking || !('friends' in b) || !('payments' in b) || !b.tasks) throw new Error('user-overview: липсва раздел в отговора');
          if (b.matchmaking.mmBlocked !== true) throw new Error('user-overview: mmBlocked не е true след блокиране');
        } },
        { label: 'админ списък задачи + чат по нашата задача', run: async (page, c, h) => {
          if (blocked(c) || c.adminNoAccess) return;
          let r = await page.request.get(h.base + '/api/admin/tasks', { headers: adminH(c) });
          if (!r.ok()) throw new Error('admin/tasks HTTP ' + r.status());
          if (c.taskId) {
            r = await page.request.get(h.base + '/api/admin/task/' + c.taskId, { headers: adminH(c) });
            const b = await r.json().catch(() => ({}));
            if (!r.ok() || !b.task) throw new Error('admin/task/:id HTTP ' + r.status());
          }
        } },
        { label: 'админ отблокира Б в запознанства (почистване)', run: async (page, c, h) => {
          if (blocked(c) || c.adminNoAccess) return;
          const r = await page.request.post(h.base + '/api/admin/matchmaking-block', { headers: adminH(c), data: { userId: Number(c.userIdB), blocked: false } });
          if (!r.ok()) throw new Error('unblock matchmaking HTTP ' + r.status());
        } },
      ],
    },
    {
      name: 'HELP/спешност: контакти + наличност + спешен бутон (платен)',
      steps: [
        { label: 'GET /api/help/emergency-contacts', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/help/emergency-contacts?country=BG', { headers: bearer(c.tokenA) });
          if (r.status() >= 500) throw new Error('emergency-contacts HTTP ' + r.status());
        } },
        { label: 'GET /api/help/availability', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/help/availability', { headers: bearer(c.tokenA) });
          if (r.status() >= 500) throw new Error('availability HTTP ' + r.status());
        } },
        { label: 'спешен бутон (А, платен): 200 или 429 „веднъж месечно", не 500', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/help/emergency', { headers: bearer(c.tokenA), data: { latitude: 42.6977, longitude: 23.3219 } });
          if (r.status() >= 500) throw new Error('emergency гръмна HTTP ' + r.status());
          if (![200, 429, 403].includes(r.status())) throw new Error('emergency: неочакван HTTP ' + r.status());
        } },
      ],
    },
    {
      name: 'Изход (двамата)',
      steps: [
        { label: 'logout А и Б', run: async (page, c, h) => {
          if (c.tokenA) await page.request.post(h.base + '/api/auth/logout', { headers: bearer(c.tokenA) });
          if (c.tokenB) await page.request.post(h.base + '/api/auth/logout', { headers: bearer(c.tokenB) });
        } },
      ],
    },
  ],
};
