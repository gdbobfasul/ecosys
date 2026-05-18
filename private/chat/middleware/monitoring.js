// Version: 1.0056
const Database = require('better-sqlite3');

function checkCriticalWords(db, message, fromPhone, toPhone) {
  try {
    const words = db.prepare('SELECT word FROM critical_words').all();
    const text = message.toLowerCase();
    
    for (const { word } of words) {
      if (text.includes(word.toLowerCase())) {
        // Get last 5KB of conversation context
        const context = db.prepare(`
          SELECT text FROM messages 
          WHERE (from_phone = ? AND to_phone = ?) OR (from_phone = ? AND to_phone = ?)
          ORDER BY created_at DESC LIMIT 50
        `).all(fromPhone, toPhone, toPhone, fromPhone);
        
        const contextText = context.map(m => m.text).reverse().join('\n').slice(-5120); // 5KB
        
        // Flag the conversation
        db.prepare(`
          INSERT INTO flagged_conversations 
          (phone1, phone2, matched_word, message_id, message_text, conversation_context)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          fromPhone < toPhone ? fromPhone : toPhone,
          fromPhone < toPhone ? toPhone : fromPhone,
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
