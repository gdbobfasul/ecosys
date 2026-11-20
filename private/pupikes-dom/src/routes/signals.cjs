/* Сигнали „спешен"/„проблем" с вид (ток/вода): създаване от собственик, известяване само на
 * майсторите с тази специалност (и центъра), приемане (само одобрен и немаркиран майстор, само
 * за немаркиран имот), отказ от собственика (само заради време), възлагане от центъра,
 * приключване — САМО от собственика на място. Един активен сигнал на имот. */
'use strict';
const express = require('express');
const db = require('../db.cjs');
const { auth, requireRole } = require('../auth.cjs');
const rt = require('../realtime.cjs');
const push = require('../push.cjs');
const { TRADES, LABEL } = require('../trades.cjs');
const { effective } = require('../fees.cjs');
const r = express.Router();
const nowISO = () => new Date().toISOString();
const curPeriod = () => new Date().toISOString().slice(0, 7);   // YYYY-MM
const ACTIVE = ['open', 'accepted', 'assigned'];
const soundFor = type => (type === 'emergency' ? 'emergency' : 'problem');

r.use(auth);

async function enrich(s) {
  const p = await db.one('SELECT name,address,lat,lng,flagged FROM properties WHERE id=$1', [s.property_id]);
  const o = await db.one('SELECT name,username,phone,approved,moderator_id FROM users WHERE id=$1', [s.owner_id]);
  const t = s.accepted_by ? await db.one('SELECT name,phone FROM users WHERE id=$1', [s.accepted_by]) : null;
  const paid = await db.one("SELECT 1 x FROM payments WHERE owner_id=$1 AND kind='monthly' AND verified=1 AND period=$2 LIMIT 1", [s.owner_id, curPeriod()]);
  const cands = (await db.query(
    `SELECT c.tech_id, c.eta_minutes, u.name, tp.trade, tp.visit_fee, tp.rank
     FROM signal_candidates c JOIN users u ON u.id=c.tech_id LEFT JOIN tech_profiles tp ON tp.user_id=c.tech_id
     WHERE c.signal_id=$1 ORDER BY tp.rank DESC, c.created_at`, [s.id])).rows
    .map(x => ({ tech_id: x.tech_id, name: x.name, trade: x.trade, eta_minutes: x.eta_minutes, rank: x.rank || 1, fee: effective(x.visit_fee, x.rank) }));
  return Object.assign({}, s, {
    property_name: p && p.name, address: p && p.address, lat: p && p.lat, lng: p && p.lng, property_flagged: !!(p && p.flagged),
    owner_name: o && (o.name || o.username), owner_phone: o && o.phone, moderator_id: o && o.moderator_id,
    owner_contract_signed: !!(o && o.approved),            // подписан/одобрен договор
    owner_paid_month: !!paid,                               // платил за текущия месец
    tech_name: t && t.name, tech_phone: t && t.phone,
    candidates: cands,                                       // специалисти, които са одобрили (кандидати)
    cost_total: (Number(s.transport_cost) || 0) + (Number(s.materials_cost) || 0),
    cost_payable: (s.cost_mode === 'transport') ? (Number(s.transport_cost) || 0) : ((Number(s.transport_cost) || 0) + (Number(s.materials_cost) || 0)),
    can_depart: !!s.accepted_by && (s.type === 'emergency' || s.cost_status === 'cleared'),
  });
}
/* проверка: обектът е на този модератор (за ограничаване на модераторските действия) */
async function isOwnObject(signal, userId) {
  const o = await db.one('SELECT moderator_id FROM users WHERE id=$1', [signal.owner_id]);
  return !!(o && o.moderator_id === userId);
}
/* известяване към „надзора": центъра, всички админи и модератора на обекта */
function oversight(view, payload) {
  rt.toRole('center', payload); rt.toRole('admin', payload);
  if (view.moderator_id) rt.toUser(view.moderator_id, payload);
}
async function techRecipients(trade) {
  return (await db.query(
    `SELECT u.id FROM users u JOIN tech_profiles tp ON tp.user_id=u.id
     WHERE u.role='tech' AND u.flagged=0 AND tp.trade=$1`, [trade])).rows.map(x => x.id);
}
function notifyNew(view) {
  const payload = { type: 'new-signal', sound: soundFor(view.type), signal: view };
  oversight(view, payload);
  return techRecipients(view.trade).then(ids => {
    const set = new Set(ids);
    rt.sendWhere(u => u.role === 'tech' && set.has(u.id), payload);
    return push.sendToUsers(ids, {
      title: (view.type === 'emergency' ? '🚨 СПЕШЕН' : '🔧 Проблем') + ' · ' + (LABEL[view.trade] || view.trade),
      body: (view.address || '') + ' · тел. ' + (view.owner_phone || '—'),
      sound: soundFor(view.type), data: { signal_id: String(view.id), kind: view.type },
    });
  });
}

