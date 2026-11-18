/* Заявки за корекция на таксата на специалист: модератор/админ подават; САМО центърът
 * одобрява/отхвърля. Одобрението задава индивидуална такса (override) на специалиста. */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { auth, requireRole } = require('../auth.cjs');
const r = express.Router();
const nowISO = () => new Date().toISOString();

/* създаване (модератор/админ) */
r.post('/fee-requests', auth, requireRole('moderator', 'admin'), async (req, res) => {
  const { tech_id, amount, reason } = req.body || {};
  const t = await db.one("SELECT id FROM users WHERE id=$1 AND role='tech'", [Number(tech_id)]);
  if (!t) return res.status(400).json({ error: 'Няма такъв специалист.' });
  const a = parseFloat(amount);
  if (!Number.isFinite(a) || a < 0) return res.status(400).json({ error: 'Невалидна сума.' });
  await db.query('INSERT INTO fee_requests(tech_id,requested_by,requester_role,amount,reason,status,created_at) VALUES($1,$2,$3,$4,$5,\'pending\',$6)',
    [t.id, req.user.id, req.user.role, a, reason || null, nowISO()]);
  res.json({ ok: true });
});

/* списък (център: всички; заявителят: своите) */
r.get('/fee-requests', auth, requireRole('center', 'moderator', 'admin'), async (req, res) => {
  const rows = req.user.role === 'center'
    ? (await db.query('SELECT * FROM fee_requests ORDER BY id DESC')).rows
    : (await db.query('SELECT * FROM fee_requests WHERE requested_by=$1 ORDER BY id DESC', [req.user.id])).rows;
  for (const q of rows) {
    const t = await db.one('SELECT name,email FROM users WHERE id=$1', [q.tech_id]); q.tech_name = t && (t.name || t.email);
    const u = q.requested_by ? await db.one('SELECT name,email,role FROM users WHERE id=$1', [q.requested_by]) : null;
    q.requester = u && (u.name || u.email); q.requester_role = u && u.role;
  }
  res.json({ requests: rows });
});

/* решение — само център */
r.post('/fee-requests/:id/approve', auth, requireRole('center'), async (req, res) => {
  const q = await db.one('SELECT * FROM fee_requests WHERE id=$1', [req.params.id]);
  if (!q) return res.status(404).json({ error: 'Няма такава заявка.' });
  if (q.status !== 'pending') return res.status(409).json({ error: 'Вече е решена.' });
  const ex = await db.one('SELECT user_id FROM tech_profiles WHERE user_id=$1', [q.tech_id]);
  if (ex) await db.query('UPDATE tech_profiles SET visit_fee=$1 WHERE user_id=$2', [q.amount, q.tech_id]);
  else await db.query('INSERT INTO tech_profiles(user_id,visit_fee) VALUES($1,$2)', [q.tech_id, q.amount]);
  await db.query("UPDATE fee_requests SET status='approved',decided_at=$1,decided_by=$2 WHERE id=$3", [nowISO(), req.user.id, q.id]);
  res.json({ ok: true });
});
r.post('/fee-requests/:id/reject', auth, requireRole('center'), async (req, res) => {
  await db.query("UPDATE fee_requests SET status='rejected',decided_at=$1,decided_by=$2 WHERE id=$3 AND status='pending'", [nowISO(), req.user.id, req.params.id]);
  res.json({ ok: true });
});

module.exports = r;
