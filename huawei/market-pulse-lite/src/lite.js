// Конфиг за Lite (демо) — води към ПЪЛНИЯ платен ап. locked[] = кои функции са само в пълната версия.
export const LITE = {
  full: {
    _store: 'huawei',
    name: 'Market Pulse',
    rustore: 'https://apps.rustore.ru/app/com.pupikes.marketpulse.rustore',
    huawei: 'appmarket://details?id=com.pupikes.marketpulse.hw'
  },
  locked: ['signals', 'history', 'calc_pro']
};
