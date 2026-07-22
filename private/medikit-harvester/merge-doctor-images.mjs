// merge-doctor-images.mjs — СГЛОБЯВАНЕ (пусни СЛЕД като ботовете спрат).
// Чете реалната папка images/ от диска (устойчиво на надпревара между ботовете), сглобява
// единия master images-index.json, дедуплира по съдържание (размер+хеш), маха повредени/дребни
// файлове и отчита общия брой + разбивка по източник. Не разчита на нито един shard за истината —
// само за етикетите (файл→състояние). Пуск: node private/medikit-harvester/merge-doctor-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'rustore', 'pupikes-doctor', 'publish', 'reference');
const IMGDIR = path.join(OUT, 'images');
const MASTER = path.join(OUT, 'images-index.json');

// 1) Събери етикетите (файл→{article,source,url}) от всички shard/master индекси, ако ги има.
const label = new Map();
for (const f of fs.readdirSync(OUT).filter((x) => /^images-index.*\.json$/.test(x))) {
  try {
    for (const it of (JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')).items || [])) {
      const base = path.basename(it.file || '');
      if (base) label.set(base, { article: it.article || '', source: it.source || '', url: it.url || '' });
    }
  } catch (_) {}
}

// 2) Обходи диска — това е истината. Дедуп по (размер + sha1 на първите 64KB).
const files = fs.readdirSync(IMGDIR).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
const seenHash = new Set();
const items = [];
const bySource = {};
let dropped = 0, tooSmall = 0;
for (const f of files) {
  const p = path.join(IMGDIR, f);
  let st; try { st = fs.statSync(p); } catch (_) { continue; }
  if (st.size < 4000) { try { fs.unlinkSync(p); } catch (_) {} tooSmall++; continue; }
  let h;
  try { const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(Math.min(65536, st.size)); fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
    h = st.size + ':' + crypto.createHash('sha1').update(buf).digest('hex'); } catch (_) { continue; }
  if (seenHash.has(h)) { try { fs.unlinkSync(p); } catch (_) {} dropped++; continue; }   // точен дубликат → трие
  seenHash.add(h);
  const meta = label.get(f) || {};
  // Ако няма етикет — извади състоянието от префикса на името (напр. ov_<slug>_.., c_<slug>_..).
  let article = meta.article;
  if (!article) { const m = f.match(/^(?:ov|oi|isic|c|cx|cs)_([a-z0-9]+(?:_[a-z0-9]+)*?)_[0-9]/i); article = m ? m[1].replace(/_/g, ' ') : ''; }
  const src = meta.source || (f.startsWith('ov_') ? 'Openverse' : f.startsWith('oi_') ? 'Open-i (NIH/NLM)' : f.startsWith('isic_') ? 'ISIC Archive' : f.startsWith('c_') || f.startsWith('cx_') ? 'Wikimedia Commons' : 'Wikipedia');
  bySource[src] = (bySource[src] || 0) + 1;
  items.push({ file: 'images/' + f, article, source: src, url: meta.url || '' });
}

fs.writeFileSync(MASTER, JSON.stringify({ count: items.length, source: 'Wikipedia + Wikimedia Commons + Openverse + Open-i (NIH) + ISIC (CC/PD)', updated: new Date().toISOString().slice(0, 10), items }, null, 2));
console.log(`\n===== СГЛОБЕНО =====`);
console.log(`Общо снимки: ${items.length}`);
console.log(`Изтрити точни дубликати: ${dropped}; повредени/дребни: ${tooSmall}`);
console.log(`Разбивка по източник:`);
for (const [s, n] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(6)}  ${s}`);
console.log(`\nИндекс → ${MASTER}`);
