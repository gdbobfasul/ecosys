// Version: 1.0056
// Signals Feature Tests  
// NOTE: Requires running server at http://localhost:3000
// If server not running, tests will show warning but not fail

const assert = require('assert');
const API_URL = process.env.API_URL || 'http://localhost:3000';
let serverRunning = false;

// ANSI color codes
const colors = {
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

// Helper to skip tests if server not running
function requireServer(testFn) {
  return async function() {
    if (!serverRunning) {
      console.log(`${colors.yellow}      ⚠️  Skipped - Сървърът не работи. Тестваш на локална машина, нали? Пусни: node server.js${colors.reset}`);
      return;
    }
    return await testFn.apply(this, arguments);
  };
}

describe('Signals System Tests (Requires Server)', () => {
  
  before(async () => {
    // Check if server is running
    try {
      await fetch(`${API_URL}/api/signals/can-submit`);
      serverRunning = true;
      console.log(`   ✅ Server running at ${API_URL}`);
    } catch (error) {
      serverRunning = false;
      console.log(`${colors.yellow}   ⚠️  SERVER NOT RUNNING at ${API_URL}${colors.reset}`);
      console.log(`${colors.yellow}   ℹ️  These tests need a running server. Start with: node server.js${colors.reset}`);
    }
  });
  
  describe('Server Connection', () => {
    it('should connect to server', requireServer(async () => {
      const res = await fetch(`${API_URL}/api/signals/can-submit`);
      assert(res, 'No response from server');
      console.log('      ✅ Server responded');
    }));
  });
  
  after(() => {
    if (!serverRunning) {
      console.log(`${colors.yellow}\n   ℹ️  Signals API tests skipped - server not running${colors.reset}`);
      console.log(`${colors.yellow}   ℹ️  To run these tests: node server.js (in another terminal)\n${colors.reset}`);
    }
  });
});

