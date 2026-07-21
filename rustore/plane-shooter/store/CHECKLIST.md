# RUStore — чеклист за подаване

## Преди билд
- [ ] `npm install` минава
- [ ] `npm run build` създава `dist/`
- [ ] Игра тествана в браузър (`npm run dev`) — всичките 10 нива достижими
- [ ] App ID = `com.pupikes.planeshooter.rustore` (capacitor.config.json)
- [ ] Версия вдигната (versionCode/versionName в android/app/build.gradle)

## Графики
- [ ] Икона 512×512 PNG (от `icon.svg`)
- [ ] 3–5 екранни снимки 1080×1920
- [ ] (по избор) feature банер

## APK/AAB
- [ ] `npx cap add android` (еднократно)
- [ ] `npx cap sync android`
- [ ] APK билднат на машина с Android SDK/JDK (`./gradlew assembleDebug`)
- [ ] APK тестван на устройство БЕЗ Google услуги
- [ ] Release APK подписан с keystore

## Обява (RUStore Console)
- [ ] Име, описание, ключови думи (виж LISTING.md)
- [ ] Категория: Игри → Аркадни
- [ ] Възрастов рейтинг: 6+
- [ ] Политика за поверителност (офлайн, без данни)
- [ ] Линк за поддръжка / e-mail

## Тестване
- [ ] Качено в Closed testing трек
- [ ] Добавени тестери
- [ ] Преминато ревю

## TODO (бъдещи версии — НЕ за този релийз)
- [ ] RUStore Billing SDK (ако се добавят покупки)
- [ ] RUStore Push SDK (ако се добавят известия)
