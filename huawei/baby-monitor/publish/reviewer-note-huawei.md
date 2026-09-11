# Reviewer note — Pupikes Baby Radar (Huawei)
Version 1.0027

## For reviewer
Reply to rule 4.3 ("similar to existing apps; improve interaction design and feature depth").
Version 1.0027 turns the app into "BabySecuritySitter" — a two-phone baby sitter for a child up to 3 years, which is now the FIRST screen after start. The first screen asks which phone this is: "Phone by the child" or "Parent's phone"; the two phones connect with one pair key over the existing relay channel (no account, no contacts).
Phone by the child (new "Sitter" tab):
1. Phrases in the parent's own voice — the parent records short phrases once ("sleep, sweetie", "mum is here", "everything is fine", custom) with the microphone (MediaRecorder); these are real recordings, not speech synthesis, stored only on this phone, played in a chosen order.
2. Built-in songs synthesised on the device with WebAudio (no audio files): Brahms's Lullaby, "Twinkle, little star", a quiet cradle song, plus the existing melody and rain/sea/fan/heartbeat noises.
3. "Lulling" scenario: song (N minutes) → the recorded phrases in rounds with pauses → sleep noise (N minutes), with the volume fading smoothly from a start level to an end level and then out; the screen can be dimmed (double-tap to exit).
4. Sleep watch through the microphone: quiet / fussing / crying / long silence, with adjustable cry threshold, seconds, cooldown and a live level meter for calibration. On crying the phone reacts on the spot (a phrase in the parent's voice or a song) and immediately sends the alert to the parent's phone, optionally with a camera photo; while crying continues, the alert repeats after every cooldown.
5. Status heartbeat every 10 s (state, sound level, minutes of quiet, scenario phase) and the phrase catalogue, so the parent's phone shows live data.
Parent's phone (same tab in the "Parent" role):
6. Live status of the child (sleeping / fussing / CRYING), sound-level bar, quiet-for minutes, cries tonight, scenario phase with countdown, last update time and a stale-data warning.
7. Loud repeating alarm with strong vibration on critical alerts (crying, long silence) with a "Stop the alarm — I'm going" button; the description of what happened and the last photo from the room.
8. "Talk" — the parent sends commands back to the phone by the child: play a specific recorded phrase, a song, a noise, request a photo now, restart the lulling, silence. Commands go through a second queue on the same relay (pair key + "-p") and are confirmed back.
9. Night log — every event of the night with time (start, fussing, crying, reactions, commands, quiet again, stop with duration and cry count), on both phones.
The Care tab (noise chart, soothing sounds, night light, diary, growth, vaccines) and the camera watch from 1.0026 remain as secondary tabs. Honest limits are stated in the UI: live audio streaming does not pass through the channel (only level, alerts and photos), and the app is not a certified safety device. No new permissions: CAMERA and RECORD_AUDIO were already declared; the microphone is used for the recordings and the sleep watch, the camera only for the photo on request or on crying. All features are functional on the device, in the 15-language interface, and are described in the store listing ("New features"). Previous fix (rule 1.20, identical icon in all languages) remains in place.
