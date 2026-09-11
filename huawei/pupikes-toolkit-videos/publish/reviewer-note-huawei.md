# pupikes-toolkit-videos — Reviewer note (Huawei AppGallery)
Version 1.0021

## For reviewer
Reply to rule 4.3 ("a video editor/converter, similar to existing apps; improve interaction design and feature depth").

Version 1.0021 changes the core of the app. It is no longer a converter: the first screen is now **"How-to video"**, a phone-made step-by-step guide builder. You shoot or pick a few clips/photos as STEPS, and the app turns them into a structured lesson with chapters (Step 1, 2, 3…), a caption per step, arrows/circles/underlines drawn on the frame, an automatic title screen and a final recap screen, an optional voice-over and generated background music. It then exports three things from the same project: a **video lesson (MP4)**, a **GIF guide** and a **printable instruction sheet (PDF / PNG)** with the frames and the text. We are not aware of another app that builds one guide and exports it as a video, a GIF and a print sheet at the same time.

New in 1.0021:
- "How-to video" is the first tab after start: steps list, reorder (↑/↓), remove, per-step caption and seconds on screen, clip start second for video steps.
- On-frame marks editor: arrow, circle, underline, 4 colours, undo/clear; marks are drawn in gradually in the video.
- Title screen (template icon, title, step thumbnails) and final screen (check mark + numbered recap of all steps), progress bar and step badge "Step 2/5".
- Templates: repair, recipe, product/review, exercise (colours, music style, caption hints).
- Caption/voice language can be any of the 15 languages, independent of the interface language (Arabic is drawn right-to-left).
- Voice-over per step: record from the microphone (goes into the MP4, music is ducked under the voice), or built-in speech synthesis that reads the captions in the preview; "Record the synth voice" puts the synthesized voice into the video.
- Background music generated inside the app (calm / upbeat / cozy), nothing downloaded.
- Exports: MP4 (9:16, 16:9 or 1:1; 10 or 20 fps; built-in ffmpeg engine), GIF, PDF sheet (A4 pages), PNG sheet. All on the device; nothing is uploaded; no account.
- Work is saved automatically on the device (IndexedDB).
- The previous operations remain in the second tab "Video tools" (trim, MP3, rotate/mirror, speed, mute, 720p/480p, compress, frame → JPG, GIF, format conversion). Fixed: "Frame → photo (JPG)" could hang; it now uses the device decoder.

New permission: RECORD_AUDIO (+ MODIFY_AUDIO_SETTINGS) — only for the optional voice-over; it is requested only when the user taps "Record voice". Nothing is recorded in the background and nothing leaves the device.

### How to test
1. Start the app → choose a language → the first screen is "How-to video". A clearly marked SAMPLE guide ("Quick 5-minute omelette", 4 illustrated steps with captions and marks) is already loaded, so every function can be tried without your own files.
2. Tap "▶ Play the lesson" → expected: title screen with step thumbnails, then Step 1…4 with badge, caption and animated arrow/circle/underline, background music, final recap screen.
3. Tap a template chip (Repair / Product / Exercise) → expected: the sample switches to that template (new title, captions, colours, music).
4. Change "Language of captions and voice" (e.g. to Deutsch or العربية) → expected: the sample captions and the "Step x/y" badge change to that language; the interface stays in its own language.
5. On a step tap "✏ Mark on the frame" → pick Arrow/Circle/Underline and a colour → drag on the picture → expected: the mark appears on the frame and in the thumbnail; "↶ Undo" removes it.
6. On a step tap "🎙 Record voice" (allow the microphone) → speak → tap "⏹ Stop" → expected: a "▶ Voice x s" button appears; the step becomes at least as long as the voice. "🔊 Read the caption" reads the caption aloud.
7. Under "Export the lesson" tap "🎬 Video lesson (MP4)" → expected: progress (drawing frames → music → encoding), then the video appears on the page and the file is saved/shared. Repeat with "🎞 GIF guide", "📄 Printable sheet (PDF)" and "🖼 Sheet as image (PNG)" — the PDF preview (A4 page with numbered steps) appears on the page.
8. "📷 Shoot a step" / "🎥 Record a clip" open the camera; "➕ Add clips/photos" adds files — each file becomes a new step. "🗑 Delete the sample and start your own" removes the sample.
9. Second tab "Video tools": choose a video → operation "Frame → photo (JPG)" → "Run" → expected: a JPG is saved in about a second (this used to hang).

The app also contains the 15-language interface and the Pupikes legal/help footer, described in the store listing.
