/* Профил на майстора: умения, основна локация, до 3 работни адреса. */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { auth, requireRole } = require('../auth.cjs');
const { TRADES } = require('../trades.cjs');
const { effective } = require('../fees.cjs');
const r = express.Router();
const T = [auth, requireRole('tech')];   // guard per-route (не r.use — за да не блокира чужди /api заявки)

r.get('/profile', T, async (req, res) => {
  const prof = await db.one('SELECT * FROM tech_profiles WHERE user_id=$1', [req.user.id]) || { user_id: req.user.id };
  const addresses = (await db.query('SELECT * FROM tech_addresses WHERE user_id=$1 ORDER BY id', [req.user.id])).rows;
  res.json({ profile: prof, addresses });
});

r.put('/profile', T, async (req, res) => {
  const { main_address, main_lat, main_lng, skills, trade } = req.body || {};
  const tr = TRADES.includes(trade) ? trade : null;
  const ex = await db.one('SELECT user_id FROM tech_profiles WHERE user_id=$1', [req.user.id]);
  if (ex) await db.query('UPDATE tech_profiles SET main_address=$1,main_lat=$2,main_lng=$3,skills=$4,trade=COALESCE($5,trade) WHERE user_id=$6',
    [main_address || null, num(main_lat), num(main_lng), skills || null, tr, req.user.id]);
  else await db.query('INSERT INTO tech_profiles(user_id,main_address,main_lat,main_lng,skills,trade) VALUES($1,$2,$3,$4,$5,$6)',
    [req.user.id, main_address || null, num(main_lat), num(main_lng), skills || null, tr || TRADES[0]]);
  res.json({ ok: true });
});

r.post('/addresses', T, async (req, res) => {
  const cnt = (await db.one('SELECT COUNT(*) c FROM tech_addresses WHERE user_id=$1', [req.user.id])).c;
  if (Number(cnt) >= 3) return res.status(400).json({ error: 'Максимум 3 работни адреса.' });
  const { label, address, lat, lng } = req.body || {};
  const a = await db.one('INSERT INTO tech_addresses(user_id,label,address,lat,lng) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [req.user.id, label || null, address || null, num(lat), num(lng)]);
  res.json({ address: a });
});

r.delete('/addresses/:id', T, async (req, res) => {
  await db.query('DELETE FROM tech_addresses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

/* мои приходи (само изчислителни): такса на ГРУПАТА × посетени (приключени) обекти */
r.get('/my-earnings', T, async (req, res) => {
  const prof = await db.one('SELECT trade,visit_fee,rank FROM tech_profiles WHERE user_id=$1', [req.user.id]);
  const fee = effective(prof && prof.visit_fee, prof && prof.rank);
  const rows = (await db.query("SELECT resolved_at FROM signals WHERE accepted_by=$1 AND status='resolved'", [req.user.id])).rows;
  const cur = new Date().toISOString().slice(0, 7);
  const visits = rows.length;
  const month = rows.filter(x => String(x.resolved_at || '').slice(0, 7) === cur).length;
  res.json({ group: prof && prof.trade, rank: prof && prof.rank, visit_fee: fee, visits, total: visits * fee, month, month_total: month * fee });
});

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
module.exports = r;
