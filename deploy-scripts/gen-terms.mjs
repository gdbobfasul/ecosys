// Version: 1.0001
// gen-terms.mjs — Общи условия (Terms & Conditions) за ВСЕКИ ап, per-store:
//   huawei/<app>/publish/hw-terms.html      (английски)
//   huawei/<app>/publish/rustore-terms.html (руски + английски)
// Хостват се до политиките: selflearning.bot.nu/privacy/<app>/hw-terms.html (08 sync ще ги качва).
// Финансовите апове (categoryHuawei==='Finance') получават УСИЛЕНА клауза „не е инвестиционен съвет".
//
// Пускане: node deploy-scripts/gen-terms.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EFFECTIVE = '2026-07-13';
const PROVIDER = 'Dai Grup Ltd.';
const CONTACT = 'dai.group.ltd.support@gmail.com';

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } }
function metaName(file, fb) { try { const m = fs.readFileSync(file, 'utf8').match(/^App name:\s*(.+?)\s*(?:#.*)?$/m); if (m) return m[1].trim(); } catch (_) {} return fb; }

function page(title, bodyHtml, lang) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:760px;margin:0 auto;padding:22px;line-height:1.6;color:#111;background:#fff}h1{font-size:22px}h2{font-size:17px;margin-top:24px}small{color:#555}code{background:#f2f2f2;padding:1px 5px;border-radius:4px}hr{margin:28px 0;border:none;border-top:1px solid #ddd}</style></head><body>${bodyHtml}</body></html>`;
}

function sectionsEN(name, finance) {
  const fin = finance ? `
<h2>3. Educational purpose only — NOT investment advice</h2>
<p><strong>${name} is an educational tool. Nothing in the app is investment, financial, legal or tax advice, a recommendation, or a solicitation to buy or sell any asset.</strong> All readings, indicators, signals, scores and "conclusions" are derived automatically from public data for learning purposes. Markets are risky and can move in the exact opposite direction to any indicator. Past performance does not guarantee future results. You are solely responsible for your own decisions; you should consult a licensed professional before making any financial decision.</p>` : `
<h2>3. Educational and personal use</h2>
<p>${name} is provided for your personal, informational use. Do not rely on it as professional advice.</p>`;
  return `
<h1>Terms &amp; Conditions — ${name}</h1>
<p><small>Provider: ${PROVIDER} · Effective: ${EFFECTIVE}</small></p>
<h2>About Pupikes — how our apps work</h2>
<p>Pupikes apps are built to be like a good dog: a faithful friend that serves you reliably and can be <strong>trained</strong>. Through the in-app feedback button you can tell us what is missing or wrong, and we improve the app accordingly. But — just as you cannot ask a dog to do the impossible — each app helps you <strong>only within the limits of its purpose</strong>. Reasonable requests within an app's function are welcome; requests beyond what the app is meant to do (for example, asking an authenticator app to order food) cannot be fulfilled. Improvements are made at our discretion, within what is reasonable and technically possible.</p>
<h2>1. Acceptance</h2>
<p>By installing or using ${name} (the "app"), published by ${PROVIDER}, you agree to these Terms &amp; Conditions and to the Privacy Policy. If you do not agree, do not use the app.</p>
<h2>2. Licence</h2>
<p>You are granted a personal, non-exclusive, non-transferable, revocable licence to use the app for your own lawful purposes. You must not copy, resell, reverse-engineer, or use the app to break any law or third party's rights.</p>
${fin}
<h2>4. Third-party data</h2>
<p>The app may read data from third-party public sources. That data is provided by those third parties "as is"; ${PROVIDER} does not control it and does not guarantee its accuracy, completeness or availability.</p>
<h2>5. No warranty</h2>
<p>The app is provided "AS IS" and "AS AVAILABLE", without warranties of any kind, to the maximum extent permitted by law.</p>
<h2>6. Limitation of liability</h2>
<p>To the maximum extent permitted by law, ${PROVIDER} is not liable for any indirect, incidental or consequential damages, or for any loss arising from your use of, or reliance on, the app or its content.</p>
<h2>7. Acceptable use</h2>
<p>You agree not to misuse the app, interfere with its operation, or use it for any unlawful, harmful or infringing purpose.</p>
<h2>8. Changes</h2>
<p>We may update the app and these Terms. Continued use after an update means you accept the updated Terms.</p>
<h2>9. Contact</h2>
<p>Questions about these Terms: <code>${CONTACT}</code>.</p>`;
}

function sectionsRU(name, finance) {
  const fin = finance ? `
<h2>3. Только образовательная цель — НЕ инвестиционный совет</h2>
<p><strong>${name} — образовательный инструмент. Ничто в приложении не является инвестиционным, финансовым, юридическим или налоговым советом, рекомендацией или предложением купить/продать какой-либо актив.</strong> Все выводы, индикаторы, сигналы и оценки формируются автоматически из публичных данных в учебных целях. Рынки рискованны и могут двигаться прямо противоположно любому индикатору. Прошлые результаты не гарантируют будущих. Вы несёте полную ответственность за свои решения; перед финансовыми решениями обратитесь к лицензированному специалисту.</p>` : `
<h2>3. Образовательное и личное использование</h2>
<p>${name} предоставляется для личного, информационного использования. Не полагайтесь на него как на профессиональный совет.</p>`;
  return `
<h1>Условия использования — ${name}</h1>
<p><small>Поставщик: ${PROVIDER} · Действует с: ${EFFECTIVE}</small></p>
<h2>О Pupikes — как работают наши приложения</h2>
<p>Приложения Pupikes созданы как хороший пёс: верный друг, который надёжно вам служит и которого можно <strong>обучать</strong>. Через кнопку обратной связи в приложении вы сообщаете, чего не хватает или что не так, и мы улучшаем приложение. Но — как и от собаки нельзя требовать невозможного — каждое приложение помогает <strong>только в пределах своего назначения</strong>. Разумные пожелания в рамках функций приложения приветствуются; просьбы вне того, для чего приложение предназначено (например, заказать еду через приложение-аутентификатор), выполнить нельзя. Улучшения вносятся по нашему усмотрению, в разумных и технически возможных пределах.</p>
<h2>1. Принятие</h2>
<p>Устанавливая или используя ${name} («приложение»), издаваемое ${PROVIDER}, вы принимаете настоящие Условия использования и Политику конфиденциальности. Если вы не согласны — не используйте приложение.</p>
<h2>2. Лицензия</h2>
<p>Вам предоставляется личная, неисключительная, непередаваемая, отзывная лицензия на использование приложения в законных целях. Запрещено копировать, перепродавать, декомпилировать приложение или использовать его для нарушения закона или прав третьих лиц.</p>
${fin}
<h2>4. Данные третьих сторон</h2>
<p>Приложение может читать данные из публичных источников третьих сторон. Эти данные предоставляются «как есть»; ${PROVIDER} их не контролирует и не гарантирует их точность, полноту или доступность.</p>
<h2>5. Отказ от гарантий</h2>
<p>Приложение предоставляется «КАК ЕСТЬ» и «КАК ДОСТУПНО», без каких-либо гарантий, в максимально допустимой законом мере.</p>
<h2>6. Ограничение ответственности</h2>
<p>В максимально допустимой законом мере ${PROVIDER} не несёт ответственности за косвенные или случайные убытки, а также за любые потери из-за использования приложения или доверия к его содержимому.</p>
<h2>7. Допустимое использование</h2>
<p>Вы обязуетесь не злоупотреблять приложением, не нарушать его работу и не использовать его в незаконных или вредоносных целях.</p>
<h2>8. Изменения</h2>
<p>Мы можем обновлять приложение и настоящие Условия. Продолжение использования означает согласие с обновлёнными Условиями.</p>
<h2>9. Контакт</h2>
<p>Вопросы: <code>${CONTACT}</code>.</p>`;
}

const huaweiRoot = path.join(ROOT, 'huawei');
const apps = fs.readdirSync(huaweiRoot).filter((d) => fs.existsSync(path.join(huaweiRoot, d, 'publish')));
let n = 0;
for (const app of apps) {
  const pub = path.join(huaweiRoot, app, 'publish');
  const name = metaName(path.join(pub, 'huawei.meta'), app);
  const profile = readJson(path.join(pub, 'app-profile.json')) || {};
  const finance = (profile.categoryHuawei === 'Finance');
  fs.writeFileSync(path.join(pub, 'hw-terms.html'), page('Terms & Conditions — ' + name, sectionsEN(name, finance), 'en'));
  fs.writeFileSync(path.join(pub, 'rustore-terms.html'), page('Условия использования — ' + name, sectionsRU(name, finance) + '<hr>' + sectionsEN(name, finance), 'ru'));
  n++;
  console.log('✓', app, finance ? '(finance)' : '');
}
console.log('\nГотово: ' + n + ' апа × 2 = ' + (n * 2) + ' terms файла.');
