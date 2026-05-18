#!/usr/bin/env node
// Version: 1.0087
// Portals DB Tests — Standalone runner (без jest/mocha framework)
// Изпълнение:
//   node tests/portals/run.js
//
// Изисква: npm install в private/portals (за better-sqlite3)

const fs = require('fs');
const path = require('path');
const Module = require('module');

// ANSI colors
const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

// Minimal mocha-compatible API
const _suites = [];
let _current = null;
function describe(name, fn) {
    const suite = { name, tests: [], hooks: { before: [], after: [], beforeEach: [], afterEach: [] }, parent: _current };
    if (_current) _current.tests.push({ suite });
    else _suites.push(suite);
    const prev = _current;
    _current = suite;
    try { fn(); } finally { _current = prev; }
}
function it(name, fn)        { _current.tests.push({ name, fn }); }
function before(fn)          { _current.hooks.before.push(fn); }
function after(fn)           { _current.hooks.after.push(fn); }
function beforeEach(fn)      { _current.hooks.beforeEach.push(fn); }
function afterEach(fn)       { _current.hooks.afterEach.push(fn); }
global.describe = describe;
global.it = it;
global.before = before;
global.after = after;
global.beforeEach = beforeEach;
global.afterEach = afterEach;

// Check че better-sqlite3 е инсталиран (с workspaces се хоиства в root node_modules)
function findBetterSqlite3() {
    const candidates = [
        path.join(__dirname, '../../node_modules/better-sqlite3'),
        path.join(__dirname, '../../private/portals/node_modules/better-sqlite3'),
        path.join(__dirname, '../../private/eco-3/node_modules/better-sqlite3'),
        path.join(__dirname, '../../private/chat/node_modules/better-sqlite3'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(path.join(p, 'package.json'))) return p;
    }
    return null;
}
const bsqlPath = findBetterSqlite3();
if (!bsqlPath) {
    console.error(`${RED}✗ better-sqlite3 не е намерен${NC}`);
    console.error(`  Изпълни: ${YELLOW}npm install${NC} от root на проекта`);
    process.exit(1);
}
console.log(`Using better-sqlite3 от: ${bsqlPath}`);

const TEST_FILES = [
    'database-schema.test.js',
    'database-crud.test.js'
];

// Принуждаваме require('better-sqlite3') в test файловете да резолва към намерения път
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
    if (request === 'better-sqlite3') return require.resolve(bsqlPath);
    return origResolve.call(this, request, parent, ...rest);
};

console.log(`${CYAN}═══ Portals DB Tests ═══${NC}\n`);

for (const f of TEST_FILES) {
    require(path.join(__dirname, f));
}

let totalPass = 0, totalFail = 0;
const failures = [];

async function runHooks(hooks) {
    for (const h of hooks) await h();
}

async function runSuite(suite, indent = '') {
    console.log(`${indent}${CYAN}${suite.name}${NC}`);
    await runHooks(suite.hooks.before);

    for (const item of suite.tests) {
        if (item.suite) {
            await runSuite(item.suite, indent + '  ');
        } else {
            await runHooks(suite.hooks.beforeEach);
            try {
                await item.fn();
                console.log(`${indent}  ${GREEN}✓${NC} ${item.name}`);
                totalPass++;
            } catch (err) {
                console.log(`${indent}  ${RED}✗${NC} ${item.name}`);
                console.log(`${indent}    ${RED}${err.message}${NC}`);
                totalFail++;
                failures.push({ name: item.name, err });
            }
            await runHooks(suite.hooks.afterEach);
        }
    }
    await runHooks(suite.hooks.after);
}

(async () => {
    for (const s of _suites) await runSuite(s);

    console.log(`\n${CYAN}═══ Резултат ═══${NC}`);
    console.log(`  ${GREEN}Passed:${NC} ${totalPass}`);
    if (totalFail > 0) {
        console.log(`  ${RED}Failed:${NC} ${totalFail}`);
        process.exit(1);
    } else {
        console.log(`  ${GREEN}Всички тестове минават ✓${NC}`);
        process.exit(0);
    }
})();
