// WhereNoBiz — зарежда прагове/тарифи от config.json.
// Правило от brief-а: НИКАКВИ твърди числа в кода.

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
