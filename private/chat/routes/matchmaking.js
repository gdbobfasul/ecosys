// Version: 1.0094
// Matchmaking Routes - AI-powered partner matching
// Auth middleware is applied at mount point (server.js / test setup)
const express = require('express');
const Q = require('../queries').matchmaking; // набор заявки според CHAT_DB_TYPE (pg/sqlite)

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
      const existing = await db.prepare(Q.CRITERIA_FIND_BY_USER).get(userId);

      if (existing) {
        // Update existing criteria
        const updateStmt = await db.prepare(Q.CRITERIA_UPDATE);

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
        const insertStmt = await db.prepare(Q.CRITERIA_INSERT);

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

      const criteria = await db.prepare(Q.CRITERIA_GET).get(userId);

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
      const user = await db.prepare(Q.FIND_USER_PAYMENT).get(userId);

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
      const criteria = await db.prepare(Q.CRITERIA_GET).get(userId);

      if (!criteria) {
        return res.status(400).json({
          error: 'No criteria set',
          message: 'Please set your criteria first before searching'
        });
      }

      // Get user's dislikes
      const dislikes = await db.prepare(Q.FIND_DISLIKES).all(userId);

      // Get blocked users
      const blockedUsers = (await db.prepare(Q.FIND_BLOCKED).all(userId, userId)).map(row => row.blocked_id || row.blocker_id);

      // Build SQL query for matching (динамичен builder → { sql, params })
      // This is simplified - in production, you'd use AI/ML for better matching
      const { sql: query, params } = Q.FIND_MATCHES(userId, blockedUsers, criteria, dislikes);

      // Execute search
      const matches = await db.prepare(query).all(...params);

      // Deduct $5 from user's balance
      await db.prepare(Q.DEDUCT_BALANCE).run(searchCost, userId);

      // Log the search (matchmaking_searches има само user_id, amount_charged, matches_found)
      await db.prepare(Q.INSERT_SEARCH).run(userId, searchCost, matches.length);

      // Get updated balance
      const updatedUser = await db.prepare(Q.GET_BALANCE).get(userId);

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
      const receiver = await db.prepare(Q.INVITE_FIND_RECEIVER).get(receiverId);
      if (!receiver) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already invited
      const existing = await db.prepare(Q.INVITE_FIND_EXISTING).get(senderId, receiverId);

      if (existing) {
        return res.status(400).json({ error: 'Invitation already sent' });
      }

      // Check if blocked
      const blocked = await db.prepare(Q.INVITE_CHECK_BLOCKED).get(senderId, receiverId, receiverId, senderId);

      if (blocked) {
        return res.status(403).json({ error: 'Cannot invite this user' });
      }

      // Create invitation
      await db.prepare(Q.INVITE_INSERT).run(senderId, receiverId);

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
      const dislikes = await db.prepare(Q.FIND_DISLIKES).all(userId);

      // Get all pending invitations with sender details
      let invitations = await db.prepare(Q.INVITATIONS_RECEIVED).all(userId);

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

      const invitations = await db.prepare(Q.INVITATIONS_SENT).all(userId);

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
      const invitation = await db.prepare(Q.INVITATION_GET).get(invitationId, userId);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: 'Invitation already processed' });
      }

      // Update invitation status
      await db.prepare(Q.INVITATION_ACCEPT).run(invitationId);

      // Add to friends (so they can chat). friends е с подреден числов ключ
      // (user_id1 < user_id2) — подреждаме двойката както прави routes/friends.js.
      const a = Number(userId);
      const b = Number(invitation.sender_id);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);

      const existingFriend = await db.prepare(Q.FRIEND_FIND_EXISTING).get(lo, hi);

      if (!existingFriend) {
        await db.prepare(Q.FRIEND_INSERT).run(lo, hi);
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
      const existing = await db.prepare(Q.BLOCK_FIND_EXISTING).get(blockerId, blockedId);

      if (existing) {
        return res.status(400).json({ error: 'User already blocked' });
      }

      // Create block
      await db.prepare(Q.BLOCK_INSERT).run(blockerId, blockedId);

      // Save dislikes if provided
      if (dislikes && Array.isArray(dislikes)) {
        const stmt = await db.prepare(Q.DISLIKE_INSERT);

        for (const dislike of dislikes) {
          // Check dislike count limit (500 max)
          const count = await db.prepare(Q.DISLIKE_COUNT).get(blockerId);

          if (count.count >= 500) {
            break; // Stop adding if limit reached
          }

          stmt.run(blockerId, dislike.field, dislike.value);
        }
      }

      // Update any pending invitations to blocked status
      await db.prepare(Q.BLOCK_UPDATE_INVITATIONS).run(blockerId, blockedId, blockedId, blockerId);

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

      const dislikes = await db.prepare(Q.DISLIKES_GROUPED).all(userId);

      const total = await db.prepare(Q.DISLIKES_TOTAL).get(userId);

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
      // Check if user is admin. Чатът няма users.is_admin — авторитетът е admin_users
      // (username, попълнен от .env при старт; виж roles.js). Логнатият потребител се
      // идентифицира с full_name спрямо admin_users.
      const adminUser = await db.prepare(Q.ADMIN_FIND).get(req.user && req.user.full_name);

      if (!adminUser) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      // Get user's criteria
      const criteria = await db.prepare(Q.CRITERIA_GET).get(userId);

      if (!criteria) {
        return res.status(404).json({
          error: 'No criteria found for this user'
        });
      }

      // Get user's dislikes
      const dislikes = await db.prepare(Q.FIND_DISLIKES).all(userId);

      // Run same matching algorithm as regular search but FREE
      const blockedUsers = (await db.prepare(Q.FIND_BLOCKED).all(userId, userId)).map(row => row.blocked_id || row.blocker_id);

      // Динамичен builder → { sql, params }
      const { sql: query, params } = Q.ADMIN_FIND_MATCHES(userId, blockedUsers, criteria);

      const matches = await db.prepare(query).all(...params);

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
