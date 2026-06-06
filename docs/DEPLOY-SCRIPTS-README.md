# KCY Ecosystem - Deployment Guide

**Version:** 1.0085

---

## Архитектура на потребителите

| Потребител | Роля | Достъп |
|-----------|------|--------|
| **`deploy`** | Качва файлове от Windows | SSH ключ, пише само в `/var/www/deploy/` |
| **`kcy`** | Системен — притежава всичко, пуска Node.js | Без SSH, без парола, без login shell |
| **`root`** | nginx, systemd, certbot, ufw | Само за `sudo` командите |

---

## Стъпки (верижка 1 → 2 → 3 → 4)

### Еднократна подготовка (на сървъра като root):

```bash
ssh root@${MAIN_DOMAIN}
mkdir -p /var/www/deploy
chown deploy:deploy /var/www/deploy
```

### Стъпка 1: `04-deploy.sh` — качване (от Windows/Mac)

```bash
./04-deploy.sh
```

Изтрива staging, качва наново. Завършва с:
> **СЛЕДВАЩА СТЪПКА:** `sudo bash 05-server-install.sh`

### Стъпка 2: `05-server-install.sh` — инсталация (на сървъра)

```bash
ssh deploy@${MAIN_DOMAIN}
cd /var/www/deploy/deploy-scripts/server
sudo bash 05-server-install.sh
```

Копира файлове, настройва nginx, пуска services. Завършва с:
> **СЛЕДВАЩА СТЪПКА:** `sudo bash 07-setup-database.sh`

### Стъпка 3: `07-setup-database.sh` — база данни (на сървъра)

```bash
sudo bash 07-setup-database.sh
```

Опции:
- без аргументи — автоматичен избор (PostgreSQL ако е наличен, иначе SQLite)
- `--force-sqlite` — принудително SQLite
- `--force-postgresql` — принудително PostgreSQL
- `--reset ?` — help за reset

Завършва с:
> **СЛЕДВАЩА СТЪПКА:** `sudo kcy-restart`

### Стъпка 4: `kcy-restart` — рестарт

```bash
sudo kcy-restart
kcy-status
```

Ако Chat показва `active` — готово!

---

## Файлова структура на сървъра

```
/var/www/deploy/                        ← staging (deploy качва тук)

/var/www/html/                          ← public/ (nginx сервира)
    ├── index.html
    ├── token/
    ├── multisig/
    ├── chat/
    ├── eco-3/
    └── shared/
        ├── js/config.js
        ├── js/navigation.js
        └── css/common.css

/var/www/kcy-ecosystem/                 ← главна проектна директория (1:1)
    ├── package.json
    ├── package-lock.json
    ├── hardhat.config.js
    ├── jest.config.js
    ├── 00033.version
    ├── deploy-scripts/
    ├── docs/
    ├── tests/
    └── private/
        ├── configs/.env                ← ГЛОБАЛЕН .env (един за всички)
        ├── chat/                       ← Chat backend (port 3000)
        │   └── configs/.env            ← symlink → ../../configs/.env
        ├── eco-3/                      ← ECO-3 backend (port 3001)
        │   └── configs/.env            ← symlink → ../../configs/.env
        ├── token/
        ├── multisig/
        └── mobile-chat/
```

---

## Nginx routing

```
https://${MAIN_DOMAIN}
├── /              → /var/www/html/index.html
├── /token/        → /var/www/html/token/
├── /multisig/     → /var/www/html/multisig/
├── /chat/         → /var/www/html/chat/
├── /eco-3/        → /var/www/html/eco-3/
├── /shared/       → /var/www/html/shared/
├── /api/chat/     → localhost:3000 (Node.js)
└── /api/eco3/     → localhost:3001 (Node.js)
```

---

## Глобален .env файл

Един файл за цялата екосистема: `/var/www/kcy-ecosystem/private/configs/.env`
Chat и ECO-3 го четат чрез symlinks от `chat/configs/.env` и `eco-3/configs/.env`.

В проекта (преди deploy): `/private/configs/.env`

Пълен списък на настройките:

