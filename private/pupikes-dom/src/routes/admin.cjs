/* Управление: четене (център + админ), мутации (само център, освен маркиране на майстор —
 * център ИЛИ админ). Проблемен ИМОТ, одобряване на договори/плащания, екип — само център. */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { auth, requireRole, hash } = require('../auth.cjs');
const { effective, feeForRank, RANK_FEE } = require('../fees.cjs');
const r = express.Router();
const nowISO = () => new Date().toISOString();
const curPeriod = () => new Date().toISOString().slice(0, 7);
const round2 = n => Math.round(n * 100) / 100;

const C = [auth, requireRole('center')];                 // само център
const CA = [auth, requireRole('center', 'admin')];       // център + админ (четене)
const CAF = [auth, requireRole('center', 'admin')];      // маркиране на майстор: център + админ

r.get('/clients', CA, async (_req, res) => {
  const rows = (await db.query("SELECT id,email,username,name,phone,approved,moderator_id,created_at FROM users WHERE role='owner' ORDER BY id")).rows;
  for (const o of rows) {
    o.properties = Number((await db.one('SELECT COUNT(*) c FROM properties WHERE owner_id=$1', [o.id])).c);
    o.payments = Number((await db.one('SELECT COUNT(*) c FROM payments WHERE owner_id=$1', [o.id])).c);
    o.paid_month = !!(await db.one("SELECT 1 x FROM payments WHERE owner_id=$1 AND kind='monthly' AND verified=1 AND period=$2 LIMIT 1", [o.id, curPeriod()]));
    o.contracts = Number((await db.one('SELECT COUNT(*) c FROM contracts WHERE user_id=$1', [o.id])).c);
    o.moderator = o.moderator_id ? (await db.one('SELECT name,email FROM users WHERE id=$1', [o.moderator_id])) : null;
  }
  res.json({ clients: rows });
});

r.get('/techs', CA, async (_req, res) => {
  const rows = (await db.query("SELECT id,email,name,phone,approved,flagged,created_at FROM users WHERE role='tech' ORDER BY id")).rows;
  for (const t of rows) {
    t.profile = await db.one('SELECT main_address,main_lat,main_lng,skills,trade,visit_fee,rank,multi_volunteer FROM tech_profiles WHERE user_id=$1', [t.id]);
    t.visits = Number((await db.one("SELECT COUNT(*) c FROM signals WHERE accepted_by=$1 AND status='resolved'", [t.id])).c);
    t.addresses = (await db.query('SELECT label,address,lat,lng FROM tech_addresses WHERE user_id=$1', [t.id])).rows;
    t.contracts = Number((await db.one('SELECT COUNT(*) c FROM contracts WHERE user_id=$1', [t.id])).c);
    t.effective_fee = effective(t.profile && t.profile.visit_fee, t.profile && t.profile.rank);
    t.custom_fee = !!(t.profile && t.profile.visit_fee > 0);
  }
  res.json({ techs: rows });
});

r.get('/staff', CA, async (_req, res) => {
  const rows = (await db.query("SELECT id,email,name,role,created_at FROM users WHERE role IN ('moderator','admin') ORDER BY role,id")).rows;
  for (const s of rows) if (s.role === 'moderator') s.owners = Number((await db.one('SELECT COUNT(*) c FROM users WHERE moderator_id=$1', [s.id])).c);
  res.json({ staff: rows });
});

r.get('/overview', CA, async (_req, res) => {
  const c = async (sql, p) => Number((await db.one(sql, p || [])).c);
  res.json({
    owners: await c("SELECT COUNT(*) c FROM users WHERE role='owner'"),
    techs: await c("SELECT COUNT(*) c FROM users WHERE role='tech'"),
    emergency: await c("SELECT COUNT(*) c FROM signals WHERE type='emergency' AND status!='resolved'"),
    problem: await c("SELECT COUNT(*) c FROM signals WHERE type='problem' AND status!='resolved'"),
    payments_unverified: await c('SELECT COUNT(*) c FROM payments WHERE verified=0'),
  });
});

