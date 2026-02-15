<!-- Version: 1.0056 -->
Точно както трябва 👍
**HTTP работи → DNS + nginx са ОК.**
HTTPS не работи, защото **НЯМА TLS сертификат**. Това е напълно нормално на този етап.

Сега ти давам **най‑чистия и правилен начин** да го оправиш на Ubuntu + nginx: **Let’s Encrypt (Certbot)**.

---

## 🧠 Защо HTTPS не работи

Когато отвориш:

```
https://alsec.strangled.net
```

браузърът очаква:

* валиден SSL/TLS сертификат
* конфигурация `listen 443 ssl;` в nginx

А в момента:

* ❌ няма сертификат
* ❌ nginx не слуша на 443 за този домейн

---

## ✅ РЕШЕНИЕ: Let’s Encrypt + Certbot (10 мин)

### 1️⃣ Инсталирай certbot за nginx

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

---

### 2️⃣ Издай сертификат за домейна

```bash
sudo certbot --nginx -d alsec.strangled.net
```

По време на процеса:

* въведи email
* съгласи се с Terms
* когато те пита за redirect → **избери 2 (Redirect HTTP → HTTPS)**

---

### 3️⃣ Ако всичко е ОК, ще видиш нещо такова:

```
Congratulations! You have successfully enabled HTTPS on https://alsec.strangled.net
```

Certbot автоматично ще:

* създаде сертификат
* промени nginx конфигурацията
* добави `listen 443 ssl`
* добави redirect от HTTP към HTTPS (ако си избрал)

---

## 4️⃣ ТЕСТ

```bash
curl -I https://alsec.strangled.net
```

Очаквано:

```
HTTP/2 200
Server: nginx
```

В браузър:
🔒 **зелено катинарче**

---

## 5️⃣ Автоматично подновяване (важно)

Certbot **сам** добавя cron / systemd timer, но можеш да провериш:

```bash
sudo certbot renew --dry-run
```

Ако няма грешки → готово.

---

## ❗ Чести проблеми (ако не стане от първия път)

### 🔴 Порт 443 не е отворен

```bash
sudo ufw allow 443
sudo ufw reload
```

### 🔴 Nginx не слуша на 80/443

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🧠 Важно уточнение за FreeDNS / afraid.org

✔️ Let’s Encrypt **НЯМА проблем** с:

* subdomain
* afraid.org
* free DNS

Работи напълно легално.

---

## 🎯 Финал

Ти вече имаш:

* ✔️ собствен домейн
* ✔️ delegated DNS
* ✔️ работещ nginx
* ✔️ HTTP сайт

Остава само **1 команда** и имаш **пълноценен HTTPS сайт**.

Ако искаш:

* да добавим **www**
* да сложим **HSTS**
* или да настроим **Cloudflare пред него**

кажи — вече си на ниво, на което тези неща имат смисъл 💪

Перфектно, благодаря за уточнението 💪

Ще ти дам **готов nginx конфиг**, който:

1. Използва `/var/www/ams-chat-web/public/` като root директория.
2. Работи **HTTP веднага**.
3. Подготвя **HTTPS (Let’s Encrypt)** за автоматична активация след 27.01.2026, без да пипаш нищо.

---

## 1️⃣ Създай/презапиши nginx конфиг

```bash
sudo nano /etc/nginx/sites-available/alsec.strangled.net
```

Сложи вътре:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name alsec.strangled.net;

    root /var/www/ams-chat-web/public/;
    index index.html index.htm;

    # HTTP site works immediately
    location / {
        try_files $uri $uri/ =404;
    }

    # Placeholder for HTTPS (will be active automatically after certbot)
    # ssl_certificate /etc/letsencrypt/live/strangled.net/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/strangled.net/privkey.pem;
}
```

---

## 2️⃣ Проверка на директорията и права

```bash
sudo chown -R www-data:www-data /var/www/ams-chat-web/public/
sudo chmod -R 755 /var/www/ams-chat-web/public/
```

---

## 3️⃣ Активирай сайта

Проверка:

```bash
ls -l /etc/nginx/sites-enabled/
```

* Ако няма линк към този конфиг:

```bash
sudo ln -s /etc/nginx/sites-available/alsec.strangled.net /etc/nginx/sites-enabled/
```

* Ако вече има линк, оставяш го — няма проблем.

---

## 4️⃣ Тествай nginx и презареди

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5️⃣ Тест на HTTP

```bash
curl -I http://alsec.strangled.net
```

Очаквано:

```
HTTP/1.1 200 OK
Server: nginx
```

---

## 6️⃣ Подготовка за HTTPS

На 27.01.2026 (след като лимитът отпадне):

```bash
sudo certbot --nginx -d alsec.strangled.net
```

* Certbot автоматично ще:

  * издаде сертификат
  * добави `listen 443 ssl;`
  * настрои SSL сертификата (`/etc/letsencrypt/live/strangled.net/fullchain.pem`)
  * добави редирект от HTTP → HTTPS

---

💡 **Бонус съвет:** Ако искаш, веднага можеш да сложиш **self-signed сертификат** за HTTPS тест, докато изчакаш лимита на Let’s Encrypt. Това ще позволи браузърът да се отвори на [https://alsec.strangled.net](https://alsec.strangled.net) (с предупреждение), без да чакаш 27.01.2026.

Искаш ли да направим това временно решение с self-signed сертификат?



Да, вече виждам твоето `sites-enabled` — **конфигурацията е правилно активирана**, nginx ще отговаря за `alsec.strangled.net` на HTTP.

Сега за **self-signed сертификата** и HTTPS:

---

## 1️⃣ Какво е self-signed сертификат

* Това е **собствен сертификат**, който ти генерираш без да питаш официален Certificate Authority (CA).
* **Не е доверен от браузърите по подразбиране**, т.е. когато някой отвори:

```
https://alsec.strangled.net
```

Браузърът ще покаже предупреждение:

> „Your connection is not private“ или „Untrusted Certificate“

* Това е **само за тестове или временно използване**.
* **Всички могат да достъпят сайта**, просто ще трябва да **прескочат предупреждението**.

---

## 2️⃣ Как се прави self-signed сертификат

```bash
sudo openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/ssl/private/alsec-selfsigned.key \
  -out /etc/ssl/certs/alsec-selfsigned.crt