```env
# ── Server ──
NODE_ENV=production
PORT=3000                          # Chat порт
ECO3_PORT=3001                     # ECO-3 порт
ALLOWED_ORIGINS=http://localhost,https://${MAIN_DOMAIN}
ADMIN_ALLOWED_IPS=127.0.0.1,::1

# ── Database (Chat) ──
DB_TYPE=sqlite                     # sqlite или postgresql
PG_HOST=localhost                  # само за postgresql
PG_PORT=5432                       # само за postgresql
PG_DATABASE=ams_chat_db            # само за postgresql
PG_USER=ams_chat_user              # само за postgresql
PG_PASSWORD=                       # само за postgresql (генерира се от 07-setup-database.sh)

# ── Stripe (споделен) ──
STRIPE_SECRET_KEY=sk_test_...      # https://dashboard.stripe.com/apikeys
STRIPE_PUBLISHABLE_KEY=pk_test_...

# ── Anthropic API (ECO-3) ──
ANTHROPIC_API_KEY=sk-ant-...       # https://console.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# ── Security ──
JWT_SECRET=                        # генерира се от 07-setup-database.sh
SESSION_SECRET=                    # генерира се от 07-setup-database.sh
```

`07-setup-database.sh` **добавя** DB настройките без да трие останалото.

---

## SSH ключ за deploy потребителя

### Проверка дали имаш ключ локално:

```bash
ls ~/.ssh/id_*.pub
```

Ако покаже `id_rsa.pub` или `id_ed25519.pub` — имаш ключ.

### Проверка дали ключът работи за deploy:

```bash
ssh -o PasswordAuthentication=no deploy@${MAIN_DOMAIN} "echo OK"
```

- `OK` — ключът е настроен, всичко е наред.
- `Permission denied` — ключът не е копиран за `deploy`.

### Проверка на сървъра:

```bash
cat /home/deploy/.ssh/authorized_keys
```

Ако файлът е празен или го няма — няма ключ за `deploy`.

### Копиране на ключа (еднократно):

```bash
# От PowerShell: type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh deploy@${MAIN_DOMAIN} "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Ще пита за паролата на `deploy` **последен път**, после вече ще влиза с ключ.

### SSH fingerprint warning

При първо свързване към hostname (дори ако IP-то е познато):

```
The authenticity of host '${MAIN_DOMAIN} (143.198.212.195)' can't be established.
```

Провери: `nslookup ${MAIN_DOMAIN}` → трябва да покаже `143.198.212.195`.
Ако IP-то съвпада с `~/.ssh/known_hosts` → пиши `yes`.

За да не пита повече:

```bash
ssh-keyscan -H ${MAIN_DOMAIN} >> ~/.ssh/known_hosts
```

---

## SSH multiplexing

Deploy скриптът използва SSH multiplexing — отваря ЕДНА връзка и я преизползва. Парола/ключ се пита ВЕДНЪЖ. Връзката се затваря автоматично.

---

## Поведение на 04-deploy.sh

- Преди качване **изтрива всичко** в `/var/www/deploy/` (чист staging)
- Качва `public/`, `private/`, `deploy-scripts/`, config файлове
- **НЕ пипа** `/var/www/html/` и `/var/www/kcy-ecosystem/` — само staging

## Поведение на 05-server-install.sh

- Ако **няма файлове** в целевите директории → инсталира директно без въпроси
- Ако **има файлове** → пита:
  - Изтрий всичко и инсталирай наново
  - Остави и презаписвай (merge)
- Проверява за `.env` файлове:
  - Ако има в staging `/var/www/deploy/` → използва ги
  - Ако няма → пита откъде да ги вземе (подаваш директория)
  - Ако вече има на сървъра → не ги пипа

---

## Полезни команди на сървъра

```bash
kcy-status                     # Статус на всичко
kcy-restart                    # Рестарт на всичко
journalctl -u kcy-chat -f      # Chat логове
journalctl -u kcy-eco3 -f      # ECO-3 логове
nano /var/www/kcy-ecosystem/private/configs/.env   # Edit global config
```

---

## Скриптове

| Файл | Къде | Какво |
|------|------|-------|
| `04-deploy.sh` | Твоята машина | Качва в staging |
| `deploy-scripts/windows/deploy.ps1` | Windows PowerShell | Същото |
| `deploy-scripts/windows/deploy.bat` | Windows CMD | Wrapper |
| `deploy-scripts/server/09-server-prepare-DEPRECATED.sh` | Сървър (sudo, еднократно) | Подготвя потребители и директории |
| `deploy-scripts/server/05-server-install.sh` | Сървър (sudo) | Копира, настройва, стартира |
| `deploy-scripts/server/07-setup-database.sh` | Сървър (sudo) | PostgreSQL / SQLite |
| `deploy-scripts/server/08-setup-domain.sh` | Сървър (sudo) | Nginx + SSL + systemd |
