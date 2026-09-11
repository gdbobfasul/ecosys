# routine-bot — Reviewer note (Huawei AppGallery)
Version 1.0023

## For reviewer
Reply to rule 4.3 ("a Routine Planner, similar to existing apps; improve interaction design and feature depth").
Version 1.0023 gives the app a new core that ordinary planners do not have: "Family Day" — one shared day for the whole family on ONE device. It is now the first screen after start; the previous personal-planner features stay in the "Home" tab of the bottom bar.

What is new in 1.0023:
- Family members with roles (child / parent / grandparent), each with an avatar and a colour.
- Tasks with points for the kids (time, repeat days or a single date). The child taps "Done" → the task waits for a parent's approval (optional 4-digit parent PIN) → the points are added.
- Reminders in the parent's OWN VOICE: a parent records a short phrase (up to 10 s, stored only on the device) and attaches it to a task; at the task's time the phone plays that recording. Without a recording the robot voice reads the task in the interface language. A local notification is scheduled for every task that has a time.
- "Who did what today" board: progress bar per person, points today and points balance.
- Weekly ranking (medals) and rewards: points are redeemed for rewards agreed in the family; reward history with "Given" marking.
- Shared family calendar for the next 14 days (events for everyone or for selected members; one-off tasks appear there too).
- Sharing between phones with no server and no account: export the family day as a code or file and import (merge) it on grandma's or the other parent's phone.
- The morning briefing now contains a "Family today" line, and its motivational thought is now in the interface language (before it was Bulgarian only).

These features work fully offline: nothing is sent over the network and there is no account. On first launch the app shows clearly marked SAMPLE data (a small family with tasks, points, rewards and events) so every screen can be tried at once; "Delete sample data" removes it with one tap.
Permissions: no new permissions. RECORD_AUDIO was already declared (voice dictation) and is now also used to record the parent's phrases; POST_NOTIFICATIONS and exact alarms are used for the task reminders.

## How to test
1. Install and open the app → choose a language → accept the legal screen. The first screen is "Family Day" (sub-tab "Today") filled with sample data (orange "sample data" card at the top).
2. "Today" → section "Who did what today": on a child's task press "✓ Done" → it shows "⏳ waiting for approval" and appears in the card "Waiting for a parent's approval" at the top → press "✓ Approve" → the task shows "✅ approved" and the child's points increase.
3. Press 🔊 next to any task → the task is read aloud (for example "Emma, it's time: Brush your teeth"), or the parent's recorded phrase is played if one is attached.
4. Sub-tab "People & voices" → card "Parents' voices" → type a phrase name → press "🎙 Record" → allow the microphone → say a short phrase → press "⏹ Stop and save" → the phrase appears in the list (▶ plays it back).
5. Sub-tab "Tasks" → "New task": choose a child, type a task, set the time 1–2 minutes from now, choose the recorded phrase under "Whose voice plays the reminder" → "Add". Keep the app open: at that minute the parent's recording plays and a banner appears. With the app closed, a notification arrives at that time.
6. Sub-tab "Rewards" → "This week's ranking" shows medals and bars → under "Rewards agreed in the family" pick a child and press "Redeem" on a reward → the balance decreases and the item appears in "Reward history" (press "Given ✓").
7. Sub-tab "Calendar" → "New family event": title, date and time, participants → "Add" → it appears in "Shared calendar — next 14 days"; today's events also appear on "Today".
8. "People & voices" → "Share between phones" → "📋 Copy code" → paste it into the field below → "Import" → the message "Imported: N members, M tasks" (on a second phone the data are merged).
9. Optional: "People & voices" → type a 4-digit parent PIN → "Save"; the "Approve" buttons on "Today" now require the PIN ("Unlock").
10. Bottom bar "Home": the previous features — voice task input, "👁️ Preview the briefing now" (weather, agenda, family line, motivational thought in the interface language), habits & streaks, reminders, events, activity log; "Notes" tab: notes read aloud.
11. "Delete sample data" (orange card on Family Day) clears the sample family; then add your own members in "People & voices".
