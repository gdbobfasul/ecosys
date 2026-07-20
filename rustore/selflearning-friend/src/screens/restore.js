// Version: 1.0017
// restore.js — екран при СТАРТ на свежа инсталация (апът не знае дали е първа или поредна, затова
// ВИНАГИ проверява). Появява се след избора на UI език и преди раждането (виж main.js).
//
// Поток (по желание на собственика):
//   • Търси файл в ДЕФОЛТНА локация + ДЕФОЛТНО име (Downloads/<dir>/<settingsName>.json).
//   • НАМЕРИ ли го → пита „Да заредя ли тези настройки?" [Зареди старите] / [Започни начисто (изтрий?)].
//   • НЕ го намери → пита „Къде да ги пазя занапред?" (папка + име) + „Избери файл ръчно".
import { el, clear, toast } from '../ui/dom.js';
import { t, tf } from '../core/i18n.js';
import {
  restoreFromPickedFile, findLocalRecovery, applyLocalRecovery,
  deleteLocalFiles, setRecoveryCfg, getRecoveryCfg, markRestorePrompted
} from '../core/recovery.js';

export function renderRestore(root, { done }) {
  clear(root);
  let busy = false;
  const cfg = getRecoveryCfg();

  const status = el('p', { class: 'center muted' }, t('rst_checking'));
  const body = el('div', { class: 'btn-col' });

  function setDisabled(v) { Array.from(body.querySelectorAll('button,input')).forEach((b) => { b.disabled = v; }); }

  function finishOk(r) {
    const parts = [];
    if (r.applied && r.applied.length) parts.push(tf('rst_applied', r.applied.join(', ')));
    if (r.addedKnowledge) parts.push(tf('rst_knowledge_n', r.addedKnowledge));
    if (r.redownloaded) parts.push(tf('rst_redl_n', r.redownloaded));
    if (r.admin) parts.push(t('rst_admin'));
    toast(t('rst_done') + ' ' + (parts.join(' · ') || t('rst_restored')), 4500);
    markRestorePrompted();
    done();
  }

  // ── Вариант А: НАМЕРЕН файл → предлагаме зареждане ─────────────────────────────
  function showFound(path) {
    status.className = 'center ok-text';
    status.textContent = t('rst_found') + '\n' + path;
    clear(body);

    const loadBtn = el('button', { class: 'primary-btn' }, t('rst_load_old'));
    const freshBtn = el('button', { class: 'ghost-btn' }, t('rst_fresh'));
    const delChk = el('input', { type: 'checkbox' });
    const delRow = el('label', { style: 'display:flex;align-items:center;gap:8px;justify-content:center;font-size:13px' },
      [delChk, t('rst_del_old')]);

    loadBtn.addEventListener('click', async () => {
      if (busy) return; busy = true; setDisabled(true);
      status.className = 'center muted'; status.textContent = t('rst_loading');
      const r = await applyLocalRecovery();
      busy = false; setDisabled(false);
      if (!r.ok) { status.className = 'center warn-text'; status.textContent = tf('rst_fail', r.reason || t('rst_err')); return; }
      finishOk(r);
    });
    freshBtn.addEventListener('click', async () => {
      if (busy) return;
      if (delChk.checked) { try { await deleteLocalFiles(); toast(t('deleted')); } catch (_) {} }
      markRestorePrompted(); done();
    });

    body.appendChild(loadBtn);
    body.appendChild(el('button', { class: 'secondary-btn', onclick: pickManually }, t('rst_pick_other')));
    body.appendChild(delRow);
    body.appendChild(freshBtn);
  }

  // ── Вариант Б: НЯМА файл → питаме КЪДЕ да пазим занапред ───────────────────────
  function showNotFound() {
    status.className = 'center muted';
    status.textContent = t('rst_none');
    clear(body);

    const dirIn = el('input', { type: 'text', value: cfg.dir, placeholder: 'Pupikes', autocapitalize: 'none', autocomplete: 'off', style: 'width:100%' });
    const nameIn = el('input', { type: 'text', value: cfg.settingsName, placeholder: 'slf-settings', autocapitalize: 'none', autocomplete: 'off', style: 'width:100%' });

    const saveBtn = el('button', { class: 'primary-btn' }, t('rst_keep_here'));
    saveBtn.addEventListener('click', () => {
      setRecoveryCfg({ dir: dirIn.value.trim() || 'Pupikes', settingsName: nameIn.value.trim() || 'slf-settings' });
      toast(tf('rst_will_keep', dirIn.value.trim() || 'Pupikes'));
      markRestorePrompted(); done();
    });

    body.appendChild(el('label', { style: 'align-self:flex-start' }, t('rst_dir')));
    body.appendChild(dirIn);
    body.appendChild(el('label', { style: 'align-self:flex-start' }, t('rst_fname')));
    body.appendChild(nameIn);
    body.appendChild(saveBtn);
    body.appendChild(el('button', { class: 'secondary-btn', onclick: pickManually }, t('rst_have_file')));
    body.appendChild(el('button', { class: 'ghost-btn', onclick: () => { markRestorePrompted(); done(); } }, t('rst_skip')));
  }

  async function pickManually() {
    if (busy) return; busy = true; setDisabled(true);
    status.className = 'center muted'; status.textContent = t('rst_pick');
    const r = await restoreFromPickedFile();
    busy = false; setDisabled(false);
    if (r.cancelled) { status.textContent = t('rst_cancelled'); return; }
    if (!r.ok) { status.className = 'center warn-text'; status.textContent = tf('rst_invalid', r.reason || t('rst_invalid_file')); return; }
    finishOk(r);
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('h2', { class: 'center' }, t('nav_settings')),
    status,
    body
  ]));

  // Проверка за файл в дефолтната локация/име (Downloads/<dir>/<name>.json).
  findLocalRecovery().then((f) => {
    if (f && f.found) showFound('Downloads/' + cfg.dir + '/' + cfg.settingsName + '.json');
    else showNotFound();
  }).catch(() => showNotFound());
}
