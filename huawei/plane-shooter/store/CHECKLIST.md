# Huawei AppGallery — чеклист за подаване

## Преди билд
- [ ] `npm install` минава
- [ ] `npm run build` създава `dist/`
- [ ] Игра тествана в браузър (`npm run dev`) — всичките 10 нива достижими
- [ ] App ID = `com.pupikes.planeshooter.huawei` (capacitor.config.json)
- [ ] Версия вдигната (versionCode/versionName в android/app/build.gradle)

## Графики
- [ ] Икона 216×216 PNG + 512×512 запас (от `icon.svg`)
- [ ] 3+ екранни снимки 1080×1920

## APK/AAB
- [ ] `npx cap add android` (еднократно)
- [ ] `npx cap sync android`
- [ ] APK билднат на машина с Android SDK/JDK (`./gradlew assembleDebug`)
- [ ] APK тестван на Huawei устройство БЕЗ Google услуги
- [ ] Release APK подписан с keystore

## Обява (AppGallery Connect)
- [ ] Име, описание, ключови думи (виж LISTING.md)
- [ ] Категория: Games → Arcade
- [ ] Възрастов рейтинг попълнен (въпросник в конзолата)
- [ ] Политика за поверителност — публичен URL (офлайн, без данни)
- [ ] Линк за поддръжка / e-mail

## Тестване
- [ ] Качено в Closed test трек
- [ ] Добавени тестери (HUAWEI ID / линк)
- [ ] Преминато ревю

## TODO (бъдещи версии — НЕ за този релийз)
- [ ] HMS IAP SDK (ако се добавят покупки) + agconnect-services.json
- [ ] HMS Push Kit (ако се добавят известия)
