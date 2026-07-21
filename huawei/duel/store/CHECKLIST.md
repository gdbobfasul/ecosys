# Huawei AppGallery — чеклист за подаване (Pupikes Ring Clash)

## Преди билд
- [ ] `npm install` минава
- [ ] `npm run gen-assets` създава `store/icon.svg`, `store/splash.svg`
- [ ] `npm run build` създава `dist/` (вкл. копирани `assets/animations/`)
- [ ] Игра тествана в браузър (`npm run dev`) — менюто тръгва, удар/комбо работят с докосване
- [ ] App ID = `com.pupikes.duel.huawei` (capacitor.config.json)
- [ ] Версия вдигната (versionCode/versionName в android/app/build.gradle)

## Графики
- [ ] Икона 512×512 PNG (конвертирай `icon.svg`)
- [ ] 3–5 екранни снимки 1080×1920
- [ ] (по избор) feature банер

## APK/AAB
- [ ] `npx cap add android` (еднократно)
- [ ] `npx cap sync android`
- [ ] APK билднат на машина с Android SDK/JDK (`./gradlew assembleDebug`)
- [ ] APK тестван на Huawei устройство БЕЗ Google услуги (видеата офлайн)
- [ ] Release APK/AAB подписан с keystore

## Обява (AppGallery Connect)
- [ ] Име, описание, ключови думи (виж LISTING.md)
- [ ] Категория: Games → Action / Casual
- [ ] Възрастов рейтинг: 12+
- [ ] Политика за поверителност (офлайн, без данни)
- [ ] Линк за поддръжка / e-mail

## Тестване
- [ ] Качено в Closed testing трек
- [ ] Добавени тестери (Huawei ID)
- [ ] Преминато ревю

## НЕ за този релийз
- [ ] Без IAP / билинг (играта е безплатна)
- [ ] Без HMS push/известия / без HMS вход
