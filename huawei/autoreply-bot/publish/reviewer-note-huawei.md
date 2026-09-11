# autoreply-bot — Reviewer note (Huawei AppGallery)
Version 1.0021

## For reviewer
Reply to rule 4.3 ("similar to existing apps; improve interaction design and feature depth").
Pupikes Auto Answer is no longer just an auto-reply robot: version 1.0021 turns it into "Auto Answer & Guardian" — the app answers messages for you AND watches over you when you go silent. We are not aware of any auto-reply app on AppGallery that does this. Everything runs on the device; no account, no server of ours is required.
New main screen "Guardian" (first tab after start):
- "Are you OK?" check: if the phone is untouched for N hours (set by the user; sleep hours are skipped), the app first asks the USER with a loud signal, vibration, a full-screen prompt and a big "Yes, I am OK" button. Activity = touches in the app, opening the app, and messages the user sends in our chat.
- Escalation: with no answer within M minutes the app sends the chosen loved ones a message with the last-activity time, battery level, location (optional) and who wrote urgently in the meantime. It uses the channels the app already replies through: our Pupikes chat (automatic), the loved one's latest WhatsApp/Viber/Messenger notification via direct-reply (automatic, only if Notification access was granted), otherwise a ready SMS (opens the SMS app pre-filled) / share, plus a local notification with the alert text for whoever picks up the phone.
- Check log, "guardian active" indicator, next-check time, "simulate silence" test (asks immediately; a TEST alert goes out after 60 s), "show alert" preview, queue of alerts to send manually.
- Delegate for urgent messages: messages with keywords (or from a VIP group) are forwarded to a chosen person and the sender receives "<name> will answer you".
- Reply in the sender's language: the language of the incoming message is detected on the device (script + frequent words of the 15 languages, no network) and the robot replies with the built-in template in that language; a custom text is translated once (MyMemory, with a relay fallback) and cached.
The previous functions (quiet hours, vacation mode, template library, VIP groups, limits, statistics, simulation) remain as the "auto answer" tabs.
Honest limitation: the app has no background service. The check runs while the app is open or in memory; as a backstop the "Are you OK?" and "no answer" reminders are scheduled as local notifications (system alarm) and the alert is sent as soon as the app is opened again.
Permissions: ACCESS_COARSE/FINE_LOCATION are requested ONLY when the user turns on "Include location in the alert" (optional); VIBRATE is used for the loud "Are you OK?" signal. No contacts, no SMS permission, no reading of system SMS.
15-language interface; store description updated in all languages.
