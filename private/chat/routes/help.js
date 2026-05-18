// Version: 1.0056
const express = require('express');

function createHelpRoutes(db) {
  const router = express.Router();

  // Send emergency help request
  router.post('/emergency', async (req, res) => {
    try {
      const userId = req.user.id;
      const { latitude, longitude } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Location coordinates required' });
      }
      
      // Get user data
      const user = db.prepare(`
        SELECT 
          id, phone, full_name, email, gender, birth_date,
          country, city, street, 
          paid_until, payment_amount, payment_currency,
          help_button_uses, help_button_reset_date
        FROM users WHERE id = ?
      `).get(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if user has paid subscription
      if (new Date(user.paid_until) <= new Date()) {
        return res.status(403).json({ 
          error: 'Active subscription required to use emergency help button',
          message: 'Please renew your subscription first'
        });
      }
      
      // Check if help button counter needs to be reset (monthly)
      const now = new Date();
      const resetDate = new Date(user.help_button_reset_date);
      const monthsSince = (now.getFullYear() - resetDate.getFullYear()) * 12 + 
                          (now.getMonth() - resetDate.getMonth());
      
      let helpUses = user.help_button_uses;
      let newResetDate = user.help_button_reset_date;
      
      if (monthsSince >= 1) {
        // Reset counter
        helpUses = 0;
        newResetDate = now.toISOString();
      }
      
      // Check if user has exceeded monthly limit (1 use per month)
      if (helpUses >= 1) {
        return res.status(429).json({ 
          error: 'Emergency help button already used this month',
          message: 'You can use this button once per month',
          next_use_allowed: new Date(new Date(newResetDate).setMonth(new Date(newResetDate).getMonth() + 1)).toISOString()
        });
      }
      
      // Calculate charge amount (10x normal subscription)
      const chargeAmount = user.payment_amount * 10; // €50 or $50
      const chargeCurrency = user.payment_currency;
      
      // Calculate age from birth_date
      let age = null;
      if (user.birth_date) {
        const birthDate = new Date(user.birth_date);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
      
      // Get reverse geocoding info (street address from coordinates)
      // This would normally use a geocoding API, but for now we'll use what we have
      const streetAddress = user.street || 'Unknown';
      
      // Create help request
      const helpRequest = db.prepare(`
        INSERT INTO help_requests (
          user_id, phone, full_name, email, gender, age,
          country, city, street, street_number,
          latitude, longitude,
          charge_amount, charge_currency
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.phone,
        user.full_name,
        user.email,
        user.gender,
        age,
        user.country,
        user.city,
        user.street,
        null, // street_number will be extracted if available
        latitude,
        longitude,
        chargeAmount,
        chargeCurrency
      );
      
      // Deduct half month from subscription (charge for emergency use)
      const paidUntil = new Date(user.paid_until);
      paidUntil.setDate(paidUntil.getDate() - 15); // Subtract 15 days
      
      // Update user record
      db.prepare(`
        UPDATE users 
        SET 
          paid_until = ?,
          help_button_uses = ?,
          help_button_reset_date = ?
        WHERE id = ?
      `).run(
        paidUntil.toISOString(),
        helpUses + 1,
        newResetDate,
        userId
      );
      
      res.json({
        success: true,
        request_id: helpRequest.lastInsertRowid,
        message: 'Emergency help request sent to administrator',
        charge: {
          amount: chargeAmount,
          currency: chargeCurrency,
          deducted_days: 15
        },
        new_paid_until: paidUntil.toISOString(),
        remaining_uses: 0,
        next_use_allowed: new Date(new Date(newResetDate).setMonth(new Date(newResetDate).getMonth() + 1)).toISOString()
      });
      
    } catch (err) {
      console.error('Emergency help error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get emergency contacts for user's country
  router.get('/emergency-contacts', (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's country
      const user = db.prepare('SELECT country_code, country FROM users WHERE id = ?').get(userId);
      
      if (!user || !user.country_code) {
        return res.status(404).json({ error: 'Country not found in profile' });
      }
      
      // Get emergency contacts for this country
      const contacts = db.prepare(`
        SELECT 
          service_type, service_name, 
          phone_international, phone_local,
          email, address, city
        FROM emergency_contacts
        WHERE country_code = ? AND is_active = 1
        ORDER BY 
          CASE service_type
            WHEN 'emergency' THEN 1
            WHEN 'ambulance' THEN 2
            WHEN 'police' THEN 3
            WHEN 'fire' THEN 4
            WHEN 'hospital' THEN 5
            ELSE 6
          END
      `).all(user.country_code);
      
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

  // Check help button availability
  router.get('/availability', (req, res) => {
    try {
      const userId = req.user.id;
      
      const user = db.prepare(`
        SELECT 
          help_button_uses, help_button_reset_date, 
          paid_until, payment_amount, payment_currency
        FROM users WHERE id = ?
      `).get(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check subscription
      const hasSubscription = new Date(user.paid_until) > new Date();
      
      // Check monthly counter
      const now = new Date();
      const resetDate = new Date(user.help_button_reset_date);
      const monthsSince = (now.getFullYear() - resetDate.getFullYear()) * 12 + 
                          (now.getMonth() - resetDate.getMonth());
      
      let helpUses = user.help_button_uses;
      if (monthsSince >= 1) {
        helpUses = 0; // Would be reset on next use
      }
      
      const available = hasSubscription && helpUses < 1;
      const chargeAmount = user.payment_amount * 10;
      
      res.json({
        available: available,
        has_subscription: hasSubscription,
        uses_this_month: helpUses,
        max_uses_per_month: 1,
        remaining_uses: available ? 1 : 0,
        charge: {
          amount: chargeAmount,
          currency: user.payment_currency,
          deducts_days: 15
        },
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
