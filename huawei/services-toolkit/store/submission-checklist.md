# Huawei AppGallery — контролен лист за подаване

## Преди билд
- [ ] `npm install` минава без грешки.
- [ ] `npm run build` създава `dist/` без грешки.
- [ ] App ID в `capacitor.config.json` = `com.pupikes.servicestoolkit.huawei`.
- [ ] Версия в `package.json` е вдигната (versionName/versionCode за Android).

## Android проект (на машина с JDK 17 + Android SDK или в CI)
- [ ] `npx cap add android` (еднократно).
- [ ] `npx cap sync` след всеки `npm run build`.
- [ ] Икони/splash генерирани (виж icon-splash-specs.md).
- [ ] `android/app/build.gradle`: `applicationId "com.pupikes.servicestoolkit.huawei"`,
      `minSdkVersion` ≥ 23, актуален `targetSdkVersion`.
- [ ] CAMERA разрешението в `AndroidManifest.xml` (по желание; без краш при отказ).
- [ ] Без GMS/Firebase; без задължителна зависимост от HMS Core.

## Подписване (release)
- [ ] Създаден keystore:
      `keytool -genkey -v -keystore release.keystore -alias toolkit -keyalg RSA -keysize 2048 -validity 10000`
- [ ] `./gradlew assembleRelease` (или `bundleRelease`) с подписа.
- [ ] Пази keystore-а — нужен за всяко обновление.

## AppGallery Connect
- [ ] Ново приложение с правилния package name.
- [ ] Качен подписан APK/AAB.
- [ ] Листинг текстове (listing-notes.md), икона, екранни снимки.
- [ ] **Privacy policy URL** (задължителен за AppGallery).
- [ ] Декларации: без събиране на данни, без реклами/трекери.
- [ ] Възрастов рейтинг.
- [ ] Преминато затворено тестване (closed-testing.md).
- [ ] Подадено за review.

## Финална проверка на устройство
- [ ] Стартира офлайн (самолетен режим).
- [ ] Всички офлайн инструменти работят.
- [ ] Онлайн екраните показват коректна бележка, не крашват.
- [ ] Работи на Huawei устройство без Google услуги.