/* --- създаване (собственик) --- */
r.post('/signals', requireRole('owner'), async (req, res) => {
  const { property_id, type, trade, description } = req.body || {};
  if (!['emergency', 'problem'].includes(type)) return res.status(400).json({ error: 'Невалиден вид сигнал.' });
  if (!TRADES.includes(trade)) return res.status(400).json({ error: 'Изберете категория на специалиста.' });
  const prop = await db.one('SELECT * FROM properties WHERE id=$1 AND owner_id=$2', [property_id, req.user.id]);
  if (!prop) return res.status(404).json({ error: 'Няма такъв имот.' });
  if (prop.flagged) return res.status(423).json({ error: 'Имотът е маркиран като проблемен от центъра.' });
  const open = await db.one(`SELECT id FROM signals WHERE property_id=$1 AND status IN ('open','accepted','assigned') LIMIT 1`, [property_id]);
  if (open) return res.status(409).json({ error: 'Вече има активен сигнал за този имот.' });
  const desc = type === 'emergency' ? null : (description || null);
  const s = await db.one(
    `INSERT INTO signals(property_id,owner_id,type,trade,description,status,created_at) VALUES($1,$2,$3,$4,$5,'open',$6) RETURNING *`,
    [property_id, req.user.id, type, trade, desc, nowISO()]);
  const view = await enrich(s);
  await notifyNew(view);
  res.json({ signal: view });
});

/* --- списъци --- */
r.get('/signals', async (req, res) => {
  const scope = req.query.scope || '';
  let rows;
  if (req.user.role === 'owner') {
    rows = (await db.query('SELECT * FROM signals WHERE owner_id=$1 ORDER BY id DESC', [req.user.id])).rows;
  } else if (req.user.role === 'tech') {
    if (scope === 'mine') rows = (await db.query('SELECT * FROM signals WHERE accepted_by=$1 OR id IN (SELECT signal_id FROM signal_candidates WHERE tech_id=$1) ORDER BY id DESC', [req.user.id])).rows;
    else {
      const prof = await db.one('SELECT trade FROM tech_profiles WHERE user_id=$1', [req.user.id]);
      const me = await db.one('SELECT flagged FROM users WHERE id=$1', [req.user.id]);
      if (me && me.flagged) rows = [];
      else rows = (await db.query(
        `SELECT * FROM signals WHERE status='open' AND trade=$1
           AND id NOT IN (SELECT signal_id FROM signal_declines WHERE tech_id=$2)
         ORDER BY id DESC`, [(prof && prof.trade) || '', req.user.id])).rows;
    }
  } else if (req.user.role === 'moderator') {
    const t = req.query.type;
    rows = (await db.query(
      `SELECT s.* FROM signals s JOIN users o ON o.id=s.owner_id WHERE o.moderator_id=$1 ${t ? 'AND s.type=$2' : ''} ORDER BY s.id DESC`,
      t ? [req.user.id, t] : [req.user.id])).rows;
  } else {   // center / admin — всички обекти
    const t = req.query.type;
    rows = (await db.query(t ? 'SELECT * FROM signals WHERE type=$1 ORDER BY id DESC' : 'SELECT * FROM signals ORDER BY id DESC', t ? [t] : [])).rows;
  }
  let out = await Promise.all(rows.map(enrich));
  if (req.user.role === 'tech') {
    const mine = new Set((await db.query('SELECT signal_id FROM signal_candidates WHERE tech_id=$1', [req.user.id])).rows.map(x => x.signal_id));
    out = out.map(s => Object.assign(s, { i_volunteered: mine.has(s.id) }));
  }
  res.json({ signals: out });
});

