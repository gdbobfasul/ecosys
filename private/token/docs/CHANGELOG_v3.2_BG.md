<!-- Version: 1.0093 -->
# KCY1 Token v3.2 - Документация за Промените

## 🆕 Версия 3.2: Пълни Exempt Привилегии

### Какво е Ново в v3.2?

**Pause и Blacklist ВЕЧЕ НЕ важат за exempt адреси!**

Exempt адресите сега имат **пълни привилегии** и могат да:
- ✅ Правят трансфери дори когато контрактът е паузиран
- ✅ Правят трансфери дори когато са в blacklist
- ✅ Получават трансфери дори когато са в blacklist

---

## 🔐 Обновени Правила за Exempt Адреси

### Exempt Адреси Включват:
1. **Owner адрес** (автоматично)
2. **Contract адрес** (автоматично)
3. **PancakeSwap Router** (настроим)
4. **PancakeSwap Factory** (настроим)
5. **5 допълнителни слота** (настроими чрез `updateExemptAddresses()`)

### Exempt Привилегии:

| Ограничение | Обикновен Адрес | Exempt Адрес |
|-------------|-----------------|--------------|
| Trading Lock (48h) | ✅ Важи | ❌ НЕ важи |
| Max Transaction (1,000) | ✅ Важи | ❌ НЕ важи |
| Max Wallet (20,000) | ✅ Важи | ❌ НЕ важи |
| Cooldown (2h) | ✅ Важи | ❌ НЕ важи |
| Fees (3% + 5%) | ✅ Важи | ❌ НЕ важи |
| **Pause** | ✅ **Важи** | ❌ **НЕ важи** 🆕 |
| **Blacklist** | ✅ **Важи** | ❌ **НЕ важи** 🆕 |

---

## 📊 Матрица на Трансферите

### Когато Контрактът е Паузиран:

| От → Към | Може ли? | Причина |
|----------|----------|---------|
| Exempt → Exempt | ✅ ДА | И двамата exempt |
| Exempt → Обикновен | ✅ ДА | От е exempt |
| Обикновен → Exempt | ✅ ДА | Към е exempt |
| Обикновен → Обикновен | ❌ НЕ | И двамата не са exempt |

### Когато Адрес е в Blacklist:

| Сценарий | Може ли? | Причина |
|----------|----------|---------|
| Blacklisted Exempt изпраща | ✅ ДА | Exempt bypass blacklist |
| Blacklisted Exempt получава | ✅ ДА | Exempt bypass blacklist |
| Blacklisted обикновен изпраща | ❌ НЕ | Blacklist важи |
| Blacklisted обикновен получава | ❌ НЕ | Blacklist важи |

---

## 🔧 Технически Детайли

### Промени в Кода

#### 1. Премахнат `whenNotPaused` Modifier

**Преди (v3.1):**
```solidity
function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
    return _transfer(msg.sender, to, amount);
}

function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
    // ...
}
```

**Сега (v3.2):**
```solidity
function transfer(address to, uint256 amount) public override returns (bool) {
    return _transfer(msg.sender, to, amount);
}

function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
    // ...
}
```

#### 2. Условна Проверка за Pause

**В `_transfer()` функцията:**
```solidity
bool fromExempt = isExemptAddress(from);
bool toExempt = isExemptAddress(to);

// Pause check - само за non-exempt адреси
if (!fromExempt && !toExempt) {
    require(!isPaused(), "Contract is paused");
}
```

#### 3. Условна Проверка за Blacklist

**В `_transfer()` функцията:**
```solidity
// Blacklist check - само за non-exempt адреси
if (!fromExempt) {
    require(!isBlacklisted[from], "Sender is blacklisted");
}
if (!toExempt) {
    require(!isBlacklisted[to], "Recipient is blacklisted");
}
```

---

## 💡 Практически Примери

### Пример 1: Pause Bypass
```
Ситуация: Контрактът е паузиран
От: Owner (exempt)
Към: 0xUser123 (обикновен)
Количество: 50 токена
Резултат: ✅ УСПЕШНО - Owner е exempt, може да изпрати
```

### Пример 2: Blacklist Bypass (Изпращач)
```
Ситуация: Owner е добавен в blacklist
От: Owner (exempt & blacklisted)
Към: 0xUser456 (обикновен)
Количество: 100 токена
Резултат: ✅ УСПЕШНО - Owner е exempt, blacklist не важи
```

