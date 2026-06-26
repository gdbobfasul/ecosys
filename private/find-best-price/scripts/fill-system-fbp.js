#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FILL DATA · Find Best Price — ДЕТЕРМИНИСТИЧЕН системен пълнеж (БЕЗ Google, без интернет).
//
// За разлика от fbp-scraper.js (който иска Google ключ и таван 3 заявки/ден), този скрипт
// пълни базата с ГОТОВО демо съдържание: обекти + продукти/услуги/резервни части + няколко
// ZERO PRICE заявки, във всичките 12 продуктови + 10 услугови категории, по много държави и
// техните валути. Така търсенето показва резултати end-to-end веднага, за тестовата екосистема.
//
// Всичко се маркира is_system = TRUE. ИДЕМПОТЕНТЕН (стабилни имена → повторно пускане не дублира).
// Пуска се от старт менюто (опция 62 → „системен пълнеж") или ръчно:
//   node private/find-best-price/scripts/fill-system-fbp.js [брой_на_категория_на_държава=2]
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'configs', '.env') });
const db = require('../db');

// Държави с валута и груб ценови коефициент спрямо USD (само за реалистични числа в демото).
const COUNTRIES = [
  { country: 'USA', city: 'New York', cur: 'USD', f: 1 },
  { country: 'United Kingdom', city: 'London', cur: 'GBP', f: 0.8 },
  { country: 'Germany', city: 'Berlin', cur: 'EUR', f: 0.92 },
  { country: 'France', city: 'Paris', cur: 'EUR', f: 0.92 },
  { country: 'Italy', city: 'Rome', cur: 'EUR', f: 0.92 },
  { country: 'Spain', city: 'Madrid', cur: 'EUR', f: 0.9 },
  { country: 'Bulgaria', city: 'Sofia', cur: 'BGN', f: 1.8 },
  { country: 'Russia', city: 'Moscow', cur: 'RUB', f: 90 },
  { country: 'Kyrgyzstan', city: 'Bishkek', cur: 'KGS', f: 89 },
  { country: 'India', city: 'Delhi', cur: 'INR', f: 83 },
  { country: 'Brazil', city: 'Sao Paulo', cur: 'BRL', f: 5 },
  { country: 'Poland', city: 'Warsaw', cur: 'PLN', f: 4 },
];

// 12 продуктови категории → примерни артикули с базова цена (USD).
const PRODUCTS = {
  food: [['Olive oil 1L', 9], ['Coffee beans 1kg', 18], ['Honey jar 500g', 7], ['Green tea 100g', 5]],
  building: [['Cordless drill', 75], ['Ceramic tiles (m2)', 22], ['Paint roller set', 12], ['Tool set 100pc', 60]],
  autoparts: [['Brake pads set', 40], ['Oil filter', 9], ['Car battery 60Ah', 95], ['Spark plugs x4', 22]],
  toys: [['LEGO city set', 45], ['RC car', 35], ['Board game', 25], ['Wooden puzzle', 15]],
  clothes: [['Winter jacket', 80], ['Running shoes', 70], ['Jeans', 45], ['Wool sweater', 55]],
  bicycles: [['Mountain bike', 420], ['Bike helmet', 35], ['Bicycle tire', 18], ['Bike lock', 22]],
  furniture: [['Office chair', 120], ['Wooden desk', 160], ['Bookshelf', 90], ['Bed frame', 210]],
  computers: [['Laptop 15"', 650], ['Mechanical keyboard', 75], ['Wireless mouse', 25], ['USB-C hub', 30]],
  antiques: [['Vintage clock', 140], ['Brass lamp', 90], ['Old silver coin', 60], ['Porcelain vase', 110]],
  machinery: [['Water pump', 180], ['Air compressor', 230], ['Welding machine', 300], ['Generator 2kW', 350]],
  drones: [['Camera drone', 520], ['Mini drone', 90], ['Drone battery', 45], ['Propeller set', 12]],
  robots: [['Vacuum robot', 280], ['Educational robot kit', 130], ['Robot arm kit', 190], ['Line-follower bot', 60]],
};

// 10 услугови категории → примерни услуги с базова цена (USD).
const SERVICES = {
  dentist: [['Teeth cleaning', 60], ['Cavity filling', 90], ['Tooth extraction', 120]],
  medical: [['GP consultation', 40], ['Blood test panel', 55], ['Physiotherapy session', 45]],
  repair: [['Phone screen repair', 70], ['Laptop diagnostics', 30], ['Appliance repair', 55]],
  legal: [['Contract review', 150], ['Legal consultation', 100], ['Document notarization', 40]],
  manufacturing: [['CNC part (per hour)', 35], ['3D printing (per hour)', 20], ['Mold setup', 400]],
  construction: [['Wall painting (m2)', 8], ['Tiling (m2)', 18], ['Plumbing call-out', 60]],
  beauty: [['Haircut', 25], ['Manicure', 20], ['Facial treatment', 45]],
  education: [['Math tutoring (hour)', 25], ['Language lesson (hour)', 22], ['Coding class (hour)', 35]],
  transport: [['City taxi (10km)', 12], ['Furniture moving (hour)', 40], ['Airport transfer', 35]],
  it: [['Website setup', 300], ['IT support (hour)', 45], ['Data recovery', 120]],
};

