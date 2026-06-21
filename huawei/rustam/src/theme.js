// Визуална тема за Huawei AppGallery версията.
// Различни акцентни цветове спрямо RUStore версията (по-хладна/кехлибарена палитра).
export const THEME = {
  store: 'huawei',
  // Основни акценти — кехлибар + тюркоазено-зелено
  primary: 0xffb347,      // кехлибарено
  primaryHex: '#ffb347',
  accent: 0x33b07a,       // тюркоазено-зелено (краставица/успех)
  accentHex: '#33b07a',
  danger: 0xc8552b,       // теракота (къртица/пръст)
  dangerHex: '#c8552b',
  warning: 0xffd24d,
  warningHex: '#ffd24d',
  // Фон
  bgTop: '#101a24',
  bgBottom: '#0a0d08',
  // Корпус на героя Рустам (дрехи/шапка)
  heroSkin: 0xe8b894,
  heroCloth: 0x356a52,    // тюркоазено-зелена риза
  // Заглавие на менюто
  titleText: 'РУСТАМ',
  titleSub: 'AppGallery Edition',
  // Ключ за localStorage (различен per-store, за да не се бъркат записите)
  saveKey: 'rustam.huawei.save'
};
