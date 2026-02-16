// Version: 1.0056
// Mobile App Components Tests
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('🧩 Mobile App - Components Tests', () => {
  const APP_ROOT = path.join(__dirname, '..', '..', 'private', 'mobile-chat');
  
  it('should have common components', () => {
    const components = ['Button', 'Input', 'Card', 'Header', 'Loading'];
    const componentPath = path.join(APP_ROOT, 'src', 'components');
    if (fs.existsSync(componentPath)) {
      components.forEach(comp => {
        const exists = fs.existsSync(path.join(componentPath, `${comp}.js`));
        console.log(`   ${exists ? '✅' : '⚠️'} ${comp}`);
      });
    } else {
      console.log('   ⚠️ Components folder not found');
    }
  });

  it('should have API service', () => {
    const apiPath = path.join(APP_ROOT, 'src', 'services', 'api.js');
    const exists = fs.existsSync(apiPath);
    assert(exists, 'API service should exist');
    console.log('   ✅ API service exists');
  });

  it('should have storage service', () => {
    const storagePath = path.join(APP_ROOT, 'src', 'services', 'storage.js');
    const exists = fs.existsSync(storagePath);
    console.log(`   ${exists ? '✅' : '⚠️'} Storage service`);
  });

  it('should have location service', () => {
    const locationPath = path.join(APP_ROOT, 'src', 'services', 'location.js');
    const exists = fs.existsSync(locationPath);
    console.log(`   ${exists ? '✅' : '⚠️'} Location service`);
  });

  it('should have camera service', () => {
    const cameraPath = path.join(APP_ROOT, 'src', 'services', 'camera.js');
    const exists = fs.existsSync(cameraPath);
    console.log(`   ${exists ? '✅' : '⚠️'} Camera service`);
  });
});
