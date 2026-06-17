# Бизнес FAQ робот — Huawei AppGallery build

Self-contained мобилно приложение „robot for rent": малък бизнес **наема/активира** робот,
който отговаря автоматично на честите въпроси на клиентите **по правила (ключови думи)** —
**без платен LLM, без акаунти, без контакти, без проследяване**. Vanilla JS + Vite 5 +
Capacitor 6. Без GMS/HMS/Firebase.

> Близнак: `rustore/business-faq-bot` (различава се само по app id, акцент и store документи).
> Двете приложения са независими — без споделени файлове/импорти.

## Стартиране и тест в браузъра
```bash
npm install
npm run dev      # http://localhost:5192
```
Поток: **Активирай робота → Разрешения → База знания → Демо чат**. Виж `store/TESTING.md`.

## Билд
```bash
npm run build            # → dist/
npm run gen:assets       # икона/сплаш PNG от акцента (#d92b2b)
npm run cap:add          # само на машина с Android SDK
npm run cap:sync
```

### APK + SDK caveat
Тази dev среда **няма Android SDK/JDK** — затова **не се прави APK тук**. `npm run build` и
`gen:assets` работят без SDK. APK се билдва на машина с Android toolchain (опция 38). Няма
Gradle стъпки в това репо.

## Архитектура
```
index.html
src/
  main.js                  # hash рутер + долна навигация
  core/
    rule-engine.js         # keyword → answer, иначе fallback (нормализация + scoring)
    office-hours.js        # 24/7 или работно време (вкл. интервал през полунощ)
    respond.js             # rule-engine + office-hours + лог + броячи
    channel-adapter.js     # local (работи) + whatsapp/viber/messenger STUB-ове
    storage.js             # localStorage (seed KB), без мрежа
    notifier.js            # Capacitor Local Notifications / toast fallback
  screens/
    onboarding.js          # „наеми робота" + Premium STUB
    permissions.js         # само известия; явно какво НЕ правим
    kb-config.js           # Q&A CRUD + поздрав/fallback/ескалация + бързи бутони + работно време
    channels.js            # честен статус на месинджърите
    dashboard.js           # ON/OFF, тест конзола, дневник, броячи
    demo-chat.js           # вграден чат (тест на правилата)
  store/huawei-sdk.js      # store-IAP STUB (no-op, без HMS)
  ui/{dom.js,styles.css}
tools/gen-assets.mjs       # генерира PNG икони/сплаш (без външни зависимости)
store/                     # icon.svg, splash.svg, LISTING/TESTING/CHECKLIST, data-safety, messaging-policy
native-plugin/README.md    # Kotlin NotificationListenerService план (TODO)
```

## Rule engine (накратко)
Входът се нормализира (lowercase, без диакритика/пунктуация). За всеки активен Q&A запис се
броят съвпаденията на ключови фрази, претеглени с дължината им (по-дълга фраза = по-специфично
→ по-висок приоритет). Печели записът с най-висок резултат; при нула съвпадения → резервен
отговор + ескалация. Извън работно време → away съобщение.

## Messaging реалност (ЧЕСТНО)
- **Работи сега:** канал `local` (демо чат), изцяло on-device, тестваем в браузъра.
- **Изисква native:** WhatsApp/Viber/Messenger чрез `NotificationListenerService` +
  direct-reply и системно разрешение **Notification access** (native Kotlin плъгин — виж
  `native-plugin/README.md`). В приложението статусът е „pending native"; **не** фалшифицираме
  изпращане.
- **Извън обхвата:** официалните сървърни bot API-та (сървър/ключове). Виж
  `store/messaging-policy.md`.

## Поверителност
Без контакти, без акаунти, без локация, без проследяване, без GMS/HMS/Firebase. Базата знания
е само на устройството. Единствено разрешение: Известия.
