// Version: 1.0094
const express = require('express');
const Q = require('../queries').search; // набор builder-функции според CHAT_DB_TYPE (pg/sqlite)

// Haversine formula for calculating distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

function createSearchRoutes(db) {
  const router = express.Router();

  // ============================================
  // FREE CHAT SEARCH (4 types)
  // ============================================
  router.post('/free', async (req, res) => {
    try {
      const user = req.user;
      
      // Check if user is paid (paid users use advanced search)
      if (user.subscription_active && 
          user.paid_until && 
          new Date(user.paid_until) > new Date()) {
        return res.status(403).json({ 
          error: 'Use advanced search endpoints for paid users' 
        });
      }

      const { phone, fullName, city, age, codeWord } = req.body;
      
      // Type 1: EXACT SEARCH (all 5 fields required)
      if (phone && fullName && city && age && codeWord) {
        const { sql, params } = Q.buildFreeExact({ phone, fullName, city, age, codeWord, userId: user.id });
        const result = await db.prepare(sql).get(...params);

        return res.json({
          type: 'exact', 
          results: result ? [result] : [],
          message: result ? 'User found' : 'No user found with these exact details'
        });
      }
      
      // Type 2: BY CITY (only city filled)
      if (city && !phone && !fullName && !age && !codeWord) {
        const { sql, params } = Q.buildFreeByCity({ city, userId: user.id });
        const results = await db.prepare(sql).all(...params);

        return res.json({
          type: 'city', 
          results,
          message: `${results.length} random users from ${city}`
        });
      }
      
      // Type 3: BY AGE (only age filled)
      if (age && !phone && !fullName && !city && !codeWord) {
        if (age < 18) {
          return res.status(400).json({ error: 'Minimum age is 18' });
        }
        
        const { sql, params } = Q.buildFreeByAge({ age, userId: user.id });
        const results = await db.prepare(sql).all(...params);

        return res.json({
          type: 'age', 
          results,
          message: `${results.length} random users age ${age}`
        });
      }
      
      // Type 4: RANDOM WORLDWIDE (nothing filled)
      if (!phone && !fullName && !city && !age && !codeWord) {
        const { sql, params } = Q.buildFreeRandom({ userId: user.id });
        const results = await db.prepare(sql).all(...params);

        return res.json({
          type: 'random', 
          results,
          message: `${results.length} random users worldwide`
        });
      }
      
      // Invalid combination
      return res.status(400).json({ 
        error: 'Invalid search. Free users can search by: (1) All 5 fields, (2) City only, (3) Age only, (4) Nothing (random)'
      });
    } catch (err) {
      console.error('Free search error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // PAID SEARCH ROUTES
  // ============================================

  // Search #2: By distance
  router.post('/by-distance', async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        latitude, 
        longitude, 
        min_distance = 0, 
        max_distance = 40000,
        min_age,
        max_age,
        gender,
        min_height,
        max_height
      } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Your location coordinates required' });
      }
      
      // Build query (диалект-специфичен builder: динамични gender/height условия)
      const { sql, params } = Q.buildByDistance({ userId, gender, min_height, max_height });

      // Get all matching users
      const users = await db.prepare(sql).all(...params);
      
      // Calculate distance and filter
      const results = users
        .map(user => {
          const distance = calculateDistance(
            latitude, 
            longitude,
            user.location_latitude,
            user.location_longitude
          );
          
          // Calculate age
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
          
          // Apply distance filter
          if (distance < min_distance || distance > max_distance) {
            return null;
          }
          
          // Apply age filter
          if (age !== null) {
            if (min_age && age < min_age) return null;
            if (max_age && age > max_age) return null;
          }
          
          // Hide sensitive data
          if (user.hide_phone) {
            user.phone = user.phone.substring(0, 7) + '...';
          }
          
          if (user.hide_names) {
            const names = user.full_name.split(' ');
            user.full_name = names.map(n => n.substring(0, 4) + '...').join(' ');
          }
          
          // Remove coordinates from response
          delete user.location_latitude;
          delete user.location_longitude;
          delete user.hide_phone;
          delete user.hide_names;
          delete user.birth_date;
          
          return {
            ...user,
            age: age,
            distance_km: Math.round(distance * 10) / 10 // Round to 1 decimal
          };
        })
        .filter(Boolean) // Remove nulls
        .sort((a, b) => a.distance_km - b.distance_km); // Closest first
      
      res.json({
        total: results.length,
        results: results
      });
      
    } catch (err) {
      console.error('Search by distance error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Search #3: By need (max 50km radius)
  router.post('/by-need', async (req, res) => {
    try {
      const userId = req.user.id;
      const { 
        latitude, 
        longitude,
        need, // What I'm looking for
        min_age,
        max_age,
        gender,
        min_height,
        max_height,
        city
      } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Your location coordinates required' });
      }
      
      if (!need) {
        return res.status(400).json({ error: 'Need parameter required (what are you looking for?)' });
      }
      
      // Validate need
      const { validateNeed, getMatchingOfferings } = require('../utils/serviceCategories');
      const needValidation = validateNeed(need);
      if (!needValidation.valid) {
        return res.status(400).json({ error: needValidation.error });
      }
      
      const MAX_RADIUS_KM = 50;
      
      // Get matching offerings for this need (handles emergency mapping)
      const matchingOfferings = getMatchingOfferings(need);

      // Build query - find users who OFFER what I NEED (includes static objects).
      // Диалект-специфичен builder: динамични offerings LIKE условия + gender/height/city.
      const { sql, params } = Q.buildByNeed({ userId, matchingOfferings, gender, min_height, max_height, city });

      // Get all matching users
      const users = await db.prepare(sql).all(...params);
      
      // Calculate distance and filter by 50km max
      const results = users
        .map(user => {
          const distance = calculateDistance(
            latitude, 
            longitude,
            user.location_latitude,
            user.location_longitude
          );
          
          // Filter by max 50km
          if (distance > MAX_RADIUS_KM) {
            return null;
          }
          
          // Calculate age
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
          
          // Apply age filter
          if (age !== null) {
            if (min_age && age < min_age) return null;
            if (max_age && age > max_age) return null;
          }
          
          // Hide sensitive data
          if (user.hide_phone) {
            user.phone = user.phone.substring(0, 7) + '...';
          }
          
          if (user.hide_names) {
            const names = user.full_name.split(' ');
            user.full_name = names.map(n => n.substring(0, 4) + '...').join(' ');
          }
          
          // Remove coordinates from response
          delete user.location_latitude;
          delete user.location_longitude;
          delete user.hide_phone;
          delete user.hide_names;
          delete user.birth_date;
          delete user.is_verified;
          
          return {
            ...user,
            age: age,
            distance_km: Math.round(distance * 10) / 10 // Round to 1 decimal
          };
        })
        .filter(Boolean) // Remove nulls
        .sort((a, b) => a.distance_km - b.distance_km); // Closest first
      
      res.json({
        total: results.length,
        max_radius_km: MAX_RADIUS_KM,
        searching_for: need,
        results: results
      });
      
    } catch (err) {
      console.error('Search by need error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createSearchRoutes;
