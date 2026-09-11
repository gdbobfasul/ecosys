# Ръчна проверка на HRVS в BscScan (Verify & Publish)

1. Отвори https://bscscan.com/verifyContract?a=0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A
2. Compiler Type: **Solidity (Standard-Json-Input)**
3. Compiler Version: **v0.8.28+commit.7893614a**
4. License: MIT (или както е в .sol)
5. Continue → качи файла **standard-json-input.json** от тази папка
6. Constructor Arguments ABI-encoded: постави съдържанието на **constructor-args.txt** (без 0x)
7. Contract name (ако пита): **token/contracts/PupikesFeatureToken.sol:PupikesFeatureToken**
8. Потвърди капчата → Verify and Publish.

Кодът вече е проверен в Sourcify (exact match): https://repo.sourcify.dev/56/0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A
