// harvest-medicines-bulk.mjs — МАСОВО събиране на лекарства от openFDA (260k етикета, без ключ).
// Филтрира хомеопатия/козметика, дедуплира по генерично име, вади активни съставки + за какво е.
// Изход: rustore/pupikes-medicines/public/reference/meds-db.json {count, items:[{names,title,active,description}]}
// Пуск от repo ROOT:  node private/medikit-harvester/harvest-medicines-bulk.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUTS = ['rustore', 'huawei'].map((t) => path.join(ROOT, t, 'pupikes-medicines', 'public', 'reference', 'meds-db.json'));
const TARGET = parseInt(process.env.TARGET || '4000', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let a = 0; a < 5; a++) {
    try { const r = await fetch(url); if (r.status === 429) { await sleep(8000); continue; } if (!r.ok) return null; return await r.json(); }
    catch (_) { await sleep(2000); }
  }
  return null;
}

// Изчиства текстов къс от openFDA (маха водещи номера/заглавия на секции и повтарящ се шум).
function clean(s, max) {
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(\d+(\.\d+)?\s*)?(uses?|purpose|indications?( and usage)?|warnings?|dosage( and administration)?|directions?|do not use|when using this product|ask a doctor)\s*:?\s*/i, '');
  return t.slice(0, max || 180).trim();
}
function cleanDesc(s) { return clean(s, 420); }   // „за какво е" — по-дълго, същинска информация
function titleCase(s) { return String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

async function main() {
  // Само човешки предписващи + OTC лекарства (по-чисти от хомеопатията).
  const TYPES = ['HUMAN PRESCRIPTION DRUG', 'HUMAN OTC DRUG'];
  const seen = new Map();     // generic(lower) → запис
  let scanned = 0;
  for (const type of TYPES) {
    let skip = 0;
    while (seen.size < TARGET && skip < 25000) {
      const url = `https://api.fda.gov/drug/label.json?search=openfda.product_type:%22${encodeURIComponent(type)}%22&limit=100&skip=${skip}`;
      const j = await getJson(url); await sleep(120);
      if (!j || !j.results || !j.results.length) break;
      for (const x of j.results) {
        scanned++;
        const o = x.openfda || {};
        const generic = (o.generic_name || [])[0];
        const substance = (o.substance_name || o.active_ingredient || []);
        if (!generic) continue;
        const key = generic.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!key || seen.has(key)) continue;
        // прескочи хомеопатия/шум
        const blob = ((x.purpose || []).join(' ') + ' ' + (x.description || []).join(' ')).toLowerCase();
        if (/homeopath|globules|potency|dilution/.test(blob)) continue;
        const desc = cleanDesc((x.purpose || x.indications_and_usage || [])[0]);
        if (!desc) continue;
        const brands = (o.brand_name || []).slice(0, 3).map((b) => b.toLowerCase());
        const names = [...new Set([key, ...brands, ...substance.map((s) => s.toLowerCase())])];
        const active = [...new Set(substance.map((s) => s.toLowerCase().replace(/\s+/g, ' ').trim()))].slice(0, 6);
        // ПОВЕЧЕ ДАННИ на лекарство: предупреждения, дозировка/начин на прием, за какво помага.
        const warnings = clean((x.warnings || x.warnings_and_cautions || [])[0], 500);
        const dosage = clean((x.dosage_and_administration || [])[0], 300);
        const usage = clean((x.indications_and_usage || [])[0], 300);
        seen.set(key, { names, title: titleCase(generic), active, description: desc, usage, dosage, warnings });
      }
      skip += 100;
      if (seen.size % 500 < 100) console.log(`[meds] ${type}: уникални ${seen.size}/${TARGET} (сканирани ${scanned})`);
    }
    if (seen.size >= TARGET) break;
  }
  const items = [...seen.values()];
  const out = JSON.stringify({ count: items.length, source: 'openFDA drug labels', updated: '2026-07-25', items });
  for (const o of OUTS) { fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, out); }
  const mb = (out.length / 1e6).toFixed(2);
  console.log(`[meds] ГОТОВО — ${items.length} лекарства · ${mb} MB · записан в rustore + huawei`);
}
main().catch((e) => { console.error('[meds] FATAL', e.message); process.exit(1); });
