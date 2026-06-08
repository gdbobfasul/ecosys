#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FILL DATA · Find Best Price — СКРАПЕР (само текст, без картинки).
// Прави НЕ ПОВЕЧЕ от 3 Google заявки на ден (Custom Search API), търси продукти в
// онлайн магазини по различни държави и пълни базата с магазини + продукти + цени.
// Всичко се маркира is_system = TRUE. Картинки НЕ се качват/свалят.
//
// Пуска се от старт менюто (опция 62) или ръчно на сървъра:
//   node private/find-best-price/scripts/fbp-scraper.js [макс_заявки_този_път]
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'configs', '.env') });
const db = require('../db');

const DAILY_CAP = 3; // ТВЪРД таван Google заявки на ден
const GKEY = process.env.FBP_GOOGLE_API_KEY || process.env.HLB_GOOGLE_API_KEY;
const GCX = process.env.FBP_GOOGLE_CX || process.env.HLB_GOOGLE_CX;

const CATS = [
  { category: 'autoparts', terms: ['brake pads', 'oil filter', 'car battery', 'spark plugs', 'wiper blades'] },
  { category: 'clothes', terms: ['winter jacket', 'running shoes', 'jeans', 'leather belt', 'wool sweater'] },
  { category: 'bicycles', terms: ['mountain bike', 'bike helmet', 'bicycle tire', 'bike lock'] },
  { category: 'toys', terms: ['lego set', 'remote control car', 'board game', 'wooden puzzle'] },
  { category: 'building', terms: ['cordless drill', 'ceramic tiles', 'paint roller', 'tool set'] },
  { category: 'food', terms: ['olive oil', 'coffee beans', 'honey jar', 'green tea'] },
  { category: 'furniture', terms: ['office chair', 'wooden desk', 'bookshelf', 'bed frame'] },
  { category: 'computers', terms: ['laptop', 'mechanical keyboard', 'wireless mouse', 'usb hub'] },
  { category: 'drones', terms: ['camera drone', 'mini drone', 'drone battery'] },
  { category: 'machinery', terms: ['water pump', 'air compressor', 'welding machine'] },
];
const COUNTRIES = [
  { country: 'USA', gl: 'us', cur: 'USD' }, { country: 'United Kingdom', gl: 'gb', cur: 'GBP' },
  { country: 'Germany', gl: 'de', cur: 'EUR' }, { country: 'France', gl: 'fr', cur: 'EUR' },
  { country: 'Italy', gl: 'it', cur: 'EUR' }, { country: 'Spain', gl: 'es', cur: 'EUR' },
  { country: 'India', gl: 'in', cur: 'INR' }, { country: 'Brazil', gl: 'br', cur: 'BRL' },
  { country: 'Bulgaria', gl: 'bg', cur: 'BGN' }, { country: 'Poland', gl: 'pl', cur: 'PLN' },
];

const pick = a => a[Math.floor(Math.random() * a.length)];
const todayUTC = () => new Date().toISOString().slice(0, 10);

