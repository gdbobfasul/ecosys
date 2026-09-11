# Бележка за модератора (Huawei) — authenticator
Version 1.0025

## For reviewer
Reply to rule 4.1 ("the app offers a single function / template").

Pupikes Auth & Passwords is NOT a single-function app. Its core is (1) an encrypted PASSWORD MANAGER, (2) a 2FA AUTHENTICATOR (TOTP / HOTP / Steam Guard) and (3) a KEY CONVERTER between apps — 2FA keys move in and out as QR codes, Aegis (plain or encrypted), Google Authenticator migration QR, 2FAS (plain or encrypted), otpauth lists and JSON; browser passwords move in and out as Chrome / Edge / Firefox CSV; crypto wallet seed phrases and keys are organised by 32 built-in wallets plus up to 20 custom ones; SSH, EVM networks and ERC-20 tokens have their own tabs. Everything is stored only on the device in an AES-256-GCM vault (master password + biometrics); no account, no server, no ads.

Version 1.0025 adds a third main tab, SECURITY, with three new tools:
- SECURITY AUDIT — every password is checked for breaches (Have-I-Been-Pwned k-anonymity: only 5 characters of the SHA-1 hash leave the device, once per app launch; without internet the check is skipped and the rest still works offline), strength (length, character classes, keyboard sequences, common-password list, contains login/site), reuse across entries, whether a 2FA code exists for the same site, and password age. Result: overall score 0–100, per-entry score, and an action plan sorted by severity (breached → reused → weak → old → no 2FA); each row opens the entry.
- LINK CHECK (anti-phishing, fully offline) — paste a link from an email/message: it is compared with the sites saved in the vault (lookalikes via confusable characters o/0, l/1, rn/m, Cyrillic a/e/o/p/c/x/y…; punycode xn-- decoded; mixed alphabets; your brand as a subdomain of a foreign domain; edit distance 1–2), plus IP-as-host, "@" trick, non-standard port, no HTTPS, abused TLDs. Verdict: your site / no signs / suspicious / DANGER, with reasons.
- LEGACY PACKAGE — an encrypted file (PBKDF2-SHA256 210 000 iterations → AES-256-GCM) with chosen sections of the vault and written instructions for a trusted person; separate package password with an optional unencrypted hint; the recipient opens it in the same app and can import the data into their own vault.

Sample data: a clean install is empty by design (it is a vault). Tap "Try with sample data" (Security tab or Security audit screen) to add clearly marked "Sample:" records — 5 passwords (including weak, reused and breached ones), 2 2FA codes, a MetaMask wallet with the public BIP-39 test phrase and an SSH host. "Remove sample data" deletes them with one tap.

## How to test
1. First start: choose a language → create a master password (e.g. 12345678) → the app opens on the Authenticator tab. Bottom bar: Authenticator · Passwords · Security.
2. 2FA codes: "+" → Scan QR / Upload image / Enter manually / Import file. Manual: issuer "GitHub", secret "JBSWY3DPEHPK3PXP" → Save → a 6-digit code rotating every 30 s; tap the code to copy it.
3. Passwords tab → sub-tabs Passwords · Wallets · QR codes · SSH · Networks · Tokens. "+" adds an entry (site, password, login, note, link, other code). Top row: import CSV from Chrome/Edge/Firefox, export to Chrome / Firefox, find duplicates.
4. Wallets sub-tab: grid of 32 wallets (Ledger, Trezor, MetaMask, …) + "New wallet" (custom, up to 20). Tap a wallet → "+" → label, seed phrase, passphrase, private key, address table.
5. Key conversion: Settings (gear) → Import: JSON, Aegis (encrypted asks for the file password), 2FAS, otpauth list, "Other ways" (QR/camera); Export: JSON, Aegis, 2FAS, otpauth list, Google Authenticator migration QR, all accounts as QR images in a .zip; full encrypted backup / restore; passwords CSV for browsers; wallet backup.
6. Security tab → "Try with sample data" → the tab shows counters for every section.
7. Security audit: Security tab → tap the score card (or "Run") → with internet: overall score, tiles Breached/Weak/Reused/No 2FA/Old, action plan (e.g. "Sample: Webmail — breached password, seen N times", "reused password (2 entries)", "weak password"), list of all passwords sorted weakest first. Tap a plan row → the password editor opens. Without internet the header says the breach check was skipped; everything else is computed offline.
8. Link check: Security tab → Link check → paste "https://paypal.com.secure-login.tk/verify" → Check → "DANGER — likely phishing" with reasons (your site paypal.com is only a subdomain of another domain; abused TLD .tk). Paste "https://github.com" → "This is your site" + the matching entry. Paste "https://xn--pypal-4ve.com" → punycode decoded, mixed alphabets, lookalike of paypal.com.
9. Legacy package: Security tab → Legacy package → name "Maria", instructions, tick the sections, package password (8+ characters, different from the master) + hint → "Create and save the package" → the system share/save dialog receives pupikes-legacy-Maria.json. "Open a package" → choose that file → enter the package password → instructions and record count are shown → "Import into the vault".
10. Search (magnifier in the top bar) finds any field across all tabs; secrets are hidden behind the eye icon and copied with one tap.
11. Security tab → "Remove sample data" removes every "Sample:" record.

Permissions: CAMERA (QR scanning), USE_BIOMETRIC (unlock). Network is used only by the breach check (api.pwnedpasswords.com, 5 hash characters; falls back to our relay pupikes.app when the direct host is unreachable) — nothing else leaves the device.
