# Reviewer note — Pupikes Price Watch (Huawei)

Version 1.0027

## For reviewer
Fix for rule 3.1 ("Different modules such as Forex, World or Macro report no connection").
Root cause: those tabs read Yahoo Finance / Binance / CoinGecko public data, which is not reachable from the review network, so a tab could end with an empty "no connection" message.
What changed in 1.0027: the app now SHIPS WITH A BUILT-IN MARKET SNAPSHOT (inside the APK, generated at build time): quotes for all World indices, Commodities, Macro indicators, Forex pairs and Stocks, crypto Futures, RSI, Fear & Greed (with 12 months of history), crypto indices, the top-100 coin list, trending coins, and up to 5 years of daily price history for the charts. Every tab shows this snapshot immediately, with the label "Data as of <date> (built-in snapshot)". Live data (public API directly, then our own read-only relay https://pupikes.app/api/relay/) only refreshes the values when it is reachable; if it is not, the snapshot stays and the label says "live data is not reachable right now". No tab ever ends with an empty or error screen, also in airplane mode. No account, no personal data.

### How to test
1. Launch the app → pick a language → tap "Activate" → add any watch (e.g. BTC below 60000) → Save. You are now on the main screen with the top menu of 13 tabs.
2. Top menu → "World" → the table shows 10 world indices (S&P 500, Nasdaq, Dow Jones, Nikkei 225, DAX, FTSE 100, Hang Seng, CAC 40, …) with value and 24h change. The yellow label on top reads "Data as of <date> (built-in snapshot)"; when live data arrives it turns green: "Live data · <time>".
3. Tap any row (e.g. "S&P 500") → a price chart opens under the row with 1M / 6M / 1Y / 5Y buttons, the period change, low and high. Tap the row again to close it.
4. Top menu → "Commod." (gold, silver, WTI and Brent oil, natural gas, copper, platinum), "Macro" (VIX, US Dollar Index, US 5Y/10Y/30Y yields), "Forex" (EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, USD/CNY, EUR/GBP) and "Stocks" → each table is filled; every row opens its chart.
5. "Futures" → 18 coins with price, funding rate, open interest and long/short ratio; rows open a daily chart. "Greed" → Fear & Greed gauge + 12-month chart. "RSI" → RSI(14) for BTC/ETH/ZEC on 4h/24h/1w/1M with oversold/overbought flags. "Indices", "Market" (top 50), "Movers" (top gainers/losers 24h), "Trending" → all filled.
6. Airplane mode: turn on airplane mode, close and reopen the app, open World / Forex / Macro again → the same tables and charts are shown from the built-in snapshot with the label "… live data is not reachable right now". The ↻ Refresh button retries the live data.
7. "Watch" tab → "Check now": the watch gets a current price (live, or from the built-in snapshot when offline — then no alert is sent for an old price).

## Notes
- All data is public market data; the app is read-only (no trading, no wallet, no payments). Not financial advice.
- The relay only forwards public GET requests to a fixed list of market-data hosts.