### Пример 3: Blacklist Bypass (Получател)
```
Ситуация: ExemptAddress1 е в blacklist
От: 0xUser789 (обикновен)
Към: ExemptAddress1 (exempt & blacklisted)
Количество: 500 токена
Резултат: ✅ УСПЕШНО - ExemptAddress1 е exempt, може да получава
```

### Пример 4: Pause Блокира Обикновени
```
Ситуация: Контрактът е паузиран
От: 0xUser123 (обикновен)
Към: 0xUser456 (обикновен)
Количество: 50 токена
Резултат: ❌ ГРЕШКА - "Contract is paused"
```

### Пример 5: Blacklist Блокира Обикновени
```
Ситуация: 0xUser123 е в blacklist
От: 0xUser123 (обикновен & blacklisted)
Към: 0xUser456 (обикновен)
Количество: 50 токена
Резултат: ❌ ГРЕШКА - "Sender is blacklisted"
```

---

## ⚠️ Важни Предупреждения

### Защо Exempt Адреси Не Трябва да Бъдат в Blacklist?

1. **Owner адрес** - Никога не го добавяйте в blacklist (може да го направите, но е безсмислено)
2. **Contract адрес** - Никога не го добавяйте в blacklist
3. **DEX Router/Factory** - Би нарушило търговията ако са в blacklist
4. **Presale/Staking контракти** - Би спряло функционалността им

### Препоръки за Сигурност:

✅ **Използвайте blacklist САМО за обикновени адреси** (botove, скамъри)  
✅ **Exempt адреси са доверени** - проверявайте ги преди да ги добавите  
✅ **Lock exempt addresses** след като сте сигурни - `lockExemptAddressesForever()`  
⚠️ **Pause е само за emergency** - exempt адреси могат да работят винаги  

---

## 🎯 Случаи на Използване

### Случай 1: Emergency Pause

```
Сценарий: Открит е бот, който купува масово
Действие: Owner извиква pause()
Резултат: 
  ✅ Owner може да продължи да управлява токени
  ✅ DEX може да продължи да работи (ако е exempt)
  ❌ Ботове и обикновени потребители са блокирани за 48h
```

### Случай 2: Blacklist Bot

```
Сценарий: Идентифициран е бот адрес
Действие: Owner извиква setBlacklist(botAddress, true)
Резултат:
  ❌ Bot адресът не може да прави трансфери
  ✅ Owner все още може да управлява собствените си токени
  ✅ DEX все още функционира нормално
```

### Случай 3: Liquidity Provision по време на Pause

```
Сценарий: Контрактът е паузиран, но трябва да се добави ликвидност
Действие: Owner изпраща токени към DEX Router (exempt)
Резултат:
  ✅ УСПЕШНО - Exempt адреси могат да работят дори по време на pause
```

---

## 📋 Пълна Матрица на Ограниченията

| От | Към | Trading Lock | Max TX | Max Wallet | Cooldown | Fees | Pause | Blacklist |
|----|-----|--------------|--------|------------|----------|------|-------|-----------|
| Exempt | Exempt | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Exempt | Normal | ❌ | ✅ (100)* | ❌ | ✅ (24h)* | ❌ | ❌ | ❌ |
| Normal | Exempt | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Normal | Normal | ✅ | ✅ (1000) | ✅ (20k) | ✅ (2h) | ✅ | ✅ | ✅ |

*Само за exempt→normal направление

---

## 🔍 Проверка в Blockchain Explorer

За да проверите дали адрес е exempt:

```javascript
// В web3/ethers.js
const isExempt = await contract.isExemptAddress("0xYourAddress");
console.log("Is exempt:", isExempt);

const isBlacklisted = await contract.isBlacklisted("0xYourAddress");
console.log("Is blacklisted:", isBlacklisted);

const isPaused = await contract.isPaused();
console.log("Contract is paused:", isPaused);
```

---

## 📞 Поддръжка

**Версия:** 3.2  
**Ключови Промени:** Pause и Blacklist exemption за exempt addresses  
**Дата:** 2025  
**Статус:** Production Ready  

### Промени от v3.1 → v3.2:
1. ✅ Премахнат `whenNotPaused` modifier от `transfer()` и `transferFrom()`
2. ✅ Добавена условна pause проверка в `_transfer()`
3. ✅ Добавена условна blacklist проверка в `_transfer()`
4. ✅ Exempt адреси сега bypass pause и blacklist

### Всички Функции от v3.1 Остават:
- ✅ Auto-distribution механизъм
- ✅ Exempt→Normal ограничения (100 токена, 24h cooldown)
- ✅ Всички оригинални защити и лимити
