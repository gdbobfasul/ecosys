# KCY Ecosystem — Debug & Diagnostics

## Накратко

Централизирана система за лог файлове в `/var/www/html/last-errors/`, които се пълнят от **два независими източника**:

1. **Скриптове и сървиси по време на изпълнение** — пишат stage логове докато работят (bootstrap, install, services start, errors). Може да се **изключи** глобално от admin-status страницата.
2. **Page reload (admin-status.html)** — append-ва snapshot на моментно състояние (RAM/swap, services status, disk, nginx tail, journalctl tails). **Винаги активно** при отваряне на страницата, не може да се изключи.

Едни и същи лог файлове, два писателя. Logs са rolling — max 200 реда на файл, по-стари записи се отрязват при append.

---

## URL-и

| URL | Достъп | Описание |
|---|---|---|
| `/shared/admin-status.html` | IP whitelist | UI страница с widgets, view/download buttons, debug toggles |
| `/last-errors/<file>.log` | IP whitelist | Директен достъп до конкретен лог |
| `/last-errors-bundle` | **Public по default** | Всички логове concatenated в plain text — за `web_fetch`/curl |
| `/api/diag/regen` | IP whitelist | POST — регенерира status snapshot |
| `/api/diag/debug-flags` | IP whitelist | GET/POST — управление на DEBUG toggle |

---

## Списък на logfile-овете

В `/var/www/html/last-errors/`:

| Файл | Какво съдържа |
|---|---|
| `memory-errors.log` | RAM/swap snapshots, OOM warnings |
| `services-errors.log` | Статуси на nginx/kcy-*/postgresql, install/bootstrap/wizard stage логове, disk usage |
| `web-errors.log` | Последни 20 реда от nginx `error.log` при snapshot |
| `chat-errors.log` | kcy-chat stage логове (от debug-helper) + последни 20 реда journalctl |
| `eco3-errors.log` | kcy-eco3 stage логове + journalctl |
| `portal-errors.log` | kcy-portals stage логове + journalctl |
| `token-errors.log` | KCY token deploy логове (placeholder) |
| `berich1-errors.log` | BRCH1 deploy логове (placeholder) |
| `multisig-errors.log` | Multi-sig deploy логове (placeholder) |
| `status.json` | Machine-readable snapshot (за UI cards) |

Всеки лог се trim-ва до 200 реда max.

---

## DEBUG flags (toggle от admin-status)

Файл: `/var/lib/kcy/debug-flags.json`

```json
{
  "chat":    true,
  "eco3":    true,
  "portals": true,
  "scripts": true
}
```

### Какво прави всеки flag

| Flag | Контролира |
|---|---|
| `chat` | `debug.stage()` извикванията в `private/chat/server.js` |
| `eco3` | `debug.stage()` в `private/eco-3/server.js` |
| `portals` | `debug.stage()` в `private/portals/server.js` |
| `scripts` | `diag_log` извикванията в bash скриптовете (bootstrap, install, wizard) |

**При изключване (`false`):**
- Per-service flag → услугата спира да пише stage логове. journalctl-tail-ове **продължават** да се събират при page reload.
- `scripts` flag → bash скриптовете спират да append-ват по време на изпълнение. Snapshot-ите при page reload **продължават**.

**Важно:** Snapshot-ите при page reload (memory, services status, disk, nginx tail) **винаги се пишат**, независимо от флаговете. Тоест дори да изключиш всичко, page-reload-ът пак ще има полезна информация за моментното състояние.

### Toggle от UI

`https://${MAIN_DOMAIN}/?adm=bgmasters-set` → "Отвори System Status" → секция "🐛 DEBUG режим"

Per-service flags (chat/eco3/portals): услугата чете флага при всяко log call → instant effect.

`scripts` flag: bash diag_log проверява файла при всяко извикване → instant effect.

### Manual toggle (без UI)

```bash
ssh deploy@${MAIN_DOMAIN} -p 2222
sudo nano /var/lib/kcy/debug-flags.json
# Промени стойностите → save
```

---

## Bundle URL — публично достъпен

```
https://${MAIN_DOMAIN}/last-errors-bundle
```

По default е **активиран** (за тест период). Връща `text/plain` с всички .log концатенирани в един отговор.

Подходящо за:
- `curl -o bundle.txt https://${MAIN_DOMAIN}/last-errors-bundle`
- `web_fetch` от Claude

### Изключване на bundle URL (production)

Когато сървърът работи стабилно:

1. SSH до сървъра:
   ```bash
   ssh deploy@${MAIN_DOMAIN} -p 2222
   ```
2. Промени `.env`:
   ```bash
   nano /var/www/kcy-ecosystem/private/configs/.env
   # Промени: PUBLIC_DIAG_BUNDLE=false
   ```
3. Re-deploy за да се обнови nginx config:
   ```bash
   # От Windows:
   ./start → 2 → prod
   ```

След изключване — bundle URL става IP-restricted като останалите endpoints.

---

## Бутстрап лог phases (специален случай)

Bootstrap-ът се изпълнява **преди** `/var/www/html/last-errors/` да съществува. Затова логовете минават през три phase-а:

```
Phase 1: bootstrap пише в /root/.kcy-logs/
            ↓ (в края на 02-bootstrap-server.sh)
Phase 2: copy към /var/www/deploy/.kcy-logs/
            ↓ (в началото на 05-server-install.sh при следващ deploy)
Phase 3: append към /var/www/html/last-errors/ (final destination)
```

