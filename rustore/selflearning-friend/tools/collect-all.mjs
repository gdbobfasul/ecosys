// collect-all.mjs — author-time БОТ-СЪБИРАЧ (пакетен): минава през ВСИЧКИ теми от
// sources-registry.json, пуска build-pack.mjs за всяка (тема = речник) и накрая пише
// catalog.json — индекс на готовите пакети, който приложението може да ползва, за да
// зарежда знание по тема по желание на клиента.
//
// Изходът е в dist-packs/ (за ХОСТВАНЕ, НЕ в src/packs/ — да не подуе APK-то). Хостни папката и
// в апа „зареди речник от <URL>", или качи catalog.json и зареждай по тема от него.
//
// Употреба:
//   node tools/collect-all.mjs                 # всички теми
//   node tools/collect-all.mjs --limit 5       # само първите 5 (за проба)
//   node tools/collect-all.mjs --max 1000      # таван линкове/тема
//   node tools/collect-all.mjs --concurrency 2 # успоредни теми (пази лимитите на Уикипедия)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(dir, '..');
const args = process.argv.slice(2);
const getOpt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LIMIT = parseInt(getOpt('limit', '0'), 10) || 0;
const MAX = getOpt('max', '');
const CONC = Math.max(1, parseInt(getOpt('concurrency', '2'), 10) || 2);
const OUTDIR = path.join(appRoot, 'dict');

const reg = JSON.parse(await fs.readFile(path.join(dir, 'sources-registry.json'), 'utf8'));
let themes = Object.entries(reg.themes || {});
if (LIMIT) themes = themes.slice(0, LIMIT);
await fs.mkdir(OUTDIR, { recursive: true });

const slugify = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

function runOne(name, meta) {
  return new Promise((resolve) => {
    const slug = slugify(name);
    const outFile = path.join(OUTDIR, `pack-${slug}.json`);
    const a = [path.join(dir, 'build-pack.mjs'), name, '--out', outFile];
    if (MAX) a.push('--max', MAX);
    const ch = spawn(process.execPath, a, { cwd: appRoot, stdio: ['ignore', 'inherit', 'inherit'] });
    ch.on('close', async () => {
      let count = 0, bytes = 0, terms = 0, entries = 0;
      try {
        const buf = await fs.readFile(outFile);
        bytes = buf.length;
        const p = JSON.parse(buf.toString('utf8'));
        terms = (p.terms || []).length; entries = (p.entries || []).length; count = terms + entries;
      } catch { /* темата не даде резултат */ }
      resolve({ theme: name, category: meta.category || '', file: `pack-${slug}.json`, terms, entries, count, bytes });
    });
  });
}

// Успоредно, но ограничено (да не ни лимитира Уикипедия).
const catalog = [];
let idx = 0;
async function worker() {
  while (idx < themes.length) {
    const my = idx++;
    const [name, meta] = themes[my];
    console.log(`\n[${my + 1}/${themes.length}] ${name} (${meta.category || '-'})…`);
    const r = await runOne(name, meta);
    catalog.push(r);
    console.log(`   → ${r.count} записа, ${Math.round(r.bytes / 1024)} KB`);
  }
}
await Promise.all(Array.from({ length: Math.min(CONC, themes.length) }, worker));

catalog.sort((a, b) => a.category.localeCompare(b.category) || a.theme.localeCompare(b.theme));
const index = {
  generatedFrom: 'sources-registry.json',
  note: 'Индекс на готовите тематични пакети. Зареди пакет: importPackFromUrl(<baseUrl> + file).',
  count: catalog.length,
  packs: catalog
};
await fs.writeFile(path.join(OUTDIR, 'catalog.json'), JSON.stringify(index, null, 2), 'utf8');
const totalKB = Math.round(catalog.reduce((s, p) => s + p.bytes, 0) / 1024);
console.log(`\n✓ ${catalog.length} пакета в ${OUTDIR}/  (общо ${totalKB} KB) + catalog.json`);
console.log('  Хостни dist-packs/ и в апа зареждай „зареди речник от <baseUrl>/pack-<тема>.json" (или по catalog.json).');