r.get('/signals/:id', async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  res.json({ signal: await enrich(s) });
});

/* --- ОДОБРЕНИЕ (кандидатстване) от специалист ---
 * Няколко специалисти могат да одобрят; сигналът ОСТАВА отворен. Одобренията отиват при
 * модератора на обекта и админите, които после насочват кой да отиде (assign). */
r.post('/signals/:id/volunteer', requireRole('tech'), async (req, res) => {
  const me = await db.one('SELECT approved,flagged FROM users WHERE id=$1', [req.user.id]);
  if (!me || !me.approved) return res.status(403).json({ error: 'Договорът ти още не е одобрен от центъра.' });
  if (me.flagged) return res.status(403).json({ error: 'Профилът ти е маркиран като проблемен.' });
  const s = await db.one('SELECT * FROM signals WHERE id=$1', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  if (s.status !== 'open') return res.status(409).json({ error: 'Сигналът вече не е отворен.' });
  const prof = await db.one('SELECT trade FROM tech_profiles WHERE user_id=$1', [req.user.id]);
  if (prof && prof.trade !== s.trade) return res.status(403).json({ error: 'Този сигнал е за друга група.' });
  const prop = await db.one('SELECT flagged FROM properties WHERE id=$1', [s.property_id]);
  if (prop && prop.flagged) return res.status(423).json({ error: 'Имотът е маркиран като проблемен.' });
  if (await db.one('SELECT 1 x FROM signal_declines WHERE signal_id=$1 AND tech_id=$2', [s.id, req.user.id])) return res.status(403).json({ error: 'Собственикът ви е отказал за този сигнал.' });
  // Ограничение: 1 обект едновременно + половин ден (12ч) след насочване НЕ може нов.
  // Отменя се САМО от админ/център (tech_profiles.multi_volunteer=1). PL_NO_COOLDOWN=1 = тестов bypass.
  const tp = await db.one('SELECT multi_volunteer FROM tech_profiles WHERE user_id=$1', [req.user.id]);
  const unlocked = (tp && Number(tp.multi_volunteer) === 1) || process.env.PL_NO_COOLDOWN === '1';
  if (!unlocked) {
    const active = await db.one(
      "SELECT 1 x FROM signal_candidates c JOIN signals g ON g.id=c.signal_id WHERE c.tech_id=$1 AND g.status='open' AND g.id<>$2 LIMIT 1",
      [req.user.id, s.id]);
    if (active) return res.status(409).json({ error: 'Можеш да кандидатстваш само по 1 обект едновременно. Обърни се към център/админ за разрешение.' });
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const recent = await db.one(
      "SELECT 1 x FROM signals WHERE accepted_by=$1 AND accepted_at IS NOT NULL AND accepted_at > $2 LIMIT 1",
      [req.user.id, since]);
    if (recent) return res.status(409).json({ error: 'След насочване по обект изчакай половин ден преди нов. Център/админ може да разреши.' });
  }
  let eta = Number(req.body && req.body.eta_minutes); if (!Number.isFinite(eta) || eta <= 0) eta = 60;
  if (eta > 180) return res.status(400).json({ error: 'Срокът не може да е повече от 3 часа.' });
  await db.query('INSERT INTO signal_candidates(signal_id,tech_id,eta_minutes,created_at) VALUES($1,$2,$3,$4)', [s.id, req.user.id, eta, nowISO()]).catch(() => {});
  const view = await enrich(s);
  oversight(view, { type: 'signal-volunteer', signal: view });   // одобрението отива при модератор/админ/център
  res.json({ signal: view });
});

/* --- отказ от собственика (само заради време; не избира майстор) --- */
r.post('/signals/:id/decline', requireRole('owner'), async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  if (!s.accepted_by) return res.status(400).json({ error: 'Няма приел майстор за отказване.' });
  const tech = s.accepted_by;
  await db.query('INSERT INTO signal_declines(signal_id,tech_id) VALUES($1,$2)', [s.id, tech]).catch(() => {});
  await db.query('DELETE FROM signal_candidates WHERE signal_id=$1 AND tech_id=$2', [s.id, tech]);
  await db.query("UPDATE signals SET accepted_by=NULL,accepted_at=NULL,eta_minutes=NULL,status='open' WHERE id=$1", [s.id]);
  const view = await enrich(await db.one('SELECT * FROM signals WHERE id=$1', [s.id]));
  rt.toUser(tech, { type: 'signal-declined', signal: view });
  oversight(view, { type: 'signal-declined', signal: view });
  await notifyNew(view);                                    // пак е отворен → известие на подходящите майстори
  res.json({ signal: view });
});

