// Version: 1.0085
// Project Structure Validation Tests - kcy-ecosystem
// Run: npm test structure.test.js
//
// ============================================
// ИНСТАЛИРАНЕ НА ТЕСТОВАТА СРЕДА (Windows):
// ============================================
// rm -rf node_modules package-lock.json
// npm install --legacy-peer-deps
// npm test
// ============================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Paths for kcy-ecosystem structure
const ECOSYSTEM_ROOT = path.join(__dirname, '../..');
const PRIVATE_DIR = path.join(ECOSYSTEM_ROOT, 'private');
const PUBLIC_DIR = path.join(ECOSYSTEM_ROOT, 'public');
const TESTS_DIR = path.join(ECOSYSTEM_ROOT, 'tests');
const DOCS_DIR = path.join(ECOSYSTEM_ROOT, 'docs');

const CHAT_PRIVATE = path.join(PRIVATE_DIR, 'chat');
const CHAT_PUBLIC = path.join(PUBLIC_DIR, 'chat');
const TOKEN_PRIVATE = path.join(PRIVATE_DIR, 'token');
const MULTISIG_PRIVATE = path.join(PRIVATE_DIR, 'multisig');
const MOBILE_PRIVATE = path.join(PRIVATE_DIR, 'mobile-chat');
const ECO3_PRIVATE = path.join(PRIVATE_DIR, 'eco-3');
const ECO3_PUBLIC = path.join(PUBLIC_DIR, 'eco-3');

