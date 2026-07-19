// Автогенериран от build-mobile-apps.sh от publish/monetization.json — НЕ редактирай ръчно.
// Редактира се huawei/kcy-toolkit-scraper/publish/monetization.json.
export const MONETIZATION = {
  "_comment": "МОНЕТИЗАЦИЯ на приложението — редактира се САМО ТУК (huawei/<ап>/publish). Билдът я вгражда в src/monetize.js и поведението на приложението Я СЛЕДВА. model: free (безплатно) | one_time (еднократна такса при сваляне) | subscription (месечен абонамент) | iap (плащания вътре в приложението). released: true = приложението ИМА релийз в магазин -> НИКАКВО пробно заключване, каквото и да пише в trialLock. trialLock: 4-дневното пробно заключване с парола (САМО за тестване преди издаване).",
  "model": "free",
  "released": false,
  "trialLock": {
    "enabled": true,
    "days": 4
  }
}
;