/* --- възлагане/преназначаване ---
 * center/admin: може свободно (включително преназначаване над отказ/модератор);
 * moderator: само за СВОЙ обект и само ако още никой не е ангажиран (веднъж, без промяна). */
r.post('/signals/:id/assign', requireRole('center', 'moderator', 'admin'), async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  if (s.status === 'resolved') return res.status(400).json({ error: 'Сигналът е приключен.' });
  if (req.user.role === 'moderator') {
    const o = await db.one('SELECT moderator_id FROM users WHERE id=$1', [s.owner_id]);
    if (!o || o.moderator_id !== req.user.id) return res.status(403).json({ error: 'Този обект не е твой.' });
    if (s.accepted_by) return res.status(423).json({ error: 'Вече има ангажиран майстор — модераторът не може да сменя.' });
  }
  const techId = Number(req.body && req.body.tech_id);
  const tech = await db.one("SELECT id,flagged FROM users WHERE id=$1 AND role='tech'", [techId]);
  if (!tech) return res.status(400).json({ error: 'Няма такъв майстор.' });
  if (tech.flagged) return res.status(423).json({ error: 'Майсторът е маркиран като проблемен.' });
  let eta = Number(req.body && req.body.eta_minutes); if (!Number.isFinite(eta) || eta <= 0) eta = 60;
  await db.query("UPDATE signals SET accepted_by=$1,accepted_at=$2,eta_minutes=$3,status='assigned' WHERE id=$4",
    [techId, nowISO(), eta, s.id]);
  const view = await enrich(await db.one('SELECT * FROM signals WHERE id=$1', [s.id]));
  rt.toUser(techId, { type: 'signal-assigned', sound: soundFor(s.type), signal: view });
  rt.toUser(s.owner_id, { type: 'signal-accepted', signal: view });
  oversight(view, { type: 'signal-accepted', signal: view });
  await push.sendToUsers([techId], { title: 'Възложен сигнал', body: view.address || '', sound: soundFor(s.type), data: { signal_id: String(s.id) } });
  res.json({ signal: view });
});

/* --- приключване: САМО собственикът на място маркира „решено" (край на задачата) --- */
r.post('/signals/:id/resolve', requireRole('owner'), async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  await db.query("UPDATE signals SET status='resolved',resolved_at=$1 WHERE id=$2", [nowISO(), s.id]);
  const view = await enrich(await db.one('SELECT * FROM signals WHERE id=$1', [s.id]));
  if (s.accepted_by) rt.toUser(s.accepted_by, { type: 'signal-resolved', signal: view });
  oversight(view, { type: 'signal-resolved', signal: view });
  res.json({ signal: view });
});

/* ===================== РАЗХОДИ (транспорт + материали) ===================== */

/* насоченият специалист изчислява разходите и праща заявка до собственика */
r.post('/signals/:id/cost', requireRole('tech'), async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  if (s.accepted_by !== req.user.id) return res.status(403).json({ error: 'Не си насоченият специалист.' });
  if (s.status === 'resolved') return res.status(400).json({ error: 'Сигналът е приключен.' });
  const transport = Math.max(0, parseFloat(req.body && req.body.transport_cost) || 0);
  const materials = Math.max(0, parseFloat(req.body && req.body.materials_cost) || 0);
  const byTech = (req.body && req.body.materials_by_tech) ? 1 : 0;
  // СПЕШЕН: по договор разходите са за сметка на клиента (дължат се СЛЕД обслужване) → авто-одобрени
  const status = s.type === 'emergency' ? 'cleared' : 'pending';
  await db.query('UPDATE signals SET transport_cost=$1,materials_cost=$2,materials_by_tech=$3,cost_status=$4,cost_note=$5,cost_submitted_at=$6 WHERE id=$7',
    [transport, materials, byTech, status, (req.body && req.body.note) || null, nowISO(), s.id]);
  const view = await enrich(await db.one('SELECT * FROM signals WHERE id=$1', [s.id]));
  rt.toUser(s.owner_id, { type: 'cost-request', signal: view });
  oversight(view, { type: 'cost-request', signal: view });
  res.json({ signal: view });
});

