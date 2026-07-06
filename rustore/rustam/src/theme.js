// Version: 1.0001
// Визуална тема за RUStore версията.
// Тук държим акцентните цветове, които се различават между двата store-а.
// (Huawei версията има различна палитра.)
export const THEME = {
  store: 'rustore',
  // Основни акценти — топла „градинарска/народна" палитра
  primary: 0xe0b34a,      // топло злато
  primaryHex: '#e0b34a',
  accent: 0x6fae3a,       // тревисто зелено (краставица)
  accentHex: '#6fae3a',
  danger: 0x8a5a2b,       // кафяво (къртица/пръст)
  dangerHex: '#8a5a2b',
  warning: 0xffcf4d,
  warningHex: '#ffcf4d',
  // Фон
  bgTop: '#16240f',
  bgBottom: '#0a0d08',
  // Корпус на героя Рустам (дрехи/шапка)
  heroSkin: 0xe8b894,
  heroCloth: 0x4f7a2b,    // зелена риза на градинар
  // Заглавие на менюто
  titleText: 'РУСТАМ БЕРЕ\nКРАСТАВИЦИ',
  titleSub: 'RUStore Edition',
  // Ключ за localStorage (различен per-store, за да не се бъркат записите)
  saveKey: 'rustam.rustore.save'
};
