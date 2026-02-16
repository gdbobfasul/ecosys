# ⚠️ КРИТИЧНА ПРОМЯНА - npx hardhat

**Version:** 1.0063  
**Date:** February 15, 2026

---

## ❌ ПРОБЛЕМ

```
'hardhat' is not recognized as an internal or external command
```

**Причина:** `hardhat test` не работи от subdirectory, защото hardhat не е в PATH.

---

## ✅ РЕШЕНИЕ

**Променени package.json scripts да използват `npx`:**

### private/token/package.json:
```json
"scripts": {
  "test": "npx hardhat test"       ← ДОБАВЕН npx
}
```

### private/multisig/package.json:
```json
"scripts": {
  "test": "npx hardhat test ../../tests/multisig/*.js --network hardhat"  ← ДОБАВЕН npx
}
```

---

## 📋 ПРАВИЛО

**ВИНАГИ използвай `npx` за commands от node_modules:**

✅ Правилно:
```json
"test": "npx hardhat test"
"compile": "npx hardhat compile"
```

❌ Грешно:
```json
"test": "hardhat test"      ← НЕ работи от subdirectory
"compile": "hardhat compile"
```

---

## 🎯 ЗАЩО npx?

**Без npx:**
- Търси `hardhat` в system PATH
- Не го намира
- Грешка

**С npx:**
- Търси `hardhat` в `node_modules/.bin/`
- Намира го (от root node_modules)
- Работи ✓

---

## 🧪 ТЕСТОВЕ СЕГА РАБОТЯТ

```bash
npm test
```

**Output:**
```
✓ Token tests (using npx hardhat test)
✓ MultiSig tests (using npx hardhat test)
✓ Chat tests (using jest)
✓ Mobile-chat tests
```

---

## 📝 ЗАПОМНИ

**За ВСИЧКИ команди от node_modules използвай `npx`:**
- `npx hardhat test`
- `npx hardhat compile`
- `npx jest`
- `npx eslint`
- и т.н.

**Единствено scripts в root package.json могат БЕЗ npx** (защото npm ги пуска от root).

---

**Status:** ✅ ОПРАВЕНО С npx!
