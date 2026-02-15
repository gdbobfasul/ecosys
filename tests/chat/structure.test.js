// Version: 1.0056
// Project Structure Validation Tests
// Validates that both web and mobile projects follow correct structure
// Run: npm test structure.test.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Detect if we're running in web or mobile project
const CURRENT_ROOT = path.join(__dirname, '..');
const projectJsonPath = path.join(CURRENT_ROOT, 'package.json');
let isWebProject = false;
let isMobileProject = false;

if (fs.existsSync(projectJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
  isWebProject = packageJson.name?.includes('web') || fs.existsSync(path.join(CURRENT_ROOT, 'server.js'));
  isMobileProject = packageJson.name?.includes('app') || fs.existsSync(path.join(CURRENT_ROOT, 'App.js'));
}

const WEB_ROOT = isWebProject ? CURRENT_ROOT : path.join(CURRENT_ROOT, '../2026-01-21-AMS-chat-web');
const MOBILE_ROOT = isMobileProject ? CURRENT_ROOT : path.join(CURRENT_ROOT, '../2026-01-21-AMS-chat-app');

describe('📁 Project Structure Validation', () => {
  
  before(() => {
    console.log(`\n   🔍 Running in: ${isWebProject ? 'WEB' : isMobileProject ? 'MOBILE' : 'UNKNOWN'} project`);
    console.log(`   📂 WEB_ROOT: ${WEB_ROOT}`);
    console.log(`   📱 MOBILE_ROOT: ${MOBILE_ROOT}\n`);
  });
  
  // ==================== WEB PROJECT TESTS ====================
  
  describe('🌐 Web Project Structure', () => {
    
    before(function() {
      // Skip web tests if we're in mobile project
      if (isMobileProject && !fs.existsSync(WEB_ROOT)) {
        console.log('   ⚠️  Web project not found, skipping web tests');
        this.skip();
      }
    });
    
    it('1. MUST have version file in format 00XXX.version', () => {
      const files = fs.readdirSync(WEB_ROOT);
      const versionFiles = files.filter(f => /^\d{5}\.version$/.test(f));
      
      assert.strictEqual(versionFiles.length, 1, 
        `Expected exactly 1 version file in format 00XXX.version, found: ${versionFiles.join(', ') || 'NONE'}`);
      
      const versionFile = versionFiles[0];
      assert.match(versionFile, /^\d{5}\.version$/, 
        `Version file must be in format 00XXX.version, found: ${versionFile}`);
      
      console.log(`   ✅ Version file: ${versionFile}`);
    });
    
    it('2. MUST have ONLY allowed files in root', () => {
      const files = fs.readdirSync(WEB_ROOT);
      const allowed = [
        '.gitignore',
        'package.json',
        'package-lock.json',
        'server.js',
        '.env'
      ];
      
      // Add version file to allowed
      const versionFile = files.find(f => /^\d{5}\.version$/.test(f));
      if (versionFile) allowed.push(versionFile);
      
      const rootFiles = files.filter(f => {
        const stat = fs.statSync(path.join(WEB_ROOT, f));
        return stat.isFile();
      });
      
      const forbidden = rootFiles.filter(f => !allowed.includes(f));
      
      assert.strictEqual(forbidden.length, 0, 
        `Found forbidden files in root: ${forbidden.join(', ')}\nAllowed files: ${allowed.join(', ')}`);
      
      console.log(`   ✅ Root files clean: ${rootFiles.length} files`);
    });
    
    it('3. MUST have required folders', () => {
      const required = [
        'assets',
        'configs',
        'database', 
        'docs',
        'middleware',
        'public',
        'routes',
        'scripts',
        'tests',
        'utils'
      ];
      
      const missing = [];
      required.forEach(folder => {
        const folderPath = path.join(WEB_ROOT, folder);
        if (!fs.existsSync(folderPath)) {
          missing.push(folder);
        }
      });
      
      assert.strictEqual(missing.length, 0, 
        `Missing required folders: ${missing.join(', ')}`);
      
      console.log(`   ✅ All required folders present`);
    });
    
    it('4. /assets MUST contain icons and PWA files', () => {
      const assetsPath = path.join(WEB_ROOT, 'assets');
      const required = [
        'icon-192.png',
        'icon-512.png',
        'manifest.json',
        'sw.js'
      ];
      
      const missing = [];
      required.forEach(file => {
        if (!fs.existsSync(path.join(assetsPath, file))) {
          missing.push(file);
        }
      });
      
      assert.strictEqual(missing.length, 0, 
        `Missing assets: ${missing.join(', ')}`);
      
      console.log(`   ✅ Assets folder complete`);
    });
    
    it('4.1. /configs MUST contain .env.example', () => {
      const configsPath = path.join(WEB_ROOT, 'configs');
      const envExample = path.join(configsPath, '.env.example');
      
      assert(fs.existsSync(envExample), 
        'Missing configs/.env.example file!');
      
      console.log(`   ✅ Config folder has .env.example`);
    });
    
    it('5. /public MUST NOT contain icons or manifest', () => {
      const publicPath = path.join(WEB_ROOT, 'public');
      const forbidden = [
        'icon-192.png',
        'icon-512.png',
        'icon.png',
        'manifest.json',
        'sw.js'
      ];
      
      const files = fs.readdirSync(publicPath);
      const found = files.filter(f => forbidden.includes(f));
      
      assert.strictEqual(found.length, 0, 
        `Found forbidden files in /public: ${found.join(', ')}. These should be in /assets!`);
      
      console.log(`   ✅ Public folder clean (no icons)`);
    });
    
    it('6. /public MUST contain only HTML and config.js', () => {
      const publicPath = path.join(WEB_ROOT, 'public');
      const files = fs.readdirSync(publicPath);
      
      const invalid = files.filter(f => {
        return !f.endsWith('.html') && f !== 'config.js';
      });
      
      assert.strictEqual(invalid.length, 0, 
        `Found non-HTML/config files in /public: ${invalid.join(', ')}`);
      
      console.log(`   ✅ Public contains only HTML + config.js`);
    });
    
    it('7. /database MUST contain only SQL, JS scripts, and DB files', () => {
      const dbPath = path.join(WEB_ROOT, 'database');
      const files = fs.readdirSync(dbPath);
      
      const allowedExtensions = ['.sql', '.js', '.db'];
      const nonAllowed = files.filter(f => !allowedExtensions.some(ext => f.endsWith(ext)));
      
      assert.strictEqual(nonAllowed.length, 0, 
        `Found non-allowed files in /database: ${nonAllowed.join(', ')}. Allowed: ${allowedExtensions.join(', ')}`);
      
      console.log(`   ✅ Database folder clean (SQL, JS, DB files)`);
    });
    
    it('8. MUST NOT have versioned test files (e.g. v4.3-features.test.js)', () => {
      const testsPath = path.join(WEB_ROOT, 'tests');
      const files = fs.readdirSync(testsPath);
      
      const versioned = files.filter(f => /v\d+\.\d+/.test(f));
      
      assert.strictEqual(versioned.length, 0, 
        `Found versioned test files: ${versioned.join(', ')}. Use git for versioning!`);
      
      console.log(`   ✅ No versioned test files`);
    });
  });
  
  // ==================== MOBILE PROJECT TESTS ====================
  
  describe('📱 Mobile Project Structure', () => {
    
    it('1. MUST have version file in format 00XXX.version', () => {
      if (!fs.existsSync(MOBILE_ROOT)) {
        console.log('   ⚠️  Mobile project not found, skipping');
        return;
      }
      
      const files = fs.readdirSync(MOBILE_ROOT);
      const versionFiles = files.filter(f => /^\d{5}\.version$/.test(f));
      
      assert.strictEqual(versionFiles.length, 1, 
        `Expected exactly 1 version file, found: ${versionFiles.join(', ') || 'NONE'}`);
      
      console.log(`   ✅ Version file: ${versionFiles[0]}`);
    });
    
    it('2. MUST have ONLY allowed files in root', () => {
      if (!fs.existsSync(MOBILE_ROOT)) return;
      
      const files = fs.readdirSync(MOBILE_ROOT);
      const allowed = [
        '.gitignore',
        'App.js',
        'app.json',
        'babel.config.js',
        'eas.json',
        'index.js',
        'package.json',
        'package-lock.json',
        'metro.config.js'
      ];
      
      const versionFile = files.find(f => /^\d{5}\.version$/.test(f));
      if (versionFile) allowed.push(versionFile);
      
      const rootFiles = files.filter(f => {
        const stat = fs.statSync(path.join(MOBILE_ROOT, f));
        return stat.isFile();
      });
      
      const forbidden = rootFiles.filter(f => !allowed.includes(f));
      
      assert.strictEqual(forbidden.length, 0, 
        `Found forbidden files in mobile root: ${forbidden.join(', ')}`);
      
      console.log(`   ✅ Root files clean`);
    });
    
    it('3. MUST NOT have backend folders', () => {
      if (!fs.existsSync(MOBILE_ROOT)) return;
      
      const forbidden = [
        'database',
        'routes',
        'middleware',
        'scripts'
      ];
      
      const found = [];
      forbidden.forEach(folder => {
        if (fs.existsSync(path.join(MOBILE_ROOT, folder))) {
          found.push(folder);
        }
      });
      
      assert.strictEqual(found.length, 0, 
        `Found backend folders in mobile: ${found.join(', ')}. Mobile is FRONTEND ONLY!`);
      
      console.log(`   ✅ No backend folders`);
    });
    
    it('4. MUST have /assets folder', () => {
      if (!fs.existsSync(MOBILE_ROOT)) return;
      
      const assetsPath = path.join(MOBILE_ROOT, 'assets');
      assert(fs.existsSync(assetsPath), '/assets folder missing!');
      
      console.log(`   ✅ Assets folder exists`);
    });
  });
  
  // ==================== CROSS-PROJECT TESTS ====================
  
  describe('🔄 Cross-Project Validation', () => {
    
    it('1. Version numbers MUST match between web and mobile', () => {
      if (!fs.existsSync(MOBILE_ROOT)) {
        console.log('   ⚠️  Mobile project not found, skipping');
        return;
      }
      
      const webFiles = fs.readdirSync(WEB_ROOT);
      const mobileFiles = fs.readdirSync(MOBILE_ROOT);
      
      const webVersion = webFiles.find(f => /^\d{5}\.version$/.test(f));
      const mobileVersion = mobileFiles.find(f => /^\d{5}\.version$/.test(f));
      
      assert.strictEqual(webVersion, mobileVersion, 
        `Version mismatch! Web: ${webVersion}, Mobile: ${mobileVersion}`);
      
      console.log(`   ✅ Versions match: ${webVersion}`);
    });
    
    it('2. Assets MUST be identical in web and mobile', () => {
      if (!fs.existsSync(MOBILE_ROOT)) return;
      
      const webAssets = path.join(WEB_ROOT, 'assets');
      const mobileAssets = path.join(MOBILE_ROOT, 'assets');
      
      const webFiles = fs.readdirSync(webAssets);
      const mobileFiles = fs.readdirSync(mobileAssets);
      
      const missing = webFiles.filter(f => !mobileFiles.includes(f));
      
      assert.strictEqual(missing.length, 0, 
        `Assets missing in mobile: ${missing.join(', ')}`);
      
      console.log(`   ✅ Assets synced between projects`);
    });
  });
  
  // ==================== SUMMARY ====================
  
  after(() => {
    console.log('\n========================================');
    console.log('✅ STRUCTURE VALIDATION COMPLETE!');
    console.log('========================================\n');
  });
});

module.exports = {
  name: 'Project Structure Validation',
  tests: describe
};
