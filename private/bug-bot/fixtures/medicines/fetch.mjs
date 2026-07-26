// fetch.mjs — сваля курираните тест-снимки от точните им url-и в manifest.json.
// Снимките НЕ се пазят в git (третостранни бинарни файлове); този скрипт ги възстановява 1:1.
// Пусни: `node fetch.mjs`  (от папката private/bug-bot/fixtures/medicines)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UA = { 'User-Agent': 'PupikesMedikit/1.0 (test fixtures; ltd.dai.grup@gmail.com)' };
const m = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));

let ok = 0;
for (const it of m.items) {
  const dst = path.join(HERE, it.file);
  if (fs.existsSync(dst)) { console.log('има', it.file); ok++; continue; }
  try {
    const r = await fetch(it.url, { headers: UA });
    if (!r.ok) { console.log('✗', it.file, 'http', r.status); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 3000) { console.log('✗', it.file, 'твърде малък'); continue; }
    fs.writeFileSync(dst, buf);
    console.log('✓', it.file, buf.length, 'байта');
    ok++;
  } catch (e) { console.log('✗', it.file, e.message); }
}
console.log(`\nГотово: ${ok}/${m.items.length}`);
