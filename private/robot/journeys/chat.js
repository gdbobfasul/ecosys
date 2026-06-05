// Version: 1.0173
// Чат — ПЪЛЕН работен поток „като човек":
//   входна форма → регистрация → (админ маркира платен) → вход с токен →
//   профил → matchmaking критерии → сигнали → изход.
// Анти-бот проверката се изключва от .env (CHAT_DISABLE_CLIENT_CHECK). authLimiter
// може да върне 429 при чести тестове — третираме го като „rate-limited", не бъг.
'use strict';

const auth = (c) => ({ Authorization: 'Bearer ' + (c.token || '') });
const skip = (c) => c.rateLimited || !c.token; // няма смисъл без токен

module.exports = {
  app: 'chat',
  label: 'Чат (пълен поток: регистрация → плащане → токен → действия)',
  writes: true,
  setup(ctx) {
    ctx.phone = '+9' + String(1000000000 + (ctx.runNum % 800000000)); // ~11 цифри
    ctx.pass = 'Robot12345!';
  },
  scenarios: [
    {
      name: 'Входната форма се зарежда (UI)',
      steps: [
        { goto: '/chat/public/index.html' },
        { expect: '#phone' },
        { expect: '#password' },
      ],
    },
    {
      name: 'Регистрация (API)',
      steps: [
        { label: 'регистрирай тестов потребител', run: async (page, c, h) => {
          const r = await page.request.post(h.base + '/api/auth/register', { data: {
            phone: c.phone, password: c.pass, fullName: 'Робот Тест', gender: 'male',
            heightCm: 180, weightKg: 80, country: 'България', city: 'София',
          } });
          if (r.status() === 429) { c.rateLimited = true; return; } // rate limit — не е бъг
          const b = await r.json().catch(() => ({}));
          if (!(b.success || b.userId)) throw new Error(`register HTTP ${r.status()} ${b.error || ''}`);
          c.userId = b.userId;
        } },
      ],
    },
    {
      name: 'Админ маркира потребителя платен',
      steps: [
        { label: 'POST /api/admin/update-payment', run: async (page, c, h) => {
          if (c.rateLimited || !c.userId) return;
          const r = await page.request.post(h.base + '/api/admin/update-payment', { data: { userId: c.userId, months: 1 } });
          if (!r.ok()) throw new Error(`update-payment HTTP ${r.status()}`);
        } },
      ],
    },
    {
      name: 'Вход → токен (вече платен)',
      steps: [
        { label: 'вход и вземи токен', run: async (page, c, h) => {
          if (c.rateLimited) return;
          const r = await page.request.post(h.base + '/api/auth/login', { data: { phone: c.phone, password: c.pass, client: 'web' } });
          if (r.status() === 429) { c.rateLimited = true; return; }
          const b = await r.json().catch(() => ({}));
          if (r.status() >= 500) throw new Error(`login HTTP ${r.status()} ${b.error || ''}`);
          if (b.token) c.token = b.token;
          else throw new Error(`няма токен след плащане: ${JSON.stringify(b).slice(0, 100)}`);
        } },
      ],
    },
    {
      name: 'Профил с токена (GET)',
      steps: [
        { label: 'GET /api/profile', run: async (page, c, h) => {
          if (skip(c)) return;
          const r = await page.request.get(h.base + '/api/profile', { headers: auth(c) });
          if (!r.ok()) throw new Error('profile HTTP ' + r.status());
        } },
      ],
    },
    {
      name: 'Matchmaking — критерии (GET + запази)',
      steps: [
        { label: 'GET критерии', run: async (page, c, h) => {
          if (skip(c)) return;
          const r = await page.request.get(h.base + '/api/matchmaking/criteria', { headers: auth(c) });
          if (!r.ok()) throw new Error('criteria GET HTTP ' + r.status());
        } },
        { label: 'POST критерии', run: async (page, c, h) => {
          if (skip(c)) return;
          const r = await page.request.post(h.base + '/api/matchmaking/criteria', { headers: auth(c), data: { height_min: 160, height_max: 200, age_min: 18, age_max: 99 } });
          if (!r.ok()) throw new Error('criteria POST HTTP ' + r.status());
        } },
      ],
    },
    {
      name: 'Сигнали — мога ли да подам',
      steps: [
        { label: 'GET /api/signals/can-submit', run: async (page, c, h) => {
          if (skip(c)) return;
          const r = await page.request.get(h.base + '/api/signals/can-submit', { headers: auth(c) });
          if (!r.ok()) throw new Error('signals can-submit HTTP ' + r.status());
        } },
      ],
    },
    {
      name: 'Изход',
      steps: [
        { label: 'POST /api/auth/logout', run: async (page, c, h) => {
          if (skip(c)) return;
          await page.request.post(h.base + '/api/auth/logout', { headers: auth(c) });
        } },
      ],
    },
  ],
};
