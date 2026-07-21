# Робот — репорт (prod)

- Цел: `https://take.offbitch.com`
- Старт: 2026-07-21T17:49:29.991Z  ·  Времетраене: 79539 ms
- Сценарии: 7  ·  Прегледани адреси: 32
- **Грешки: 22  ·  Предупреждения: 0  ·  Инфо (очаквани 401/403): 0**

## Находки

| Тежест | Вид | Прил. | HTTP | Къде | Детайл |
|---|---|---|---|---|---|
| 🔴 | console |  |  | http://127.0.0.1:50350/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:50350' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:50350/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:63490/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:63490' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:63490/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:52254/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:52254' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:52254/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:56726/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:56726' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:56726/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:63674/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:63674' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:63674/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:56191/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:56191' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:56191/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:62491/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:62491' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:62491/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:54685/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:54685' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:54685/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:57574/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:57574' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:57574/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:51597/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:51597' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:51597/ | net::ERR_FAILED |
| 🔴 | console |  |  | http://127.0.0.1:64663/ | Access to fetch at 'https://selflearning.bot.nu/promo/kcy-promo.json' from origin 'http://127.0.0.1:64663' has been blocked by CORS policy:  |
| 🔴 | requestfailed |  |  | http://127.0.0.1:64663/ | net::ERR_FAILED |

## Работни сценарии (като човек)

### undefined — 1/1 минали
- ✅ **Всеки мобилен ап зарежда без крах и рендира**

## Сървърен лог (корелация)

