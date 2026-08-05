// gen-rustore-config.mjs — създава huawei/<app>/publish/rustore.json за ВСИЧКИ приложения
// (данни за стъпка „Information" в RuStore: type, category (руски), age, priceRub, tags (английски)).
// Цена: от каталога app-shared/promo-catalog.json, конвертирана в рубли ×85 и ЗАКРЪГЛЕНА НАГОРЕ
// (правило: цените винаги нагоре). Игрите → type Game, категорията/таговете са с ДРУГ (игрален)
// речник → оставят се празни (попълват се ръчно/при инспекция на игрален екран).
// Пускане:  node deploy-scripts/gen-rustore-config.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RATE = 85;   // ₽/$ (закръгляме нагоре)

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'app-shared', 'promo-catalog.json'), 'utf8'));
const priceById = {}; for (const a of (catalog.apps || [])) priceById[a.id] = a.price;
function rub(id) {
  const p = priceById[id];
  const n = typeof p === 'string' ? parseFloat(p.replace('$', '')) : (typeof p === 'number' ? p : NaN);
  return Number.isFinite(n) ? Math.ceil(n * RATE) : 111;   // по подразбиране $1.3→111₽
}

// A = Application, G = Game. cat = точен руски надпис; age = 0+/6+/12+/16+/18+; tags = английски (до 5).
const M = {
  'authenticator':          { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Personal finance', 'Investments', 'Mobile payments', 'Work', 'Personal assistants'] },
  'auto-sound-diagnostics': { t: 'A', cat: 'Транспорт и навигация', age: '0+', tags: ['Driving apps', 'Audio recording', 'Home assistant', 'Personal assistants', 'Work'] },
  'autoreply-bot':          { t: 'A', cat: 'Общение', age: '0+', tags: ['Messaging', 'Communication', 'Email', 'Call recording', 'Work'] },
  'baby-monitor':           { t: 'A', cat: 'Родителям', age: '0+', tags: ['Childcare', 'Mother & Child', 'Home assistant', 'Sleep', 'Personal assistants'] },
  'business-faq-bot':       { t: 'A', cat: 'Бизнес-сервисы', age: '0+', tags: ['Work', 'Communication', 'Personal assistants', 'Email', 'Job search'] },
  'camera-watch':           { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Home assistant', 'Photography', 'Photo editors', 'Personal assistants', 'Work'] },
  'chat':                   { t: 'A', cat: 'Общение', age: '12+', tags: ['Messaging', 'Communication', 'Video calls', 'Social', 'Email'] },
  'houselookbook':          { t: 'A', cat: 'Объявления и услуги', age: '0+', tags: ['Interior design', 'Blogs', 'Lifestyle', 'Photography', 'Personal assistants'] },
  'market-pulse':           { t: 'A', cat: 'Финансы', age: '0+', tags: ['Investments', 'Personal finance', 'News', 'Calculators', 'Work'] },
  'monitor-bot':            { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Web browsers', 'Work', 'Personal assistants', 'Communication', 'Email'] },
  'newslator':              { t: 'A', cat: 'Новости и события', age: '16+', tags: ['News', 'Blogs', 'Language learning', 'Communication', 'Encyclopedias'] },
  'price-watch-bot':        { t: 'A', cat: 'Покупки', age: '0+', tags: ['Loyalty & rewards', 'Personal finance', 'Work', 'Personal assistants', 'Investments'] },
  'pupikes-doctor':         { t: 'A', cat: 'Здоровье', age: '12+', tags: ['Medicine', 'Fitness trackers', 'Self-improvement', 'Encyclopedias', 'Personal assistants'] },
  'pupikes-medicines':      { t: 'A', cat: 'Здоровье', age: '12+', tags: ['Medicine', 'Encyclopedias', 'Personal assistants', 'Fitness trackers', 'Self-improvement'] },
  'pupikes-toolkit-3drotate': { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Photo editors', 'Photography', 'Video editors', 'Work', 'Personal assistants'] },
  'pupikes-toolkit-ai-announcement': { t: 'A', cat: 'Бизнес-сервисы', age: '0+', tags: ['Work', 'Personal assistants', 'Communication', 'Email', 'Job search'] },
  'pupikes-toolkit-finance': { t: 'A', cat: 'Финансы', age: '0+', tags: ['Personal finance', 'Investments', 'Calculators', 'Work', 'Mobile payments'] },
  'pupikes-toolkit-passwords': { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Work', 'Personal assistants', 'Mobile payments', 'Communication', 'Notepads'] },
  'pupikes-toolkit-pdf':    { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Work', 'Notepads', 'Personal assistants', 'Grammar', 'Email'] },
  'pupikes-toolkit-pictures': { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Photo editors', 'Photography', 'Wallpapers', 'Video editors', 'Work'] },
  'pupikes-toolkit-qr':     { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Work', 'Personal assistants', 'Mobile payments', 'Communication', 'Web browsers'] },
  'pupikes-toolkit-scraper': { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Web browsers', 'Work', 'Personal assistants', 'Communication', 'Blogs'] },
  'pupikes-toolkit-sound':  { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Audio recording', 'Call recording', 'Radio', 'Audiobooks', 'Work'] },
  'pupikes-toolkit-text':   { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Grammar', 'Notepads', 'Work', 'Language learning', 'Personal assistants'] },
  'pupikes-toolkit-videos': { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Video editors', 'Video players', 'Video downloaders', 'Video streaming', 'Photography'] },
  'routine-bot':            { t: 'A', cat: 'Образ жизни', age: '0+', tags: ['Calendar', 'Self-improvement', 'Personal assistants', 'Notepads', 'Clocks, alarms, and timers'] },
  'selflearning-friend':    { t: 'A', cat: 'Образование', age: '0+', tags: ['Language learning', 'Self-improvement', 'Encyclopedias', 'Grammar', 'Mathematics'] },
  'services-toolkit':       { t: 'A', cat: 'Полезные инструменты', age: '0+', tags: ['Work', 'Photo editors', 'Video editors', 'Calculators', 'Personal assistants'] },
  // Игри (type Game): категория/тагове са с ДРУГ (игрален) речник. Попълнени с общи RuStore игрови
  // жанрове (Экшен/Аркады/Стратегии) + до 5 английски игрови тага. ⚠ ТОЧНИТЕ руски надписи и тагове
  // трябва да се сверят с ЖИВИЯ dropdown при първата игра — ботът иска точно съвпадение (иначе ръчно).
  // Тагове = ТОЧНО от игровия списък на RuStore (110 опции, свалени от живия dropdown 05.08).
  'dodge-master':           { t: 'G', cat: 'Аркады',     age: '6+',  tags: ['Hypercasual games', 'Runners', 'Logic games', 'Singleplayer', 'Offline'] },
  'duel':                   { t: 'G', cat: 'Экшен',      age: '12+', tags: ['Fighting', 'Battles', 'Competitive', 'Singleplayer', 'Offline'] },
  'fps-hunter':             { t: 'G', cat: 'Экшен',      age: '12+', tags: ['Tactical shooters', 'Hero shooters', 'SHMUP', 'Singleplayer', 'Offline'] },
  'hmm':                    { t: 'G', cat: 'Стратегии',  age: '12+', tags: ['Turn-based RPG', 'Tactical games', 'War games', 'Singleplayer', 'Offline'] },
  'plane-shooter':          { t: 'G', cat: 'Аркады',     age: '6+',  tags: ['Airplanes', 'Flight', 'SHMUP', 'Singleplayer', 'Offline'] },
  'rustam':                 { t: 'G', cat: 'Аркады',     age: '0+',  tags: ['Hypercasual games', 'Logic games', 'Puzzle', 'Singleplayer', 'Offline'] },
  'titans-fight':           { t: 'G', cat: 'Экшен',      age: '12+', tags: ['Fighting', 'Battles', 'Competitive', 'Singleplayer', 'Offline'] }
};

const apps = fs.readdirSync(path.join(ROOT, 'huawei')).filter((a) => fs.existsSync(path.join(ROOT, 'huawei', a, 'capacitor.config.json')));
let n = 0; const rows = [];
for (const app of apps) {
  const m = M[app];
  if (!m) { console.log('↷ няма съответствие за ' + app + ' — прескачам'); continue; }
  const cfg = {
    _comment: 'RuStore данни за стъпка Information (rustore-release-bot). type Application|Game; category=точен руски надпис от Main; age 0+/6+/12+/16+/18+; priceRub=цена в рубли (закръглена нагоре); tags=Search Tags (английски, до 5).',
    type: m.t === 'G' ? 'Game' : 'Application',
    category: m.cat,
    age: m.age,
    priceRub: rub(app),
    tags: m.tags
  };
  const pub = path.join(ROOT, 'huawei', app, 'publish');
  fs.mkdirSync(pub, { recursive: true });
  // ПАЗИ ръчно добавени полета (напр. sensitivePermissionReason — причина за чувствително разрешение),
  // за да НЕ се губят при регенерат. Търси ги в съществуващия huawei файл ИЛИ в rustore дървото (там чете ботът).
  for (const ex of [path.join(pub, 'rustore.json'), path.join(ROOT, 'rustore', app, 'publish', 'rustore.json')]) {
    try { const j = JSON.parse(fs.readFileSync(ex, 'utf8')); if (j.sensitivePermissionReason && !cfg.sensitivePermissionReason) cfg.sensitivePermissionReason = j.sensitivePermissionReason; } catch (_) {}
  }
  fs.writeFileSync(path.join(pub, 'rustore.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  n++;
  rows.push({ app, type: cfg.type, cat: cfg.category || '(игра)', age: cfg.age, price: cfg.priceRub, tags: cfg.tags.join(', ') || '(игра — ръчно)' });
}
console.log('✓ записани ' + n + ' rustore.json');
// markdown таблица (за формата-документ)
console.log('\n--- MD таблица ---');
console.log('| Приложение | Тип | Категория | Възраст | Цена ₽ | Search Tags |');
console.log('|---|---|---|---|---|---|');
for (const r of rows.sort((a, b) => a.app.localeCompare(b.app))) console.log('| ' + r.app + ' | ' + r.type + ' | ' + r.cat + ' | ' + r.age + ' | ' + r.price + ' | ' + r.tags + ' |');
