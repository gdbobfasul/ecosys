# Huawei AppGallery — тестова среда / закрито тестване

## 1. Регистрация на разработчик
1. Влез в AppGallery Connect: https://developer.huawei.com/consumer/en/console
2. Завърши верификацията на акаунта (физическо/юридическо лице).
3. Създай ново приложение (My apps → New) с package `com.kcy.planeshooter.huawei`.

## 2. Качване на тестов APK/AAB
- AppGallery приема **APK** и **AAB**. За тест качи `app-debug.apk` или
  подписан `app-release.apk`.
- Качването е в **App information → Software version / Package**.

## 3. Закрито тестване (Closed/Internal testing)
AppGallery предлага **„Open/Closed testing"**:
1. AppGallery Connect → приложение → **Operate → Test → Closed test**.
2. Добави тестери чрез групи (HUAWEI ID акаунти) или линк за покана.
3. Качи тестовата версия в тестовия трек.
4. Тестерите инсталират от линка през AppGallery.

## 4. IAP sandbox (само ако се добави HMS IAP — НЕ е активно тук)
- HMS IAP има **sandbox** режим: добави тестови HUAWEI ID акаунти в
  AppGallery Connect → Users and permissions → Sandbox testers.
- Изисква `agconnect-services.json` в android проекта.
- Текущата версия НЯМА покупки — раздел TODO (виж README → HMS SDK).

## 5. Ревю преди публикация
- Ревюто обикновено отнема 1–3 работни дни.
- Чести причини за отказ: липсваща/невалидна политика за поверителност,
  грешен рейтинг, или приложение, което изисква GMS на HMS устройство.

## Бележка за GMS / HMS
Това приложение **не зависи нито от Google Play Services (GMS), нито от HMS
core SDK**. То е чист web + Capacitor core и работи на Huawei устройства без
Google услуги. Ако в бъдеще се добави IAP/Push, ще се ползва HMS (не GMS).
