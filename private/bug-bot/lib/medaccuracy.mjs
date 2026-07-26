// medaccuracy.mjs — РЕАЛЕН тест за ТОЧНОСТ на медицинските апове: сваля етикетирани снимки от
// ДОСТОВЕРНИ клинични източници, подава ги на СЪЩИЯ анализ на приложението и проверява дали
// намереното съвпада с етикета до снимката (от източника). Ако да → апът работи.
//
// Doctor: източник = ISIC Archive (International Skin Imaging Collaboration — клиничен консорциум на
//   болници/университети; всяка снимка носи РЕАЛНА диагноза в metadata). Възпроизвеждаме ТОЧНО мача на
//   апа: 128-байтов отпечатък (сподели `signature()` от build-image-signatures) → K=15 L1-съседи →
//   гласуване на етикети. PASS ако топ-K съдържа диагнозата (точно ИЛИ по злокачественост).
//
// „Спорадично": всеки пробег прескача СЛУЧАЕН брой страници на архива (по индекс, подаден отвън —
// без Math.random в самия модул, за възпроизводимост при нужда).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { signature } from '../../medikit-harvester/build-image-signatures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIGS_PATH = path.resolve(HERE, '..', '..', '..', 'rustore', 'pupikes-doctor', 'public', 'reference', 'image-signatures.json');
const UA = { 'User-Agent': 'PupikesMedikit/1.0 (educational test; ltd.dai.grup@gmail.com)' };
const ISIC = 'https://api.isic-archive.com/api/v2/images/?limit=100';

async function getJson(url) { for (let a = 0; a < 3; a++) { try { const r = await fetch(url, { headers: UA }); if (r.status === 429) { await new Promise((z) => setTimeout(z, 8000)); continue; } if (!r.ok) return null; return await r.json(); } catch (_) { await new Promise((z) => setTimeout(z, 1500)); } } return null; }
async function getBuf(url) { const r = await fetch(url, { headers: UA }); if (!r.ok) return null; return Buffer.from(await r.arrayBuffer()); }

// Истинската диагноза (както в събирача): йерархични полета diagnosis_3→2→1.
function pickDx(cl) {
  if (!cl) return null;
  const d = cl.diagnosis_3 || cl.diagnosis_2 || cl.diagnosis_1 || cl.benign_malignant;
  if (!d) return null;
  return String(d).trim().replace(/,\s*(nos|not otherwise specified).*$/i, '').split(',')[0].trim().toLowerCase() || null;
}
const malignancy = (s) => /melanoma|carcinoma|malign/.test(s) ? 'malignant' : /nevus|naevus|keratosis|benign|dermatofibroma|lentigo|angioma/.test(s) ? 'benign' : 'other';

