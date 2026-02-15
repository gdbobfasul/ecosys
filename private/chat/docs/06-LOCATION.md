<!-- Version: 1.0056 -->
# Location Feature Setup Guide

## 🎯 Функционалност

### 1. **User-to-User Location Sharing** (Чат)
Потребителите могат да споделят местоположението си в реално време с други потребители.

### 2. **Admin Location Capture** (Админ панел)
Администраторите могат да заснемат местоположението на потребител от админ страница 4.

---

## 📦 Необходими пакети (БЕЗПЛАТНИ)

### **За Web (AMS-chat-web):**
```bash
# Вече инсталирани пакети - НЯМА нужда от допълнителни!
npm install express multer uuid
```

### **За Mobile App (AMS-chat-app):**
```bash
# Expo Location API (БЕЗПЛАТНО)
npx expo install expo-location

# За IP адрес (БЕЗПЛАТНО API)
npm install axios
```

---

## 🌍 API Services (БЕЗПЛАТНИ)

### 1. **Geolocation API** (Browser Built-in)
- **Цена:** БЕЗПЛАТНО
- **Използване:** `navigator.geolocation.getCurrentPosition()`
- **Лимит:** Неограничен (browser native)

### 2. **Expo Location** (React Native)
- **Цена:** БЕЗПЛАТНО
- **Използване:** `import * as Location from 'expo-location'`
- **Лимит:** Неограничен (device native)

### 3. **IP Geolocation API** (ipapi.co)
- **Цена:** БЕЗПЛАТНО
- **Лимит:** 1000 requests/ден
- **Fallback:** ipify.org (backup)
- **Endpoint:** `https://ipapi.co/json/`

### 4. **Reverse Geocoding** (Nominatim - OpenStreetMap)
- **Цена:** БЕЗПЛАТНО
- **Лимит:** 1 request/секунда
- **Endpoint:** `https://nominatim.openstreetmap.org/reverse`
- **Използване:** GPS → Адрес (държава, град, улица, номер)

---

## 🛠️ Инсталация

### **Стъпка 1: Update Database**
```bash
# В проекта (web или app)
sqlite3 chat.db < db_setup.sql
```

Това добавя следните колони в `users` таблицата:
- `location_country`
- `location_city`
- `location_village`
- `location_street`
- `location_number`
- `location_latitude`
- `location_longitude`
- `location_ip`
- `location_captured_at`

### **Стъпка 2: Install Dependencies (Mobile App)**
```bash
cd AMS-chat-app
npx expo install expo-location
npm install axios
```

### **Стъпка 3: No Additional Setup**
Всички API-та са БЕЗПЛАТНИ и не изискват API ключове!

---

## 📱 Как работи (User)

### **Web Chat:**
1. User отваря чат с приятел
2. Натиска бутон "📍 Изпрати местоположение"
3. Browser иска разрешение за location
4. След разрешение:
   - Взима GPS координати (latitude, longitude)
   - Прави reverse geocoding (GPS → адрес)
   - Взима IP адрес
   - Изпраща всичко като съобщение с линкове

### **Mobile App:**
1. User отваря чат с приятел
2. Натиска бутон "📍 Изпрати местоположение"
3. App иска разрешение за location
4. След разрешение:
   - Взима GPS от устройството
   - Reverse geocoding
   - Взима IP
   - Изпраща

---

## 🔧 Как работи (Admin)

### **Admin Page 4:**

Таблица показва:
| Phone | Name | Gender | ... | **Is Flagged** | **Location Button** | **Location Data** | **Details** |
|-------|------|--------|-----|----------------|---------------------|-------------------|-------------|
| 0888... | Иван | Male | ... | 🔴 Yes | 📍 Capture | София, ул... | 🔍 View |

**Колони:**
1. **Is Flagged:** 
   - 🟢 Зелено = НЕ е критичен
   - 🔴 Червено = Има критични думи

2. **Location Button:**
   - Бутон "📍 Capture Location"
   - Натискаш → взима location от user-а
   - Записва в базата

3. **Location Data:**
   - Показва последното заснето location:
     - Държава, град, село, улица, номер
     - GPS координати
     - IP адрес
     - Кога е заснето

4. **Details:**
   - Бутон "🔍 View Details"
   - Отваря в **НОВ TAB** → Admin Page 5
   - Показва пълните детайли + разговори

---

## 🔐 Permissions

### **Web:**
```javascript
// Browser ще покаже prompt за разрешение
navigator.geolocation.getCurrentPosition(
  (position) => { /* success */ },
  (error) => { /* denied */ }
);
```

### **Mobile:**
```javascript
// Expo ще покаже prompt
const { status } = await Location.requestForegroundPermissionsAsync();
if (status === 'granted') {
  const location = await Location.getCurrentPositionAsync();
}
```

---

## 📊 Database Schema

```sql
-- New columns in users table
location_country TEXT,        -- Държава
location_city TEXT,           -- Град
location_village TEXT,        -- Село
location_street TEXT,         -- Улица
location_number TEXT,         -- Номер
location_latitude REAL,       -- GPS Latitude
location_longitude REAL,      -- GPS Longitude
location_ip TEXT,             -- IP адрес
location_captured_at TEXT     -- Кога е заснето
```

