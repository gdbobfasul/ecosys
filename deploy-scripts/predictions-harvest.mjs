// Version: 1.0001
// predictions-harvest.mjs — СЪБИРАЧ НА ПРОГНОЗИ „кой какво казва" от YouTube анализи
// (искане на потребителя за Market Pulse): от субтитрите на видеата вади изречения-
// предсказания — „цената ще ПАДНЕ до …" / „ще СЕ ВДИГНЕ до …" (+ година, ако е казана),
// със СЪХРАНЕН автор (каналът) и линк към видеото.
//
// Употреба:
//   node deploy-scripts/predictions-harvest.mjs bitcoin "bitcoin price prediction 2026" [брой=8]
//   node deploy-scripts/predictions-harvest.mjs gold "gold price forecast 2026" 8
// Изход: public/predictions/<актив>.json → { updated, asset, query, predictions:[
//   { channel, title, date, url, quote, direction:'up'|'down'|'target', prices:[...], year } ] }
// Пайплайнът ползва готовия yt-harvest.mjs (търсене + субтитри → чист текст).
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const asset = process.argv[2];
const query = process.argv[3];
const count = Math.max(1, Math.min(20, parseInt(process.argv[4], 10) || 8));
if (!asset || !query) {
  console.log('Употреба: node deploy-scripts/predictions-harvest.mjs <актив> "<заявка>" [брой=8]');
  process.exit(1);
}

// 1) Събери субтитрите през готовия събирач.
console.log(`▶ Събирам ${count} видеа за „${query}"…`);
execFileSync('node', [path.join(__dirname, 'yt-harvest.mjs'), query, String(count), 'en'],
  { stdio: 'inherit', timeout: 1200000 });
const slug = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
const harvestFile = path.join(__dirname, 'yt-harvest', slug + '.json');
const harvested = JSON.parse(fs.readFileSync(harvestFile, 'utf8'));
const videos = Array.isArray(harvested) ? harvested : (harvested.videos || []);

// 2) Извади изреченията-прогнози.
const DOWN = /\b(fall|drop|crash|dump|plunge|correct|decline|dip|bottom|go down|come down|pull\s?back|retrace)\w*\b/i;
const UP = /\b(rise|rally|reach|hit|surge|climb|pump|moon|go up|break(?:out)?|top out|peak|target|explode|soar)\w*\b/i;
// цени: $104,000 · 104k · 104 000 dollars · 1.2 million
const PRICE = /(?:\$\s?\d[\d,.]*\s?(?:k|m|million|billion|thousand)?|\b\d[\d,.]*\s?(?:k|thousand|million|billion)\b|\b\d{2,3}(?:[.,]\d{3})+\b)/gi;
const YEAR = /\b(202[4-9]|203\d)\b/;

function toNumber(p) {
  let s = String(p).toLowerCase().replace(/[$\s]/g, '');
  let mult = 1;
  if (/k|thousand/.test(s)) { mult = 1e3; s = s.replace(/k|thousand/g, ''); }
  if (/m|million/.test(s)) { mult = 1e6; s = s.replace(/m|million/g, ''); }
  if (/billion/.test(s)) { mult = 1e9; s = s.replace(/billion/g, ''); }
  s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n * mult : null;
}

const predictions = [];
for (const v of videos) {
  if (!v.text) continue;
  // изречения (субтитрите нямат пунктуация навсякъде → режем и по дължина)
  const sentences = v.text.split(/(?<=[.!?])\s+/).flatMap((s) => s.length > 300 ? s.match(/.{1,240}(?:\s|$)/g) || [s] : [s]);
  const picked = [];
  for (const s of sentences) {
    const prices = s.match(PRICE);
    if (!prices) continue;
    const hasDown = DOWN.test(s), hasUp = UP.test(s);
    if (!hasDown && !hasUp) continue;
    const nums = prices.map(toNumber).filter((n) => n != null && n >= 10);   // изхвърли проценти/дребни
    if (!nums.length) continue;
    const ym = s.match(YEAR);
    picked.push({
      quote: s.trim().slice(0, 260),
      direction: hasDown && !hasUp ? 'down' : hasUp && !hasDown ? 'up' : 'target',
      prices: [...new Set(nums)].slice(0, 3),
      year: ym ? parseInt(ym[1], 10) : null,
      score: (ym ? 2 : 0) + (hasDown !== hasUp ? 1 : 0)
    });
  }
  picked.sort((a, b) => b.score - a.score);
  for (const p of picked.slice(0, 3)) {
    predictions.push({ channel: v.channel, title: v.title, date: v.date, url: v.url, quote: p.quote, direction: p.direction, prices: p.prices, year: p.year });
  }
}

// 3) Запис в public/predictions/ (сървира се от прод; апът го тегли оттам).
const outDir = path.join(__dirname, '..', 'public', 'predictions');
fs.mkdirSync(outDir, { recursive: true });
const out = { updated: new Date().toISOString().slice(0, 10), asset, query, videos: videos.length, predictions };
fs.writeFileSync(path.join(outDir, asset + '.json'), JSON.stringify(out, null, 2));
console.log(`✓ ${predictions.length} прогнози от ${videos.length} видеа → public/predictions/${asset}.json`);
