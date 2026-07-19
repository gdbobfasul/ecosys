# Робот — репорт (prod)

- Цел: `https://take.offbitch.com`
- Старт: 2026-07-19T12:03:32.199Z  ·  Времетраене: 91692 ms
- Сценарии: 7  ·  Прегледани адреси: 66
- **Грешки: 9  ·  Предупреждения: 0  ·  Инфо (очаквани 401/403): 0**

## Находки

| Тежест | Вид | Прил. | HTTP | Къде | Детайл |
|---|---|---|---|---|---|
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label кодът за брояч 0 е ТОЧНО 755224 (RFC 4226 еталон): HOTP(0) на екрана е 177324, еталонът е 755224 |
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label Настройки → Намери дубликати → групата е намерена → изтрий избраните: очаквах 4 записа след триенето |
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label вярната парола отключва и записите са си там: след отключване записите не са 4 |
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label .json бекъп: 4 записа с верните тайни: .json бекъпът няма 4 записа |
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label изтрий RFC записа (с потвърждение): след триене записите не са 3 |
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label записът се отваря с картинка и разчетено съдържание: разчетеното съдържание на QR кода не се показва |
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label таб „Пароли" → + → нов запис: page.click: Timeout 25000ms exceeded. |
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label таб „Портфейли": 12 плочки; + без избран портфейл → подсказка: page.click: Timeout 25000ms exceeded. |
| 🔴 | journey | authenticator |  | http://127.0.0.1:56619/ | label отключване → 6 кода, 1 колекция, 2 пароли, 1 портфейл — всичко си е там: кодовете след презареждане не са 6 |

## Работни сценарии (като човек)

### KCY Authenticator (ЛОКАЛНО: пълен тест на всички функции, без телефон) — 12/21 минали
- ✅ **Старт: интро → език → правен екран (ред + без иконите-чекбокси)**
- ✅ **Сейф: валидации на паролата + създаване**
- ✅ **TOTP еталон (RFC 6238): кодът на екрана = независимо изчисление**
- ✅ **otpauth:// адрес попълва формата сам**
- 🔴 **HOTP еталон (RFC 4226): 755224 → бутон ↻ → 287082**
    - 🔴 HOTP(0) на екрана е 177324, еталонът е 755224 label кодът за брояч 0 е ТОЧНО 755224 (RFC 4226 еталон)
    - ⏭️ (пропусната) label ↻ следващ код → ТОЧНО 287082
- ✅ **Steam Guard: 5 знака от Steam азбуката = еталона**
- ✅ **Търсене, копиране, редакция и преместване**
- 🔴 **Дубликати: еднаква тайна се открива и се трие**
    - 🔴 очаквах 4 записа след триенето label Настройки → Намери дубликати → групата е намерена → изтрий избраните
- 🔴 **Заключване: грешна парола отказва, вярната отключва**
    - 🔴 след отключване записите не са 4 label вярната парола отключва и записите са си там
- ✅ **Смяна на master паролата**
- 🔴 **Експорти: 6 реални файла се свалят и са верни**
    - 🔴 .json бекъпът няма 4 записа label .json бекъп: 4 записа с верните тайни
    - ⏭️ (пропусната) label Aegis експорт: валиден JSON с db.entries
    - ⏭️ (пропусната) label 2FAS експорт: валиден JSON със services
    - ⏭️ (пропусната) label otpauth:// списък: 4 реда, съдържа тайните
    - ⏭️ (пропусната) label Google Authenticator QR: истински PNG (Steam се прескача)
    - ⏭️ (пропусната) label „Експортирай всички (QR)": .zip с 4 PNG файла
- 🔴 **Импорт кръг: изтрий запис → върни го от .json; списъците ловят дубликати**
    - 🔴 след триене записите не са 3 label изтрий RFC записа (с потвърждение)
    - ⏭️ (пропусната) label „+" → Импорт от файл → .json → RFC се връща
    - ⏭️ (пропусната) label Настройки → импорт на otpauth списъка → само дубликати, нищо ново
    - ⏭️ (пропусната) label Настройки → импорт от 2FAS файла → пак само дубликати
- ✅ **QR от картинка: качен PNG се разчита и внася акаунт**
- ✅ **Сканиране с камера (фалшив видеопоток с QR код)**
- 🔴 **Колекция: QR картинка със заглавие се пази и отваря**
    - 🔴 разчетеното съдържание на QR кода не се показва label записът се отваря с картинка и разчетено съдържание
- 🔴 **Пароли: ръчен запис + импорт от Chrome CSV (с дубликат) + експорти**
    - 🔴 page.click: Timeout 25000ms exceeded. label таб „Пароли" → + → нов запис
    - ⏭️ (пропусната) label Настройки → CSV импорт: 1 нов + 1 дубликат прескочен
    - ⏭️ (пропусната) label експорт Chrome/Edge CSV и Firefox CSV — двата формата са верни
    - ⏭️ (пропусната) label дубликати на пароли: копие → намира се → трие се
- 🔴 **Крипто портфейли: 12 плочки, добавяне с „око", бекъп кръг**
    - 🔴 page.click: Timeout 25000ms exceeded. label таб „Портфейли": 12 плочки; + без избран портфейл → подсказка
    - ⏭️ (пропусната) label Binance → + → акаунт със seed фраза → запазен, брой 1/20
    - ⏭️ (пропусната) label „окото": seed фразата е замъглена, окото я показва
    - ⏭️ (пропусната) label бекъп: експорт .json → импорт същия → само дубликат
