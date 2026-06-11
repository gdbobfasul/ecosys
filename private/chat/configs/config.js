// Version: 1.0094
// ============================================
// 🌐 GLOBAL CONFIGURATION - WEB VERSION
// ============================================
// (Крипто конфигът е изваден в private/crypto/trash/config/ — нула крипто в чата.)

// ============================================
// 📊 APP CONFIGURATION
// ============================================
const APP_CONFIG = {
  MIN_AGE: 18,
  MAX_FILE_SIZE: 52428800, // 50MB
  FREE_MESSAGE_LIMIT: 10,
  SESSION_HOURS: 24,
  AUTO_LOGOUT_UTC: '04:00'
};

// Export
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APP_CONFIG };
}
