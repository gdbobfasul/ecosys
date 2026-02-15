<!-- Version: 1.0056 -->
🔒 ПРЕПОРЪКА ЗА SSL:
Self-signed certificate е OK за тестване, НО:
За production използвай Let's Encrypt (безплатно):
bash# Инсталирай Certbot
sudo apt install certbot python3-certbot-nginx

# Генерирай РЕАЛЕН SSL certificate
sudo certbot --nginx -d alsec.strangled.net

# Certbot автоматично ще обнови конфигурацията!

✅ СЛЕД ОБНОВЯВАНЕТО:
Тествай:
bash# 1. HTTP redirects към HTTPS
curl -I http://alsec.strangled.net
# Трябва: Location: https://alsec.strangled.net

# 2. API работи
curl https://alsec.strangled.net/api/health
# Трябва: {"status":"ok"}

# 3. Frontend работи
curl -I https://alsec.strangled.net
# Трябва: 200 OK