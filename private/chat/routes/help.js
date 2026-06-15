// Version: 1.0095
const express = require('express');
const fs = require('fs');
const path = require('path');
const Q = require('../queries').help; // набор заявки според CHAT_DB_TYPE (pg/sqlite)

const DAY_MS = 24 * 60 * 60 * 1000;
const DEDUCT_DAYS = 15; // спешният бутон отнема 15 дни от абонамента

// Цена на спешната помощ — от редактируемия ценови конфиг на чата (както месечната).
// Формат за показване: „$5 360₽ 438сом".
function emergencyPrice() {
  let s = { usd: 5, rub: 360, kgs: 438 };
  try {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'configs', 'prices-chat.json'), 'utf8'));
    const e = p && p.services && p.services.emergency;
    if (e && e.usd != null) s = e;
  } catch (e) { /* fallback по подразбиране */ }
  return { usd: s.usd, rub: s.rub, kgs: s.kgs, display: `$${s.usd} ${s.rub}₽ ${s.kgs}сом` };
}

// Брой дни, оставащи в абонамента (0 ако е изтекъл).
function daysLeftOf(paidUntil) {
  const ms = new Date(paidUntil).getTime() - Date.now();
  return ms > 0 ? ms / DAY_MS : 0;
}

function createHelpRoutes(db) {
  const router = express.Router();

  // Изпрати заявка за спешна помощ.
  // Логика (без плащане В МОМЕНТА — в спешност няма време за плащане):
  //   • има предплатена застраховка (emergency_active=1) → консумира я (не пипа абонамента);
  //   • иначе ≥15 дни абонамент → отнема 15 дни;
  //   • иначе (без застраховка И <15 дни) → 403 (бутонът трябва да е неактивен отпред).
  router.post('/emergency', async (req, res) => {
    try {
      const userId = req.user.id;
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Location coordinates required' });
      }

      const user = await db.prepare(Q.EMERGENCY_GET_USER).get(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Месечен брояч (1 използване на месец) — нулиране при нов месец.
      const now = new Date();
      const resetDate = new Date(user.help_button_reset_date);
      const monthsSince = (now.getFullYear() - resetDate.getFullYear()) * 12 +
                          (now.getMonth() - resetDate.getMonth());
      let helpUses = user.help_button_uses;
      let newResetDate = user.help_button_reset_date;
      if (monthsSince >= 1) { helpUses = 0; newResetDate = now.toISOString(); }

      if (helpUses >= 1) {
        return res.status(429).json({
          error: 'Emergency help button already used this month',
          message: 'Може да ползваш бутона веднъж месечно.',
          next_use_allowed: new Date(new Date(newResetDate).setMonth(new Date(newResetDate).getMonth() + 1)).toISOString()
        });
      }

      // Кой механизъм покрива ползването?
      const hasPrepaid = Number(user.emergency_active) === 1;
      const daysLeft = daysLeftOf(user.paid_until);
      const hasEnoughDays = daysLeft >= DEDUCT_DAYS;

      if (!hasPrepaid && !hasEnoughDays) {
        return res.status(403).json({
          error: 'emergency_unavailable',
          message: 'Бутонът е неактивен: нямаш предплатено за спешна помощ и оставащият абонамент е под 15 дни. Плати спешна помощ ($5) или поднови абонамента.'
        });
      }

      // Възраст от датата на раждане.
      let age = null;
      if (user.birth_date) {
        const b = new Date(user.birth_date);
        age = now.getFullYear() - b.getFullYear();
        const md = now.getMonth() - b.getMonth();
        if (md < 0 || (md === 0 && now.getDate() < b.getDate())) age--;
      }

      const price = emergencyPrice();

      // Запиши заявката (записваме номиналната стойност за справка на админа).
      const helpRequest = await db.prepare(Q.EMERGENCY_INSERT_REQUEST).run(
        user.id, user.phone, user.full_name, user.email, user.gender, age,
        user.country, user.city, user.street, null,
        latitude, longitude,
        price.usd, 'usd'
      );
      const requestId = helpRequest.lastInsertRowid != null ? helpRequest.lastInsertRowid : helpRequest.id;

      let method, newPaidUntil = user.paid_until, deductedDays = 0;
      if (hasPrepaid) {
        // Ползва предплатената застраховка — НЕ пипаме абонамента.
        method = 'prepaid';
        await db.prepare(Q.EMERGENCY_CONSUME_PREPAID).run(helpUses + 1, newResetDate, userId);
      } else {
        // Отнема 15 дни от абонамента.
        method = 'deduct';
        deductedDays = DEDUCT_DAYS;
        const pu = new Date(user.paid_until);
        pu.setDate(pu.getDate() - DEDUCT_DAYS);
        newPaidUntil = pu.toISOString();
        await db.prepare(Q.EMERGENCY_UPDATE_USER).run(newPaidUntil, helpUses + 1, newResetDate, userId);
      }

      res.json({
        success: true,
        request_id: requestId,
        message: 'Заявката за спешна помощ е изпратена до администратора.',
        method,                        // 'prepaid' | 'deduct'
        used_prepaid: method === 'prepaid',
        deducted_days: deductedDays,   // 15 при отнемане, 0 при застраховка
        price: price.display,
        new_paid_until: newPaidUntil,
        remaining_uses: 0,
        next_use_allowed: new Date(new Date(newResetDate).setMonth(new Date(newResetDate).getMonth() + 1)).toISOString()
      });

    } catch (err) {
      console.error('Emergency help error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get emergency contacts for user's country
  router.get('/emergency-contacts', async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's country
      const user = await db.prepare(Q.CONTACTS_GET_USER).get(userId);
      
      if (!user || !user.country_code) {
        return res.status(404).json({ error: 'Country not found in profile' });
      }
      
      // Get emergency contacts for this country
      const contacts = await db.prepare(Q.CONTACTS_GET_BY_COUNTRY).all(user.country_code);
      
      res.json({
        country: user.country,
        country_code: user.country_code,
        contacts: contacts
      });
      
    } catch (err) {
      console.error('Get emergency contacts error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Състояние на спешния бутон (за фронтенда).
  router.get('/availability', async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await db.prepare(Q.AVAILABILITY_GET_USER).get(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Месечен брояч.
      const now = new Date();
      const resetDate = new Date(user.help_button_reset_date);
      const monthsSince = (now.getFullYear() - resetDate.getFullYear()) * 12 +
                          (now.getMonth() - resetDate.getMonth());
      let helpUses = user.help_button_uses;
      if (monthsSince >= 1) helpUses = 0;
      const usedThisMonth = helpUses >= 1;

      const hasPrepaid = Number(user.emergency_active) === 1;
      const daysLeft = daysLeftOf(user.paid_until);
      const hasEnoughDays = daysLeft >= DEDUCT_DAYS;

      // Активен, ако има застраховка ИЛИ ≥15 дни абонамент, и не е ползван този месец.
      const available = (hasPrepaid || hasEnoughDays) && !usedThisMonth;
      // Кой механизъм ще покрие следващото ползване (застраховката е с приоритет).
      const method = hasPrepaid ? 'prepaid' : (hasEnoughDays ? 'deduct' : null);
      const price = emergencyPrice();

      res.json({
        available,
        has_prepaid: hasPrepaid,            // има ли предплатена застраховка
        days_left: Math.floor(daysLeft),    // оставащи дни в абонамента
        enough_days: hasEnoughDays,         // стигат ли за −15 дни
        used_this_month: usedThisMonth,
        max_uses_per_month: 1,
        remaining_uses: available ? 1 : 0,
        method,                             // 'prepaid' | 'deduct' | null
        deducts_days: DEDUCT_DAYS,
        price: price.display,               // „$5 360₽ 438сом"
        charge: { amount: price.usd, currency: 'usd', display: price.display, deducts_days: DEDUCT_DAYS },
        next_reset: monthsSince >= 1
          ? 'Available now'
          : new Date(new Date(resetDate).setMonth(new Date(resetDate).getMonth() + 1)).toISOString()
      });

    } catch (err) {
      console.error('Check help availability error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createHelpRoutes;
