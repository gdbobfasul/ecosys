# Release Checklist — Auto-Reply Bot (RUStore)

## Преди публикация
- [ ] `npm install` минава без грешки.
- [ ] `npm run build` създава `dist/`.
- [ ] `node tools/gen-assets.mjs` → `store/icon.svg`, `store/splash.svg`.
- [ ] Конвертирай SVG → PNG за store: икона 512×512, feature/splash по изискване.
- [ ] App ID = `com.kcy.autoreplybot.rustore` (в `capacitor.config.json`).
- [ ] Версия в `package.json` вдигната.

## Нативен билд (на машина с Android SDK/JDK — НЕ в тази среда)
- [ ] `npx cap add android`
- [ ] **`bash native/install-into-android.sh`** (вкарва NotificationReply плъгина в android/) — СЛЕД cap add, ПРЕДИ gradle.
- [ ] `npx cap sync android`
- [ ] Android Studio → подписан AAB/APK.
- [ ] Без GMS/HMS/Firebase зависимости.

## Месинджъри (по избор — реален авто-отговор в WhatsApp/Viber/Messenger)
- [ ] Native плъгин: `native/notification-reply/` (KcyNotificationListener.kt + NotificationReplyPlugin.kt) — РЕАЛЕН.
- [ ] `<service>` за NotificationListenerService е в AndroidManifest.xml (install скриптът го слива).
- [ ] Изисква системно „Notification access" (бутон в екран „Разрешения" го отваря).
- [ ] Само за SIDELOAD — преглед на notification-access/авто-отговор в магазините е строг.
- [ ] Тества се само на реално устройство с инсталирани WhatsApp/Viber/Messenger.

## RUStore специфика
- [ ] Decl. за поверителност = on-device, без данни (виж `DATA-SAFETY.md`).
- [ ] Ако се активира реален IAP: смени STUB в `src/store/rustore-sdk.js` с RuStore Billing.
- [ ] Възрастов рейтинг, скрийншоти (от Demo Inbox + Правила + Табло).

## Качество
- [ ] `node --check` на всички `src/**/*.js`.
- [ ] Ръчни тестове по `TESTING.md`.
