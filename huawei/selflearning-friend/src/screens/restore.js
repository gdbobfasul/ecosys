// Version: 1.0016
// restore.js — екран при СТАРТ на свежа инсталация (апът не знае дали е първа или поредна, затова
// ВИНАГИ проверява). Появява се след избора на UI език и преди раждането (виж main.js).
//
// Поток (по желание на собственика):
//   • Търси файл в ДЕФОЛТНА локация + ДЕФОЛТНО име (Downloads/<dir>/<settingsName>.json).
//   • НАМЕРИ ли го → пита „Да заредя ли тези настройки?" [Зареди старите] / [Започни начисто (изтрий?)].
//   • НЕ го намери → пита „Къде да ги пазя занапред?" (папка + име) + „Избери файл ръчно".
//
// (i18n: текстовете тук са на български; локализация на 15 езика — отделна задача.)
import { el, clear, toast } from '../ui/dom.js';
import {
  restoreFromPickedFile, findLocalRecovery, applyLocalRecovery,
  deleteLocalFiles, setRecoveryCfg, getRecoveryCfg, markRestorePrompted
} from '../core/recovery.js';

export function renderRestore(root, { done }) {
  clear(root);
  let busy = false;
  const cfg = getRecoveryCfg();

  const status = el('p', { class: 'center muted' }, 'Проверявам за запазени настройки…');
  const body = el('div', { class: 'btn-col' });

  function setDisabled(v) { Array.from(body.querySelectorAll('button,input')).forEach((b) => { b.disabled = v; }); }

  function finishOk(r) {
    const parts = [];
    if (r.applied && r.applied.length) parts.push('върнах: ' + r.applied.join(', '));
    if (r.addedKnowledge) parts.push(r.addedKnowledge + ' записа знание');
    if (r.redownloaded) parts.push(r.redownloaded + ' речника се свалят наново');
    if (r.admin) parts.push('разпознах администратор');
    toast('Готово. ' + (parts.join(' · ') || 'Настройките са върнати.'), 4500);
    markRestorePrompted();
    done();
  }

  // ── Вариант А: НАМЕРЕН файл → предлагаме зареждане ─────────────────────────────
  function showFound(path) {
    status.className = 'center ok-text';
    status.textContent = 'Намерих запазени настройки:\n' + path;
    clear(body);

    const loadBtn = el('button', { class: 'primary-btn' }, '⤵️ Зареди старите настройки');
    const freshBtn = el('button', { class: 'ghost-btn' }, 'Започни начисто');
    const delChk = el('input', { type: 'checkbox' });
    const delRow = el('label', { style: 'display:flex;align-items:center;gap:8px;justify-content:center;font-size:13px' },
      [delChk, 'При „начисто" изтрий и стария файл']);

    loadBtn.addEventListener('click', async () => {
      if (busy) return; busy = true; setDisabled(true);
      status.className = 'center muted'; status.textContent = 'Зареждам…';
      const r = await applyLocalRecovery();
      busy = false; setDisabled(false);
      if (!r.ok) { status.className = 'center warn-text'; status.textContent = 'Не успях: ' + (r.reason || 'грешка') + '. Опитай „Избери файл ръчно".'; return; }
      finishOk(r);
    });
    freshBtn.addEventListener('click', async () => {
      if (busy) return;
      if (delChk.checked) { try { await deleteLocalFiles(); toast('Изтрих стария файл.'); } catch (_) {} }
      markRestorePrompted(); done();
    });

    body.appendChild(loadBtn);
    body.appendChild(el('button', { class: 'secondary-btn', onclick: pickManually }, '📂 Избери друг файл'));
    body.appendChild(delRow);
    body.appendChild(freshBtn);
  }

  // ── Вариант Б: НЯМА файл → питаме КЪДЕ да пазим занапред ───────────────────────
  function showNotFound() {
    status.className = 'center muted';
    status.textContent = 'Не намерих запазени настройки. Къде да ги пазя занапред?';
    clear(body);

    const dirIn = el('input', { type: 'text', value: cfg.dir, placeholder: 'KCY', autocapitalize: 'none', autocomplete: 'off', style: 'width:100%' });
    const nameIn = el('input', { type: 'text', value: cfg.settingsName, placeholder: 'slf-settings', autocapitalize: 'none', autocomplete: 'off', style: 'width:100%' });

    const saveBtn = el('button', { class: 'primary-btn' }, '✅ Пази тук и продължи');
    saveBtn.addEventListener('click', () => {
      setRecoveryCfg({ dir: dirIn.value.trim() || 'KCY', settingsName: nameIn.value.trim() || 'slf-settings' });
      toast('Ще пазя настройките в Downloads/' + (dirIn.value.trim() || 'KCY') + '/');
      markRestorePrompted(); done();
    });

    body.appendChild(el('label', { style: 'align-self:flex-start' }, 'Папка в Downloads'));
    body.appendChild(dirIn);
    body.appendChild(el('label', { style: 'align-self:flex-start' }, 'Име на файла'));
    body.appendChild(nameIn);
    body.appendChild(saveBtn);
    body.appendChild(el('button', { class: 'secondary-btn', onclick: pickManually }, '📂 Имам файл другаде — избери ръчно'));
    body.appendChild(el('button', { class: 'ghost-btn', onclick: () => { markRestorePrompted(); done(); } }, 'Пропусни'));
  }

  async function pickManually() {
    if (busy) return; busy = true; setDisabled(true);
    status.className = 'center muted'; status.textContent = 'Избери файла…';
    const r = await restoreFromPickedFile();
    busy = false; setDisabled(false);
    if (r.cancelled) { status.textContent = 'Отказан избор.'; return; }
    if (!r.ok) { status.className = 'center warn-text'; status.textContent = 'Не се получи: ' + (r.reason || 'невалиден файл'); return; }
    finishOk(r);
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('h2', { class: 'center' }, 'Настройки'),
    status,
    body
  ]));

  // Проверка за файл в дефолтната локация/име (Downloads/<dir>/<name>.json).
  findLocalRecovery().then((f) => {
    if (f && f.found) showFound('Downloads/' + cfg.dir + '/' + cfg.settingsName + '.json');
    else showNotFound();
  }).catch(() => showNotFound());
}
