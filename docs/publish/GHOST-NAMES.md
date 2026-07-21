# „Призрачни" имена — кандидати за нова марка (замяна на „KCY")

_Жив документ. Породен от лова на 2026-07-20. Суровият доклад с пълния журнал (кой кандидат
защо е отпаднал, 72 проверени) е в `private/app-publisher-bot/name-checks/GHOST-NAMES-5-10.md`;
инструментът е `private/app-publisher-bot/ghost-names.cjs` (пуска се:
`node private/app-publisher-bot/ghost-names.cjs 5-10 30`)._

## Как е проверено всяко име

Име влиза в списъка САМО ако мине всичко изброено с НУЛА находки:

1. **Браузърна обиколка на 14 търсачки** (методът на питонския скрипт `scrap1`, с директни
   адреси на търсенето): Google, Bing, DuckDuckGo, Yahoo, Ecosia, Startpage, Brave, Mojeek,
   Ask, Yep, Dogpile, Metacrawler, Swisscows, Gibiru — 0 резултата, чийто видим текст
   съдържа думата;
2. **Домейни** .com/.net/.org/.io/.app — всички СВОБОДНИ (авторитетно през RDAP регистрите);
3. **Търговски марки** — TMview (ЕС/Китай/Русия/България/САЩ + 70 ведомства): 0 марки;
4. **Магазини** — Apple App Store (САЩ+Китай), Google Play, Huawei AppGallery: 0 приложения;
5. **Преглед от изкуствен интелект (Claude)** — по знание: думи на 15+ езика, лекарствени
   корени, близки марки; + независимо уеб търсене за челните кандидати.

**Урокът „Febumifan":** генерираното име Febumifan мина ВСИЧКИ търсачки (0 резултата), но се
оказа търговско име на лекарството фебуксостат — видя го само изкуственият интелект на
Google. Затова стъпка 5 е задължителна, а Febumifan е в черния списък на генератора.

## Таблица на всичките 30 (семе 20260720 — възпроизводимо)

