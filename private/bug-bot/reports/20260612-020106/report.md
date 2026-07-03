# Робот — репорт (prod)

- Цел: `https://take.offbitch.com`
- Старт: 2026-06-11T20:01:06.037Z  ·  Времетраене: 45254 ms
- Сценарии: 7  ·  Прегледани адреси: 67
- **Грешки: 4  ·  Предупреждения: 0  ·  Инфо (очаквани 401/403): 1**

## Находки

| Тежест | Вид | Прил. | HTTP | Къде | Детайл |
|---|---|---|---|---|---|
| 🔴 | journey | wnb |  | https://take.offbitch.com/wherenobiz/login.html | api GET /api/wnb/me: GET /api/wnb/me → 401 (чаках 200) / not_authenticated |
| 🔴 | journey | wnb |  | https://take.offbitch.com/wherenobiz/login.html | api POST /api/wnb/posts: POST /api/wnb/posts → 401 (чаках 201) / not_authenticated |
| 🔴 | journey | wnb |  | https://take.offbitch.com/wherenobiz/login.html | api POST (c) => `/api/wnb/moderation/posts/${c.postId}/approve`: POST /api/wnb/moderation/posts/undefined/approve → 500 (чаках 200) / server |
| 🔴 | journey | wnb |  | https://take.offbitch.com/wherenobiz/login.html | label качване на НЕ-изображение → грациозно (никога 500): качване на не-изображение: HTTP 500 (сървърна грешка — никога 5xx) |

<details><summary>ℹ️ 1 очаквани 401/403 (анонимни проверки — не са бъг)</summary>

- 401 `https://take.offbitch.com/api/wnb/me`

</details>

## Работни сценарии (като човек)

### WhereNoBiz (потребител + админ модерация) — 6/10 минали
- 🔴 **Потребител: регистрация (API) + вход (UI)**
    - 🔴 GET /api/wnb/me → 401 (чаках 200) / not_authenticated api GET /api/wnb/me
- 🔴 **Потребител: създай пост (минава модерация)**
    - 🔴 POST /api/wnb/posts → 401 (чаках 201) / not_authenticated api POST /api/wnb/posts
    - ⏭️ (пропусната) label КАЧВАНЕ НА ИЗОБРАЖЕНИЕ: качи снимка към поста
- 🔴 **Админ: вход + одобри поста**
    - 🔴 POST /api/wnb/moderation/posts/undefined/approve → 500 (чаках 200) / server_error api POST (c) => `/api/wnb/moderation/posts/${c.postId}/approve`
    - ⏭️ (пропусната) label провери, че е approved
- ✅ **Админ: създай втори пост (друг потребител) и го откажи**
- 🔴 **НЕВАЛИДЕН ВХОД: пост с грешни данни → 400 (никога 500)**
    - 🔴 качване на не-изображение: HTTP 500 (сървърна грешка — никога 5xx) label качване на НЕ-изображение → грациозно (никога 500)
    - ⏭️ (пропусната) api POST /api/wnb/logout
    - ⏭️ (пропусната) api POST /api/wnb/login
    - ⏭️ (пропусната) api POST (c) => `/api/wnb/moderation/posts/${c.badImgPostId}/remove`
- ✅ **АТАКУВАЩ („лош потребител"): модерация без права → 401/403 (никога 500/изтичане)**
- ✅ **АТАКУВАЩ: чужд пост / телефон / фалшива сесия → 403/404/401**
- ✅ **АТАКУВАЩ: инжекции + огромен текст в тялото на поста → 400/обработено (никога 500)**
- ✅ **АВТОРИЗАЦИЯ: обикновен потребител е ОТКАЗАН за админ-само действие → 403**
- ✅ **Почистване (свали тестовите постове)**

## Сървърен лог (корелация)

Подозрителни редове от `/last-errors-bundle` (след пускането):
```
    2026/06/11 11:21:33 [error] 1486842#1486842: *1043 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:33 [error] 1486842#1486842: *1047 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1050 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1051 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1052 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:35 [error] 1486842#1486842: *1054 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/message.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/message.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/qr_modal.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/qr_modal.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/auth.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/auth.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/admin/user-overview/1 HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/user-overview/1", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/admin/user-details/1 HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/user-details/1", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/ip-admin HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/ip-admin", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/me HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/me", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/me HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/me", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/ip-admin HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/ip-admin", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 11:21:33 [error] 1486842#1486842: *1043 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:33 [error] 1486842#1486842: *1047 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1050 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1051 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1052 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:35 [error] 1486842#1486842: *1054 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/message.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/message.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/qr_modal.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/qr_modal.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/auth.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/auth.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/admin/user-overview/1 HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/user-overview/1", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/admin/user-details/1 HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/user-details/1", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/ip-admin HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/ip-admin", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/me HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/me", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/me HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/me", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/ip-admin HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/ip-admin", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 11:21:33 [error] 1486842#1486842: *1043 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:33 [error] 1486842#1486842: *1047 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1050 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1051 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:34 [error] 1486842#1486842: *1052 open() "/var/www/html/shared/js/kg-compliance.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/kg-compliance.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 11:21:35 [error] 1486842#1486842: *1054 open() "/var/www/html/shared/js/i18n.js.map" failed (2: No such file or directory), client: 93.123.109.178, server: my.girl.place, request: "GET /shared/js/i18n.js.map HTTP/1.1", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/message.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/message.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/qr_modal.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/qr_modal.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 13:21:21 [error] 1486842#1486842: *1258 open() "/var/www/html/assets/js/auth.js" failed (2: No such file or directory), client: 155.2.228.196, server: my.girl.place, request: "GET /assets/js/auth.js HTTP/2.0", host: "my.girl.place"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/admin/user-overview/1 HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/user-overview/1", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/admin/user-details/1 HTTP/2.0", upstream: "http://127.0.0.1:3000/api/admin/user-details/1", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/ip-admin HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/ip-admin", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/me HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/me", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/me HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/me", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
    2026/06/11 18:51:37 [error] 1536226#1536226: *3401 connect() failed (111: Connection refused) while connecting to upstream, client: 95.87.73.240, server: kaji.kak.si, request: "GET /api/portals/ip-admin HTTP/2.0", upstream: "http://127.0.0.1:3000/api/portals/ip-admin", host: "kaji.kak.si", referrer: "https://kaji.kak.si/chat/admin/admin-user-details.html?userId=1"
```
