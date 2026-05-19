# KCY Ecosystem — Deploy & Install Scripts

## ⭐ Бърз вход — интерактивно меню

```bash
./deploy-scripts/00-menu.sh
```

Това отваря интерактивно меню с **всички** операции — deploy, бази данни,
smart contracts, тестове, експорти, услуги. Препоръчвам да започнеш оттам.

---

Глобална номерация — `00-09` показва точния ред в lifecycle-а на сървъра.
Нула дубликати: всеки номер е уникален в цялата папка (Windows + server).

## Структура

```
deploy-scripts/
├── 00-menu.sh                       ← ⭐ Интерактивно меню (entry point)
├── 01-bootstrap.sh                  ← [Windows] Първоначална настройка
├── 04-deploy.sh                     ← [Windows] Всеки следващ deploy
├── .deploy-targets.example          ← Template за targets
│
├── server/
│   ├── 02-bootstrap-server.sh       ← [Сървър] Базов setup (от 01)
│   ├── 03-kcy-admin-sudo.sh         ← [Сървър] Sudoers (от 02)
│   ├── 05-server-install.sh         ← [Сървър] Активация (от 04)
│   ├── 06-setup-wizard.sh           ← [Сървър] .env wizard (рядко)
│   ├── 07-setup-database.sh         ← [Сървър] DB helper
│   ├── 08-setup-domain.sh           ← [Сървър] Domain/SSL helper
│   └── 09-server-prepare-DEPRECATED.sh   (не ползвай)
│
└── windows/
    ├── deploy.bat                   ← CMD wrapper (вика 04-deploy.sh)
    └── deploy.ps1                   ← PowerShell wrapper
```

## Глобален ред (lifecycle)

| # | Скрипт | Къде се пуска | Кой го пуска |
|---|---|---|---|
| **01** | `01-bootstrap.sh` | Windows | **Ти** (Git Bash) — само първи път |
| **02** | `02-bootstrap-server.sh` | Сървър | Автоматично от 01 |
| **03** | `03-kcy-admin-sudo.sh` | Сървър | Автоматично от 02 |
| **04** | `04-deploy.sh` | Windows | **Ти** — всеки deploy |
| **05** | `05-server-install.sh` | Сървър | Автоматично от 04 |
| **06** | `06-setup-wizard.sh` | Сървър | Ти ръчно (рядко — interactive .env) |
| **07** | `07-setup-database.sh` | Сървър | От 05 (или ръчно за DB reset) |
| **08** | `08-setup-domain.sh` | Сървър | От 05 (или ръчно за SSL config) |
| **09** | `09-server-prepare-DEPRECATED.sh` | — | Не ползвай (стар, заменен от 02) |

## Какво пускаш ТИ ръчно

Само **две** команди в цялата система:

```bash
# Първи път на нов сървър/VM:
./deploy-scripts/01-bootstrap.sh

# Всеки следващ deploy:
./deploy-scripts/04-deploy.sh vm     # или 'prod'
```

Всичко друго е автоматично (01 → 02 → 03 при bootstrap; 04 → 05 → 07 → 08 при deploy).

## Потребители които съществуват след `02-bootstrap-server.sh`

Точно тези, нищо повече:

| Потребител | Тип | Цел |
|---|---|---|
| **deploy** | regular | Качва файлове, run-ва install скриптове с limited sudo |
| **kcy-chat** | system (nologin) | systemd service user за chat |
| **kcy-eco3** | system (nologin) | systemd service user за eco-3 |
| **kcy** | group | Обединява deploy, kcy-chat, kcy-eco3, www-data |

## Workflow стъпка по стъпка

### Първи път на нов сървър/VM

1. Spin up Ubuntu 24.04 LTS
2. От Windows (Git Bash):
   ```bash
   ./deploy-scripts/01-bootstrap.sh 192.168.0.108 myuser 22
   ```
3. Първи deploy:
   ```bash
   ./deploy-scripts/04-deploy.sh vm
   ```
4. Браузър → `http://SERVER_IP/`

### Всеки следващ deploy

```bash
./deploy-scripts/04-deploy.sh vm     # за VM
./deploy-scripts/04-deploy.sh prod   # за production VPS
```