- 🔴 **Презареждане: всичко е ШИФРОВАНО запазено и иска парола**
    - 🔴 кодовете след презареждане не са 6 label отключване → 6 кода, 1 колекция, 2 пароли, 1 портфейл — всичко си е там
- ✅ **Смяна на езика: български → English → обратно**
- ✅ **Долната KCY лента: версия + бутони на всеки екран**
- ✅ **Изтриване на сейфа: чисто начало**

## Сървърен лог (корелация)

Подозрителни редове от `/last-errors-bundle` (след пускането):
```
    2026/06/18 16:44:17 [error] 1926610#1926610: *8141 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 16:44:29 [error] 1926610#1926610: *8141 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 16:44:29 [error] 1926610#1926610: *8141 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:25:07 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:25:18 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:25:18 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:25:30 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:25:30 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:25:30 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:25:37 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:25:42 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:25:42 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:25:55 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:25:55 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:00 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:07 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:26:07 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:07 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:26:20 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:26:20 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:31 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:32 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:26:32 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:25:42 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:25:55 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:25:55 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:00 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:07 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:26:07 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:07 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:26:20 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:26:20 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:31 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 17:26:32 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 17:26:32 [error] 1960656#1960656: *9298 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 18:20:49 [error] 1967661#1967661: *10186 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 18:20:52 [error] 1967661#1967661: *10186 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 18:20:57 [error] 1967661#1967661: *10186 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 18:20:57 [error] 1967661#1967661: *10186 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 18:21:01 [error] 1967661#1967661: *10186 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 18:21:05 [error] 1967661#1967661: *10186 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/18 18:21:16 [error] 1970048#1970048: *10233 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/18 18:21:17 [error] 1970048#1970048: *10233 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
    2026/06/19 03:32:09 [error] 1974943#1974943: *15719 open() "/var/www/html/assets/js/qr_modal.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/qr_modal.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 03:32:15 [error] 1974943#1974943: *15722 open() "/var/www/html/assets/js/message.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/message.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 03:32:17 [error] 1974943#1974943: *15723 open() "/var/www/html/assets/js/auth.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/auth.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 07:11:26 [error] 1974943#1974943: *16288 open() "/var/www/html/assets/js/auth.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/auth.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 07:11:26 [error] 1974943#1974943: *16288 open() "/var/www/html/assets/js/qr_modal.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/qr_modal.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 07:11:27 [error] 1974943#1974943: *16288 open() "/var/www/html/assets/js/message.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/message.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 10:04:16 [error] 1974943#1974943: *16547 open() "/var/www/html/chat/public/' + l.href + '" failed (2: No such file or directory), client: 74.7.242.18, server: kaji.kak.si, request: "GET /chat/public/'%20+%20l.href%20+%20' HTTP/2.0", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/public/chat-footer.js?v=1.0001"
    2026/06/19 10:04:26 [error] 1974943#1974943: *16547 open() "/var/www/html/chat/assets/icon-192.png" failed (2: No such file or directory), client: 74.7.242.18, server: kaji.kak.si, request: "GET /chat/assets/icon-192.png HTTP/2.0", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/public/profile.html"
    2026/06/19 10:04:28 [error] 1974943#1974943: *16547 open() "/var/www/html/chat/assets/manifest.json" failed (2: No such file or directory), client: 74.7.242.18, server: kaji.kak.si, request: "GET /chat/assets/manifest.json HTTP/2.0", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/public/profile.html"
    2026/06/19 10:37:32 [error] 1974943#1974943: *16565 directory index of "/var/www/html/.well-known/acme-challenge/" is forbidden, client: 195.178.110.199, server: selflearning.bot.nu, request: "GET /.well-known/acme-challenge/ HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 10:37:32 [error] 1974943#1974943: *16565 open() "/var/www/html/.well-known/acme-challenge/*" failed (2: No such file or directory), client: 195.178.110.199, server: selflearning.bot.nu, request: "GET /.well-known/acme-challenge/* HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 10:37:39 [error] 1974943#1974943: *16565 open() "/var/www/html/shared/.env" failed (2: No such file or directory), client: 195.178.110.199, server: selflearning.bot.nu, request: "GET /shared/.env HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/19 10:37:44 [error] 1974943#1974943: *16581 directory index of "/var/www/html/.well-known/acme-challenge/" is forbidden, client: 195.178.110.199, server: selflearning.bot.nu, request: "GET /.well-known/acme-challenge/ HTTP/1.1", host: "selflearning.bot.nu"
    2026/06/19 10:37:44 [error] 1974943#1974943: *16585 open() "/var/www/html/.well-known/acme-challenge/*" failed (2: No such file or directory), client: 195.178.110.199, server: selflearning.bot.nu, request: "GET /.well-known/acme-challenge/* HTTP/1.1", host: "selflearning.bot.nu"
    2026/06/19 18:45:12 [error] 2010954#2010954: *17117 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/verification-requests?status=pending HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/verification-requests?status=pending", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/19 18:45:14 [error] 2010954#2010954: *17117 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html"
    2026/06/19 18:45:14 [error] 2010954#2010954: *17117 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.224, server: kaji.kak.si, request: "GET /api/admin/stats HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/stats", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin.html?view=all"
```
