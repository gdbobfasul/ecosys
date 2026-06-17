# NotificationReply — реален native Capacitor плъгин (on-device)

Този плъгин дава **реален** авто-отговор в **WhatsApp / Viber / Facebook Messenger** на
Android — безплатно, изцяло на устройството, без сървър/bot API, без GMS/HMS/Firebase.

## Как работи (накратко)

Единственият безплатен on-device начин един потребителски app да авто-отговаря в тези
месинджъри е чрез:

1. **`NotificationListenerService`** (`KcyNotificationListener.kt`) — системна услуга, която
   чете входящите **нотификации** на целевите приложения, извлича подател + текст и ги буферира.
2. **Notification direct-reply** — повечето месинджъри слагат `RemoteInput` action („Reply") в
   нотификацията. От услугата вземаме този `Notification.Action` и изстрелваме отговора през
   неговия `PendingIntent` — **без да отваряме самото приложение**.

Изисква потребителят ръчно да даде **„Notification access"** в
*Settings → Apps → Special access → Notification access*. Приложението има бутон, който отваря
точно този екран.

> Официалните bot платформи (WhatsApp Cloud API, Viber Bot API, Messenger Platform) изискват
> сървър, токени и одобрение — **извън обхвата** на това изцяло on-device приложение.

## Файлове тук

| Файл | Какво е |
|------|---------|
| `notification-reply/KcyNotificationListener.kt` | `NotificationListenerService` — чете нотификации, буфер, direct-reply |
| `notification-reply/NotificationReplyPlugin.kt` | `@CapacitorPlugin(name="NotificationReply")` — мостът към JS |
| `notification-reply/AndroidManifest.fragment.xml` | `<service>` фрагмент за вмъкване в `<application>` |
| `notification-reply/register.txt` | Имена/регистрация на плъгина |
| `install-into-android.sh` | Копира .kt + слива манифеста + регистрира плъгина в `android/` |

`android/` е генерирана + gitignored, затова native кодът живее тук и се „инсталира" в нея
със скрипта **след** `npx cap add android`.

## JS методи (registerPlugin('NotificationReply'))

- `isAccessGranted()` → `{ value }` — дали е даден „Notification access".
- `openAccessSettings()` — отваря системния екран за достъпа.
- `getRecent()` → `{ messages, connected }` — последните заловени съобщения.
- `reply({ key, text })` → `{ ok }` — direct-reply по нотификация (по нейния `key`).
- event `message` — emit-ва се при всяко ново заловено съобщение (`addListener('message', …)`).

JS мостът е `src/core/native-reply.js`; каналите го ползват през `src/core/channel-adapter.js`.
В браузър / без native слой всичко деградира честно (връща „не е налично", БЕЗ да симулира).

## Стъпки за активиране (на машина с Android SDK/JDK — НЕ в тази dev среда)

```bash
npx cap add android            # генерира android/
bash native/install-into-android.sh   # вкарва плъгина в android/
npx cap sync android
# после: Android Studio / gradle → подписан APK (sideload)
```

На устройството: дай „Notification access“ (бутонът в приложението го отваря) → включи
WhatsApp/Viber/Messenger.

## Честно за магазина (важно)

- Реалистично е само за **SIDELOAD** билд (директен APK). Преглед в магазините на
  notification-access + авто-отговор е **строг**: Google Play има отделна декларация за този
  достъп и често отказва автоматизирани отговори; RUStore/Huawei AppGallery — също по-строго.
- Работи **само на реално устройство** (не в браузър/емулатор без съответните приложения).
- Виж `store/messaging-policy.md` (business-faq-bot) / `store/CHECKLIST.md`.
