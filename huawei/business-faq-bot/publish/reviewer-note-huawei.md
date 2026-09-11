# Бележка за модератора (Huawei) — business-faq-bot
Version 1.0021

## For reviewer
Reply to rule 3.1 ("Test console → Fallback error appears"). The reply you saw was not a failure: it is the bot's normal answer when no FAQ rule matches (the question is handed to a person). The previous build shipped only 3 sample rules in Bulgarian, so an English test question could never match a rule. Version 1.0021 fixes the root cause:

- Sample knowledge base on first launch: 15 typical customer questions (opening hours, address, prices, delivery, delivery time, returns, payment, warranty, contact, booking, parking, discounts, availability, holidays, greetings) in the interface language (15 languages), clearly marked "example", removable with one tap.
- Tolerant matching: partial words, synonyms and typos still find the right rule ("can i pay by card", "wher are you located", "is there parkng").
- Handoff to a person is shown as a normal chat reply with a neutral label and is counted in the statistics as "Handed to a person" — no red label, no "error" wording anywhere.
- Test console shows question and answer as chat bubbles and offers sample questions ("Try:").
Everything runs on the device; no account, no network needed (works in a fully offline test environment).

## How to test
1. Launch the app → choose a language (e.g. English) → Start → Activate → Permissions (may be skipped) → Dashboard.
2. Dashboard → Test console → type "What are your opening hours?" → Test. Expected: the customer question and the bot reply "We are open Monday–Friday 09:00–18:00 and Saturday 10:00–14:00…" appear as chat bubbles with the label "rule: Opening hours"; the counter "Answered" increases and the question appears in the Reply log.
3. Test console → tap any chip after "Try:" (e.g. "How much does it cost?", "Do you deliver?"). Expected: an immediate answer from the matching rule.
4. Test console → type a question with a typo or synonym, e.g. "can i pay by card" or "wher are you located". Expected: the correct rule still answers (Payment methods / Address).
5. Test console → type something with no rule, e.g. "asdf qwerty". Expected: a polite reply "I do not have a ready answer to this question yet. A colleague will continue this conversation shortly…" with the neutral label "handoff to a person" (this is the designed behaviour, counted under "Handed to a person").
6. Knowledge tab: the "Sample knowledge base" card lists 15 example entries (badge "example"). "Remove examples" clears them; "Load examples" brings them back in the current language. Add your own entry (name, keywords, answer) and test it in the console.
7. Demo chat tab: tap a quick button (e.g. "What are your opening hours?") or type a question → the bot replies in the chat, exactly as it would in a real channel.
8. Change the language with the globe button (e.g. to 繁體中文 or Deutsch) → the sample questions, sample knowledge base and the bot's greeting follow the new language; e.g. in German type "Wie sind Ihre Öffnungszeiten?" → the opening-hours rule answers in German.
9. Channels and Permissions tabs are optional (real messenger channels need a separate setup); nothing in the core flow needs the network or an account.
