# pupikes-toolkit-sound — Reviewer note (Huawei AppGallery)
Version 1.0020

## For reviewer
Reply to rule 4.3 ("audio formats editor, similar to existing apps; improve interaction design and feature depth").
Version 1.0020 replaces the single format converter with a full on-device SOUND & VOICE STUDIO. It is the first screen of the tool: sound and voice modulators and modifiers that can be stacked one on top of another, with before/after preview, microphone recording and saving. Nothing is uploaded, there is no account, everything runs on the phone (WebAudio + own DSP algorithms; the bundled ffmpeg engine is used only to read exotic formats and to save MP3/OGG/M4A).
What is new and working in this build:
1. Voice modulators (one tap): Robot (ring modulation), Chipmunk (high voice), Deep voice, Telephone, Radio (with static), Hall, Cave, Choir, Alien, Clean noise.
2. 21 individual effects with sliders, each can be applied on top of the previous result (effect chain with Undo and Reset): pitch shift without tempo change (phase vocoder), tempo without pitch change, speed, robot, telephone, radio, vibrato, tremolo, chorus, echo, reverb (impulse convolution), 3-band equalizer, spectral noise reduction, reverse, trim, fade in/out, volume, normalize, mono.
3. Sources: any audio file from the phone, a microphone recording (up to 5 minutes, PCM on the device), or a built-in example that is synthesized on the device (clearly marked "Example — not your file") so the Studio shows its work right after a clean install, with no file and no network.
4. Before/after: two waveform views (original and result) and "Original" / "Result" playback buttons; the chain of applied effects is shown as chips.
5. Save/share as WAV (instant, lossless) or MP3 / OGG / M4A (through the built-in engine); the phone's share sheet opens.
6. The previous format converter (MP3/M4A/WAV/OGG/FLAC → MP4/MP3/WAV/OGG) remains as the secondary "Converter" tab.
The app also contains a 15-language interface, described in the store listing.

## How to test
Choose any language on the first screen → tap the only card "Sound & Voice Studio".
1. Example and voice modulators: the Studio opens with the example already loaded (label "Example (synthesized on the device — not your file)", two waveforms "Before"/"After"). Tap "▶ Original" to hear it. Tap "🤖 Robot" → a progress bar runs for a moment, the "After" waveform changes, the chain shows "🤖 Robot" and the status says "Done". Tap "▶ Result" → robot voice. Try "🐿 Chipmunk", "🐻 Deep voice", "☎ Telephone", "🕳 Cave" the same way — each one is added on top of the previous result.
2. Individual effects: in "Effect / modifier" choose "Echo" → move the sliders (delay, feedback, mix) → "Apply effect" → listen with "▶ Result". Choose "Noise reduction (spectral)" → "Apply effect" → the light hiss in the example disappears. Choose "Pitch (tempo unchanged)" → +5 semitones → "Apply effect" → same length, higher voice.
3. Chain: after several effects the chips are listed under "Applied effects (chain)". "↶ Undo last" removes the last one (recomputed), "Reset to original" clears all.
4. Your own file: "🎵 File" → pick any MP3/M4A/WAV/OGG from the phone → the waveform appears → apply effects as above.
5. Microphone: "🎙 Record" (or the "🎙 Record" tab) → "● Start recording" → allow the microphone → the level bar moves and the timer counts → "■ Stop recording" → the status says the recording is loaded into the Studio → "→ To the Studio" → the recording is the source; apply "🤖 Robot" and press "▶ Result".
6. Save: choose "WAV" in "Save format" → "💾 Save / share" → the share sheet opens with "<name>-studio.wav"; choose "MP3" → the built-in engine converts (progress bar) and the share sheet opens with the MP3.
7. Converter tab (secondary): "🔁 Converter" → "🎵 Choose an audio file" → target format → "Convert" → the converted file is saved/shared.

Permissions: RECORD_AUDIO (and MODIFY_AUDIO_SETTINGS) are new in this version and are used only for the "Record" function when the user taps "Start recording"; the recording stays on the device. No account, no ads, no in-app purchases.
