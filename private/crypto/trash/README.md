# /private/crypto/trash — карантина за крипто (НЕ е активен код)

Тук са преместени крипто-свързаните **конфигурации, документации и тестове**, които
бяха изтекли в chat/eco-3, но **НЕ касаят** реалните проекти зад `/crypto`
(token, brch1, multisig — те остават недокоснати в `private/token`, `private/brch1`,
`private/multisig` и `public/crypto/`).

Пазим ги „за всеки случай" — нищо тук не се зарежда от приложенията.

## Какво има тук и откъде е дошло

- `docs/chat/`, `docs/mobile-chat/`, `private/chat/docs/`, `private/mobile-chat/docs/`
  — преместени `CRYPTO-PAYMENTS.md` и `README_CRYPTO.md` (крипто-payment документация на чата).
- `tests/chat/crypto-features.test.js` — цял тест за крипто плащания (преместен от `tests/chat/`).
- `config/chat-configs-config.crypto.js` — изваденият `CRYPTO_CONFIG` от
  `private/chat/configs/config.js` (treasury адреси, токен адреси, крипто цени, explorers, API ключове, BSC).
- `config/shared-config.crypto-wallets.js` — изваденият крипто-портфейлен блок (`TANGEM_WALLETS`,
  `TREASURY_WALLETS`, потвърждения) от `public/shared/js/config.js`. Фиат цените (USD/EUR, eco-3)
  ОСТАНАХА в оригинала под ново име `PRICING_CONFIG` (не са крипто).
- `html/chat-index-crypto-promo.html` — премахнатата крипто-реклама от `public/chat/index.html`.

## Бази данни
В базите крипто колоните (`crypto_wallet_*` в chat) са ИЗТРИТИ директно от схемата
(не са преместени тук — нямат смисъл без таблицата). Виж `docs/DATABASES-BY-PROJECT.md`.
