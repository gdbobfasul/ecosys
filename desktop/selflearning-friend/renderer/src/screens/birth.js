// birth.js — раждане / кръщаване. Героят се представя и пита „Как да се нарека?“.
import { el, clear, toast } from '../ui/dom.js';
import { faceEl } from '../ui/face.js';
import { nameBot, validateSingleWord } from '../core/identity.js';
import { setSessionName } from '../core/responder.js';

export function renderBirth(root, { rerender }) {
  clear(root);
  let busy = false;
  let dataMode = 'personal'; // глобален избор за лични данни (виж privacy.js)

  const input = el('input', {
    type: 'text', placeholder: 'напр. Пешо (само една дума)', maxlength: '24',
    autocomplete: 'off', autocapitalize: 'none'
  });

  const confirm = el('input', {
    type: 'text', placeholder: 'въведи думата пак', maxlength: '24',
    autocomplete: 'off', autocapitalize: 'none'
  });

  async function birth() {
    if (busy) return;
    const a = input.value.trim();
    const b = confirm.value.trim();
    const v = validateSingleWord(a);
    if (!v.ok) { toast(v.reason); return; }
    if (a.toLowerCase() !== b.toLowerCase()) { toast('Двете думи не съвпадат.'); return; }
    busy = true;
    try {
      await nameBot(a, { dataMode });
      setSessionName(a); // живо за тази сесия (вече сме отключени след раждане)
      toast(`Здравей! Вече се казвам ${a}.`);
      rerender();
    } catch (e) {
      toast(e.message || 'Нещо се обърка.');
      busy = false;
    }
  }

  root.appendChild(faceEl());
  root.appendChild(el('h1', { class: 'center' }, 'Здравей!'));
  root.appendChild(el('p', { class: 'center muted' },
    'Аз съм твоят личен приятел. Ще се уча само от теб и ще принадлежа само на теб. ' +
    'Първо ми избери кодова дума (РАЗКОВНИЧЕ) — тя е нашата тайна за достъп.'));

  // --- Избор: режим за лични данни (две глобални опции при раждането) ---
  const modeCard = el('div', { class: 'card' });
  const optPersonal = el('div', { class: 'mem-item', style: 'cursor:pointer' });
  const optImpersonal = el('div', { class: 'mem-item', style: 'cursor:pointer' });
  function renderModes() {
    const sel = 'border:2px solid var(--accent-2)';
    const unsel = 'border:2px solid transparent';
    optPersonal.setAttribute('style', 'cursor:pointer;' + (dataMode === 'personal' ? sel : unsel));
    optImpersonal.setAttribute('style', 'cursor:pointer;' + (dataMode === 'impersonal' ? sel : unsel));
  }
  optPersonal.appendChild(el('div', { class: 'k' }, (dataMode === 'personal' ? '◉ ' : '○ ') + 'Личен — помни лични данни за мен'));
  optPersonal.appendChild(el('div', { class: 'v', style: 'font-size:13px' },
    'Ще съм твой личен асистент: помня името ти, навиците, предпочитанията — всичко за теб, само на това устройство.'));
  optImpersonal.appendChild(el('div', { class: 'k' }, (dataMode === 'impersonal' ? '◉ ' : '○ ') + 'Безличен — нула лични данни (за продажба/прехвърляне)'));
  optImpersonal.appendChild(el('div', { class: 'v', style: 'font-size:13px' },
    'НЕ събирам нищо лично за теб. Учиш ме на общи знания, ставам умен и после можеш да ме продадеш/прехвърлиш „чист“. Новият собственик, ако иска, ще ми разказва за себе си.'));
  optPersonal.addEventListener('click', () => { dataMode = 'personal'; rerenderModeLabels(); });
  optImpersonal.addEventListener('click', () => { dataMode = 'impersonal'; rerenderModeLabels(); });
  function rerenderModeLabels() {
    optPersonal.querySelector('.k').textContent = (dataMode === 'personal' ? '◉ ' : '○ ') + 'Личен — помни лични данни за мен';
    optImpersonal.querySelector('.k').textContent = (dataMode === 'impersonal' ? '◉ ' : '○ ') + 'Безличен — нула лични данни (за продажба/прехвърляне)';
    renderModes();
  }
  modeCard.appendChild(el('label', {}, 'Как да работя с твоите лични данни?'));
  modeCard.appendChild(optPersonal);
  modeCard.appendChild(optImpersonal);
  renderModes();

  const card = el('div', { class: 'card' }, [
    el('label', {}, 'Как да се нарека? (само една дума)'),
    input,
    el('label', {}, 'Потвърди думата'),
    confirm,
    el('p', { class: 'muted', style: 'margin-top:10px' },
      'Само ЕДНА дума, без интервали (колкото искаш сложна). Запомни я добре: ' +
      'НЯМА подсказка — забравиш ли я, единственият изход е „Започни отначало“.'),
    el('button', { class: 'block', onclick: birth }, 'Кръсти ме ✨')
  ]);
  root.appendChild(modeCard);
  root.appendChild(card);

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm.focus(); });
  confirm.addEventListener('keydown', (e) => { if (e.key === 'Enter') birth(); });
  setTimeout(() => input.focus(), 50);
}
