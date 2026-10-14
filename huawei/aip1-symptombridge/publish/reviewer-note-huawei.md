# Symptom Bridge — Reviewer note (Huawei AppGallery)

## Reply to rule 3.1 ("select app language function runs incorrectly — part of the content is not translated")
Fixed. The extra tools (Symptom log, Medication schedule, Visit preparation) and all their field placeholders and labels are now fully translated into every one of the 15 languages, so no part of the app stays in the original language when another language is selected. Please re-test: switch to French or English at the language screen and open all four tabs — every label, button, placeholder and hint is translated.

## Reply to rule 4.1 ("offers only one type of content")
The app is not single-purpose. Besides the main 🩺 Translator (organizes a patient's free-text complaints into a clear, structured summary for the doctor), there are three more offline tools, reachable from the in-app navigation:
- 📔 **Symptom log** — record symptoms with severity (0–10), time and notes; copy/export for the doctor.
- 💊 **Medication schedule** — list medicines with dose and times and a "taken today" toggle that auto-resets each day.
- ✅ **Visit preparation** — a checklist of questions to ask the doctor plus your own custom list (symptoms, medicines, allergies, questions).

Everything is stored locally on the device, works fully offline, with no account and no ads. This is a self-organization helper for a doctor's visit — it explicitly does not give medical advice or a diagnosis, and shows that notice on screen.

## How to test
1. Choose a language → accept the legal/medical disclaimer screen.
2. 🩺 Translator: type free-text complaints (e.g. "my head has hurt for three days, worse in the morning") and the optional fields → the app produces a structured summary for the doctor.
3. 📔 Symptom log: add a symptom, set severity, time and a note → it is saved and can be copied.
4. 💊 Schedule: add a medicine with dose and times → tick "taken today"; the tick resets the next day.
5. ✅ Preparation: tick the built-in questions and add your own items (symptom / medicine / allergy / question) → copy the whole preparation.
6. Switch language with the control → every tab, including all placeholders and hints, is translated.
