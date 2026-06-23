# Документация на приложенията (не-игрови)

Описания „как функционира" за приложенията от KCY екосистемата, които не са игри. Метаданните за магазините (Google Play / RUStore / Huawei AppGallery) са в главната папка [`/metadata`](../../metadata/README.md).

## Сигурност / 2FA
- [KCY Authenticator](authenticator.md) — двуфакторни кодове (TOTP/HOTP/Steam), шифриран сейф, колекция от QR кодове, пароли. Мобилно + уеб.

## Ботове и асистенти
- [autoreply-bot](autoreply-bot.md) — авто-отговори по правила за пясъчна (sandbox) пощенска кутия.
- [business-faq-bot](business-faq-bot.md) — отговори на ЧЗВ по ключови думи.
- [routine-bot](routine-bot.md) — дневен режим, напомняния, бележки с глас.
- [selflearning-friend](selflearning-friend.md) — самообучаващ се личен асистент (глас, зрение, учене), 15 езика.

## Наблюдение
- [baby-monitor](baby-monitor.md) — наблюдение на бебе с разпознаване на движение (на устройството).
- [camera-watch](camera-watch.md) — наблюдение през камера с класификация на обекти (на устройството).
- [monitor-bot](monitor-bot.md) — следене на RSS/JSON източници с известия.
- [price-watch-bot](price-watch-bot.md) — следене на цени (крипто/валути) с прагове.

## Инструменти и комуникация
- [services-toolkit](services-toolkit.md) — офлайн инструменти (QR, PDF, изображения и др.).
- [chat](chat.md) — обвивка към сървъра за анонимен чат.

> Бележка за езиците: част от тези приложения все още имат интерфейс на един език (текстовете са вградени). Извежда се отделна задача за добавяне на 15-езичния избор навсякъде (по модела на [KCY Authenticator](authenticator.md) и игрите rustam/dodge-master). Виж паметта `kcy-app-i18n-language-picker`.
