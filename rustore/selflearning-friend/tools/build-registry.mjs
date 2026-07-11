// build-registry.mjs — author-time: генерира tools/sources-registry.json от tools/themes.json.
// За ВСЯКА тема от таксономията създава източник за рекурсивно откриване на линкове (Уикипедия
// категорийно дърво + търсене) с таван linksPerTheme (по подразбиране 1000). Така „източниците по
// точка 1" стават готови автоматично за стотиците теми, без ръчно подаване на линкове.
//
// Запазва РЪЧНО настроените теми (ако вече съществуват в регистъра с повече от 1 източник —
// напр. математика с Уикикниги/Уикиверситет/Gutenberg — те НЕ се презаписват).
//
// Употреба: node tools/build-registry.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const themes = JSON.parse(await fs.readFile(path.join(dir, 'themes.json'), 'utf8'));
const lang = themes.lang || 'bg';
const perTheme = themes.linksPerTheme || 1000;

// Съществуващ регистър (за да пазим ръчните обогатявания).
let existing = { themes: {} };
try { existing = JSON.parse(await fs.readFile(path.join(dir, 'sources-registry.json'), 'utf8')); } catch {}

const out = {
  _doc: existing._doc || 'Регистър от източници по тема (генериран от themes.json чрез build-registry.mjs). Типове: wikipedia|mediawiki|rss|json|html|gutendex.',
  themes: {}
};

let generated = 0, kept = 0;
for (const [category, list] of Object.entries(themes.categories || {})) {
  for (const name of list) {
    const prev = existing.themes && existing.themes[name];
    if (prev && Array.isArray(prev.sources) && prev.sources.length > 1) {
      out.themes[name] = { ...prev, category };   // ръчно обогатена → запазваме, само маркираме категорията
      kept++;
      continue;
    }
    out.themes[name] = {
      name,
      category,
      sources: [
        { type: 'wikipedia', lang, seeds: [name], categories: ['Категория:' + name], recurse: 2, max: perTheme }
      ]
    };
    generated++;
  }
}

await fs.writeFile(path.join(dir, 'sources-registry.json'), JSON.stringify(out, null, 2), 'utf8');
const total = Object.keys(out.themes).length;
console.log(`✓ sources-registry.json: ${total} теми (${generated} генерирани, ${kept} ръчно запазени).`);
console.log('  Следва: node tools/collect-all.mjs  (пуска събирача за всяка тема → пакети + catalog.json).');