---

## 🚀 API Endpoints

### **1. User sends location to friend**
```http
POST /api/messages/send-location/:friendUserId
Content-Type: application/json
Authorization: Bearer <token>

{
  "latitude": 42.6977,
  "longitude": 23.3219,
  "country": "Bulgaria",
  "city": "Sofia",
  "village": "",
  "street": "Vitosha Blvd",
  "number": "1",
  "ip": "185.43.221.123"
}
```

**Response:**
```json
{
  "success": true
}
```

Message sent:
```
📍 Местоположение:
Държава: Bulgaria
Град: Sofia
Улица: Vitosha Blvd
Номер: 1

GPS: 42.6977, 23.3219
IP: 185.43.221.123

🗺️ Карти:
Google Maps: https://www.google.com/maps?q=42.6977,23.3219
2GIS: https://2gis.com/?m=23.3219,42.6977/16
Yandex: https://yandex.com/maps/?ll=23.3219,42.6977&z=16
```

### **2. Admin captures user location**
```http
POST /api/admin/capture-location
Content-Type: application/json

{
  "userId": 123,
  "latitude": 42.6977,
  "longitude": 23.3219,
  "country": "Bulgaria",
  "city": "Sofia",
  "village": "",
  "street": "Vitosha Blvd",
  "number": "1",
  "ip": "185.43.221.123"
}
```

**Response:**
```json
{
  "success": true,
  "location": {
    "location_country": "Bulgaria",
    "location_city": "Sofia",
    "location_village": "",
    "location_street": "Vitosha Blvd",
    "location_number": "1",
    "location_latitude": 42.6977,
    "location_longitude": 23.3219,
    "location_ip": "185.43.221.123",
    "location_captured_at": "2024-11-04 10:30:00"
  }
}
```

### **3. Get user location (Admin Page 4)**
```http
GET /api/admin/users-with-messages?page=1
```

**Response includes:**
```json
{
  "users": [
    {
      "id": 123,
      "phone": "0888123456",
      "full_name": "Иван",
      "isFlagged": true,
      "flaggedCount": 3,
      "hasLocation": true,
      "location_country": "Bulgaria",
      "location_city": "Sofia",
      "location_latitude": 42.6977,
      "location_longitude": 23.3219,
      "location_captured_at": "2024-11-04 10:30:00",
      ...
    }
  ]
}
```

---

## 💰 Цени (ВСИЧКИ БЕЗПЛАТНИ!)

| Service | Free Tier | Needed? |
|---------|-----------|---------|
| Browser Geolocation API | ∞ | ✅ Да |
| Expo Location | ∞ | ✅ Да |
| ipapi.co | 1000/ден | ✅ Да |
| Nominatim (OSM) | 1 req/sec | ✅ Да |
| Google Maps (links) | ∞ | ✅ Да (само линкове) |
| Yandex Maps (links) | ∞ | ✅ Да (само линкове) |
| 2GIS (links) | ∞ | ✅ Да (само линкове) |

**ОБЩО: €0/месец** 🎉

---

## 🔥 Rate Limits

### **Nominatim (Reverse Geocoding):**
- Лимит: 1 request/секунда
- Решение: Кеширане на резултати
- Backup: Показваш само GPS ако fails

### **ipapi.co:**
- Лимит: 1000 requests/ден
- Решение: Кеширане на IP → location mapping
- Backup: ipify.org (само IP, без location)

---

## 🛡️ Security Notes

1. **User Location:** User трябва да даде разрешение
2. **Admin Location:** Admin може да вземе location БЕЗ разрешение (ако user е в app/browser)
3. **IP Address:** Взима се от public API
4. **Privacy:** Location data се пази САМО в база (не се споделя с трети страни)

---

## ✅ Testing

### **Test User Location:**
1. Login като user
2. Отвори чат с приятел
3. Натисни "📍 Изпрати местоположение"
4. Провери дали message се изпраща с адрес + GPS + линкове

### **Test Admin Capture:**
1. Login като admin
2. Отвори Admin Page 4
3. Намери user
4. Натисни "📍 Capture Location"
5. Провери дали се показва location в колоната

---

## 🐛 Troubleshooting

### **Geolocation не работи:**
- Check browser permissions (chrome://settings/content/location)
- Check HTTPS (geolocation изисква HTTPS!)
- Check mobile app permissions

### **Reverse geocoding връща грешка:**
- Nominatim може да е down → show GPS only
- Rate limit exceeded → show GPS only
- Invalid coordinates → check lat/lng format

### **IP address не се взима:**
- ipapi.co може да е down → fallback to ipify.org
- Network blocked → skip IP field

---

## 📝 Summary

✅ **User може:** Изпраща location на приятели (с разрешение)  
✅ **Admin може:** Засича location на users (Page 4)  
✅ **Показва:** Адрес + GPS + IP + Карти (Google/Yandex/2GIS)  
✅ **База:** Location се записва в `users` таблица  
✅ **Цена:** €0/месец (всичко БЕЗПЛАТНО!)  
✅ **Лимити:** 1000 IP requests/ден, 1 geocode/sec (достатъчно!)

**Готово!** 🎉
