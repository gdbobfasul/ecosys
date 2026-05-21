<!-- Version: 1.0093 -->
# KCY1 Token v3.1 - Документация за Промените

## 🆕 Нови Ограничения: Exempt → Обикновен Адрес

### Добавени Константи

```solidity
uint256 public constant MAX_EXEMPT_TO_NORMAL = 100 * 10**18;  // Максимум 100 токена
uint256 public constant EXEMPT_TO_NORMAL_COOLDOWN = 24 hours;  // 24 часа изчакване
```

### Добавен Mapping

```solidity
mapping(address => uint256) public lastExemptToNormalTime;
```
Проследява последния exempt→normal трансфер за всеки exempt адрес.

---

## 📊 Обновена Таблица с Ограничения

| От → Към | Max Transaction | Max Wallet | Cooldown | Fees |
|----------|----------------|------------|----------|------|
| Exempt → Exempt | ♾️ Няма лимит | ♾️ Няма лимит | ❌ Няма | ❌ Без |
| **Exempt → Обикновен** | **✅ 100 токена** | **♾️ Няма лимит** | **✅ 24 часа** | **❌ Без** |
| Обикновен → Exempt | ♾️ Няма лимит | ♾️ Няма лимит | ❌ Няма | ❌ Без |
| Обикновен → Обикновен | ✅ 1,000 токена | ✅ 20,000 | ✅ 2 часа | ✅ 3%+5% |

---

## 🔧 Технически Детайли

### Проверка в `_transfer()` Функцията

```solidity
// НОВО: Проверка за exempt → normal ограничения
if (fromExempt && !toExempt) {
    // Максимум 100 токена
    require(amount <= MAX_EXEMPT_TO_NORMAL, "Exempt to normal: exceeds 100 token limit");
    
    // Cooldown 24 часа
    uint256 lastExemptTx = lastExemptToNormalTime[from];
    if (lastExemptTx != 0) {
        require(
            block.timestamp >= lastExemptTx + EXEMPT_TO_NORMAL_COOLDOWN,
            "Exempt to normal: must wait 24 hours between transfers"
        );
    }
}
```

### Обновяване на Cooldown Timer

```solidity
// След успешен exempt → normal трансфер
if (fromExempt && !toExempt) {
    lastExemptToNormalTime[from] = block.timestamp;
}
```

---

## 💡 Практически Примери

### ✅ Разрешени Транзакции

**Пример 1:** Owner изпраща 100 токена на потребител
```
От: Owner (exempt)
Към: 0xUser123 (обикновен)
Количество: 100 токена
Резултат: ✅ Успешно (първи път)
```

**Пример 2:** Contract изпраща 50 токена на потребител
```
От: Contract (exempt)
Към: 0xUser456 (обикновен)
Количество: 50 токена
Резултат: ✅ Успешно
```

**Пример 3:** След 24 часа, Owner изпраща отново
```
От: Owner (exempt)
Към: 0xUser789 (обикновен)
Количество: 100 токена
Време: 24+ часа след последния exempt→normal трансфер
Резултат: ✅ Успешно
```

### ❌ Забранени Транзакции

**Пример 1:** Надвишаване на лимита
```
От: Owner (exempt)
Към: 0xUser123 (обикновен)
Количество: 101 токена
Резултат: ❌ "Exempt to normal: exceeds 100 token limit"
```

**Пример 2:** Опит за трансфер преди 24 часа
```
От: Owner (exempt)
Към: 0xUser456 (обикновен)
Количество: 50 токена
Време: 10 часа след последния exempt→normal трансфер
Резултат: ❌ "Exempt to normal: must wait 24 hours between transfers"
```

---

## 🎯 Защо Тези Промени?

### Предимства:
1. **Защита от масово разпределение** - Exempt адреси не могат да наводнят пазара с токени
2. **Контролирано разпространение** - По-бавно и контролирано пускане на токени в обращение
3. **Предотвратяване на дъмпинг** - 24-часовият cooldown ограничава бързите продажби
4. **Прозрачност** - Ясни правила за всички exempt адреси

### Важни Бележки:
- ⚠️ Exempt → Exempt все още **няма ограничения**
- ⚠️ Обикновен → Exempt все още **няма ограничения**
- ⚠️ Initial distribution функцията **не е засегната** (contract→exempt трансфер)
- ✅ Fees **НЕ се събират** за exempt→normal трансфери (получателят получава 100%)

---

## 📋 Deployment Checklist

Преди deployment, променете:
1. ✅ `MARKETING_WALLET` адрес
2. ✅ `TEAM_WALLET` адрес
3. ✅ `DEV_WALLET` адрес
4. ✅ `ADVISOR_WALLET` адрес
5. ✅ `COMMUNITY_WALLET` адрес

След deployment:
1. ✅ Извикайте `distributeInitialAllocations()`
2. ✅ Настройте `updateExemptAddresses()`
3. ✅ (Опционално) `lockExemptAddressesForever()`

---

## 🔍 Проверка на Cooldown

За да проверите кога един exempt адрес може отново да изпрати:

```javascript
// В web3/ethers.js
const lastTime = await contract.lastExemptToNormalTime(exemptAddress);
const currentTime = Math.floor(Date.now() / 1000);
const cooldownPeriod = 24 * 60 * 60; // 24 часа в секунди

if (lastTime == 0) {
    console.log("Никога не е изпращал към normal адрес - може веднага");
} else {
    const timeLeft = (lastTime + cooldownPeriod) - currentTime;
    if (timeLeft > 0) {
        console.log(`Трябва да изчака още ${timeLeft} секунди`);
    } else {
        console.log("Може да изпрати сега");
    }
}
```

---

## ⚠️ Важни Предупреждения

1. **Blacklist винаги важи** - Дори exempt адрес може да бъде блокиран
2. **Pause винаги важи** - Дори exempt адреси не могат да прехвърлят когато е паузирано
3. **Owner винаги е exempt** - Owner адресът винаги е exempt автоматично
4. **Contract винаги е exempt** - Token contract-ът винаги е exempt автоматично

---

## 📞 Поддръжка

Версия: **3.1**
Дата: **2025**
Статус: **Production Ready**
