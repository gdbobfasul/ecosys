// expand-themes.mjs — author-time: РАЗШИРЯВА tools/themes.json до 1500+ уникални теми, като
// БОТ ХАРВЕСТВА подтеми от Уикипедия (заглавия на статии + подкатегории) по seed-категории за
// всяка от 14-те категории. Глобален дедуп: една тема влиза само в ПЪРВАТА категория, която я
// поеме (без дублиране между категориите — по искане на собственика).
//
// Запазва вече изброените (ръчни) теми като база, после долива харвестираните до `perCategory`.
//
// Употреба: node tools/expand-themes.mjs [--per 120]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const PER = Math.max(30, parseInt((args[args.indexOf('--per') + 1]) || '120', 10) || 120);
const LANG = 'bg';
const UA = 'SelflearningFriend-ThemeHarvester/1.0 (https://selflearning.bot.nu; ltd.dai.grup@gmail.com)';
const API = `https://${LANG}.wikipedia.org/w/api.php`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchRetry(url, tries = 4) {
  for (let a = 0; a < tries; a++) {
    let res; try { res = await fetch(url, { headers: { Accept: 'application/json', 'Api-User-Agent': UA, 'User-Agent': UA } }); }
    catch (e) { if (a === tries - 1) throw e; await sleep(500 * (a + 1)); continue; }
    if (res.status === 429 || res.status === 503) { await sleep(Math.min(8000, 700 * 2 ** a)); continue; }
    if (!res.ok) throw new Error('HTTP ' + res.status); return res.json();
  }
  throw new Error('429');
}
const q = (p) => API + '?' + new URLSearchParams({ format: 'json', origin: '*', ...p });

// seed-категории на български за всяка от нашите категории (по няколко, best-effort).
const SEEDS = {
  'Училищни предмети': ['Категория:Математика', 'Категория:Физика', 'Категория:Химия', 'Категория:Биология', 'Категория:Литература', 'Категория:Философия', 'Категория:Психология', 'Категория:Езикознание'],
  'Теми в новините': ['Категория:Политика', 'Категория:Международни отношения', 'Категория:Общество', 'Категория:Право'],
  'Научно-популярни теми': ['Категория:Астрономия', 'Категория:Космонавтика', 'Категория:Генетика', 'Категория:Квантова механика', 'Категория:Геология'],
  'Теми от ежедневието': ['Категория:Бит', 'Категория:Хранене', 'Категория:Кулинария', 'Категория:Домакинство'],
  'Професии': ['Категория:Професии', 'Категория:Занаяти'],
  'Изкуства': ['Категория:Изобразително изкуство', 'Категория:Музика', 'Категория:Кино', 'Категория:Театър', 'Категория:Танц', 'Категория:Архитектура'],
  'Спортове': ['Категория:Спортове', 'Категория:Спорт по вид'],
  'Мебели и уреди': ['Категория:Мебели', 'Категория:Домакински уреди', 'Категория:Битова техника'],
  'Превозни средства и машини': ['Категория:Автомобили', 'Категория:Въздухоплавателни средства', 'Категория:Плавателни съдове', 'Категория:Железопътен транспорт', 'Категория:Машини'],
  'Компютърни приложения': ['Категория:Приложен софтуер', 'Категория:Компютърни програми', 'Категория:Операционни системи'],
  'Здраве и медицина': ['Категория:Медицина', 'Категория:Болести', 'Категория:Анатомия на човека'],
  'Природа и животни': ['Категория:Бозайници', 'Категория:Птици', 'Категория:Растения', 'Категория:Риби', 'Категория:Влечуги'],
  'Финанси и бизнес': ['Категория:Финанси', 'Категория:Търговия', 'Категория:Мениджмънт'],
  'История и общество': ['Категория:История', 'Категория:Култура', 'Категория:Религия']
};

