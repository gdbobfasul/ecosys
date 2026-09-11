# Reviewer note — Pupikes Toolkit QR (Huawei)
Version 1.0026

## For reviewer
Reply to rule 4.3 ("QR Generator/QR reader, similar to existing apps; improve interaction design and feature depth").

Version 1.0026 changes the core of the app. It is no longer a QR generator/reader: the FIRST screen is now "QR labels for home and inventory" — a label system for the things in your home. Every item, box, key, medicine or document gets its own printed QR label (unique code PQL-XXXXXX). You print an A4/Letter sheet of labels, stick them on, and later scan a label to open the ITEM CARD: photo, place/box, category, expiry date, who borrowed it and when it is due back, notes. The QR generator, reader, Payment QR etc. remain as secondary tools (button "All tools" in the header). Everything works offline on the device; no account, nothing is uploaded. On first launch the app contains 6 clearly marked SAMPLE items (badge "sample", button "Delete samples") so every screen is populated immediately.

What is new (all on-device):
- Items: list with photo/category icon, place, status (expiry countdown, lent to whom / due date), search, filters All / Lent out / Expiring / Not printed, counters, warning banner for expired items and overdue loans.
- Item card: photo (from gallery, stored on the device), place/box, category (10 categories), expiry + "remind N days before", notes, QR code + code text, "Label PNG" (single 35 mm label at 300 DPI), Edit / Delete.
- Lend: "Lend to <name> until <date>", "Returned" button, lending history per item and a global "Lent" tab with overdue highlighting.
- Print: sheet of labels A4 or Letter at 300 DPI, label size 25/35/50 mm, choose All / Only not yet printed / Selected, live preview of sheet 1, "Download PNG" (one PNG per sheet) or "Download PDF" (pdf-lib, multi-page); printed items are marked so the next sheet contains only new ones.
- Scan: camera (jsQR), from a photo, or type the code by hand → opens the item card; unknown code → "Create an item with this code" (so an existing QR sticker can be attached to an item).
- Reminders: local notifications before the expiry date and on the loan due date (Capacitor LocalNotifications), plus the in-app warning banner.

## How to test
1. Launch the app → choose a language → the first screen is "QR labels" with 6 sample items (badge "sample"). The counters line shows "6 items · 1 lent out · 1 expiring"; the yellow banner lists "Paracetamol 500 mg" (expires in 5 days) and "Hammer drill" (lent to John, overdue by 2 days).
2. Tap "Paracetamol 500 mg" → item card: category Medicines, place "Bathroom medicine cabinet", expiry countdown, notes, QR code with its PQL- code, buttons Label PNG / Edit / Delete, lending section.
3. Tap "Edit" → change the place, set an expiry date and "Remind (days before)" → Save → the card shows the new status. (If asked, allow notifications — a local reminder is scheduled.)
4. Tap "＋ New item" → enter a name (e.g. "Bosch drill"), category, place, optional photo via "Choose photo" (gallery) → Save → the item appears in the list with the badge "Not printed".
5. Tab "Print" → choose label size Medium (35 mm), sheet A4, "Which items: All" → the preview shows the sheet with all labels (QR + name + place + code) and the line "N labels per sheet · 1 sheets · N labels" → tap "Download PDF" (or "Download PNG") → the share/save dialog opens with labels-A4.pdf; the status line says "Done — N labels marked as printed".
6. Tab "Scan" → "Scan with camera" (allow camera) → point at any printed label or at the QR shown on another phone → the item card opens. Without a printer: type a code from the list (shown vertically on the right of each item, e.g. PQL-…) into the field and tap "Open" → the item card opens. Type an unknown code (e.g. TEST-1) → "No item with this code" + "Create an item with this code".
7. Item card of "Winter tyres" → "Lend": To whom = "Anna", Until = a date → "Lend" → status "Lent to Anna · Due: <date>"; tab "Lent" lists it; tap "Returned" → moves to lending history.
8. Tab "Items" → search "garage" → only the garage items; filters "Lent out" / "Expiring" / "Not printed" narrow the list. "Delete samples" removes the 6 sample items.
9. Header button "⊞" (All tools) → grid with the secondary tools: QR code (generate/read), My QR codes, Batch QR, Styled QR, Wi-Fi, Contact, Event, Payment QR, Location. Header button 🌐 → language screen (15 languages).

Permissions: CAMERA (scan labels — used only while the "Scan with camera" preview is on), POST_NOTIFICATIONS (expiry / loan reminders). No internet is needed for any of the above.
