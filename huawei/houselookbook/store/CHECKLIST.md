# Pupikes Chat — Release checklist (Huawei AppGallery)

- [ ] `npm install` минава без грешки
- [ ] `npm run build` създава `dist/`
- [ ] `npm run assets` генерира `store/icon.svg` + `store/splash.svg`
- [ ] icon.svg / splash.svg → PNG (1024 / 2048) за Android
- [ ] App id = `com.pupikes.chat.huawei`
- [ ] `capacitor.config.json` → `server.url = https://my.girl.place`
- [ ] `npx cap add android` + `npx cap sync`
- [ ] Тест на реално устройство: чатът се зарежда от продукция
- [ ] Офлайн екран + „Опитай пак" работят
- [ ] Без IAP, без GMS/HMS/Firebase, без контакти
- [ ] Data safety форма попълнена (виж DATA-SAFETY.md)
- [ ] APK/AAB подписан и качен
