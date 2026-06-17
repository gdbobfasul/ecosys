# Messaging Policy Note — WhatsApp / Viber / Messenger

Честно описание на реалността около интеграцията с месинджъри.

## Какво работи СЕГА
- Канал **`local`** (вграден демо чат) — изцяло on-device, напълно тестваем в браузъра и в
  APK. Rule engine-ът е канал-независим и дава отговори за всеки вход.

## Какво изисква native интеграция
Авто-отговорът в WhatsApp/Viber/Messenger е възможен **безплатно** само чрез Android
**`NotificationListenerService` + notification direct-reply**:
- потребителят трябва ръчно да даде **„Notification access"** (Settings → Special access);
- нужен е native Capacitor плъгин (Kotlin) — виж `native-plugin/README.md`;
- разрешение в манифеста: **`BIND_NOTIFICATION_LISTENER_SERVICE`**.

В приложението тези канали показват статус **„изисква native билд (опция 38) + Notification
access"** и **НЕ** симулират изпращане.

## Какво е извън обхвата
Официалните сървърни bot платформи изискват сървър, токени/ключове и одобрение, затова не са
част от това изцяло on-device приложение:
- **WhatsApp Cloud API / Business API** (Meta) — изисква бизнес верификация и сървър.
- **Viber Bot API** — изисква public account + токен + сървър.
- **Messenger Platform** (Meta) — изисква Facebook Page, app review и сървър.

## Преглед в магазините
- **Google Play:** приложения с notification-access минават специален преглед и изискват
  декларация защо този достъп е необходим.
- **RUStore / Huawei AppGallery:** аналогични изисквания за достъп до нотификации.
- Meta/Viber може да третират автоматизирани отговори от неофициални канали като нарушение на
  условията — отговорност на оператора на бизнеса да спази правилата на съответната платформа.

> Накратко: показваме само това, което реално можем да направим on-device, и ясно маркираме
> останалото като „pending native". Нищо не се фалшифицира.
