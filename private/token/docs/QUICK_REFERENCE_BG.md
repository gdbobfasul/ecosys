<!-- Version: 1.0093 -->
# KCY1 Token v3.2 - Бърз Справочник

## ✅ Какво МОЖЕ да Прави Exempt Адрес

### 🔓 Exempt → Exempt (Пълна Свобода)
- ✅ Неограничено количество токени
- ✅ Без cooldown
- ✅ БЕЗ такси (100% получава получателят)
- ✅ Работи дори по време на pause
- ✅ Работи дори ако е в blacklist

**Пример:** Owner → Contract (1,000,000 токена) ✅ РАБОТИ ВИНАГИ

---

### 🔒 Exempt → Обикновен (Ограничена Свобода)
- ⚠️ Максимум 100 токена на трансфер
- ⚠️ 24 часа изчакване между трансферите
- ✅ БЕЗ такси (100% получава получателят)
- ✅ Работи дори по време на pause
- ✅ Работи дори ако exempt адресът е в blacklist

**Пример:** Owner → 0xUser123 (100 токена) ✅ РАБОТИ (ако не е изпращал в последните 24h)
**Пример:** Owner → 0xUser123 (101 токен) ❌ ГРЕШКА "exceeds 100 token limit"

---

### 🔓 Exempt ← Обикновен (Пълна Свобода)
- ✅ Неограничено количество токени
- ✅ Без cooldown
- ✅ БЕЗ такси (100% получава exempt адресът)
- ✅ Работи дори по време на pause
- ✅ Работи дори ако exempt адресът е в blacklist

**Пример:** 0xUser456 → DEX Router (5,000 токена) ✅ РАБОТИ ВИНАГИ

---

## ❌ Какво НЕ МОЖЕ да Прави Обикновен Адрес

### 🔒 Обикновен → Обикновен (Строги Правила)
- ⚠️ Максимум 1,000 токена на трансфер
- ⚠️ Максимум 20,000 токена в портфейл
- ⚠️ 2 часа cooldown между трансферите
- ⚠️ 48 часа trading lock след deployment
- ⚠️ 8% такси (3% burn + 5% owner)
- ❌ НЕ работи по време на pause
- ❌ НЕ работи ако е в blacklist

**Пример:** 0xUser1 → 0xUser2 (500 токена, без pause, не е blacklisted) ✅ РАБОТИ
**Пример:** 0xUser1 → 0xUser2 (500 токена, ПО ВРЕМЕ НА PAUSE) ❌ ГРЕШКА "Contract is paused"
**Пример:** 0xUser1 (blacklisted) → 0xUser2 ❌ ГРЕШКА "Sender is blacklisted"

---

## 🎯 Кой е Exempt?

### Автоматично Exempt (винаги):
1. **Owner адрес** - Който е deploy-нал contract-а
2. **Contract адрес** - Самият token contract

### Настроими Exempt (чрез `updateExemptAddresses()`):
3. **PancakeSwap Router** - За swap операции
4. **PancakeSwap Factory** - За създаване на pools
5. **Exempt Slot 1** - Напр. Presale contract
6. **Exempt Slot 2** - Напр. Staking contract
7. **Exempt Slot 3** - Напр. Bridge contract
8. **Exempt Slot 4** - Напр. Marketing wallet
9. **Exempt Slot 5** - Напр. Team vesting contract

---

## 🚨 Emergency Функции

### Pause (Owner само)
```solidity
pause() // Паузира за 48 часа
```
**Ефект:**
- ✅ Exempt адреси: РАБОТЯТ НОРМАЛНО
- ❌ Обикновни адреси: БЛОКИРАНИ за 48 часа

### Blacklist (Owner само)
```solidity
setBlacklist(address, true)  // Блокира адрес
setBlacklist(address, false) // Отблокира адрес
```
**Ефект:**
- ✅ Exempt адреси: ИГНОРИРАТ blacklist
- ❌ Обикновни адреси: НЕ МОГАТ да правят трансфери

---

## 📊 Матрица на Решенията

### Питане: "Може ли този трансфер?"

