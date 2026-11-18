/* QR кодове за плащане: центърът задава до 3 (качва картинка на всеки слот).
 * Собствениците виждат активните, за да платят. */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { auth, requireRole } = require('../auth.cjs');
const { upload } = require('../upload.cjs');
const cfg = require('../config.cjs');
const path = require('path');
const r = express.Router();
const nowISO = () => new Date().toISOString();

r.use(auth);

/* картинката на QR слот — видима за всяка влязла роля (собственикът плаща по нея) */
r.get('/qrcodes/:slot/image', async (req, res) => {
  const q = await db.one('SELECT image_path FROM qrcodes WHERE slot=$1', [Number(req.params.slot)]);
  if (!q || !q.image_path) return res.status(404).end();
  res.sendFile(path.join(cfg.UPLOAD_DIR, path.basename(q.image_path)));
});

/* всички (активните са видими за собственика) */
r.get('/qrcodes', async (req, res) => {
  const all = (await db.query('SELECT * FROM qrcodes ORDER BY slot')).rows;
  const rows = req.user.role === 'center' ? all : all.filter(q => q.active);
  res.json({ qrcodes: rows });
});

/* център: задава/сменя слот 1..3 */
r.post('/qrcodes/:slot', requireRole('center'), upload.single('image'), async (req, res) => {
  const slot = Number(req.params.slot);
  if (![1, 2, 3].includes(slot)) return res.status(400).json({ error: 'Слотът е 1, 2 или 3.' });
  const label = (req.body && req.body.label) || null;
  const active = req.body && req.body.active != null ? (req.body.active === '1' || req.body.active === 'true' ? 1 : 0) : 1;
  const ex = await db.one('SELECT * FROM qrcodes WHERE slot=$1', [slot]);
  const img = req.file ? req.file.filename : (ex ? ex.image_path : null);
  if (ex) await db.query('UPDATE qrcodes SET image_path=$1,label=$2,active=$3,updated_at=$4 WHERE slot=$5', [img, label, active, nowISO(), slot]);
  else await db.query('INSERT INTO qrcodes(slot,image_path,label,active,updated_at) VALUES($1,$2,$3,$4,$5)', [slot, img, label, active, nowISO()]);
  res.json({ ok: true });
});

r.delete('/qrcodes/:slot', requireRole('center'), async (req, res) => {
  await db.query('UPDATE qrcodes SET active=0 WHERE slot=$1', [Number(req.params.slot)]);
  res.json({ ok: true });
});

module.exports = r;
