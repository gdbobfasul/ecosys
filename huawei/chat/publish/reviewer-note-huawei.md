# chat — Reviewer note (Huawei AppGallery)
Version 1.0021

## For reviewer
Reply to rule 4.3 ("similar to existing apps; improve interaction design and feature depth").
Pupikes Chat is NOT a messaging app. Messaging is only the last of its seven functions; the core is a help-and-services platform built on the people physically around the user. Real-time chat exists so that the people who found each other through the platform can talk. Version 1.0021 rewrites the store listing (brief, full description and "New features" in every language) so the listing describes the whole platform; the app itself is unchanged and connects to the live service.

What the app does and where to find it (bottom menu on every screen; register first, see below):
1. HELP button (emergency) - Profile > tab "Emergency help", big red button "SEND EMERGENCY HELP". One tap sends the user's exact GPS location to the administrator's emergency desk and to the nearest VERIFIED providers (doctor, hospital, ambulance, police). No payment is asked at the moment of need: a prepaid emergency service is consumed, otherwise 15 days are taken from the subscription; limit once a month. The same tab shows the current state (prepaid yes/no, remaining days, what will happen on tap) and a button to prepay the emergency service.
2. Searches nearby - menu "Search": (a) search by distance with min/max km, age, gender, height; (b) "Search by need" (fixed 50 km radius) - the user picks what he NEEDS and gets the people nearby who OFFER it. 11 categories and about 86 services (craftsmen, services, food and drink, places and stores, venues, sports, translator, mood and company, incidents, emergencies), all labels in 15 languages. The other side is Profile > tabs "What I offer" and "Current need".
3. Verified professionals - Profile > "What I offer" > link "Verification": the user applies with organisation name, licence number and a document; the administrator approves or rejects; approved accounts get the "verified" badge. Only verified accounts can offer doctor, hospital, ambulance or police - these services are hidden from the normal offer list.
4. Signals - menu "Signals": report an incident, an accident, a danger or a useful place (pharmacy, repair shop, gym, restaurant...) near the user's location; one signal per day.
5. Tasks - menu "Tasks": "live hands on site" and "is it true" (cross-border check). Author writes a task with a reward and publishes it; a doer takes it (small fee by country); task chat between the two; the doer locks the chat, does the work and sends a report with a photo; the author confirms; non-payment or disputes go to the administrator, who can ban.
6. Find your other half - menu "Matchmaking": own criteria (height, weight, age, hair, eyes...), balance of searches and invitations.
7. Real-time chat - menu "Chat": conversations with contacts, file sending, subscription and payments (menu "Payment"), 15 interface languages, privacy: phone number hidden, minors never shown in search, no search by name.

How to test (ready test account, no payment needed):
- Log in with phone 359888100021 and password Pupikes2026x (subscription prepaid until 2026-12-10; no SMS code). A second account for two-sided tests: 359888100022 / Pupikes2026x (Maria Ivanova).
- Registration of a new account is also possible ("Register": phone, password, full name, gender, country), but a new account needs the monthly subscription (card) before it can log in - please use the test account above.
- After login the bottom menu of every page has: Home, Chat, Search, Matchmaking, Tasks, Signals ("Report"), Profile, Payment, and the red "Emergency help" button.
1. HELP: Profile > tab "Emergency help" > the tab shows "remaining subscription days: 89" and the active red button "SEND EMERGENCY HELP". Tapping it (allow location) sends the request to the emergency desk and takes 15 days from the subscription (limit once a month) - expected: confirmation text under the button.
2. Search: menu "Search" > "By need" > allow location > choose category "Craftsman" and "Plumber" > "Search" - expected: list of people nearby who offer it (the second test account offers Teacher/Babysitter/German - choose "Services > Teacher" to get a result). "By distance": min/max km, age, gender, height > "Search".
3. Tasks: menu "Tasks" > "Browse" shows published tasks (5 sample tasks: parcel pick-up, apartment check, plants, car dealer check, carrying boxes) > tap one > detail with "Take" button. "Post a task" > fill type, country, title, reward > "Save draft" > "Mine" > "Publish".
4. Matchmaking: menu "Matchmaking" > saved criteria of the test account are loaded; "Received invites" shows an invitation from Maria Ivanova > "Accept" adds her as a contact.
5. Signals: menu "Report" > choose type (e.g. Pharmacy), title, working hours, photo > location > "Submit" (one per day).
6. Verification: Profile > "What I offer" > "Apply for an emergency service" > form with organisation, licence number, document; the test account already has a pending application ("City Clinic Sofia") shown on top of the form.
7. Chat: menu "Chat" > contact "Maria Ivanova" > 4 sample messages; type a text and send, or send location / a file.
Location permission is needed for HELP, the distance/need searches and Signals. Interface language: the dropdown on the login page / Tasks page (15 languages).
