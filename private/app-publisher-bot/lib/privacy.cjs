// privacy.cjs — генерира политика за поверителност (hw + ru издание) от профила на приложението.
// Съдържанието се сглобява според dataHandling (събира ли лични данни, разрешения, мрежа), за да е
// ВЯРНО за всяко приложение. Пише в <ап>/publish/ и в public/privacy/<ап>/ (постоянни адреси).
const fs = require('fs');
const path = require('path');

const SUPPORT_EMAIL = 'dai.group.ltd.support@gmail.com';

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Изгражда тялото на политиката според профила.
function buildBody(appName, pkg, store, profile) {
  const dh = profile.dataHandling || {};
  const S = [];
  let n = 0;
  const h2 = (t) => `<h2>${++n}. ${t}</h2>`;

  // Раздел 1 — лични данни.
  if (dh.collectsPersonalData) {
    S.push(h2('Personal data'));
    S.push(`<p>This application connects to an online service. To provide the service, data you enter — ${dh.accountsOrLogin ? 'including account/registration details and ' : ''}the messages and content you send — is transmitted to and stored on the server, and therefore leaves your device. We do not sell your data or use third-party advertising or tracking SDKs.</p>`);
  } else {
    S.push(h2('We do not collect personal data'));
    S.push(`<p>This application has <strong>no user accounts, no registration and no login by us</strong>. We do not collect, store or transmit personal information such as your name, email, phone number, contacts or precise location. We do not use advertising or third-party analytics / tracking SDKs.</p>`);
  }

  // Раздел 2 — локално съхранение.
  S.push(h2('Data stored on your device'));
  S.push(`<p>Your settings and app data (such as the interface language you choose${dh.storesLocalOnly ? ', and any content the app keeps for you' : ''}) are stored <strong>locally on your device</strong>. This data is removed when you uninstall the app.</p>`);

  // Раздел 3 — разрешения (само реално ползваните).
  const perms = [];
  if (dh.camera) perms.push('<li><strong>Camera</strong> — used only for the app\'s camera feature; the image is processed on your device and is not uploaded by us.</li>');
  if (dh.microphone) perms.push('<li><strong>Microphone</strong> — used only when you talk to the app by voice; audio is processed for speech recognition and is not stored or uploaded by us.</li>');
  if (dh.location) perms.push('<li><strong>Location</strong> — used only for the stated location feature.</li>');
  if (dh.notifications) perms.push('<li><strong>Notifications</strong> — used only to show you local alerts from the app on your device.</li>');
  if (perms.length) {
    S.push(h2('Device permissions'));
    S.push('<p>The app requests a permission only when a feature needs it:</p>');
    S.push('<ul>' + perms.join('') + '</ul>');
  }

  // Раздел 4 — мрежа.
  S.push(h2('Network'));
  if (dh.network) {
    S.push(`<p>The app uses the internet for its stated functions. ${esc(dh.notes || '')}</p>`);
  } else {
    S.push(`<p>The app works fully offline and makes no network requests.</p>`);
  }

  // Раздел 5 — деца.
  S.push(h2('Children'));
  S.push('<p>The app does not target children and does not knowingly collect any data from anyone.</p>');

  // Раздел 6 — промени.
  S.push(h2('Changes'));
  S.push('<p>If this policy changes, the updated version will be published at this address.</p>');

  // Раздел 7 — контакт.
  S.push(h2('Contact'));
  S.push(`<p>For any question about privacy or the app, write to: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`);

  return S.join('\n');
}

function page(appName, pkg, store, profile) {
  const body = buildBody(appName, pkg, store, profile);
  return `<!DOCTYPE html>
<!-- Version: 1.0001 -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — ${esc(pkg)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 820px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a1a1a; background: #fff; }
  h1 { font-size: 1.6rem; } h2 { font-size: 1.15rem; margin-top: 1.6em; }
  code { background: #f0f0f3; padding: 1px 5px; border-radius: 4px; }
  .muted { color: #666; font-size: .92rem; }
  a { color: #2a7cf0; }
  ul { padding-left: 1.2em; }
  @media (prefers-color-scheme: dark) { body { color: #eee; background: #16171b; } code { background: #26272c; } }
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p class="muted">App package: <code>${esc(pkg)}</code> · Store: ${esc(store)} · Provider: Dai Grup Ltd.</p>

<p>${esc(profile.pitchEn || '')}</p>

${body}

</body>
</html>
`;
}

// appDir = huawei/<ап>. repoRoot = коренът на репото. profile = запис от profiles.json.
function generatePrivacy(appDir, repoRoot, profile) {
  const appBase = path.basename(appDir);
  let capHw = {}; try { capHw = JSON.parse(fs.readFileSync(path.join(appDir, 'capacitor.config.json'), 'utf8')); } catch (_) {}
  let capRu = {}; try { capRu = JSON.parse(fs.readFileSync(path.join(repoRoot, 'rustore', appBase, 'capacitor.config.json'), 'utf8')); } catch (_) {}
  const appName = capHw.appName || appBase;
  const pkgHw = capHw.appId || ('com.pupikes.' + appBase.replace(/-/g, '') + '.hw');
  const pkgRu = capRu.appId || pkgHw.replace(/\.hw$/, '.rustore');

  const hw = page(appName, pkgHw, 'HUAWEI AppGallery', profile);
  const ru = page(appName, pkgRu, 'RuStore', profile);

  const pub = path.join(appDir, 'publish');
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, 'hw-privacy.html'), hw, 'utf8');
  fs.writeFileSync(path.join(pub, 'ru-privacy.html'), ru, 'utf8');

  const pubWeb = path.join(repoRoot, 'public', 'privacy', appBase);
  fs.mkdirSync(pubWeb, { recursive: true });
  fs.writeFileSync(path.join(pubWeb, 'hw-privacy.html'), hw, 'utf8');
  fs.writeFileSync(path.join(pubWeb, 'ru-privacy.html'), ru, 'utf8');

  return {
    hwUrl: `https://selflearning.bot.nu/privacy/${appBase}/hw-privacy.html`,
    ruUrl: `https://selflearning.bot.nu/privacy/${appBase}/ru-privacy.html`,
    pub, pubWeb
  };
}

module.exports = { generatePrivacy };
