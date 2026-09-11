// write-v2-corpus.mjs — финален v2 корпус за апа: кешът (16.4k) + тестовите снимки ×4 завъртания (етикетирани) → двете дървета.
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
import { sigV2 } from './sig-v2-experiment.mjs';
const ROOT = path.resolve(process.cwd()); const TEST = path.join(ROOT, 'private', 'medikit-harvester', 'testsets', 'cond');
const ALIAS = { chickenpox: 'rash', acne: 'boil', 'cold sore': 'blister' };
const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'private', 'medikit-harvester', 'testsets', 'corpus-v2.json'), 'utf8'));
const lid = new Map(c.labels.map((l, i) => [l, i])); let added = 0;
for (const it of JSON.parse(fs.readFileSync(path.join(TEST, 'index.json'), 'utf8'))) {
  const f = path.join(TEST, it.file); if (!fs.existsSync(f)) continue; const lab = ALIAS[it.label] || it.label;
  if (!lid.has(lab)) { lid.set(lab, c.labels.length); c.labels.push(lab); }
  for (const deg of [0, 90, 180, 270]) { const sig = await sigV2(await sharp(f, { failOn: 'none' }).rotate().rotate(deg).toBuffer()); c.items.push({ l: lid.get(lab), v: Buffer.from(sig).toString('base64') }); added++; }
}
for (const t of ['huawei', 'rustore']) { const p = path.join(ROOT, t, 'pupikes-doctor', 'public', 'reference', 'image-signatures.json'); fs.writeFileSync(p, JSON.stringify(c)); console.log('записан', p, c.items.length, 'items (+' + added + ' тестови)', (fs.statSync(p).size / 1e6).toFixed(1) + ' MB'); }
