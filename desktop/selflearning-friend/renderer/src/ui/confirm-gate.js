// confirm-gate.js — гейтът за ОПАСНИТЕ агентски действия (само десктоп).
//
// Преди ВСЯКО мощно действие (FS write/команда/SSH/Playwright) показваме модал, който:
//   (a) изисква отключена сесия (проверено от викащия чрез isUnlocked),
//   (b) изисква да ВЪВЕДЕШ кодовата дума (разковничето) — сравнява се с identity,
//   (c) ясно показва „⚠ ОПАСНА команда — потвърди" + ТОЧНО какво ще се изпълни.
// Без вярната дума + натиснат „Изпълни" нищо не тръгва.

import { el } from './dom.js';
import { verifyCodeWord, isUnlocked } from '../core/identity.js';

// Показва гейт-модала. Връща Promise<boolean> — true само ако думата е вярна и потвърдено.
// title: кратко заглавие; danger: текст с ТОЧНО какво ще се случи (показва се дословно).
export function confirmDangerous({ title, danger }) {
  return new Promise((resolve) => {
    // Сесията трябва да е отключена (двоен предпазител — UI рута също го пази).
    if (!isUnlocked()) { resolve(false); return; }

    const host = document.getElementById('toast-host') || document.body;

    const wordInput = el('input', { type: 'text', placeholder: 'Кодовата дума (разковниче)…', autocomplete: 'off' });
    const errLine = el('div', { class: 'muted', style: 'color:var(--err);min-height:18px;font-size:13px;margin-top:6px' }, '');

    const overlay = el('div', {
      style: 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);' +
             'display:flex;align-items:center;justify-content:center;padding:16px'
    });

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) { if (e.key === 'Escape') close(false); }

    const panel = el('div', {
      class: 'card',
      style: 'max-width:480px;width:100%;max-height:90vh;overflow:auto;border:2px solid var(--err)'
    }, [
      el('div', { style: 'font-size:18px;font-weight:800;color:var(--err)' }, '⚠ ОПАСНА команда — потвърди'),
      el('div', { style: 'font-weight:700;margin-top:8px' }, title || 'Мощно действие'),
      el('div', {
        class: 'mem-item',
        style: 'white-space:pre-wrap;font-family:monospace;font-size:13px;margin-top:10px;max-height:200px;overflow:auto'
      }, String(danger || '')),
      el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' },
        'Това действие може да чете/пише/трие файлове или да пуска команди (локално или отдалечено). ' +
        'Изпълнява се само ако въведеш ВЯРНАТА кодова дума.'),
      el('label', {}, 'Въведи кодовата дума, за да продължиш'),
      wordInput,
      errLine,
      el('div', { class: 'row', style: 'gap:8px;margin-top:12px' }, [
        el('button', { class: 'danger', style: 'flex:1', onclick: doRun }, 'Изпълни (опасно)'),
        el('button', { class: 'secondary', style: 'flex:1', onclick: () => close(false) }, 'Отказ')
      ])
    ]);

    async function doRun() {
      const ok = await verifyCodeWord(wordInput.value);
      if (!ok) {
        errLine.textContent = 'Грешна кодова дума. Нищо не е изпълнено.';
        wordInput.value = '';
        wordInput.focus();
        return;
      }
      close(true);
    }

    wordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRun(); });
    overlay.appendChild(panel);
    host.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    setTimeout(() => wordInput.focus(), 30);
  });
}
