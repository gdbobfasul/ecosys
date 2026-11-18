/* Автентикация: bcrypt пароли + JWT токени + middleware по роля. */
'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cfg = require('./config.cjs');

const hash = pw => bcrypt.hashSync(String(pw), 10);
const verify = (pw, h) => { try { return bcrypt.compareSync(String(pw), h || ''); } catch { return false; } };
const sign = u => jwt.sign({ id: u.id, role: u.role, name: u.name || u.username || u.email }, cfg.JWT_SECRET, { expiresIn: '30d' });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : (req.query.token || '');
  try { req.user = jwt.verify(t, cfg.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Няма достъп (влез отново).' }); }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Забранено за тази роля.' });
    next();
  };
}

module.exports = { hash, verify, sign, auth, requireRole };
