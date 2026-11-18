/* Имоти на собственика + опис на оборудването. */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { auth, requireRole } = require('../auth.cjs');
const r = express.Router();
const nowISO = () => new Date().toISOString();

r.use(auth);

r.get('/properties', async (req, res) => {
  const owner = req.user.role === 'owner' ? req.user.id : Number(req.query.owner_id);
  const props = (await db.query('SELECT * FROM properties WHERE owner_id=$1 ORDER BY id', [owner])).rows;
  for (const p of props) p.equipment = (await db.query('SELECT * FROM equipment WHERE property_id=$1 ORDER BY id', [p.id])).rows;
  res.json({ properties: props });
});

r.post('/properties', requireRole('owner'), async (req, res) => {
  const { name, size, address, lat, lng } = req.body || {};
  const p = await db.one(
    `INSERT INTO properties(owner_id,name,size,address,lat,lng,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.id, name || null, size || null, address || null, numOrNull(lat), numOrNull(lng), nowISO()]);
  res.json({ property: p });
});

r.put('/properties/:id', requireRole('owner'), async (req, res) => {
  const own = await db.one('SELECT id FROM properties WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
  if (!own) return res.status(404).json({ error: 'Няма такъв имот.' });
  const { name, size, address, lat, lng } = req.body || {};
  await db.query('UPDATE properties SET name=$1,size=$2,address=$3,lat=$4,lng=$5 WHERE id=$6',
    [name || null, size || null, address || null, numOrNull(lat), numOrNull(lng), req.params.id]);
  res.json({ ok: true });
});

r.delete('/properties/:id', requireRole('owner'), async (req, res) => {
  await db.query('DELETE FROM equipment WHERE property_id IN (SELECT id FROM properties WHERE id=$1 AND owner_id=$2)', [req.params.id, req.user.id]);
  await db.query('DELETE FROM properties WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

r.post('/properties/:id/equipment', requireRole('owner'), async (req, res) => {
  const own = await db.one('SELECT id FROM properties WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
  if (!own) return res.status(404).json({ error: 'Няма такъв имот.' });
  const { kind, label, count, note } = req.body || {};
  const e = await db.one('INSERT INTO equipment(property_id,kind,label,count,note) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [req.params.id, kind || null, label || null, Number(count) || 1, note || null]);
  res.json({ equipment: e });
});

r.delete('/equipment/:id', requireRole('owner'), async (req, res) => {
  await db.query('DELETE FROM equipment WHERE id=$1 AND property_id IN (SELECT id FROM properties WHERE owner_id=$2)', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

function numOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
module.exports = r;
