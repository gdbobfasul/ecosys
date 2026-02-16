// Version: 1.0056
// Mobile App Tests (Frontend Only)
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('📱 Mobile App Tests', () => {
  const APP_ROOT = path.join(__dirname, '..', '..', 'private', 'mobile-chat');
  
  it('should have App.js', () => {
    assert(fs.existsSync(path.join(APP_ROOT, 'App.js')));
  });
  
  it('should have all screens', () => {
    const screens = ['LoginScreen.js', 'HomeScreen.js', 'ChatScreen.js', 'ProfileScreen.js', 'SignalScreen.js'];
    screens.forEach(s => {
      assert(fs.existsSync(path.join(APP_ROOT, 'src', 'screens', s)), `Missing ${s}`);
    });
  });
  
  it('should have API service', () => {
    assert(fs.existsSync(path.join(APP_ROOT, 'src', 'services', 'api.js')));
  });
});
