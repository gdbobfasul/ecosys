# Huawei AppGallery — тестова среда / затворено тестване

## 1. Регистрация на разработчик
1. Влез в AppGallery Connect: https://developer.huawei.com/consumer/en/console
2. Завърши регистрация на разработчик (изисква се верификация на самоличност).
3. Създай ново приложение (Project → App) с package `com.pupikes.duel.huawei`.

## 2. Качване на тестов APK/AAB
- AppGallery приема **APK** и **AAB**. За тест качи `app-debug.apk` или подписан
  `app-release.apk`.
- Раздел: My apps → (приложението) → Distribute → Software packages.

## 3. Затворено тестване
1. AppGallery Connect → Operate / App testing → **Open testing / Closed testing**.
2. Добави тестери (Huawei ID e-mail адреси) в групата за тестери.
3. Качи версията в тестовия трек и разпространи линка към тестерите.

## 4. Билинг
Не е приложимо — приложението НЯМА покупки (изцяло безплатно, без IAP, без
HMS In-App Purchases).

## 5. Ревю преди публикация
- Ревюто на AppGallery обикновено е 1–2 работни дни.
- Чести причини за отказ: липсваща политика за поверителност, грешен възрастов
  рейтинг, неработещ APK без HMS/GMS.

## Бележка за HMS/GMS
Това приложение **не зависи нито от Google Play Services, нито от HMS Kits**.
Чист web (vanilla JS, DOM + WebM видеа) + Capacitor core; работи на Huawei
устройства без Google и без HMS-вход.

## Бележка за размера
Видео-активите (~180 MB) са вградени в APK/AAB. Това е нормално за игра с
видео-анимации — качи цялостен пакет.