```
СТЪПКА 1: От exempt ИЛИ към exempt?
  └─ ДА → Провери само exempt→normal лимити
      └─ Exempt→Normal?
          └─ ДА → Max 100 токена, 24h cooldown
          └─ НЕ → Неограничено ✅
  └─ НЕ → Продължи към СТЪПКА 2

СТЪПКА 2: Contract паузиран?
  └─ ДА → ❌ БЛОКИРАН
  └─ НЕ → Продължи към СТЪПКА 3

СТЪПКА 3: От или към в blacklist?
  └─ ДА → ❌ БЛОКИРАН
  └─ НЕ → Продължи към СТЪПКА 4

СТЪПКА 4: Trading lock (48h)?
  └─ ДА → ❌ БЛОКИРАН
  └─ НЕ → Продължи към СТЪПКА 5

СТЪПКА 5: Над 1,000 токена?
  └─ ДА → ❌ БЛОКИРАН
  └─ НЕ → Продължи към СТЪПКА 6

СТЪПКА 6: Получателят ще надхвърли 20,000?
  └─ ДА → ❌ БЛОКИРАН
  └─ НЕ → Продължи към СТЪПКА 7

СТЪПКА 7: Cooldown (2h) минал?
  └─ НЕ → ❌ БЛОКИРАН
  └─ ДА → ✅ РАЗРЕШЕН (с 8% такси)
```

---

## 💡 Често Срещани Въпроси

### В: Owner е exempt, може ли да изпрати 1,000,000 токена?
**О:** 
- Към друг exempt → ✅ ДА
- Към обикновен → ❌ НЕ (max 100 токена)

### В: Какво се случва ако Owner е в blacklist?
**О:** Exempt адреси игнорират blacklist → ✅ Може да изпраща/получава

### В: DEX Router може ли да работи по време на pause?
**О:** Ако е exempt → ✅ ДА (трансферите работят)

### В: Потребител купува от DEX по време на pause?
**О:** 
- DEX Router → User (exempt→normal) → ✅ РАБОТИ (но max 100 токена)
- User → User → ❌ НЕ РАБОТИ (pause блокира)

### В: Обикновен потребител изпраща към Owner по време на pause?
**О:** Normal → Exempt → ✅ РАБОТИ (Owner е exempt, bypass pause)

---

## 🔧 Owner Команди

### Initial Setup
```solidity
// 1. Разпредели токените веднъж
distributeInitialAllocations()

// 2. Настрой exempt адресите
updateExemptAddresses([addr1, addr2, addr3, addr4, addr5], router, factory)

// 3. (Опционално) Заключи exempt адресите завинаги
lockExemptAddressesForever()
```

### Emergency Management
```solidity
// Паузирай за 48 часа
pause()

// Блокирай злонамерен адрес
setBlacklist(maliciousAddress, true)

// Отблокирай адрес
setBlacklist(address, false)

// Блокирай много адреси наведнъж
setBlacklistBatch([addr1, addr2, addr3], true)
```

### Token Management
```solidity
// Изтегли токени от contract към owner
withdrawCirculationTokens(amount)

// Burn токени (намалява totalSupply)
burn(amount)

// Изтегли BNB от contract
withdrawBNB()

// Rescue случайно изпратени токени
rescueTokens(tokenAddress, amount)
```

---

## ⚠️ Важни Предупреждения

1. **Lock е необратим** - След `lockExemptAddressesForever()` НЕ МОЖЕТЕ да промените exempt адреси!
2. **Owner адресът е exempt автоматично** - Не може да се премахне от exempt
3. **Contract адресът е exempt автоматично** - Не може да се премахне от exempt
4. **Pause изтича автоматично** - След 48 часа трансферите се разблокират автоматично
5. **Blacklist е ръчен** - Трябва ръчно да отблокирате адрес с `setBlacklist(addr, false)`

---

## 📞 Deployment Checklist

Преди deployment:
- [ ] Промени `MARKETING_WALLET` адрес (ред 57)
- [ ] Промени `TEAM_WALLET` адрес (ред 61)
- [ ] Промени `DEV_WALLET` адрес (ред 65)
- [ ] Промени `ADVISOR_WALLET` адрес (ред 69)
- [ ] Промени `COMMUNITY_WALLET` адрес (ред 73)

След deployment:
- [ ] Извикай `distributeInitialAllocations()`
- [ ] Извикай `updateExemptAddresses()` с правилните адреси
- [ ] (Опционално) Извикай `lockExemptAddressesForever()`
- [ ] Тествай exempt→normal трансфер (100 токена)
- [ ] Тествай pause механизма
- [ ] Тествай blacklist механизма
- [ ] Добави ликвидност в DEX

---

**Версия:** 3.2  
**Статус:** Production Ready ✅  
**Препоръка:** Използвай тази версия за production deployment
