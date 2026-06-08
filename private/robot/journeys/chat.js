// Version: 1.0193
// Чат — ИСТИНСКИ работен поток „като човек" (не просто зареждане на страници):
//   1) Потребител А се РЕГИСТРИРА ПРЕЗ ФОРМАТА /chat/register.html (вкл. каскадата
//      държава→град) и стига до плащането.
//   2) Потребител Б се регистрира (API, за бързина).
//   3) Админ маркира двамата платени → двамата влизат и взимат токени.
//   4) РЕАЛНО ЧАТЕНЕ: А добавя Б за контакт, праща му съобщение, Б го получава —
//      и проверяваме, че съобщението наистина е доставено.
//   5) Профил / matchmaking / сигнали (бързи проверки) → изход.
//
// Анти-бот проверката се изключва от .env (CHAT_DISABLE_CLIENT_CHECK). authLimiter
// може да върне 429 при чести тестове — третираме го като „rate-limited", не бъг.
'use strict';

const bearer = (t) => ({ Authorization: 'Bearer ' + (t || '') });
const blocked = (c) => c.rateLimited || !c.tokenA || !c.tokenB; // няма смисъл без двата токена

module.exports = {
  app: 'chat',
  label: 'Чат (регистрация през формата + двама потребители РЕАЛНО си пишат)',
  writes: true,
  setup(ctx, env) {
    // Два различни валидни телефона (validatePhone: ^\+?\d{10,15}$).
    ctx.phoneA = '+9' + String(1000000000 + (ctx.runNum % 800000000));
    ctx.phoneB = '+9' + String(1000000000 + ((ctx.runNum + 7) % 800000000));
    // Трети телефон — за „чужд" потребител В (жертвата при атаките).
    ctx.phoneC = '+9' + String(1000000000 + ((ctx.runNum + 13) % 800000000));
    ctx.pass = 'Robot12345!';
    ctx.nameA = 'Робот А';
    ctx.nameB = 'Робот Б';
    ctx.nameC = 'Робот В';
    // Админ от .env (authoritet-ът е roles.js: CHAT_ADMIN_USER + CHAT_ADMIN_PASS).
    ctx.adminUser = (env && (env.CHAT_ADMIN_USER || env.CHAT_MOD1)) || '';
    ctx.adminPass = (env && (env.CHAT_ADMIN_PASS || env.CHAT_MOD1_PASS)) || '';
  },
  scenarios: [
    {
      name: 'Потребител А: регистрация ПРЕЗ ФОРМАТА (държава→град каскада → плащане)',
      steps: [
        { goto: '/chat/register.html' },
        { wait: 700 },
        { expect: '#phone' },
        { fill: '#phone', value: (c) => c.phoneA },
        { fill: '#password', value: (c) => c.pass },
        { fill: '#fullName', value: (c) => c.nameA },
        { select: '#gender', value: 'male' },
        { label: 'отвори доп. данни + каскада държава→град', run: async (page, c) => {
          await page.click('details summary').catch(() => {});
          await page.waitForTimeout(300);
          // Държавата е <select> от локалната гео-база; при липса на файловете формата
          // пада към <input> — поддържаме и двете.
          const isSelect = await page.evaluate(() => {
            const s = document.getElementById('country');
            return !!(s && s.tagName === 'SELECT');
          });
          if (isSelect) {
            await page.waitForFunction(() => { const s = document.getElementById('country'); return s && s.options.length > 1; }, { timeout: 5000 }).catch(() => {});
            const okBg = await page.selectOption('#country', 'България').then(() => true).catch(() => false);
            if (!okBg) await page.selectOption('#country', { index: 1 }).catch(() => {});
            const cv = await page.inputValue('#country').catch(() => '');
            if (!cv) throw new Error('каскадата: държавата не се избра (празна стойност)');
            // Изчакай градовете да се заредят СЛЕД избора (това е каскадата) и избери град.
            await page.waitForFunction(() => { const s = document.getElementById('city'); return s && !s.disabled && s.options.length > 1; }, { timeout: 6000 }).catch(() => {});
            await page.selectOption('#city', { index: 1 }).catch(() => {}); // градът е по избор
          } else {
            await page.fill('#country', 'България').catch(() => {});
            await page.fill('#city', 'София').catch(() => {});
          }
          await page.fill('#heightCm', '180').catch(() => {});
          await page.fill('#weightKg', '80').catch(() => {});
        } },
        { label: 'изпрати формата → плащане + вземи userId', run: async (page, c) => {
          await page.click('#regForm button[type="submit"]');
          const res = await Promise.race([
            page.waitForURL(/payment/, { timeout: 7000 }).then(() => 'ok').catch(() => null),
            page.waitForSelector('#message .text-red-400', { timeout: 7000 }).then(() => 'err').catch(() => null),
          ]);
          if (res === 'ok') {
            c.userIdA = await page.evaluate(() => localStorage.getItem('userId'));
            if (!c.userIdA) throw new Error('регистрацията мина, но няма userId в localStorage');
            return;
          }
          const errText = (await page.textContent('#message').catch(() => '') || '').trim();
          if (/limit|429|често|rate/i.test(errText)) { c.rateLimited = true; return; }
          throw new Error('регистрацията през формата се провали: ' + (errText.slice(0, 160) || 'няма пренасочване към плащане'));
        } },
      ],
    },
    {
      name: 'Потребител Б: регистрация (API) + двамата маркирани платени',
      steps: [
        { label: 'регистрирай Б', run: async (page, c, h) => {
          if (c.rateLimited) return;
          const r = await page.request.post(h.base + '/api/auth/register', { data: {
            phone: c.phoneB, password: c.pass, fullName: c.nameB, gender: 'female',
            heightCm: 170, weightKg: 60, country: 'България', city: 'Пловдив',
          } });
          if (r.status() === 429) { c.rateLimited = true; return; }
          const b = await r.json().catch(() => ({}));
          if (!(b.success || b.userId)) throw new Error(`register Б HTTP ${r.status()} ${b.error || ''}`);
          c.userIdB = b.userId;
        } },
        { label: 'админ: маркирай А и Б платени', run: async (page, c, h) => {
          if (c.rateLimited) return;
          for (const uid of [c.userIdA, c.userIdB]) {
            if (!uid) continue;
            const r = await page.request.post(h.base + '/api/admin/update-payment', { data: { userId: uid, months: 1 } });
            if (!r.ok()) throw new Error(`update-payment(${uid}) HTTP ${r.status()}`);
          }
        } },
      ],
    },
    {
      name: 'Двамата влизат (взимат токени)',
      steps: [
        { label: 'вход А и Б', run: async (page, c, h) => {
          if (c.rateLimited) return;
          for (const who of ['A', 'B']) {
            const phone = who === 'A' ? c.phoneA : c.phoneB;
            const r = await page.request.post(h.base + '/api/auth/login', { data: { phone, password: c.pass, client: 'web' } });
            if (r.status() === 429) { c.rateLimited = true; return; }
            const b = await r.json().catch(() => ({}));
            if (r.status() >= 500) throw new Error(`login ${who} HTTP ${r.status()} ${b.error || ''}`);
            if (!b.token) throw new Error(`няма токен за ${who}: ${JSON.stringify(b).slice(0, 100)}`);
            c['token' + who] = b.token;
          }
        } },
      ],
    },
    {
      name: 'РЕАЛНО ЧАТЕНЕ: А добавя Б за контакт → праща съобщение → Б го получава',
      steps: [
        { label: 'А добавя Б за контакт', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/friends', { headers: bearer(c.tokenA), data: { friendPhone: c.phoneB } });
          const b = await r.json().catch(() => ({}));
          if (!r.ok() || !b.success) throw new Error(`добавяне на контакт HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'А праща съобщение на Б', run: async (page, c, h) => {
          if (blocked(c)) return;
          c.msgText = 'Робот тест: здравей, Б! ' + c.runToken;
          const r = await page.request.post(h.base + '/api/messages/send', { headers: bearer(c.tokenA), data: { to: c.phoneB, text: c.msgText } });
          const b = await r.json().catch(() => ({}));
          if (!r.ok() || !b.success) throw new Error(`изпращане на съобщение HTTP ${r.status()} ${b.error || ''}`);
        } },
        { label: 'Б отваря разговора и проверява, че съобщението е доставено', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/messages/' + encodeURIComponent(c.phoneA), { headers: bearer(c.tokenB) });
          const b = await r.json().catch(() => ({}));
          if (!r.ok()) throw new Error(`четене на съобщения HTTP ${r.status()} ${b.error || ''}`);
          const got = (b.messages || []).some(m => m.text === c.msgText);
          if (!got) throw new Error('Б НЕ получи съобщението на А — чатът не достави');
        } },
      ],
    },
    {
      name: 'А: профил + matchmaking + сигнали',
      steps: [
        { label: 'GET /api/profile', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/profile', { headers: bearer(c.tokenA) });
          if (!r.ok()) throw new Error('profile HTTP ' + r.status());
        } },
        { label: 'matchmaking критерии (GET+POST)', run: async (page, c, h) => {
          if (blocked(c)) return;
          let r = await page.request.get(h.base + '/api/matchmaking/criteria', { headers: bearer(c.tokenA) });
          if (!r.ok()) throw new Error('criteria GET HTTP ' + r.status());
          r = await page.request.post(h.base + '/api/matchmaking/criteria', { headers: bearer(c.tokenA), data: { height_min: 160, height_max: 200, age_min: 18, age_max: 99 } });
          if (!r.ok()) throw new Error('criteria POST HTTP ' + r.status());
        } },
        { label: 'GET /api/signals/can-submit', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/signals/can-submit', { headers: bearer(c.tokenA) });
          if (!r.ok()) throw new Error('signals can-submit HTTP ' + r.status());
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // ПЕРСОНА 1 — ВАЛИДЕН + НЕВАЛИДЕН вход: всяко ключово действие веднъж УСПЕШНО
    // и веднъж с лоши данни → очакваме 400-ниво отказ, НИКОГА 500.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Персона 1: ВАЛИДЕН успех + НЕВАЛИДЕН вход (очаквам 400, не 500)',
      steps: [
        { label: 'register: лош телефон → 400 (не 500)', run: async (page, c, h) => {
          if (c.rateLimited) return;
          const r = await page.request.post(h.base + '/api/auth/register', { data: {
            phone: 'не-телефон', password: c.pass, fullName: c.nameC, gender: 'male',
          } });
          if (r.status() === 429) { c.rateLimited = true; return; }
          if (r.status() >= 500) throw new Error('register с лош телефон гръмна с HTTP ' + r.status() + ' (трябва 400)');
          if (r.status() !== 400) throw new Error('register с лош телефон: очаквах 400, върна ' + r.status());
        } },
        { label: 'register: слаба парола → 400 (не 500)', run: async (page, c, h) => {
          if (c.rateLimited) return;
          const r = await page.request.post(h.base + '/api/auth/register', { data: {
            phone: c.phoneC, password: '12', fullName: c.nameC, gender: 'male',
          } });
          if (r.status() === 429) { c.rateLimited = true; return; }
          if (r.status() >= 500) throw new Error('register със слаба парола гръмна с HTTP ' + r.status() + ' (трябва 400)');
          if (r.status() !== 400) throw new Error('register със слаба парола: очаквах 400, върна ' + r.status());
        } },
        { label: 'register: липсващ пол → 400 (не 500)', run: async (page, c, h) => {
          if (c.rateLimited) return;
          const r = await page.request.post(h.base + '/api/auth/register', { data: {
            phone: c.phoneC, password: c.pass, fullName: c.nameC, // gender липсва
          } });
          if (r.status() === 429) { c.rateLimited = true; return; }
          if (r.status() >= 500) throw new Error('register без пол гръмна с HTTP ' + r.status() + ' (трябва 400)');
          if (r.status() !== 400) throw new Error('register без пол: очаквах 400, върна ' + r.status());
        } },
        { label: 'send: ПРАЗНО тяло → 400 (не 500); валидното беше доставено по-горе', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/messages/send', { headers: bearer(c.tokenA), data: { to: c.phoneB, text: '' } });
          if (r.status() >= 500) throw new Error('изпращане на празно съобщение гръмна с HTTP ' + r.status() + ' (трябва 400)');
          if (r.status() !== 400) throw new Error('изпращане на празно съобщение: очаквах 400, върна ' + r.status());
        } },
        { label: 'friends: малформиран телефон → 400 (не 500)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/friends', { headers: bearer(c.tokenA), data: { friendPhone: 'abc-123' } });
          if (r.status() >= 500) throw new Error('добавяне на малформиран контакт гръмна с HTTP ' + r.status() + ' (трябва 400)');
          if (r.status() !== 400) throw new Error('добавяне на малформиран контакт: очаквах 400, върна ' + r.status());
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // ПЕРСОНА 2 — АТАКЕР / „лош потребител": очакваме коректен отказ
    // (401/403/400/404), НИКОГА 500 и НИКОГА изтичане на чужди данни.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Персона 2: атакер (без токен / фалшив токен / чужд ресурс / инжекции)',
      steps: [
        { label: 'защитен ендпойнт БЕЗ токен → 401', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/profile'); // няма Authorization
          if (r.status() >= 500) throw new Error('GET /api/profile без токен гръмна с HTTP ' + r.status());
          if (r.status() !== 401) throw new Error('GET /api/profile без токен: очаквах 401, върна ' + r.status());
        } },
        { label: 'админ-вход с НОРМАЛЕН потребител (телефон като username) → 401/403, не успех', run: async (page, c, h) => {
          if (blocked(c)) return;
          // /api/admin/login е истинската ролева граница за персонал. Нормален
          // потребител НЕ е в admin_users → 401; дори да беше, не е в .env → 403.
          const r = await page.request.post(h.base + '/api/admin/login', { data: { username: c.phoneA, password: c.pass } });
          if (r.status() >= 500) throw new Error('admin/login като нормален потребител гръмна с HTTP ' + r.status());
          if (![401, 403].includes(r.status())) throw new Error('admin/login като нормален потребител: очаквах 401/403, върна ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (b.token) throw new Error('ПРОБИВ: нормален потребител получи админ токен!');
        } },
        { label: 'ФАЛШИВ bearer токен → 401', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.get(h.base + '/api/profile', { headers: bearer('deadbeef-боклук-токен-1234567890') });
          if (r.status() >= 500) throw new Error('GET /api/profile с фалшив токен гръмна с HTTP ' + r.status());
          if (r.status() !== 401) throw new Error('GET /api/profile с фалшив токен: очаквах 401, върна ' + r.status());
        } },
        { label: 'чужд разговор: Б НЕ е приятел с В → 403/404, без чужди данни', run: async (page, c, h) => {
          if (blocked(c)) return;
          // Б опитва да прочете разговора си с phoneC (с когото НЯМА приятелство).
          const r = await page.request.get(h.base + '/api/messages/' + encodeURIComponent(c.phoneC), { headers: bearer(c.tokenB) });
          if (r.status() >= 500) throw new Error('четене на чужд разговор гръмна с HTTP ' + r.status());
          if (![403, 404].includes(r.status())) throw new Error('четене на чужд разговор: очаквах 403/404, върна ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (Array.isArray(b.messages) && b.messages.length > 0) throw new Error('ИЗТИЧАНЕ: атакерът получи чужди съобщения!');
        } },
        { label: 'изпращане до НЕ-приятел → 403/404, не доставка', run: async (page, c, h) => {
          if (blocked(c)) return;
          const r = await page.request.post(h.base + '/api/messages/send', { headers: bearer(c.tokenB), data: { to: c.phoneC, text: 'натрапник' } });
          if (r.status() >= 500) throw new Error('изпращане до не-приятел гръмна с HTTP ' + r.status());
          if (![403, 404].includes(r.status())) throw new Error('изпращане до не-приятел: очаквах 403/404, върна ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (b.success) throw new Error('ПРОБИВ: съобщение до не-приятел беше прието!');
        } },
        { label: 'ОГРОМЕН вход (100k знака) → обработено (не 500)', run: async (page, c, h) => {
          if (blocked(c)) return;
          const huge = 'А'.repeat(100000);
          const r = await page.request.post(h.base + '/api/messages/send', { headers: bearer(c.tokenA), data: { to: c.phoneB, text: huge } });
          if (r.status() >= 500) throw new Error('огромно съобщение гръмна с HTTP ' + r.status() + ' (трябва 400/413, не 500)');
          // >5000 знака → 400 от валидацията; евентуален 413 от body-limit също е ок.
          if (![400, 413].includes(r.status())) throw new Error('огромно съобщение: очаквах 400/413, върна ' + r.status());
        } },
        { label: 'ИНЖЕКЦИИ (SQL/XML) в текст → обработено (не 500)', run: async (page, c, h) => {
          if (blocked(c)) return;
          // Праща се до ВАЛИДЕН приятел (Б), за да минем покрай 403 и да ударим САМО
          // санитизацията/съхранението — целта е „никога 500", не отказ.
          for (const payload of ["'; DROP TABLE users; --", '<script>alert(1)</script>', '" OR 1=1 --']) {
            const r = await page.request.post(h.base + '/api/messages/send', { headers: bearer(c.tokenA), data: { to: c.phoneB, text: payload } });
            if (r.status() >= 500) throw new Error('инжекция „' + payload.slice(0, 20) + '…" гръмна с HTTP ' + r.status());
            if (![200, 400, 403].includes(r.status())) throw new Error('инжекция: неочакван HTTP ' + r.status());
          }
          // Бързо потвърждение, че таблицата users е жива (DROP не е минал).
          const ok = await page.request.get(h.base + '/api/profile', { headers: bearer(c.tokenA) });
          if (!ok.ok()) throw new Error('след инжекциите профилът не се чете (HTTP ' + ok.status() + ') — възможна повреда');
        } },
      ],
    },
    // ════════════════════════════════════════════════════════════════════
    // ПЕРСОНА 3 — МОДЕРАТОР/АДМИН: админ действие работи за персонала, а СЪЩОТО
    // действие е отказано за нормален потребител.
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Персона 3: админ блокира/отблокира; нормалният потребител е отказан (403)',
      steps: [
        { label: 'админ-вход (от .env) → токен', run: async (page, c, h) => {
          if (blocked(c)) return;
          if (!c.adminUser || !c.adminPass) { c.adminSkip = true; return; } // няма .env админ → пропусни тихо
          const r = await page.request.post(h.base + '/api/admin/login', { data: { username: c.adminUser, password: c.adminPass } });
          if (r.status() === 403) { c.adminSkip = true; return; } // IP не е разрешен за админ → пропусни
          if (r.status() >= 500) throw new Error('админ-вход гръмна с HTTP ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (!b.token) { c.adminSkip = true; return; } // няма как да тестваме без админ токен
          c.adminToken = b.token;
        } },
        { label: 'АДМИН блокира тестов потребител Б → успех', run: async (page, c, h) => {
          if (blocked(c) || c.adminSkip) return;
          if (!c.userIdB) { c.adminSkip = true; return; }
          const r = await page.request.post(h.base + '/api/admin/block-users', { headers: bearer(c.adminToken), data: { userIds: [Number(c.userIdB)], reason: 'робот тест' } });
          if (!r.ok()) throw new Error('админ блокиране HTTP ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (!b.success) throw new Error('админ блокиране не успя: ' + JSON.stringify(b).slice(0, 120));
        } },
        { label: 'АДМИН отблокира Б обратно → успех (почистване на ефекта)', run: async (page, c, h) => {
          if (blocked(c) || c.adminSkip) return;
          const r = await page.request.post(h.base + '/api/admin/unblock-user', { headers: bearer(c.adminToken), data: { userId: Number(c.userIdB) } });
          if (!r.ok()) throw new Error('админ отблокиране HTTP ' + r.status());
        } },
        { label: 'НОРМАЛЕН потребител НЕ може да стане админ (admin/login с неговите данни) → 401/403', run: async (page, c, h) => {
          if (blocked(c)) return;
          // Истинската ролева граница: дори да познава паролата си, нормалният
          // потребител не е в .env (roles.js) → admin/login го отказва.
          const r = await page.request.post(h.base + '/api/admin/login', { data: { username: c.phoneB, password: c.pass } });
          if (r.status() >= 500) throw new Error('admin/login като нормален потребител гръмна с HTTP ' + r.status());
          if (![401, 403].includes(r.status())) throw new Error('admin привилегия за нормален потребител: очаквах 401/403, върна ' + r.status());
          const b = await r.json().catch(() => ({}));
          if (b.token) throw new Error('ПРОБИВ: нормален потребител получи админ токен!');
        } },
      ],
    },
    {
      name: 'Изход (двамата)',
      steps: [
        { label: 'logout А и Б', run: async (page, c, h) => {
          if (c.rateLimited) return;
          if (c.tokenA) await page.request.post(h.base + '/api/auth/logout', { headers: bearer(c.tokenA) });
          if (c.tokenB) await page.request.post(h.base + '/api/auth/logout', { headers: bearer(c.tokenB) });
        } },
      ],
    },
  ],
};
