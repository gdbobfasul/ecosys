/* Качване на файлове (снимки/PDF на договори и плащания, QR картинки). */
'use strict';
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config.cjs');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cfg.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 8);
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const sanitize = s => String(s || '').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 40);

module.exports = { upload, sanitize };
