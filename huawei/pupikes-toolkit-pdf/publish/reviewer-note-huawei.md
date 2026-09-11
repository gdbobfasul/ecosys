# Reviewer note — Pupikes Toolkit PDF (Huawei)
Version 1.0027

## For reviewer
Reply to rule 4.3 ("PDF Generator, similar to existing apps; improve interaction design and feature depth").

Version 1.0027 gives the app a NEW CORE that no other app on AppGallery offers — "Pupikes Sealed Docs", a closed circle for documents (lawyer ↔ client, notary, relatives, business partners, close friends). It is the first screen after start; the PDF tools remain as secondary tools below it. Everything is on-device, there is NO server, no relay, no account:
- My QR: on first use the phone creates its own key pair (WebCrypto: ECDH P-256 for key exchange, ECDSA P-256 for signatures); the public key is shown as a QR (and can be shared as a picture). The private key never leaves the phone.
- Groups gathered in person: the organizer scans the QR of every member (10 people = 10 scans), the app generates a random 256-bit group key, seals it for each member with that member's public key (ECDH + HKDF + AES-256-GCM) and shows one QR per member to hand out; each member scans their own QR and receives the decryption key only on their device. A sealed key file (.pupkey) covers an absent member.
- Sealed files: any file (document, photo, anything) chosen in a group is encrypted with the group key (AES-256-GCM), carries the sender's ECDSA signature and the member roster fingerprint check, and is packed as a .pupsealed file. It leaves the phone through the Android share sheet over whatever channel the user already has (Telegram, WhatsApp, e-mail, Bluetooth/Nearby) — the app never talks to a server. On the receiving phone "Received file" opens the package, checks the signature (shows who sent it and that it was not modified) and shows/saves the decrypted file only there.
- Group feed: a mini chat-like timeline per group (sent/received files with sender, size, time, verification badge), open/save/share of the decrypted file, re-share of the sealed package, members list with fingerprints.
- Member changes: adding or removing a member creates a new key version by the same scanning ceremony; older files still open with the previous key version.
- Optional app PIN: with a PIN the local key store is encrypted (PBKDF2 → AES-256-GCM) and the circle opens only after the PIN.

New permission: android.permission.CAMERA — used only to scan the members' QR codes and the group-key QR during the in-person ceremony (no photos are stored or uploaded). No network permission is needed for the new core.

Together with the existing PDF tools (merge, split/extract, rotate, page numbers, pages → PNG, watermark, visual signature), PDF studio, PDF compression and PDF → Word (.docx), the app is a private document circle with a complete on-device PDF workbench, not a PDF generator. 15-language interface; the store listing describes the new features.
