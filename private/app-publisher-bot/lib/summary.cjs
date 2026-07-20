// summary.cjs — генерира обобщение за публикуване (`publish/SUMMARY.md`) за даден ап:
// докъде сме стигнали (име, пакет, версия, готовност на скрийншоти/описания/meta) + ИСТОРИЯ
// на всички пробвани имена (от docs/publish/huawei/name-checks/). Така в папката на приложението
// винаги се вижда текущото състояние и какво сме пробвали.
const fs = require('fs');
const path = require('path');

function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }

// Вади поле от huawei.meta по етикет (реже коментара след #).
function metaField(meta, label) {
  const m = meta.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(.+)'));
  return m ? m[1].split('#')[0].trim() : '';
}

// Чете всички доклади за имена и вади име + риск + кратка причина.
function parseNameChecks(dir) {
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch (_) { return []; }
  return files.map((f) => {
    const s = readSafe(path.join(dir, f));
    const name = (s.match(/#\s*Проверка на име:\s*(.+)/) || [])[1] || f.replace(/\.md$/, '');
    const risk = (s.match(/##\s*Оценка на риска:\s*\*\*(.+?)\*\*/) || [])[1] || '?';
    const why = (s.match(/##\s*Оценка на риска:[^\n]*\n-\s*(.+)/) || [])[1] || '';
    return { name: name.trim(), risk: risk.trim(), why: why.trim().replace(/\|/g, '/'), file: 'docs/publish/huawei/name-checks/' + f };
  });
}

// Брои скрийншоти: общи (в корена на screenshots/) + по език (в подпапки).
function countScreens(dir) {
  let shared = 0; const perLang = {};
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.png')) shared++;
      else if (e.isDirectory()) {
        try { perLang[e.name] = fs.readdirSync(path.join(dir, e.name)).filter((x) => x.endsWith('.png')).length; } catch (_) {}
      }
    }
  } catch (_) {}
  const langs = Object.keys(perLang);
  const perLangEach = langs.length ? Math.round(langs.reduce((a, k) => a + perLang[k], 0) / langs.length) : 0;
  return { shared, langs: langs.length, perLangEach, total: shared + Object.values(perLang).reduce((a, b) => a + b, 0) };
}

function generateSummary(appDir) {
  const pub = path.join(appDir, 'publish');
  const meta = readSafe(path.join(pub, 'huawei.meta'));
  let cap = {}; try { cap = JSON.parse(readSafe(path.join(appDir, 'capacitor.config.json'))); } catch (_) {}
  // Версията идва от src/version.js (инжектираната APP_VERSION — реалната версия в апа),
  // НЕ от версионния файл-маркер (той не бива да се чете от нищо).
  const version = (readSafe(path.join(appDir, 'src', 'version.js')).match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '?';
  const shots = countScreens(path.join(pub, 'screenshots'));
  let listings = 0;
  try { listings = fs.readdirSync(path.join(pub, 'store-listing')).filter((f) => /\.txt$/.test(f) && f !== '_index.txt').length; } catch (_) {}
  const names = parseNameChecks(path.join(appDir, '..', '..', 'docs', 'huawei', 'name-checks'));

  const L = [];
  L.push('# Обобщение за публикуване — ' + (metaField(meta, 'App name') || cap.appName || path.basename(appDir)));
  L.push('');
  L.push('_Генерирано от AppPublisherBot. Показва докъде сме стигнали преди качване в Huawei AppGallery._');
  L.push('');
  L.push('## Решение');
  L.push('- **Име (App name):** ' + (metaField(meta, 'App name') || cap.appName || '?'));
  L.push('- **Пакет (package):** ' + (metaField(meta, 'App package name') || cap.appId || '?'));
  L.push('- **Категория (Level-1):** ' + (metaField(meta, 'Level-1 app category') || '?'));
  L.push('- **Версия (сглобка):** ' + (version || '?'));
  L.push('- **Имейл за поддръжка:** dai.group.ltd.support@gmail.com');
  L.push('');
  L.push('## Готовност на материалите');
  L.push('- Снимки на екрана: **' + shots.total + '** (общ екран: ' + shots.shared + ' + ' + shots.langs + ' езика × ' + shots.perLangEach + ')');
  L.push('- Описания (store-listing): **' + listings + '** езика');
  L.push('- huawei.meta: ' + (meta ? '**готов**' : '**ЛИПСВА**'));
  L.push('');
  L.push('## История на пробваните имена (' + names.length + ')');
  if (!names.length) L.push('Няма записи.');
  else {
    const order = { 'НИСЪК': 0, 'СРЕДЕН': 1, 'ВИСОК': 2 };
    names.sort((a, b) => ((order[a.risk] != null ? order[a.risk] : 9) - (order[b.risk] != null ? order[b.risk] : 9)) || a.name.localeCompare(b.name));
    L.push('| Име | Риск | Кратко | Доклад |');
    L.push('|---|---|---|---|');
    for (const n of names) L.push('| ' + n.name + ' | ' + n.risk + ' | ' + (n.why || '').slice(0, 70) + ' | ' + n.file + ' |');
  }
  L.push('');
  const out = path.join(pub, 'SUMMARY.md');
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(out, L.join('\n'), 'utf8');
  return { path: out, screenshots: shots.total, listings, names: names.length };
}

module.exports = { generateSummary };
