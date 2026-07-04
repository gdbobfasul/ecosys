// Version: 1.0001
// ─────────────────────────────────────────────────────────────────────────
// Единствената точка за настройка на обвивката (shell) на HouseLookBook.
//
// HLB_URL = продукционният адрес на HouseLookBook. Приложението е уеб (MPA +
// бекенд /api/hlb), сервирано от продукционния сървър. Тази мобилна обвивка
// просто го ЗАРЕЖДА през server.url — не е преимплементация. Бисквитките/входът/
// абонаментът работят нативно, защото WebView-ът е на реалния origin.
//
// Домейнът идва от private/configs/domains.conf:
//   APP_DOMAIN_MAP: "look.myhousesetup.com hlb"  ·  APP_hlb_PUBLIC="look.myhousesetup.com"
//
// ⚠️ При промяна на домейна → смени и `server.url` в capacitor.config.json.
// ─────────────────────────────────────────────────────────────────────────
export const HLB_URL = 'https://look.myhousesetup.com';

// Лек ping преди redirect (ползва се само от офлайн bootstrap екрана).
export const PING_TIMEOUT_MS = 8000;
