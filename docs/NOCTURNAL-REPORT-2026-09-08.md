# Нощен отчет — 08.09.2026 (~04:20)

## 1. Huawei публикуване — ✅ 28/31 Reviewing (голям напредък)
**Подадени за ревю тази нощ:** rustam, fps-hunter, toolkitsound, dodge-master (+ 24-те отпреди = **28 Reviewing**).
**Работеща рецепта (вградена в бота + записана в паметта):** клик Submit → чети „Please check:" → попълни всяка точка → пак:
- **Категория (игри):** радио „Casual game" + жанр-каскадер „Games › Puzzle & casual › Puzzle" (in-page клик — беше в iframe).
- **Content rating:** въпросник по ключова дума (многовариантните frequency/bloody/against-humans). Без-насилие = всичко No (ботът сам). За игри с насилие → детайлни отговори в `scratchpad/rating-answers/*.json`.
- **Copyright + Filing + Publication number** = китайски лицензи (软著/ICP备案/版号) — искат се само при **Chinese Mainland**. Дефолтът „All countries" ги включва! Фикс: „Selected countries/regions" + изключи Chinese Mainland → изчезват.
- **Submit:** финалният бутон е „Release" → диалог „Confirm release information" → потвърди. Флаг `HW_JUST_SUBMIT=1` (без OT/Save междинни стъпки; OT тостовете са ШУМ). **НЕ** ползвай fillOpenTesting.

**⚠ 3 заседнали (chat, toolkitai, hmm):** дори чисто изтриване+пресъздаване удря OT/version-code стена („open testing version must be later than released"). За разлика от toolkitsound/dodge, чиито пакети минаха на първо създаване. Хипотеза: **package-level Huawei история** (com.pupikes.chat/toolkitai/hmm.hw пазят стар open-testing/version-code запис, който изтриването на приложението НЕ чисти). Не е автоматизируемо от клиента. Опции: (а) нов package suffix (chat2), (б) Huawei поддръжка/ръчно изчистване на тестовата версия, (в) приемане.
**Не създадени:** duel, plane-shooter (игри с насилие — искат keyword-рейтинга), houselookbook (0 скрийншота).

## 2. Деплой (точка 2) — ✅ prodts + vm INSTALL COMPLETE
- `take.offbitch.com/` → **HTTP 200** (главният домейн работи; крипто страницата е качена).
- Услуги вдигнати (faq :8092, scraper :3030, nginx маршрути).

## 3. ✅ pupikes.app → HTTP 200 (беше 404 регресия — ОПРАВЕНО)
- Диагноза: точка-2 деплоят (05-server-install) при nginx reload изпусна server_block-а на pupikes.app + съдържанието (/var/www/html/apk) беше празно (деплоят изключва apk/).
- **Оправих:** (1) пуснах `server/08-setup-domain.sh` на prodts → върна nginx блока + SSL сертификата (`pupikes.app → pupikesapp`, nginx -t + reload — безопасно, не пипна главния конфиг); (2) `sync-apps.sh prodts` → качи каталога + 43 файла (икони + всички APK) в /var/www/html/apk.
- **Проверено на живо:** `pupikes.app/`=200, `catalog.json`=200 (**42 приложения**), свалянията работят.

## 4. Крипто (Фаза Б) — ✅ готова
- **Pupikes Guard Coin (PGC)** деплойнат на bscTestnet: `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A`. Vault Guard активен. status/stats/advise живи.
- Портфейл в `private/configs/new-metatokens.conf` (seed вътре, gitignored). EVM `0x484784…8768`, BTC `bc1qdrp53c…`.
- Страница: `public/crypto/pupikes-guard-coin/` — вградена В БОТА (`generatePage()` + команда `page <id>`; `create()` я вика сама). ⚠ На живо е **403** (/crypto е admin-заключен). За публична страница трябва nginx изключение за `/crypto/pupikes-guard-coin/` — production nginx, флагвам за твое решение.

## 5. Нови токени — ✅ идеи (в `private/pupikes-metamask-coin-creator/NEW-TOKEN-IDEAS.md`)
5 уникални механики: **Sentinel** (наследяване/dead-man's switch), **Tide** (прогресивен анти-кит данък), **Streak** (лоялност-ескалатор), **Beacon** (milestone авто-burn), **Aegis+** (застраховка с претенции). Готови за имплементация — предложих да започна със Sentinel (надгражда Vault Guard).

---
### За теб сутринта — 2 решения:
1. **Крипто страница публична?** — сега е 403 (/crypto е admin-заключен). Ако искаш публична → nginx изключение само за `/crypto/pupikes-guard-coin/`.
2. **3-те заседнали Huawei** (chat/toolkitai/hmm) — package-level стена. Опции: нов package suffix (chat2), Huawei поддръжка, или приемане на 28/31. (+ duel/plane игри с насилие — искат keyword-рейтинга; мога да ги довърша.)

### Обобщение свършено тази нощ:
✅ Huawei 28/31 Reviewing (рецептата вградена в бота + паметта) · ✅ Деплой prodts+vm · ✅ pupikes.app възстановен (200, 42 апа) · ✅ Крипто Guard Coin (testnet) + страница + вградено в бота · ✅ 5 нови токен идеи.
