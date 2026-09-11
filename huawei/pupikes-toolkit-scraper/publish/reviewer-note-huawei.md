# pupikes-toolkit-scraper — Reviewer note (Huawei AppGallery)
Version 1.0021

## For reviewer
Reply to rule 4.1 ("only simple content", second review). Version 1.0021 adds a new main feature and sample content that is visible immediately after a clean install, so the app can be fully tested without any server and even without internet.

What is new:
- "Page watcher" (first card on the home screen): saved targets = page address + what to track (e-mails, phones, prices, headings). Re-scan on demand; every scan is stored in a HISTORY; each entry shows what is NEW, GONE or CHANGED compared to the previous scan (prices are matched by their label, e.g. "Teeth whitening £199 → £179"); "Compare two scans" lets you pick any two entries; phone notification when a scan finds a change (toggle in "Export & alerts", asks for notification permission); CSV export of the change history and of the current data of all targets.
- Sample data on first launch: 2 sample targets, clearly marked "sample", pointing to 2 pages BUILT INTO the app (a dental clinic contact page and a small headphone shop). They already contain a history of 2 previous scans and they scan offline. "Delete samples" removes them with one tap; "Add sample targets" brings them back.
- "On-device scraper" got a "Try with an example" button that loads the same 2 built-in pages and extracts title, description, e-mails, phones, links, headings, content type and word count — works offline.
- Remote pages are downloaded on the phone (direct request, with automatic fallback through our relay service so it also works in regions where some sites are unreachable). Nothing is uploaded, no account, no login.

## How to test
1. Install, choose a language, accept the legal screen. Home screen → tap the first card "Page watcher".
2. "Targets" tab shows 2 sample targets (badge "sample") with their last scan summary (e.g. "3 new · 1 gone · 1 changed"). Tap "Scan all" → status "Done: …" and each card now shows a fresh scan with real differences (e.g. "2 new · 0 gone · 1 changed") — this works with Wi-Fi OFF because the sample pages are inside the app.
3. Tap "History" on a card (or the "History" tab): "Current data" lists the e-mails, phones, prices and headings found; "Scan timeline" shows every scan with green "+" (new), red "−" (gone) and orange "~" (changed, with old → new value). Below, "Compare two scans": choose "From" and "To" and tap "Compare" → the difference between those two scans.
4. "Targets" → "New target": enter a page address (e.g. https://example.org), tick what to track, tap "Add and scan" → the target appears with "First scan — e-mails: …, phones: …, prices: …, headings: …". Tap "Scan" again → "No changes" or the list of differences.
5. "Export & alerts" tab: switch on "Phone notification on change" (permission prompt), then "Download CSV — change history" and "Download CSV — current data of all targets" → a CSV file is saved/shared via the system dialog.
6. "Delete samples" (banner at the top of "Targets") removes the sample targets; "Add sample targets" restores them.
7. Back → "On-device scraper" card → tap "Try with an example" → 2 result cards (badge "sample") with e-mails, phones, headings, type and word count; "Download CSV" and "Copy contacts" work on them. Entering real URLs or a keyword works the same way when online.

The app also includes the other Pupikes tools and a 15-language interface, all described in the listing.
