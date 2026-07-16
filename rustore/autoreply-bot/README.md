# KCY Auto Answer — RUStore Edition

„Робот под наем", който автоматично отговаря на съобщения по твои правила — **изцяло на устройството**.

## Защо sandbox чат?
Android **не позволява** на трети приложения да автоматизират системните SMS или чужди
месинджъри. Затова роботът работи в **собствен симулиран чат (Demo Inbox)** вътре в
приложението — там виждаш и тестваш как би отговарял. Без интернет, без контакти,
без достъп до SMS, без акаунти, без проследяване.

## Стартиране в браузъра (без Android SDK)
```bash
npm install
npm run dev      # отваря на http://localhost:5181
```

Поток: **Наеми/Активирай → Правила → (Права) → Табло (ON) → Demo Inbox (тествай)**.

## Билд
```bash
npm run build            # → dist/
node tools/gen-assets.mjs   # → store/icon.svg, store/splash.svg
```

## Нативен APK/AAB (изисква Android SDK + JDK — НЕ в тази среда)
```bash
npx cap add android      # еднократно
npx cap sync android     # копира dist + плъгини
# после: Android Studio → подписан AAB/APK
```
> ⚠️ Тази среда няма Android SDK/JDK/gradle, затова APK не се генерира тук. Кодът и
> Capacitor конфигурацията са готови за билд на машина със SDK.

## Структура
- `src/core/` — `rule-engine`, `scheduler` (office-hours), `storage`, `notifier`.
- `src/screens/` — `onboarding`, `rules-config`, `permissions`, `dashboard`, `demo-inbox`.
- `src/store/rustore-sdk.js` — STUB за „Premium наем" (no-op, без реално плащане).
- `src/ui/` — стилове + DOM помощници.
- `tools/gen-assets.mjs` — генерира икона/splash (синя тема).
- `store/` — LISTING, TESTING, CHECKLIST, DATA-SAFETY + SVG активи.

## Поверителност
Виж `store/DATA-SAFETY.md`. Накратко: нула събрани данни, нула мрежа.
