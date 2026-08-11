# Pupikes Toolkit QR — Response to review / For reviewer (Huawei AppGallery)
Package: `com.pupikes.toolkitqr.hw` · Version 1.0020 · Category: Tools

> Полето „For reviewer" при повторно подаване. Реалните забележки: app-shared/moderation-huawei.json → apps.pupikes-toolkit-qr (Workspace → App review results).

## Reply to review comment 1 — Privacy policy URL (rule 7.1)
Moderator: the privacy URL returned "404 not found".
**Fixed:** `https://pupikes.app/privacy/pupikes-toolkit-qr/hw-privacy.html` now returns a valid privacy policy page (**HTTP 200**). The earlier 404 was because the page had not been deployed yet at review time; it is now live worldwide. Please re-open the URL to verify.

## Reply to review comment 2 — App features (rule 4.1 "single feature")
The app is **not single-feature** — it includes **8 distinct QR tools**, shown as a grid on the home screen:
1. **QR code** — generate and read QR codes.
2. **My QR codes** — named, saved codes (payments, Wi-Fi, contacts), organized in a list.
3. **Batch QR** — generate many codes at once (one per line); download individually or all.
4. **Styled QR** — custom code/background color + center logo.
5. **Wi-Fi QR** — share Wi-Fi; scanning auto-connects the phone.
6. **Contact QR** — business card (vCard): name, company, phone, email; scan saves the contact.
7. **Event QR** — calendar event (title, place, start/end); scan adds it to the calendar.
8. **Location QR** — coordinates (geo:) or map link; "My location" via GPS.

All tools work **offline**, with **no pop-up ads and no tracking**. To see all 8, open the tool grid on the app's home screen.

## For reviewer (кратък вариант)
8 QR tools (generate/read, My codes, Batch, Styled, Wi-Fi, Contact/vCard, Event, Location) — offline, no ads/tracking. Privacy URL now live (HTTP 200): https://pupikes.app/privacy/pupikes-toolkit-qr/hw-privacy.html
