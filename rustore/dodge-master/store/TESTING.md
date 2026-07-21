# RUStore — тестова среда и затворено тестване

## 1. Браузър (основна тестова среда за разработка)
```
npm install
npm run dev      # отваря на http://localhost:5174
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

## 4. Затворено тестване в RUStore
1. Влез в RUStore Console (https://console.rustore.ru).
2. Създай ново приложение с appId `com.pupikes.dodgemaster.rustore`.
3. Качи подписан release APK/AAB.
4. Раздел „Тестване" → създай списък с тестери (имейли) → „Затворено тестване".
5. Сподели линка за тестери; те инсталират през RUStore клиента.

## 5. RUStore SDK (билинг/push) — TODO стъб
Текущата версия НЯМА билинг и push. Точки за интеграция:
- `src/store/rustore-sdk.js` — JS стъб (`RuStoreBilling`, `RuStorePush`).
- Реалните SDK са нативни (Gradle): `ru.rustore.sdk:billingclient`,
  `ru.rustore.sdk:pushclient`. Добавят се в `android/app/build.gradle`
  + Capacitor bridge plugin за връзка с JS.
- БЕЗ Google Play Services / Firebase (RUStore няма GMS).
