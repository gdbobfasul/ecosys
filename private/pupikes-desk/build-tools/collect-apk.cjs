#!/usr/bin/env node
// collect-apk.cjs — намира най-новия компилиран .apk под android/app/build/outputs/apk/
// и го копира в release/ с ясно име (<productName>-<version>-android.apk). Част от самото
// приложение (не еднократен скрипт) — вика се от „npm run android:apk".
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APK_BASE = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk');
const RELEASE = path.join(ROOT, 'release');

function pkgInfo() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return { name: p.productName || p.name || 'app', version: p.version || '1.0.0' };
  } catch (_) { return { name: 'app', version: '1.0.0' }; }
}

function findApks(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findApks(full));
    else if (entry.name.endsWith('.apk')) out.push(full);
  }
  return out;
}

const apks = findApks(APK_BASE).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
if (!apks.length) {
  console.error('✗ Няма .apk под ' + APK_BASE + ' — първо компилирай (gradlew assembleDebug/assembleRelease).');
  process.exit(1);
}
fs.mkdirSync(RELEASE, { recursive: true });
const { name, version } = pkgInfo();
const variant = /release/i.test(apks[0]) ? 'release' : 'debug';
const dest = path.join(RELEASE, `${name}-${version}-android-${variant}.apk`);
fs.copyFileSync(apks[0], dest);
console.log('✓ APK → ' + path.relative(ROOT, dest) + '  (от ' + path.relative(ROOT, apks[0]) + ')');
