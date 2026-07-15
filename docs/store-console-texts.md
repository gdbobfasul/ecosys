# Текстове за конзолите на магазините (Huawei AGC + RuStore)
<!-- Version: 1.0001 — готови за копиране изречения при подаване на апове.
     Обосновките за разрешения са по РЕАЛНИТЕ android-permissions.txt на всеки ап. -->

Тук са само нещата, които се попълват НА РЪКА в конзолата при подаване — всичко останало
(описания, снимки, политики, terms) е в `huawei/<ап>/publish/`.

---

## 1) Обосновки за разрешения (Permission usage justification)

Huawei AGC пита „защо апът иска това разрешение" при преглед. RuStore има подобно поле
„Использование разрешений". Копирай съответния ред (EN за Huawei, RU за RuStore).

### authenticator (CAMERA + USE_BIOMETRIC)
- **CAMERA (EN):** The camera is used only to scan QR codes when adding a 2FA account (TOTP/HOTP). No photos or videos are captured, stored, or transmitted; frames are processed on-device and discarded.
- **CAMERA (RU):** Камера используется только для сканирования QR-кодов при добавлении 2FA-аккаунта (TOTP/HOTP). Фото и видео не сохраняются и не передаются; кадры обрабатываются на устройстве и сразу удаляются.
- **USE_BIOMETRIC (EN):** Biometric authentication (fingerprint/face) is used only to unlock the local encrypted vault. Biometric data never leaves the device and is handled entirely by the operating system.
- **USE_BIOMETRIC (RU):** Биометрия (отпечаток/лицо) используется только для разблокировки локального зашифрованного хранилища. Биометрические данные не покидают устройство и обрабатываются только операционной системой.

### baby-monitor (CAMERA)
- **EN:** The camera is the core function of the app: it streams live video of the child locally so a parent can watch from another device on the same network. No video is recorded to the cloud or shared with third parties.
- **RU:** Камера — основная функция приложения: локальная трансляция видео ребёнка, чтобы родитель мог наблюдать с другого устройства в той же сети. Видео не записывается в облако и не передаётся третьим лицам.

### camera-watch (CAMERA)
- **EN:** The camera is the core function of the app: it monitors the scene and detects motion on-device. Frames are processed locally; nothing is uploaded or shared with third parties.
- **RU:** Камера — основная функция приложения: наблюдение за сценой и обнаружение движения на устройстве. Кадры обрабатываются локально; ничего не выгружается и не передаётся третьим лицам.

### selflearning-friend (RECORD_AUDIO + CAMERA + READ/WRITE_EXTERNAL_STORAGE)
- **RECORD_AUDIO (EN):** The microphone is used only for voice commands and dictation to the assistant. Speech recognition runs through the system service; audio is not stored or sent to our servers.
- **RECORD_AUDIO (RU):** Микрофон используется только для голосовых команд и диктовки ассистенту. Распознавание речи выполняется системным сервисом; аудио не сохраняется и не отправляется на наши серверы.
- **CAMERA (EN):** The camera is used only when the user explicitly asks the assistant to "look" at something; the picture is analyzed for the answer and is not stored or shared.
- **CAMERA (RU):** Камера используется только когда пользователь сам просит ассистента «посмотреть»; снимок анализируется для ответа и не сохраняется и не передаётся.
- **STORAGE (EN):** Storage access is used only to save/restore the user's own settings and learned-knowledge backup files (Downloads/KCY) and to import documents the user picks for learning. No other files are read.
- **STORAGE (RU):** Доступ к памяти используется только для сохранения/восстановления файлов настроек и знаний пользователя (Downloads/KCY) и для импорта документов, которые пользователь сам выбирает. Другие файлы не читаются.

### services-toolkit (POST_NOTIFICATIONS)
- **EN:** Notifications are used only to alert the user about events they configured in the toolkit (timers/reminders). No marketing notifications are sent.
- **RU:** Уведомления используются только для событий, настроенных самим пользователем (таймеры/напоминания). Маркетинговые уведомления не отправляются.

---

## 2) Модерация на потребителско съдържание (UGC) — chat + houselookbook

Магазините питат как се модерира съдържание, създадено от потребители.

- **EN:** User-generated content is moderated as follows: (1) every screen has a built-in anonymous "Report" button; (2) reports go to the administrator queue and are reviewed within 24 hours; (3) administrators/moderators can hide content and block accounts; (4) account deletion is handled by the administrator on user request via the built-in report channel; (5) the rules are part of the Terms of Use shown and accepted on first launch.
- **RU:** Пользовательский контент модерируется так: (1) на каждом экране есть встроенная анонимная кнопка «Пожаловаться»; (2) жалобы попадают в очередь администратора и разбираются в течение 24 часов; (3) администраторы/модераторы могут скрывать контент и блокировать аккаунты; (4) удаление аккаунта выполняет администратор по запросу через встроенный канал жалоб; (5) правила входят в Условия использования, принимаемые при первом запуске.

---

## 3) Тестов достъп за ревюърите (chat + houselookbook)

Апове с вход изискват тестов акаунт в конзолата („Test account"). Преди подаване:
1. Създай в prod тестов потребител (истински работещ), напр. `store.review` + парола.
2. Впиши го в полето Test account на AGC / RuStore + кратка бележка:
   - **EN:** Log in with the provided test account. All features are available after login; no SMS/email verification is required for this account.
   - **RU:** Войдите с предоставленным тестовым аккаунтом. После входа доступны все функции; подтверждение по SMS/почте для этого аккаунта не требуется.

---

## 4) Платено сваляне — стъпки в конзолата (всички апове)

- **Huawei AGC:** Activate merchant service (разчетна сметка) → подпиши Paid Apps договор →
  App information → Pricing: избери цена по държави. IAP SDK НЕ е нужен (покупката е на ниво магазин).
- **RuStore:** Монетизация → „Платное приложение" → цена в рубли. Нужен е договор с VK Pay
  за изплащания.
- Възрастова оценка: попълва се въпросникът; никой ап няма съдържание 18+ (игрите — леко
  анимационно насилие: plane-shooter, titans-fight, fps-hunter, duel → обикновено 12+).

---

## 5) RuStore — снимки

RuStore приема до 10 екранни снимки. Апове с повече в `publish/` (напр. newslator има 16):
избери 10-те най-представителни при качване — задължително поне 1-2 с основната функция
и 1 с езиковия избор.
