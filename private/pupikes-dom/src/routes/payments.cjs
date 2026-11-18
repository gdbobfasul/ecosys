/* Плащания: собственикът качва доказателство (снимка/PDF) по избран QR код, вид „месечно"
 * или „допълнително". ТРИЕНЕ Е НЕВЪЗМОЖНО. Центърът отбелязва „проверено" и може да смени
 * QR метода само ДОКАТО не е проверено; след проверка се ЗАКЛЮЧВА и не се редактира повече. */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { auth, requireRole } = require('../auth.cjs');
const { upload } = require('../upload.cjs');
const rt = require('../realtime.cjs');
const r = express.Router();
const nowISO = () => new Date().toISOString();

r.use(auth);

async function view(p) {
  const o = await db.one('SELECT name,username,email FROM users WHERE id=$1', [p.owner_id]);
  return Object.assign({}, p, { owner_name: o && (o.name || o.username || o.email) });
}

/* собственик създава плащане (качва доказателство) */
r.post('/payments', requireRole('owner'), upload.single('proof'), async (req, res) => {
  const { kind, qr_slot, amount, note, period } = req.body || {};
  if (!['monthly', 'extra'].includes(kind)) return res.status(400).json({ error: 'Изберете вид: месечно или допълнително.' });
  const per = kind === 'monthly' ? (/^\d{4}-\d{2}$/.test(period || '') ? period : new Date().toISOString().slice(0, 7)) : null;
  const p = await db.one(
    `INSERT INTO payments(owner_id,kind,qr_slot,period,proof_path,proof_type,amount,note,created_at,verified,locked)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0) RETURNING *`,
    [req.user.id, kind, qr_slot ? Number(qr_slot) : null, per,
     req.file ? req.file.filename : null, req.file ? req.file.mimetype : null,
     amount || null, note || null, nowISO()]);
  rt.toRole('center', { type: 'new-payment', payment: await view(p) });
  res.json({ payment: p });
});

/* списъци */
r.get('/payments', async (req, res) => {
  let rows;
  if (req.user.role === 'owner') rows = (await db.query('SELECT * FROM payments WHERE owner_id=$1 ORDER BY id DESC', [req.user.id])).rows;
  else { const k = req.query.kind; rows = (await db.query(k ? 'SELECT * FROM payments WHERE kind=$1 ORDER BY id DESC' : 'SELECT * FROM payments ORDER BY id DESC', k ? [k] : [])).rows; }
  res.json({ payments: await Promise.all(rows.map(view)) });
});

/* център: смяна на QR метода — само докато НЕ е проверено/заключено */
r.put('/payments/:id/method', requireRole('center'), async (req, res) => {
  const p = await db.one('SELECT * FROM payments WHERE id=$1', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Няма такова плащане.' });
  if (p.locked || p.verified) return res.status(423).json({ error: 'Плащането е проверено и заключено — не се редактира.' });
  await db.query('UPDATE payments SET qr_slot=$1 WHERE id=$2', [Number(req.body.qr_slot) || null, p.id]);
  rt.toRole('center', { type: 'payment-updated', id: p.id });
  res.json({ ok: true });
});

/* център: отбелязва „проверено" (по избор сменя QR метода) → ЗАКЛЮЧВА */
r.post('/payments/:id/verify', requireRole('center'), async (req, res) => {
  const p = await db.one('SELECT * FROM payments WHERE id=$1', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Няма такова плащане.' });
  if (p.locked) return res.status(423).json({ error: 'Вече е заключено.' });
  const slot = (req.body && req.body.qr_slot != null) ? Number(req.body.qr_slot) : p.qr_slot;
  await db.query('UPDATE payments SET verified=1,verified_at=$1,verified_by=$2,qr_slot=$3,locked=1 WHERE id=$4',
    [nowISO(), req.user.id, slot || null, p.id]);
  rt.toRole('center', { type: 'payment-verified', id: p.id });
  rt.toUser(p.owner_id, { type: 'payment-verified', id: p.id });
  res.json({ ok: true });
});

/* ТРИЕНЕ НЯМА — умишлено липсва DELETE маршрут. */
module.exports = r;
