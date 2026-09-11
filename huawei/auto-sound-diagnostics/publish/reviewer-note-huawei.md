# Бележка за модератора (Huawei) — auto-sound-diagnostics

Version 1.0021

## For reviewer
Fixed (v1.0021) — "No microphone access" reported on Nova 9 / EMUI 13 (and earlier on Mate 30 Pro / EMUI 12) even though the permission was granted.

Root cause: the EMUI system WebView refused `getUserMedia` for the in-app page even after the RECORD_AUDIO runtime permission was granted. The app no longer depends on the WebView microphone API at all:

- Recording is now NATIVE: the Android activity records with `AudioRecord` (16 kHz, mono, 16-bit PCM) into a temporary WAV file in the app's private cache and hands the samples to the analysis code. The runtime permission is still requested with the standard Android dialog before the first recording.
- The acoustic analysis (frequency bands, knocking/ticking, squeal, grind, hiss, rough running) runs on the device from that WAV buffer with the app's own FFT — no AI, no network, identical results to the previous in-browser analyser.
- The temporary file is deleted immediately after the analysis; nothing is uploaded. The only permission used is RECORD_AUDIO (MODIFY_AUDIO_SETTINGS is declared for audio-route compatibility).
- If, for any reason, the native recorder cannot start (not a permission problem), the app falls back to the previous WebView path with default audio constraints.

The privacy policy and store description were updated to say that the recording is a temporary file deleted right after the analysis.

## How to test
1. Launch the app → pick a language → Pupikes intro → accept Terms/Privacy → tick "I understand" on the safety screen → Continue.
2. Home screen: choose "Where is the sound from?" (e.g. Engine) and "When do you hear it?" (e.g. At idle).
3. Tap "Record & analyze". On the first run Android shows the standard microphone permission dialog — tap Allow.
4. The status reads "Listening… hold the phone near the sound" and the green level bar moves with the sound for about 4–5 seconds (make some noise near the phone, e.g. tap the desk or hum).
5. The status changes to "Analyzing the sound…" and the result cards appear: "Possible causes" — up to 4 cards with a match percentage, an urgency flag (For info / Check soon / Urgent), "What I hear" and "What to do". In a quiet room the top card is normally "Normal / no obvious fault".
6. Tap "New recording" to clear the result and record again; change Where/When and repeat — the ranking changes with the context.
7. Deny the permission once to see the graceful message "No microphone access. Allow the microphone for the app and try again." — allowing it in Settings and tapping the button again works without restarting the app.
8. Language: the globe button at the top right reopens the language list (15 languages); the result texts are translated to the chosen language (translation needs the internet; without it the Bulgarian source text is shown).

Tested on Android 12/13 with the EMUI WebView refusing getUserMedia: the native recorder records and the analysis completes.
