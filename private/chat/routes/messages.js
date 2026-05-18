// Version: 1.0056
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { validatePhone } = require('../utils/validation');
const { checkCriticalWords } = require('../middleware/monitoring');

function createMessagesRoutes(db, uploadDir) {
  const router = express.Router();

  const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  });

  // Send location to friend
  router.post('/send-location/:friendUserId', async (req, res) => {
    try {
      const { friendUserId } = req.params;
      const { latitude, longitude, country, city, village, street, number, ip } = req.body;

      // Check friendship
      const friendship = db.prepare(`
        SELECT 1 FROM friends 
        WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)
      `).get(req.userId, friendUserId, friendUserId, req.userId);

      if (!friendship) {
        return res.status(403).json({ error: 'Not friends' });
      }

      // Create location message
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

      // Insert message
      db.prepare(`
        INSERT INTO messages (from_user_id, to_user_id, text)
        VALUES (?, ?, ?)
      `).run(req.userId, friendUserId, locationText);

      res.json({ success: true });
    } catch (err) {
      console.error('Send location error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get messages with a friend
  router.get('/:friendPhone', (req, res) => {
    try {
      const { friendPhone } = req.params;

      if (!validatePhone(friendPhone)) {
        return res.status(400).json({ error: 'Invalid phone' });
      }

      // Check friendship
      const [phone1, phone2] = [req.phone, friendPhone].sort();
      const friendCheck = db.prepare('SELECT 1 FROM friends WHERE phone1 = ? AND phone2 = ?').get(phone1, phone2);

      if (!friendCheck) {
        return res.status(403).json({ error: 'Not friends' });
      }

      // Get last 5KB of messages (approximately 100 messages)
      const messages = db.prepare(`
        SELECT id, from_phone, text, file_id, file_name, file_size, file_type, created_at, read_at
        FROM messages
        WHERE (from_phone = ? AND to_phone = ?) OR (from_phone = ? AND to_phone = ?)
        ORDER BY created_at DESC LIMIT 100
      `).all(req.phone, friendPhone, friendPhone, req.phone);

      // Mark as read
      db.prepare('UPDATE messages SET read_at = datetime("now") WHERE to_phone = ? AND from_phone = ? AND read_at IS NULL')
        .run(req.phone, friendPhone);

      const result = messages.reverse().map(row => ({
        id: row.id,
        text: row.text,
        sent: row.from_phone === req.phone,
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

  // Send text message (WebSocket will also handle this, but REST endpoint for fallback)
  router.post('/send', (req, res) => {
    try {
      const { to, text } = req.body;

      if (!validatePhone(to)) {
        return res.status(400).json({ error: 'Valid recipient required' });
      }

      if (!text || text.length > 5000) {
        return res.status(400).json({ error: 'Message text required (max 5000 chars)' });
      }

      // Check if user is free (unpaid)
      const user = req.user;
      if (!user.subscription_active || 
          !user.paid_until || 
          new Date(user.paid_until) <= new Date()) {
        
        // Free user - check daily message limit
        const today = new Date().toISOString().split('T')[0];
        const msgCount = db.prepare(`
          SELECT COUNT(*) as count 
          FROM messages 
          WHERE from_user_id = ? 
          AND DATE(created_at) = ?
        `).get(user.id, today);
        
        if (msgCount.count >= 10) {
          return res.status(403).json({ 
            error: 'Daily message limit reached (10/day). Upgrade for unlimited messaging.',
            upgradeRequired: true
          });
        }
      }

      // Check friendship
      const [phone1, phone2] = [req.phone, to].sort();
      const friendCheck = db.prepare('SELECT 1 FROM friends WHERE phone1 = ? AND phone2 = ?').get(phone1, phone2);

      if (!friendCheck) {
        return res.status(403).json({ error: 'Not friends' });
      }

      const sanitizedText = text.trim();

      // Check for critical words BEFORE saving
      const flagged = checkCriticalWords(db, sanitizedText, req.phone, to);

      // Save message
      const stmt = db.prepare('INSERT INTO messages (from_phone, to_phone, text, flagged) VALUES (?, ?, ?, ?)');
      const result = stmt.run(req.phone, to, sanitizedText, flagged ? 1 : 0);

      // Update flagged_conversations with actual message_id
      if (flagged) {
        db.prepare(`
          UPDATE flagged_conversations 
          SET message_id = ? 
          WHERE phone1 = ? AND phone2 = ? AND message_id = 0
          ORDER BY flagged_at DESC LIMIT 1
        `).run(result.lastInsertRowid, phone1, phone2);
      }

      res.json({
        success: true,
        messageId: result.lastInsertRowid,
        flagged
      });
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Upload file
  router.post('/upload', upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Check if user is paid
      const user = req.user;
      if (!user.subscription_active || 
          !user.paid_until || 
          new Date(user.paid_until) <= new Date()) {
        
        // Free user - no file uploads
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ 
          error: 'File sharing not available. Upgrade for file sharing access.',
          upgradeRequired: true
        });
      }

      const { to } = req.body;

      if (!validatePhone(to)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Valid recipient required' });
      }

      // Check friendship
      const [phone1, phone2] = [req.phone, to].sort();
      const friendCheck = db.prepare('SELECT 1 FROM friends WHERE phone1 = ? AND phone2 = ?').get(phone1, phone2);

      if (!friendCheck) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Not friends' });
      }

      const fileId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24h expiry

      // Store file info
      db.prepare(`
        INSERT INTO temp_files (id, from_phone, to_phone, file_name, file_size, file_type, file_path, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(fileId, req.phone, to, req.file.originalname, req.file.size, req.file.mimetype, req.file.path, expiresAt.toISOString());

      // Save message reference
      db.prepare(`
        INSERT INTO messages (from_phone, to_phone, file_id, file_name, file_size, file_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.phone, to, fileId, req.file.originalname, req.file.size, req.file.mimetype);

      res.json({
        success: true,
        fileId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype
      });
    } catch (err) {
      console.error('Upload error:', err);
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: err.message });
    }
  });

  // Download file
  router.get('/download/:fileId', (req, res) => {
    try {
      const { fileId } = req.params;

      const file = db.prepare(`
        SELECT * FROM temp_files 
        WHERE id = ? AND to_phone = ? AND expires_at > datetime("now")
      `).get(fileId, req.phone);

      if (!file) {
        return res.status(404).json({ error: 'File not found or expired' });
      }

      if (!fs.existsSync(file.file_path)) {
        db.prepare('DELETE FROM temp_files WHERE id = ?').run(fileId);
        return res.status(404).json({ error: 'File not found on server' });
      }

      // Send file
      res.download(file.file_path, file.file_name, (err) => {
        if (err) {
          console.error('Download error:', err);
          return;
        }

        // Mark as downloaded
        db.prepare('UPDATE temp_files SET downloaded = 1 WHERE id = ?').run(fileId);

        // Delete file after successful download
        setTimeout(() => {
          try {
            if (fs.existsSync(file.file_path)) {
              fs.unlinkSync(file.file_path);
            }
            db.prepare('DELETE FROM temp_files WHERE id = ?').run(fileId);
            console.log(`✅ Deleted file: ${file.file_name}`);
          } catch (err) {
            console.error('Failed to delete file:', err);
          }
        }, 5000); // 5 second delay
      });
    } catch (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createMessagesRoutes;