describe('📁 kcy-ecosystem Structure Validation', () => {
  
  before(() => {
    console.log(`\n   🔍 Testing kcy-ecosystem structure`);
    console.log(`   📂 Root: ${ECOSYSTEM_ROOT}\n`);
  });
  
  // ==================== ROOT STRUCTURE ====================
  
  describe('🏗️ Ecosystem Root', () => {
    
    it('MUST have version file (00XXX.version)', () => {
      const files = fs.readdirSync(ECOSYSTEM_ROOT);
      const versionFiles = files.filter(f => /^\d{5}\.version$/.test(f));
      
      assert.strictEqual(versionFiles.length, 1, 
        `Expected 1 version file, found: ${versionFiles.join(', ') || 'NONE'}`);
      
      console.log(`   ✅ Version: ${versionFiles[0]}`);
    });

    it('MUST have main directories', () => {
      const required = ['private', 'public', 'tests', 'docs', 'deploy-scripts'];
      const missing = required.filter(d => !fs.existsSync(path.join(ECOSYSTEM_ROOT, d)));
      
      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
      console.log(`   ✅ All main directories exist`);
    });
    
    it('MUST have package.json with workspaces', () => {
      const pkgPath = path.join(ECOSYSTEM_ROOT, 'package.json');
      assert(fs.existsSync(pkgPath), 'Missing root package.json');
      
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert(pkg.workspaces, 'Missing workspaces config');
      assert(Array.isArray(pkg.workspaces), 'Workspaces must be array');
      
      console.log(`   ✅ Workspaces: ${pkg.workspaces.length} projects`);
    });

    it('MUST have config files', () => {
      const required = ['jest.config.js', 'jest.setup.js', 'hardhat.config.js'];
      const missing = required.filter(f => !fs.existsSync(path.join(ECOSYSTEM_ROOT, f)));
      
      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
      console.log(`   ✅ All config files exist`);
    });
    
  });
  
  // ==================== PRIVATE STRUCTURE ====================
  
  describe('🔒 Private Directory', () => {
    
    it('MUST have all projects', () => {
      const required = ['token', 'multisig', 'chat', 'mobile-chat', 'eco-3'];
      const existing = fs.readdirSync(PRIVATE_DIR);
      const missing = required.filter(p => !existing.includes(p));
      
      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
      console.log(`   ✅ All ${required.length} projects exist`);
    });
    
    it('Each project MUST have package.json', () => {
      const projects = ['token', 'multisig', 'chat', 'mobile-chat', 'eco-3'];
      const missing = projects.filter(p => 
        !fs.existsSync(path.join(PRIVATE_DIR, p, 'package.json'))
      );
      
      assert.strictEqual(missing.length, 0, `Missing package.json in: ${missing.join(', ')}`);
      console.log(`   ✅ All projects have package.json`);
    });

    it('Token MUST have contracts', () => {
      const contractsPath = path.join(TOKEN_PRIVATE, 'contracts');
      assert(fs.existsSync(contractsPath), 'Missing contracts folder');
      
      const files = fs.readdirSync(contractsPath);
      const solFiles = files.filter(f => f.endsWith('.sol'));
      assert(solFiles.length > 0, 'No .sol files found');
      
      console.log(`   ✅ Token has ${solFiles.length} contracts`);
    });

    it('MultiSig MUST have contracts', () => {
      const contractsPath = path.join(MULTISIG_PRIVATE, 'contracts');
      assert(fs.existsSync(contractsPath), 'Missing contracts folder');
      console.log(`   ✅ MultiSig has contracts`);
    });

    it('Chat MUST have server.js', () => {
      const serverPath = path.join(CHAT_PRIVATE, 'server.js');
      assert(fs.existsSync(serverPath), 'Missing server.js');
      console.log(`   ✅ Chat has server.js`);
    });

    it('Chat MUST have database folder', () => {
      const dbPath = path.join(CHAT_PRIVATE, 'database');
      assert(fs.existsSync(dbPath), 'Missing database folder');
      
      const dbSetup = path.join(dbPath, 'db_setup.sql');
      assert(fs.existsSync(dbSetup), 'Missing db_setup.sql');
      
      console.log(`   ✅ Chat has database with db_setup.sql`);
    });

    it('Mobile-chat MUST have App.js', () => {
      const appPath = path.join(MOBILE_PRIVATE, 'App.js');
      assert(fs.existsSync(appPath), 'Missing App.js');
      console.log(`   ✅ Mobile-chat has App.js`);
    });

    it('ECO-3 MUST have server.js', () => {
      const serverPath = path.join(ECO3_PRIVATE, 'server.js');
      assert(fs.existsSync(serverPath), 'Missing eco-3/server.js');
      console.log(`   ✅ ECO-3 has server.js`);
    });
    
  });
  
  // ==================== PUBLIC STRUCTURE ====================
  
  describe('🌐 Public Directory', () => {
    
    it('MUST have project folders', () => {
      const required = ['token', 'multisig', 'chat', 'eco-3', 'shared'];
      const existing = fs.readdirSync(PUBLIC_DIR);
      const missing = required.filter(p => !existing.includes(p));
      
      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
      console.log(`   ✅ All public folders exist`);
    });

    it('Chat public MUST have assets', () => {
      const assetsPath = path.join(CHAT_PUBLIC, 'assets');
      assert(fs.existsSync(assetsPath), 'Missing public/chat/assets');
      
      const required = ['icon-192.png', 'icon-512.png', 'manifest.json', 'sw.js'];
      const files = fs.readdirSync(assetsPath);
      const missing = required.filter(f => !files.includes(f));
      
      assert.strictEqual(missing.length, 0, `Missing assets: ${missing.join(', ')}`);
      console.log(`   ✅ Chat assets complete`);
    });

    it('Token public MUST have website', () => {
      const websitePath = path.join(PUBLIC_DIR, 'token/website');
      assert(fs.existsSync(websitePath), 'Missing public/token/website');
      
      const files = fs.readdirSync(websitePath);
      const htmlFiles = files.filter(f => f.endsWith('.html'));
      assert(htmlFiles.length > 0, 'No HTML files in website');
      
      console.log(`   ✅ Token website has ${htmlFiles.length} HTML files`);
    });
    
  });
  
  // ==================== TESTS STRUCTURE ====================
  
  describe('🧪 Tests Directory', () => {
    
    it('MUST have test folders for all projects', () => {
      const required = ['token', 'multisig', 'chat', 'mobile-chat'];
      const existing = fs.readdirSync(TESTS_DIR);
      const missing = required.filter(p => !existing.includes(p));
      
      assert.strictEqual(missing.length, 0, `Missing test folders: ${missing.join(', ')}`);
      console.log(`   ✅ All test folders exist`);
    });

    it('Chat tests MUST exist', () => {
      const chatTests = path.join(TESTS_DIR, 'chat');
      const files = fs.readdirSync(chatTests);
      const testFiles = files.filter(f => f.endsWith('.test.js'));
      
      assert(testFiles.length > 0, 'No test files found');
      console.log(`   ✅ Chat has ${testFiles.length} test files`);
    });

    it('Token tests MUST exist', () => {
      const tokenTests = path.join(TESTS_DIR, 'token');
      const files = fs.readdirSync(tokenTests);
      const testFiles = files.filter(f => f.endsWith('.js'));
      
      assert(testFiles.length > 0, 'No test files found');
      console.log(`   ✅ Token has ${testFiles.length} test files`);
    });
    
  });
  
  // ==================== DOCS STRUCTURE ====================
  
  describe('📚 Documentation', () => {
    
    it('MUST have docs directory', () => {
      assert(fs.existsSync(DOCS_DIR), 'Missing docs directory');
      
      const files = fs.readdirSync(DOCS_DIR);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      assert(mdFiles.length > 0, 'No markdown files in docs');
      console.log(`   ✅ Docs has ${mdFiles.length} markdown files`);
    });
    
  });
  
  // ==================== GLOBAL CONFIG ====================
  
  describe('⚙️ Global Configuration', () => {

    it('MUST have private/configs/ directory', () => {
      assert(fs.existsSync(path.join(PRIVATE_DIR, 'configs')), 
        'Missing private/configs/ — .env lives here');
      console.log(`   ✅ private/configs/ exists`);
    });

    it('.env MUST NOT exist anywhere except private/configs/', () => {
      const found = [];
      
      // Check each project dir for stray .env files
      const projectDirs = ['chat', 'eco-3', 'token', 'multisig', 'mobile-chat'];
      for (const proj of projectDirs) {
        const projRoot = path.join(PRIVATE_DIR, proj, '.env');
        if (fs.existsSync(projRoot) && !fs.lstatSync(projRoot).isSymbolicLink()) {
          found.push(`private/${proj}/.env`);
        }
      }
      
      // Check root
      const rootEnv = path.join(ECOSYSTEM_ROOT, '.env');
      if (fs.existsSync(rootEnv)) {
        found.push('.env (root)');
      }
      
      // Check public
      const publicEnv = path.join(PUBLIC_DIR, '.env');
      if (fs.existsSync(publicEnv)) {
        found.push('public/.env');
      }
      
      assert.strictEqual(found.length, 0, 
        `.env found in wrong locations: ${found.join(', ')} — must ONLY be in private/configs/.env`);
      console.log(`   ✅ No stray .env files found`);
    });

    it('Project configs/.env MUST be symlink to global (if exists)', () => {
      const checked = [];
      for (const proj of ['chat', 'eco-3']) {
        const envPath = path.join(PRIVATE_DIR, proj, 'configs', '.env');
        if (fs.existsSync(envPath)) {
          if (fs.lstatSync(envPath).isSymbolicLink()) {
            const target = fs.readlinkSync(envPath);
            assert(target.includes('configs/.env'), 
              `${proj}/configs/.env symlink points to wrong target: ${target}`);
            checked.push(proj);
          } else {
            assert.fail(`${proj}/configs/.env exists but is NOT a symlink — must point to ../../configs/.env`);
          }
        }
      }
      if (checked.length > 0) {
        console.log(`   ✅ Symlinks OK: ${checked.join(', ')}`);
      } else {
        console.log(`   ⚠️  No configs/.env symlinks found (OK if running locally)`);
      }
    });
    
  });

  // ==================== NO node_modules IN SUBDIRS ====================
  
  describe('📦 node_modules Structure', () => {
    
    it('MUST have ONLY ONE node_modules in root', () => {
      const rootNodeModules = path.join(ECOSYSTEM_ROOT, 'node_modules');
      assert(fs.existsSync(rootNodeModules), 'Missing root node_modules');
      
      console.log(`   ✅ Root node_modules exists`);
    });

    it('MUST NOT have node_modules in private projects', () => {
      const projects = ['token', 'multisig', 'chat', 'mobile-chat', 'eco-3'];
      const found = projects.filter(p => 
        fs.existsSync(path.join(PRIVATE_DIR, p, 'node_modules'))
      );
      
      assert.strictEqual(found.length, 0, 
        `Found node_modules in: ${found.join(', ')} - should use root only!`);
      
      console.log(`   ✅ No node_modules in subdirectories`);
    });
    
  });
  
});
