// Version: 1.0173
// Фаза 3: fuzz — попълва и ИЗПРАЩА форми с гранични/зловредни стойности.
// САМО срещу VM (разрушително). Възпроизводимо: същият seed → същата последователност.
'use strict';

// Seeded PRNG (mulberry32) — детерминиран за replay.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Гранични + зловредни стойности (срещу VM е ОК) — търсим крашове/инжекции/липсваща валидация.
const PAYLOADS = [
  '', ' ', 'a', 'А'.repeat(4000), '0', '-1', '99999999999999999999',
  "'; DROP TABLE users;--", '<script>alert(1)</script>', '"><img src=x onerror=alert(1)>',
  '../../../etc/passwd', '{{7*7}}', '${7*7}', '😀🔥💥ж', 'null', 'undefined',
  'admin', 'test@test', 'http://evil.example/', '\n\n\t\t', '%00%0a', 'true', '1 OR 1=1',
];

function fuzzValue(rng, type) {
  if (type === 'email') return pick(rng, ['x@y.z', 'not-an-email', '', 'a'.repeat(300) + '@x.io']);
  if (type === 'number' || type === 'range') return pick(rng, ['-1', '0', '999999999', '1e30', 'NaN', '']);
  if (type === 'url') return pick(rng, ['javascript:alert(1)', 'http://x', 'not a url', '']);
  return pick(rng, PAYLOADS);
}

// Попълва и изпраща формите на текущата страница; връща списък действия (за replay).
async function fuzzForms(page, rng, navTimeout) {
  const record = [];
  const forms = await page.$$('form');
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    let inputs = [];
    try { inputs = await form.$$('input, textarea, select'); } catch (_) { continue; }
    for (const inp of inputs) {
      let info;
      try { info = await inp.evaluate((e) => ({ tag: e.tagName.toLowerCase(), type: (e.type || '').toLowerCase(), name: e.name || e.id || '' })); }
      catch (_) { continue; }
      if (['submit', 'button', 'hidden', 'file', 'image', 'reset'].includes(info.type)) continue;
      try {
        if (info.tag === 'select') {
          const opts = await inp.$$('option');
          if (opts.length) {
            const v = await opts[Math.floor(rng() * opts.length)].getAttribute('value');
            await inp.selectOption(v ? { value: v } : { index: 0 }).catch(() => {});
            record.push({ form: i, field: info.name, type: 'select', value: v });
          }
        } else if (info.type === 'checkbox' || info.type === 'radio') {
          if (rng() > 0.5) { await inp.check().catch(() => {}); record.push({ form: i, field: info.name, type: info.type, value: 'checked' }); }
        } else {
          const v = fuzzValue(rng, info.type);
          await inp.fill(String(v)).catch(() => {});
          record.push({ form: i, field: info.name, type: info.type, value: String(v).slice(0, 50) });
        }
      } catch (_) { /* пропусни проблемно поле */ }
    }
    // изпрати формата
    try {
      record.push({ form: i, action: 'submit' });
      const submit = await form.$('button[type=submit], input[type=submit], button:not([type])');
      if (submit) {
        await Promise.all([
          page.waitForLoadState('domcontentloaded', { timeout: navTimeout }).catch(() => {}),
          submit.click({ timeout: 4000 }).catch(() => {}),
        ]);
      } else {
        await form.evaluate((f) => (f.requestSubmit ? f.requestSubmit() : f.submit())).catch(() => {});
      }
      await page.waitForTimeout(700);
    } catch (_) { /* формата може да е навигирала */ }
  }
  return record;
}

module.exports = { makeRng, fuzzForms };
