// Version: 1.0172
const Database = require('better-sqlite3');
const Q = require('../queries').monitoring;

async function checkCriticalWords(db, message, fromUserId, toUserId) {
  try {
    const words = await db.prepare(Q.CRITICAL_WORDS_ALL).all();
    const text = message.toLowerCase();

    for (const { word } of words) {
      if (text.includes(word.toLowerCase())) {
        // Get last 5KB of conversation context
        const context = await db.prepare(Q.CONVERSATION_CONTEXT).all(fromUserId, toUserId, toUserId, fromUserId);

        const contextText = context.map(m => m.text).reverse().join('\n').slice(-5120); // 5KB

        // Flag the conversation (user_id1 < user_id2 — числово подреждане)
        const [uid1, uid2] = [Number(fromUserId), Number(toUserId)].sort((a, b) => a - b);
        await db.prepare(Q.FLAG_CONVERSATION).run(
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
