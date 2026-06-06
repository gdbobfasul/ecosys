// Сваля ВСИЧКИ държави + градове веднъж и ги записва ЛОКАЛНО като статични JSON,
// за да не зависим от външното API по време на работа („винаги на наше разположение").
// Изход:
//   public/shared/geo/countries.json        — [{name, slug, count}] (индекс)
//   public/shared/geo/cities/<slug>.json     — сортиран списък градове за всяка държава
// Пускане:  node scripts/build-geo.js   (изисква интернет ЕДНОКРАТНО)
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const SRC = 'https://countriesnow.space/api/v0.1/countries';
const OUT = path.join(__dirname, '..', 'public', 'shared', 'geo');
const CITIES_DIR = path.join(OUT, 'cities');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return get(r.headers.location).then(resolve, reject); // следвай redirect
      }
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

(async () => {
  console.log('Сваляне на всички държави + градове…');
  const json = JSON.parse(await get(SRC));
  const data = json.data || [];
  if (!data.length) throw new Error('API върна празно');

  fs.mkdirSync(CITIES_DIR, { recursive: true });
  // изчисти стари файлове
  for (const f of fs.readdirSync(CITIES_DIR)) if (f.endsWith('.json')) fs.unlinkSync(path.join(CITIES_DIR, f));

  const index = [];
  let totalCities = 0;
  const usedSlugs = {};
  for (const c of data) {
    const name = c.country;
    if (!name) continue;
    let sl = slug(name);
    while (usedSlugs[sl]) sl += '-x'; // уникален slug
    usedSlugs[sl] = true;
    const cities = Array.from(new Set((c.cities || []).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    fs.writeFileSync(path.join(CITIES_DIR, sl + '.json'), JSON.stringify(cities));
    index.push({ name: name, slug: sl, count: cities.length });
    totalCities += cities.length;
  }
  index.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(path.join(OUT, 'countries.json'), JSON.stringify(index));
  console.log(`Готово ✓  ${index.length} държави · ${totalCities} града`);
  console.log(`  → ${path.join(OUT, 'countries.json')}`);
  console.log(`  → ${CITIES_DIR}/<slug>.json`);
})().catch((e) => { console.error('Грешка:', e.message); process.exit(1); });
