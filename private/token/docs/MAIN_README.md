<!-- Version: 1.0093 -->
# KCY1 Token - Project Files

## 📁 Структура на Файловете

```
/outputs/
├── kcy1_token_v3.4_FINAL.sol   ⭐ ГЛАВЕН CONTRACT (използвай този!)
├── kcy1_token_v3.2.sol         (предишна версия - за справка)
├── kcy1_token_v3.1.sol         (предишна версия - за справка)
└── docs/                       📚 ДОКУМЕНТАЦИЯ
    ├── CHANGELOG_v3.4_BG.md          (Промени в v3.4)
    ├── LOGIC_VERIFICATION_BG.md      (Потвърждение на логиката)
    ├── SUMMARY_v3.3_BG.md            (Кратко резюме)
    └── ... (други документи)
```

---

## 🚀 Бърз Старт

### За Deployment:

1. **Използвай:** `kcy1_token_v3.4_FINAL.sol`
2. **Прочети:** `docs/CHANGELOG_v3.4_BG.md` (нови промени)
3. **Прочети:** `docs/LOGIC_VERIFICATION_BG.md`
4. **Deploy** на BSC mainnet/testnet

---

## ✅ Логика на Токена

### При Deployment:
```
1,000,000 KCY1 Tokens
├─► 600,000 → DEV_WALLET_mm_vis (резервирани за exempt портфейли)
└─► 400,000 → Contract (за продажба/ликвидност)
```

### При Distribute:
```
DEV_WALLET_mm_vis (600,000):
├─► MARKETING: 150,000
├─► TEAM: 200,000
├─► ADVISOR: 150,000
└─► Остават: 100,000
```

### Exempt Addresses:
- **4 настроими слота** (exemptAddress1-4)
- Автоматични: owner, contract, router, factory

---

## 📚 Документация

Вижте `/docs/` за:
- **CHANGELOG_v3.4_BG.md** - Нови промени в v3.4 ⭐
- Пълна документация
- Технически детайли
- Deployment инструкции

---

## 🔄 v3.4 Промени

- ✅ Премахнат exemptAddress5
- ✅ 4 exempt slots вместо 5
- ✅ address[5] → address[4]

---

**Версия:** 3.4 FINAL  
**Статус:** ✅ Production Ready  
**Contract:** kcy1_token_v3.4_FINAL.sol
