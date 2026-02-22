// Version: 1.0085
// Project Structure Validation Tests - kcy-ecosystem
// Run: npm test structure.test.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');

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

describe('kcy-ecosystem Structure Validation', () => {

  describe('Ecosystem Root', () => {

    it('MUST have version file (00XXX.version)', () => {
      const files = fs.readdirSync(ECOSYSTEM_ROOT);
      const versionFiles = files.filter(f => /^\d{5}\.version$/.test(f));
      assert.strictEqual(versionFiles.length, 1,
        `Expected 1 version file, found: ${versionFiles.join(', ') || 'NONE'}`);
    });

    it('MUST have main directories', () => {
      const required = ['private', 'public', 'tests', 'docs', 'deploy-scripts'];
      const missing = required.filter(d => !fs.existsSync(path.join(ECOSYSTEM_ROOT, d)));
      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });

    it('MUST have package.json with workspaces', () => {
      const pkgPath = path.join(ECOSYSTEM_ROOT, 'package.json');
      assert(fs.existsSync(pkgPath), 'Missing root package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert(pkg.workspaces, 'Missing workspaces config');
      assert(Array.isArray(pkg.workspaces), 'Workspaces must be array');
    });

    it('MUST have config files', () => {
      const required = ['jest.config.js', 'jest.setup.js', 'hardhat.config.js'];
      const missing = required.filter(f => !fs.existsSync(path.join(ECOSYSTEM_ROOT, f)));
      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });

  });

  describe('Private Directory', () => {

    it('MUST have all projects', () => {
      const required = ['token', 'multisig', 'chat', 'mobile-chat', 'eco-3'];
      const existing = fs.readdirSync(PRIVATE_DIR);
      const missing = required.filter(p => !existing.includes(p));
      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });

    it('Each project MUST have package.json', () => {
      const projects = ['token', 'multisig', 'chat', 'mobile-chat', 'eco-3'];
      const missing = projects.filter(p =>
        !fs.existsSync(path.join(PRIVATE_DIR, p, 'package.json'))
      );
      assert.strictEqual(missing.length, 0, `Missing package.json in: ${missing.join(', ')}`);
    });

    it('Token MUST have contracts', () => {
      const contractsPath = path.join(TOKEN_PRIVATE, 'contracts');
      assert(fs.existsSync(contractsPath), 'Missing contracts folder');
      const solFiles = fs.readdirSync(contractsPath).filter(f => f.endsWith('.sol'));
      assert(solFiles.length > 0, 'No .sol files found');
    });

    it('MultiSig MUST have contracts', () => {
      assert(fs.existsSync(path.join(MULTISIG_PRIVATE, 'contracts')), 'Missing contracts folder');
    });

    it('Chat MUST have server.js', () => {
      assert(fs.existsSync(path.join(CHAT_PRIVATE, 'server.js')), 'Missing server.js');
    });

    it('Chat MUST have database folder', () => {
      const dbPath = path.join(CHAT_PRIVATE, 'database');
      assert(fs.existsSync(dbPath), 'Missing database folder');
      assert(fs.existsSync(path.join(dbPath, 'db_setup.sql')), 'Missing db_setup.sql');
    });

    it('Mobile-chat MUST have App.js', () => {
      assert(fs.existsSync(path.join(MOBILE_PRIVATE, 'App.js')), 'Missing App.js');
    });

    it('ECO-3 MUST have server.js', () => {
      assert(fs.existsSync(path.join(ECO3_PRIVATE, 'server.js')), 'Missing eco-3/server.js');
    });

  });

  describe('Public Directory', () => {

    it('MUST have project folders', () => {
      const required = ['token', 'multisig', 'chat', 'eco-3', 'shared'];
      const existing = fs.readdirSync(PUBLIC_DIR);
      const missing = required.filter(p => !existing.includes(p));
      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
    });

    it('Chat public MUST have assets', () => {
      const assetsPath = path.join(CHAT_PUBLIC, 'assets');
      assert(fs.existsSync(assetsPath), 'Missing public/chat/assets');
      const required = ['icon-192.png', 'icon-512.png', 'manifest.json', 'sw.js'];
      const files = fs.readdirSync(assetsPath);
      const missing = required.filter(f => !files.includes(f));
      assert.strictEqual(missing.length, 0, `Missing assets: ${missing.join(', ')}`);
    });

    it('Token public MUST have website', () => {
      const websitePath = path.join(PUBLIC_DIR, 'token/website');
      assert(fs.existsSync(websitePath), 'Missing public/token/website');
      const htmlFiles = fs.readdirSync(websitePath).filter(f => f.endsWith('.html'));
      assert(htmlFiles.length > 0, 'No HTML files in website');
    });

  });

  describe('Tests Directory', () => {

    it('MUST have test folders for all projects', () => {
      const required = ['token', 'multisig', 'chat', 'mobile-chat'];
      const existing = fs.readdirSync(TESTS_DIR);
      const missing = required.filter(p => !existing.includes(p));
      assert.strictEqual(missing.length, 0, `Missing test folders: ${missing.join(', ')}`);
    });

    it('Chat tests MUST exist', () => {
      const testFiles = fs.readdirSync(path.join(TESTS_DIR, 'chat')).filter(f => f.endsWith('.test.js'));
      assert(testFiles.length > 0, 'No test files found');
    });

    it('Token tests MUST exist', () => {
      const testFiles = fs.readdirSync(path.join(TESTS_DIR, 'token')).filter(f => f.endsWith('.js'));
      assert(testFiles.length > 0, 'No test files found');
    });

  });

  describe('Documentation', () => {

    it('MUST have docs with markdown files', () => {
      assert(fs.existsSync(DOCS_DIR), 'Missing docs directory');
      const mdFiles = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
      assert(mdFiles.length > 0, 'No markdown files in docs');
    });

  });

  describe('Global Configuration', () => {

    it('MUST have private/configs/ directory', () => {
      assert(fs.existsSync(path.join(PRIVATE_DIR, 'configs')),
        'Missing private/configs/ — .env lives here');
    });

    it('.env MUST NOT exist in project subdirs or public/', () => {
      const found = [];

      if (fs.existsSync(path.join(PRIVATE_DIR, '.env')))
        found.push('private/.env');
      if (fs.existsSync(path.join(PUBLIC_DIR, '.env')))
        found.push('public/.env');
      if (fs.existsSync(path.join(ECOSYSTEM_ROOT, '.env')))
        found.push('.env (root)');

      const projectDirs = ['chat', 'eco-3', 'token', 'multisig', 'mobile-chat'];
      for (const proj of projectDirs) {
        const p = path.join(PRIVATE_DIR, proj, '.env');
        if (fs.existsSync(p) && !fs.lstatSync(p).isSymbolicLink())
          found.push(`private/${proj}/.env`);
      }

      if (found.length > 0) {
        const R = '\x1b[31m', Y = '\x1b[33m', G = '\x1b[32m', C = '\x1b[36m', N = '\x1b[0m';
        process.stderr.write('\n');
        process.stderr.write(`  ${R}╔══════════════════════════════════════════════════════╗${N}\n`);
        process.stderr.write(`  ${R}║${N}  ${Y}.env НАМЕРЕН НА ГРЕШНО МЯСТО!${N}\n`);
        process.stderr.write(`  ${R}╠══════════════════════════════════════════════════════╣${N}\n`);
        found.forEach(f => process.stderr.write(`  ${R}║${N}  ${Y}✗${N} ${f}\n`));
        process.stderr.write(`  ${R}╠══════════════════════════════════════════════════════╣${N}\n`);
        process.stderr.write(`  ${R}║${N}  ${G}Правилно:${N} ${C}private/configs/.env${N}\n`);
        process.stderr.write(`  ${R}╚══════════════════════════════════════════════════════╝${N}\n`);
        process.stderr.write('\n');
        const err = new Error('.env на грешно място');
        err.stack = '';
        throw err;
      }
    });

    it('Project configs/.env MUST be symlink to global (if exists)', () => {
      for (const proj of ['chat', 'eco-3']) {
        const envPath = path.join(PRIVATE_DIR, proj, 'configs', '.env');
        if (fs.existsSync(envPath)) {
          assert(fs.lstatSync(envPath).isSymbolicLink(),
            `${proj}/configs/.env exists but is NOT a symlink — must point to ../../configs/.env`);
          const target = fs.readlinkSync(envPath);
          assert(target.includes('configs/.env'),
            `${proj}/configs/.env symlink points to wrong target: ${target}`);
        }
      }
    });

  });

  describe('node_modules Structure', () => {

    it('MUST have ONLY ONE node_modules in root', () => {
      assert(fs.existsSync(path.join(ECOSYSTEM_ROOT, 'node_modules')), 'Missing root node_modules');
    });

    it('MUST NOT have node_modules in private projects', () => {
      const projects = ['token', 'multisig', 'chat', 'mobile-chat', 'eco-3'];
      const found = projects.filter(p =>
        fs.existsSync(path.join(PRIVATE_DIR, p, 'node_modules'))
      );
      assert.strictEqual(found.length, 0,
        `Found node_modules in: ${found.join(', ')} - should use root only!`);
    });

  });

});