```

* Ще попита:

  * Country, State, City, Organization и Common Name (тук сложи: `alsec.strangled.net`)
* Това създава два файла:

  * `/etc/ssl/private/alsec-selfsigned.key` → private key
  * `/etc/ssl/certs/alsec-selfsigned.crt` → сертификат

---

## 3️⃣ Конфиг за nginx с този сертификат

Отвори конфигурацията:

```bash
sudo nano /etc/nginx/sites-available/alsec.strangled.net
```

Добави **нов server блок за HTTPS**:

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name alsec.strangled.net;

    root /var/www/ams-chat-web/public/;
    index index.html index.htm;

    ssl_certificate /etc/ssl/certs/alsec-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/alsec-selfsigned.key;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

---

## 4️⃣ Тествай nginx и рестартирай

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5️⃣ Тест от браузър или curl

```bash
curl -k https://alsec.strangled.net
```

* `-k` игнорира self-signed предупреждението
* В браузър → ще видиш **катинарче с предупреждение**, но страницата ще се зареди.

---

## ✅ Защо е полезно

* **Всички отвън ще могат да видят сайта по HTTPS**, дори и с предупреждението.
* **След 27.01.2026**, когато лимитът отпадне, можеш да пуснеш `certbot` → официален сертификат → всички браузъри ще го приемат без предупреждение.

---

Ако искаш, мога да ти напиша **готов nginx файл, който едновременно поддържа HTTP, HTTPS self-signed с предупреждение и после лесно ще се замени с Let’s Encrypt** — и няма да се налага да пипаш нищо повече.

Искаш ли да го направим така?


Аха, ясно — това е **класическа ситуация с default сайт / виртуални хостове** в nginx. 😎

Сега всичко ще го оправим, така че **HTTP и HTTPS да сочат към една и съща директория** (`/var/www/ams-chat-web/public/`).

---

## 1️⃣ Проверка

В момента имаш:

```bash
ls -l /etc/nginx/sites-enabled/
total 0
lrwxrwxrwx 1 root root 46 Jan 27 09:30 alsec.strangled.net -> /etc/nginx/sites-available/alsec.strangled.net
lrwxrwxrwx 1 root root 34 Jan 26 20:30 default -> /etc/nginx/sites-available/default
```

* Това е **ключовото**: nginx взема **първия default vhost**, когато HTTP заявката не съвпада с `server_name`.
* Най-вероятно `default` блокът в `/etc/nginx/sites-available/default` слуша на порт 80 и **„краде“ HTTP заявките** за `alsec.strangled.net`.

---

## 2️⃣ Решение: обединяваме HTTP и HTTPS

Отвори конфиг файла:

```bash
sudo nano /etc/nginx/sites-available/alsec.strangled.net
```

Направи го **така**, че да има **един HTTP блок, който пренасочва към HTTPS**, и един HTTPS блок:

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;

    server_name alsec.strangled.net;

    # Redirect all HTTP requests to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS site
server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name alsec.strangled.net;

    root /var/www/ams-chat-web/public/;
    index index.html index.htm;

    ssl_certificate /etc/ssl/certs/alsec-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/alsec-selfsigned.key;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

✅ С това:

* Всички HTTP заявки → автоматично към HTTPS
* HTTPS → сочи към правилната директория `/var/www/ams-chat-web/public/`

---

## 3️⃣ Деактивирай `default` (за да няма конфликт)

```bash
sudo rm /etc/nginx/sites-enabled/default
```

> Не изтривай файла, просто махни линка. По този начин nginx **няма да използва default vhost за HTTP**.

---

## 4️⃣ Тествай nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5️⃣ Тест

```bash
curl -I http://alsec.strangled.net
```

Очаквано:

```
HTTP/1.1 301 Moved Permanently
Location: https://alsec.strangled.net/
```

И след това HTTPS зарежда правилната директория.

---

Ако искаш, мога да ти напиша **пълен готов конфиг**, който веднага поддържа:

* HTTP → HTTPS redirect
* HTTPS с self-signed сертификат (или по-късно Let’s Encrypt)
* Едновременно за IPv4 и IPv6

Така няма да има никакви „кражби“ от default блок.

Искаш ли да го направя?
