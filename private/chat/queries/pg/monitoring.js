// Version: 1.0001
// PostgreSQL заявки за middleware/monitoring.js (нативен PG: $n плейсхолдъри).
module.exports = {
  CRITICAL_WORDS_ALL:      'SELECT word FROM critical_words',
  // Последните 50 реда контекст между двамата (двупосочно)
  CONVERSATION_CONTEXT:
    `SELECT text FROM messages
     WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $3 AND to_user_id = $4)
     ORDER BY created_at DESC LIMIT 50`,
  FLAG_CONVERSATION:
    `INSERT INTO flagged_conversations
     (user_id1, user_id2, matched_word, message_id, message_text, conversation_context)
     VALUES ($1, $2, $3, $4, $5, $6)`,
};
