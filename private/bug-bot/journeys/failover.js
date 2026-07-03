// Version: 1.0173
// FAILOVER / Tailscale — НАБЛЮДАВА коя машина (PROD/VM) обслужва всеки домейн.
//
// За ВСЕКИ публичен домейн от екосистемата прави HTTP GET до https://<домейн>/ и
// чете заглавката `X-Served-By` (PROD|VM), която nginx/деплоят слагат на всеки отговор.
// Целта е НАБЛЮДЕНИЕ (работи и при включена, и при изключена VM) — НЕ проваляме теста
// само защото VM е офлайн. Грешка вдигаме САМО ако домейн е напълно недостъпен
// (без отговор / 5xx) или не върне изобщо X-Served-By.
//
// Накрая „обслужва: <домейн>=PROD/VM …" — за един поглед коя машина къде отговаря.
'use strict';

// Публичните домейни (от private/configs/domains.conf). Без хардкод на протокол другаде.
const DOMAINS = [
  { key: 'main', host: 'take.offbitch.com' },
  { key: 'chat', host: 'my.girl.place' },
  { key: 'hlb', host: 'look.myhousesetup.com' },
  // wnb (find.jwork.ru) МАХНАТ — вече не се ползва отделен домейн за WNB.
];

// Прочита X-Served-By нечувствително към регистъра (заглавките идват lowercase).
function servedBy(headers) {
  const h = headers || {};
  return h['x-served-by'] || h['X-Served-By'] || '';
}

module.exports = {
  app: 'failover',
  label: 'Failover/Tailscale (коя машина обслужва всеки домейн — VM нагоре ИЛИ надолу)',
  writes: false,
  scenarios: [
    {
      name: 'Наблюдавай X-Served-By по всички домейни',
      steps: [
        { label: 'GET https://<домейн>/ за всеки домейн → чети X-Served-By', run: async (page, c, h) => {
          c.served = {};
          const problems = [];
          for (const d of DOMAINS) {
            const url = `https://${d.host}/`;
            let status = 0, by = '';
            try {
              const r = await page.request.get(url, { timeout: 20000, failOnStatusCode: false });
              status = r.status();
              by = servedBy(r.headers());
            } catch (e) {
              // Напълно недостъпен (DNS/TLS/timeout) → това е реална грешка.
              problems.push(`${d.host}: недостъпен (${(e.message || e).split('\n')[0].slice(0, 80)})`);
              c.served[d.key] = '—';
              continue;
            }
            c.served[d.key] = by || '?';
            if (status >= 500) problems.push(`${d.host}: HTTP ${status} (5xx)`);
            else if (!by) problems.push(`${d.host}: HTTP ${status}, но без X-Served-By заглавка`);
          }
          if (problems.length) throw new Error('failover проблеми → ' + problems.join(' · '));
        } },
        { label: 'обобщение коя машина обслужва', run: async (page, c) => {
          const summary = DOMAINS.map((d) => `${d.host}=${(c.served && c.served[d.key]) || '?'}`).join(' ');
          // Журито-двигателят логва само провали; печатаме директно за репорта/конзолата.
          // eslint-disable-next-line no-console
          console.log('     ℹ️ обслужва: ' + summary);
        } },
      ],
    },
  ],
};