/* собственикът одобрява разходите (само „проблем").
 * mode='full' = плаща транспорт+материали; mode='transport' = плаща само таксите за придвижване,
 * а материалите остават за НЕГОВА сметка (сам ги купува/плаща). */
r.post('/signals/:id/cost/approve', requireRole('owner'), async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1 AND owner_id=$2', [req.params.id, req.user.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  if (s.cost_status !== 'pending') return res.status(409).json({ error: 'Няма разходи за одобрение.' });
  const mode = (req.body && req.body.mode === 'transport') ? 'transport' : 'full';
  if (mode === 'transport') await db.query("UPDATE signals SET cost_status='approved',cost_mode='transport',materials_by_tech=0 WHERE id=$1", [s.id]);
  else await db.query("UPDATE signals SET cost_status='approved',cost_mode='full' WHERE id=$1", [s.id]);
  const view = await enrich(await db.one('SELECT * FROM signals WHERE id=$1', [s.id]));
  if (s.accepted_by) rt.toUser(s.accepted_by, { type: 'cost-approved', signal: view });
  oversight(view, { type: 'cost-approved', signal: view });
  res.json({ signal: view });
});

/* отказ на разходите (център/модератор/админ) — „отказана заради разходи" */
r.post('/signals/:id/cost/reject', requireRole('center', 'moderator', 'admin'), async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  if (req.user.role === 'moderator' && !(await isOwnObject(s, req.user.id))) return res.status(403).json({ error: 'Този обект не е твой.' });
  if (s.cost_status === 'cleared' && req.user.role === 'moderator') return res.status(403).json({ error: 'Вече е потвърдено „може да тръгне" — само център/админ може да го промени.' });
  await db.query("UPDATE signals SET cost_status='rejected' WHERE id=$1", [s.id]);
  const view = await enrich(await db.one('SELECT * FROM signals WHERE id=$1', [s.id]));
  if (s.accepted_by) rt.toUser(s.accepted_by, { type: 'cost-rejected', signal: view });
  rt.toUser(s.owner_id, { type: 'cost-rejected', signal: view });
  oversight(view, { type: 'cost-rejected', signal: view });
  res.json({ signal: view });
});

/* разходите платени и ПРОВЕРЕНИ (център/модератор/админ) → специалистът може да тръгне */
r.post('/signals/:id/cost/clear', requireRole('center', 'moderator', 'admin'), async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  if (req.user.role === 'moderator' && !(await isOwnObject(s, req.user.id))) return res.status(403).json({ error: 'Този обект не е твой.' });
  if (s.cost_status !== 'approved') return res.status(409).json({ error: 'Разходите не са одобрени от собственика.' });
  await db.query("UPDATE signals SET cost_status='cleared' WHERE id=$1", [s.id]);
  const view = await enrich(await db.one('SELECT * FROM signals WHERE id=$1', [s.id]));
  if (s.accepted_by) rt.toUser(s.accepted_by, { type: 'cost-cleared', signal: view });
  rt.toUser(s.owner_id, { type: 'cost-cleared', signal: view });
  oversight(view, { type: 'cost-cleared', signal: view });
  res.json({ signal: view });
});

/* ПОПРАВКА на грешно „може да тръгне" — САМО център или админ (модератор НЕ може). */
r.post('/signals/:id/cost/unclear', requireRole('center', 'admin'), async (req, res) => {
  const s = await db.one('SELECT * FROM signals WHERE id=$1', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Няма такъв сигнал.' });
  if (s.cost_status !== 'cleared') return res.status(409).json({ error: 'Няма потвърдено „може да тръгне" за поправка.' });
  await db.query("UPDATE signals SET cost_status='approved' WHERE id=$1", [s.id]);
  const view = await enrich(await db.one('SELECT * FROM signals WHERE id=$1', [s.id]));
  if (s.accepted_by) rt.toUser(s.accepted_by, { type: 'cost-unclear', signal: view });
  rt.toUser(s.owner_id, { type: 'cost-unclear', signal: view });
  oversight(view, { type: 'cost-unclear', signal: view });
  res.json({ signal: view });
});

module.exports = r;
