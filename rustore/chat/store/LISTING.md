# Pupikes Chat — RUStore listing

**App name:** Pupikes Chat
**App id:** `com.kcy.chat.rustore`
**Category:** Communication / Social

## Short description (RU)
Мобильный клиент чата Pupikes. Безопасное общение и заявки на помощь.

## Short description (BG)
Мобилен клиент за чата Pupikes. Сигурно общуване и заявки за помощ.

## Full description
Pupikes Chat е официалната мобилна обвивка за чат платформата Pupikes. Приложението
зарежда живия чат сървър и предлага същото изживяване като уеб версията —
съобщения, услуги, профил — директно на телефона.

Приложението е тънка обвивка (WebView shell): цялата функционалност живее на
продукционния сървър. Не съхранява лични данни локално, няма реклами и не
проследява потребителя.

## Notes for reviewer
- Приложението е WebView обвивка, която зарежда продукционния чат:
  `https://my.girl.place`.
- Няма вградени плащания (IAP), няма GMS/HMS/Firebase, няма достъп до контакти.
