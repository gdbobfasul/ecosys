// Version: 1.0173
// Чете GUARDIAN ключа (pauser) от .env — НЕ owner-а. Само локално/на защитена машина.
'use strict';
const fs = require('fs');

function readEnvFile(envPath) {
  const env = {};
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch (e) { /* няма .env — guardian ще липсва → alert-only */ }
  return env;
}

// Връща guardian ключа (за pause) — пробва TOKEN_GUARDIAN_KEY, после TP_GUARDIAN_KEY.
// НИКОГА не ползва owner PRIVATE_KEY за реакции.
function loadGuardian(envPath) {
  const env = readEnvFile(envPath);
  let pk = process.env.TP_GUARDIAN_KEY || env.TOKEN_GUARDIAN_KEY || env.TP_GUARDIAN_KEY || '';
  if (!pk) return null; // няма guardian → само аларма (без pause)
  if (!pk.startsWith('0x')) pk = '0x' + pk;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) return null;
  return pk;
}

module.exports = { readEnvFile, loadGuardian };
