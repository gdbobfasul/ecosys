// Version: 1.0173
// Аларма: конзола + файл (alerts/protector.log) + по избор webhook.
'use strict';
const fs = require('fs');
const path = require('path');

function alert(cfg, level, kind, msg, data) {
  const line = `[${new Date().toISOString()}] [${level}] ${kind}: ${msg}` + (data ? '  ' + JSON.stringify(data) : '');
  const icon = level === 'SEVERE' ? '🚨' : level === 'ACTION' ? '🛑' : '⚠️';
  console.log(icon, line);
  try { fs.mkdirSync(cfg.alertDir, { recursive: true }); fs.appendFileSync(path.join(cfg.alertDir, 'protector.log'), line + '\n'); } catch (_) {}
  if (cfg.webhookUrl) {
    try { fetch(cfg.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: icon + ' ' + line }) }).catch(() => {}); } catch (_) {}
  }
}

module.exports = { alert };
