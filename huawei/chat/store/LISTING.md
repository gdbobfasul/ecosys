# KCY Chat — Huawei AppGallery listing

**App name:** KCY Chat
**App id:** `com.kcy.chat.huawei`
**Category:** Communication / Social

## Short description (EN)
Mobile client for the KCY chat. Secure messaging and help requests.

## Short description (BG)
Мобилен клиент за чата KCY. Сигурно общуване и заявки за помощ.

## Full description
KCY Chat е официалната мобилна обвивка за чат платформата KCY. Приложението
зарежда живия чат сървър и предлага същото изживяване като уеб версията —
съобщения, услуги, профил — директно на телефона.

Приложението е тънка обвивка (WebView shell): цялата функционалност живее на
продукционния сървър. Не съхранява лични данни локално, няма реклами и не
проследява потребителя.

## Notes for reviewer
- Приложението е WebView обвивка, която зарежда продукционния чат:
  `https://my.girl.place`.
- Няма вградени плащания (IAP), няма GMS/HMS/Firebase, няма достъп до контакти.
