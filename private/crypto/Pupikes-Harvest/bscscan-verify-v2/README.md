# Проверка на Pupikes Harvest (HRVS) в BscScan

Форма (безплатно, без портфейл): https://bscscan.com/verifyContract?a=0xa4e4993ED63f7fE0B19D3350fB11cf43b198F2A8
1. Compiler Type: Solidity (Standard-Json-Input)
2. Compiler Version: v0.8.28+commit.7893614a
3. Качи: standard-json-input.json (от тази папка)
4. Constructor Arguments (ако поиска): съдържанието на constructor-args.txt (без 0x)
5. Contract Name (ако поиска): token/contracts/PupikesFeatureTokenV2.sol:PupikesFeatureTokenV2
6. Verify and Publish.

Автоматично: node bot.js verifybsc harvest2 --browser   (попълва формата) · добави --submit за финалния бутон.
Optimizer: {"enabled":true,"runs":1} · viaIR: true
Sourcify (безплатно, exact match): https://repo.sourcify.dev/56/0xa4e4993ED63f7fE0B19D3350fB11cf43b198F2A8