# pupikes-toolkit-ai-announcement — Reviewer note (Huawei AppGallery)
Version 1.0020

## For reviewer
Reply to rule 3.1 ("Fill in request >> Generate >> Connection error") and rule 4.1 ("single feature").

Version 1.0020 fixes the connection error and adds a new main function, "Announcement campaigns".
- Generation now has three stages and NEVER ends in an error without a result: direct call to the free AI service → if unreachable, the same call through our relay server (pupikes.app) → if that fails too, a BUILT-IN OFFLINE GENERATOR (templates for 8 announcement types × 4 tones × 15 languages, filled with the user's fields). The offline generator works with Wi-Fi off, and in regions where the AI service is blocked.
- Announcement campaigns (first card on the home screen): type, tone, one or more of 15 languages, fields (subject, price, location, highlights, date, contact) → generated text (editable) → saved as a campaign with a sending channel (copy / share / SMS / e-mail), date and time, repeat (once / daily / weekly / monthly) and a phone reminder; sending history and statistics by channel, type and language. Three sample campaigns are seeded at first launch (marked "Sample", deletable).
- The previous "AI text generator" (write / summarize / translate / explain) stays as a second tool with the same relay + offline fallback.
No account, no login, everything stored on the device.

## How to test
1. Launch the app → choose a language → Continue → accept the legal screen. Home screen shows two cards; tap "Announcement campaigns".
2. Tab "New announcement": tap "Fill with example" (fills subject, price, location, highlights, date, contact) → tap "Generate announcement". Expected: within ~20 s a ready announcement appears in a text box with a note saying whether it came from AI (direct), AI via relay, or the built-in templates (offline). Repeat the same with Wi-Fi/mobile data OFF: the announcement still appears (offline templates) — no connection error.
3. Below the result: choose channel "Copy" → tap "Send now". Expected: green "Copied to clipboard" and the send is recorded. Choose "Share" → "Send now": the system share sheet opens. Choose "SMS" or "E-mail" (optionally enter a number / address) → "Send now": the messaging / mail app opens with the text pre-filled.
4. Set "Send date and time" (e.g. tomorrow) and "Repeat" = Weekly → tap "Save as campaign". Expected: "Campaign saved" and, if notifications are allowed, a reminder is scheduled for that time.
5. Tab "Campaigns": three sample campaigns (badge "Sample") plus the one you saved; each shows type, tone, channel, languages, next send, sends count and status (Planned / Due now / Sent). "Text" shows the announcement in every chosen language; "Send now" sends through the campaign's channel; "Delete" removes it; "Delete samples" removes the samples.
6. Tab "History": every send with date/time, channel and language (newest first). Tab "Statistics": counters (campaigns, sends, planned), last send, breakdown by channel, by type and by language.
7. Back → card "AI text generator": type any request → "Generate". Expected: an answer (direct AI, via relay, or from offline templates when there is no connection) — never an error without a result.
