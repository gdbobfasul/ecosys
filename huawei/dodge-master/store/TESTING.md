# Huawei AppGallery — тестова среда и затворено тестване

## 1. Браузър (основна тестова среда за разработка)
```
npm install
npm run dev      # отваря на http://localhost:5175
```
Това е средата за бързо тестване на геймплея. Играта тръгва изцяло в браузъра.

## 2. Уеб билд (за паковане)
```
npm run build    # създава dist/
npm run preview  # локален преглед на продукционния билд
```

## 3. Android APK (изисква външна машина с Android SDK/JDK!)
> ВАЖНО: тази dev машина НЯМА Java/Gradle/Android SDK. Стъпките по-долу се
> изпълняват на машина с инсталиран Android SDK или в CI.
```
npm run build
npx cap add android        # еднократно
npx cap sync android
cd android
./gradlew assembleDebug    # -> android/app/build/outputs/apk/debug/app-debug.apk
# release:
./gradlew assembleRelease  # подпиши с keystore преди качване
```

## 4. Затворено тестване в AppGallery Connect
1. Влез в AppGallery Connect (https://developer.huawei.com/consumer/en/console).
2. Създай ново приложение с package name `com.kcy.dodgemaster.huawei`.
3. Качи подписан release APK/AAB (без HMS зависимости — играта е чисто уеб).
4. Раздел „Testing" → „Open/Closed testing" → добави тестери (HUAWEI ID/имейли).
5. Сподели линка/QR; тестерите инсталират през AppGallery.

## 5. Huawei HMS SDK (билинг/push) — TODO стъб
Текущата версия НЯМА билинг и push. Точки за интеграция:
- `src/store/huawei-sdk.js` — JS стъб (`HuaweiBilling`, `HuaweiPush`).
- Реалните SDK са нативни (Gradle): `com.huawei.hms:iap`, `com.huawei.hms:push`,
  + `agconnect-services.json` и AGConnect Gradle plugin в `android/`.
- Capacitor bridge plugin за връзка JS ↔ нативно.
- БЕЗ Google Play Services / Firebase.
