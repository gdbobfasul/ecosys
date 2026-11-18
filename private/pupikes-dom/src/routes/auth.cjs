/* Регистрация, вход, профил, push устройства. Роли: owner (собственик), tech (майстор),
 * center (център). Центърът се създава със seed при първо пускане. */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { hash, verify, sign, auth } = require('../auth.cjs');
const { TRADES } = require('../trades.cjs');
const { feeForRank } = require('../fees.cjs');
const r = express.Router();
const nowISO = () => new Date().toISOString();

r.post('/register', async (req, res) => {
  const { role, email, password, username, name, phone, trade, rank } = req.body || {};
  if (!['owner', 'tech'].includes(role)) return res.status(400).json({ error: 'Невалидна роля.' });
  if (!email || !password) return res.status(400).json({ error: 'Имейл и парола са задължителни.' });
  const exists = await db.one('SELECT id FROM users WHERE email=$1', [String(email).toLowerCase()]);
  if (exists) return res.status(409).json({ error: 'Този имейл вече е регистриран.' });
  // акаунтът е активен веднага (approved=0 = договорът още не е одобрен от центъра)
  const u = await db.one(
    `INSERT INTO users(role,email,username,name,phone,password_hash,approved,flagged,created_at)
     VALUES($1,$2,$3,$4,$5,$6,0,0,$7) RETURNING id,role,email,username,name`,
    [role, String(email).toLowerCase(), username || null, name || null, phone || null, hash(password), nowISO()]);
  if (role === 'tech') {
    const rk = Math.min(5, Math.max(1, parseInt(rank) || 1));
    // таксата НЕ се записва тук — определя се по ранга (effective fallback); center може да я коригира
    await db.query('INSERT INTO tech_profiles(user_id,trade,rank) VALUES($1,$2,$3)',
      [u.id, TRADES.includes(trade) ? trade : TRADES[0], rk]);
  }
  res.json({ token: sign(u), user: u });
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const u = await db.one('SELECT * FROM users WHERE email=$1', [String(email || '').toLowerCase()]);
  if (!u || !verify(password, u.password_hash)) return res.status(401).json({ error: 'Грешен имейл или парола.' });
  res.json({ token: sign(u), user: { id: u.id, role: u.role, email: u.email, username: u.username, name: u.name } });
});

r.get('/me', auth, async (req, res) => {
  const u = await db.one('SELECT id,role,email,username,name,phone,approved,flagged FROM users WHERE id=$1', [req.user.id]);
  if (u && u.role === 'tech') u.trade = (await db.one('SELECT trade FROM tech_profiles WHERE user_id=$1', [u.id]) || {}).trade || 'both';
  res.json({ user: u });
});

/* регистрация на push устройство (телефон) */
r.post('/device', auth, async (req, res) => {
  const { token, platform } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Липсва token.' });
  await db.query('INSERT INTO devices(user_id,push_token,platform,created_at) VALUES($1,$2,$3,$4)',
    [req.user.id, token, platform || null, nowISO()]);
  res.json({ ok: true });
});

module.exports = r;
