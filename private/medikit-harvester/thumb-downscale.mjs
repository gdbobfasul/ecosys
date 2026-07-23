// Смалява снимковата библиотека на Pupikes Doctor до thumbnails ~256px JPEG (в място). Стои ВЪТРЕ
// в репото, за да се резолвва `sharp` от кореновия node_modules. Пуск от repo ROOT:
//   node private/medikit-harvester/thumb-downscale.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('rustore/pupikes-doctor/publish/reference/images');
if (!fs.existsSync(DIR)) { console.error('няма папка', DIR); process.exit(1); }
const files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp|bmp)$/i.test(f));
console.log(`[thumb] ${files.length} файла`);
let done = 0, skipped = 0, failed = 0, freed = 0;
for (const f of files) {
  const p = path.join(DIR, f);
  let st; try { st = fs.statSync(p); } catch { continue; }
  if (st.size < 45000) { skipped++; continue; }
  const tmp = p + '.tmp';
  try {
    await sharp(p, { failOn: 'none' }).rotate()
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 }).toFile(tmp);
    const ns = fs.statSync(tmp).size;
    if (ns > 0 && ns < st.size) { fs.renameSync(tmp, p); freed += (st.size - ns); done++; }
    else { fs.unlinkSync(tmp); skipped++; }
  } catch (e) { try { fs.unlinkSync(tmp); } catch {} failed++; }
  if ((done + skipped + failed) % 1500 === 0) console.log(`[thumb] ${done + skipped + failed}/${files.length} · освободени ${(freed / 1e6).toFixed(0)}MB`);
}
console.log(`[thumb] ГОТОВО смалени=${done} пропуснати=${skipped} провал=${failed} · освободени ${(freed / 1e6).toFixed(0)}MB`);
