# Премахване на блокировка от fail2ban (production сървър)

Кратко ръководство: как да се отблокираш, ако fail2ban е банвал твоето IP на
продукционния сървър, и как да го предотвратиш за в бъдеще.

---

## Какво е настроено (контекст)

Файл на сървъра: **`/etc/fail2ban/jail.d/kcy.local`** (създава се от
`deploy-scripts/server/02-bootstrap-server.sh`):

```ini
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1 100.64.0.0/10
bantime  = 10m
findtime = 10m
maxretry = 10

[sshd]
enabled = true
maxretry = 10
```

- **`bantime = 10m`** → всеки бан изтича сам **след 10 минути**. Понякога най-простото
  решение е просто да изчакаш 10 минути.
- **`ignoreip` включва `100.64.0.0/10`** → целият Tailscale (CGNAT) диапазон **никога**
  не се банва. Затова връзката по **prodts** (Tailscale IP `100.113.162.29`) минава
  винаги, дори когато публичното ти IP е банато.
- SSH достъп: порт **2222**, потребител **deploy** (за публичния домейн).

---

## Стъпка 1 (най-лесно): влез през Tailscale и отблокирай

Tailscale диапазонът е в `ignoreip` → не може да бъде банат. Това е „задният вход".

```bash
# 1) Увери се, че Tailscale работи на твоята машина
tailscale status

# 2) Влез по Tailscale IP (заобикаля бана)
ssh -p 2222 deploy@100.113.162.29

# 3) Виж кои IP-та са банати в момента
sudo fail2ban-client status sshd

# 4а) Отблокирай конкретно IP (своето публично IP)
sudo fail2ban-client set sshd unbanip 203.0.113.45

# 4б) ИЛИ махни всички банове наведнъж
sudo fail2ban-client unban --all
```

> Своето публично IP виждаш с: `curl -s ifconfig.me` (от твоята машина, НЕ от сървъра).

---

## Стъпка 2 (по избор): постоянно изключи своето IP от баниране

Ако IP-то ти е статично (или цял диапазон от офиса), добави го в `ignoreip`,
за да не те банва повече:

```bash
# на сървъра (по prodts):
sudo nano /etc/fail2ban/jail.d/kcy.local
# в реда ignoreip добави своето IP/диапазон в края, напр.:
#   ignoreip = 127.0.0.1/8 ::1 100.64.0.0/10 203.0.113.45

# приложи промяната
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd   # проверка
```

> Внимание: ако IP-то ти е **динамично** (сменя се от доставчика), whitelist-ването
> няма траен ефект — ползвай Tailscale (prodts) като надежден път.

---

## Стъпка 3 (краен случай): нямаш Tailscale и си напълно заключен

Ако не можеш да влезеш нито публично, нито по Tailscale:

1. Изчакай **10 минути** — банът изтича сам (`bantime = 10m`).
2. Или влез през **уеб конзолата / VNC на хостинг доставчика** (DigitalOcean
   „Console", Hetzner, и т.н. — те не минават през SSH/fail2ban) и пусни:
   ```bash
   sudo fail2ban-client unban --all
   ```
3. Спешно (само временно) спиране на услугата:
   ```bash
   sudo systemctl stop fail2ban     # ИЗКЛЮЧВА защитата — пусни я пак след това!
   # ... свърши си работата ...
   sudo systemctl start fail2ban
   ```

---

## Защо изобщо те банва — и как да НЕ се повтаря

**Главната причина** не е грешна парола, а **ssh-agent, който предлага всичките ти
ключове** при всяка връзка. Сървърът отказва ключ след ключ → „too many authentication
failures" → fail2ban брои това като провалени опити → бан (особено при многото връзки
на деплоя).

**Решението вече е вградено** в деплой скриптовете — пинва се САМО deploy ключът:

```
-o IdentitiesOnly=yes -i <път-до-deploy-ключа>
```

(виж `deploy-scripts/04-deploy.sh` и `02-full-install.sh`). Когато се свързваш ръчно,
ползвай същото:

```bash
ssh -o IdentitiesOnly=yes -i ~/.ssh/deploy_key -p 2222 deploy@take.offbitch.com
```

Така agent-ът не пробва всички ключове → няма провалени опити → няма бан.

---

## Бърза справка (cheat sheet)

| Задача | Команда (на сървъра) |
|--------|----------------------|
| Виж банати IP-та | `sudo fail2ban-client status sshd` |
| Отблокирай едно IP | `sudo fail2ban-client set sshd unbanip <IP>` |
| Отблокирай всички | `sudo fail2ban-client unban --all` |
| Презареди след промяна | `sudo systemctl restart fail2ban` |
| Спешно спри защитата | `sudo systemctl stop fail2ban` (пусни я пак!) |
| Заобиколи бана | влез по Tailscale: `ssh -p 2222 deploy@100.113.162.29` |
| Изчакай да изтече | банът пада сам след `bantime = 10m` |
