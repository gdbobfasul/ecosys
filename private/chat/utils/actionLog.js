// Логване на грешки ПО ИМЕ НА ДЕЙСТВИЕ.
// Правило (указание на потребителя, повтаряно): когато не можем да хванем грешка отвън,
// обвиваме действието в try/catch и логваме в отделен файл, който съдържа НАЗВАНИЕТО на
// потребителското действие — за да се намира грешката бързо.
//
// Употреба в catch блок на route:
//   const { logActionError } = require('../utils/actionLog');
//   ...
//   } catch (err) {
//     logActionError('Зареждане на профил (GET /api/profile)', err, { userId: req.user && req.user.id });
//     res.status(500).json({ error: 'Server error' });
//   }
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'action-errors.log');

function logActionError(action, err, ctx) {
  var line = '';
  try {
    var ts = new Date().toISOString();
    var msg = (err && err.message) ? err.message : String(err);
    var stack = (err && err.stack) ? err.stack : '';
    var ctxStr = ctx ? ' | ' + JSON.stringify(ctx) : '';
    line = '[' + ts + '] [ДЕЙСТВИЕ: ' + action + ']' + ctxStr + '\n  ' + msg + '\n  ' + stack + '\n\n';
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) { /* логването НЕ бива да чупи заявката */ }
  // Дублираме в journalctl (за да влезе и в диагностичния бъндъл).
  try { console.error('[ДЕЙСТВИЕ: ' + action + ']', (err && err.message) ? err.message : err); } catch (e) {}
}

module.exports = { logActionError };
