// Version: 1.0173
// Чат — работни сценарии „като човек". Анти-бот проверката (client_type) се
// изключва от .env (CHAT_DISABLE_CLIENT_CHECK=true), затова роботът може да мине
// пълния поток: входна форма → регистрация → вход → проверка с токена.
// (Чатът е token-базиран Bearer; не оставя cleanup API → тестовият потребител остава.)
'use strict';

module.exports = {
  app: 'chat',
  label: 'Чат (регистрация, вход, токен)',
  writes: true,
  setup(ctx) {
    ctx.phone = '+9' + String(1000000000 + (ctx.runNum % 800000000)); // ~11 цифри (валидно 10-15)
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
          if (r.status() === 429) { c.rateLimited = true; return; } // rate limit (чести тестове) — не е бъг
          const b = await r.json().catch(() => ({}));
          if (!(b.success || b.userId)) throw new Error(`register HTTP ${r.status()} ${b.error || ''}`);
        } },
      ],
    },
    {
      name: 'Вход (API) — анти-бот изключена',
      steps: [
        { label: 'вход (токен или payment wall за неплатен)', run: async (page, c, h) => {
          if (c.rateLimited) return; // регистрацията беше rate-limited → няма какво да влиза
          const r = await page.request.post(h.base + '/api/auth/login', { data: { phone: c.phone, password: c.pass, client: 'web' } });
          if (r.status() === 429) { c.rateLimited = true; return; } // rate limit — не е бъг
          const b = await r.json().catch(() => ({}));
          if (r.status() >= 500) throw new Error(`login HTTP ${r.status()} ${b.error || ''}`);
          if (b.token) c.token = b.token;                      // платен → токен
          else if (b.exists || b.needsPayment) c.paymentWall = b.message || 'нужно плащане'; // неплатен → коректно
          else throw new Error(`неочакван login отговор: ${JSON.stringify(b).slice(0, 100)}`);
        } },
      ],
    },
    {
      name: 'Достъп с токена (или payment wall, ако неплатен)',
      steps: [
        { label: 'профил с токена / иначе payment wall (очаквано)', run: async (page, c, h) => {
          if (c.token) {
            const r = await page.request.get(h.base + '/api/profile', { headers: { Authorization: 'Bearer ' + c.token } });
            if (!r.ok()) throw new Error('profile HTTP ' + r.status());
          }
          // неплатен → login коректно върна „нужно плащане"; това НЕ е грешка
        } },
      ],
    },
  ],
};
