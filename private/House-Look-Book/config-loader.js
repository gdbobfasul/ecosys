// House-Look-Book — зарежда прагове/срокове/тарифи от config.json.
// Правило от brief-а: НИКАКВИ твърди числа в кода — всичко идва оттук.
// Бекендът чете СВОЯ config от private/ (там са модераторските прагове);
// клиентският config.json в public/ е отделен (само за конструктора).

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

let cached = null;

function load() {
  if (cached) return cached;
  cached = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return cached;
}

module.exports = { load, CONFIG_PATH };
