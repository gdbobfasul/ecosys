'use strict';
// Лиценз/активация за Pupikes-Desk (само Windows версията; телефонната е безплатна).
// Правило: безплатно до FREE_USES употреби; след това иска плащане през PayPal.
// Активация: въвеждаш номер на транзакцията + име на изпращача (пази се за проверка) → отключва.
// Специален код (твоят) → отключва веднага, без плащане.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store.cjs');   // общият файл pupikes-desk.json до приложението

// ⚠ ПОТВЪРДИ/СМЕНИ тези три неща:
const CONFIG = {
  PAYPAL_EMAIL: 'miroljubkalaydjiev@gmail.com',   // къде се праща плащането
  CONTACT_EMAIL: 'kalaydzhievvaleri@gmail.com',    // поща за връзка/проблеми
  // Цена по регион (еднократно за Windows след безплатните употреби):
  PRICE: '5 € (Европа) · 5 € в рубли (Русия) · 5 $ (останалият свят)',
  FREE_USES: 2,                                    // безплатни употреби, после иска плащане
  OWNER_CODE: 'PUPIKES-FREE-2026',                 // твоят специален код → безплатно
};

// Лицензът/безплатният достъп се пазят в ЕДИНИЯ файл pupikes-desk.json ДО ПРИЛОЖЕНИЕТО (store.cjs) —
// заедно с номера и паролите. Стои, докато файлът не бъде изтрит. Записваме само нашите полета (merge).
const payLog = () => path.join(store.dir(), 'pupikes-desk-payments.json');
function load() { const s = store.readAll(); return { uses: s.uses || 0, activated: !!s.activated, method: s.method || null, txn: s.txn, sender: s.sender, date: s.date }; }
function save(s) { store.writeMerge({ uses: s.uses || 0, activated: !!s.activated, method: s.method || null, txn: s.txn, sender: s.sender, date: s.date }); }

function recordUse() { const s = load(); if (!s.activated) { s.uses = (s.uses || 0) + 1; save(s); } return s; }

function status() {
  const s = load();
  return {
    activated: !!s.activated, method: s.method || null,
    uses: s.uses || 0, freeUses: CONFIG.FREE_USES,
    locked: !s.activated && (s.uses || 0) > CONFIG.FREE_USES,
    price: CONFIG.PRICE, paypal: CONFIG.PAYPAL_EMAIL, contact: CONFIG.CONTACT_EMAIL,
  };
}

function redeemCode(code) {
  if (String(code || '').trim() === CONFIG.OWNER_CODE) { const s = load(); s.activated = true; s.method = 'owner'; s.date = new Date().toISOString(); save(s); return { ok: true }; }
  return { ok: false, error: 'грешен код' };
}

// активация с плащане: пази заявения номер на транзакция + изпращач (ти ги проверяваш в PayPal) и отключва
function activatePaid({ txn, sender }) {
  txn = String(txn || '').trim(); sender = String(sender || '').trim();
  if (!txn || !sender) return { ok: false, error: 'въведи номер на транзакцията и име на изпращача' };
  const s = load(); s.activated = true; s.method = 'paypal'; s.txn = txn; s.sender = sender; s.date = new Date().toISOString(); save(s);
  try { const log = JSON.parse(fs.readFileSync(payLog(), 'utf8')); log.push({ txn, sender, date: s.date }); fs.writeFileSync(payLog(), JSON.stringify(log, null, 2)); }
  catch (_) { try { fs.writeFileSync(payLog(), JSON.stringify([{ txn, sender, date: s.date }], null, 2)); } catch (_) {} }
  return { ok: true };
}

module.exports = { CONFIG, recordUse, status, redeemCode, activatePaid };
