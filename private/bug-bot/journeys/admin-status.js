// Version: 1.0000
// admin-status — журито гледа СЪЩАТА админ-страница за статус/логове и чете per-app
// състоянието на документите (📄) и сървисите (⚙), което страницата вече изчислява.
//   • docs bad  → ПАДА (правните документи/иконата на приложение не работят — блокер за магазина)
//   • svc bad   → само ДОКЛАД (някои бекенди са планово „още не пуснати")
// Плюс: пуска централните проверки check-legal-links / check-services (единствен източник).
//
// Пускане:  node run.js --journey adminstatus
// Само ЧЕТЕНЕ (навигация + четене на DOM). Безопасно и срещу prod.
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const BASE = process.env.ROBOT_PROD_URL || 'https://take.offbitch.com';
const ADM = process.env.ROBOT_ADM || 'bgmasters-set';
const ADMIN_URL = BASE.replace(/\/+$/, '') + '/shared/admin-status.html?adm=' + encodeURIComponent(ADM);
const REPO = path.resolve(__dirname, '..', '..', '..'); // .../ (repo root)

module.exports = {
  name: 'Admin статус — документи (📄) + сървиси (⚙) на всички апове',
  scenarios: [
    {
      name: 'Админ-страница: per-app документи и сървиси',
      steps: [
        { label: 'страницата се отваря и попълва каталога с приложения', run: async (page) => {
          const resp = await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
            .catch((e) => { throw new Error('админ-страницата не се отвори: ' + e.message); });
          if (resp && resp.status() >= 400) throw new Error('админ-страницата върна HTTP ' + resp.status());
          await page.waitForSelector('#apps-grid [data-app]', { timeout: 30000 })
            .catch(() => { throw new Error('per-app панелът не се попълни (каталогът недостъпен?)'); });
        } },
        { label: 'изчаквам живите проверки (документи + сървиси) да приключат', run: async (page) => {
          await page.waitForTimeout(8000); // per-app fetch-овете (HEAD документи + health) да резолвнат
        } },
        { label: 'НИКОЙ ап да няма ❗ на документите/иконата (📄)', run: async (page) => {
          const bad = await page.$$eval('#apps-grid [data-app][data-doc="bad"]', (els) => els.map((e) => e.getAttribute('data-app')));
          if (bad.length) throw new Error('документи/икона с проблем за: ' + bad.join(', ') + ' — виж 📄❗ на админ-страницата');
        } },
        { label: 'докладвай сървисите с ❗ (⚙) — планово-непуснатите не са провал', run: async (page) => {
          const bad = await page.$$eval('#apps-grid [data-app][data-svc="bad"]', (els) => els.map((e) => e.getAttribute('data-app')));
          if (bad.length) console.log('    ⚠ сървиз ❗ (провери дали е планово или реален отказ): ' + bad.join(', '));
        } },
      ],
    },
    {
      name: 'Централни проверки (единствен източник) — документи + сървиси',
      steps: [
        { label: 'check-legal-links.mjs (всички апове онлайн: 200 + на СЪЩОТО приложение)', run: async () => {
          try {
            execFileSync('node', ['deploy-scripts/check-legal-links.mjs'], { cwd: REPO, stdio: 'pipe' });
          } catch (e) {
            const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
            throw new Error('правни документи с проблем:\n' + out.split('\n').filter((l) => /✗|ЧУЖДО|ЛИПСВА|HTTP|ПРАВНА/.test(l)).join('\n'));
          }
        } },
        { label: 'check-all-app-services.mjs (бекендите на приложенията живи ли са)', run: async () => {
          try {
            execFileSync('node', ['deploy-scripts/check-all-app-services.mjs'], { cwd: REPO, stdio: 'pipe' });
          } catch (e) {
            const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
            throw new Error('очакван сървис е ДОЛУ:\n' + out.split('\n').filter((l) => /✗|ДОЛУ|СЪРВИЗИ/.test(l)).join('\n'));
          }
        } },
      ],
    },
  ],
};
