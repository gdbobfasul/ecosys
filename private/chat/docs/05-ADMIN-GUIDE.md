<!-- Version: 1.0056 -->
# 05 - Admin Guide (Администраторско ръководство)

## 🔐 Admin Panel

Admin панелът управлява всички потребители, критични думи, и плащания.

---

## 🌐 Достъп до Admin Panel

**URL:** `https://alsec.strangled.net/admin`

**Credentials:**
- Username: `admin`
- Password: `admin123` (⚠️ СМЕНИ!)

**IP Restriction:**
- Само от разрешени IPs (в `.env`)
- Default: `127.0.0.1, ::1` (localhost)

---

## 📊 Admin Pages

### **Page 1: Flagged Users (Критични думи)**

**URL:** `/api/admin/flagged-users`

**Показва:**
- Потребители с критични думи в разговорите
- Брой flagged разговори
- Личните данни

**Търсачка по:**
- Име
- Пол
- Град, село, улица
- Височина (min/max)
- Тегло (min/max)
- Работно място
- Блокиран статус

**Действия:**
- Block user
- View details

---

### **Page 2: All Users**

**URL:** `/api/admin/all-users`

**Показва:**
- Всички потребители
- Paid status
- Blocked status

**Търсачка:** (същата като Page 1)

**Действия:**
- Block/Unblock
- Update payment
- Mark as unpaid

---

### **Page 4: Users with Messages**

**URL:** `/api/admin/users-with-messages`

**Таблица колони:**

| Phone | Name | Gender | ... | Is Flagged | Location Btn | Location Data | Details |
|-------|------|--------|-----|------------|--------------|---------------|---------|
| 0888... | Иван | Male | ... | 🔴 Yes | 📍 Capture | София, ул... | 🔍 View |

**Is Flagged:**
- 🟢 Зелено = НЕ е критичен
- 🔴 Червено = Има критични думи

**Location Button:**
- "📍 Capture Location"
- Натискаш → взима location от user
- Записва в базата

**Location Data:**
- Държава, град, село, улица, номер
- GPS координати
- IP адрес
- Timestamp

**Details Button:**
- "🔍 View Details"
- Отваря в **НОВ TAB** → Page 5

---

### **Page 5: User Details**

**URL:** `/api/admin/user-details/:userId`

**Показва:**
- Пълни данни на потребител
- Всички контакти
- Разговори с всеки контакт
- Location history

**Редакция на съобщения:**
- Кликаш на message → Edit mode
- Променяш текста
- Save → **Директно update (БЕЗ original_text!)**

⚠️ **Важно:** Edit е за спешни случаи! Не е за масово редактиране!

---

## 🚫 Блокиране на потребители

**Single user:**
```http
POST /api/admin/block-users
{
  "userIds": [123],
  "reason": "Critical words usage"
}
```

**Multiple users:**
```http
POST /api/admin/block-users
{
  "userIds": [123, 456, 789],
  "reason": "Mass spam"
}
```

**Unblock:**
```http
POST /api/admin/unblock-user
{
  "userId": 123
}
```

---

## 💰 Управление на плащания

**Добави месеци:**
```http
POST /api/admin/update-payment
{
  "userId": 123,
  "months": 3
}
```

**Mark as unpaid:**
```http
POST /api/admin/mark-unpaid
{
  "userId": 123
}
```

---

## 🔍 Critical Words Management

**View all words:**
```http
GET /api/admin/critical-words
```

**Add word:**
```http
POST /api/admin/critical-words
{
  "word": "cocaine"
}
```

**Delete word:**
```http
DELETE /api/admin/critical-words/:id
```

**Default words:**
drugs, weapon, illegal, bomb, terror, kill, murder, kidnap, ransom, threat

---

## 📍 Location Capture

**Как работи:**
1. Отваряш Page 4
2. Намираш user
3. Натискаш "📍 Capture Location"
4. Frontend взима location от user (ако е онлайн)
5. POST към `/api/admin/capture-location`:

```http
POST /api/admin/capture-location
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

6. Location се записва в `users` таблица
7. Показва се в колоната

---

## 📊 Statistics

**GET /api/admin/stats**

Returns:
```json
{
  "totalUsers": 1234,
  "activeUsers": 456,
  "blockedUsers": 12,
  "totalMessages": 56789,
  "flaggedConversations": 23,
  "criticalWords": 15,
  "totalRevenue": 6170.00
}
```

---

## 🔐 Security

### **Смяна на admin парола:**

**Option 1: SQL**
```bash
# Generate hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('NewPass123', 10, (e, h) => console.log(h));"

# Update database
sqlite3 chat.db
```

```sql
UPDATE admin_users 
SET password_hash = '$2b$10$NEW_HASH_HERE'
WHERE username = 'admin';
```

**Option 2: API** (ако имаш endpoint за това)

### **IP Whitelist:**

Edit `.env`:
```env
ADMIN_ALLOWED_IPS=Your.Home.IP,Your.Office.IP,VPN.IP
```

Restart server.

---

## 📝 Logs

**View logs:**
```bash
tail -f logs/app.log
```

**Filter admin actions:**
```bash
grep "Admin" logs/app.log
```

---

## ⚠️ Admin етика

### ❌ **НЕ правиш:**
- Масово редактиране на съобщения
- Споделяне на user data с трети лица
- Блокиране без причина

### ✅ **Правиш:**
- Блокираш само при critical words
- Редактираш само при грешки (по молба на user)
- Пазиш конфиденциалност

---

**Следващо:** [06-LOCATION.md](./06-LOCATION.md) - Location функционалност
