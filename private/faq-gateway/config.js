// config.js — чете настройки от обкръжението (.env се зарежда в server.js).
// Всеки канал е ОПЦИОНАЛЕН: ако липсват ключовете му, той просто е изключен —
// сървърът пак върви за останалите канали.
const E = process.env;

export const config = {
  port: parseInt(E.PORT || '8092', 10) || 8092,

  // Токен за админ операциите (/kb публикуване + /log четене). Приложението го праща
  // като Authorization: Bearer <ADMIN_TOKEN>.
  adminToken: E.ADMIN_TOKEN || '',

  // ── WhatsApp Cloud API (Meta) — БЕЗПЛАТНО за тест (тестов номер + free разговори) ──
  whatsapp: {
    enabled: !!(E.WA_TOKEN && E.WA_PHONE_ID),
    token: E.WA_TOKEN || '',            // permanent/temporary access token
    phoneId: E.WA_PHONE_ID || '',       // Phone number ID от конзолата
    verifyToken: E.WA_VERIFY_TOKEN || 'pupikes-verify',
    graphVersion: E.WA_GRAPH_VERSION || 'v21.0'
  },

  // ── Facebook Messenger — БЕЗПЛАТНО (страница + app) ──
  messenger: {
    enabled: !!E.MSGR_PAGE_TOKEN,
    pageToken: E.MSGR_PAGE_TOKEN || '',
    verifyToken: E.MSGR_VERIFY_TOKEN || 'pupikes-verify',
    graphVersion: E.MSGR_GRAPH_VERSION || 'v21.0'
  },

  // ── Viber Bot — БЕЗПЛАТНО (Public Account) ──
  viber: {
    enabled: !!E.VIBER_TOKEN,
    token: E.VIBER_TOKEN || '',
    botName: E.VIBER_BOT_NAME || 'Pupikes FAQ',
    avatar: E.VIBER_AVATAR || ''
  }
};

export function enabledChannels() {
  return Object.entries({ whatsapp: config.whatsapp, messenger: config.messenger, viber: config.viber })
    .filter(([, c]) => c.enabled).map(([k]) => k);
}
