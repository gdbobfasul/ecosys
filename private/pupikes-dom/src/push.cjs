/* Push към телефони (FCM). Ако няма FCM_SERVER_KEY — само логва (реалният push се
 * включва щом има Google проект/ключ). Звукът на известието се подава в payload-а
 * ('emergency' | 'problem'), еднакъв за сървъра и клиентите. */
'use strict';
const cfg = require('./config.cjs');
const db = require('./db.cjs');

async function sendToUsers(userIds, { title, body, sound, data }) {
  if (!userIds || !userIds.length) return;
  const q = await db.query(
    `SELECT push_token FROM devices WHERE user_id IN (${userIds.map((_, i) => '$' + (i + 1)).join(',')}) AND push_token IS NOT NULL`,
    userIds);
  const tokens = q.rows.map(r => r.push_token).filter(Boolean);
  if (!cfg.FCM_SERVER_KEY) { console.log('[push] (без FCM ключ) ' + title + ' → ' + tokens.length + ' устройства, звук=' + sound); return; }
  // реално изпращане към FCM
  for (const token of tokens) {
    try {
      await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: { 'Authorization': 'key=' + cfg.FCM_SERVER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: token, notification: { title, body, sound }, data: Object.assign({ sound }, data || {}) }),
      });
    } catch (e) { console.log('[push] грешка:', e.message); }
  }
}

module.exports = { sendToUsers };
