<!-- Version: 1.0093 -->
# 📝 ДОКУМЕНТИ ЗА ПОПРАВЯНЕ

## ✅ ПОПРАВЕН:

### `/docs/CRYPTO-PAYMENTS.md`
- ✅ Премахнати усложнения за blockchain monitoring
- ✅ Обяснен простият процес: QR код → User превежда → User натиска Verify
- ✅ Ясно казано че checkBlockchainPayment() е stub

---

## ⚠️ ТРЯБВА ДА СЕ ПОПРАВЯТ:

### `/docs/README_CRYPTO.md`
**Грешни неща:**
- ❌ "Blockchain Listener: Автоматично слуша за payments"
- ❌ "Real-time потвърждения"
- ❌ "crypto-payment-listener.js (blockchain listener)"

**Трябва да се каже:**
- ✅ Verification on-demand (само когато user натисне бутон)
- ✅ checkBlockchainPayment() stub - needs implementation

---

### `/docs/MASTER_INTEGRATION_GUIDE.md`  
**Ред 224:** "Wait for blockchain confirmation" + "Backend receives notification"

**Трябва да се каже:**
- User натиска "Verify Payment"
- Backend проверява blockchain ТОГАВА
- НЯМА real-time notification

---

### `/docs/UPGRADE_TO_00014.md`
Трябва да се провери дали има подобни грешки.

---

## 📋 РЕЗЮМЕ:

Всички документи които споменават:
- "real-time monitoring"
- "blockchain listener"
- "automatic detection"
- "webhook notifications"
- "background jobs"

Трябва да се поправят да казват:
- "on-demand verification"
- "user clicks Verify Payment button"
- "checkBlockchainPayment() checks on request"
