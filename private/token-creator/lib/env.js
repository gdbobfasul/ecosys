// Version: 1.0173
// Чете PRIVATE_KEY (и по избор BSCSCAN_API_KEY) от ГЛОБАЛНИЯ .env — само локално.
// Никога не пращай този ключ на сървър. token-creator се пуска от твоя компютър.
'use strict';
const fs = require('fs');

function loadKey(envPath) {
  let txt = '';
  try { txt = fs.readFileSync(envPath, 'utf8'); }
  catch (e) { throw new Error(`Не мога да чета .env (${envPath}): ${e.message}`); }
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  let pk = process.env.TC_PRIVATE_KEY || env.DEPLOYER_KEY || env.PRIVATE_KEY || '';
  if (!pk) throw new Error('Липсва PRIVATE_KEY в .env (или TC_PRIVATE_KEY). Без ключ няма деплой.');
  if (!pk.startsWith('0x')) pk = '0x' + pk;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error('PRIVATE_KEY не изглежда валиден (64 hex знака).');
  return { privateKey: pk, bscscanKey: env.BSCSCAN_API_KEY || process.env.BSCSCAN_API_KEY || '' };
}

module.exports = { loadKey };
