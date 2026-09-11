# chat — тестови акаунти на живия сайт (my.girl.place)

Създадени на 2026-09-11 за снимките в магазина и за проверка от модератора (Huawei/RuStore).
Регистрацията през `POST /api/auth/register` прави НЕПЛАТЕН акаунт (не може да влезе) → абонаментът е
активиран през админ маршрута `POST /api/admin/payment-override/apply` (action `login`, 90 дни; ADMIN_ALLOWED_IPS
в .env включва 0.0.0.0/0). При изтичане → пак същата заявка (или payment-override.html).

| # | Телефон | Парола | Име | Пол | Държава/град | userId | Абонамент до |
|---|---------|--------|-----|-----|--------------|--------|--------------|
| 1 | 359888100021 | Pupikes2026x | Pupikes Tester | male | Bulgaria / Sofia | 1 | 2026-12-10 |
| 2 | 359888100022 | Pupikes2026x | Maria Ivanova | female | Bulgaria / Sofia | 2 | 2026-12-10 |

Сесиите (Bearer token, 30 дни от 2026-09-11; ПРЕСЪЗДАДЕНИ на 2026-09-11 ~03:40 UTC, защото живата база беше изтрита при деплой и акаунтите изчезнаха) са семената в `publish.config.json` → `storage.token` (акаунт 1).
Ако токенът изтече: `POST /api/auth/login {phone,password,client:"web"}` → нов token → смени го в конфига.
Внимание: `/api/auth/*` има лимит 5 заявки/15 мин, `/api/*` — 100/15 мин на IP (затова генераторът на снимки се пуска
език по език с пауза, виж scratchpad runner).

Примерни данни (живи, в базата на сайта):
- Контакт 1↔2 + 4 съобщения (водопроводчик / течащ кран) — екран „Чат".
- Задачи (публикувани): #1 „Pick up a parcel…" (15 EUR, Sofia), #2 „Is this apartment for rent real?" (verify, Plovdiv, 20 EUR),
  #3 „Water the plants for 3 days" (25 EUR); от акаунт 2: #4 „Check that a car dealer exists" (verify, Berlin, 30 EUR),
  #5 „Help to carry boxes" (Varna, 40 EUR).
- Профил 1: предлага Plumber, Electrician, English; нужда Auto Mechanic. Профил 2: Teacher, Babysitter, German; нужда Plumber.
- Сватосване: критерии и за двата; покана от 2 → 1 (получена покана).
- Верификация: заявка #1 от акаунт 1 (Doctor, „City Clinic Sofia", BG-MED-2024-118, статус pending — админът може да я одобри
  от admin-verification.html, тогава акаунт 1 получава значка „проверен").
