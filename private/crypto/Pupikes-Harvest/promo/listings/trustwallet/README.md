# Trust Wallet assets (HRVS)

Готови файлове по формата на хранилището `trustwallet/assets`:
`blockchains/smartchain/assets/0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A/`
- `info.json` — тук (адресът е в checksum формат, както го иска валидаторът)
- `logo.png` — тук (256×256 PNG, под 100 KB)

## Такса
**Има такса при превод: 2% към фонд-адреса (трезора), непроменима.** Казано е в `description` на info.json.
Trust Wallet няма отделен таг за „такса при превод“ — затова `tags` е пропуснат (не слагай неверен таг).

## Подаване
- Официалното подаване днес е през https://assets.trustwallet.com и е **платено** (невъзвратна такса) — не е безплатно листване.
  Решение на собственика; не е нужно за работата на токена.
- **Безплатно:** всеки потребител може да добави HRVS в Trust Wallet ръчно („Add custom token“ → Smart Chain →
  адрес `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A`, символ HRVS, decimals 18). Без лого, но работи.
- Когато има Telegram канал — добави в `links`: `{ "name": "telegram", "url": "https://t.me/<канал>" }`.
