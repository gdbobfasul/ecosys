# Release checklist — Pupikes Baby Radar (Huawei AppGallery)

- [ ] `npm install` минава без грешки.
- [ ] `npm run build` минава (големият TF.js chunk е очакван — lazy-load).
- [ ] `npm run gen:assets` генерира icon/splash PNG + SVG.
- [ ] App ID = `com.kcy.babymonitor.huawei` (capacitor.config.json).
- [ ] Акцент = праскова `#f0a35c` (styles.css, gen-assets.mjs, LocalNotifications iconColor).
- [ ] Камера работи в dev (уеб камера); състояние спи/размърда/събуди се се сменя реално.
- [ ] „Втори човек“ дава сигнал след зареждане на coco-ssd.
- [ ] „Излезе от кадър“ дава сигнал.
- [ ] Известие + звук при събитие; дневникът пише запис със снимка.
- [ ] Headless/без камера: „Старт“ не чупи приложението (честно съобщение).
- [ ] Предупреждението за безопасност е видимо на онбординга и на dashboard-а.
- [ ] data-safety.md съдържа предупреждението + „никакви данни не се събират/качват“.
- [ ] Без GMS/HMS/Firebase, без IAP, без контакти/проследяване.
- [ ] „Пожар“ евристиката е ИЗКЛЮЧЕНА по подразбиране и е етикетирана като груба.
- [ ] `android/ ios/ *.apk node_modules dist` са в .gitignore.
