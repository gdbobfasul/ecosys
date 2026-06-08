#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FILL DATA · WhereNoBiz — пълнител с ЛИПСВАЩИ бизнеси по държави.
// Създава системни постове „такъв бизнес липсва тук" в различни държави.
// Описанието е на езика на държавата. Маркер is_system = TRUE. Системният собственик
// НЯМА телефон → не може да се „договори" (телефонът не се разкрива).
//
// Google търсене: НЕ ПОВЕЧЕ от 1 заявка на ден (за обогатяване на идеите).
// Пуска се от старт менюто (опция 63) или ръчно на сървъра:
//   node private/WhereNoBiz/scripts/wnb-filler.js [брой_постове]   (по подразбиране 20)
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'configs', '.env') });
const db = require('../db');
const debug = require('../../shared/debug-helper').create('wnb');
const filllog = require('../../shared/debug-helper').create('filldata');

const DAILY_SEARCH_CAP = 1;
const GKEY = process.env.WNB_GOOGLE_API_KEY || process.env.HLB_GOOGLE_API_KEY;
const GCX = process.env.WNB_GOOGLE_CX || process.env.HLB_GOOGLE_CX;

// Курирани идеи за нишови/липсващи бизнеси (международни имена).
const GAP_IDEAS = [
  '24/7 vegan bakery', 'Drone repair shop', 'Specialty coffee roastery', 'Board game café',
  'Bicycle repair café', 'Zero-waste grocery', 'Vinyl record shop', 'Electronics repair café',
  'Indoor climbing gym', 'Cat café', 'Mobile car wash', 'Tool library', 'Makers co-working space',
  'Vintage clothing exchange', 'Specialty tea house', '3D printing service', 'Pet grooming salon',
  'Escape room', 'Artisan cheese shop', 'Cosmetics refill station', 'Late-night pharmacy',
  'Sensory-friendly play center', 'E-bike rental', 'Plant nursery & café', 'Handmade soap workshop',
  'Community tool-sharing hub', 'Left-handed goods store', 'Repair café for appliances',
  'Local farmers market hall', 'Subscription book box', 'Bubble tea shop', 'Co-working for parents',
];

// Език по код на държава (за описанието); останалите → en.
const CC_LANG = { BG: 'bg', RU: 'ru', UA: 'uk', KG: 'ky', DE: 'de', FR: 'fr', IT: 'it', ES: 'es', MX: 'es', US: 'en', GB: 'en', IN: 'hi', JP: 'ja', CN: 'zh', BR: 'pt', SA: 'ar' };
const DESC = {
  bg: 'Такъв бизнес липсва тук — би бил много полезен за района.',
  en: 'Such a business is missing here — it would be very useful for the area.',
  ru: 'Такого бизнеса здесь нет — он был бы очень полезен для района.',
  uk: 'Такого бізнесу тут немає — він був би дуже корисний для району.',
  ky: 'Мындай бизнес бул жерде жок — аймак үчүн абдан пайдалуу болмок.',
  de: 'So ein Geschäft fehlt hier — es wäre sehr nützlich für die Gegend.',
  fr: "Ce type d'entreprise manque ici — il serait très utile pour le quartier.",
  it: "Manca un'attività del genere qui — sarebbe molto utile per la zona.",
  es: 'Aquí falta un negocio así — sería muy útil para la zona.',
  pt: 'Falta um negócio assim aqui — seria muito útil para a região.',
  hi: 'यहाँ ऐसा व्यवसाय नहीं है — यह इलाके के लिए बहुत उपयोगी होगा।',
  ja: 'このような店がここにはありません — 地域にとても役立つはずです。',
  zh: '这里缺少这样的生意 — 对本地会很有用。',
  ar: 'مثل هذا العمل غير موجود هنا — سيكون مفيدًا جدًا للمنطقة.',
};

const N = Math.max(1, Math.min(2000, parseInt(process.argv[2], 10) || 20));
const pick = a => a[Math.floor(Math.random() * a.length)];
const todayUTC = () => new Date().toISOString().slice(0, 10);

(async () => {
  debug.info('script wnb-filler.js старт');
  filllog.info('wnb-filler.js старт');
  console.log('FILL DATA · WNB пълнител — старт…');
  // идемпотентно: колона + брояч
  await db.q('ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE');
  await db.q('CREATE TABLE IF NOT EXISTS wnb_filler_usage (day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)');

  const owner = await db.one(
    `INSERT INTO users (email, password_hash, display_name, lang)
     VALUES ('system@wherenobiz.local', 'x', 'System', 'en')
     ON CONFLICT (email) DO UPDATE SET display_name = 'System'
     RETURNING id`);

  const codes = (await db.all('SELECT code FROM countries')).map(r => r.code);
  if (!codes.length) { console.error('✗ Няма държави в countries — пусни setup на WNB базата първо.'); process.exit(1); }

  // Обогатяване с Google ≤1/ден (по желание)
  const ideas = GAP_IDEAS.slice();
  if (GKEY && GCX) {
    const today = todayUTC();
    const u = await db.one('SELECT count FROM wnb_filler_usage WHERE day = $1', [today]);
    if ((u ? u.count : 0) < DAILY_SEARCH_CAP) {
      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${GKEY}&cx=${GCX}&q=${encodeURIComponent('unusual small business ideas that are missing in cities')}&num=10`;
        const r = await fetch(url);
        if (r.ok) { const d = await r.json(); let n = 0; for (const it of (d.items || [])) { const t = String(it.title || '').replace(/\s+/g, ' ').trim(); if (t && t.length <= 60) { ideas.push(t); n++; } } console.log(`  Google: +${n} идеи`); }
        await db.q(`INSERT INTO wnb_filler_usage(day, count) VALUES($1, 1) ON CONFLICT(day) DO UPDATE SET count = wnb_filler_usage.count + 1`, [today]);
      } catch (e) { console.error('  ! Google:', e.message); }
    } else { console.log('  Google търсене вече е ползвано днес (таван 1/ден) — само курирани идеи.'); }
  }

  let ins = 0, dup = 0;
  for (let i = 0; i < N; i++) {
    const cc = pick(codes), title = pick(ideas).slice(0, 120);
    const description = DESC[CC_LANG[cc] || 'en'] || DESC.en;
    const exists = await db.one('SELECT id FROM posts WHERE country_code = $1 AND title = $2 AND is_system = TRUE LIMIT 1', [cc, title]);
    if (exists) { dup++; continue; }
    await db.q(
      `INSERT INTO posts (owner_id, country_code, title, description, status, approved_at, is_system)
       VALUES ($1, $2, $3, $4, 'approved', now(), TRUE)`, [owner.id, cc, title, description]);
    ins++;
  }
  console.log(`✅ Готово. Добавени ${ins} липсващи бизнеса (дубликати прескочени: ${dup}).`);
  filllog.info('wnb-filler.js край', ins);
  await db.pool.end();
  process.exit(0);
})().catch(e => { debug.error('script wnb-filler.js:', e && e.message); filllog.error('wnb-filler.js:', e && e.message); console.error('WNB пълнител fatal:', e.message); process.exit(1); });
