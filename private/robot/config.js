// Version: 1.0173
// Робот за тестване — конфигурация (чете от ENV с разумни подразбирания).
'use strict';
const path = require('path');
const fs = require('fs');

// Главният домейн идва от ЕДИННАТА конфигурация (private/configs/domains.conf) — нула хардкод.
function mainDomain() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '..', 'configs', 'domains.conf'), 'utf8');
    const m = txt.match(/^\s*MAIN_DOMAIN="?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  } catch (e) { /* конфигът липсва — пада на ENV/localhost */ }
  return null;
}
const MAIN_DOMAIN = mainDomain();

// Цели за тестване. ВАЖНО (сигурност):
//   prod → САМО критични пътища + read-only (без разрушителни действия).
//   vm   → позволен е fuzz/random (идва в следваща фаза). Самоподписан TLS → ignore.
const TARGETS = {
  prod: {
    base: process.env.ROBOT_PROD_URL || (MAIN_DOMAIN ? 'https://' + MAIN_DOMAIN : 'http://localhost'),
    allowFuzz: false,
    ignoreHTTPSErrors: false,
  },
  vm: {
    base: process.env.ROBOT_VM_URL || 'https://192.168.0.108',
    allowFuzz: true,
    ignoreHTTPSErrors: true,
  },
};

module.exports = {
  TARGETS,
  defaultTarget: 'prod',
  navTimeoutMs: Number(process.env.ROBOT_NAV_TIMEOUT || 25000),
  settleMs: Number(process.env.ROBOT_SETTLE_MS || 1500), // изчакване след зареждане за да изскочат console грешки
  bundlePath: '/last-errors-bundle',                     // сървърен лог за корелация (kcy-diag :4400)
  reportsDir: process.env.ROBOT_REPORTS_DIR || path.join(__dirname, 'reports'),
  // 9-те робот лога (фази 1-4 + 5 приложения) — на сървъра: /var/www/html/last-errors/robot-logs/
  robotLogDir: process.env.ROBOT_LOG_DIR || path.join(__dirname, 'robot-logs'),
  // tree.json: локално е в repo/public/tree; на сървъра tree-gen го пише в web root
  // (/var/www/html/tree) → diag подава ROBOT_TREE_JSON натам.
  treeJson: process.env.ROBOT_TREE_JSON || path.join(__dirname, '..', '..', 'public', 'tree', 'tree.json'),
  headless: process.env.ROBOT_HEADED ? false : true,
};
