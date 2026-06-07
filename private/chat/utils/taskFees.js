// Version: 1.0193
// Чат — такса за модула „Задачи". Чете private/configs/task-fees.json.
// Такса = base_fee × множител(държава). Множител по подразбиране = default_factor;
// в factor_by_country са САМО изключенията (по-бедни държави). Без дълъг списък.
const fs = require('fs');
const path = require('path');

let cfg = null;
function load() {
  if (cfg) return cfg;
  try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'configs', 'task-fees.json'), 'utf8')); }
  catch (e) { cfg = { free_mode: true, base_fee: 20, currency: 'EUR', default_factor: 1.0, factor_by_country: {} }; }
  return cfg;
}

// Връща таксата за ХВАЩАНЕ/публикуване според държавата на задачата.
function takeFee(country) {
  const c = load();
  if (c.free_mode) return { amount: 0, currency: c.currency, free: true };
  const cc = String(country || '').toUpperCase();
  const f = (c.factor_by_country && c.factor_by_country[cc] != null) ? c.factor_by_country[cc] : (c.default_factor != null ? c.default_factor : 1);
  return { amount: Math.round(c.base_fee * f), currency: c.currency, free: false };
}

module.exports = { takeFee, load };
