// birth.js — раждане / кръщаване. Героят се представя и пита „Как да се нарека?“.
import { el, clear, toast } from '../ui/dom.js';
import { faceEl } from '../ui/face.js';
import { nameBot, validateSingleWord } from '../core/identity.js';
import { setSessionName } from '../core/responder.js';
import { t, tf } from '../core/i18n.js';

export function renderBirth(root, { rerender }) {
  clear(root);
  let busy = false;
  let dataMode = 'personal'; // глобален избор за лични данни (виж privacy.js)

  const input = el('input', {
    type: 'text', placeholder: t('birth_name_ph'), maxlength: '24',
    autocomplete: 'off', autocapitalize: 'none'
  });

  const confirm = el('input', {
    type: 'text', placeholder: t('birth_confirm_ph'), maxlength: '24',
    autocomplete: 'off', autocapitalize: 'none'
  });

  async function birth() {
    if (busy) return;
    const a = input.value.trim();
    const b = confirm.value.trim();
    const v = validateSingleWord(a);
    if (!v.ok) { toast(v.reason); return; }
    if (a.toLowerCase() !== b.toLowerCase()) { toast(t('birth_mismatch')); return; }
    busy = true;
    try {
      await nameBot(a, { dataMode });
      setSessionName(a); // живо за тази сесия (вече сме отключени след раждане)
      toast(tf('birth_done', a));
      rerender();
    } catch (e) {
      toast(e.message || t('err_generic'));
      busy = false;
    }
  }

  root.appendChild(faceEl());
  root.appendChild(el('h1', { class: 'center' }, t('birth_hello')));
  root.appendChild(el('p', { class: 'center muted' }, t('birth_intro')));

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
  optPersonal.appendChild(el('div', { class: 'k' }, (dataMode === 'personal' ? '◉ ' : '○ ') + t('birth_personal')));
  optPersonal.appendChild(el('div', { class: 'v', style: 'font-size:13px' }, t('birth_personal_desc')));
  optImpersonal.appendChild(el('div', { class: 'k' }, (dataMode === 'impersonal' ? '◉ ' : '○ ') + t('birth_impersonal')));
  optImpersonal.appendChild(el('div', { class: 'v', style: 'font-size:13px' }, t('birth_impersonal_desc')));
  optPersonal.addEventListener('click', () => { dataMode = 'personal'; rerenderModeLabels(); });
  optImpersonal.addEventListener('click', () => { dataMode = 'impersonal'; rerenderModeLabels(); });
  function rerenderModeLabels() {
    optPersonal.querySelector('.k').textContent = (dataMode === 'personal' ? '◉ ' : '○ ') + t('birth_personal');
    optImpersonal.querySelector('.k').textContent = (dataMode === 'impersonal' ? '◉ ' : '○ ') + t('birth_impersonal');
    renderModes();
  }
  modeCard.appendChild(el('label', {}, t('birth_data_q')));
  modeCard.appendChild(optPersonal);
  modeCard.appendChild(optImpersonal);
  renderModes();

  const card = el('div', { class: 'card' }, [
    el('label', {}, t('birth_name_q')),
    input,
    el('label', {}, t('birth_confirm_label')),
    confirm,
    el('p', { class: 'muted', style: 'margin-top:10px' }, t('birth_word_note')),
    el('button', { class: 'block', onclick: birth }, t('birth_btn'))
  ]);
  root.appendChild(modeCard);
  root.appendChild(card);

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm.focus(); });
  confirm.addEventListener('keydown', (e) => { if (e.key === 'Enter') birth(); });
  setTimeout(() => input.focus(), 50);
}
