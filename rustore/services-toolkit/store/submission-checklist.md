# RUStore — контролен лист за подаване

## Преди билд
- [ ] `npm install` минава без грешки.
- [ ] `npm run build` създава `dist/` без грешки.
- [ ] App ID в `capacitor.config.json` = `com.kcy.servicestoolkit.rustore`.
- [ ] Версия в `package.json` е вдигната (versionName/versionCode за Android).

## Android проект (на машина с JDK 17 + Android SDK или в CI)
- [ ] `npx cap add android` (еднократно).
- [ ] `npx cap sync` след всеки `npm run build`.
- [ ] Икони/splash генерирани (виж icon-splash-specs.md).
- [ ] `android/app/build.gradle`: `applicationId "com.kcy.servicestoolkit.rustore"`,
      `minSdkVersion` ≥ 23, актуален `targetSdkVersion`.
- [ ] CAMERA разрешението присъства в `AndroidManifest.xml` (за QR камерата),
      но е по желание — приложението не бива да крашва без него.
- [ ] Без зависимости от Google Play Services / Firebase / GMS.

## Подписване (release)
- [ ] Създаден keystore:
      `keytool -genkey -v -keystore release.keystore -alias toolkit -keyalg RSA -keysize 2048 -validity 10000`
- [ ] `./gradlew assembleRelease` (или `bundleRelease` за AAB) с подписа.
- [ ] Пази keystore-а на сигурно — нужен е за всяко следващо обновление.

## RUStore Console
- [ ] Ново приложение с правилния App ID.
- [ ] Качен подписан APK/AAB.
- [ ] Листинг текстове (listing-notes.md), икона, екранни снимки.
- [ ] Декларации за поверителност: без събиране на данни, без реклами/трекери.
- [ ] Възрастов рейтинг 0+.
- [ ] Преминато затворено тестване (closed-testing.md).
- [ ] Подадено за модерация.

## Финална проверка на устройство
- [ ] Приложението стартира офлайн (самолетен режим).
- [ ] Всички офлайн инструменти работят (виж списъка в closed-testing.md).
- [ ] Онлайн екраните показват коректна бележка, не крашват.
