// AI генератор на текст — РЕАЛЕН инструмент чрез БЕЗПЛАТЕН keyless ендпойнт.
// Източник: Pollinations Text API (безплатен, БЕЗ ключ, БЕЗ акаунт, с CORS).
//   GET  https://text.pollinations.ai/<URL-кодиран промпт>
//   POST https://text.pollinations.ai/  { "messages":[{role,content}], "model":"openai" }
// И двата режима връщат чист текст (text/plain). Тук ползваме GET с
// encodeURIComponent върху целия промпт — най-съвместимо и без тяло.
// Напълно БЕЗ ключ, БЕЗ регистрация, БЕЗ billing, БЕЗ tracking.
//
// Граничен случай: при липса на връзка / бавен отговор показваме честно
// съобщение („няма връзка / услугата не отговаря"), без фалшив резултат.

export const title = 'AI генератор на текст';

// Готови шаблони: подсказват на потребителя какво да поиска.
const MODES = [
  { id: 'write', label: 'Напиши', tpl: (t) => t },
  { id: 'summarize', label: 'Обобщи', tpl: (t) => `Обобщи накратко следния текст:\n\n${t}` },
  { id: 'translate', label: 'Преведи', tpl: (t) => t /* спец. обработка с избор на език */ },
  { id: 'explain', label: 'Обясни', tpl: (t) => `Обясни просто и ясно:\n\n${t}` }
];

// 15-те езика на екосистемата (както public/translations). За превод на всеки от тях.
const TARGET_LANGS = [
  { label: 'Английски', name: 'английски' },
  { label: 'Български', name: 'български' },
  { label: 'Руски', name: 'руски' },
  { label: 'Украински', name: 'украински' },
  { label: 'Немски', name: 'немски' },
  { label: 'Френски', name: 'френски' },
  { label: 'Испански', name: 'испански' },
  { label: 'Испански (Мексико)', name: 'мексикански испански' },
  { label: 'Италиански', name: 'италиански' },
  { label: 'Португалски', name: 'португалски' },
  { label: 'Арабски', name: 'арабски' },
  { label: 'Хинди', name: 'хинди' },
  { label: 'Японски', name: 'японски' },
  { label: 'Киргизки', name: 'киргизки' },
  { label: 'Китайски (традиционен)', name: 'традиционен китайски' }
];

// Построява промпта за дадения режим (за превод — с избрания целеви език).
function buildPrompt(mode, raw, langName) {
  if (mode.id === 'translate') {
    return `Преведи следния текст на ${langName} език. Върни САМО превода — без оригинала, ` +
      `без обяснения и без кавички:\n\n${raw}`;
  }
  return mode.tpl(raw);
}

const ENDPOINT = 'https://text.pollinations.ai/';

// Изпраща промпта към Pollinations и връща чистия текстов отговор.
async function askAI(prompt, signal) {
  const url = ENDPOINT + encodeURIComponent(prompt);
  const r = await fetch(url, { cache: 'no-store', signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const text = (await r.text()).trim();
  if (!text) throw new Error('empty');
  return text;
}

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>Режим</label>
      <select id="aiMode">
        ${MODES.map((m, i) => `<option value="${i}">${m.label}</option>`).join('')}
      </select>
      <div id="aiLangRow" style="display:none">
        <label style="margin-top:12px">Преведи на</label>
        <select id="aiLang">
          ${TARGET_LANGS.map((l, i) => `<option value="${i}">${l.label}</option>`).join('')}
        </select>
      </div>
      <label style="margin-top:12px">Твоята заявка</label>
      <textarea id="aiPrompt" rows="4" placeholder="Напиши кратко стихотворение за морето…"></textarea>
      <button class="btn" id="aiBtn">Генерирай</button>
      <button class="btn sec" id="aiCopy" style="display:none">Копирай</button>
      <div class="status" id="aiStatus"></div>
      <div class="out-block" id="aiOut" style="display:none;white-space:pre-wrap"></div>
      <p class="hint" style="margin-top:10px">
        Текстът се генерира от text.pollinations.ai (безплатно, без ключ и акаунт). Изисква интернет.
      </p>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#aiStatus');
  const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };
  const hideStatus = () => { statusEl.className = 'status'; };

  let busy = false;

  async function generate() {
    if (busy) return;
    const raw = $('#aiPrompt').value.trim();
    if (!raw) { setStatus('err', 'Въведи заявка.'); return; }
    const mode = MODES[parseInt($('#aiMode').value, 10) || 0];
    const lang = TARGET_LANGS[parseInt($('#aiLang').value, 10) || 0] || TARGET_LANGS[0];
    const prompt = buildPrompt(mode, raw, lang.name);

    busy = true;
    const btn = $('#aiBtn');
    btn.disabled = true;
    $('#aiCopy').style.display = 'none';
    $('#aiOut').style.display = 'none';
    setStatus('work', 'Генерирам…');

    // Прекъсване при бавен отговор (45 сек).
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const answer = await askAI(prompt, ctrl.signal);
      hideStatus();
      const o = $('#aiOut');
      o.style.display = 'block';
      o.textContent = answer;
      $('#aiCopy').style.display = 'block';
    } catch (e) {
      $('#aiOut').style.display = 'none';
      const aborted = e && e.name === 'AbortError';
      setStatus('err', aborted
        ? 'Услугата не отговори навреме. Опитай отново.'
        : 'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.');
    } finally {
      clearTimeout(timer);
      btn.disabled = false;
      busy = false;
    }
  }

  // Полето за целеви език се показва само в режим „Преведи".
  const langRow = $('#aiLangRow');
  function syncLangRow() {
    const mode = MODES[parseInt($('#aiMode').value, 10) || 0];
    langRow.style.display = (mode && mode.id === 'translate') ? 'block' : 'none';
  }
  $('#aiMode').addEventListener('change', syncLangRow);
  syncLangRow();

  $('#aiBtn').addEventListener('click', generate);
  $('#aiCopy').addEventListener('click', async () => {
    const text = $('#aiOut').textContent;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('ok', 'Копирано.');
      setTimeout(hideStatus, 1500);
    } catch (_) {
      setStatus('err', 'Копирането не е разрешено.');
    }
  });
}
