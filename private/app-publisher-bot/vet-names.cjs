#!/usr/bin/env node
// vet-names.cjs — проверява (clearance) СПИСЪК от кандидат-имена, преди да ги приложим.
// НЕ пипа приложения. Само отпечатва риск + причина за всяко кандидат-име.
const { nameCheck } = require('./lib/name-check.cjs');

const CANDIDATES = [
  // Втори кръг — само замените на 4-те паднали (ReplyMate/FeedSentry/DayForge/MindSprout).
  ['routine-bot',         'DayNest Routine'],
  ['selflearning-friend', 'Learnling'],
];

(async () => {
  const rows = [];
  for (const [app, name] of CANDIDATES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await nameCheck(name);
      const why = (r.riskWhy && r.riskWhy.length) ? ' (' + r.riskWhy.join('; ') + ')' : '';
      console.log(r.risk.padEnd(8) + '  ' + app.padEnd(20) + '„' + name + '"' + why);
      rows.push({ app, name, risk: r.risk, why });
    } catch (e) {
      console.log('ГРЕШКА  ' + app.padEnd(20) + '„' + name + '": ' + (e.message || e));
      rows.push({ app, name, risk: 'ГРЕШКА', why: String(e.message || e) });
    }
  }
  console.log('\n=== Обобщение ===');
  for (const r of rows) console.log('  ' + r.risk.padEnd(8) + '  ' + r.app.padEnd(20) + '„' + r.name + '"');
})();