`/root/.kcy-logs/` остава като raw backup (не се изтрива). Полезно ако нещо се провали по време на bootstrap и не може да стигнеш до final logs.

---

## Покритие — кои скриптове/сървиси пишат stage логове

### ✅ Покрити със stage логване

| # | Компонент | Метод | Стартира на |
|---|---|---|---|
| 1 | `02-bootstrap-server.sh` | `diag_log` (phase 1 → /root/.kcy-logs/) | Сървъра при bootstrap |
| 2 | `05-server-install.sh` | `diag_log` (всеки `print_step`) | Сървъра при deploy |
| 3 | `06-setup-wizard.sh` | `diag_log` | Сървъра при setup |
| 4 | `10-disable-ssh-password.sh` | `diag_log` | Сървъра при ръчно извикване |
| 5 | `private/chat/server.js` | `debug.stage()` от debug-helper | Сървъра |
| 6 | `private/eco-3/server.js` | `debug.stage()` | Сървъра |
| 7 | `private/portals/server.js` | `debug.stage()` | Сървъра |
| 8 | `private/eco-3/database/init.js` | `debug.stage()` | Сървъра при install |
| 9 | `private/portals/database/init.js` | `debug.stage()` | Сървъра при install |
| 10 | `kcy-diagnostics.sh` (snapshot) | Append `[SNAPSHOT]` записи | Сървъра при page reload |
| 11 | `private/diag/server.js` | Helper service (port 4400) | Сървъра като systemd |

### ❌ Не покрити (могат да се добавят при нужда)

| Компонент | Защо не |
|---|---|
| `01-bootstrap.sh` | Runs на **Windows**, не на сървъра |
| `04-deploy.sh` | Същото — runs on Windows |
| `07-setup-database.sh` | Standalone, рядко самостоятелно |
| `08-setup-domain.sh` | Standalone, рядко |
| `11-setup-tailscale.sh` | Standalone, кратко |
| `12-setup-failover.sh` | Standalone, кратко |
| `13-kcy-admin-sudo-toggle.sh` | Опасна, double-confirm |
| Smart contract deploys | Runs на **Windows** чрез Hardhat |

---

## Архитектурна диаграма

```
┌──────────────────────────────────────────────────────────┐
│                  Browser (admin)                         │
│         /shared/admin-status.html                        │
└─────────────────┬────────────────────────────────────────┘
                  │ POST /api/diag/regen
                  ↓
┌──────────────────────────────────────────────────────────┐
│  kcy-diag.service (port 4400, Node, zero-deps)           │
│   • POST /regen           → exec kcy-diagnostics.sh      │
│   • GET  /bundle          → concat all *.log → text      │
│   • GET/POST /debug-flags → /var/lib/kcy/debug-flags.json│
└─────────────────┬────────────────────────────────────────┘
                  │ writes (snapshot)
                  ↓
┌──────────────────────────────────────────────────────────┐
│   /var/www/html/last-errors/                             │
│                                                          │
│   ↑ ALSO written during execution by:                    │
│     • bash scripts → diag_log (install/bootstrap/wizard) │
│     • Node services → debug-helper (chat/eco3/portals)   │
│     • DB init scripts → debug-helper                     │
└─────────────────┬────────────────────────────────────────┘
                  │ served by nginx
                  ↓
   /last-errors/*.log        (IP restricted)
   /last-errors-bundle       (public ако PUBLIC_DIAG_BUNDLE=true)
   /api/diag/*               (IP restricted, proxy към :4400)
```

---

## Workflow за дебъг с Claude

1. Open `https://${MAIN_DOMAIN}/?adm=bgmasters-set` → "Отвори System Status"
2. На admin-status страницата → секция "📋 Last Errors" → виж widgets
3. При нужда натисни ⟳ Regenerate
4. Дай на Claude bundle URL:
   ```
   https://${MAIN_DOMAIN}/last-errors-bundle
   ```
5. Claude прави `web_fetch` → получава всички логове наведнъж
6. Claude анализира → казва какво е счупено

### За production (когато всичко работи)

1. Изключи `PUBLIC_DIAG_BUNDLE=false` в `.env`
2. Re-deploy
3. От тогава външен достъп до bundle URL → 403 Forbidden

---

## Команди за debug

```bash
# Виж текущите debug flags
cat /var/lib/kcy/debug-flags.json

# Изключи всички stage логове (не snapshot-ите)
sudo bash -c 'echo "{\"chat\":false,\"eco3\":false,\"portals\":false,\"scripts\":false}" > /var/lib/kcy/debug-flags.json'

# Включи отново
sudo bash -c 'echo "{\"chat\":true,\"eco3\":true,\"portals\":true,\"scripts\":true}" > /var/lib/kcy/debug-flags.json'

# Ръчно изпълни diagnostics snapshot
sudo /usr/local/bin/kcy-diagnostics.sh

# Виж конкретен лог
cat /var/www/html/last-errors/chat-errors.log
tail -20 /var/www/html/last-errors/services-errors.log

# Изчисти всички логове (status.json се регенерира)
sudo rm /var/www/html/last-errors/*.log

# Restart на diag helper service
sudo systemctl restart kcy-diag

# Виж дали kcy-diag работи
sudo systemctl status kcy-diag
curl http://127.0.0.1:4400/health
```
