# Контролен лист за публикуване — Huawei AppGallery

## Идентичност
- App ID: `com.kcy.monitorbot.huawei`
- Име: KCY Site Monitor
- Акцент: #16c79a (Huawei тюркоаз)

## Активи
- [ ] `npm run gen:assets` → `store/icon.svg`, `store/splash.svg`
- [ ] Конвертирай SVG → PNG: икона 512×512 и feature/screenshots по изисквания на Huawei AppGallery.
      (напр. `npx @capacitor/assets generate` след `npx cap add android`, или ръчно)
- [ ] Екранни снимки: Онбординг, Настройка на монитор, Табло, Разрешения.

## Билд
- [ ] `npm install`
- [ ] `npm run build`
- [ ] `npx cap add android && npx cap sync`
- [ ] APK/AAB подписан през Android Studio (изисква Android SDK/JDK — не в тази среда)

## Декларации (вж store/data-safety.md)
- [ ] Без събиране на данни, без споделяне, без проследяване.
- [ ] Разрешения: ИНТЕРНЕТ (за източниците), ИЗВЕСТИЯ (локални).
- [ ] Без GMS/HMS/Firebase, без реклами, без покупки (премиумът е STUB).

## Съответствие
- [ ] Описанието съвпада с поведението (само локални известия).
- [ ] Политика за поверителност отразява „on-device, без акаунти".
