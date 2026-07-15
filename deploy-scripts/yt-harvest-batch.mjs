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
  ['quantum computing stocks google willow', 'en'],
  // Партида 2 (2026-07-16): имоти + пропуснати големи събития + нововъведения.
  ['2008 housing market crash explained', 'en'],
  ['china evergrande property crisis explained', 'en'],
  ['us housing market 2021 boom why prices', 'en'],
  ['housing market 2025 prices forecast', 'en'],
  ['dot com bubble 2000 crash explained', 'en'],
  ['black monday 1987 stock crash explained', 'en'],
  ['svb silicon valley bank collapse 2023 explained', 'en'],
  ['japan carry trade unwind august 2024 crash', 'en'],
  ['deepseek ai selloff nvidia january 2025', 'en'],
  ['bitcoin halving 2024 explained price', 'en'],
  ['ethereum merge 2022 explained price', 'en'],
  ['terra luna ust collapse 2022 explained', 'en'],
  ['gold all time high 2025 why', 'en'],
  ['fed rate hikes 2022 inflation stock market', 'en'],
  ['ai bubble 2026 burst or not', 'en'],
  // Партида 3 (2026-07-16): дупките — Европа, Азия (в апа има Nikkei/DAX/Nifty/Shanghai),
  // ретро уроци (1971/1989/2010/2015/2016) + крипто механизми (ICO, трежъри фирми, мем-монети).
  ['european debt crisis greece 2011 explained', 'en'],
  ['china stock market crash 2015 explained', 'en'],
  ['brexit 2016 market reaction pound explained', 'en'],
  ['flash crash may 2010 explained', 'en'],
  ['gamestop short squeeze january 2021 explained', 'en'],
  ['credit suisse collapse march 2023 explained', 'en'],
  ['japan bubble economy 1989 nikkei crash explained', 'en'],
  ['nixon ends gold standard 1971 explained', 'en'],
  ['dogecoin 2021 elon musk rally explained', 'en'],
  ['ethereum ico boom 2017 explained', 'en'],
  ['microstrategy bitcoin treasury strategy explained', 'en'],
  ['germany dax energy crisis 2022 stocks', 'en'],
  ['india nifty stock market rally 2024 why', 'en'],
  ['archegos collapse 2021 explained', 'en'],
  ['stablecoins genius act 2025 crypto explained', 'en']
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
