# Готовност за публикуване — приложение по приложение

_Съставено: 2026-07-22. Отразява кои приложения потребителят смята за готови за релийз (публикуване в RuStore / Huawei AppGallery) и кои още не. Всяко приложение е на отделен ред (не групово)._

**Статуси:**
- ✅ **ГОТОВО** — потвърдено от потребителя за публикуване
- ⏳ **ОЩЕ НЕ** — още не е потвърдено като готово (работи, но чака преглед/решение)

Потвърдените „готови" групи (думи на потребителя): **новинарските**, цялото семейство **Pupikes Toolkit**, и двете игри **FPS** и **Plane Shooter**.

---

## Всичките 32 приложения

| # | Папка | Име за магазина | Категория | Статус |
|---|---|---|---|---|
| 1 | newslator | **NewsLator** | Новини | ✅ ГОТОВО |
| 2 | services-toolkit | **Pupikes Toolkit** | Toolkit семейство | ✅ ГОТОВО |
| 3 | authenticator | **Pupikes Toolkit Authenticator** | Toolkit семейство | ✅ ГОТОВО |
| 4 | price-watch-bot | **Pupikes Toolkit Price Watch** | Toolkit семейство | ✅ ГОТОВО |
| 5 | kcy-toolkit-scraper | **Pupikes Toolkit Scraper** | Toolkit семейство | ✅ ГОТОВО |
| 6 | kcy-toolkit-3drotate | **Pupikes Toolkit 3D Rotate** | Toolkit семейство | ✅ ГОТОВО |
| 7 | kcy-toolkit-ai-announcement | **Pupikes Toolkit AI Announcement** | Toolkit семейство | ✅ ГОТОВО |
| 8 | kcy-toolkit-finance | **Pupikes Toolkit Finance** | Toolkit семейство | ✅ ГОТОВО |
| 9 | kcy-toolkit-passwords | **Pupikes Toolkit Passwords** | Toolkit семейство | ✅ ГОТОВО |
| 10 | kcy-toolkit-pdf | **Pupikes Toolkit PDF** | Toolkit семейство | ✅ ГОТОВО |
| 11 | kcy-toolkit-pictures | **Pupikes Toolkit Pictures** | Toolkit семейство | ✅ ГОТОВО |
| 12 | kcy-toolkit-qr | **Pupikes Toolkit QR** | Toolkit семейство | ✅ ГОТОВО |
| 13 | kcy-toolkit-sound | **Pupikes Toolkit Sound** | Toolkit семейство | ✅ ГОТОВО |
| 14 | kcy-toolkit-text | **Pupikes Toolkit Text** | Toolkit семейство | ✅ ГОТОВО |
| 15 | kcy-toolkit-videos | **Pupikes Toolkit Videos** | Toolkit семейство | ✅ ГОТОВО |
| 16 | fps-hunter | **Huntline 3D** | Игра (FPS) | ✅ ГОТОВО |
| 17 | plane-shooter | **Warbird Rush** | Игра (Plane Shooter) | ✅ ГОТОВО |
| 18 | autoreply-bot | Pupikes Auto Answer | Бот/услуга | ⏳ ОЩЕ НЕ |
| 19 | baby-monitor | Pupikes Baby Radar | Услуга | ⏳ ОЩЕ НЕ |
| 20 | business-faq-bot | Pupikes FAQ Desk | Бот/услуга | ⏳ ОЩЕ НЕ |
| 21 | camera-watch | MotionHawk | Услуга | ⏳ ОЩЕ НЕ |
| 22 | chat | Pupikes Chat | Услуга | ⏳ ОЩЕ НЕ |
| 23 | dodge-master | EvadeArena | Игра | ⏳ ОЩЕ НЕ |
| 24 | duel | Pupikes Ring Clash | Игра | ⏳ ОЩЕ НЕ |
| 25 | hmm | Pupikes Field Battle | Игра | ⏳ ОЩЕ НЕ |
| 26 | houselookbook | HouseLookBook | Услуга | ⏳ ОЩЕ НЕ |
| 27 | market-pulse | Pupikes Market Pulse | Финанси | ⏳ ОЩЕ НЕ |
| 28 | monitor-bot | Pupikes Site Monitor | Наблюдение (новини/уеб) | ⏳ ОЩЕ НЕ* |
| 29 | routine-bot | Pupikes Routine Planner | Услуга | ⏳ ОЩЕ НЕ |
| 30 | rustam | Rustam picks cucumbers | Игра | ⏳ ОЩЕ НЕ |
| 31 | selflearning-friend | Pupikes LB | Услуга (самообучение) | ⏳ ОЩЕ НЕ |
| 32 | titans-fight | Godfist Arena | Игра | ⏳ ОЩЕ НЕ |

**Обобщение: 17 ✅ ГОТОВИ · 15 ⏳ ОЩЕ НЕ**

\* **Site Monitor (monitor-bot)** следи новини и уеб страници, тоест е близък до „новинарските". Ако го причисляваш към готовите новинарски — кажи и го местя на ✅. (Наскоро му поправихме „Търси" да не трие фразата и „Запази" да устоява при рестарт.)

---

## Бутон „Обратна връзка" — проверка

- **Работи навсякъде:** и в 32-те приложения бутонът е монтиран (💬 в долната лента).
- **Ендпойнтът е жив:** сървърът отговаря (HTTP 204 на проверка).
- **Как праща:** на телефон през CapacitorHttp (заобикаля CORS), в браузър — обикновено. Анонимно, без вход.
- **⚠️ НЕ отива на имейл.** Докладите се записват в базата на портала. Никъде няма препращане към пощенски адрес.
- **Къде се вижда:** порталната страница **„🐞 Докладвани грешки"** — влиза се от **Админ панела** (бутонът „🐞 Докладвани грешки"), адрес `/portals/admin-bugs.html` (т.е. `pupikes.com/portals/admin-bugs.html`). Достъп само за админ/модератор. Два таба: „🔧 Неоправени" и „✅ Оправени"; всеки доклад показва от кое **приложение** идва (за анонимните — етикет „📱 анонимно · приложение: <име>"), текста и дата. Админ може да маркира „оправена"; модератор — само преглед.

**Ако искаш писмата да идват на имейл** (напр. ltd.dai.grup@gmail.com), това е малка добавка от сървърна страна — при нов анонимен доклад да се праща и известие по пощата. Кажи и го добавям (изисква и деплой на портала).
