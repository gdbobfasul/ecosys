// Конфиг за Lite (демо) — води към ПЪЛНИЯ платен ап. locked[] = кои функции са само в пълната версия.
export const LITE = {
  full: {
    _store: 'rustore',
    name: 'Auto Sound Diagnostics',
    rustore: 'https://apps.rustore.ru/app/com.pupikes.autosound.rustore',
    huawei: 'appmarket://details?id=com.pupikes.autosound.hw'
  },
  locked: ['savelog', 'calc', 'repeat']
};
