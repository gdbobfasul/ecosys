# faq-gateway — сървърен шлюз за Pupikes FAQ (WhatsApp / Messenger / Viber)

Бекенд, който приема съобщения от **официалните API-та** на трите канала и отговаря
вместо теб, като пуска входа през **същия** rule-engine като приложението
(`rustore/business-faq-bot`). Без LLM, без платени услуги за тест.

## Защо е нужен

WhatsApp/Messenger/Viber не позволяват автоматичен отговор „отвън" без официалния им
канал. Всичките три обаче имат **безплатно ниво за тест**:

| Канал | Безплатно за тест | Откъде |
|-------|-------------------|--------|
| WhatsApp | тестов номер + безплатни service разговори | developers.facebook.com → App → WhatsApp |
| Messenger | напълно безплатно | Facebook страница + App → Messenger |
| Viber | bot е безплатен | partners.viber.com → Public Account |

Всеки канал е **опционален** — попълваш само този, който ползваш.

## Инсталация

```bash
cd private/faq-gateway
cp .env.example .env      # попълни ADMIN_TOKEN + ключовете на каналите
npm test                  # 12 офлайн проверки
npm start                 # слуша на :8092 (или PORT)
```

Node 18+ (ползва глобален `fetch`). Без външни зависимости.

## Webhook адреси (задай ги в конзолата на всеки канал)

- WhatsApp:  `GET/POST  https://<домейн>/api/faq/webhook/whatsapp`  (Verify token = `WA_VERIFY_TOKEN`)
- Messenger: `GET/POST  https://<домейн>/api/faq/webhook/messenger` (Verify token = `MSGR_VERIFY_TOKEN`)
- Viber:     `POST      https://<домейн>/api/faq/webhook/viber`      (регистрирай с `set_webhook`)

## Админ (ползва ги приложението)

- `POST /kb`   Bearer ADMIN_TOKEN — публикува `{config, kb}` (бутон в екрана „Канали")
- `GET  /kb`   Bearer — чете текущата база
- `GET  /log`  Bearer — броячи + последните обработени съобщения
- `POST /reply` Bearer — тест: `{input}` → `{reply,kind}` (без реално изпращане)
- `GET  /health` — публично: активни канали + брой Q&A

## Деплой зад nginx

Реверс-прокси на `/api/faq/` към `127.0.0.1:8092`. HTTPS е задължителен (Meta/Viber
изискват валиден TLS за webhook). Пусни като systemd услуга (`node server.js`).

Отговорите идват от **един** rule-engine (`lib/`), огледало на `src/core/` в приложението,
затова сървърът отговаря точно както демо-чатът.
