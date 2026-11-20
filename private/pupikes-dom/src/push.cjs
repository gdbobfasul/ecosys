/* Push към телефони (FCM). Три режима, в този ред:
 *   1) Модерен FCM HTTP v1 — ако cfg.FCM_SA сочи към валиден service-account JSON (препоръчано).
 *   2) Легаси FCM — ако има cfg.FCM_SERVER_KEY (Google го спира; само ако проектът още го поддържа).
 *   3) Само лог — ако няма нито едно (реалният push се включва щом дадеш ключ/акаунт).
 * Звукът ('emergency' | 'problem') е еднакъв за сървъра и клиентите. */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const cfg = require('./config.cjs');
const db = require('./db.cjs');

// ── service account (v1) ──
let _sa = null, _saTried = false;
function serviceAccount() {
  if (_saTried) return _sa;
  _saTried = true;
  try { if (cfg.FCM_SA && fs.existsSync(cfg.FCM_SA)) _sa = JSON.parse(fs.readFileSync(cfg.FCM_SA, 'utf8')); } catch (e) { console.log('[push] невалиден FCM_SA JSON:', e.message); }
  return _sa;
}

let _tok = { v: null, exp: 0 };
async function accessToken(sa) {
  if (_tok.v && Date.now() < _tok.exp - 60000) return _tok.v;
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' +
    b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + unsigned + '.' + sig,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('FCM OAuth: ' + (j.error_description || JSON.stringify(j)));
  _tok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return _tok.v;
}

async function sendV1(sa, tokens, { title, body, sound, data }) {
  const at = await accessToken(sa);
  const url = 'https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send';
  const sdata = {}; for (const k of Object.keys(Object.assign({ sound }, data || {}))) sdata[k] = String((Object.assign({ sound }, data || {}))[k]);
  for (const token of tokens) {
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title, body }, android: { priority: 'high', notification: { sound: sound || 'default' } }, data: sdata } }),
      });
      if (!res.ok) { const e = await res.text(); console.log('[push v1] ' + res.status + ': ' + e.slice(0, 160)); }
    } catch (e) { console.log('[push v1] грешка:', e.message); }
  }
}

async function sendLegacy(key, tokens, { title, body, sound, data }) {
  for (const token of tokens) {
    try {
      await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST', headers: { Authorization: 'key=' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: token, notification: { title, body, sound }, data: Object.assign({ sound }, data || {}) }),
      });
    } catch (e) { console.log('[push legacy] грешка:', e.message); }
  }
}

async function sendToUsers(userIds, msg) {
  if (!userIds || !userIds.length) return;
  const q = await db.query(
    `SELECT push_token FROM devices WHERE user_id IN (${userIds.map((_, i) => '$' + (i + 1)).join(',')}) AND push_token IS NOT NULL`,
    userIds);
  const tokens = [...new Set(q.rows.map(r => r.push_token).filter(Boolean))];
  if (!tokens.length) return;
  const sa = serviceAccount();
  if (sa && sa.private_key && sa.client_email && sa.project_id) return sendV1(sa, tokens, msg);
  if (cfg.FCM_SERVER_KEY) return sendLegacy(cfg.FCM_SERVER_KEY, tokens, msg);
  console.log('[push] (без FCM ключ/акаунт) ' + msg.title + ' → ' + tokens.length + ' устройства, звук=' + msg.sound);
}

module.exports = { sendToUsers };
