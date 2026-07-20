// Version: 1.0001
// yt-harvest.mjs — СЪБИРАЧ на информация от YouTube (какво се ГОВОРИ във видеата) чрез субтитри.
// БЕЗ API ключ: yt-dlp търси по тема и тегли субтитрите (ръчни или авто-генерирани), скриптът ги
// чисти до плътен текст и записва JSON база (за Pupikes Market Pulse events/настроения и за SLF речници).
//
// Употреба:
//   node deploy-scripts/yt-harvest.mjs "<заявка>" [брой] [език]
//   node deploy-scripts/yt-harvest.mjs "bitcoin 2017 crash" 5 en
// Изход: deploy-scripts/yt-harvest/<слъг>.json  → [{id,title,channel,date,url,lang,words,text}]
//
// Бележки: (1) авто-субтитрите повтарят редове (rolling captions) — чистим дубликатите;
// (2) при масово теглене YouTube лимитира по IP → прави ПАРТИДИ с паузи (--sleep вграден);
// (3) фаза 2 (видеа БЕЗ субтитри → Whisper реч→текст) е отделна, иска ffmpeg + faster-whisper.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(__dirname, 'yt-harvest');
const TMP = path.join(OUT_ROOT, '_tmp');

const query = process.argv[2];
const count = Math.max(1, Math.min(30, parseInt(process.argv[3], 10) || 5));
const lang = (process.argv[4] || 'en').trim();
if (!query) { console.log('Употреба: node deploy-scripts/yt-harvest.mjs "<заявка>" [брой=5] [език=en]'); process.exit(1); }

fs.mkdirSync(TMP, { recursive: true });
const slug = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'query';

function ytdlp(args, timeoutMs) {
  return execFileSync('python', ['-m', 'yt_dlp', ...args], { encoding: 'utf8', timeout: timeoutMs || 300000, windowsHide: true });
}

// 1) Търсене + метаданни (без сваляне) — един ред JSON на видео.
console.log(`🔎 Търся ${count} видеа за: "${query}" (субтитри: ${lang})`);
let metaRaw = '';
try {
  metaRaw = ytdlp([`ytsearch${count}:${query}`, '--skip-download', '--no-warnings', '--flat-playlist',
    '--print', '%(id)s\t%(title)s\t%(channel)s\t%(upload_date,release_date)s']);
} catch (e) { console.log('Търсенето се провали: ' + (e.stderr || e.message)); process.exit(2); }
const videos = metaRaw.trim().split(/\r?\n/).filter(Boolean).map((ln) => {
  const [id, title, channel, date] = ln.split('\t');
  return { id, title: title || '', channel: channel || '', date: date || '' };
}).filter((v) => v.id && v.id.length === 11);
console.log(`Намерени: ${videos.length}`);

// 2) За всяко видео: теглим субтитри (.vtt) → чистим до текст.
function cleanVtt(vtt) {
  const seen = new Set(); const out = [];
  for (let line of String(vtt).split(/\r?\n/)) {
    line = line.trim();
    if (!line || line === 'WEBVTT' || /^(Kind|Language):/i.test(line)) continue;
    if (/^\d+$/.test(line) || /-->/ .test(line)) continue;                 // номера/таймкодове
    line = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;                                           // rolling дубликати
    seen.add(key); out.push(line);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

const results = [];
for (const v of videos) {
  const url = 'https://www.youtube.com/watch?v=' + v.id;
  process.stdout.write(`  • ${v.id} ${v.title.slice(0, 60)} … `);
  // изчисти временните файлове от предишното видео
  for (const f of fs.readdirSync(TMP)) { try { fs.unlinkSync(path.join(TMP, f)); } catch (_) {} }
  try {
    ytdlp([url, '--skip-download', '--no-warnings',
      '--write-subs', '--write-auto-subs', '--sub-langs', `${lang}.*,${lang}`, '--sub-format', 'vtt',
      '--sleep-requests', '1', '-o', path.join(TMP, '%(id)s.%(ext)s')], 180000);
  } catch (_) { /* някои видеа нямат субтитри/недостъпни — продължаваме */ }
  const vttFile = fs.readdirSync(TMP).find((f) => f.startsWith(v.id) && f.endsWith('.vtt'));
  if (!vttFile) { console.log('без субтитри'); continue; }
  const text = cleanVtt(fs.readFileSync(path.join(TMP, vttFile), 'utf8'));
  const words = text.split(/\s+/).length;
  if (words < 30) { console.log('празни субтитри'); continue; }
  results.push({ id: v.id, title: v.title, channel: v.channel, date: v.date, url, lang, words, text });
  console.log(`✓ ${words} думи`);
}

// 3) Записваме базата.
const outFile = path.join(OUT_ROOT, slug + '.json');
fs.writeFileSync(outFile, JSON.stringify({ query, lang, harvestedAt: new Date().toISOString(), videos: results }, null, 1));
try { for (const f of fs.readdirSync(TMP)) fs.unlinkSync(path.join(TMP, f)); fs.rmdirSync(TMP); } catch (_) {}
console.log(`\nГотово: ${results.length}/${videos.length} видеа с текст → ${outFile}`);
console.log(`Общо думи: ${results.reduce((s, r) => s + r.words, 0)}`);