function cleanNum(s) {
  s = String(s).trim();
  if (/,\d{2}$/.test(s) && !/\.\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 (EU)
  else s = s.replace(/,/g, '');                                                              // 1,234.56 (US)
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return (isFinite(n) && n > 0) ? Math.round(n * 100) / 100 : null;
}
function extractPrice(text) {
  const t = String(text || '');
  const map = { '$': 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', 'R$': 'BRL', 'лв': 'BGN' };
  let m = t.match(/(US\$|R\$|\$|€|£|₹|лв)\s?(\d[\d.,]{0,12}\d|\d)/);
  if (m) { const n = cleanNum(m[2]); if (n) return { price: n, currency: map[m[1]] || null }; }
  m = t.match(/(\d[\d.,]{0,12}\d|\d)\s?(USD|EUR|GBP|INR|BRL|BGN|PLN|RUB)\b/i);
  if (m) { const n = cleanNum(m[1]); if (n) return { price: n, currency: m[2].toUpperCase() }; }
  m = t.match(/\b(USD|EUR|GBP|INR|BRL|BGN|PLN|RUB)\s?(\d[\d.,]{0,12}\d|\d)/i);
  if (m) { const n = cleanNum(m[2]); if (n) return { price: n, currency: m[1].toUpperCase() }; }
  m = t.match(/(\d[\d.,]{0,12}\d|\d)\s?(лв|zł|руб|₽|kr)/i);
  if (m) { const n = cleanNum(m[1]); const aft = { 'лв': 'BGN', 'zł': 'PLN', 'руб': 'RUB', '₽': 'RUB', 'kr': 'SEK' }; if (n) return { price: n, currency: aft[m[2].toLowerCase()] || null }; }
  return null;
}

async function googleSearch(query, gl) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GKEY}&cx=${GCX}&q=${encodeURIComponent(query)}&num=10&gl=${gl}`;
  const r = await fetch(url);
  if (!r.ok) { const tx = await r.text().catch(() => ''); throw new Error(`Google ${r.status}: ${tx.slice(0, 140)}`); }
  const d = await r.json();
  return d.items || [];
}

(async () => {
  console.log('FILL DATA · FBP скрапер — старт…');
  if (!GKEY || !GCX) { console.error('✗ Липсва Google ключ (FBP_GOOGLE_API_KEY/CX или HLB_*). Спирам.'); process.exit(1); }
  await db.applySchema();

  const owner = await db.one(
    `INSERT INTO users (email, password_hash, display_name, lang)
     VALUES ('system@findbestprice.local', 'x', 'System Importer', 'en')
     ON CONFLICT (email) DO UPDATE SET display_name = 'System Importer'
     RETURNING id`);
  const ownerId = owner.id;

  const today = todayUTC();
  const u = await db.one('SELECT count FROM fbp_scraper_usage WHERE day = $1', [today]);
  const used = u ? u.count : 0;
  const remaining = DAILY_CAP - used;
  if (remaining <= 0) { console.log(`  Дневният таван (${DAILY_CAP} Google заявки) е достигнат. Опитай утре.`); process.exit(0); }
  const want = Math.max(1, Math.min(remaining, parseInt(process.argv[2], 10) || remaining));
  console.log(`  днес използвани ${used}/${DAILY_CAP}; ще направя до ${want} заявки.`);

  let calls = 0, prods = 0, stores = 0;
  for (let i = 0; i < want; i++) {
    const cat = pick(CATS), term = pick(cat.terms), co = pick(COUNTRIES);
    const query = `buy ${term} price online shop ${co.country}`;
    let items;
    try { items = await googleSearch(query, co.gl); calls++; }
    catch (e) { console.error('  ! Google:', e.message); break; }
    await db.q(`INSERT INTO fbp_scraper_usage(day, count) VALUES($1, 1)
                ON CONFLICT(day) DO UPDATE SET count = fbp_scraper_usage.count + 1`, [today]);

    for (const it of items) {
      const store = String(it.displayLink || '').replace(/^www\./, '').trim();
      if (!store) continue;
      const pr = extractPrice(`${it.title || ''} ${it.snippet || ''}`);
      if (!pr || !pr.price) continue;
      const currency = pr.currency || co.cur;
      const name = String(it.title || term).replace(/\s+/g, ' ').trim().slice(0, 180);
      let biz = await db.one('SELECT id FROM businesses WHERE is_system = TRUE AND name = $1 AND country = $2 LIMIT 1', [store, co.country]);
      if (!biz) {
        biz = await db.one(
          `INSERT INTO businesses (owner_id, btype, name, country, location_exact, is_system)
           VALUES ($1, 'online', $2, $3, $4, TRUE) RETURNING id`, [ownerId, store, co.country, store]);
        stores++;
      }
      const dup = await db.one('SELECT id FROM products WHERE business_id = $1 AND name = $2 LIMIT 1', [biz.id, name]);
      if (dup) continue;
      await db.q(`INSERT INTO products (business_id, kind, category, name, price, currency, is_system)
                  VALUES ($1, 'product', $2, $3, $4, $5, TRUE)`, [biz.id, cat.category, name, pr.price, currency]);
      prods++;
    }
  }
  console.log(`✅ Готово. Google заявки: ${calls}. Нови магазини: ${stores}. Нови продукти: ${prods}.`);
  await db.pool.end();
  process.exit(0);
})().catch(e => { console.error('FBP скрапер fatal:', e.message); process.exit(1); });
