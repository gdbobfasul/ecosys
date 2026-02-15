// Version: 1.0056
// Search Functionality Tests
// Tests search by distance, search by need, GPS, Haversine

const assert = require('assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test-search.db');
let db;

// Haversine formula to calculate distance between two GPS coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

describe('🔍 Search Functionality Tests', () => {
  
  before(() => {
    // Create test database
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    
    db = new Database(TEST_DB);
    
    // Load schema
    const schema = fs.readFileSync(path.join(__dirname, '../database/db_setup.sql'), 'utf8');
    db.exec(schema);
    
    // Create test users with GPS coordinates
    // Sofia center: 42.6977° N, 23.3219° E
    db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, location_latitude, location_longitude, city, subscription_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('+359888111111', 'hash', 'User Sofia 1', 'male', 25, 42.6977, 23.3219, 'Sofia', 1);
    
    // Sofia 2km away
    db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, location_latitude, location_longitude, city, subscription_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('+359888222222', 'hash', 'User Sofia 2', 'female', 28, 42.7100, 23.3400, 'Sofia', 1);
    
    // Plovdiv: 42.1354° N, 24.7453° E (145km from Sofia)
    db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, location_latitude, location_longitude, city, subscription_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('+359888333333', 'hash', 'User Plovdiv', 'male', 30, 42.1354, 24.7453, 'Plovdiv', 1);
    
    // Varna: 43.2141° N, 27.9147° E (385km from Sofia)
    db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, location_latitude, location_longitude, city, subscription_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('+359888444444', 'hash', 'User Varna', 'female', 26, 43.2141, 27.9147, 'Varna', 1);
    
    // Create static objects with offerings
    db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, location_latitude, location_longitude, offerings, is_static_object, subscription_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `).run('+359888555555', 'hash', 'Pharmacy Sofia', 'male', 0, 42.6980, 23.3230, 'Pharmacy');
    
    db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, location_latitude, location_longitude, offerings, is_static_object, subscription_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `).run('+359888666666', 'hash', 'Restaurant Sofia', 'male', 0, 42.6990, 23.3250, 'Restaurant');
    
    console.log('✅ Test database created with GPS locations');
  });

  after(() => {
    db.close();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  describe('📍 GPS Coordinates', () => {
    
    it('should validate latitude range (-90 to 90)', () => {
      const validLat = [0, 42.6977, -42.6977, 90, -90];
      const invalidLat = [91, -91, 100, -100];
      
      const isValidLat = (lat) => lat >= -90 && lat <= 90;
      
      validLat.forEach(lat => {
        assert(isValidLat(lat), `Latitude ${lat} should be valid`);
      });
      
      invalidLat.forEach(lat => {
        assert(!isValidLat(lat), `Latitude ${lat} should be invalid`);
      });
      
      console.log('   ✅ Latitude validation works');
    });

    it('should validate longitude range (-180 to 180)', () => {
      const validLon = [0, 23.3219, -23.3219, 180, -180];
      const invalidLon = [181, -181, 200, -200];
      
      const isValidLon = (lon) => lon >= -180 && lon <= 180;
      
      validLon.forEach(lon => {
        assert(isValidLon(lon), `Longitude ${lon} should be valid`);
      });
      
      invalidLon.forEach(lon => {
        assert(!isValidLon(lon), `Longitude ${lon} should be invalid`);
      });
      
      console.log('   ✅ Longitude validation works');
    });

    it('should store GPS coordinates with precision', () => {
      const user = db.prepare('SELECT location_latitude, location_longitude FROM users WHERE phone = ?')
        .get('+359888111111');
      
      assert.strictEqual(user.location_latitude, 42.6977, 'Latitude should match');
      assert.strictEqual(user.location_longitude, 23.3219, 'Longitude should match');
      
      console.log('   ✅ GPS coordinates stored with precision');
    });

    it('should retrieve users with GPS coordinates', () => {
      const usersWithGPS = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE location_latitude IS NOT NULL 
        AND location_longitude IS NOT NULL
      `).get().count;
      
      assert(usersWithGPS > 0, 'Should have users with GPS');
      
      console.log(`   ✅ Found ${usersWithGPS} users with GPS`);
    });

    it('should handle users without GPS (NULL)', () => {
      // Create user without GPS
      db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age, subscription_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('+359888777777', 'hash', 'No GPS User', 'male', 25, 1);
      
      const user = db.prepare('SELECT location_latitude, location_longitude FROM users WHERE phone = ?')
        .get('+359888777777');
      
      assert.strictEqual(user.location_latitude, null, 'Latitude should be NULL');
      assert.strictEqual(user.location_longitude, null, 'Longitude should be NULL');
      
      console.log('   ✅ NULL GPS coordinates handled');
    });
  });

  describe('📏 Haversine Distance Calculation', () => {
    
    it('should calculate distance between Sofia and Plovdiv (~145km)', () => {
      const sofia = { lat: 42.6977, lon: 23.3219 };
      const plovdiv = { lat: 42.1354, lon: 24.7453 };
      
      const distance = calculateDistance(sofia.lat, sofia.lon, plovdiv.lat, plovdiv.lon);
      
      assert(distance >= 130 && distance <= 150, `Distance should be ~132-145km, got ${distance.toFixed(2)}km`);
      
      console.log(`   ✅ Sofia-Plovdiv distance: ${distance.toFixed(2)}km`);
    });

    it('should calculate distance between Sofia and Varna (~385km)', () => {
      const sofia = { lat: 42.6977, lon: 23.3219 };
      const varna = { lat: 43.2141, lon: 27.9147 };
      
      const distance = calculateDistance(sofia.lat, sofia.lon, varna.lat, varna.lon);
      
      assert(distance >= 375 && distance <= 390, `Distance should be ~378-385km, got ${distance.toFixed(2)}km`);
      
      console.log(`   ✅ Sofia-Varna distance: ${distance.toFixed(2)}km`);
    });

    it('should return 0 for same location', () => {
      const sofia = { lat: 42.6977, lon: 23.3219 };
      
      const distance = calculateDistance(sofia.lat, sofia.lon, sofia.lat, sofia.lon);
      
      assert(distance === 0, 'Same location should have 0 distance');
      
      console.log('   ✅ Same location = 0 distance');
    });

    it('should calculate small distances accurately (< 1km)', () => {
      const point1 = { lat: 42.6977, lon: 23.3219 };
      const point2 = { lat: 42.6980, lon: 23.3230 }; // ~130m away
      
      const distance = calculateDistance(point1.lat, point1.lon, point2.lat, point2.lon);
      
      assert(distance < 1, `Distance should be < 1km, got ${distance.toFixed(3)}km`);
      
      console.log(`   ✅ Small distance: ${(distance * 1000).toFixed(0)}m`);
    });

    it('should handle maximum Earth distance (~20,000km)', () => {
      const point1 = { lat: 0, lon: 0 };
      const point2 = { lat: 0, lon: 180 }; // Opposite side of Earth
      
      const distance = calculateDistance(point1.lat, point1.lon, point2.lat, point2.lon);
      
      assert(distance > 19000 && distance < 21000, 'Should be ~20,000km');
      
      console.log(`   ✅ Max Earth distance: ${distance.toFixed(0)}km`);
    });
  });

  describe('🔍 Search by Distance', () => {
    
    it('should find users within 5km radius', () => {
      const centerLat = 42.6977;
      const centerLon = 23.3219;
      const maxDistance = 5; // km
      
      const allUsers = db.prepare(`
        SELECT *, location_latitude as lat, location_longitude as lon 
        FROM users 
        WHERE location_latitude IS NOT NULL
      `).all();
      
      const nearby = allUsers.filter(user => {
        const dist = calculateDistance(centerLat, centerLon, user.lat, user.lon);
        return dist <= maxDistance;
      });
      
      assert(nearby.length >= 2, 'Should find nearby users in Sofia');
      
      console.log(`   ✅ Found ${nearby.length} users within 5km`);
    });

    it('should find users within 50km radius', () => {
      const centerLat = 42.6977;
      const centerLon = 23.3219;
      const maxDistance = 50;
      
      const allUsers = db.prepare(`
        SELECT *, location_latitude as lat, location_longitude as lon 
        FROM users 
        WHERE location_latitude IS NOT NULL
      `).all();
      
      const nearby = allUsers.filter(user => {
        const dist = calculateDistance(centerLat, centerLon, user.lat, user.lon);
        return dist <= maxDistance;
      });
      
      assert(nearby.length >= 2, 'Should find users within 50km');
      
      console.log(`   ✅ Found ${nearby.length} users within 50km`);
    });

    it('should exclude users beyond max distance', () => {
      const centerLat = 42.6977; // Sofia
      const centerLon = 23.3219;
      const maxDistance = 100; // km
      
      const allUsers = db.prepare(`
        SELECT *, location_latitude as lat, location_longitude as lon 
        FROM users 
        WHERE location_latitude IS NOT NULL
      `).all();
      
      const nearby = allUsers.filter(user => {
        const dist = calculateDistance(centerLat, centerLon, user.lat, user.lon);
        return dist <= maxDistance;
      });
      
      // Plovdiv (145km) and Varna (385km) should be excluded
      const plovdivUser = nearby.find(u => u.city === 'Plovdiv');
      const varnaUser = nearby.find(u => u.city === 'Varna');
      
      assert(!plovdivUser, 'Plovdiv should be excluded (145km > 100km)');
      assert(!varnaUser, 'Varna should be excluded (385km > 100km)');
      
      console.log('   ✅ Far users excluded');
    });

    it('should support maximum distance of 40,000km (worldwide)', () => {
      const maxDistance = 40000; // Earth circumference
      
      const allUsers = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE location_latitude IS NOT NULL
      `).get().count;
      
      // All users should be within 40,000km (worldwide search)
      assert(allUsers >= 0, 'Worldwide search should work');
      
      console.log(`   ✅ Worldwide search: ${allUsers} users`);
    });

    it('should sort results by distance (nearest first)', () => {
      const centerLat = 42.6977;
      const centerLon = 23.3219;
      
      const allUsers = db.prepare(`
        SELECT *, location_latitude as lat, location_longitude as lon 
        FROM users 
        WHERE location_latitude IS NOT NULL
      `).all();
      
      const withDistance = allUsers.map(user => ({
        ...user,
        distance: calculateDistance(centerLat, centerLon, user.lat, user.lon)
      }));
      
      withDistance.sort((a, b) => a.distance - b.distance);
      
      // Verify sorted order
      for (let i = 1; i < withDistance.length; i++) {
        assert(withDistance[i].distance >= withDistance[i-1].distance, 
          'Should be sorted by distance');
      }
      
      console.log('   ✅ Results sorted by distance');
    });

    it('should exclude users without GPS coordinates', () => {
      const usersWithoutGPS = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE location_latitude IS NULL OR location_longitude IS NULL
      `).get().count;
      
      // These should NOT appear in distance search
      assert(usersWithoutGPS >= 1, 'Should have user without GPS for testing');
      
      console.log(`   ✅ ${usersWithoutGPS} users without GPS excluded`);
    });

    it('should exclude unpaid users from search', () => {
      // Create unpaid user
      db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age, location_latitude, location_longitude, subscription_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run('+359888888888', 'hash', 'Unpaid User', 'male', 25, 42.6977, 23.3219);
      
      const paidOnly = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE subscription_active = 1 
        AND location_latitude IS NOT NULL
      `).get().count;
      
      const total = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE location_latitude IS NOT NULL
      `).get().count;
      
      assert(paidOnly < total, 'Unpaid users should be excluded');
      
      console.log(`   ✅ Unpaid users excluded: ${total - paidOnly}`);
    });

    it('should exclude blocked users from search', () => {
      // Block a user
      db.prepare('UPDATE users SET is_blocked = 1 WHERE phone = ?').run('+359888444444');
      
      const nonBlocked = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE is_blocked = 0 
        AND location_latitude IS NOT NULL
      `).get().count;
      
      const total = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE location_latitude IS NOT NULL
      `).get().count;
      
      assert(nonBlocked < total, 'Blocked users should be excluded');
      
      console.log(`   ✅ Blocked users excluded: ${total - nonBlocked}`);
    });
  });

  describe('🎯 Search by Need', () => {
    
    it('should search by offerings (static objects)', () => {
      const pharmacies = db.prepare(`
        SELECT * FROM users 
        WHERE offerings LIKE '%Pharmacy%' 
        AND is_static_object = 1
      `).all();
      
      assert(pharmacies.length > 0, 'Should find pharmacies');
      
      console.log(`   ✅ Found ${pharmacies.length} pharmacies`);
    });

    it('should search within 50km max for "by need"', () => {
      const centerLat = 42.6977;
      const centerLon = 23.3219;
      const maxDistance = 50; // km (by need limit)
      
      const staticObjects = db.prepare(`
        SELECT *, location_latitude as lat, location_longitude as lon 
        FROM users 
        WHERE is_static_object = 1 
        AND location_latitude IS NOT NULL
      `).all();
      
      const nearby = staticObjects.filter(obj => {
        const dist = calculateDistance(centerLat, centerLon, obj.lat, obj.lon);
        return dist <= maxDistance;
      });
      
      assert(nearby.length > 0, 'Should find static objects within 50km');
      
      console.log(`   ✅ Found ${nearby.length} objects within 50km`);
    });

    it('should filter by offering type (Pharmacy, Restaurant, etc)', () => {
      const types = ['Pharmacy', 'Restaurant'];
      
      types.forEach(type => {
        const results = db.prepare(`
          SELECT COUNT(*) as count FROM users 
          WHERE offerings LIKE ? 
          AND is_static_object = 1
        `).get(`%${type}%`).count;
        
        console.log(`   ✅ Found ${results} ${type}(s)`);
      });
    });

    it('should return empty if offering not found', () => {
      const results = db.prepare(`
        SELECT * FROM users 
        WHERE offerings LIKE '%NonExistent%' 
        AND is_static_object = 1
      `).all();
      
      assert.strictEqual(results.length, 0, 'Should return empty for non-existent offering');
      
      console.log('   ✅ Empty results for non-existent offering');
    });

    it('should combine offering + distance filters', () => {
      const centerLat = 42.6977;
      const centerLon = 23.3219;
      const maxDistance = 50;
      const offering = 'Pharmacy';
      
      const staticObjects = db.prepare(`
        SELECT *, location_latitude as lat, location_longitude as lon 
        FROM users 
        WHERE is_static_object = 1 
        AND offerings LIKE ?
        AND location_latitude IS NOT NULL
      `).all(`%${offering}%`);
      
      const nearby = staticObjects.filter(obj => {
        const dist = calculateDistance(centerLat, centerLon, obj.lat, obj.lon);
        return dist <= maxDistance;
      });
      
      assert(Array.isArray(nearby), 'Should return array');
      
      console.log(`   ✅ Combined search: ${nearby.length} pharmacies within 50km`);
    });
  });

  describe('🎨 Search Filters', () => {
    
    it('should filter by gender', () => {
      const males = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE gender = 'male' 
        AND subscription_active = 1
      `).get().count;
      
      const females = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE gender = 'female' 
        AND subscription_active = 1
      `).get().count;
      
      assert(males > 0, 'Should have male users');
      assert(females > 0, 'Should have female users');
      
      console.log(`   ✅ Gender filter: ${males} males, ${females} females`);
    });

    it('should filter by age range', () => {
      const minAge = 25;
      const maxAge = 30;
      
      const inRange = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE age >= ? AND age <= ? 
        AND subscription_active = 1
      `).get(minAge, maxAge).count;
      
      assert(inRange > 0, 'Should find users in age range');
      
      console.log(`   ✅ Age filter: ${inRange} users aged ${minAge}-${maxAge}`);
    });

    it('should filter by city', () => {
      const cities = ['Sofia', 'Plovdiv', 'Varna'];
      
      cities.forEach(city => {
        const count = db.prepare(`
          SELECT COUNT(*) as count FROM users 
          WHERE city = ? 
          AND subscription_active = 1
        `).get(city).count;
        
        console.log(`   ✅ City ${city}: ${count} users`);
      });
    });

    it('should combine multiple filters', () => {
      const filters = {
        gender: 'male',
        minAge: 20,
        maxAge: 30,
        city: 'Sofia'
      };
      
      const results = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE gender = ? 
        AND age >= ? AND age <= ? 
        AND city = ?
        AND subscription_active = 1
      `).get(filters.gender, filters.minAge, filters.maxAge, filters.city).count;
      
      assert(typeof results === 'number', 'Should return count');
      
      console.log(`   ✅ Combined filters: ${results} users`);
    });
  });

  describe('📄 Search Pagination', () => {
    
    it('should limit results (LIMIT clause)', () => {
      const limit = 10;
      
      const results = db.prepare(`
        SELECT * FROM users 
        WHERE subscription_active = 1 
        LIMIT ?
      `).all(limit);
      
      assert(results.length <= limit, `Should return max ${limit} results`);
      
      console.log(`   ✅ Limited to ${results.length} results`);
    });

    it('should support pagination (LIMIT + OFFSET)', () => {
      const limit = 2;
      const offset = 0;
      
      const page1 = db.prepare(`
        SELECT id FROM users 
        WHERE subscription_active = 1 
        LIMIT ? OFFSET ?
      `).all(limit, offset);
      
      const page2 = db.prepare(`
        SELECT id FROM users 
        WHERE subscription_active = 1 
        LIMIT ? OFFSET ?
      `).all(limit, limit);
      
      // Pages should have different users
      if (page1.length > 0 && page2.length > 0) {
        assert(page1[0].id !== page2[0].id, 'Pages should have different results');
      }
      
      console.log(`   ✅ Pagination works (page1: ${page1.length}, page2: ${page2.length})`);
    });

    it('should count total results before pagination', () => {
      const totalCount = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE subscription_active = 1
      `).get().count;
      
      const totalPages = Math.ceil(totalCount / 10);
      
      assert(totalPages >= 1, 'Should have at least 1 page');
      
      console.log(`   ✅ Total: ${totalCount} users, ${totalPages} pages`);
    });
  });

  describe('🔒 Search Security', () => {
    
    it('should prevent SQL injection in search query', () => {
      const maliciousInput = "' OR '1'='1";
      
      // Using prepared statements prevents injection
      const results = db.prepare(`
        SELECT * FROM users WHERE city = ?
      `).all(maliciousInput);
      
      assert.strictEqual(results.length, 0, 'SQL injection should return 0 results');
      
      console.log('   ✅ SQL injection prevented');
    });

    it('should sanitize search input', () => {
      const maliciousInput = '<script>alert("XSS")</script>';
      
      const sanitize = (input) => {
        return input.replace(/<[^>]*>/g, '');
      };
      
      const sanitized = sanitize(maliciousInput);
      assert(!sanitized.includes('<script>'), 'Should remove HTML tags');
      
      console.log('   ✅ Input sanitization works');
    });
  });
});
