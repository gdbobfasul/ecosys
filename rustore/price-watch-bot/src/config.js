// Конфигурация на изданието (единственото място, което се различава между магазините
// освен store/<store>-sdk.js и магазинните документи).
export const STORE = 'rustore';
export const ACCENT = '#0a84ff';   // RUStore син акцент
export const ACCENT2 = '#5ac8fa';
export const APP_ID = 'com.kcy.pricewatchbot.rustore';
export const APP_NAME = 'Цена-робот';

// Колко често роботът прави реална проверка в браузъра (демо таймер).
// На устройство планировчикът ползва интервала на всеки watch.
export const WEB_TICK_MS = 60 * 1000;
