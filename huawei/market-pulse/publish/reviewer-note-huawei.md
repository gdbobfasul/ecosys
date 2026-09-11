# market-pulse — Reviewer note (Huawei AppGallery)
Version 1.0021

## For reviewer
Fix for rule 3.1 ("Cryptocurrencies → select any coin → 3 yrs ago / 5 yrs ago / By date → No data connection. Try again").

Root cause: the multi-year price history of a coin came only from public market APIs (Binance / CoinGecko / Yahoo Finance). When those hosts are not reachable from the review network, periods older than the locally cached year had no data and the app showed the "No data connection" message.

What changed in 1.0021:
- BUILT-IN HISTORY. The app now ships 5 years of daily closing prices for EVERY instrument (top 50 cryptocurrencies by market cap, gold/silver/platinum, 9 stock indices, 4 real-estate funds) inside the APK (reference/history/*.json, ~0.9 MB). "1 / 2 / 3 / 5 years ago" and "By date" are computed from this built-in history first, so they work instantly in every release region and even in airplane mode. Live data (public API directly, then through our own read-only relay https://pupikes.app/api/relay/) only tops up the most recent days.
- The "No data connection" message is no longer shown when the public APIs are unreachable: the analysis is rendered from the built-in history and a small line above the period buttons says "Built-in history up to <date> — live data is unavailable right now".
- A date range earlier than the available history shows an honest message "No data for this period — the history starts on <date>" instead of a connection error.
- The cryptocurrency list grew from 14 to the top 50 coins by market capitalization.
- News (Google News RSS) also fall back to the relay when the public host is blocked.
No account, no personal data is sent — the relay receives only the public market URL. Everything else (analysis, indicators, educational outlook) runs on the device.

## How to test
1. Launch the app → choose a language → accept the legal notice → the dashboard opens (Buffett indicator, crash-risk card, four markets).
2. Tap "Cryptocurrencies" → the list shows 50 coins (BTC, ETH, BNB, XRP, SOL, …).
3. Tap "BTC" → the detail screen loads within ~1 second: current price, chart and analysis for "Now". If the public APIs are blocked, the line "📦 Built-in history up to 2026-09-10 — live data is unavailable right now" appears; the analysis is still complete.
4. Tap "3 yrs ago" → expected: chart + RSI/trend/momentum reading for the two months ending exactly 3 years ago, plus "What happened next: 30d / 90d" and "Key events in the period". No error message.
5. Tap "5 yrs ago" → expected: the same for the period 5 years ago (history covers June 2021 → today for BTC).
6. Tap "By date" → enter 2022 / 5 → 2022 / 8 → OK → expected: analysis of May–August 2022 with events of that period (Terra/Luna collapse, rate hikes).
7. Enter a date before the history starts (e.g. 2015 / 1 → 2015 / 6 → OK) → expected: the notice "No data for this period — the history of this instrument starts on 2021-06-04" (not a connection error).
8. Optional: enable airplane mode and repeat steps 2–6 → identical result from the built-in history.
9. Go back → "Gold & metals" → "XAU/USD" → "1 yr ago" / "5 yrs ago" → the same behaviour for non-crypto instruments (Yahoo Finance history is built in as well).
10. Scroll down in any detail screen → "Educational outlook", "Probability table", "Key events", current news (news need a network; without it the section is simply empty).
