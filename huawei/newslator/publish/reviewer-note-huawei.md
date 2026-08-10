# NewsLator — Response to review / For reviewer (Huawei AppGallery)
Package: `com.pupikes.newslator.hw` · Version 1.0019 · Category: News

> Тази бележка отива в полето **„For reviewer"** при повторно подаване. По ВСЯКА забележка на
> модератора — какво е направено, за да знае рецензентът. (Реалните забележки са в
> `app-shared/moderation-huawei.json` → apps.newslator, събрани от Workspace → App review results.)

---

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
