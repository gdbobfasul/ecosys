// Version: 1.0193
// Чат — модул „ЗАДАЧИ" (Remote Local Hands / „Истина ли е"). НИЕ само дефинираме нуждата,
// НЕ обработваме парите между двамата. Поток и правила (по спецификацията):
//   1) Авторът създава ЧЕРНОВА (draft), пише подробни условия + награда (колко дава).
//      Има време да я редактира; вижда се от други като „в подготовка" (БЕЗ автора).
//   2) PUBLISH → публикувана; вече НЕ се редактира.
//   3) Изпълнител я ХВАЩА (плаща ТАКСА към нас — free_mode=0 засега). Авторът НЕ може да откаже.
//      Започва чат между двамата (въпроси преди старт).
//   4) Изпълнителят ЗАКЛЮЧВА чата → започва изпълнение (in_progress).
//   5) DONE с доклад + снимка. Авторът плаща НАГРАДАТА (извън платформата).
//   6) Авторът потвърждава плащане → paid. Ако НЕ плати → изпълнителят докладва → БАН (админ).
'use strict';
const express = require('express');

module.exports = function createTasksRoutes(db) {
  const router = express.Router();
  const Q = require('../queries').tasks; // набор заявки според CHAT_DB_TYPE (pg/sqlite)
  const { takeFee } = require('../utils/taskFees');
  const TYPES = ['local_hands', 'verify', 'other'];
  // Stripe — за реалното плащане на таксата при free_mode=false (ползва конфига на чата).
  let stripe = null, STRIPE_CFG = {};
  try { STRIPE_CFG = require('../../configs/stripe-config').resolveStripeConfig(process.env); stripe = require('stripe')(STRIPE_CFG.secretKey); } catch (e) {}

  // ── създай чернова ──
  router.post('/', async (req, res) => {
    try {
      const b = req.body || {};
      if (!TYPES.includes(b.type)) return res.status(400).json({ error: 'bad_type' });
      if (!b.country || !String(b.country).trim()) return res.status(400).json({ error: 'no_country', message: 'Държавата е задължителна.' });
      if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: 'no_title', message: 'Заглавието е задължително.' });
      const r = await db.prepare(Q.CREATE_DRAFT).run(req.phone, b.type, String(b.country).trim(), b.city || null, String(b.title).trim(),
        b.content || '', b.reward_amount != null ? b.reward_amount : null, b.reward_currency || 'EUR');
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── редактирай чернова (само автор, само draft) ──
  router.put('/:id', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_AUTHOR_STATUS).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.author_phone !== req.phone) return res.status(403).json({ error: 'not_owner' });
      if (t.status !== 'draft') return res.status(400).json({ error: 'not_editable', message: 'Публикувана задача не се редактира.' });
      const b = req.body || {};
      await db.prepare(Q.UPDATE_DRAFT).run(TYPES.includes(b.type) ? b.type : null, b.country || null, b.city || null, b.title || null,
        b.content != null ? b.content : null, b.reward_amount != null ? b.reward_amount : null, b.reward_currency || null, req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── публикувай (draft → published; вече не се пипа) ──
  router.post('/:id/publish', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_AUTHOR_STATUS).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.author_phone !== req.phone) return res.status(403).json({ error: 'not_owner' });
      if (t.status !== 'draft') return res.status(400).json({ error: 'already_published' });
      await db.prepare(Q.PUBLISH).run(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── списък (публикувани + чернови като „в подготовка" БЕЗ автора) ──
  router.get('/', async (req, res) => {
    try {
      const { sql, params } = Q.buildList({
        type: (req.query.type && TYPES.includes(req.query.type)) ? req.query.type : null,
        country: req.query.country || null,
      });
      const rows = await db.prepare(sql).all(...params);
      // черновите се показват като „в подготовка" — без автора, без хващане
      const out = rows.map(r => Object.assign({}, r, r.status === 'draft' ? { status: 'preparing' } : {}));
      res.json({ tasks: out });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── детайл ──
  router.get('/:id', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_FULL).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      const mine = (t.author_phone === req.phone), isExec = (t.executor_phone === req.phone);
      // черновата на ДРУГ → само съдържание, без автор/такси
      if (t.status === 'draft' && !mine) {
        return res.json({ task: { id: t.id, type: t.type, country: t.country, city: t.city, title: t.title, content: t.content, status: 'preparing' } });
      }
      if (!mine && !isExec) { delete t.author_phone; delete t.executor_phone; }
      t.role = mine ? 'author' : isExec ? 'executor' : 'viewer';
      t.fee = takeFee(t.country);
      res.json({ task: t });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── ХВАНИ (изпълнител; published → taken; плаща такса към нас; авторът не може да откаже) ──
  router.post('/:id/take', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_AUTHOR_STATUS_COUNTRY).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.status !== 'published') return res.status(400).json({ error: 'not_available', message: 'Задачата не е свободна за хващане.' });
      if (t.author_phone === req.phone) return res.status(400).json({ error: 'own_task', message: 'Не можеш да хванеш своя задача.' });
      const fee = takeFee(t.country);
      if (!fee.free) {
        // изисква се плащане на таксата → НЕ хващаме още; клиентът минава през pay-fee + confirm-fee
        return res.json({ ok: false, payment_required: true, fee });
      }
      await db.prepare(Q.TAKE).run(req.phone, fee.amount, fee.currency, req.params.id);
      res.json({ ok: true, fee });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── РЕАЛНО плащане на таксата (при free_mode=false): създай Stripe PaymentIntent ──
  router.post('/:id/pay-fee', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_AUTHOR_STATUS_COUNTRY).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.status !== 'published') return res.status(400).json({ error: 'not_available' });
      if (t.author_phone === req.phone) return res.status(400).json({ error: 'own_task' });
      const fee = takeFee(t.country);
      if (fee.free) return res.json({ free: true });
      if (!stripe) return res.status(500).json({ error: 'stripe_unavailable', message: 'Плащането не е налично.' });
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(fee.amount * 100),
        currency: (fee.currency || 'EUR').toLowerCase(),
        metadata: { task_id: String(req.params.id), executor: req.phone, kind: 'task_take_fee' },
      });
      await db.prepare(Q.SET_FEE_INTENT).run(intent.id, req.params.id);
      res.json({ clientSecret: intent.client_secret, publishableKey: STRIPE_CFG.publishableKey, amount: fee.amount, currency: fee.currency });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── потвърди платената такса → ХВАНИ задачата ──
  router.post('/:id/confirm-fee', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_AUTHOR_STATUS_COUNTRY_INTENT).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.status !== 'published') return res.status(400).json({ error: 'not_available' });
      if (t.author_phone === req.phone) return res.status(400).json({ error: 'own_task' });
      if (!stripe || !t.take_fee_intent) return res.status(400).json({ error: 'no_payment' });
      const pi = await stripe.paymentIntents.retrieve(t.take_fee_intent);
      if (!pi || pi.status !== 'succeeded') return res.status(402).json({ error: 'not_paid', message: 'Плащането не е потвърдено.' });
      const fee = takeFee(t.country);
      await db.prepare(Q.TAKE_PAID).run(req.phone, fee.amount, fee.currency, req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── чат по задачата (само автор/изпълнител; спира при заключване) ──
  router.get('/:id/messages', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_PARTIES).get(req.params.id);
      if (!t || (t.author_phone !== req.phone && t.executor_phone !== req.phone)) return res.status(403).json({ error: 'forbidden' });
      const msgs = await db.prepare(Q.GET_MESSAGES).all(req.params.id);
      res.json({ messages: msgs.map(m => ({ text: m.text, created_at: m.created_at, sent: m.sender_phone === req.phone })) });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });
  router.post('/:id/messages', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_PARTIES_FOR_CHAT).get(req.params.id);
      if (!t || (t.author_phone !== req.phone && t.executor_phone !== req.phone)) return res.status(403).json({ error: 'forbidden' });
      if (t.chat_locked) return res.status(400).json({ error: 'chat_locked', message: 'Чатът е заключен — изпълнението е започнало.' });
      const text = String((req.body && req.body.text) || '').trim();
      if (!text) return res.status(400).json({ error: 'empty' });
      await db.prepare(Q.INSERT_MESSAGE).run(req.params.id, req.phone, text.slice(0, 4000));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── ЗАКЛЮЧИ чата → започва изпълнение (изпълнител; taken → in_progress) ──
  router.post('/:id/lock', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_EXECUTOR_STATUS).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.executor_phone !== req.phone) return res.status(403).json({ error: 'not_executor' });
      if (t.status !== 'taken') return res.status(400).json({ error: 'bad_status' });
      await db.prepare(Q.LOCK).run(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── ИЗПЪЛНЕНО с доклад + снимка (изпълнител; in_progress → done) ──
  router.post('/:id/done', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_EXECUTOR_STATUS).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.executor_phone !== req.phone) return res.status(403).json({ error: 'not_executor' });
      if (t.status !== 'in_progress') return res.status(400).json({ error: 'bad_status' });
      const b = req.body || {};
      await db.prepare(Q.DONE)
        .run(String(b.report || '').slice(0, 8000), b.photo || null, req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── авторът потвърждава, че е платил наградата (done → paid) ──
  router.post('/:id/confirm-paid', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_AUTHOR_STATUS).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.author_phone !== req.phone) return res.status(403).json({ error: 'not_owner' });
      if (t.status !== 'done') return res.status(400).json({ error: 'bad_status' });
      await db.prepare(Q.CONFIRM_PAID).run(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── изпълнителят докладва, че авторът НЕ е платил → за бан (админ) ──
  router.post('/:id/report-nonpayment', async (req, res) => {
    try {
      const t = await db.prepare(Q.GET_EXECUTOR_STATUS).get(req.params.id);
      if (!t) return res.status(404).json({ error: 'not_found' });
      if (t.executor_phone !== req.phone) return res.status(403).json({ error: 'not_executor' });
      if (t.status !== 'done') return res.status(400).json({ error: 'bad_status', message: 'Само завършена задача.' });
      await db.prepare(Q.REPORT_NONPAYMENT).run(req.params.id);
      // Бан на автора решава админ (вижда payment_disputed); тук само маркираме.
      res.json({ ok: true, message: 'Докладвано. Админ ще прегледа и при потвърждение авторът се банва.' });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // ── моите задачи (като автор + като изпълнител) ──
  router.get('/mine/list', async (req, res) => {
    try {
      const authored = await db.prepare(Q.MINE_AUTHORED).all(req.phone);
      const taken = await db.prepare(Q.MINE_TAKEN).all(req.phone);
      res.json({ authored, taken });
    } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  return router;
};
