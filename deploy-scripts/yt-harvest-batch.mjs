// Version: 1.0001
// yt-harvest-batch.mjs — ПАРТИДИ за YouTube събирача: тема × година, с ПАУЗИ между заявките
// (YouTube лимитира по IP — 429). Пуска yt-harvest.mjs последователно; спира партидата при
// повтарящи се 429 и продължава следващия път (готовите файлове се пропускат).
//   node deploy-scripts/yt-harvest-batch.mjs
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'yt-harvest');
const PAUSE_S = 45;              // пауза между заявките (анти-429)
const PER_QUERY = 4;             // видеа на заявка

// Тема × година: крипто/индекси/злато/нововъведения (сигналите на собственика: AI, квант, BlackRock).
const QUERIES = [
  ['bitcoin 2013 rally china explained', 'en'],
  ['bitcoin 2014 mt gox collapse explained', 'en'],
  ['bitcoin 2017 bull run why', 'en'],
  ['crypto 2018 bear market explained', 'en'],
  ['bitcoin march 2020 covid crash', 'en'],
  ['bitcoin 2021 all time high why', 'en'],
  ['ftx collapse 2022 explained', 'en'],
  ['bitcoin etf blackrock 2024 approved', 'en'],
  ['bitcoin 2025 all time high 126k', 'en'],
  ['bitcoin 2026 correction why falling', 'en'],
  ['2008 financial crisis stock market explained', 'en'],
  ['covid stock market crash march 2020', 'en'],
  ['nvidia ai stocks rally 2023 explained', 'en'],
  ['stock market tariffs april 2025 crash', 'en'],
  ['gold price record 2011 why', 'en'],
  ['gold price rally 2024 central banks', 'en'],
  ['chatgpt ai boom stock market impact', 'en'],
  ['quantum computing stocks google willow', 'en']
];

function slugOf(q) { return q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60); }
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

let done = 0, skipped = 0, failed = 0;
for (const [q, lang] of QUERIES) {
  const f = path.join(OUT, slugOf(q) + '.json');
  if (fs.existsSync(f)) { console.log('↷ пропускам (има го): ' + q); skipped++; continue; }
  console.log('\n━━ ' + q);
  try {
    const out = execFileSync('node', [path.join(__dirname, 'yt-harvest.mjs'), q, String(PER_QUERY), lang],
      { encoding: 'utf8', timeout: 10 * 60 * 1000, windowsHide: true });
    console.log(out.trim().split(/\r?\n/).slice(-2).join('\n'));
    done++;
  } catch (e) {
    console.log('✗ провал: ' + String(e.message || '').slice(0, 120));
    failed++;
    if (failed >= 3) { console.log('Твърде много провали (вероятно 429) — спирам партидата; пусни пак по-късно.'); break; }
  }
  await sleep(PAUSE_S);
}
console.log(`\n═══ Партида: ${done} нови, ${skipped} пропуснати, ${failed} провала. Файлове в ${OUT}`);
