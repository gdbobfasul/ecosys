<!-- Version: 1.0056 -->
# 11 - API Reference

## 📡 Пълен API справочник

Base URL: `https://alsec.strangled.net/api`

---

## 🔐 Authentication

### **Login**
```http
POST /auth/login
Content-Type: application/json

{
  "phone": "0888123456",
  "password": "mypassword"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "userId": 123
}
```

**Or redirects:**
- `needsRegistration: true` → Register
- `needsPayment: true` → Payment
- `isBlocked: true` → Blocked

---

### **Register**
```http
POST /auth/register
Content-Type: application/json

{
  "phone": "0888123456",
  "password": "mypassword",
  "full_name": "Ivan Ivanov",
  "gender": "male",
  "height_cm": 180,
  "weight_kg": 75,
  "country": "Bulgaria",
  "city": "Sofia"
}
```

---

## 💬 Messages

### **Get Messages**
```http
GET /messages/:friendUserId
Authorization: Bearer <token>
```

### **Send Text**
```http
POST /messages/:friendUserId
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Hello!"
}
```

### **Send File**
```http
POST /messages/:friendUserId/file
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
```

### **Send Location**
```http
POST /messages/send-location/:friendUserId
Authorization: Bearer <token>

{
  "latitude": 42.6977,
  "longitude": 23.3219,
  "country": "Bulgaria",
  "city": "Sofia",
  "street": "Vitosha Blvd",
  "number": "1",
  "ip": "185.43.221.123"
}
```

---

## 👥 Friends

### **Get Friends**
```http
GET /friends
Authorization: Bearer <token>
```

### **Search Users**
```http
GET /friends/search?phone=0888&country=BG&gender=male&height=180&weight=75
Authorization: Bearer <token>
```

### **Add Friend**
```http
POST /friends/add
Authorization: Bearer <token>

{
  "friendUserId": 456
}
```

---

## 💳 Payment

### **Create Checkout**
```http
POST /payment/create-checkout-session
Authorization: Bearer <token>

{
  "userId": 123,
  "phone": "0888123456",
  "countryCode": "BG"
}
```

### **Webhook** (Stripe calls this)
```http
POST /payment/webhook
Stripe-Signature: <signature>

<stripe event payload>
```

---

## 🔧 Admin API

**All admin endpoints require IP whitelist!**

### **Login**
```http
POST /admin/login

{
  "username": "admin",
  "password": "admin123"
}
```

### **Flagged Users**
```http
GET /admin/flagged-users?page=1&search=ivan&gender=male
```

### **All Users**
```http
GET /admin/all-users?page=1
```

### **Users with Messages**
```http
GET /admin/users-with-messages?page=1
```

### **User Details**
```http
GET /admin/user-details/:userId
```

### **Edit Message**
```http
POST /admin/edit-message

{
  "messageId": 123,
  "newText": "Edited text"
}
```

### **Block User**
```http
POST /admin/block-users

{
  "userIds": [123, 456],
  "reason": "Spam"
}
```

### **Unblock User**
```http
POST /admin/unblock-user

{
  "userId": 123
}
```

### **Capture Location**
```http
POST /admin/capture-location

{
  "userId": 123,
  "latitude": 42.6977,
  "longitude": 23.3219,
  "country": "Bulgaria",
  "city": "Sofia",
  "ip": "185.43.221.123"
}
```

### **Update Payment**
```http
POST /admin/update-payment

{
  "userId": 123,
  "months": 3
}
```

### **Critical Words**
```http
GET /admin/critical-words
POST /admin/critical-words { "word": "cocaine" }
DELETE /admin/critical-words/:id
```

### **Stats**
```http
GET /admin/stats
```

---

## 🔒 Response Codes

- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

**Край на документацията!** 🎉
