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
  { id: 'translate', label: 'Преведи на английски', tpl: (t) => `Преведи на английски език следния текст:\n\n${t}` },
  { id: 'explain', label: 'Обясни', tpl: (t) => `Обясни просто и ясно:\n\n${t}` }
];

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
    const prompt = mode.tpl(raw);

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
