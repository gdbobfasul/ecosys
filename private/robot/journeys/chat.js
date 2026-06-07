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
  setup(ctx) {
    // Два различни валидни телефона (validatePhone: ^\+?\d{10,15}$).
    ctx.phoneA = '+9' + String(1000000000 + (ctx.runNum % 800000000));
    ctx.phoneB = '+9' + String(1000000000 + ((ctx.runNum + 7) % 800000000));
    ctx.pass = 'Robot12345!';
    ctx.nameA = 'Робот А';
    ctx.nameB = 'Робот Б';
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
