<!-- Version: 1.0056 -->
🔒 ПРЕПОРЪКА ЗА SSL:
Self-signed certificate е OK за тестване, НО:
За production използвай Let's Encrypt (безплатно):
bash# Инсталирай Certbot
sudo apt install certbot python3-certbot-nginx

# Генерирай РЕАЛЕН SSL certificate
sudo certbot --nginx -d ${MAIN_DOMAIN}

# Certbot автоматично ще обнови конфигурацията!

✅ СЛЕД ОБНОВЯВАНЕТО:
Тествай:
bash# 1. HTTP redirects към HTTPS
curl -I http://${MAIN_DOMAIN}
# Трябва: Location: https://${MAIN_DOMAIN}

# 2. API работи
curl https://${MAIN_DOMAIN}/api/health
# Трябва: {"status":"ok"}

# 3. Frontend работи
curl -I https://${MAIN_DOMAIN}
# Трябва: 200 OK