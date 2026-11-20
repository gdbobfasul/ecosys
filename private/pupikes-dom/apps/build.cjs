#!/usr/bin/env node
'use strict';
/* Pupikes Дом — билд на нативните обвивки по роля.
 * За всяка роля: Capacitor APK със server.url към хостнатата роля-страница (owner.html…).
 * Център: освен APK, и Electron .exe (десктоп конзола). Ролята/правата се налагат от СЪРВЪРА.
 *
 * Пуска се ПРЕЗ СТАРТ-МЕНЮТО (не ръчно). Използване:
 *   node build.cjs [--only apk|exe] [--domain <домейн>] [--roles owner,tech,...]
 * Домейн по подразбиране: roles.json.domainDefault (take.offbitch.com) или env PUPIKES_DOM_DOMAIN.
 * Изход: release/ (по една инсталируема обвивка на роля).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const WIN = process.platform === 'win32';
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'roles.json'), 'utf8'));
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// ── аргументи ──
const args = process.argv.slice(2);
const argVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const ONLY = argVal('--only');                         // 'apk' | 'exe' | null(=двете)
const DOMAIN = argVal('--domain') || process.env.PUPIKES_DOM_DOMAIN || CFG.domainDefault;
const ONLY_ROLES = (argVal('--roles') || '').split(',').map(s => s.trim()).filter(Boolean);
const BASEURL = 'https://' + DOMAIN + CFG.basePath;    // https://<домейн>/dom
const RELEASE = path.join(ROOT, 'release');
const ANDROID = path.join(ROOT, 'android');
const VERSION = PKG.version || '1.0.0';

const C = { g: '\x1b[32m', y: '\x1b[33m', r: '\x1b[31m', c: '\x1b[36m', x: '\x1b[0m' };
const log = (s) => console.log(s);
const run = (cmd, cwd) => execSync(cmd, { cwd: cwd || ROOT, stdio: 'inherit', shell: true });
const runQuiet = (cmd, cwd) => execSync(cmd, { cwd: cwd || ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

function haveNpx() { try { runQuiet(WIN ? 'where npx' : 'command -v npx'); return true; } catch { return false; } }
function haveAndroidSdk() { return !!(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT); }

let rolesToBuild = CFG.roles;
if (ONLY_ROLES.length) rolesToBuild = rolesToBuild.filter(r => ONLY_ROLES.includes(r.role));

fs.mkdirSync(RELEASE, { recursive: true });
log(`${C.c}━━━ Pupikes Дом — билд на обвивките ━━━${C.x}`);
log(`  Домейн: ${C.g}${DOMAIN}${C.x} · база: ${BASEURL} · версия: ${VERSION}`);
log(`  Роли: ${rolesToBuild.map(r => r.role).join(', ')}  ·  цел: ${ONLY || 'apk+exe'}`);

// ── APK-та (Capacitor) ──
function writeCapConfig(role) {
  const cfg = {
    appId: CFG.namespace,                 // namespace (пакет на кода) — еднакъв
    appName: role.appName,
    webDir: 'web',
    server: { androidScheme: 'https', url: BASEURL + '/' + role.entry, cleartext: false }
  };
  fs.writeFileSync(path.join(ROOT, 'capacitor.config.json'), JSON.stringify(cfg, null, 2));
}
function setApplicationId(appId) {
  const gradle = path.join(ANDROID, 'app', 'build.gradle');
  let s = fs.readFileSync(gradle, 'utf8');
  s = s.replace(/applicationId\s+"[^"]*"/, `applicationId "${appId}"`);
  fs.writeFileSync(gradle, s);
}
function setAppLabel(label) {
  const strings = path.join(ANDROID, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  if (!fs.existsSync(strings)) return;
  let s = fs.readFileSync(strings, 'utf8');
  s = s.replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${label}$2`);
  s = s.replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${label}$2`);
  fs.writeFileSync(strings, s);
}
function newestApk() {
  const base = path.join(ANDROID, 'app', 'build', 'outputs', 'apk');
  const found = [];
  (function walk(d) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith('.apk')) found.push(f); } })(base);
  return found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

// ── FCM push (включва се САМО ако има google-services.json в apps/) ──
const GSVC = path.join(ROOT, 'google-services.json');
const PUSH = fs.existsSync(GSVC);
function setupPushPlugin() {
  if (!PUSH) return;
  if (!fs.existsSync(path.join(ROOT, 'node_modules', '@capacitor', 'push-notifications'))) {
    log(`${C.c}  + @capacitor/push-notifications (намерен google-services.json → push ВКЛ.)${C.x}`);
    try { run('npm install @capacitor/push-notifications@^6.0.0 --no-audit --no-fund'); } catch (e) { log(`${C.y}  ! push плъгин install: ${e.message}${C.x}`); }
  }
}
function copyGoogleServices() {
  if (!PUSH || !fs.existsSync(ANDROID)) return;
  try { fs.copyFileSync(GSVC, path.join(ANDROID, 'app', 'google-services.json')); } catch (e) { log(`${C.y}  ! копиране на google-services.json: ${e.message}${C.x}`); }
}
function applyGoogleServicesGradle() {
  if (!PUSH) return;
  try {
    const pg = path.join(ANDROID, 'build.gradle'); let s = fs.readFileSync(pg, 'utf8');
    if (!/com\.google\.gms:google-services/.test(s)) { s = s.replace(/(dependencies\s*\{)/, `$1\n        classpath 'com.google.gms:google-services:4.4.2'`); fs.writeFileSync(pg, s); }
  } catch (e) {}
  try {
    const ag = path.join(ANDROID, 'app', 'build.gradle'); let s = fs.readFileSync(ag, 'utf8');
    if (!/google-services/.test(s)) { s = s.trimEnd() + `\napply plugin: 'com.google.gms.google-services'\n`; fs.writeFileSync(ag, s); }
  } catch (e) {}
}

const summary = [];
const wantApk = (ONLY !== 'exe');
const wantExe = (ONLY !== 'apk');

if (wantApk) {
  if (!haveNpx()) { log(`${C.y}  ! npm/npx липсва — пропускам APK.${C.x}`); }
  else if (!haveAndroidSdk()) { log(`${C.y}  ! Няма Android SDK (ANDROID_HOME) — пропускам APK (.exe не зависи от това).${C.x}`); }
  else {
    try {
      // платформата се създава веднъж (namespace = CFG.namespace)
      writeCapConfig(rolesToBuild.find(r => r.targets.includes('apk')) || CFG.roles[0]);
      setupPushPlugin();
      if (!fs.existsSync(ANDROID)) { log(`${C.c}  cap add android…${C.x}`); run('npx cap add android'); }
      copyGoogleServices();
      log(PUSH ? `${C.g}  push: ВКЛЮЧЕН (google-services.json намерен)${C.x}` : `${C.y}  push: изключен (няма google-services.json — APK работи, но без известия)${C.x}`);
      const gradlew = WIN ? 'gradlew.bat' : './gradlew';
      for (const role of rolesToBuild) {
        if (!role.targets.includes('apk')) continue;
        log(`\n${C.c}── APK: ${role.role} (${role.appId}) → ${BASEURL}/${role.entry}${C.x}`);
        try {
          writeCapConfig(role);
          run('npx cap sync android');
          copyGoogleServices(); applyGoogleServicesGradle();
          setApplicationId(role.appId);
          setAppLabel(role.appName);
          run(`${gradlew} assembleDebug`, ANDROID);
          const apk = newestApk();
          if (apk) {
            const dest = path.join(RELEASE, `Pupikes-Dom-${role.role}-${VERSION}-debug.apk`);
            fs.copyFileSync(apk, dest);
            summary.push(`${C.g}✓${C.x} APK ${role.role} → release/${path.basename(dest)}`);
          } else summary.push(`${C.r}✗${C.x} APK ${role.role}: не намерих .apk`);
        } catch (e) { summary.push(`${C.r}✗${C.x} APK ${role.role}: ${String(e.message || e).split('\n')[0]}`); }
      }
    } catch (e) { log(`${C.r}  ✗ APK подготовка се провали: ${e.message}${C.x}`); }
  }
}

// ── Electron .exe (Център) ──
if (wantExe) {
  const centerRole = CFG.roles.find(r => r.role === 'center' && r.targets.includes('exe'));
  if (centerRole && (!ONLY_ROLES.length || ONLY_ROLES.includes('center'))) {
    try {
      fs.mkdirSync(path.join(ROOT, 'electron'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, 'electron', 'url.json'), JSON.stringify({ url: BASEURL + '/' + centerRole.entry }, null, 2));
      log(`\n${C.c}── .exe: Център → ${BASEURL}/${centerRole.entry}${C.x}`);
      run('npx electron-builder --win');
      const outs = fs.existsSync(RELEASE) ? fs.readdirSync(RELEASE).filter(f => /\.exe$/i.test(f)) : [];
      outs.forEach(o => summary.push(`${C.g}✓${C.x} .exe Център → release/${o}`));
      if (!outs.length) summary.push(`${C.y}◦${C.x} .exe: не намерих .exe в release/`);
    } catch (e) { summary.push(`${C.r}✗${C.x} .exe Център: ${String(e.message || e).split('\n')[0]}`); }
  }
}

log(`\n${C.c}━━━ Обобщение ━━━${C.x}`);
summary.forEach(s => log('  ' + s));
log(`\n  Готовите обвивки са в: ${C.g}${RELEASE}${C.x}`);
log(`  ${C.y}Забележка:${C.x} APK-тата са DEBUG (за тест). Push на телефона иска FCM ключ (google-services.json) — отделна стъпка.`);
