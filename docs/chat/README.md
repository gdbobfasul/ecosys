<!-- Version: 001.00001 -->
# 📚 Pupikes Chat - Пълна Документация

Добре дошли в документацията на **Pupikes Chat** (Анонимен Чат)!

---

## 📂 Структура на документацията

### **1. Инсталация**
- **[01-INSTALLATION.md](./01-INSTALLATION.md)** - Стъпка по стъпка инсталация
- **[02-DATABASE.md](./02-DATABASE.md)** - Конфигурация на базата данни
- **[03-ENVIRONMENT.md](./03-ENVIRONMENT.md)** - Environment variables (.env файл)

### **2. Функционалности**
- **[04-USER-GUIDE.md](./04-USER-GUIDE.md)** - Ръководство за потребители
- **[05-ADMIN-GUIDE.md](./05-ADMIN-GUIDE.md)** - Админ панел
- **[06-LOCATION.md](./06-LOCATION.md)** - Location sharing функционалност

### **3. Външни услуги**
- **[07-STRIPE.md](./07-STRIPE.md)** - Stripe плащания
- **[08-EXTERNAL-SERVICES.md](./08-EXTERNAL-SERVICES.md)** - Всички външни API-та

### **4. Deployment**
- **[09-DEPLOYMENT.md](./09-DEPLOYMENT.md)** - Публикуване на production
- **[10-TROUBLESHOOTING.md](./10-TROUBLESHOOTING.md)** - Решения на проблеми

### **5. API Documentation**
- **[11-API-REFERENCE.md](./11-API-REFERENCE.md)** - Пълен API справочник

---

## 🚀 Бърз старт

### За Web (AMS-chat-web):
```bash
cd AMS-chat-web
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

### За Mobile App (AMS-chat-app):
```bash
cd AMS-chat-app
npm install
cp .env.example .env
# Edit .env with your settings
npx expo start
```

---

## 📋 Изисквания

- **Node.js:** v16 или по-нова
- **npm/yarn:** Последна версия
- **SQLite3:** За база данни
- **Stripe Account:** За плащания (test mode е достатъчен)
- **HTTPS:** За production (Location API изисква HTTPS)

---

## 🔗 Връзки

- **Stripe Dashboard:** https://dashboard.stripe.com
- **Expo Dashboard:** https://expo.dev (за mobile app build)
- **OpenStreetMap Nominatim:** https://nominatim.openstreetmap.org
- **ipapi.co:** https://ipapi.co

---

## 📞 Поддръжка

За въпроси и проблеми, моля проверете [10-TROUBLESHOOTING.md](./10-TROUBLESHOOTING.md)

---

**Версия:** 1.0.0  
**Последна актуализация:** 2024-11-05
