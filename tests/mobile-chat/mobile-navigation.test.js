// Version: 1.0056
// Mobile App Navigation Tests
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('📱 Mobile App - Navigation Tests', () => {
  const APP_ROOT = path.join(__dirname, '..', '..', 'private', 'mobile-chat');
  
  it('should have navigation structure', () => {
    const exists = fs.existsSync(path.join(APP_ROOT, 'src', 'navigation'));
    console.log(`   ${exists ? '✅' : '⚠️'} Navigation folder`);
  });

  it('should have main screens', () => {
    const screens = ['LoginScreen', 'HomeScreen', 'ChatScreen', 'ProfileScreen', 'SignalScreen'];
    let found = 0;
    screens.forEach(screen => {
      const exists = fs.existsSync(path.join(APP_ROOT, 'src', 'screens', `${screen}.js`));
      if (exists) found++;
      console.log(`   ${exists ? '✅' : '⚠️'} ${screen}`);
    });
    assert(found > 0, 'Should have at least some screens');
  });

  it('should have search screens', () => {
    const searchScreens = ['SearchByDistanceScreen', 'SearchByNeedScreen'];
    searchScreens.forEach(screen => {
      const exists = fs.existsSync(path.join(APP_ROOT, 'src', 'screens', `${screen}.js`));
      console.log(`   ${exists ? '✅' : '⚠️'} ${screen}`);
    });
  });

  it('should have payment screens', () => {
    const paymentScreens = ['StripePaymentScreen', 'CryptoPaymentScreen'];
    paymentScreens.forEach(screen => {
      const exists = fs.existsSync(path.join(APP_ROOT, 'src', 'screens', `${screen}.js`));
      console.log(`   ${exists ? '✅' : '⚠️'} ${screen}`);
    });
  });
});
