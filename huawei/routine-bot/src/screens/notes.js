// notes.js — бележки, които роботът ПОМНИ и ИЗГОВАРЯ на избрания от 15-те езика.
import { h, esc } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { LANGUAGES, voiceByCode } from '../core/languages.js';
import { speak, stopSpeaking, ttsAvailable } from '../core/tts.js';

export async function renderNotes(root, { go }) {
  const notes = await storage.get(KEYS.notes, []);
  const defLang = await storage.get(KEYS.ttsLang, 'bg');
  const langOptions = LANGUAGES
    .map((l) => `<option value="${l.code}" ${l.code === defLang ? 'selected' : ''}>${esc(l.bg)}</option>`)
    .join('');

  const el = h(`
    <div>
      <h1>📝 Бележки</h1>
      <p class="muted">Запиши бележки, които роботът да помни — и да ти ги ИЗГОВАРЯ на избрания език
      (един от 15-те на екосистемата).</p>

      <div class="card">
        <div class="field">
          <label>Нова бележка</label>
          <textarea id="noteText" rows="3" placeholder="напр. Купи хляб и мляко; обади се на мама в 18:00"></textarea>
        </div>
        <div class="field">
          <label>Език за изговаряне</label>
          <select id="noteLang">${langOptions}</select>
        </div>
        <button class="btn" id="addNote">Добави бележка</button>
        ${ttsAvailable() ? '' : '<p class="muted">⚠ Гласът не е наличен на това устройство — бележките пак се пазят.</p>'}
      </div>

      <div id="notesList"></div>
    </div>
  `);

  const listEl = el.querySelector('#notesList');

  function renderList(items) {
    listEl.innerHTML = '';
    if (!items.length) { listEl.appendChild(h('<p class="muted">Още няма бележки.</p>')); return; }
    items.forEach((n) => {
      const lang = LANGUAGES.find((l) => l.code === n.lang);
      const card = h(`
        <div class="card">
          <div>${esc(n.text)}</div>
          <div class="muted" style="font-size:12px;margin-top:4px">🗣️ ${esc(lang ? lang.bg : n.lang)}</div>
          <div class="row" style="gap:8px;margin-top:8px">
            <button class="btn sm" data-act="speak">▶️ Изговори</button>
            <button class="btn sm ghost" data-act="del">🗑️ Изтрий</button>
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
