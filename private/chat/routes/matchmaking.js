// Version: 1.0077
// Matchmaking Routes - AI-powered partner matching
// Auth middleware is applied at mount point (server.js / test setup)
const express = require('express');

function createMatchmakingRoutes(db) {
  const router = express.Router();

  // ================================================================
  // SAVE CRITERIA - Save user's 50 criteria
  // POST /api/matchmaking/criteria
  // ================================================================
  router.post('/criteria', async (req, res) => {
    try {
      const userId = req.userId;
      const criteria = req.body;

      // Check if user already has criteria
      const existing = db.prepare(
        'SELECT id FROM matchmaking_criteria WHERE user_id = ?'
      ).get(userId);

      if (existing) {
        // Update existing criteria
        const updateStmt = db.prepare(`
          UPDATE matchmaking_criteria SET
            height_min = ?, height_max = ?, weight_min = ?, weight_max = ?,
            age_min = ?, age_max = ?, hair_color = ?, eye_color = ?,
            body_type = ?, ethnicity = ?, smoking = ?, drinking = ?,
            diet = ?, exercise = ?, pets = ?, children = ?,
            living_situation = ?, employment = ?, education = ?, religion = ?,
            personality = ?, interests = ?, music_taste = ?, movies_taste = ?,
            hobbies = ?, political_views = ?, travel_frequency = ?,
            night_owl_or_early_bird = ?, introvert_or_extrovert = ?,
            communication_style = ?, conflict_resolution = ?, love_language = ?,
            humor_type = ?, relationship_goals = ?, deal_breakers = ?,
            country = ?, city = ?, distance_km = ?, willing_to_relocate = ?,
            language_spoken = ?, income_range = ?, financial_goals = ?,
            car_ownership = ?, tech_savviness = ?, social_media_usage = ?,
            family_values = ?, jealousy_level = ?, independence_level = ?,
            future_plans = ?, commitment_level = ?,
            updated_at = datetime('now')
          WHERE user_id = ?
        `);

        updateStmt.run(
          criteria.height_min, criteria.height_max, criteria.weight_min, criteria.weight_max,
          criteria.age_min, criteria.age_max, criteria.hair_color, criteria.eye_color,
          criteria.body_type, criteria.ethnicity, criteria.smoking, criteria.drinking,
          criteria.diet, criteria.exercise, criteria.pets, criteria.children,
          criteria.living_situation, criteria.employment, criteria.education, criteria.religion,
          criteria.personality, criteria.interests, criteria.music_taste, criteria.movies_taste,
          criteria.hobbies, criteria.political_views, criteria.travel_frequency,
          criteria.night_owl_or_early_bird, criteria.introvert_or_extrovert,
          criteria.communication_style, criteria.conflict_resolution, criteria.love_language,
          criteria.humor_type, criteria.relationship_goals, criteria.deal_breakers,
          criteria.country, criteria.city, criteria.distance_km, criteria.willing_to_relocate,
          criteria.language_spoken, criteria.income_range, criteria.financial_goals,
          criteria.car_ownership, criteria.tech_savviness, criteria.social_media_usage,
          criteria.family_values, criteria.jealousy_level, criteria.independence_level,
          criteria.future_plans, criteria.commitment_level,
          userId
        );

        res.json({ success: true, message: 'Criteria updated successfully' });
      } else {
        // Insert new criteria
        const insertStmt = db.prepare(`
          INSERT INTO matchmaking_criteria (
            user_id, height_min, height_max, weight_min, weight_max,
            age_min, age_max, hair_color, eye_color, body_type, ethnicity,
            smoking, drinking, diet, exercise, pets, children,
            living_situation, employment, education, religion,
            personality, interests, music_taste, movies_taste, hobbies,
            political_views, travel_frequency, night_owl_or_early_bird,
            introvert_or_extrovert, communication_style, conflict_resolution,
            love_language, humor_type, relationship_goals, deal_breakers,
            country, city, distance_km, willing_to_relocate, language_spoken,
            income_range, financial_goals, car_ownership, tech_savviness,
            social_media_usage, family_values, jealousy_level,
            independence_level, future_plans, commitment_level
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
          userId,
          criteria.height_min, criteria.height_max, criteria.weight_min, criteria.weight_max,
          criteria.age_min, criteria.age_max, criteria.hair_color, criteria.eye_color,
          criteria.body_type, criteria.ethnicity, criteria.smoking, criteria.drinking,
          criteria.diet, criteria.exercise, criteria.pets, criteria.children,
          criteria.living_situation, criteria.employment, criteria.education, criteria.religion,
          criteria.personality, criteria.interests, criteria.music_taste, criteria.movies_taste,
          criteria.hobbies, criteria.political_views, criteria.travel_frequency,
          criteria.night_owl_or_early_bird, criteria.introvert_or_extrovert,
          criteria.communication_style, criteria.conflict_resolution, criteria.love_language,
          criteria.humor_type, criteria.relationship_goals, criteria.deal_breakers,
          criteria.country, criteria.city, criteria.distance_km, criteria.willing_to_relocate,
          criteria.language_spoken, criteria.income_range, criteria.financial_goals,
          criteria.car_ownership, criteria.tech_savviness, criteria.social_media_usage,
          criteria.family_values, criteria.jealousy_level, criteria.independence_level,
          criteria.future_plans, criteria.commitment_level
        );

        res.json({ success: true, message: 'Criteria saved successfully' });
      }
    } catch (error) {
      console.error('Save criteria error:', error);
      res.status(500).json({ error: 'Failed to save criteria' });
    }
  });

  // ================================================================
  // GET CRITERIA - Get user's saved criteria
  // GET /api/matchmaking/criteria
  // ================================================================
  router.get('/criteria', async (req, res) => {
    try {
      const userId = req.userId;

      const criteria = db.prepare(
        'SELECT * FROM matchmaking_criteria WHERE user_id = ?'
      ).get(userId);

      if (!criteria) {
        return res.json({ hasCriteria: false, criteria: null });
      }

      res.json({ hasCriteria: true, criteria });
    } catch (error) {
      console.error('Get criteria error:', error);
      res.status(500).json({ error: 'Failed to get criteria' });
    }
  });

  // ================================================================
  // FIND MATCHES - Find matches based on criteria ($5 charge)
  // POST /api/matchmaking/find
  // ================================================================
  router.post('/find', async (req, res) => {
    try {
      const userId = req.userId;

      // Get user's payment info
      const user = db.prepare(
        'SELECT payment_amount, payment_currency, paid_until FROM users WHERE id = ?'
      ).get(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user has active subscription
      const now = new Date();
      const paidUntil = new Date(user.paid_until);
      if (paidUntil < now) {
        return res.status(402).json({ 
          error: 'Subscription expired',
          message: 'Your subscription has expired. Please renew to use matchmaking.'
        });
      }

      // Search cost is $5 or €5
      const searchCost = 5.0;
      
      // Check if user has enough balance
      if (user.payment_amount < searchCost) {
        return res.status(402).json({ 
          error: 'Insufficient balance',
          message: `You need at least ${searchCost} ${user.payment_currency} to search. Your balance: ${user.payment_amount} ${user.payment_currency}`,
          required: searchCost,
          current: user.payment_amount,
          currency: user.payment_currency
        });
      }

      // Get user's criteria
      const criteria = db.prepare(
        'SELECT * FROM matchmaking_criteria WHERE user_id = ?'
      ).get(userId);

      if (!criteria) {
        return res.status(400).json({ 
          error: 'No criteria set',
          message: 'Please set your criteria first before searching'
        });
      }

      // Get user's dislikes
      const dislikes = db.prepare(
        'SELECT disliked_attribute, disliked_value FROM matchmaking_dislikes WHERE user_id = ?'
      ).all(userId);

      // Get blocked users
      const blockedUsers = db.prepare(`
        SELECT blocked_id FROM matchmaking_blocks WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM matchmaking_blocks WHERE blocked_id = ?
      `).all(userId, userId).map(row => row.blocked_id || row.blocker_id);

      // Build SQL query for matching
      // This is simplified - in production, you'd use AI/ML for better matching
      let query = `
        SELECT DISTINCT u.id, u.full_name, u.age, u.gender, u.height_cm, u.weight_kg,
               u.city, u.country
        FROM users u
        LEFT JOIN matchmaking_criteria mc ON u.id = mc.user_id
        WHERE u.id != ?
      `;

      const params = [userId];

      // Exclude blocked users
      if (blockedUsers.length > 0) {
        query += ` AND u.id NOT IN (${blockedUsers.map(() => '?').join(',')})`;
        params.push(...blockedUsers);
      }

      // Age range
      if (criteria.age_min) {
        query += ` AND u.age >= ?`;
        params.push(criteria.age_min);
      }
      if (criteria.age_max) {
        query += ` AND u.age <= ?`;
        params.push(criteria.age_max);
      }

      // Height range
      if (criteria.height_min) {
        query += ` AND u.height_cm >= ?`;
        params.push(criteria.height_min);
      }
      if (criteria.height_max) {
        query += ` AND u.height_cm <= ?`;
        params.push(criteria.height_max);
      }

      // Weight range
      if (criteria.weight_min) {
        query += ` AND u.weight_kg >= ?`;
        params.push(criteria.weight_min);
      }
      if (criteria.weight_max) {
        query += ` AND u.weight_kg <= ?`;
        params.push(criteria.weight_max);
      }

      // Location
      if (criteria.country && criteria.country !== 'no-preference') {
        query += ` AND u.country = ?`;
        params.push(criteria.country);
      }
      if (criteria.city && criteria.city !== 'no-preference') {
        query += ` AND u.city = ?`;
        params.push(criteria.city);
      }

      // Apply dislikes filter
      for (const dislike of dislikes) {
        // This is simplified - in production you'd have a more sophisticated system
        if (dislike.disliked_attribute === 'height_cm') {
          query += ` AND u.height_cm != ?`;
          params.push(parseInt(dislike.disliked_value));
        } else if (dislike.disliked_attribute === 'age') {
          query += ` AND u.age != ?`;
          params.push(parseInt(dislike.disliked_value));
        }
        // Add more dislike filters as needed
      }

      query += ` ORDER BY RANDOM() LIMIT 5`;

      // Execute search
      const matches = db.prepare(query).all(...params);

      // Deduct $5 from user's balance
      db.prepare(
        'UPDATE users SET payment_amount = payment_amount - ? WHERE id = ?'
      ).run(searchCost, userId);

      // Log the search
      db.prepare(`
        INSERT INTO matchmaking_searches (user_id, search_cost, currency, results_count)
        VALUES (?, ?, ?, ?)
      `).run(userId, searchCost, user.payment_currency, matches.length);

      // Get updated balance
      const updatedUser = db.prepare(
        'SELECT payment_amount FROM users WHERE id = ?'
      ).get(userId);

      res.json({
        success: true,
        matches,
        charged: searchCost,
        currency: user.payment_currency,
        newBalance: updatedUser.payment_amount,
        message: `Search completed. ${searchCost} ${user.payment_currency} deducted from your balance.`
      });

    } catch (error) {
      console.error('Find matches error:', error);
      res.status(500).json({ error: 'Failed to find matches' });
    }
  });

  // ================================================================
  // SEND INVITATION - Send chat invitation to a match
  // POST /api/matchmaking/invite
  // ================================================================
  router.post('/invite', async (req, res) => {
    try {
      const senderId = req.userId;
      const { receiverId } = req.body;

      if (!receiverId) {
        return res.status(400).json({ error: 'Receiver ID required' });
      }

      // Check if receiver exists
      const receiver = db.prepare('SELECT id FROM users WHERE id = ?').get(receiverId);
      if (!receiver) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already invited
      const existing = db.prepare(
        'SELECT id FROM matchmaking_invitations WHERE sender_id = ? AND receiver_id = ?'
      ).get(senderId, receiverId);

      if (existing) {
        return res.status(400).json({ error: 'Invitation already sent' });
      }

      // Check if blocked
      const blocked = db.prepare(`
        SELECT id FROM matchmaking_blocks 
        WHERE (blocker_id = ? AND blocked_id = ?) 
           OR (blocker_id = ? AND blocked_id = ?)
      `).get(senderId, receiverId, receiverId, senderId);

      if (blocked) {
        return res.status(403).json({ error: 'Cannot invite this user' });
      }

      // Create invitation
      db.prepare(`
        INSERT INTO matchmaking_invitations (sender_id, receiver_id, status)
        VALUES (?, ?, 'pending')
      `).run(senderId, receiverId);

      res.json({ 
        success: true, 
        message: 'Invitation sent successfully' 
      });

    } catch (error) {
      console.error('Send invitation error:', error);
      res.status(500).json({ error: 'Failed to send invitation' });
    }
  });

  // ================================================================
  // GET RECEIVED INVITATIONS - Get invitations sent to this user
  // GET /api/matchmaking/invitations/received
  // ================================================================
  router.get('/invitations/received', async (req, res) => {
    try {
      const userId = req.userId;

      // Get user's criteria to filter out mismatches based on dislikes
      const dislikes = db.prepare(
        'SELECT disliked_attribute, disliked_value FROM matchmaking_dislikes WHERE user_id = ?'
      ).all(userId);

      // Get all pending invitations with sender details
      let invitations = db.prepare(`
        SELECT 
          i.id, i.sender_id, i.created_at,
          u.full_name, u.age, u.gender, u.height_cm, u.weight_kg,
          u.city, u.country,
          mc.*
        FROM matchmaking_invitations i
        JOIN users u ON i.sender_id = u.id
        LEFT JOIN matchmaking_criteria mc ON u.id = mc.user_id
        WHERE i.receiver_id = ? AND i.status = 'pending'
        ORDER BY i.created_at DESC
        LIMIT 50
      `).all(userId);

      // Filter out users that match dislikes
      invitations = invitations.filter(inv => {
        for (const dislike of dislikes) {
          if (dislike.disliked_attribute === 'height_cm' && inv.height_cm === parseInt(dislike.disliked_value)) {
            return false;
          }
          if (dislike.disliked_attribute === 'age' && inv.age === parseInt(dislike.disliked_value)) {
            return false;
          }
          // Add more dislike filters
        }
        return true;
      });

      res.json({ 
        success: true, 
        invitations,
        count: invitations.length
      });

    } catch (error) {
      console.error('Get invitations error:', error);
      res.status(500).json({ error: 'Failed to get invitations' });
    }
  });

  // ================================================================
  // GET SENT INVITATIONS - Get invitations sent by this user
  // GET /api/matchmaking/invitations/sent
  // ================================================================
  router.get('/invitations/sent', async (req, res) => {
    try {
      const userId = req.userId;

      const invitations = db.prepare(`
        SELECT 
          i.id, i.receiver_id, i.status, i.created_at, i.responded_at,
          u.full_name, u.age, u.city
        FROM matchmaking_invitations i
        JOIN users u ON i.receiver_id = u.id
        WHERE i.sender_id = ?
        ORDER BY i.created_at DESC
      `).all(userId);

      res.json({ 
        success: true, 
        invitations,
        count: invitations.length
      });

    } catch (error) {
      console.error('Get sent invitations error:', error);
      res.status(500).json({ error: 'Failed to get sent invitations' });
    }
  });

  // ================================================================
  // ACCEPT INVITATION - Accept a chat invitation
  // POST /api/matchmaking/invitations/:id/accept
  // ================================================================
  router.post('/invitations/:id/accept', async (req, res) => {
    try {
      const userId = req.userId;
      const invitationId = req.params.id;

      // Get invitation
      const invitation = db.prepare(
        'SELECT * FROM matchmaking_invitations WHERE id = ? AND receiver_id = ?'
      ).get(invitationId, userId);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: 'Invitation already processed' });
      }

      // Update invitation status
      db.prepare(`
        UPDATE matchmaking_invitations 
        SET status = 'accepted', responded_at = datetime('now')
        WHERE id = ?
      `).run(invitationId);

      // Add to friends (so they can chat)
      // Check if friendship already exists
      const existingFriend = db.prepare(
        'SELECT id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
      ).get(userId, invitation.sender_id, invitation.sender_id, userId);

      if (!existingFriend) {
        db.prepare(
          'INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)'
        ).run(userId, invitation.sender_id, 'accepted');
      }

      res.json({ 
        success: true, 
        message: 'Invitation accepted. You can now chat!',
        friendId: invitation.sender_id
      });

    } catch (error) {
      console.error('Accept invitation error:', error);
      res.status(500).json({ error: 'Failed to accept invitation' });
    }
  });

  // ================================================================
  // BLOCK USER - Block a user and specify what you didn't like
  // POST /api/matchmaking/block
  // ================================================================
  router.post('/block', async (req, res) => {
    try {
      const blockerId = req.userId;
      const { blockedId, dislikes } = req.body;

      if (!blockedId) {
        return res.status(400).json({ error: 'Blocked user ID required' });
      }

      // Check if already blocked
      const existing = db.prepare(
        'SELECT id FROM matchmaking_blocks WHERE blocker_id = ? AND blocked_id = ?'
      ).get(blockerId, blockedId);

      if (existing) {
        return res.status(400).json({ error: 'User already blocked' });
      }

      // Create block
      db.prepare(`
        INSERT INTO matchmaking_blocks (blocker_id, blocked_id)
        VALUES (?, ?)
      `).run(blockerId, blockedId);

      // Save dislikes if provided
      if (dislikes && Array.isArray(dislikes)) {
        const stmt = db.prepare(`
          INSERT INTO matchmaking_dislikes (user_id, disliked_attribute, disliked_value)
          VALUES (?, ?, ?)
        `);

        for (const dislike of dislikes) {
          // Check dislike count limit (500 max)
          const count = db.prepare(
            'SELECT COUNT(*) as count FROM matchmaking_dislikes WHERE user_id = ?'
          ).get(blockerId);

          if (count.count >= 500) {
            break; // Stop adding if limit reached
          }

          stmt.run(blockerId, dislike.field, dislike.value);
        }
      }

      // Update any pending invitations to blocked status
      db.prepare(`
        UPDATE matchmaking_invitations 
        SET status = 'blocked', responded_at = datetime('now')
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      `).run(blockerId, blockedId, blockedId, blockerId);

      res.json({ 
        success: true, 
        message: 'User blocked successfully',
        dislikesSaved: dislikes ? dislikes.length : 0
      });

    } catch (error) {
      console.error('Block user error:', error);
      res.status(500).json({ error: 'Failed to block user' });
    }
  });

  // ================================================================
  // GET DISLIKES - Get user's learned dislikes
  // GET /api/matchmaking/dislikes
  // ================================================================
  router.get('/dislikes', async (req, res) => {
    try {
      const userId = req.userId;

      const dislikes = db.prepare(`
        SELECT disliked_attribute, disliked_value, COUNT(*) as count
        FROM matchmaking_dislikes
        WHERE user_id = ?
        GROUP BY disliked_attribute, disliked_value
        ORDER BY count DESC
      `).all(userId);

      const total = db.prepare(
        'SELECT COUNT(*) as count FROM matchmaking_dislikes WHERE user_id = ?'
      ).get(userId);

      res.json({ 
        success: true, 
        dislikes,
        totalCount: total.count,
        limit: 500
      });

    } catch (error) {
      console.error('Get dislikes error:', error);
      res.status(500).json({ error: 'Failed to get dislikes' });
    }
  });

  // ================================================================
  // ADMIN: CHECK MATCHES - Admin checks matches for any user (FREE)
  // POST /api/matchmaking/admin/check
  // ================================================================
  router.post('/admin/check', async (req, res) => {
    try {
      // Check if user is admin
      const adminUser = db.prepare(
        'SELECT is_admin FROM users WHERE id = ?'
      ).get(req.userId);

      if (!adminUser || !adminUser.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      // Get user's criteria
      const criteria = db.prepare(
        'SELECT * FROM matchmaking_criteria WHERE user_id = ?'
      ).get(userId);

      if (!criteria) {
        return res.status(404).json({ 
          error: 'No criteria found for this user'
        });
      }

      // Get user's dislikes
      const dislikes = db.prepare(
        'SELECT disliked_attribute, disliked_value FROM matchmaking_dislikes WHERE user_id = ?'
      ).all(userId);

      // Run same matching algorithm as regular search but FREE
      const blockedUsers = db.prepare(`
        SELECT blocked_id FROM matchmaking_blocks WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM matchmaking_blocks WHERE blocked_id = ?
      `).all(userId, userId).map(row => row.blocked_id || row.blocker_id);

      let query = `
        SELECT DISTINCT u.id, u.full_name, u.age, u.gender, u.height_cm, u.weight_kg,
               u.city, u.country
        FROM users u
        WHERE u.id != ?
      `;

      const params = [userId];

      if (blockedUsers.length > 0) {
        query += ` AND u.id NOT IN (${blockedUsers.map(() => '?').join(',')})`;
        params.push(...blockedUsers);
      }

      if (criteria.age_min) {
        query += ` AND u.age >= ?`;
        params.push(criteria.age_min);
      }
      if (criteria.age_max) {
        query += ` AND u.age <= ?`;
        params.push(criteria.age_max);
      }

      query += ` ORDER BY RANDOM() LIMIT 50`;

      const matches = db.prepare(query).all(...params);

      res.json({
        success: true,
        userId,
        criteria,
        dislikes,
        matches,
        matchCount: matches.length,
        note: 'Admin check - no charge applied'
      });

    } catch (error) {
      console.error('Admin check error:', error);
      res.status(500).json({ error: 'Failed to check matches' });
    }
  });

  return router;
}

module.exports = createMatchmakingRoutes;
