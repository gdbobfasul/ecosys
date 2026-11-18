/* Pupikes Дом — сървър: Express API + статичен уеб интерфейс + WebSocket известия. */
'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const cfg = require('./config.cjs');
const db = require('./db.cjs');
const { auth, requireRole, hash } = require('./auth.cjs');
const rt = require('./realtime.cjs');
const admin = require('./routes/admin.cjs');

async function seedStaff() {
  const mk = async (role, email, name) => {
    if (await db.one('SELECT id FROM users WHERE role=$1 LIMIT 1', [role])) return;
    const pass = process.env[role.toUpperCase() + '_PASS'] || process.env.CENTER_PASS || 'bgmasters';
    await db.query('INSERT INTO users(role,email,name,password_hash,approved,flagged,created_at) VALUES($1,$2,$3,$4,1,0,$5)',
      [role, email, name, hash(pass), new Date().toISOString()]);
    console.log('➜ Създаден ' + role + ' акаунт: ' + email + ' / ' + pass + '  (смени паролата в продукция)');
  };
  await mk('center', process.env.CENTER_EMAIL || 'center@pupikes.local', 'Център');
  await mk('admin', process.env.ADMIN_EMAIL || 'admin@pupikes.local', 'Админ');
}

async function main() {
  await db.init();
  await seedStaff();

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // публични (преди guard-натите рутери)
  app.get('/api/health', (_req, res) => res.json({ ok: true, db: db.isPg ? 'postgres' : 'sqlite' }));

  // API
  app.use('/api', require('./routes/auth.cjs'));
  app.use('/api', require('./routes/properties.cjs'));
  app.use('/api', require('./routes/profile.cjs'));
  app.use('/api', require('./routes/signals.cjs'));
  app.use('/api', require('./routes/payments.cjs'));
  app.use('/api', require('./routes/qrcodes.cjs'));
  app.use('/api', require('./routes/contracts.cjs'));
  app.use('/api/admin', admin);
  app.use('/api/mod', require('./routes/moderator.cjs'));
  app.use('/api', require('./routes/feereq.cjs'));

  // настройки (мелодии) — достъпни за всяка влязла роля
  app.get('/api/settings', auth, async (_req, res) => res.json({ settings: await admin.getSettings() }));

  // КАЧЕНИТЕ ФАЙЛОВЕ (договори/доказателства) — вижда ги САМО центърът (токен през ?token=)
  app.get('/api/files/:name', auth, requireRole('center'), (req, res) => {
    const name = path.basename(String(req.params.name || ''));
    if (!name || name.includes('..')) return res.status(400).end();
    res.sendFile(path.join(cfg.UPLOAD_DIR, name));
  });

  // статичен уеб интерфейс
  app.use('/', express.static(path.join(cfg.ROOT, 'web')));

  const server = http.createServer(app);
  rt.attach(server);
  server.listen(cfg.PORT, () => console.log('Pupikes Дом слуша на http://localhost:' + cfg.PORT + '  (база: ' + (db.isPg ? 'Postgres' : 'SQLite') + ')'));
  return server;
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { main };
