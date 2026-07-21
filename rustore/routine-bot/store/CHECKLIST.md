# Чеклист преди публикуване — RUStore

- [ ] `npm install` минава без грешки
- [ ] `npm run build` създава `dist/`
- [ ] `npm run gen:assets` създава икони/сплаш (или плейсхолдъри; за PNG: `npm i -D sharp`)
- [ ] App ID = `com.pupikes.routinebot.rustore` (capacitor.config.json)
- [ ] Версия в package.json вдигната
- [ ] Икона 512x512 и сплаш качени (store/icon-512.png, store/splash-1080x1920.png)
- [ ] Описание (LISTING.md) попълнено
- [ ] Декларация за данни според DATA-SAFETY.md: само на устройството, локация по избор
- [ ] Разрешения в манифеста: POST_NOTIFICATIONS; (по избор) ACCESS_COARSE/FINE_LOCATION
- [ ] Тествани двата сценария: с локация и с ръчен град
- [ ] Премиум е STUB (no-op) — без реални плащания/крипто
- [ ] Без GMS/HMS/Firebase, без аналитика, без контакти
- [ ] APK/AAB подписан с release ключ
