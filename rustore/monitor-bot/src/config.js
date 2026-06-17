// Конфигурация на изданието (единственото място, което се различава между магазините
// освен src/store/<store>-sdk.js и магазинните документи + акцента на иконите).
export const STORE = 'rustore';
export const ACCENT = '#0a84ff';   // RUStore син акцент
export const ACCENT2 = '#5ac8fa';
export const APP_ID = 'com.kcy.monitorbot.rustore';
export const APP_NAME = 'Монитор-робот';

// Колко често роботът „тиктака" в браузъра (демо/уеб таймер).
// На устройство всеки монитор се планира по собствения си интервал.
export const WEB_TICK_MS = 60 * 1000;