Подозрителни редове от `/last-errors-bundle` (след пускането):
```
[2026-07-21T17:50:28]   nginx /portals/register.html: HTTP 502
[2026-07-21T17:50:28]   billing/status СЪС сесия (nginx HTTPS): <html> <head><title>502 Bad Gateway</title></head> <body> <center><h1>502 Bad Gateway</h1></center> <hr><center>nginx/1.24.0 (Ubuntu)</center> </body> </html>  [HTTP 502]
    2026/06/19 21:39:02 [error] 2029640#2029640: *20428 open() "/var/www/html/shared/.env.example" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.example HTTP/1.1", host: "143.198.212.195"
    2026/06/19 21:39:03 [error] 2029640#2029640: *20428 open() "/var/www/html/shared/.env.sample" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.sample HTTP/1.1", host: "143.198.212.195"
    2026/06/19 21:39:03 [error] 2029640#2029640: *20428 open() "/var/www/html/shared/.env.dist" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.dist HTTP/1.1", host: "143.198.212.195"
    2026/06/19 21:39:03 [error] 2029640#2029640: *20428 open() "/var/www/html/shared/.env.bak" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.bak HTTP/1.1", host: "143.198.212.195"
    2026/06/19 21:39:03 [error] 2029640#2029640: *20428 open() "/var/www/html/shared/.env.backup" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.backup HTTP/1.1", host: "143.198.212.195"
    2026/06/19 21:39:03 [error] 2029640#2029640: *20428 open() "/var/www/html/shared/.env.old" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.old HTTP/1.1", host: "143.198.212.195"
    2026/06/19 21:39:03 [error] 2029640#2029640: *20428 open() "/var/www/html/shared/.env.save" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.save HTTP/1.1", host: "143.198.212.195"
    2026/06/19 21:39:03 [error] 2029640#2029640: *20428 open() "/var/www/html/shared/.env.swp" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.swp HTTP/1.1", host: "143.198.212.195"
    2026/06/20 05:13:41 [error] 2044186#2044186: *21053 directory index of "/var/www/html/selflearning/1/" is forbidden, client: 95.87.73.224, server: selflearning.bot.nu, request: "GET /1/ HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/20 05:13:41 [error] 2044186#2044186: *21053 directory index of "/var/www/html/selflearning/1/" is forbidden, client: 95.87.73.224, server: selflearning.bot.nu, request: "GET /1/ HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/20 05:13:41 [error] 2044186#2044186: *21053 directory index of "/var/www/html/selflearning/1/" is forbidden, client: 95.87.73.224, server: selflearning.bot.nu, request: "GET /1/ HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/20 05:13:41 [error] 2044186#2044186: *21053 directory index of "/var/www/html/selflearning/1/" is forbidden, client: 95.87.73.224, server: selflearning.bot.nu, request: "GET /1/ HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/20 18:56:07 [error] 2053417#2053417: *21983 open() "/var/www/html/assets/js/auth.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/auth.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/20 18:56:08 [error] 2053417#2053417: *21983 open() "/var/www/html/assets/js/message.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/message.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/20 18:56:08 [error] 2053417#2053417: *21983 open() "/var/www/html/assets/js/qr_modal.js" failed (2: No such file or directory), client: 155.2.228.196, server: selflearning.bot.nu, request: "GET /assets/js/qr_modal.js HTTP/2.0", host: "selflearning.bot.nu"
    2026/06/21 03:32:55 [error] 2074919#2074919: *23050 "/var/www/html/.well-known/acme-challenge/index.html" is not found (2: No such file or directory), client: 45.148.10.67, server: look.myhousesetup.com, request: "GET /.well-known/acme-challenge/ HTTP/2.0", host: "look.myhousesetup.com"
    2026/06/21 03:32:55 [error] 2074919#2074919: *23050 open() "/var/www/html/.well-known/acme-challenge/*" failed (2: No such file or directory), client: 45.148.10.67, server: look.myhousesetup.com, request: "GET /.well-known/acme-challenge/* HTTP/2.0", host: "look.myhousesetup.com"
    2026/06/21 03:33:02 [error] 2074919#2074919: *23050 open() "/var/www/html/shared/.env" failed (2: No such file or directory), client: 45.148.10.67, server: look.myhousesetup.com, request: "GET /shared/.env HTTP/2.0", host: "look.myhousesetup.com"
    2026/06/21 03:33:08 [error] 2074919#2074919: *23069 "/var/www/html/.well-known/acme-challenge/index.html" is not found (2: No such file or directory), client: 45.148.10.67, server: look.myhousesetup.com, request: "GET /.well-known/acme-challenge/ HTTP/1.1", host: "look.myhousesetup.com"
    2026/06/21 03:33:08 [error] 2074919#2074919: *23079 open() "/var/www/html/.well-known/acme-challenge/*" failed (2: No such file or directory), client: 45.148.10.67, server: look.myhousesetup.com, request: "GET /.well-known/acme-challenge/* HTTP/1.1", host: "look.myhousesetup.com"
    2026/06/21 05:39:03 [error] 2074919#2074919: *23242 "/var/www/html/.well-known/acme-challenge/index.html" is not found (2: No such file or directory), client: 45.148.10.67, server: take.offbitch.com, request: "GET /.well-known/acme-challenge/ HTTP/1.1", host: "take.offbitch.com"
    2026/06/21 05:39:03 [error] 2074919#2074919: *23253 open() "/var/www/html/.well-known/acme-challenge/*" failed (2: No such file or directory), client: 45.148.10.67, server: take.offbitch.com, request: "GET /.well-known/acme-challenge/* HTTP/1.1", host: "take.offbitch.com"
    2026/06/21 08:25:02 [error] 2074919#2074919: *23387 open() "/var/www/html/assets/credentials.json" failed (2: No such file or directory), client: 152.42.217.112, server: look.myhousesetup.com, request: "GET /assets/credentials.json HTTP/2.0", host: "143.198.212.195"
    2026/06/21 16:54:07 [error] 2074919#2074919: *23930 open() "/var/www/html/.well-known/acme-challenge/9vJhTGbhieD0gtLGxO3BE7auE1GO779eawvejJ-a0uA" failed (2: No such file or directory), client: 23.178.112.106, server: take.offbitch.com, request: "GET /.well-known/acme-challenge/9vJhTGbhieD0gtLGxO3BE7auE1GO779eawvejJ-a0uA HTTP/1.1", host: "take.offbitch.com"
    2026/06/21 19:23:03 [error] 2074919#2074919: *23993 open() "/var/www/html/.well-known/acme-challenge/llBQ6W5F8iD2ysdPzLZWP6cKoPIWTYTbLyuFzaVjGcs" failed (2: No such file or directory), client: 23.178.112.104, server: take.offbitch.com, request: "GET /.well-known/acme-challenge/llBQ6W5F8iD2ysdPzLZWP6cKoPIWTYTbLyuFzaVjGcs HTTP/1.1", host: "take.offbitch.com"
    2026/06/21 20:10:41 [error] 2074919#2074919: *24009 open() "/var/www/html/.well-known/acme-challenge/qIbEijEjr1j0YZDQ7T7-wVcE2UAIfKYnJDAa3e0_nC0" failed (2: No such file or directory), client: 23.178.112.107, server: take.offbitch.com, request: "GET /.well-known/acme-challenge/qIbEijEjr1j0YZDQ7T7-wVcE2UAIfKYnJDAa3e0_nC0 HTTP/1.1", host: "take.offbitch.com"
    2026/06/23 08:42:37 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.local" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.local HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:37 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.production" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.production HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:38 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.prod" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.prod HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:38 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.development" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.development HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:38 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.dev" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.dev HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:38 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.staging" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.staging HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:38 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.stage" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.stage HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:38 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.test" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.test HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:38 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.uat" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.uat HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:39 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.qa" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.qa HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:39 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.preprod" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.preprod HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:39 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.live" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.live HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:39 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.example" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.example HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:39 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.sample" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.sample HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:39 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.dist" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.dist HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:39 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.bak" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.bak HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:40 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.backup" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.backup HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:40 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.old" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.old HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:40 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.save" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.save HTTP/1.1", host: "143.198.212.195"
    2026/06/23 08:42:40 [error] 2125044#2125044: *29222 open() "/var/www/html/shared/.env.swp" failed (2: No such file or directory), client: 179.43.168.58, server: look.myhousesetup.com, request: "GET /shared/.env.swp HTTP/1.1", host: "143.198.212.195"
    2026/06/25 01:28:16 [error] 2241018#2241018: *1855 open() "/var/www/html/shared/.env" failed (2: No such file or directory), client: 80.94.95.211, server: look.myhousesetup.com, request: "GET /shared/.env HTTP/1.1", host: "143.198.212.195:443"
    2026/06/25 03:03:17 [error] 2241018#2241018: *1902 open() "/var/www/html/shared/.env" failed (2: No such file or directory), client: 34.175.168.164, server: look.myhousesetup.com, request: "GET /shared/.env HTTP/1.1", host: "143.198.212.195"
    2026/06/25 03:03:37 [error] 2241018#2241018: *1902 open() "/var/www/html/assets/.env" failed (2: No such file or directory), client: 34.175.168.164, server: look.myhousesetup.com, request: "GET /assets/.env HTTP/1.1", host: "143.198.212.195"
    2026/06/25 06:27:53 [error] 2241018#2241018: *1982 open() "/var/www/html/shared/.env" failed (2: No such file or directory), client: 185.200.116.211, server: look.myhousesetup.com, request: "GET /shared/.env HTTP/1.1", host: "143.198.212.195"
    2026/06/25 12:31:34 [error] 2241018#2241018: *2604 open() "/var/www/html/shared/.env" failed (2: No such file or directory), client: 185.200.116.211, server: look.myhousesetup.com, request: "GET /shared/.env HTTP/1.1", host: "143.198.212.195"
    2026/06/25 14:30:58 [error] 2241018#2241018: *3026 open() "/var/www/html/assets/.git/config" failed (2: No such file or directory), client: 34.80.85.78, server: look.myhousesetup.com, request: "GET /assets/.git/config HTTP/1.1", host: "143.198.212.195"
    2026/07/07 11:57:29 [error] 2353664#2353664: *38925 "/var/www/html/.well-known/acme-challenge/index.html" is not found (2: No such file or directory), client: 45.148.10.67, server: my.girl.place, request: "GET /.well-known/acme-challenge/ HTTP/2.0", host: "my.girl.place"
    2026/07/07 11:57:29 [error] 2353664#2353664: *38925 open() "/var/www/html/.well-known/acme-challenge/*" failed (2: No such file or directory), client: 45.148.10.67, server: my.girl.place, request: "GET /.well-known/acme-challenge/* HTTP/2.0", host: "my.girl.place"
    2026/07/07 11:57:35 [error] 2353664#2353664: *38925 open() "/var/www/html/chat/*" failed (2: No such file or directory), client: 45.148.10.67, server: my.girl.place, request: "GET /chat/* HTTP/2.0", host: "my.girl.place"
    2026/07/07 11:57:41 [error] 2353664#2353664: *38925 open() "/var/www/html/shared/.env" failed (2: No such file or directory), client: 45.148.10.67, server: my.girl.place, request: "GET /shared/.env HTTP/2.0", host: "my.girl.place"
    2026/07/07 11:57:48 [error] 2353664#2353664: *38974 "/var/www/html/.well-known/acme-challenge/index.html" is not found (2: No such file or directory), client: 45.148.10.67, server: my.girl.place, request: "GET /.well-known/acme-challenge/ HTTP/1.1", host: "my.girl.place"
    2026/07/07 11:57:48 [error] 2353664#2353664: *38986 open() "/var/www/html/.well-known/acme-challenge/*" failed (2: No such file or directory), client: 45.148.10.67, server: my.girl.place, request: "GET /.well-known/acme-challenge/* HTTP/1.1", host: "my.girl.place"
```
