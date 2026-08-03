# RuStore — Форма за публикуване (стъпка по стъпка)

Пълен процес за качване на приложение в RuStore Console. Конкретните стойности са от **newslator**
(като работещ пример); за друг ап сменяш само името/файла. Документът е **жив** — оставащите стъпки на
съветника се дописват, щом ги минем.

- **Конзола:** https://console.rustore.ru/apps
- **Браузър:** преизползва се ЕДИН debug браузър (порт 9222), профил `deploy-scripts/.rustore-profile` —
  влизаш РЪЧНО само веднъж (заради блокировки от много логвания).
- **Стартер:** `node deploy-scripts/rustore-release-bot-launch.cjs`  ·  **Бот:** `node deploy-scripts/rustore-release-bot.cjs <app> --loop`  ·  **Меню:** точка **92**
- **Принцип:** ботът попълва ВИДИМО. След всеки екран **пита** дали да натисне бутона за напред
  (`Continue` / `OK` / `Add` / `Select` / `Submit for Moderation`) — при отговор „да/y" го натиска сам
  (заобикаля случая, когато бутонът е скрит в дъното и не се вижда). Иначе го натискаш ти.

---

## Стъпка 0 — „Add an app" → диалог „New app"
Екран: списък с приложения → бутон **Add an app** → диалог „New app".

| Поле | Стойност | Бележка |
|------|----------|---------|
| Application type | **Universal** (Phones, tablets, TV) | radio `deviceType=MOBILE` |
| Monetization strategy | **Paid** (Selling the app itself) | radio `monetizationType=PAID` · **НЕОБРАТИМО** (cannot be changed) |
| Console name | **Pupikes <Име>** (напр. „Pupikes NewsLator") | **НЕИЗМЕНЯЕМО** · само за теб; ако името вече започва с „Pupikes" → без дублиране |

→ Натискаш **Add** сам. Приложението се създава, статус **Not published**, компания **DaiGrup LTD.**

## Стъпка 1 — отвори приложението
От списъка кликваш на **„Pupikes <Име>"** → отваря се (пада на някой подтаб, напр. `/subscriptions`).

**Ляво меню (секции):** App page · Versions · Permissions · Reviews · Countries and Regions ·
App statistics · API RuStore · App Signing Key · RuStore Tools · Promotion (Events) ·
Monetization (Subscriptions, In-App purchases, …).

⚠ **App page е ЗАКЛЮЧЕНА** до първата качена версия:
„No application page is available in RuStore yet. It will appear after the first version or pre-order is published."
Затова **първо се качва версия (APK)**, чак после описание/снимки/цена.

## Стъпка 2 — Versions → „Upload the version" (екран „Upload app version")
URL: `/apps/<id>/versions/add`. Съветник от стъпки: Files → подпис → инфо → снимки → настройки.

| Поле | Какво качваш / пишеш |
|------|----------------------|
| **APK or AAB files** | `apk/rustore/release/<Име>-rustore-release.apk` (за newslator: **NewsLator-rustore-release.apk**). Поле `input[type=file][name="storageUploads"]`, приема `.apk/.aab`, до 5 GB. Файлът е **вече подписан** (release, ключ пер-ап от `release-apks.sh`). |
| **Upload signature for AAB** | **НЕ се пипа** — това е само за AAB. При APK RuStore не иска отделен upload-подпис/ключ. |
| **Comment for moderator** (по избор, на руски) | Зависи от акаунт/лични данни — виж по-долу. |

**Коментар за модератора** (чете се от `huawei/<app>/publish/moderator.json`; ако липсва → default):
- **Всички апове освен houselookbook** (без акаунт, без лични данни):
  `Регистрация и вход в аккаунт не требуются. Персональные данные не собираются и не передаются.`
- **houselookbook** (единственото с потребителски акаунт):
  `Для работы приложения используется аккаунт — регистрация доступна прямо в приложении и бесплатна. Персональные данные не собираются и не передаются.`
- Надписване per-app: `moderator.json` с полета `{ "account":bool, "testCreds":"…", "personalData":bool, "dataDetails":"…", "comment":"пълен ръчен текст (има приоритет)" }`.

**Бележка „предзаказ" (pre-order):** на екрана пише _„Если хотите привлечь аудиторию до релиза — загрузите предзаказ.
После отправки версии на модерацию сделать это уже не получится."_ Това е **по желание** (маркетинг — събиране на
публика преди старта) и може да се направи само ПРЕДИ да пратиш версия на модерация. **Ние го пропускаме** и пускаме
нормално.

