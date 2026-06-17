// ─────────────────────────────────────────────────────────────────────────
// Единствената точка за настройка на обвивката (shell).
//
// CHAT_URL = продукционният адрес на чата. Чатът е уеб приложение, сервирано
// от продукционния сървър. Тази мобилна обвивка просто го ЗАРЕЖДА — не е
// преимплементация.
//
// Изборът my.girl.place идва от private/configs/domains.conf:
//   APP_DOMAIN_MAP: "my.girl.place chat" (каноничен публичен домейн на чата)
//   APP_chat_PUBLIC="my.girl.place"
// На този домейн nginx сервира чата на корена `/` (SPA fallback → chat index.html),
// затова коренът https://my.girl.place е директният вход към живия чат.
//
// ⚠️ При промяна на домейна → смени и `server.url` в capacitor.config.json.
// ─────────────────────────────────────────────────────────────────────────
export const CHAT_URL = 'https://my.girl.place';

// Лек ping за проверка на връзката преди redirect (HEAD към чата).
// Ползва се само от офлайн bootstrap екрана (index.html / src/main.js).
export const PING_TIMEOUT_MS = 8000;
