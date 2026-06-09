// Version: 1.0173
// Съобщенията се адресират по account id (users.id), НЕ по телефон — телефонът не е
// уникален. Контрактът съвпада с фронтенда (public/chat/public/chat.html):
//   GET  /messages/:friendUserId            → разговор
//   POST /messages/:friendUserId   {text}   → текстово съобщение
//   POST /messages/:friendUserId/file       → файл (multipart)
//   POST /messages/send-location/:friendUserId
//   GET  /messages/download/:fileId
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { checkCriticalWords } = require('../middleware/monitoring');

function createMessagesRoutes(db, uploadDir) {
  const router = express.Router();

  const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  });

  // helper: валиден положителен int id?
  const toId = (v) => { const n = parseInt(v, 10); return (n && n > 0) ? n : null; };

  // helper: приятели ли са двата акаунта (по числово подреден ключ)
  async function areFriends(uidA, uidB) {
    const [a, b] = [Number(uidA), Number(uidB)].sort((x, y) => x - y);
    return await db.prepare('SELECT 1 FROM friends WHERE user_id1 = ? AND user_id2 = ?').get(a, b);
  }

  // ── Download file (по to_user_id — само получателят тегли) ──
  router.get('/download/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const file = await db.prepare('SELECT * FROM temp_files WHERE id = ? AND to_user_id = ?').get(fileId, req.userId);

      if (!file || new Date(file.expires_at) <= new Date()) {
        return res.status(404).json({ error: 'File not found or expired' });
      }
      if (!fs.existsSync(file.file_path)) {
        await db.prepare('DELETE FROM temp_files WHERE id = ?').run(fileId);
        return res.status(404).json({ error: 'File not found on server' });
      }

      res.download(file.file_path, file.file_name, async (err) => {
        if (err) { console.error('Download error:', err); return; }
        await db.prepare('UPDATE temp_files SET downloaded = 1 WHERE id = ?').run(fileId);
        setTimeout(async () => {
          try {
            if (fs.existsSync(file.file_path)) fs.unlinkSync(file.file_path);
            await db.prepare('DELETE FROM temp_files WHERE id = ?').run(fileId);
            console.log(`✅ Deleted file: ${file.file_name}`);
          } catch (e) { console.error('Failed to delete file:', e); }
        }, 5000);
      });
    } catch (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Send location to friend (по account id) ──
  router.post('/send-location/:friendUserId', async (req, res) => {
    try {
      const friendUserId = toId(req.params.friendUserId);
      const { latitude, longitude, country, city, village, street, number, ip } = req.body;
      if (!friendUserId) return res.status(400).json({ error: 'Valid friendUserId required' });

      if (!await areFriends(req.userId, friendUserId)) {
        return res.status(403).json({ error: 'Not friends' });
      }

      const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const yandexMapsLink = `https://yandex.com/maps/?ll=${longitude},${latitude}&z=16&pt=${longitude},${latitude}`;
      const twoGisLink = `https://2gis.com/?m=${longitude},${latitude}/16`;
      const locationText = `📍 Местоположение:\n` +
        `${country ? `Държава: ${country}\n` : ''}` +
        `${city ? `Град: ${city}\n` : ''}` +
        `${village ? `Село: ${village}\n` : ''}` +
        `${street ? `Улица: ${street}\n` : ''}` +
        `${number ? `Номер: ${number}\n` : ''}` +
        `\nGPS: ${latitude}, ${longitude}\n` +
        `${ip ? `IP: ${ip}\n` : ''}` +
        `\n🗺️ Карти:\n` +
        `Google Maps: ${googleMapsLink}\n` +
        `2GIS: ${twoGisLink}\n` +
        `Yandex: ${yandexMapsLink}`;

      await db.prepare('INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)')
        .run(req.userId, friendUserId, locationText);

      res.json({ success: true });
    } catch (err) {
      console.error('Send location error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Get conversation with a friend (по account id) ──
  router.get('/:friendUserId', async (req, res) => {
    try {
      const friendUserId = toId(req.params.friendUserId);
      if (!friendUserId) return res.status(400).json({ error: 'Valid friendUserId required' });

      if (!await areFriends(req.userId, friendUserId)) {
        return res.status(403).json({ error: 'Not friends' });
      }

      const messages = await db.prepare(`
        SELECT id, from_user_id, text, file_id, file_name, file_size, file_type, created_at, read_at
        FROM messages
        WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
        ORDER BY created_at DESC LIMIT 100
      `).all(req.userId, friendUserId, friendUserId, req.userId);

      await db.prepare("UPDATE messages SET read_at = datetime('now') WHERE to_user_id = ? AND from_user_id = ? AND read_at IS NULL")
        .run(req.userId, friendUserId);

      const result = messages.reverse().map(row => ({
        id: row.id,
        text: row.text,
        sent: row.from_user_id === req.userId,
        timestamp: new Date(row.created_at).getTime(),
        read: row.read_at !== null,
        fileId: row.file_id,
        fileName: row.file_name,
        fileSize: row.file_size,
        fileType: row.file_type
      }));

      res.json({ messages: result });
    } catch (err) {
      console.error('Get messages error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Send file to a friend (multipart; по account id) ──
  router.post('/:friendUserId/file', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const friendUserId = toId(req.params.friendUserId);
      if (!friendUserId) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Valid friendUserId required' }); }

      const user = req.user;
      if (!user.subscription_active || !user.paid_until || new Date(user.paid_until) <= new Date()) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'File sharing not available. Upgrade for file sharing access.', upgradeRequired: true });
      }

      if (!await areFriends(req.userId, friendUserId)) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Not friends' });
      }

      const fileId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await db.prepare(`
        INSERT INTO temp_files (id, from_user_id, to_user_id, file_name, file_size, file_type, file_path, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(fileId, req.userId, friendUserId, req.file.originalname, req.file.size, req.file.mimetype, req.file.path, expiresAt.toISOString());

      await db.prepare(`
        INSERT INTO messages (from_user_id, to_user_id, file_id, file_name, file_size, file_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.userId, friendUserId, fileId, req.file.originalname, req.file.size, req.file.mimetype);

      res.json({ success: true, fileId, fileName: req.file.originalname, fileSize: req.file.size, fileType: req.file.mimetype });
    } catch (err) {
      console.error('Upload error:', err);
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
      res.status(500).json({ error: err.message });
    }
  });

  // ── Send text message (по account id) ── (генеричен 1-сегментен route — НАКРАЯ)
  router.post('/:friendUserId', async (req, res) => {
    try {
      const friendUserId = toId(req.params.friendUserId);
      const { text } = req.body;

      if (!friendUserId) return res.status(400).json({ error: 'Valid friendUserId required' });
      if (!text || text.length > 5000) {
        return res.status(400).json({ error: 'Message text required (max 5000 chars)' });
      }

      // Free user → дневен лимит (по from_user_id; created_at LIKE 'днес%' е cross-DB)
      const user = req.user;
      if (!user.subscription_active || !user.paid_until || new Date(user.paid_until) <= new Date()) {
        const today = new Date().toISOString().split('T')[0];
        const msgCount = await db.prepare(`
          SELECT COUNT(*) as count FROM messages
          WHERE from_user_id = ? AND created_at LIKE ?
        `).get(req.userId, today + '%');
        if (msgCount.count >= 10) {
          return res.status(403).json({ error: 'Daily message limit reached (10/day). Upgrade for unlimited messaging.', upgradeRequired: true });
        }
      }

      if (!await areFriends(req.userId, friendUserId)) {
        return res.status(403).json({ error: 'Not friends' });
      }

      const sanitizedText = text.trim();

      // Критични думи ПРЕДИ запис (по account id)
      const flagged = await checkCriticalWords(db, sanitizedText, req.userId, friendUserId);

      const result = await db.prepare('INSERT INTO messages (from_user_id, to_user_id, text, flagged) VALUES (?, ?, ?, ?)')
        .run(req.userId, friendUserId, sanitizedText, flagged ? 1 : 0);

      if (flagged) {
        const [uid1, uid2] = [Number(req.userId), Number(friendUserId)].sort((a, b) => a - b);
        await db.prepare(`
          UPDATE flagged_conversations SET message_id = ?
          WHERE user_id1 = ? AND user_id2 = ? AND message_id = 0
        `).run(result.lastInsertRowid, uid1, uid2);
      }

      res.json({ success: true, messageId: result.lastInsertRowid, flagged });
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createMessagesRoutes;