| # | Име | Букви | Машинни проверки | Преценка на AI | Статус |
|---|-----|:---:|---|---|---|
| 1 | **Povokeze** | 8 | ✅ всичко чисто | чисто; удобно като префикс („Povokeze Toolkit PDF") | 🥇 препоръчано |
| 2 | **Zofapifu** | 8 | ✅ | чисто (далечен съсед: измисленият град Zaofu от „Avatar" — без връзка) | 🥇 препоръчано |
| 3 | **Mozupifure** | 10 | ✅ | чисто | 🥇 препоръчано |
| 4 | **Tavumimemo** | 10 | ✅ | чисто (далечен фонетичен съсед: японското приложение Tabimemo) | 🥇 препоръчано |
| 5 | **Pipasademu** | 10 | ✅ | чисто („pipas"=семки на испански — едва доловимо) | 🥇 препоръчано |
| 6 | **Bugideviba** | 10 | ✅ | чисто | 🥇 препоръчано |
| 7 | **Nakafofesa** | 10 | ✅ | чисто | 🥇 препоръчано |
| 8 | **Betunapu** | 8 | ✅ | чисто („betún"=вакса на испански — едва доловимо) | 🥇 препоръчано |
| 9 | Retitelia | 9 | ✅ | лат. „retitela"=паяжина — благозвучно, лек привкус | ⚠️ става |
| 10 | Lomevisefa | 10 | ✅ | чисто (съсед: фирмата Lomefa — различимо) | ⚠️ става |
| 11 | Sunulape | 8 | ✅ | лит. „lapė"=лисица | ⚠️ става |
| 12 | Kibefue | 7 | ✅ | „kibe"=бразилско ястие; „fue"=исп. „беше" | ⚠️ става |
| 13 | Rekopalak | 9 | ✅ | хинди „palak"=спанак | ⚠️ става |
| 14 | Pupikes | 7 | ✅ | идиш/чеш. „pupik"=пъп — звучи смешно | ⚠️ става |
| 15 | Dafaripol | 9 | ✅ | окончанието „-ol" звучи аптечно | ⚠️ става |
| 16 | Tavosulu | 8 | ✅ | тур. „sulu"=воден | ⚠️ става |
| 17 | Timomefem | 9 | ✅ | „timo-"/„-mef-" — аптечни корени | ⚠️ става |
| 18 | Rasosebat | 9 | ✅ | малайски „sebat" | ⚠️ става |
| 19 | Suvupoti | 8 | ✅ | Поти е грузински град | ⚠️ става |
| 20 | Gazinepir | 9 | ✅ | аптечен привкус („-pir"); тур. „gazi" | ⚠️ става |
| 21 | Birokaloi | 9 | ✅ | „Biro" е марка химикалки | ⚠️ става |
| 22 | Raganififu | 10 | ✅ | лит./латв. „ragana"=вещица | ⚠️ става |
| 23 | Kogelafime | 10 | ✅ | нидерл. „kogel"=куршум | ⚠️ става |
| 24 | Lagizokam | 9 | ✅ | близко до крема „Lagicam" | ⚠️ внимание |
| 25 | Sulagunu | 8 | ✅ | близко до сиренето „сулгуни" | ⚠️ внимание |
| 26 | Lonolabive | 10 | ✅ | започва като марката LonoLife | ⚠️ внимание |
| 27 | Musumesipe | 10 | ✅ | „musume"=дъщеря на ЯПОНСКИ — реална дума | ❌ отпада |
| 28 | Vikagusama | 10 | ✅ | „-sama"=японско учтиво обръщение | ❌ отпада |
| 29 | Domobureki | 10 | ✅ | звучи като японска фраза („домо"+„бурэки"=спирачка) | ❌ отпада |
| 30 | Romakatal | 9 | ✅ | „Roma" + „katal" (истинска SI единица) | ❌ отпада |
| — | ~~Febumifan~~ | 9 | ✅ (!) | ЛЕКАРСТВО (фебуксостат) — хвана го само AI | ⛔ черен списък |

## Препоръка

За наследник на „KCY" (кратко, чисто, звучно, работи като префикс на семейство приложения):
**Povokeze** или **Zofapifu**. Изборът е на собственика; преди окончателното решение
избраното име минава още една свръхзадълбочена проверка (всички 49 домейнови разширения +
марки по класове + повторна обиколка).

_След избор: смяната на марката се нанася по реда, описан в
`private/app-publisher-bot/name-checks/ALL-APPS-NAME-TABLE.md` (къде живее името) — но за
ЦЯЛАТА екосистема (KCY → новото име) това е отделна голяма операция със собствен план._


---

# Партида 1 — 5–10 букви (сийд 20260720): 30 имена

# „Призрачни" имена от 5-10 букви — нула следи в интернет

_Проверени 72 произносими кандидата (гласни+съгласни, без двойни букви). Всяко име по-долу мина: браузърна обиколка на 14 търсачки (Google, Bing, DuckDuckGo, Yahoo, Ecosia, Startpage, Brave, Mojeek, Ask, Yep, Dogpile, Metacrawler, Swisscows, Gibiru — методът на питонския скрипт scrap1) = 0 находки; домейни .com/.net/.org/.io/.app СВОБОДНИ (авторитетно RDAP); TMview марки = 0; App Store (US+CN) = 0; Google Play = 0; AppGallery = 0. Семе на генератора: 20260720 (възпроизводимо)._

## Намерени: 30

1. **Tavumimemo**
2. **Rekopalak**
3. **Musumesipe**
4. **Retitelia**
5. **Lomevisefa**
6. **Sunulape**
7. **Kibefue**
8. **Lonolabive**
9. **Pupikes**
10. **Dafaripol**
11. **Pipasademu**
12. **Tavosulu**
13. **Mozupifure**
14. **Timomefem**
15. **Bugideviba**
16. **Betunapu**
17. **Zofapifu**
18. **Rasosebat**
19. **Vikagusama**
20. **Suvupoti**
21. **Romakatal**
22. **Povokeze**
23. **Gazinepir**
24. **Birokaloi**
25. **Raganififu**
26. **Kogelafime**
27. **Lagizokam**
28. **Nakafofesa**
29. **Domobureki**
30. **Sulagunu**

## Здраве на търсачките (реално работещи в тази обиколка)

| Търсачка | потвърдила 0 | намерила находки | недостъпна |
|---|---|---|---|
| Google | 2 | 1 | 37 |
| Bing | 39 | 0 | 0 |
| DuckDuckGo | 30 | 9 | 0 |
| Yahoo | 30 | 0 | 0 |
| Ecosia | 0 | 0 | 30 |
| Startpage | 0 | 0 | 30 |
| Brave | 1 | 0 | 29 |
| Mojeek | 30 | 0 | 0 |
| Ask | 30 | 0 | 0 |
| Yep | 30 | 0 | 0 |
| Dogpile | 30 | 0 | 0 |
| Metacrawler | 30 | 0 | 0 |
| Swisscows | 30 | 0 | 0 |
| Gibiru | 29 | 0 | 1 |

## ФИНАЛ (виж по-горе)

## Финален преглед от изкуствен интелект (Claude) — урокът „Febumifan"

Търсачките имат сляпо петно (Febumifan е реално лекарство, невидимо за тях), затова всяко име мина и през преглед по знание + независимо уеб търсене. Класация:

### 🥇 Напълно чисти (препоръчани за замяна на „KCY")
| Име | букви | бележка |
|---|---|---|
| **Povokeze** | 8 | нула съвпадения и фонетично чисто |
| **Zofapifu** | 8 | чисто (далечен съсед: измисленият град Zaofu от „Avatar" — без връзка) |
| **Mozupifure** | 10 | чисто |
| **Tavumimemo** | 10 | чисто (далечен съсед: японското приложение Tabimemo) |
| **Pipasademu** | 10 | чисто („pipas" е „семки" на испански — едва доловимо) |
| **Bugideviba** | 10 | чисто |
| **Nakafofesa** | 10 | чисто |
| **Betunapu** | 8 | чисто („betún" е „вакса" на испански — едва доловимо) |
| **Zofapifu / Povokeze** | — | най-удобните като ПРЕФИКС на семейство („Povokeze Toolkit PDF") |

### ⚠️ Леки забележки (звучат като дума на някой език / близка марка)
Retitelia (лат. retitela=паяжина), Sunulape (лит. lapė=лисица), Kibefue (браз. ястие kibe), Rekopalak (хинди palak=спанак), Pupikes (идиш pupik=пъп), Dafaripol/Gazinepir/Timomefem (аптечен привкус), Tavosulu (тур. sulu=воден), Suvupoti (Поти=грузински град), Rasosebat (малайски sebat), Birokaloi (Biro=марка химикалки), Kogelafime (нидерл. kogel=куршум), Lagizokam (близко до крема Lagicam), Sulagunu (близко до сиренето сулгуни), Lonolabive (започва като марката LonoLife), Zofapifu—чисто.

### ❌ Отпадат по preценка
Musumesipe (musume=дъщеря на японски), Vikagusama (-sama=японско обръщение), Domobureki (звучи като японска фраза „домо + спирачка"), Romakatal (Roma + katal=SI единица).

Черен списък (човешки улов): Febumifan = лекарство фебуксостат (хвана го Google AI, не търсачките).

## Журнал на проверката (какво отпадна и защо)

| Име | Резултат |
|---|---|
| Tavumimemo | ✅ ПРИЗРАК — 0 находки (9 търсачки потвърдиха + домейни + марки + магазини) |
| Ritize | ✗ DuckDuckGo: 13 находки (www.facebook.com|https://www.facebook.com › Ritize www.facebook.com|Ritize - Facebook www.youtube.com|Ritize - DoorKnob Sanitization - YouTube) |
| Rekopalak | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Musumesipe | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Retitelia | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Lomevisefa | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Sunulape | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Kibefue | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Lufoli | ✗ DuckDuckGo: 20 находки (www.instagram.com|https://www.instagram.com › lufoli www.instagram.com|LUFOLI (@lufoli) • Instagram photos and  1krecordings.bandcamp.com|https://1krecordings.bandcamp.com › trac) |
| Lonolabive | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Pupikes | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Dafaripol | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Bidupa | ✗ DuckDuckGo: 15 находки (www.facebook.com|https://www.facebook.com › bidupa.bidcor www.facebook.com|Bidupa Bidcor - Facebook www.facebook.com|https://www.facebook.com › bidupa.dehuri) |
| Pipasademu | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Nigovo | ✗ Google: 5 находки (www.lookandlearn.com|Maluangu the Ndoki belonging to NigovoLo commons.wikimedia.org|File:Maluangu the Ndoki belonging to Nig 999.md|Nigovo - профиль пользователя на 999.md9) |
| Munapis | ✗ DuckDuckGo: 10 находки (www.instagram.com|Munapis Khan (@mnuapis_khan) • Instagram www.facebook.com|Munapis Khan - Facebook www.instagram.com|Munapis Khan (@mnuapis_khan_85340) • Ins) |
| Tavosulu | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Mozupifure | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Timomefem | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Bugideviba | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Betunapu | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Zofapifu | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Rasosebat | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Vikagusama | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Suvupoti | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Siviru | ✗ DuckDuckGo: 8 находки (www.trip.com|https://www.trip.com › travel-guide › de www.trip.com|Siviru Travel Guide 2026: Top Attraction us.trip.com|https://us.trip.com › travel-guide › des) |
| Boditia | ✗ DuckDuckGo: 2 находки (mx.pinterest.com|https://mx.pinterest.com › kittengarden  mx.pinterest.com|32 Boditia pics ideas | fotografia boda,) |
| Romakatal | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Povokeze | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Gazinepir | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Birokaloi | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Ziniru | ✗ DuckDuckGo: 8 находки (www.tiktok.com|https://www.tiktok.com › @ziniru.yabre › www.tiktok.com|ZINIRU Yabre (@ziniru.yabre)'s videos wi www.youtube.com|https://www.youtube.com › @ZINIRuNAA) |
| Raganififu | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Sebevo | ✗ DuckDuckGo: 10 находки (www.instagram.com|https://www.instagram.com › sesebevo www.instagram.com|s sebevo (@sesebevo) • Instagram photos  www.facebook.com|https://www.facebook.com › sebevo.evo) |
| Kogelafime | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Lagizokam | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Nakafofesa | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |
| Domobureki | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Timugo | ✗ DuckDuckGo: 14 находки (www.instagram.com|https://www.instagram.com › timugo www.instagram.com|Víctor Aguilar (@timugo) • Instagram pho apkpure.com|https://apkpure.com › timugo-barberia-y-) |
| Sulagunu | ✅ ПРИЗРАК — 0 находки (10 търсачки потвърдиха + домейни + марки + магазини) |


---

# Партида 2 — 5–10 букви (сийд 20260721): 100 имена

# „Призрачни" имена от 5-10 букви — нула следи в интернет

_Проверени 192 произносими кандидата (гласни+съгласни, без двойни букви). Всяко име по-долу мина: браузърна обиколка на 14 търсачки (Google, Bing, DuckDuckGo, Yahoo, Ecosia, Startpage, Brave, Mojeek, Ask, Yep, Dogpile, Metacrawler, Swisscows, Gibiru — методът на питонския скрипт scrap1) = 0 находки; домейни .com/.net/.org/.io/.app СВОБОДНИ (авторитетно RDAP); TMview марки = 0; App Store (US+CN) = 0; Google Play = 0; AppGallery = 0. Семе на генератора: 20260721 (възпроизводимо)._

## Намерени: 100

1. **Kokelidus**
2. **Fivizut**
3. **Kobinuke**
4. **Pavebemia**
5. **Tosetit**
6. **Nekupotom**
7. **Vafedakir**
8. **Gogukulefa**
9. **Fitezatoda**
10. **Feladofum**
11. **Vibabamute**
12. **Mibesadozi**
13. **Finubine**
14. **Pamasoviga**
15. **Logedupuno**
16. **Fimagosibo**
17. **Vukupos**
18. **Mizineza**
19. **Rutuvau**
20. **Mopotozolo**
21. **Gebomeni**
22. **Kotepuvutu**
23. **Kilupuvizu**
24. **Sadusoten**
25. **Tusikobati**
26. **Zilopon**
27. **Nafetuza**
28. **Vufemedum**
29. **Gabelelen**
30. **Pamatoderi**
31. **Gidozope**
32. **Fozosit**
33. **Zudeturi**
34. **Pareguki**
35. **Lupatodoro**
36. **Tisoluralo**
37. **Puluruki**
38. **Bezupulie**
39. **Lelibuguma**
40. **Babetonak**
41. **Vaporutoso**
42. **Rorudine**
43. **Revatufuso**
44. **Libikogil**
45. **Likugapeto**
46. **Ziverara**
47. **Fipifim**
48. **Dugavekete**
49. **Monofodus**
50. **Kegevai**
51. **Noduzofa**
52. **Zumugevas**
53. **Zitokemele**
54. **Lifalubode**
55. **Rifudunat**
56. **Fezofurur**
57. **Sifudulane**
58. **Zokoset**
59. **Vosidu**
60. **Fimiretazo**
61. **Fezinuze**
62. **Meluzitabi**
63. **Dufarega**
64. **Kodarife**
65. **Rusebom**
66. **Mezukafak**
67. **Vodegizu**
68. **Gerimofis**
69. **Gepopavuri**
70. **Tazoredigo**
71. **Zotafifar**
72. **Lekukepova**
73. **Zonomipos**
74. **Nekepivu**
75. **Fizafau**
76. **Mifiselu**
77. **Mevofamuti**
78. **Pimaseka**
79. **Nazevitave**
80. **Vusuzosem**
81. **Nevalemesa**
82. **Rupebunamo**
83. **Fogefupobu**
84. **Vadamepova**
85. **Redeneraza**
86. **Galonedo**
87. **Rutelafote**
88. **Dinotezi**
89. **Zivepem**
90. **Nuzegigise**
91. **Rirafonu**
92. **Zukerubo**
93. **Tomisuso**
94. **Vemifofo**
95. **Sazokida**
96. **Sezezila**
97. **Sunotoral**
98. **Setapegi**
99. **Kenevatolu**
100. **Sarizopi**

## Здраве на търсачките (реално работещи в тази обиколка)

| Търсачка | потвърдила 0 | намерила находки | недостъпна |
|---|---|---|---|
| Google | 0 | 0 | 50 |
| Bing | 50 | 0 | 0 |
| DuckDuckGo | 14 | 36 | 0 |
| Yahoo | 14 | 0 | 0 |
| Ecosia | 0 | 0 | 14 |
| Startpage | 14 | 0 | 0 |
| Brave | 6 | 0 | 8 |
| Mojeek | 14 | 0 | 0 |
| Ask | 14 | 0 | 0 |
| Yep | 14 | 0 | 0 |
| Dogpile | 14 | 0 | 0 |
| Metacrawler | 14 | 0 | 0 |
| Swisscows | 14 | 0 | 0 |
| Gibiru | 14 | 0 | 0 |

## Журнал на проверката (какво отпадна и защо)

| Име | Резултат |
|---|---|
| Rotazik | ✗ DuckDuckGo: 4 находки (www.realmeye.com|https://www.realmeye.com › guild-history www.realmeye.com|Guild History of the RotMG Player: ROTAZ www.realmeye.com|https://www.realmeye.com › name-history-) |
| Fatiket | ✗ DuckDuckGo: 12 находки (www.facebook.com|https://www.facebook.com › fatiket.fati www.facebook.com|Fatiket Fati - Facebook www.facebook.com|https://www.facebook.com › fatiket.naik.) |
| Lugetuto | ✗ DuckDuckGo: 4 находки (www.spanishdict.com|https://www.spanishdict.com › translate  www.spanishdict.com|Lugetuto | Spanish Translator www.ingles.com|https://www.ingles.com › traductor › lug) |
| Safazet | ✗ DuckDuckGo: 2 находки (www.facebook.com|https://www.facebook.com › safazethossin www.facebook.com|Safazet Hossin Sabbir - Facebook) |
| Banareru | ✗ DuckDuckGo: 1 находки (mazii.net|banareru Meaning In Japanese - Mazii) |
| Vulepai | ✗ DuckDuckGo: 1 находки (www.youtube.com|najar ma najar judepaxi timimai yo jyann) |
| Mulifu | ✗ DuckDuckGo: 9 находки (www.facebook.com|Mulifu - Facebook www.youtube.com|https://www.youtube.com › @mulifu www.youtube.com|mulifu - YouTube) |
| Dudelur | ✗ DuckDuckGo: 1 находки (www.tumblr.com|Dudelur (@middlepeep) on Tumblr) |
| Tesatu | ✗ DuckDuckGo: 14 находки (www.facebook.com|https://www.facebook.com › tesatu.tesatu www.facebook.com|Tesatu - Facebook apkpure.com|https://apkpure.com › tesatu-kdusan-ትሽዓተ) |
| Lozifu | ✗ DuckDuckGo: 1 находки (www.tiktok.com|Replying to @angelbae652 Angelina #creat) |
| Zapodel | ✗ DuckDuckGo: 12 находки (www.allbiz.com|https://www.allbiz.com › business › zapo www.allbiz.com|Zapodel Inc | (303) 997-8637 | Broomfiel www.bizapedia.com|https://www.bizapedia.com › ca › zapodel) |
| Zoperi | ✗ DuckDuckGo: 11 находки (www.youtube.com|https://www.youtube.com › @zoperi4549 www.youtube.com|Zoperi - YouTube www.instagram.com|https://www.instagram.com › zoperi) |
| Palikor | ✗ DuckDuckGo: 15 находки (www.tagalog.com|https://www.tagalog.com › dictionary › r www.tagalog.com|Root: Palikor | Filipino / Tagalog Root www.tagalog.com|https://www.tagalog.com › dictionary › p) |
| Tizaze | ✗ DuckDuckGo: 12 находки (www.facebook.com|https://www.facebook.com › people › Tade www.facebook.com|Tadele Tizaze - Facebook www.facebook.com|https://www.facebook.com › tamasgen.tiza) |
| Ganezi | ✗ DuckDuckGo: 13 находки (www.facebook.com|https://www.facebook.com › carol.ganezi www.facebook.com|Carol Ganezi (@carol.ganezi) • Facebook, www.facebook.com|https://www.facebook.com › ganezi.ganezi) |
| Vurulo | ✗ DuckDuckGo: 12 находки (www.youtube.com|ma vurulo adalu #music #song #love - You www.youtube.com|vurulo 2 crores appu unnandhi #comedy -  www.instagram.com|https://www.instagram.com › vurulo_kabar) |
| Guzole | ✗ DuckDuckGo: 11 находки (www.facebook.com|https://www.facebook.com › sliman.guzole www.facebook.com|Sliman Guzole - Facebook humanities.uct.ac.za|https://humanities.uct.ac.za › departmen) |
| Rarepu | ✗ DuckDuckGo: 10 находки (www.tiktok.com|https://www.tiktok.com › tag › rarepu www.tiktok.com|#rarepu - TikTok www.facebook.com|Rarepu - Facebook) |
| Sazepu | ✗ DuckDuckGo: 2 находки (www.tiktok.com|https://www.tiktok.com › @sazepu www.tiktok.com|‏sazepu (@sazepu) | TikTok) |
| Rofefi | ✗ DuckDuckGo: 4 находки (www.facebook.com|https://www.facebook.com › rofefi.yisefe www.facebook.com|Rofefi Yisefe - Facebook www.facebook.com|https://www.facebook.com › rofefi.ramino) |
| Nideso | ✗ DuckDuckGo: 12 находки (www.instagram.com|https://www.instagram.com › nideso www.instagram.com|Nides Oliveira (@nideso) • Instagram pho www.facebook.com|https://www.facebook.com › nideso.nobadi) |
| Diruvi | ✗ DuckDuckGo: 10 находки (www.tiktok.com|https://www.tiktok.com › tag › diruvi www.tiktok.com|#diruvi Hashtag Videos on TikTok www.instagram.com|https://www.instagram.com › diruvi) |
| Sukunobe | ✗ DuckDuckGo: 6 находки (www.getamap.net|https://www.getamap.net › maps › japan › www.getamap.net|Sukunobe Saki (Sukunobesaki) Map, Weathe www.islamicfinder.org|https://www.islamicfinder.org › world › ) |
| Vofasia | ✗ DuckDuckGo: 6 находки (vofasia.blogspot.com|https://vofasia.blogspot.com vofasia.blogspot.com|vofasia.blogspot.com - Voice Of Asia vofasia.blogspot.com|https://vofasia.blogspot.com › 2021 › 02) |
| Fedudos | ✗ DuckDuckGo: 2 находки (www.tiktok.com|https://www.tiktok.com › tag › fedudos www.tiktok.com|#fedudos - TikTok) |
| Zugula | ✗ DuckDuckGo: 14 находки (www.mylife.com|https://www.mylife.com › marlin-zugula › www.mylife.com|Marlin L Zugula, 49 - Cedar Lake, IN - H www.facebook.com|https://www.facebook.com › desmond.zugul) |
| Tolusot | ✗ DuckDuckGo: 2 находки (myhealthbox.eu|https://myhealthbox.eu › en › tolusot-hu myhealthbox.eu|Tolusot | myHealthbox) |
| Lolaguk | ✗ DuckDuckGo: 2 находки (www.instagram.com|https://www.instagram.com › lolaguk www.instagram.com|Ольга Жук (@lolaguk) • Instagram photos ) |
| Kugolima | ✗ DuckDuckGo: 1 находки (www.facebook.com|4 people needed kusasa nga 6 ekseni for ) |
| Modorel | ✗ DuckDuckGo: 11 находки (www.instagram.com|https://www.instagram.com › modorel_bout www.instagram.com|Modorel (@modorel_boutique) • Instagram  www.pinterest.com|https://www.pinterest.com › modorelbouti) |
| Nuripei | ✗ DuckDuckGo: 2 находки (uk.pinterest.com|https://uk.pinterest.com › nuripei uk.pinterest.com|Nuri Pei (nuripei) - Profile | Pinterest) |
| Zakutu | ✗ DuckDuckGo: 11 находки (www.worldhistory.org|https://www.worldhistory.org › Zakutu www.worldhistory.org|Zakutu - World History Encyclopedia zakutu.nl|https://zakutu.nl › en › home) |
| Fisirek | ✗ DuckDuckGo: 5 находки (www.instagram.com|https://www.instagram.com › fisirek www.instagram.com|Jan Fišer (@fisirek) • Instagram photos  www.chess.com|https://www.chess.com › member › fisirek) |
| Rutelafote | ✅ ПРИЗРАК — 0 находки (12 търсачки потвърдиха + домейни + марки + магазини) |
| Duseral | ✗ DuckDuckGo: 9 находки (modrinth.com|https://modrinth.com › user › duseral modrinth.com|duseral - Modrinth modrinth.com|https://modrinth.com › user › duseral › ) |
| Dinotezi | ✅ ПРИЗРАК — 0 находки (12 търсачки потвърдиха + домейни + марки + магазини) |
| Zivepem | ✅ ПРИЗРАК — 0 находки (12 търсачки потвърдиха + домейни + марки + магазини) |
| Nuzegigise | ✅ ПРИЗРАК — 0 находки (12 търсачки потвърдиха + домейни + марки + магазини) |
| Rirafonu | ✅ ПРИЗРАК — 0 находки (12 търсачки потвърдиха + домейни + марки + магазини) |
| Zukerubo | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Tomisuso | ✅ ПРИЗРАК — 0 находки (12 търсачки потвърдиха + домейни + марки + магазини) |
| Vemifofo | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Ketavek | ✗ DuckDuckGo: 2 находки (www.lazada.co.id|https://www.lazada.co.id › tag › ketavek www.lazada.co.id|Jual Ketavek Obat Semprot Terbaru Online) |
| Sazokida | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Basovio | ✗ DuckDuckGo: 1 находки (www.instagram.com|I love me on Instagram: "Basovio#foryoup) |
| Sezezila | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Sunotoral | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Setapegi | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Kenevatolu | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |
| Sarizopi | ✅ ПРИЗРАК — 0 находки (11 търсачки потвърдиха + домейни + марки + магазини) |


---

# Партида — 7-буквени

# „Призрачни" имена от 7 букви — нула следи в интернет

_Проверени 24 произносими кандидата (гласни+съгласни, без двойни букви). Всяко име по-долу мина: браузърна обиколка на 14 търсачки (Google, Bing, DuckDuckGo, Yahoo, Ecosia, Startpage, Brave, Mojeek, Ask, Yep, Dogpile, Metacrawler, Swisscows, Gibiru — методът на питонския скрипт scrap1) = 0 находки; домейни .com/.net/.org/.io/.app СВОБОДНИ (авторитетно RDAP); TMview марки = 0; App Store (US+CN) = 0; Google Play = 0; AppGallery = 0. Семе на генератора: 20260720 (възпроизводимо)._

## Намерени: 0


## Здраве на търсачките (реално работещи в тази обиколка)

| Търсачка | потвърдила 0 | намерила находки | недостъпна |
|---|---|---|---|
| Google | 0 | 0 | 7 |
| Bing | 7 | 0 | 0 |
| DuckDuckGo | 7 | 0 | 0 |
| Yahoo | 7 | 0 | 0 |
| Ecosia | 0 | 0 | 7 |
| Startpage | 4 | 3 | 0 |
| Brave | 0 | 3 | 1 |
| Mojeek | 1 | 0 | 0 |
| Ask | 1 | 0 | 0 |
| Yep | 1 | 0 | 0 |
| Dogpile | 1 | 0 | 0 |
| Metacrawler | 1 | 0 | 0 |
| Swisscows | 0 | 1 | 0 |
| Gibiru | 0 | 0 | 0 |

## Журнал на проверката (какво отпадна и защо)

| Име | Резултат |
|---|---|
| Zubumin | ✗ Startpage: 5 находки |
| Modolal | ✗ DDG (бърз): 2 |
| Garinuk | ✗ DDG (бърз): 4 |
| Rekodel | ✗ DDG (бърз): 8 |
| Tanerir | ✗ DDG (бърз): 3 |
| Titomei | ✗ DDG (бърз): 7 |
| Perotik | ✗ DDG (бърз): 5 |
| Kulibuk | ✗ DDG (бърз): 4 |
| Mevikal | ✗ DDG (бърз): 1 |
| Pigevok | ✗ Brave: 24 находки |
| Tiveper | ✗ DDG (бърз): 3 |
| Kibefue | ✗ Brave: 1 находки |
| Fezalie | ✗ DDG (бърз): 1 |
| Tisibim | ✗ Startpage: 1 находки |
| Gofevis | ✗ Swisscows: 3 находки |
| Fabaput | ✗ Brave: 15 находки |
| Nekekit | ✗ DDG (бърз): 9 |
| Geredan | ✗ DDG (бърз): 7 |
| Rigodes | ✗ DDG (бърз): 8 |
| Dupapia | ✗ Startpage: 2 находки |
| Sadetam | ✗ DDG (бърз): 8 |
| Semefin | ✗ DDG (бърз): 6 |
| Purizil | ✗ DDG (бърз): 1 |
| Bimitao | ✗ DDG (бърз): 2 |
