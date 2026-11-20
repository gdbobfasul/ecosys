/* Качване на файлове (снимки/PDF на договори и плащания, QR картинки). */
'use strict';
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config.cjs');
const { transliterate } = require('./translit.cjs');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cfg.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 8);
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// транслитерира към латиница, после оставя само [A-Za-z0-9_-]; винаги връща непразен ASCII токен
const sanitize = s => (transliterate(s).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x');

module.exports = { upload, sanitize };
