// Version: 1.0001
// notes.js — бележки, които роботът ПОМНИ и ИЗГОВАРЯ на избрания от 15-те езика.
import { h, esc } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { LANGUAGES, voiceByCode } from '../core/languages.js';
import { speak, stopSpeaking, ttsAvailable } from '../core/tts.js';
import { t } from '../core/i18n.js';

export async function renderNotes(root, { go }) {
  const notes = await storage.get(KEYS.notes, []);
  const defLang = await storage.get(KEYS.ttsLang, 'bg');
  // Името на езика се показва в собствената му писменост (native), еднакво за всеки
  // език на интерфейса — затова тук НЕ ползваме фиксирани български имена.
  const langOptions = LANGUAGES
    .map((l) => `<option value="${l.code}" ${l.code === defLang ? 'selected' : ''}>${esc(l.native)}</option>`)
    .join('');

  const el = h(`
    <div>
      <h1>${t('notes_title')}</h1>
      <p class="muted">${esc(t('notes_intro'))}</p>

      <div class="card">
        <div class="field">
          <label>${t('notes_new')}</label>
          <textarea id="noteText" rows="3" placeholder="${esc(t('notes_text_ph'))}"></textarea>
        </div>
        <div class="field">
          <label>${t('notes_speak_lang')}</label>
          <select id="noteLang">${langOptions}</select>
        </div>
        <button class="btn" id="addNote">${t('notes_add')}</button>
        ${ttsAvailable() ? '' : `<p class="muted">${esc(t('notes_no_tts'))}</p>`}
      </div>

      <div id="notesList"></div>
    </div>
  `);

  const listEl = el.querySelector('#notesList');

  function renderList(items) {
    listEl.innerHTML = '';
    if (!items.length) { listEl.appendChild(h(`<p class="muted">${esc(t('notes_empty'))}</p>`)); return; }
    items.forEach((n) => {
      const lang = LANGUAGES.find((l) => l.code === n.lang);
      const card = h(`
        <div class="card">
          <div>${esc(n.text)}</div>
          <div class="muted" style="font-size:12px;margin-top:4px">🗣️ ${esc(lang ? lang.native : n.lang)}</div>
          <div class="row" style="gap:8px;margin-top:8px">
            <button class="btn sm" data-act="speak">${t('notes_speak')}</button>
            <button class="btn sm ghost" data-act="del">${t('notes_delete')}</button>
          </div>
        </div>
      `);
      card.querySelector('[data-act="speak"]').addEventListener('click', () => {
        stopSpeaking();
        speak(n.text, voiceByCode(n.lang));
      });
      card.querySelector('[data-act="del"]').addEventListener('click', async () => {
        const cur = (await storage.get(KEYS.notes, [])).filter((x) => x.id !== n.id);
        await storage.set(KEYS.notes, cur);
        renderList(cur);
      });
      listEl.appendChild(card);
    });
  }
  renderList(notes);

  el.querySelector('#addNote').addEventListener('click', async () => {
    const text = el.querySelector('#noteText').value.trim();
    const lang = el.querySelector('#noteLang').value;
    if (!text) return;
    await storage.set(KEYS.ttsLang, lang);
    const cur = await storage.get(KEYS.notes, []);
    cur.unshift({ id: 'n' + Date.now(), text, lang, createdAt: Date.now() });
    await storage.set(KEYS.notes, cur);
    el.querySelector('#noteText').value = '';
    renderList(cur);
  });

  root.appendChild(el);
}
