// Version: 1.0010
// config.js — специфични за магазина данни (RUStore издание).
// Единственото място, което се различава между rustore и huawei в src/.
export const STORE = {
  id: 'rustore',
  appId: 'com.kcy.newslator.rustore',
  // Показва се само в „За приложението“ (диагностика), не е критично.
  label: 'RUStore',
  // Хостнатата политика за поверителност — вграден линк в „Относно“ (изискване 7.1 на AppGallery/магазините).
  privacyUrl: 'https://selflearning.bot.nu/privacy/newslator/ru-privacy.html'
};
