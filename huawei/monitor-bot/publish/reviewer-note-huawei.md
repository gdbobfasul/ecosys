# Reviewer note — Pupikes Site Monitor (Huawei)
Version 1.0029

## For reviewer
Resubmission for rule 4.1 ("only simple content"). The previous build looked empty on a clean install because nothing was watched yet. Version 1.0029 fixes exactly that: the app now opens on an OVERVIEW board with every tool on it, and a fresh install already contains sample data (5 example sites with 14 days of history) so every feature can be seen and tested immediately. No login, no account; package com.pupikes.monitorbot.hw.

What the app does (all on the device, 15-language interface):
- OVERVIEW (start screen, new): one board with cards for Uptime, SSL certificates, Prices, Page changes, RSS/JSON monitors, Daily watches, Board & weekly report, Transfer & templates, Feed catalog (222 verified sources) and New monitor — each card shows live lines from the stored data; a search box searches a word or phrase across all news feeds.
- TOOLS: Uptime (online/offline history, response-time chart, 7-day uptime %, incidents), SSL (certificate expiry, days left), Price (price on any page with history and change), Changes (sentences added/removed since the last visit), Board (status of everything + weekly report to share), Transfer (export/import JSON, templates Telegram/YouTube/Reddit/GitHub).
- SITES: live text search on a site; daily watches for text, identical image and online/offline status with notification and alarm music.
- DASHBOARD: unlimited RSS/Atom/JSON monitors with "new entries" and keyword rules, scheduled checks, log; CATALOG of feeds by country.

Sample data: on the first opening of Overview the app seeds 5 example sites (wikipedia.org, bbc.com, github.com, weather.com, example.org) with generated 14-day history — uptime and response time, SSL validity, two price trackers, two page-change trackers, four daily watches, three feed monitors and log entries. Every sample row carries an orange "sample" tag; the button "Remove samples" on Overview deletes all of them at once (and "Add samples again" brings them back when nothing else is watched).

Data policy (unchanged): each check runs ONCE per app launch (when a section is first opened or an item is added) and stored data is shown afterwards; daily watches run once a day by schedule; feed monitors run by their own interval when the bot switch is ON. "Check now" is available on every row. If a direct request is blocked, feeds and certificate data fall back to our relay (pupikes.app).

## How to test
1. Install and open the app → choose a language → "Activate the bot" → "Done" → you land on OVERVIEW. Expected: an orange banner "Sample data…", a search box, and ten cards with content (e.g. Uptime "5 sites · 9x% uptime · N incidents", SSL "soonest expiry: example.org · 19 days", Prices "example.org: 109.99 $ ▼ 20.00", Page changes "bbc.com: +2 / −1", RSS/JSON monitors "3 monitors · BBC News…"), then "Recent events".
2. Tap the card "Uptime" → Tools › Uptime opens with 5 sites, each with a green/red bar chart of 56 checks over 14 days, current status, response time, 7-day uptime and incidents. Tap "Check now" on any site → a new real check is appended.
3. Overview → card "SSL certificates" → 5 domains with days left (green/orange/red) and the expiry date.
4. Overview → card "Prices" → two tracked prices with history (dates and values) and the change since the first value.
5. Overview → card "Page changes" → bbc.com and wikipedia.org with sentences added (green) and removed (red).
6. Overview → card "Board & weekly report" → one status list of everything (tools, daily watches, monitors) and a generated weekly report; "Share / copy" copies it.
7. Overview → card "Transfer & templates" → "Export (JSON)" fills the text box with all data; type a channel name and tap Telegram/YouTube/Reddit/GitHub → a monitor is added.
8. Overview → card "Daily watches" → Sites › Text with two sample watches (wikipedia.org "The Free Encyclopedia" = FOUND, bbc.com "Breaking news" = Not found); tab "Status" shows weather.com and github.com Online. "Check now" performs a real check.
9. Overview → search box: type e.g. "news", tap "Search now" → results from the sample feeds (needs internet); "Text on a site" opens the live site search.
10. Overview → card "RSS/JSON monitors" → Dashboard with 3 sample monitors (BBC News, Hacker News, GitHub releases), each with "Check now", Edit, Pause, Delete, and the log below.
11. Overview → "Remove samples" → all sample rows disappear everywhere; the cards show "nothing yet — tap to add"; "Add samples again" restores them.
12. Add your own site in any tool (e.g. Tools › Uptime → type a URL → Add) → it is checked once immediately and shown without a "sample" tag.
