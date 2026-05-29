# Достъп до админските страници

## Логика на достъпа

Портал страниците и админ панелите изискват **И двете** условия едновременно за достъп:

1. **URL параметър** `?adm=bgmasters-set`
2. **IP адресът** на потребителя да е в whitelist (`ADMIN_ALLOWED_IPS` в `.env`)

Кодът проверява и двете заедно:

```js
adminAccess = hasAdmUrlParam && isIpWhitelisted
```

Ако едното от двете липсва → пренасочване към billing страницата.

## Пример

Линк като:
```
https://alsec.strangled.net/portals/games/?adm=bgmasters-set
```

ще пренасочи към billing ако твоят IP не е в whitelist-а — дори с правилния `?adm=` параметър.

## Кога IP-то се променя

IP адресите могат да се сменят неочаквано:

- Смяна на мрежа (друг wifi, мобилни данни, VPN)
- Друг доставчик / друго местоположение
- Рестарт на рутера — много доставчици дават нов динамичен IP
- ISP периодично рециклира адресите

## Как да провериш текущия си IP

В браузъра отвори едно от:

- `https://api.ipify.org`
- `https://whatismyip.com`

Сравни го с този в `.env` (`ADMIN_ALLOWED_IPS=...`).

## Как да добавиш нов IP в whitelist-а

### 1. Влез в сървъра по SSH
```bash
ssh root@alsec.strangled.net -p 2222
```

### 2. Отвори `.env` файла
```bash
nano /var/www/kcy-ecosystem/private/configs/.env
```

### 3. Намери `ADMIN_ALLOWED_IPS` и добави новия IP

Разделени със запетая, без интервали:
```
ADMIN_ALLOWED_IPS=95.87.73.240,НОВИЯТ_IP
```

Може да има няколко IP-та:
```
ADMIN_ALLOWED_IPS=95.87.73.240,77.78.79.80,1.2.3.4
```

### 4. Запази
- `Ctrl+O` → Enter (запис)
- `Ctrl+X` (изход)

### 5. Рестартирай услугите за да хванат новия `.env`

```bash
systemctl restart kcy-portals
systemctl restart kcy-chat
systemctl reload nginx
```

(Имената на услугите зависят от deploy конфигурацията — провери с `systemctl list-units | grep kcy`.)

## Проверка на сървъра — какво вижда той

За да видиш на кой IP реално идват заявките ти:

```bash
tail -f /var/log/nginx/access.log
```

После отвори админ страницата от браузъра. В лога ще се появи нов ред с IP-то от което идва заявката. Ако този IP е различен от `ADMIN_ALLOWED_IPS` → това е причината за пренасочването.

## Временно "от всеки IP" — `0.0.0.0/0`

Кодът поддържа специален allow-all случай:

```
ADMIN_ALLOWED_IPS=127.0.0.1,::1,0.0.0.0/0
```

Когато в whitelist-а присъства `0.0.0.0/0` (или `::/0` за IPv6) → **всеки IP** минава проверката.

**ВНИМАНИЕ — голям риск за сигурността:**
- Всеки в интернет с URL `?adm=bgmasters-set` става администратор
- `?adm=bgmasters-set` е по същество парола в URL — лесно се прихваща
- Админът вижда хешове на пароли, може да трие потребители и т.н.

Ползвай **само за временно тестване** и веднага след това:
1. Махни `0.0.0.0/0` от `.env`
2. Сложи си конкретните IP-та
3. Рестартирай услугите

## Релевантен код

- `private/portals/middleware/access-control.js` — `computeAccess()` функцията
- `private/portals/middleware/access-control.js` — `requirePortalAccess` / `requirePortalAccessAPI` middleware-ите
- Nginx конфигурация (`02-setup-domain.sh` генерира allow/deny директиви от `ADMIN_ALLOWED_IPS`)

## Сродна документация

- `admin-status.html` — diagnostic страница, ползва същия IP whitelist (само IP, без URL параметър)
- Навигационното меню (`navigation.js`) показва админ опциите само ако URL съдържа `?adm=bgmasters-set`
