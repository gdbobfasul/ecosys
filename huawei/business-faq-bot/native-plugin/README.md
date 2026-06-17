# native-plugin/ (преместено)

Плъгинът **NotificationReply** вече е **РЕАЛНО имплементиран** и живее в `../native/`:

- `../native/notification-reply/KcyNotificationListener.kt` — `NotificationListenerService`
- `../native/notification-reply/NotificationReplyPlugin.kt` — Capacitor `@CapacitorPlugin`
- `../native/notification-reply/AndroidManifest.fragment.xml` — `<service>` фрагмент
- `../native/install-into-android.sh` — инсталатор в генерираната `android/`
- `../native/README.md` — пълната документация

JS мостът е `src/core/native-reply.js`; каналите минават през `src/core/channel-adapter.js`.
Тази папка се пази само за обратна съвместимост — виж `../native/`.
