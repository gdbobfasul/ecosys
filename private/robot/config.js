// Version: 1.0173
// Робот за тестване — конфигурация (чете от ENV с разумни подразбирания).
'use strict';
const path = require('path');

// Цели за тестване. ВАЖНО (сигурност):
//   prod → САМО критични пътища + read-only (без разрушителни действия).
//   vm   → позволен е fuzz/random (идва в следваща фаза). Самоподписан TLS → ignore.
const TARGETS = {
  prod: {
    base: process.env.ROBOT_PROD_URL || 'https://alsec.strangled.net',
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
  treeJson: path.join(__dirname, '..', '..', 'public', 'tree', 'tree.json'),
  headless: process.env.ROBOT_HEADED ? false : true,
};
