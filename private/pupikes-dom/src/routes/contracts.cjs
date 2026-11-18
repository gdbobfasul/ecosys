/* Договори: собственици и майстори качват снимки/PDF на договорите си с центъра.
 * Файловете се именуват с пореден номер + дата + име. Центърът вижда всички. */
'use strict';
const express = require('express');
const fs = require('fs'); const path = require('path');
const db = require('../db.cjs');
const { auth, requireRole } = require('../auth.cjs');
const { upload, sanitize } = require('../upload.cjs');
const cfg = require('../config.cjs');
const r = express.Router();
const nowISO = () => new Date().toISOString();

r.use(auth);

r.post('/contracts', requireRole('owner', 'tech'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Прикачете файл (снимка или PDF).' });
  const u = await db.one('SELECT name,username,email FROM users WHERE id=$1', [req.user.id]);
  const seqRow = await db.one('SELECT COALESCE(MAX(seq),0)+1 AS n FROM contracts');
  const seq = Number(seqRow.n);
  const date = new Date().toISOString().slice(0, 10);
  const nm = sanitize(u.name || u.username || u.email);
  const ext = (path.extname(req.file.originalname) || '').toLowerCase().slice(0, 8);
  const finalName = `${String(seq).padStart(4, '0')}_${date}_${nm}${ext}`;
  try { fs.renameSync(path.join(cfg.UPLOAD_DIR, req.file.filename), path.join(cfg.UPLOAD_DIR, finalName)); } catch {}
  const c = await db.one('INSERT INTO contracts(user_id,seq,file_path,orig_name,uploaded_at) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [req.user.id, seq, finalName, req.file.originalname, nowISO()]);
  res.json({ contract: c });
});

r.get('/contracts', async (req, res) => {
  let rows;
  if (req.user.role === 'center') rows = (await db.query('SELECT * FROM contracts ORDER BY seq DESC')).rows;
  else rows = (await db.query('SELECT * FROM contracts WHERE user_id=$1 ORDER BY seq DESC', [req.user.id])).rows;
  for (const c of rows) { const u = await db.one('SELECT name,username,email,role FROM users WHERE id=$1', [c.user_id]); c.who = u && (u.name || u.username || u.email); c.who_role = u && u.role; }
  res.json({ contracts: rows });
});

module.exports = r;
