#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FILL DATA · House-Look-Book — генератор на СИСТЕМНИ модели „странни къщи".
// Създава proposals с composer_params (форма/покрив/етажи/стаи/цветове) — нативният
// формат на модел, който се РЕНДЕРИРА от house-render.js БЕЗ картинки (затова е
// надеждно: няма счупени линкове/сваляне на файлове). Маркер is_system = TRUE.
//
// Пуска се от старт менюто (опция 64) или ръчно на сървъра:
//   node private/House-Look-Book/scripts/hlb-filler.js [брой_модели]   (по подразбиране 20)
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'configs', '.env') });
const db = require('../db');

// Имена (BG) за заглавията — съвпадат с house-render.js.
const FOOTPRINTS = { square: 'Квадратна', rect: 'Правоъгълна', lshape: 'L-образна', dome: 'С купол', snail: 'Като охлюв', waterlily: 'Водна лилия', cabin: 'Дървена колиба', inverted: 'Обърната' };
const ROOFS = { gabled: 'Двускатен', flat: 'Плосък', dome: 'Купол', inverted: 'Обърнат', none: 'Без покрив' };
// Странните форми/покриви се падат по-често.
const FP_POOL = ['snail', 'waterlily', 'inverted', 'dome', 'cabin', 'lshape', 'snail', 'waterlily', 'inverted', 'square', 'rect'];
const ROOF_POOL = ['inverted', 'dome', 'gabled', 'flat', 'none', 'inverted', 'dome'];
const ROOM_TYPES = ['living', 'bedroom', 'kitchen', 'bathroom', 'toilet', 'dining', 'kids', 'office', 'hall', 'balcony'];
const BASEMENT_TYPES = ['garage', 'pantry1', 'pantry2', 'technical', 'materials', 'tools', 'foodstore', 'pumproom', 'heating', 'heatpump'];
const SHAPES = ['rect', 'rounded', 'circle', 'oval', 'crescent', 'diamond', 'triangle', 'hex', 'trapezoid'];
const WALLC = ['#e8d9c0', '#dfe7ef', '#efe2d2', '#e6e0ef', '#dce9e2', '#f0e6d6', '#e9e9ef'];
const ROOFC = ['#8a4b3b', '#3b5a6e', '#5a6e3b', '#6e3b5a', '#444', '#7a5a2e', '#2e5a7a'];
const ACCENTC = ['#3b6ea5', '#a53b6e', '#6ea53b', '#a5803b', '#3ba59a', '#8a3ba5'];

const N = Math.max(1, Math.min(2000, parseInt(process.argv[2], 10) || 20));
const pick = a => a[Math.floor(Math.random() * a.length)];
const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

function genParams() {
  const footprint = pick(FP_POOL);
  const roof = pick(ROOF_POOL);
  const floors = ri(1, 3);
  const basements = ri(0, 2);
  const rooms = [];
  for (let b = 0; b < basements; b++) {            // мазета (индекси 0..basements-1)
    const k = ri(1, 3), fl = [];
    for (let i = 0; i < k; i++) fl.push({ type: pick(BASEMENT_TYPES), shape: pick(SHAPES) });
    rooms.push(fl);
  }
  for (let f = 0; f < floors; f++) {               // надземни етажи
    const k = ri(1, 4), fl = [];
    for (let i = 0; i < k; i++) fl.push({ type: pick(ROOM_TYPES), shape: pick(SHAPES) });
    rooms.push(fl);
  }
  return {
    footprint, roof, floors, basements, rooms,
    wallColor: pick(WALLC), roofColor: pick(ROOFC), accentColor: pick(ACCENTC),
    windowsPerFloor: ri(1, 3),
    extras: { pool: Math.random() < 0.25, boat: Math.random() < 0.15, pier: Math.random() < 0.15 },
    limits: { minFloors: 1, maxFloors: 3 },
    roofOff: false,
  };
}

(async () => {
  console.log(`FILL DATA · HLB генератор — създавам ${N} системни модела…`);
  await db.q('ALTER TABLE proposals ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE');

  const owner = await db.one(
    `INSERT INTO users (email, password_hash, display_name, lang)
     VALUES ('system@houselookbook.local', 'x', 'System Studio', 'bg')
     ON CONFLICT (email) DO UPDATE SET display_name = 'System Studio'
     RETURNING id`);

  let ok = 0, fail = 0;
  for (let i = 0; i < N; i++) {
    const p = genParams();
    const title = `Къща «${FOOTPRINTS[p.footprint] || p.footprint}» · ${ROOFS[p.roof] || p.roof} покрив · ${p.floors} ет.${p.basements ? ', ' + p.basements + ' мазе' : ''}`;
    const description = 'Генериран примерен модел — експериментална форма. Разгледай и сглоби своя по-добър в конструктора.';
    try {
      await db.q(
        `INSERT INTO proposals (owner_id, title, description, composer_params, status, approved_at, edit_window_until, is_system)
         VALUES ($1, $2, $3, $4, 'approved', now(), now(), TRUE)`,
        [owner.id, title.slice(0, 200), description, p]);
      ok++;
    } catch (e) { fail++; if (fail <= 3) console.error('  ! insert:', e.message); }
  }
  let total = '?';
  try { const r = await db.one('SELECT COUNT(*) AS n FROM proposals WHERE is_system = TRUE'); total = r && r.n; } catch (e) {}
  console.log(`✅ Готово. Добавени ${ok} модела (грешки: ${fail}). Общо системни модели: ${total}.`);
  await db.pool.end();
  process.exit(0);
})().catch(e => { console.error('HLB генератор fatal:', e.message); process.exit(1); });
