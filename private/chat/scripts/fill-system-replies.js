#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// FILL DATA · Чат авто-отговори — системните потребители отговарят на реални хора.
// За всеки системен потребител (is_system=1) намира НЕОТГОВОРЕНИ съобщения от
// реални хора и отговаря според намерението (поздрав / как си / работа / комплимент).
//
// Пуска се от старт менюто (опция 61) или ръчно на сървъра:
//   node private/chat/scripts/fill-system-replies.js [макс_отговори]   (по подразбиране 500)
//
// Интроспектира колоните на messages (from_user_id/to_user_id ИЛИ from_phone/to_phone),
// за да е устойчив на разминаване между схема и рутове.
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'configs', '.env') });
const { initializeDatabase } = require('../utils/database');
const { pickReply } = require('./autoreply-banks');

const MAX = Math.max(1, Math.min(20000, parseInt(process.argv[2], 10) || 500));

(async () => {
  console.log('FILL DATA · чат авто-отговори — стартирам…');
  const db = await initializeDatabase();

  // ── Открий кои колони ползва messages ──
  let FROM, TO, UKEY;
  try {
    const cols = await db.prepare(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'"
    ).all();
    const cset = new Set(cols.map(c => c.column_name || c.COLUMN_NAME));
    if (cset.has('from_user_id') && cset.has('to_user_id')) { FROM = 'from_user_id'; TO = 'to_user_id'; UKEY = 'id'; }
    else if (cset.has('from_phone') && cset.has('to_phone')) { FROM = 'from_phone'; TO = 'to_phone'; UKEY = 'phone'; }
    else { console.error('✗ messages няма нито *_user_id, нито *_phone колони — спирам.'); process.exit(1); }
  } catch (e) {
    // Не-PG (SQLite) — приемаме user_id (схемата така е дефинирана)
    FROM = 'from_user_id'; TO = 'to_user_id'; UKEY = 'id';
  }
  console.log(`  колони на messages: ${FROM} / ${TO} (ключ users.${UKEY})`);

  const sys = await db.prepare(
    'SELECT id, phone, country_code FROM users WHERE COALESCE(is_system,0) = 1'
  ).all();
  if (!sys.length) { console.log('  Няма системни потребители (пусни опция 60 първо).'); process.exit(0); }
  console.log(`  системни потребители: ${sys.length}`);

  const findUnanswered = db.prepare(
    `SELECT DISTINCT ON (m.${FROM}) m.${FROM} AS sender, m.text, m.created_at
       FROM messages m
       JOIN users u ON u.${UKEY} = m.${FROM}
      WHERE m.${TO} = ?
        AND COALESCE(u.is_system,0) = 0
        AND m.text IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM messages r
           WHERE r.${FROM} = ? AND r.${TO} = m.${FROM} AND r.created_at >= m.created_at
        )
      ORDER BY m.${FROM}, m.created_at DESC`
  );
  const insertReply = db.prepare(`INSERT INTO messages (${FROM}, ${TO}, text) VALUES (?, ?, ?)`);

  let replied = 0;
  const byIntent = {};
  outer:
  for (const s of sys) {
    const skey = (UKEY === 'id') ? s.id : s.phone;
    let rows;
    try { rows = await findUnanswered.all(skey, skey); } catch (e) { console.error('  ! заявка:', e.message); continue; }
    for (const r of rows) {
      if (replied >= MAX) break outer;
      const rep = pickReply(r.text, s.country_code);
      try {
        await insertReply.run(skey, r.sender, rep.text);
        replied++;
        byIntent[rep.intent] = (byIntent[rep.intent] || 0) + 1;
      } catch (e) { if (replied < 3) console.error('  ! вмъкване:', e.message); }
    }
  }
  console.log(`✅ Отговорени ${replied} съобщения. По намерение:`, JSON.stringify(byIntent));
  if (db.close) await db.close();
  process.exit(0);
})().catch(e => { console.error('FILL DATA авто-отговори fatal:', e.message); process.exit(1); });
