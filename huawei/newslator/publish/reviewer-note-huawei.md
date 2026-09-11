# NewsLator — Response to review / For reviewer (Huawei AppGallery)
Package: `com.pupikes.newslator.hw` · Version 1.0024 · Category: News

> Тази бележка отива в полето **„For reviewer"** при повторно подаване. По ВСЯКА забележка на
> модератора — какво е направено, за да знае рецензентът. (Реалните забележки са в
> `app-shared/moderation-huawei.json` → apps.newslator, събрани от Workspace → App review results.)

---

## For reviewer
Resubmission for rule 4.1 ("only simple content"), version 1.0024. The previous review probably saw EMPTY screens: in the test region the public RSS feeds / Google News did not respond, so the reader had nothing to show. Version 1.0024 fixes the root cause and adds a Home dashboard:

1) BUILT-IN OFFLINE EDITION. About 2000 real headlines from 20 countries (US, GB, DE, FR, ES, MX, IT, BR, RU, UA, BG, KG, SA, IN, JP, TW, CN, TR, AU, KR) x 9 sections (all, world, national, business, technology, sports, science, health, entertainment) plus an exchange-rate table ship inside the APK (generated at build time from the same sources the app uses). Whenever the network or our relay returns nothing, the app shows this edition and labels it "Offline edition from <date>". NO screen is ever empty — the app works fully with Wi-Fi OFF / airplane mode.
2) HOME DASHBOARD = first screen after start: one card per feature with 1-2 lines of live content each — News by country, Compare two countries, Pulse (exchange rates + capital weather), Digest with read-aloud, Keywords and alerts, Saved articles, Search. Tapping a card opens the section. The bottom tabs (News, Countries, Saved, Tools, Settings) remain.
3) A country is suggested automatically from the UI language on first launch (e.g. Chinese -> Taiwan feeds, English -> United States), so even a fresh install shows content immediately; the user can pick any of ~198 countries in "Countries".
4) Data policy unchanged: every section fetches its data ONCE per app launch (at start or on first opening) and does not refresh by itself, even if the app stays open for days; the manual refresh button is the only way to fetch again. A country fetched by one screen is reused by all others (Home, News, Compare).

How to test (works with internet on or off):
- Launch the app -> choose a language -> tap "Get started". Expected: the HOME tab opens with 7 cards, each already filled (news headlines, two-country comparison, rates/weather, digest, keywords, saved, search). With no network the cards show "Offline edition from <date>" — that is the built-in edition, not an error.
- Home -> card "News by country" -> expected: the News tab with the headlines of the current country, category chips (World, National, Business...), a search box, "Read all" (text-to-speech) and per-article buttons Open / Star / Share / Speaker / Translate. Tap "Translate" on any headline -> the headline is translated into the UI language (needs internet; without it the original stays).
- Home -> card "Compare two countries" -> expected: Tools > Compare with two country selectors and the "Compare" button -> two columns of headlines, each in its own language. Change the selectors, tap "Compare" again.
- Home -> card "Pulse: rates and weather" -> expected: Tools > Pulse: the capital weather (Open-Meteo) and the rates of the country currency against USD/EUR/GBP/CNY/RUB/JPY/CHF/TRY. Offline: the rates come from the built-in table (badge "Offline edition from <date>").
- Home -> card "Digest with read-aloud" -> expected: Tools > Digest with up to 20 headlines of the user's country + followed countries, fetched once at start; the "Read aloud" button speaks them (device text-to-speech); "Stop" stops. The speaker button on the Home card does the same without leaving Home.
- Home -> card "Keywords and alerts" -> Tools > Keywords: type a word (e.g. "budget") -> "Add" -> the digest is matched once and hits are listed under "Matches this launch" (and a local notification is shown when there is a hit).
- Home -> type a word in the search box -> Enter or the search button -> expected: the News tab with search results for that word (live search when online; offline it searches the built-in edition).
- Countries tab -> tap any country -> its news; tap the star to follow it -> "My feed" chip in News merges the followed countries; the Compare card on Home uses the first followed country.
- Saved tab -> star any article in News first -> it appears here; "History" lists opened articles.
- Settings -> app language (all 15 languages), country, auto-translate, read-aloud, About, Privacy Policy (https://pupikes.app/privacy/newslator/hw-privacy.html, HTTP 200).
No login, no account. Package com.pupikes.newslator.hw.

## Reply to review comment 1 — Privacy policy URL (rule 7.1)
**Moderator:** "When users access the privacy policy URL https://pupikes.app/privacy/newslator/hw-privacy.html … the message '404 Not Found' is displayed."

**What was done:** The privacy policy page is now published and returns a valid page (**HTTP 200**), reachable worldwide:
`https://pupikes.app/privacy/newslator/hw-privacy.html`
The earlier 404 happened because the page had not been deployed yet at review time; it is now live and contains the complete privacy policy for NewsLator (data collected, purpose, third parties/sources, user rights, contact e‑mail). Please re-open the URL to verify.

---

## Reply to review comment 2 — App content (rule 4.1 "only simple content")
**Moderator:** "Your app offers only simple content, which affects user experience."

**What was done / clarification — full feature list.** NewsLator is a full‑featured global news reader **and** translator, not a simple single-purpose reader:

1. **News from ~198 countries** worldwide — choose any country and read its current news.
2. **Multiple public sources per country** — official **RSS** feeds **+ Google News**, aggregated and de‑duplicated.
3. **One‑tap translation** of any headline/article into **15 languages** (into the user's own language).
4. **Read aloud (Text‑to‑Speech)** — listen to any article hands‑free.
5. **Save / bookmark** articles; **offline library** of saved items.
6. **Share** articles to other apps.
7. **Search** across the news.
8. **Category** browsing.
9. **15‑language user interface** with a language picker.
10. **Onboarding**, **Settings**, in‑app **Feedback**, and full **legal/privacy** compliance screens.

This combination (multi‑country aggregation + on‑device translation into 15 languages + text‑to‑speech + save/share/search) provides substantial, unique functionality well beyond a simple reader.

**Test‑environment note:** news is fetched from live public sources; if a specific source is momentarily unavailable in the test region/network, other countries and sources remain available — please try a few different countries (e.g., United Kingdom, Germany, Japan).

---

## For reviewer (кратък вариант за полето, ако има лимит)
NewsLator = global news reader + translator: news from ~198 countries via official RSS + Google News; one‑tap translation into 15 languages; read‑aloud (TTS); save/offline, share, search, categories; 15‑language UI. Privacy URL is now live (HTTP 200): https://pupikes.app/privacy/newslator/hw-privacy.html
