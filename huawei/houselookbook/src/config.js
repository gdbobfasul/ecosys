// Version: 1.0020
// ─────────────────────────────────────────────────────────────────────────
// Единствената точка за настройка на мобилното издание на HouseLookBook.
//
// От 07.07.2026 апът е ВГРАДЕН (не обвивка): билдът копира public/House-Look-Book в dist/, APK-то
// носи целия конструктор и рисува ОФЛАЙН. Сървърът трябва само за галерия/класация/публикуване.
//
// HLB_URL = продукционният адрес на HouseLookBook. При билд vite.config.js генерира dist/hlb-config.json
// ({ apiBase: HLB_URL + '/api/hlb', fallbackApiBase }) — js/hlb-common.js го чете на устройство и
// при мрежова грешка опитва през HLB_API_FALLBACK (същият сървър на друг домейн; Китай/блокиран
// домейн — Huawei 3.1, 11.09.2026). Без сървър апът работи в ЛОКАЛЕН РЕЖИМ (проектите на устройството).
//
// Домейнът идва от private/configs/domains.conf:
//   APP_DOMAIN_MAP: "houselook.pupikes.com hlb"  ·  APP_hlb_PUBLIC="houselook.pupikes.com"
//   (look.myhousesetup.com е изоставен на 11.09.2026 — не го връщай)
//
// ⚠️ При промяна на домейна → смени и `allowNavigation` в capacitor.config.json и
//    cors.allowedOrigins в private/House-Look-Book/config.json.
// ─────────────────────────────────────────────────────────────────────────
export const HLB_URL = 'https://houselook.pupikes.com';

// Резервна API база (същият бекенд през общия домейн; nginx проксира /api/hlb/ → :3010).
export const HLB_API_FALLBACK = 'https://pupikes.app/api/hlb';

// Лек ping преди redirect (ползва се само от офлайн bootstrap екрана в браузър/preview).
export const PING_TIMEOUT_MS = 8000;
