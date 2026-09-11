# houselookbook — Reviewer note (Huawei AppGallery)
Version 1.0020

## For reviewer
Reply to rule 3.1 ("failed to fetch" on sign-in / registration / image upload).

Root cause: the previous build sent sign-in, registration and image uploads to a server domain that was not reachable from the test network, and the app showed the raw network error. Version 1.0020 removes the dependency on the server for the core function:

- LOCAL MODE, no account needed: every design (house shape, roof, floors, basements, rooms, furniture, colours) is stored on the device. A new "My projects" section lists them (open, duplicate, delete, publish). The builder draft is restored automatically the next time the app is opened.
- Image processing is done on the phone: the furniture photo (📷 in a room's details) and "Shape from image" no longer upload anything.
- Three EXAMPLE projects are included at first start (clearly marked "EXAMPLE", with a "Delete the examples" button) so the app is full immediately.
- An account is optional. It is only needed to publish a project to the shared gallery, to like, and for the ranking. If the server is unreachable, the app never blocks: it saves the project on the device, explains that the server is offline and offers "Continue without account".
- The server address moved to houselook.pupikes.com with an automatic backup address (pupikes.app) and CORS enabled for the app.
- Language picker at first start (15 languages); the interface language can be changed at any time from the drop-down in the top bar.

## How to test
1. Install and open the app → choose a language (15 buttons) → the Builder opens with a full house (facades, roof plan, floor plans, room plans and 3D walls). No sign-in is asked.
2. Builder: change "House shape", "Roof", "Floors", "Underground floors", colours, tick "pool" → the views update instantly. Tap "+ room" under a floor, choose a room type, tap "details", "+ furniture" → the furniture appears in the room plan and 3D walls. Tap 📷 next to a furniture item and pick any photo → the photo is shown on that item (processed on the device, nothing is uploaded). "Shape from image": pick any photo → the footprint follows its silhouette.
3. Tap "💾 Save on device" → enter a title → "✓ Saved on this device." Close the app completely and reopen → the same design is restored.
4. Top bar → "📱 My projects": three EXAMPLE projects (Family villa with pool, Lakeside cabin, Dome studio) plus your saved project. "✏️ Open in Builder" loads a project; "📋 Duplicate", "🗑️ Delete" and "🧹 Delete the examples" work offline.
5. Offline behaviour (airplane mode): everything above still works. "☁️ Publish to gallery" shows "No connection to the server. The project is saved on this device — publish it later from My projects." — no crash, no raw error. "Gallery" / "Ranking" show a clear message with a link to the local projects.
6. Optional account (needs internet): top bar → "Sign in" → the page says the account is optional and offers "📱 Continue without account". Register with any e-mail (6+ character password) → you are signed in → "☁️ Publish to gallery" sends the project for moderation. Sign-out is in the top bar.
7. "📄 PDF with views" opens the print dialog with all views (works offline).
