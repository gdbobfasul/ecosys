# Известия по имейл за обратна връзка (портал)

_Съставено: 2026-07-22. Описва как порталът праща имейл известие при нов доклад/обратна връзка._

**Статус (2026-07-22): РАБОТИ, тествано на живо.** Провайдър: **Brevo HTTP API**. Домейнът `pupikes.com` е удостоверен в Brevo (SPF/DKIM), подател `no-reply@pupikes.com`, получател `miroljubkalaydjiev177@gmail.com` — тестово писмо е **доставено** (Brevo event `delivered`). Ключът и настройките са в ЛОКАЛНАТА `configs/.env`. ⚠️ ОСТАВА за прод: същите редове (ключ + BUG_ALERT_*) да са и в `configs/.env` НА СЪРВЪРА (файлът е git-ignored, не пътува с деплоя) + деплой на портала + рестарт.

## Какво прави

Бутонът „💬 Обратна връзка" е във всичките 32 приложения. При изпращане докладът се записва в базата на портала (таблица `portal_bug_reports`) и **веднага** тръгва имейл известие към отговорника. Известието е за:
- **анонимни доклади** от мобилните приложения (бутонът, без вход);
- **първи доклад** от портален потребител (редакциите НЕ известяват, за да не спамят).

Получателят по подразбиране: `miroljubkalaydjiev177@gmail.com` (конфигурируем).

Виждат се и в страницата **„🐞 Докладвани грешки"** → `pupikes.com/portals/admin-bugs.html` (от Админ панела). Имейлът е само известие „има нов доклад"; пълният списък е там.

## Защо не по SMTP порт 25 (DigitalOcean)

DigitalOcean блокира изходящия **порт 25** на droplet-ите (анти-спам). Портове **587/465 с външен доставчик работят**. Затова има два поддържани начина, и двата безплатни:

| Начин | Порт | Инсталиране | Безплатен лимит |
|---|---|---|---|
| **HTTP API** (Brevo/Resend) | 443 | нищо (вграден Node `https`) | Brevo 300/ден · Resend 100/ден, 3000/мес |
| **SMTP** (SendGrid/Mailgun/Brevo…) | 587/465 | `npm i nodemailer` | по доставчик |

## Как е устроено (код)

- **Помощник:** `private/portals/services/mailer.js` — `notifyNewBugReport({app,title,body,source})` (fire-and-forget) и `sendMail(subject,text)`. Избира доставчик по конфигурацията, приоритет: **SMTP → Brevo → Resend**. При липса на конфигурация/получател — тихо не праща (никога не хвърля, записът на доклада остава непокътнат).
- **Закачка:** `private/portals/routes/bug_reports.js` — вика известието след записа в анонимния endpoint (`POST /api/portals/bug-report/anon`) и при първи доклад от портален потребител (`POST /api/portals/bug-report`).
- **Конфигурация:** `private/configs/.env` (зарежда се от `server.js`).

Всичко пътува с обикновения деплой на портала; след деплой се рестартира порталната услуга.

## Настройки (`configs/.env`)

```
BUG_ALERT_TO=miroljubkalaydjiev177@gmail.com   # получател на известията
BUG_ALERT_FROM=no-reply@pupikes.com            # подател (верифициран при доставчика)
BUG_ALERT_FROM_NAME=Pupikes

# Начин А — HTTP API (нищо за инсталиране). Сложи ЕДИН ключ:
BREVO_API_KEY=            # https://app.brevo.com → SMTP & API → API Keys
RESEND_API_KEY=          # https://resend.com → API Keys (иска верифициран домейн pupikes.com)

# Начин Б — SMTP на 587/465 (иска: npm i nodemailer):
SMTP_HOST=               # напр. smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=               # напр. за SendGrid: apikey
SMTP_PASS=               # API ключ / SMTP парола на доставчика
```

Приоритет при избор: ако е зададен `SMTP_HOST` → SMTP; иначе `BREVO_API_KEY` → Brevo; иначе `RESEND_API_KEY` → Resend; иначе нищо не се праща.

## Откъде се взимат ключовете

- **Brevo (препоръчано, най-малко работа):** регистрация на brevo.com → потвърди подател (Settings → Senders) → SMTP & API → API Keys → Generate. 300 писма/ден безплатно, без DNS.
- **Resend:** resend.com → верифицирай домейна pupikes.com (SPF/DKIM записи в DNS) → API Keys → Create. Най-добра доставяемост (от твой домейн, не пада в спам).
- **SendGrid (по SMTP):** sendgrid.com → верифицирай подател/домейн → Settings → API Keys → Create (права „Mail Send"). После `SMTP_USER=apikey`, `SMTP_PASS=<ключа>` + `npm i nodemailer`.

## Доставяемост

Ако подателят е непотвърден gmail адрес, писмата може да отиват в спам или да се отхвърлят. Затова: потвърди подателя (Brevo) или верифицирай `pupikes.com` (SPF/DKIM). Получателят (gmail) не иска нищо.