// ── Зарежда вградения опис на апа (labels + отпечатъци) ──
function loadSigs() {
  const j = JSON.parse(fs.readFileSync(SIGS_PATH, 'utf8'));
  const dim = j.dim || 128, n = j.items.length;
  const flat = new Uint8Array(n * dim), labs = new Int32Array(n);
  for (let i = 0; i < n; i++) { const b = Buffer.from(j.items[i].v, 'base64'); for (let k = 0; k < dim; k++) flat[i * dim + k] = b[k]; labs[i] = j.items[i].l | 0; }
  return { dim, n, flat, labs, labels: j.labels || [] };
}
// ТОЧНО мачът на апа: K=15 L1-съседи → гласуване на етикети → топ-K.
function matchTopK(S, q, K = 15) {
  const bestD = new Array(K).fill(Infinity), bestI = new Array(K).fill(-1), dim = S.dim;
  for (let i = 0; i < S.n; i++) {
    let d = 0; const off = i * dim;
    for (let k = 0; k < dim; k++) { const df = q[k] - S.flat[off + k]; d += df < 0 ? -df : df; }
    if (d < bestD[K - 1]) { let j = K - 1; while (j > 0 && bestD[j - 1] > d) { bestD[j] = bestD[j - 1]; bestI[j] = bestI[j - 1]; j--; } bestD[j] = d; bestI[j] = i; }
  }
  const counts = new Map();
  for (let t = 0; t < K; t++) { const i = bestI[t]; if (i < 0) continue; const lab = (S.labels[S.labs[i]] || '').replace(/^dermatology:\s*/, ''); counts.set(lab, (counts.get(lab) || 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  top.minDist = bestD[0];   // най-близкото разстояние (≈0 → снимката вероятно е В корпуса = изтичане)
  return top;
}

export async function runMedAccuracy({ log, samples = 8, skipPages = 0 } = {}) {
  const say = (m) => { if (log) log(m); };
  const findings = [];
  const now = () => new Date().toISOString();
  const S = loadSigs();
  say(`   вграден опис: ${S.n} отпечатъка · ${S.labels.length} диагнози`);

  // Събери етикетирани снимки от ISIC (спорадично: прескочи skipPages страници).
  let url = ISIC, page = 0; const cases = [];
  while (url && cases.length < samples && page < skipPages + 12) {
    const j = await getJson(url); if (!j || !j.results) break;
    if (page >= skipPages) {
      for (const it of j.results) {
        const dx = pickDx(it.metadata && it.metadata.clinical); if (!dx) continue;
        const f = it.files && (it.files.thumbnail_256 || it.files.full); if (!f || !f.url) continue;
        cases.push({ id: it.isic_id, dx, url: f.url });
        if (cases.length >= samples) break;
      }
    }
    url = j.next; page++;
  }
  if (!cases.length) { findings.push({ ts: now(), severity: 'error', kind: 'medaccuracy', app: 'pupikes-doctor', detail: 'не се свалиха етикетирани снимки от ISIC (мрежа?)' }); return { findings, summary: { passed: 0, total: 0 } }; }

  // Разделяме на ВИЖДАНИ (снимката е в отпечатъчния корпус, minDist≈0 → тривиално) и НЕВИЖДАНИ
  // (не е в корпуса → истинска проверка на обобщаването). Отчитаме двете поотделно — честно.
  const LEAK = 20;
  let seen = 0, novel = 0, novelHit = 0, novelExact = 0;
  for (const c of cases) {
    try {
      const buf = await getBuf(c.url); if (!buf) { say(`   · ${c.id}: не се свали`); continue; }
      const q = await signature(buf);
      const top = matchTopK(S, q);
      if (!top.length) { say(`   · ${c.id}: без резултат`); continue; }
      const topLabels = top.map((t) => t.label);
      const isExact = topLabels.some((l) => l.includes(c.dx) || c.dx.includes(l.split(' ')[0]));
      const isFamily = topLabels.some((l) => malignancy(l) !== 'other' && malignancy(l) === malignancy(c.dx));
      const hit = isExact || isFamily;
      const inCorpus = top.minDist != null && top.minDist < LEAK;
      if (inCorpus) { seen++; }
      else { novel++; if (hit) novelHit++; if (isExact) novelExact++; }
      say(`   ${hit ? (isExact ? '✓' : '≈') : '✗'} „${c.dx}" → ${topLabels.slice(0, 3).join(', ')}${inCorpus ? ' [в корпуса]' : ' [НЕВИЖДАНА]'}`);
    } catch (e) { say(`   · ${c.id}: грешка ${e.message}`); }
  }

  const novelRate = novel ? Math.round((novelHit / novel) * 100) : null;
  say(`   → Doctor: пайплайнът работи на ${seen} виждани · обобщаване: ${novelHit}/${novel} невиждани` + (novelRate != null ? ` (${novelRate}%, точно ${novelExact})` : ' (няма невиждани в извадката)'));
  // Находка САМО за обобщаването върху НЕВИЖДАНИ (виждани=100% е тривиално и не значи нищо).
  if (novel >= 5 && novelRate < 35) findings.push({ ts: now(), severity: 'warn', kind: 'medaccuracy', app: 'pupikes-doctor', detail: `Doctor: слабо обобщаване върху НЕВИЖДАНИ клинични снимки (${novelRate}% на ${novel} снимки) — корпусът/мачът искат подобрение` });

  return { findings, summary: { seen, novel, novelHit, novelExact, novelRate } };
}