// приемлива ТЕМА (концепция), не мета/навигация/личност/списък/латиница.
const META_RE = /^(Списъ[кц]|Уикипедия|Портал|Шаблон|Категория|Мъничета|Област(и)? на|История на|Философия на|Награди|Научни институт|Нерешени проблеми|Основни|Хора (по|от|свързани)|.* по (страна|континент|вид|проблематика|години|десетилети|убеждения|държава|град)$|.* според |Ползватели|Личности|Родени|Починали)/i;
const META_SUFFIX = /(-и|-ци|логия|исти|ологии)$/i;   // множествени/групови (Математици, Физици) — по-скоро мета
function okTitle(t) {
  const s = String(t || '').trim();
  if (s.length < 3 || s.length > 40) return false;
  if (/[:|/]/.test(s)) return false;
  if (/[A-Za-z]/.test(s)) return false;                 // без латиница/английски
  if (/\d/.test(s) && /^\d|\d{3,}/.test(s)) return false; // започва с число или дълъг номер (дати/кодове)
  if (/\((пояснение|уточнение|филм|група|album|сингъл|роман)\)/i.test(s)) return false;
  if (META_RE.test(s)) return false;
  // множествени групови съществителни (професии/личности) — грубо: една дума, завършваща на „-ци"/„-и"
  if (!/\s/.test(s) && META_SUFFIX.test(s) && s.length > 5) return false;
  return true;
}

// Харвест от seed-КАТЕГОРИИ (само СТАТИИ ns0 стават теми; подкатегориите се обхождат, но не се
// добавят като теми — те са мета). Плюс ТЪРСЕНЕ по думите на категорията (за категории без дърво).
async function harvest(seedCats, cap, searchWords) {
  const found = new Set();
  const catQ = seedCats.map((c) => ({ cat: c, d: 0 }));
  const catSeen = new Set(catQ.map((x) => x.cat));
  while (catQ.length && found.size < cap * 2) {
    const { cat, d } = catQ.shift();
    try {
      const data = await fetchRetry(q({ action: 'query', list: 'categorymembers', cmtitle: cat, cmlimit: '500', cmtype: 'page|subcat' }));
      for (const m of (data?.query?.categorymembers || [])) {
        if (m.ns === 14) {                                   // подкатегория → само за обхождане
          if (d < 1 && !catSeen.has(m.title)) { catSeen.add(m.title); catQ.push({ cat: m.title, d: d + 1 }); }
        } else if (okTitle(m.title)) { found.add(m.title); }
      }
    } catch (_) {}
    await sleep(150);
  }
  // Допълване чрез търсене (хваща категории без хубаво дърво, напр. Спортове/Мебели).
  for (const w of (searchWords || [])) {
    if (found.size >= cap * 2) break;
    try {
      const d = await fetchRetry(q({ action: 'query', list: 'search', srsearch: w, srlimit: '80', srnamespace: '0' }));
      for (const h of (d?.query?.search || [])) if (okTitle(h.title)) found.add(h.title);
    } catch (_) {}
    await sleep(150);
  }
  return [...found];
}

// Търсещи думи за допълване (за категории със слабо категорийно дърво).
const SEARCH = {
  'Спортове': ['спорт', 'олимпийски спорт', 'бойно изкуство', 'отборен спорт'],
  'Мебели и уреди': ['мебел', 'домакински уред', 'кухненски уред', 'битова техника'],
  'Професии': ['професия', 'занаят'],
  'Теми от ежедневието': ['бит', 'кулинария', 'домакинство', 'хоби'],
  'Компютърни приложения': ['софтуер', 'компютърна програма', 'приложение']
};

(async () => {
  const base = JSON.parse(await fs.readFile(path.join(dir, 'themes.curated.json'), 'utf8'));
  const used = new Set();                                   // глобален дедуп (без повтаряне между категории)
  const norm = (s) => s.toLowerCase().trim();
  const outCats = {};
  for (const [cat, curated] of Object.entries(base.categories)) {
    const list = [];
    const take = (name) => { const k = norm(name); if (!used.has(k) && okTitle(name)) { used.add(k); list.push(name); } };
    for (const c of curated) take(c);                        // първо ръчните (чисти)
    if (list.length < PER && SEEDS[cat]) {
      console.log(`  ${cat}: харвествам (имам ${list.length}/${PER})…`);
      const harvested = await harvest(SEEDS[cat] || [], PER * 2, SEARCH[cat]);
      for (const h of harvested) { if (list.length >= PER) break; take(h); }
    }
    outCats[cat] = list;
    console.log(`✓ ${cat}: ${list.length} теми`);
  }
  const result = { _doc: base._doc, linksPerTheme: base.linksPerTheme || 1000, lang: LANG, categories: outCats };
  await fs.writeFile(path.join(dir, 'themes.json'), JSON.stringify(result, null, 2), 'utf8');
  const total = Object.values(outCats).reduce((s, l) => s + l.length, 0);
  console.log(`\n✓ themes.json: ${total} уникални теми в ${Object.keys(outCats).length} категории (perCategory=${PER}).`);
})();