→ Натискаш **Continue** сам (или „Save as draft").

## Стъпка 3 — съветник, стъпка „Safety" (Requested data)
Екран „Upload app version", стъпка **Safety**: **Requested data** — „Select the data types your app collects",
падащо **Data types** (0 / 38).
- **Нашите приложения НЕ събират лични данни** → **не се избира нищо**, остава **0/38** (важи и за houselookbook —
  има акаунт, но лични данни не събира).
- **Sensitive Permissions:** ако APK-то иска чувствително разрешение (напр. **POST_NOTIFICATIONS** — апове с известия),
  RuStore показва поле **„Reasons"** и иска обяснение. Текстът се задава в `huawei/<app>/publish/rustore.json` →
  **`sensitivePermissionReason`** (руски). Ботът го чете оттам и попълва полето. Ако липсва разрешение — полето не се показва.
- → Натискаш **Continue** сам.

## Стъпка 4 — съветник, стъпка „Information" (екрани 5–7, едно превъртане)
Полета (`name` на елемента):

| Поле | `name` | Стойност |
|------|--------|----------|
| Application name (User-facing name) | `appName` | публичното име = store `_default` (напр. **NewsLator**) — не console name |
| Type | `appTypeOption` (radio) | **MAIN**=Application / **GAMES**=Game (игри: rustam, fps-hunter, plane-shooter, …) |
| Minimum Android version | — | остава **5** (по подразбиране) |
| **Price** (₽) | `priceValue` | цена в рубли, **Paid**; **винаги закръгляме НАГОРЕ** (newslator: **111₽**) |
| Categories → **Main** | падащо | точен руски надпис (newslator: **Новости и события**). Опции: Финансы, Полезные инструменты, Общение, Развлечения, Здоровье, Образование, Книги, Спорт, **Новости и события**, Питомцы, … |
| Additional (optional) | падащо | по желание — пропуска се (None) |
| **Age restriction** | падащо | 0+ / 6+ / 12+ / 16+ / 18+ (newslator: **16+**) |
| **Search Tags** | react-select (мулти, до 5) | **ЗАДЪЛЖИТЕЛНО** — важи за търсенето. По **5 английски тага** от фиксиран списък (76 опции: News, Communication, Photo editors, Web browsers, …). Per-app списъкът е в таблицата по-долу. |
| **Short description** | `shortDescription` | **руски** brief (newslator: „Мировые новости") |
| **Description** | `fullDescription` | **руски** full |
| Contacts → E-mail | `developerContacts.email` | **miroljubkalaydjiev177@gmail.com** |
| Contacts → Company website | `developerContacts.website` | **https://pupikes.com** |
| VK community | `developerContacts.vkCommunity` | пропуска се |
| Frequently Asked Questions | — | по желание — пропуска се |

Per-app стойностите (type/category/age/priceRub) са в `huawei/<app>/publish/rustore.json`.
→ Ботът натиска **„Save as draft"** (по изрично искане). Иначе „Continue" за напред.

## Стъпка 5 — съветник, стъпка „Media files" (икона + скрийншоти)
| Поле | `name` на input | Какво качваш |
|------|-----------------|--------------|
| **App Icon** (Mobile devices) | `icon` | `publish/icon-512.png` — JPG/PNG, **1:1**, ≤1 MB, страна 32–512 px |
| **Phone screenshots** (Telephone, 0/10) | `screens` | номерираните `publish/1-*.png … N-*.png` (мин. **3**). JPG/PNG, ≤5 MB. Ориентация 9:16 или 16:9 по първия файл (нашите са вертикални 1080×2280 → 9:16, RuStore реже до формата). |
| Tablet screenshots (optional) | `tabletScreens` | **пропуска се** |
| Video (VK Video link) | — | **пропуска се** (нямаме VK видео) |
| Background video for application card | — | **пропуска се** |

→ Натискаш **Continue** сам.

## Стъпка 6 — съветник, стъпка „Settings" (⚙, последна)
- Само **дали приложението да се релийзне автоматично след одобрение** — оставя се **Automatic** (по подразбиране).
- → Натискаш **Continue** сам (завършва съветника; версията става чернова, готова за публикуване).

## Countries and Regions — НЯМА какво да се прави
Наличността по подразбиране е **„Everywhere"** — оставя се така. Няма цена по държави (цената е една, от „Information"). Ботът не пипа тази секция.

## Стъпка 7 — Публикуване (Versions → Publish)
- Секция **Versions** → бутон **„Publish"** (rollout 100%, release = Automatic) → праща версията за **модерация** → авто-релийз след одобрение.
- Това натискаш ТИ (финално подаване).

## Одит на дървото (какво НЕ е нужно)
Проверени секции за newslator — нищо друго не изисква попълване за първо пускане:
- **App page** — авто-появява се СЛЕД публикуване на версията (не се пълни отделно).
- **Permissions** (екип), **App Signing Key** (само за AAB), **API RuStore**, **RuStore Tools**, **Promotion/Events**, **Monetization** (Subscriptions/In-App — нямаме), **Reviews**, **App statistics** — не са нужни.

## Данни по приложение (per-app rustore.json)

Тип, категория, възраст, цена (₽) и **5-те Search Tags** за всяко приложение. Източник: `huawei/<app>/publish/rustore.json` (генератор: `deploy-scripts/gen-rustore-config.mjs`). Игрите са с игрален речник за категория/тагове → празни, попълват се при първата игра.

| Приложение | Тип | Категория | Възраст | Цена ₽ | Search Tags |
|---|---|---|---|---|---|
| authenticator | Application | Полезные инструменты | 0+ | 378 | Personal finance, Investments, Mobile payments, Work, Personal assistants |
| auto-sound-diagnostics | Application | Транспорт и навигация | 0+ | 111 | Driving apps, Audio recording, Home assistant, Personal assistants, Work |
| autoreply-bot | Application | Общение | 0+ | 111 | Messaging, Communication, Email, Call recording, Work |
| baby-monitor | Application | Родителям | 0+ | 378 | Childcare, Mother & Child, Home assistant, Sleep, Personal assistants |
| business-faq-bot | Application | Бизнес-сервисы | 0+ | 111 | Work, Communication, Personal assistants, Email, Job search |
| camera-watch | Application | Полезные инструменты | 0+ | 378 | Home assistant, Photography, Photo editors, Personal assistants, Work |
| chat | Application | Общение | 12+ | 111 | Messaging, Communication, Video calls, Social, Email |
| dodge-master | Game | (игрален) | 6+ | 111 | (игра — ръчно) |
| duel | Game | (игрален) | 12+ | 111 | (игра — ръчно) |
| fps-hunter | Game | (игрален) | 12+ | 111 | (игра — ръчно) |
| hmm | Game | (игрален) | 12+ | 111 | (игра — ръчно) |
| houselookbook | Application | Объявления и услуги | 0+ | 111 | Interior design, Blogs, Lifestyle, Photography, Personal assistants |
| market-pulse | Application | Финансы | 0+ | 111 | Investments, Personal finance, News, Calculators, Work |
| monitor-bot | Application | Полезные инструменты | 0+ | 111 | Web browsers, Work, Personal assistants, Communication, Email |
| newslator | Application | Новости и события | 16+ | 111 | News, Blogs, Language learning, Communication, Encyclopedias |
| plane-shooter | Game | (игрален) | 6+ | 111 | (игра — ръчно) |
| price-watch-bot | Application | Покупки | 0+ | 111 | Loyalty & rewards, Personal finance, Work, Personal assistants, Investments |
| pupikes-doctor | Application | Здоровье | 12+ | 111 | Medicine, Fitness trackers, Self-improvement, Encyclopedias, Personal assistants |
| pupikes-medicines | Application | Здоровье | 12+ | 111 | Medicine, Encyclopedias, Personal assistants, Fitness trackers, Self-improvement |
| pupikes-toolkit-3drotate | Application | Полезные инструменты | 0+ | 111 | Photo editors, Photography, Video editors, Work, Personal assistants |
| pupikes-toolkit-ai-announcement | Application | Бизнес-сервисы | 0+ | 111 | Work, Personal assistants, Communication, Email, Job search |
| pupikes-toolkit-finance | Application | Финансы | 0+ | 111 | Personal finance, Investments, Calculators, Work, Mobile payments |
| pupikes-toolkit-passwords | Application | Полезные инструменты | 0+ | 111 | Work, Personal assistants, Mobile payments, Communication, Notepads |
| pupikes-toolkit-pdf | Application | Полезные инструменты | 0+ | 111 | Work, Notepads, Personal assistants, Grammar, Email |
| pupikes-toolkit-pictures | Application | Полезные инструменты | 0+ | 111 | Photo editors, Photography, Wallpapers, Video editors, Work |
| pupikes-toolkit-qr | Application | Полезные инструменты | 0+ | 111 | Work, Personal assistants, Mobile payments, Communication, Web browsers |
| pupikes-toolkit-scraper | Application | Полезные инструменты | 0+ | 111 | Web browsers, Work, Personal assistants, Communication, Blogs |
| pupikes-toolkit-sound | Application | Полезные инструменты | 0+ | 111 | Audio recording, Call recording, Radio, Audiobooks, Work |
| pupikes-toolkit-text | Application | Полезные инструменты | 0+ | 111 | Grammar, Notepads, Work, Language learning, Personal assistants |
| pupikes-toolkit-videos | Application | Полезные инструменты | 0+ | 111 | Video editors, Video players, Video downloaders, Video streaming, Photography |
| routine-bot | Application | Образ жизни | 0+ | 111 | Calendar, Self-improvement, Personal assistants, Notepads, Clocks, alarms, and timers |
| rustam | Game | (игрален) | 0+ | 111 | (игра — ръчно) |
| selflearning-friend | Application | Образование | 0+ | 111 | Language learning, Self-improvement, Encyclopedias, Grammar, Mathematics |
| services-toolkit | Application | Полезные инструменты | 0+ | 111 | Work, Photo editors, Video editors, Calculators, Personal assistants |
| titans-fight | Game | (игрален) | 12+ | 111 | (игра — ръчно) |

## Ключове / подписване (обобщено)
- Release APK-тата са **подписани** при билда (`release-apks.sh`, ключ пер-ап).
- За **APK** RuStore **не иска** отделен upload-подпис.
- Секция **App Signing Key** — само за AAB / бъдещи ъпдейти.

## Кое прави ботът автоматично
| Екран | Ботът прави | Ти правиш |
|-------|-------------|-----------|
| New app | Universal + Paid + Console name „Pupikes …" | натискаш **Add** |
| списък с приложения | отваря нашето по console name | — |
| подтаб на апа | навигира към „App page" | — |
| Versions | отваря „Upload the version" | — |
| Upload app version | качва APK + коментар за модератора | натискаш **Continue** |

_(следващите редове се добавят, щом разчетем оставащите екрани)_
