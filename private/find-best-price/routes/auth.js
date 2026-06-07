// Version: 1.0193
// Find Best Price — регистрация / вход / изход / профил (като WNB).

const express = require('express');
const bcrypt = require('bcryptjs');
const { one } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { roleForEmail } = require('../roles');

const router = express.Router();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// POST /api/fbp/register { email, password, display_name?, lang? }
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, display_name, lang } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'bad_email', message: 'Невалиден имейл.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'weak_password', message: 'Паролата трябва да е поне 6 символа.' });
    const exists = await one('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists) return res.status(409).json({ error: 'email_taken', message: 'Този имейл вече е регистриран.' });
    const hash = await bcrypt.hash(password, 10);
    const user = await one(
      `INSERT INTO users (email, password_hash, display_name, lang)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, lang`,
      [email.toLowerCase(), hash, display_name || null, lang || 'en']
    );
    user.role = roleForEmail(user.email);
    req.session.userId = user.id;
    res.status(201).json({ user });
  } catch (e) { next(e); }
});

// POST /api/fbp/login { email, password }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
    const user = await one('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'bad_credentials', message: 'Грешен имейл или парола.' });
    }
    if (user.is_banned) return res.status(403).json({ error: 'banned', message: 'Акаунтът е блокиран.' });
    req.session.userId = user.id;
    res.json({ user: { id: user.id, email: user.email, display_name: user.display_name, lang: user.lang, role: roleForEmail(user.email) } });
  } catch (e) { next(e); }
});

// POST /api/fbp/logout
router.post('/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

// GET /api/fbp/me
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
