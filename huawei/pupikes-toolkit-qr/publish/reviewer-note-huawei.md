# Reviewer note — Pupikes Toolkit QR (Huawei)

## For reviewer
Addressed all three points from the latest review:

(1.20 — app icon) The store icon has been re-uploaded and is now identical for ALL listing languages (incl. Traditional Chinese HK/TW and English US) and matches the launcher icon shown on the device after install (original Pupikes icon, label "pupikes").

(3.1 — "Scan with Camera" reported "camera unavailable: Permission denied") FIXED. The Android CAMERA permission is now declared and the in-app scanner requests it correctly; camera scanning works on release regions. A fallback also handles devices that reject the exact rear-camera constraint. New version rebuilt with this fix.

(4.3 — distinctive functionality) Beyond plain scanning, the app generates QR codes from text/links, reads them from the camera OR from a picked image, and saves a personal registry of the user's own codes ("My codes") — all fully on-device, no account, no ads, 15-language UI. The save/registry + image-file reading + on-device privacy are the distinctive value versus existing apps.
