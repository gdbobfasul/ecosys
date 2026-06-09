// Version: 1.0172
const Database = require('better-sqlite3');

async function checkCriticalWords(db, message, fromUserId, toUserId) {
  try {
    const words = await db.prepare('SELECT word FROM critical_words').all();
    const text = message.toLowerCase();

    for (const { word } of words) {
      if (text.includes(word.toLowerCase())) {
        // Get last 5KB of conversation context
        const context = await db.prepare(`
          SELECT text FROM messages
          WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
          ORDER BY created_at DESC LIMIT 50
        `).all(fromUserId, toUserId, toUserId, fromUserId);

        const contextText = context.map(m => m.text).reverse().join('\n').slice(-5120); // 5KB

        // Flag the conversation (user_id1 < user_id2 — числово подреждане)
        const [uid1, uid2] = [Number(fromUserId), Number(toUserId)].sort((a, b) => a - b);
        await db.prepare(`
          INSERT INTO flagged_conversations
          (user_id1, user_id2, matched_word, message_id, message_text, conversation_context)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uid1,
          uid2,
          word,
          0, // Will be updated with actual message_id
          message,
          contextText
        );

        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Monitoring error:', err);
    return false;
  }
}

module.exports = { checkCriticalWords };