// Резервни части (kind=sparepart) с „за кой модел пасва".
const SPAREPARTS = [
  ['autoparts', 'Timing belt (fits VW Golf IV)', 35, 'VW Golf IV'],
  ['computers', 'Laptop battery (fits ThinkPad T440)', 45, 'ThinkPad T440'],
  ['machinery', 'Pump seal kit (fits Grundfos UPS)', 18, 'Grundfos UPS'],
  ['bicycles', 'Rear derailleur (fits Shimano Altus)', 28, 'Shimano Altus'],
];

const BTYPES = ['shop', 'factory', 'online', 'stall', 'reseller'];
const QUALITIES = ['new', 'used', 'refurbished', 'premium', 'standard', 'economy'];

const money = (usd, f) => Math.max(1, Math.round(usd * f * 100) / 100);
const pick = (a, i) => a[((i % a.length) + a.length) % a.length];

(async () => {
  console.log('FILL DATA · FBP системен пълнеж (без Google) — старт…');
  await db.applySchema();

  const owner = await db.one(
    `INSERT INTO users (email, password_hash, display_name, lang)
     VALUES ('system@findbestprice.local', 'x', 'System Filler', 'en')
     ON CONFLICT (email) DO UPDATE SET display_name = 'System Filler'
     RETURNING id`);
  const ownerId = owner.id;

  const per = Math.max(1, parseInt(process.argv[2], 10) || 2);
  let biz = 0, prod = 0, svc = 0, sp = 0, wr = 0, wo = 0;

  async function ensureBiz(name, btype, country, city) {
    let b = await db.one('SELECT id FROM businesses WHERE is_system = TRUE AND name = $1 AND country = $2 LIMIT 1', [name, country]);
    if (!b) {
      b = await db.one(
        `INSERT INTO businesses (owner_id, btype, name, country, city, location_exact, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id`,
        [ownerId, btype, name, country, city, `${city}, ${country}`]);
      biz++;
    }
    return b.id;
  }
  async function addItem(bizId, kind, category, name, price, currency, quality, fits) {
    const dup = await db.one('SELECT id FROM products WHERE business_id = $1 AND name = $2 LIMIT 1', [bizId, name]);
    if (dup) return false;
    await db.q(
      `INSERT INTO products (business_id, kind, category, name, price, currency, quality, fits_product, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
      [bizId, kind, category, name, price, currency, quality || null, fits || null]);
    return true;
  }

  for (const co of COUNTRIES) {
    let idx = 0;
    for (const [cat, items] of Object.entries(PRODUCTS)) {
      for (let n = 0; n < per; n++) {
        const btype = pick(BTYPES, idx + n);
        const name = `${co.city} ${cat} ${btype}`;
        const bizId = await ensureBiz(name, btype, co.country, co.city);
        const it = pick(items, n);
        if (await addItem(bizId, 'product', cat, it[0], money(it[1], co.f), co.cur, pick(QUALITIES, n))) prod++;
      }
      idx++;
    }
    for (const [cat, items] of Object.entries(SERVICES)) {
      const name = `${co.city} ${cat} service`;
      const bizId = await ensureBiz(name, 'shop', co.country, co.city);
      for (let n = 0; n < per; n++) {
        const it = pick(items, n);
        if (await addItem(bizId, 'service', cat, it[0], money(it[1], co.f), co.cur)) svc++;
      }
    }
  }

  // Резервни части — в първите няколко държави.
  for (const co of COUNTRIES.slice(0, 4)) {
    const bizId = await ensureBiz(`${co.city} spare parts reseller`, 'reseller', co.country, co.city);
    for (const [cat, name, price, fits] of SPAREPARTS) {
      if (await addItem(bizId, 'sparepart', cat, name, money(price, co.f), co.cur, 'used', fits)) sp++;
    }
  }

  // ZERO PRICE — няколко заявки „търся това, което го няма" + по една оферта.
  const WANTED = [
    ['Insulin pen needles', 'Cannot find these locally', 'Kyrgyzstan', 'Bishkek', 'Germany'],
    ['Car ECU (fits Opel Astra H)', 'Out of stock everywhere here', 'Bulgaria', 'Sofia', 'Poland'],
    ['Gluten-free flour 5kg', 'Not sold in my town', 'Russia', 'Moscow', 'Italy'],
  ];
  for (const [title, desc, country, city, where] of WANTED) {
    let r = await db.one('SELECT id FROM wanted_requests WHERE is_system = TRUE AND title = $1 AND country = $2 LIMIT 1', [title, country]);
    if (!r) {
      r = await db.one(
        `INSERT INTO wanted_requests (requester_id, title, description, country, city, is_system)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
        [ownerId, title, desc, country, city]);
      wr++;
      await db.q(
        `INSERT INTO wanted_offers (request_id, responder_id, price, currency, where_country, note, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
        [r.id, ownerId, money(15, 1), 'USD', where, `Available in ${where} (shops / online shipping).`]);
      wo++;
    }
  }

  console.log(`✅ FBP системен пълнеж готов. Обекти: ${biz} · продукти: ${prod} · услуги: ${svc} · резервни части: ${sp} · ZERO PRICE заявки: ${wr} · оферти: ${wo}`);
  await db.pool.end();
  process.exit(0);
})().catch((e) => { console.error('FBP fill fatal:', e && e.message); process.exit(1); });
