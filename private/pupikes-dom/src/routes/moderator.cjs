/* Модератор: вижда само СВОИТЕ обекти (собственици, които е регистрирал), получава 3% от
 * техните проверени МЕСЕЧНИ плащания, може да регистрира нови собственици и да назначава майстори
 * (веднъж, виж signals assign). НЕ одобрява договори/плащания (това прави само центърът). */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { auth, requireRole, hash } = require('../auth.cjs');
const { effective } = require('../fees.cjs');
const r = express.Router();
const nowISO = () => new Date().toISOString();
const curPeriod = () => new Date().toISOString().slice(0, 7);
const RATE = 0.03;
const round2 = n => Math.round(n * 100) / 100;

r.use(auth, requireRole('moderator'));

/* моите собственици (+ техен статус и мой дял) */
r.get('/clients', async (req, res) => {
  const rows = (await db.query("SELECT id,email,username,name,phone,approved FROM users WHERE role='owner' AND moderator_id=$1 ORDER BY id", [req.user.id])).rows;
  for (const o of rows) {
    o.properties = Number((await db.one('SELECT COUNT(*) c FROM properties WHERE owner_id=$1', [o.id])).c);
    o.paid_month = !!(await db.one("SELECT 1 x FROM payments WHERE owner_id=$1 AND kind='monthly' AND verified=1 AND period=$2 LIMIT 1", [o.id, curPeriod()]));
    const pays = (await db.query("SELECT amount FROM payments WHERE owner_id=$1 AND kind='monthly' AND verified=1", [o.id])).rows;
    o.my_share = round2(pays.reduce((a, p) => a + (parseFloat(p.amount) || 0) * RATE, 0));
  }
  res.json({ clients: rows });
});

/* регистрация на нов собственик (обект) под мен */
r.post('/clients', async (req, res) => {
  const { email, password, username, phone } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Имейл и парола са задължителни.' });
  if (await db.one('SELECT id FROM users WHERE email=$1', [String(email).toLowerCase()])) return res.status(409).json({ error: 'Имейлът е зает.' });
  const u = await db.one(
    `INSERT INTO users(role,email,username,phone,password_hash,approved,flagged,moderator_id,created_at)
     VALUES('owner',$1,$2,$3,$4,0,0,$5,$6) RETURNING id`,
    [String(email).toLowerCase(), username || null, phone || null, hash(password), req.user.id, nowISO()]);
  res.json({ ok: true, id: u.id });
});

/* 3% приходи от моите обекти */
r.get('/earnings', async (req, res) => {
  const rows = (await db.query(
    `SELECT p.amount, p.period FROM payments p JOIN users u ON u.id=p.owner_id
     WHERE u.moderator_id=$1 AND p.kind='monthly' AND p.verified=1`, [req.user.id])).rows;
  let total = 0, month = 0; const cur = curPeriod();
  for (const p of rows) { const a = parseFloat(p.amount); if (Number.isFinite(a)) { total += a * RATE; if (p.period === cur) month += a * RATE; } }
  res.json({ rate: RATE, total: round2(total), month: round2(month), count: rows.length });
});

/* майстори за назначаване (немаркирани) — с ранг и ефективна такса */
r.get('/techs', async (_req, res) => {
  const rows = (await db.query("SELECT id,name,email,flagged,approved FROM users WHERE role='tech' AND flagged=0 ORDER BY id")).rows;
  for (const t of rows) { const p = await db.one('SELECT trade,visit_fee,rank FROM tech_profiles WHERE user_id=$1', [t.id]) || {}; t.trade = p.trade; t.rank = p.rank || 1; t.effective_fee = effective(p.visit_fee, p.rank); t.custom_fee = !!(p.visit_fee > 0); }
  res.json({ techs: rows });
});

module.exports = r;
