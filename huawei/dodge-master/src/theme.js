// Version: 1.0001
// Визуална тема за Huawei AppGallery версията.
// Различни акцентни цветове спрямо RUStore версията (по-хладна/червеникава палитра).
export const THEME = {
  store: 'huawei',
  // Основни акценти — по-хладна, тъмно-червена/кехлибарена палитра
  primary: 0xff7a3c,      // кехлибарено-оранжево
  primaryHex: '#ff7a3c',
  accent: 0x3ab0a0,       // тюркоазено
  accentHex: '#3ab0a0',
  danger: 0xff3b5b,
  dangerHex: '#ff3b5b',
  warning: 0xffd24d,
  warningHex: '#ffd24d',
  // Фон
  bgTop: '#0c0a10',
  bgBottom: '#241626',
  // Корпус на играча (дрехи/шапка по подразбиране)
  heroSkin: 0xe8b894,
  heroCloth: 0x6a3a52,
  // Заглавие на менюто
  titleText: 'EVADE ARENA',
  titleSub: 'AppGallery Edition',
  // Ключ за localStorage (различен per-store, за да не се бъркат записите)
  saveKey: 'dodgemaster.huawei.save'
};
