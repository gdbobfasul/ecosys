#!/usr/bin/env node
/*
 * Пуска Gradle обвивката за Android (assembleDebug) НЕЗАВИСИМО от обвивката (cmd или Git Bash).
 * Причина: `cd android && gradlew.bat` гърми под Git Bash („gradlew.bat is not recognized"), а менюто
 * (00-menu.sh) върви точно под bash. Тук стартираме правилната обвивка с node → работи и в двата случая.
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const ANDROID = path.join(__dirname, '..', 'android');
const isWin = process.platform === 'win32';
const wrapper = isWin ? path.join(ANDROID, 'gradlew.bat') : path.join(ANDROID, 'gradlew');

console.log('  [build-apk] ' + wrapper + ' assembleDebug  (cwd=' + ANDROID + ')');
const r = spawnSync(wrapper, ['assembleDebug', '--console=plain'], { cwd: ANDROID, stdio: 'inherit', shell: isWin });
if (r.error) { console.error('  [build-apk] ГРЕШКА: ' + r.error.message); process.exit(1); }
process.exit(r.status == null ? 1 : r.status);
