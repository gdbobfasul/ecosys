// Version: 1.0056
const express = require('express');
const bcrypt = require('bcrypt');
const { validateOfferings, PUBLIC_OFFERING_SERVICES, SERVICE_CATEGORIES } = require('../utils/serviceCategories');

function createProfileRoutes(db) {
  const router = express.Router();

  // Get user profile
  router.get('/', (req, res) => {
    try {
      const userId = req.user.id;
      
      const user = db.prepare(`
        SELECT 
          id, phone, full_name, gender, birth_date, height_cm, weight_kg,
          country, city, village, street, workplace,
          email, code_word, current_need, offerings, is_verified,
          hide_phone, hide_names, paid_until, payment_amount, payment_currency,
          last_profile_update, profile_edits_this_month, profile_edit_reset_date,
          help_button_uses, help_button_reset_date,
          location_latitude, location_longitude
        FROM users WHERE id = ?
      `).get(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Hide sensitive data based on user settings
      if (user.hide_phone) {
        user.phone = user.phone.substring(0, 7) + '...';
      }
      
      if (user.hide_names) {
        const names = user.full_name.split(' ');
        user.full_name = names.map(n => n.substring(0, 4) + '...').join(' ');
      }
      
      // Don't send password hash
      delete user.password_hash;
      
      res.json(user);
    } catch (err) {
      console.error('Get profile error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update profile (limited to once per month for certain fields)
  router.put('/', (req, res) => {
    try {
      const userId = req.user.id;
      const { full_name, phone, birth_date, city, location_latitude, location_longitude, profile_photo_url, working_hours } = req.body;
      
      // Get current user data
      const user = db.prepare(`
        SELECT profile_edits_this_month, profile_edit_reset_date, is_static_object
        FROM users WHERE id = ?
      `).get(userId);
      
      // Static objects have restrictions - can only edit working_hours
      if (user.is_static_object) {
        if (working_hours !== undefined) {
          // Only allow working hours update for static objects
          db.prepare(`
            UPDATE users 
            SET working_hours = ?
            WHERE id = ?
          `).run(working_hours, userId);
          
          return res.json({ 
            success: true,
            message: 'Working hours updated'
          });
        } else {
          return res.status(403).json({ 
            error: 'Static objects can only update working hours. Contact admin to change other fields.' 
          });
        }
      }
      
      // Check if edit counter needs to be reset (monthly)
      const now = new Date();
      const resetDate = new Date(user.profile_edit_reset_date);
      const monthsSince = (now.getFullYear() - resetDate.getFullYear()) * 12 + 
                          (now.getMonth() - resetDate.getMonth());
      
      let editsThisMonth = user.profile_edits_this_month;
      let newResetDate = user.profile_edit_reset_date;
      
      if (monthsSince >= 1) {
        // Reset counter
        editsThisMonth = 0;
        newResetDate = now.toISOString();
      }
      
      // Check if user has exceeded monthly edit limit
      if (editsThisMonth >= 1) {
        return res.status(429).json({ 
          error: 'Profile can only be edited once per month',
          next_edit_allowed: new Date(new Date(newResetDate).setMonth(new Date(newResetDate).getMonth() + 1)).toISOString()
        });
      }
      
      // Validate phone format (international)
      if (phone && !phone.startsWith('+')) {
        return res.status(400).json({ 
          error: 'Phone must be in international format (e.g., +359888123456)' 
        });
      }
      
      // Update profile (normal users)
      db.prepare(`
        UPDATE users 
        SET 
          full_name = COALESCE(?, full_name),
          phone = COALESCE(?, phone),
          birth_date = COALESCE(?, birth_date),
          city = COALESCE(?, city),
          last_profile_update = datetime('now'),
          profile_edits_this_month = ?,
          profile_edit_reset_date = ?
        WHERE id = ?
      `).run(
        full_name || null,
        phone || null,
        birth_date || null,
        city || null,
        editsThisMonth + 1,
        newResetDate,
        userId
      );
      
      res.json({ 
        success: true,
        edits_remaining: 0,
        next_edit_allowed: new Date(new Date(newResetDate).setMonth(new Date(newResetDate).getMonth() + 1)).toISOString()
      });
      
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update password (unlimited)
  router.put('/password', async (req, res) => {
    try {
      const userId = req.user.id;
      const { current_password, new_password } = req.body;
      
      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current and new password required' });
      }
      
      // Get current password hash
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
      
      // Verify current password
      const validPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password
      const newHash = await bcrypt.hash(new_password, 10);
      
      // Update password
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update password error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update code word (unlimited)
  router.put('/code-word', (req, res) => {
    try {
      const userId = req.user.id;
      const { code_word } = req.body;
      
      if (!code_word || code_word.length < 3) {
        return res.status(400).json({ error: 'Code word must be at least 3 characters' });
      }
      
      db.prepare('UPDATE users SET code_word = ? WHERE id = ?').run(code_word, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update code word error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update current need (unlimited)
  router.put('/need', (req, res) => {
    try {
      const userId = req.user.id;
      const { current_need } = req.body;
      
      // Validate need
      if (current_need) {
        const { validateNeed } = require('../utils/serviceCategories');
        const validation = validateNeed(current_need);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }
      }
      
      db.prepare('UPDATE users SET current_need = ? WHERE id = ?').run(current_need || null, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update need error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update offerings (unlimited for non-verified users, forbidden for verified)
  router.put('/offerings', (req, res) => {
    try {
      const userId = req.user.id;
      const { offerings } = req.body;
      
      // Get user verification status
      const user = db.prepare('SELECT is_verified FROM users WHERE id = ?').get(userId);
      
      // Check if user is verified
      if (user.is_verified === 1) {
        return res.status(403).json({ 
          error: 'Verified profile. Offerings field is locked.',
          message: 'Contact admin@amschat.com to change your offerings',
          admin_email: 'admin@amschat.com'
        });
      }
      
      // Validate offerings (pass isVerified status)
      const validation = validateOfferings(offerings, user.is_verified === 1);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      db.prepare('UPDATE users SET offerings = ? WHERE id = ?').run(offerings || null, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update offerings error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update email (unlimited)
  router.put('/email', (req, res) => {
    try {
      const userId = req.user.id;
      const { email } = req.body;
      
      // Basic email validation
      if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update email error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Toggle hide phone
  router.put('/hide-phone', (req, res) => {
    try {
      const userId = req.user.id;
      const { hide_phone } = req.body;
      
      db.prepare('UPDATE users SET hide_phone = ? WHERE id = ?').run(hide_phone ? 1 : 0, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Toggle hide phone error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Toggle hide names
  router.put('/hide-names', (req, res) => {
    try {
      const userId = req.user.id;
      const { hide_names } = req.body;
      
      db.prepare('UPDATE users SET hide_names = ? WHERE id = ?').run(hide_names ? 1 : 0, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Toggle hide names error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get service categories (for dropdowns)
  router.get('/service-categories', (req, res) => {
    res.json({
      all: SERVICE_CATEGORIES,
      public_offerings: PUBLIC_OFFERING_SERVICES
    });
  });

  return router;
}

module.exports = createProfileRoutes;
