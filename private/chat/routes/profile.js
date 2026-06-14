// Version: 1.0093
const express = require('express');
const bcrypt = require('bcrypt');
const { validateOfferings, PUBLIC_OFFERING_SERVICES, SERVICE_CATEGORIES } = require('../utils/serviceCategories');
const Q = require('../queries').profile; // набор заявки според CHAT_DB_TYPE (pg/sqlite)
const { logActionError } = require('../utils/actionLog');

function createProfileRoutes(db) {
  const router = express.Router();

  // Get user profile
  router.get('/', async (req, res) => {
    try {
      const userId = req.user.id;
      
      const user = await db.prepare(Q.GET_PROFILE).get(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Hide sensitive data based on user settings
      if (user.hide_phone && user.phone) {
        user.phone = user.phone.substring(0, 7) + '...';
      }

      if (user.hide_names && user.full_name) {
        const names = user.full_name.split(' ');
        user.full_name = names.map(n => n.substring(0, 4) + '...').join(' ');
      }
      
      // Don't send password hash
      delete user.password_hash;
      
      res.json(user);
    } catch (err) {
      logActionError('Зареждане на профил (GET /api/profile)', err, { userId: req.user && req.user.id });
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update profile (limited to once per month for certain fields)
  router.put('/', async (req, res) => {
    try {
      const userId = req.user.id;
      const { full_name, phone, birth_date, city, location_latitude, location_longitude, profile_photo_url, working_hours } = req.body;
      
      // Get current user data
      const user = await db.prepare(Q.PUT_GET_CURRENT).get(userId);
      
      // Static objects have restrictions - can only edit working_hours
      if (user.is_static_object) {
        if (working_hours !== undefined) {
          // Only allow working hours update for static objects
          await db.prepare(Q.PUT_UPDATE_WORKING_HOURS).run(working_hours, userId);
          
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
      await db.prepare(Q.PUT_UPDATE_PROFILE).run(
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
      const user = await db.prepare(Q.GET_PASSWORD_HASH).get(userId);
      
      // Verify current password
      const validPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password
      const newHash = await bcrypt.hash(new_password, 10);
      
      // Update password
      await db.prepare(Q.UPDATE_PASSWORD).run(newHash, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update password error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update code word (unlimited)
  router.put('/code-word', async (req, res) => {
    try {
      const userId = req.user.id;
      const { code_word } = req.body;
      
      if (!code_word || code_word.length < 3) {
        return res.status(400).json({ error: 'Code word must be at least 3 characters' });
      }
      
      await db.prepare(Q.UPDATE_CODE_WORD).run(code_word, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update code word error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update current need (unlimited)
  router.put('/need', async (req, res) => {
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
      
      await db.prepare(Q.UPDATE_NEED).run(current_need || null, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update need error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update offerings (unlimited for non-verified users, forbidden for verified)
  router.put('/offerings', async (req, res) => {
    try {
      const userId = req.user.id;
      const { offerings } = req.body;
      
      // Get user verification status
      const user = await db.prepare(Q.GET_IS_VERIFIED).get(userId);
      
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
      
      await db.prepare(Q.UPDATE_OFFERINGS).run(offerings || null, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update offerings error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update email (unlimited)
  router.put('/email', async (req, res) => {
    try {
      const userId = req.user.id;
      const { email } = req.body;
      
      // Basic email validation
      if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      await db.prepare(Q.UPDATE_EMAIL).run(email || null, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update email error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Toggle hide phone
  router.put('/hide-phone', async (req, res) => {
    try {
      const userId = req.user.id;
      const { hide_phone } = req.body;
      
      await db.prepare(Q.UPDATE_HIDE_PHONE).run(hide_phone ? 1 : 0, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Toggle hide phone error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Toggle hide names
  router.put('/hide-names', async (req, res) => {
    try {
      const userId = req.user.id;
      const { hide_names } = req.body;
      
      await db.prepare(Q.UPDATE_HIDE_NAMES).run(hide_names ? 1 : 0, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Toggle hide names error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get service categories (for dropdowns)
  router.get('/service-categories', async (req, res) => {
    res.json({
      all: SERVICE_CATEGORIES,
      public_offerings: PUBLIC_OFFERING_SERVICES
    });
  });

  return router;
}

module.exports = createProfileRoutes;
