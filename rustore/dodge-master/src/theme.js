// Визуална тема за RUStore версията.
// Тук държим акцентните цветове, които се различават между двата store-а.
// (Huawei версията има различна палитра.)
export const THEME = {
  store: 'rustore',
  // Основни акценти — топла „народна/средновековна" палитра
  primary: 0xe0b34a,      // топло злато
  primaryHex: '#e0b34a',
  accent: 0x6fae3a,       // тревисто зелено
  accentHex: '#6fae3a',
  danger: 0xd0432b,
  dangerHex: '#d0432b',
  warning: 0xffcf4d,
  warningHex: '#ffcf4d',
  // Фон
  bgTop: '#0a0d08',
  bgBottom: '#1a2412',
  // Корпус на играча (дрехи/шапка по подразбиране)
  heroSkin: 0xe8b894,
  heroCloth: 0x7a4a2b,
  // Заглавие на менюто
  titleText: 'DODGE MASTER',
  titleSub: 'RUStore Edition',
  // Ключ за localStorage (различен per-store, за да не се бъркат записите)
  saveKey: 'dodgemaster.rustore.save'
};
