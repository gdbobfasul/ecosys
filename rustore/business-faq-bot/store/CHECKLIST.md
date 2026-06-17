# Release CHECKLIST — Бизнес FAQ робот (RUStore)

## Идентичност
- [ ] App ID `com.kcy.businessfaqbot.rustore` (capacitor.config.json)
- [ ] Икона/сплаш генерирани: `npm run gen:assets` (акцент #7b5cff)
- [ ] Версия в package.json

## Билд
- [ ] `npm install`
- [ ] `npm run build` (dist/ ок)
- [ ] `npm run cap:add` (само на машина с Android SDK)
- [ ] **`bash native/install-into-android.sh`** (вкарва NotificationReply плъгина в android/) — СЛЕД cap:add, ПРЕДИ gradle
- [ ] `npm run cap:sync`
- [ ] APK билд (опция 38) — НЕ от тази dev среда (няма SDK/JDK)

## Магазин (RUStore)
- [ ] LISTING.md → описание/ключови думи
- [ ] data-safety.md → декларация за данни
- [ ] messaging-policy.md → обяснение на Notification access
- [ ] Screenshots от демо чата + табло

## Платежен STUB
- [ ] `src/store/rustore-sdk.js` е STUB (no-op). За реален наем → RuStore Billing Client.

## Notification access (ако се пуска с месинджъри)
- [ ] Native плъгин РЕАЛЕН: `native/notification-reply/` (виж `native/README.md`)
- [ ] `<service>` за NotificationListenerService в AndroidManifest.xml (install скриптът го слива)
- [ ] Декларация за достъп до нотификации в листинга
- [ ] Видим текст за съгласие пред потребителя (екран „Канали" + бутон „Notification access")
- [ ] Само за SIDELOAD — преглед на notification-access/авто-отговор в магазините е строг
- [ ] Тества се само на реално устройство с инсталирани WhatsApp/Viber/Messenger

## Поверителност
- [ ] Без контакти/акаунти/локация/проследяване — потвърдено в кода
- [ ] Единствено разрешение: Известия