/* --- само център --- */
r.post('/contracts/:id/approve', C, async (req, res) => {
  const c = await db.one('SELECT * FROM contracts WHERE id=$1', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Няма такъв договор.' });
  await db.query('UPDATE contracts SET approved=1,approved_at=$1,approved_by=$2 WHERE id=$3', [nowISO(), req.user.id, c.id]);
  await db.query('UPDATE users SET approved=1 WHERE id=$1', [c.user_id]);
  res.json({ ok: true });
});
r.post('/users/:id/approve', C, async (req, res) => {
  const a = req.body && req.body.approved === false ? 0 : 1;
  await db.query('UPDATE users SET approved=$1 WHERE id=$2', [a, req.params.id]);
  res.json({ ok: true });
});
r.post('/properties/:id/flag', C, async (req, res) => {       // проблемен ИМОТ — само център
  const f = req.body && req.body.flagged ? 1 : 0;
  await db.query('UPDATE properties SET flagged=$1 WHERE id=$2', [f, req.params.id]);
  res.json({ ok: true });
});
r.post('/staff', C, async (req, res) => {                      // създаване на модератор/админ
  const { role, email, password, name } = req.body || {};
  if (!['moderator', 'admin'].includes(role)) return res.status(400).json({ error: 'Роля: модератор или админ.' });
  if (!email || !password) return res.status(400).json({ error: 'Имейл и парола са задължителни.' });
  if (await db.one('SELECT id FROM users WHERE email=$1', [String(email).toLowerCase()])) return res.status(409).json({ error: 'Имейлът е зает.' });
  await db.query('INSERT INTO users(role,email,name,password_hash,approved,flagged,created_at) VALUES($1,$2,$3,$4,1,0,$5)',
    [role, String(email).toLowerCase(), name || null, hash(password), nowISO()]);
  res.json({ ok: true });
});

/* карта ранг→сума (справка) — четене център+админ */
r.get('/rank-fees', CA, async (_req, res) => res.json({ rank_fees: RANK_FEE }));

/* ИНДИВИДУАЛНА такса на специалист (замества тази по ранг) — само център (0 = връща към ранговата) */
r.post('/users/:id/visit-fee', C, async (req, res) => {
  const fee = Math.max(0, parseFloat(req.body && req.body.fee) || 0);
  const ex = await db.one('SELECT user_id FROM tech_profiles WHERE user_id=$1', [req.params.id]);
  if (ex) await db.query('UPDATE tech_profiles SET visit_fee=$1 WHERE user_id=$2', [fee, req.params.id]);
  else await db.query('INSERT INTO tech_profiles(user_id,visit_fee) VALUES($1,$2)', [req.params.id, fee]);
  res.json({ ok: true });
});

/* РАНГ на специалист (1–5) — само център. Промяна е възможна САМО на 28-мо число и веднъж
 * месечно. (Текущите поръчки минават към следващата ставка — новата такса важи при приключване
 * след смяната, понеже сметката ползва актуалния ранг.) По желание сверява сумата (reset_fee). */
r.post('/users/:id/rank', C, async (req, res) => {
  const rk = Math.min(5, Math.max(1, parseInt(req.body && req.body.rank) || 1));
  const now = new Date();
  const period = now.toISOString().slice(0, 7);
  const prof = await db.one('SELECT user_id,rank_changed_period FROM tech_profiles WHERE user_id=$1', [req.params.id]);
  if (!process.env.PL_RANK_ANYDAY && now.getDate() !== 28) return res.status(423).json({ error: 'Рангът се променя само на 28-мо число (след месечните суми).' });
  if (prof && prof.rank_changed_period === period) return res.status(409).json({ error: 'Рангът вече е променян този месец.' });
  if (prof) await db.query('UPDATE tech_profiles SET rank=$1,rank_changed_period=$2 WHERE user_id=$3', [rk, period, req.params.id]);
  else await db.query('INSERT INTO tech_profiles(user_id,rank,rank_changed_period) VALUES($1,$2,$3)', [req.params.id, rk, period]);
  if (req.body && req.body.reset_fee) await db.query('UPDATE tech_profiles SET visit_fee=0 WHERE user_id=$1', [req.params.id]);  // 0 = връща към таксата по ранг
  res.json({ ok: true });
});

/* центърът назначава кой модератор отговаря за кой обект (собственик) — само център */
r.post('/clients/:id/moderator', C, async (req, res) => {
  const mid = req.body && req.body.moderator_id ? Number(req.body.moderator_id) : null;
  if (mid && !(await db.one("SELECT id FROM users WHERE id=$1 AND role='moderator'", [mid]))) return res.status(400).json({ error: 'Няма такъв модератор.' });
  await db.query("UPDATE users SET moderator_id=$1 WHERE id=$2 AND role='owner'", [mid, req.params.id]);
  res.json({ ok: true });
});

/* СМЕТКИ (само изчислителни): разпределение на месечните такси — център + админ */
r.get('/earnings', CA, async (_req, res) => {
  const pays = (await db.query("SELECT p.amount, u.moderator_id FROM payments p JOIN users u ON u.id=p.owner_id WHERE p.kind='monthly' AND p.verified=1")).rows;
  let total = 0, modShare = 0;
  for (const p of pays) { const a = parseFloat(p.amount) || 0; total += a; if (p.moderator_id) modShare += a * 0.03; }
  const adminShare = total * 0.01;
  const visits = (await db.query("SELECT tp.visit_fee, tp.rank FROM signals s JOIN tech_profiles tp ON tp.user_id=s.accepted_by WHERE s.status='resolved'")).rows;
  let executors = 0; for (const v of visits) executors += effective(v.visit_fee, v.rank);
  res.json({
    total_monthly: round2(total), admin_rate: 0.01, admin_share: round2(adminShare),
    moderator_rate: 0.03, moderators_share: round2(modShare), executors_total: round2(executors),
    operator_share: round2(total - adminShare - modShare - executors),
  });
});

/* --- маркиране на МАЙСТОР като проблемен: център ИЛИ админ --- */
r.post('/users/:id/flag', CAF, async (req, res) => {
  const f = req.body && req.body.flagged ? 1 : 0;
  await db.query("UPDATE users SET flagged=$1 WHERE id=$2 AND role='tech'", [f, req.params.id]);
  res.json({ ok: true });
});

/* --- отмяна на ограничението „1 обект едновременно / 12ч изчакване" — САМО център или админ --- */
r.post('/users/:id/volunteer-override', CAF, async (req, res) => {
  const b = req.body && req.body.allow;
  const allow = (b === true || b === 1 || b === '1' || b === 'true') ? 1 : 0;
  await db.query('UPDATE tech_profiles SET multi_volunteer=$1 WHERE user_id=$2', [allow, req.params.id]);
  res.json({ ok: true, allow });
});

/* --- настройки (мелодии) --- */
r.get('/settings', CA, async (_req, res) => { res.json({ settings: await getSettings() }); });
r.put('/settings', C, async (req, res) => {
  const { emergency_sound, problem_sound } = req.body || {};
  if (emergency_sound) await setSetting('emergency_sound', emergency_sound);
  if (problem_sound) await setSetting('problem_sound', problem_sound);
  res.json({ settings: await getSettings() });
});

async function getSettings() {
  const rows = (await db.query('SELECT skey,svalue FROM settings')).rows;
  const map = Object.fromEntries(rows.map(x => [x.skey, x.svalue]));
  return { emergency_sound: map.emergency_sound || 'sounds/emergency.wav', problem_sound: map.problem_sound || 'sounds/problem.wav' };
}
async function setSetting(k, v) {
  const ex = await db.one('SELECT skey FROM settings WHERE skey=$1', [k]);
  if (ex) await db.query('UPDATE settings SET svalue=$1 WHERE skey=$2', [v, k]);
  else await db.query('INSERT INTO settings(skey,svalue) VALUES($1,$2)', [k, v]);
}

module.exports = r;
module.exports.getSettings = getSettings;
