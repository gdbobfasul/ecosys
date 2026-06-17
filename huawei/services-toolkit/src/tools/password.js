// Генератор на пароли — 4 метода, криптографски случайни числа.
import { copyText } from '../core/ui.js';

export const title = 'Генератор на пароли';

const HINTS = {
  random: 'Случайни символи от избраните набори. Най-силна, но трудна за запомняне.',
  words: 'Свързва случайни думи — лесна за запомняне, дълга и силна.',
  pin: 'Само цифри — за устройства/карти. По-слаба, използвай дълъг PIN.',
  pronounce: 'Редува съгласна+гласна — звучи като дума, по-лесна за изговаряне.'
};
const WORDS = ['ябълка','река','планина','облак','книга','стол','прозорец','звезда','море','гора','цвете','камък','вятър','слънце','луна','птица','риба','мост','ключ','врата','лампа','маса','огън','лед','пясък','злато','сребро','диамант','тигър','орел'];
const CONS = 'bcdfghjklmnprstvz', VOW = 'aeiou';

function rnd(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}
const pick = (s) => s[rnd(s.length)];

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <label>Метод на генериране</label>
      <select id="method">
        <option value="random">Случайни символи — максимална сила</option>
        <option value="words">Лесна за запомняне — думи</option>
        <option value="pin">Цифров PIN код</option>
        <option value="pronounce">Произносима — срички</option>
      </select>
      <p class="hint" id="mhint"></p>
      <label>Дължина: <span id="lenval">16</span></label>
      <input type="number" id="len" value="16" min="4" max="64" />
      <div id="opts">
        <label>Включи символи:</label>
        <div class="check"><input type="checkbox" id="upper" checked><span>Главни (A-Z)</span></div>
        <div class="check"><input type="checkbox" id="lower" checked><span>Малки (a-z)</span></div>
        <div class="check"><input type="checkbox" id="digits" checked><span>Цифри (0-9)</span></div>
        <div class="check"><input type="checkbox" id="symbols" checked><span>Специални (!@#$%…)</span></div>
        <div class="check"><input type="checkbox" id="nosimilar"><span>Без объркващи (0/O, 1/l/I)</span></div>
      </div>
      <button class="btn" id="genbtn">Генерирай парола</button>
      <div class="mono-out" id="out" title="Кликни за копиране">—</div>
      <div class="strength"><div id="sbar"></div></div>
      <div class="slabel" id="slabel"></div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);

  function onMethod() {
    const m = $('#method').value;
    $('#mhint').textContent = HINTS[m];
    $('#opts').style.display = m === 'random' ? 'block' : 'none';
  }
  $('#method').addEventListener('change', onMethod);
  $('#len').addEventListener('input', () => { $('#lenval').textContent = $('#len').value; });

  function gen() {
    const m = $('#method').value;
    const len = Math.max(4, Math.min(64, parseInt($('#len').value, 10) || 16));
    let pw = '';
    if (m === 'random') {
      let set = '';
      if ($('#upper').checked) set += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if ($('#lower').checked) set += 'abcdefghijklmnopqrstuvwxyz';
      if ($('#digits').checked) set += '0123456789';
      if ($('#symbols').checked) set += '!@#$%^&*()-_=+[]{}';
      if ($('#nosimilar').checked) set = set.replace(/[0O1lI]/g, '');
      if (!set) { alert('Избери поне един набор символи.'); return; }
      for (let i = 0; i < len; i++) pw += pick(set);
    } else if (m === 'words') {
      const n = Math.max(3, Math.round(len / 5));
      const parts = [];
      for (let j = 0; j < n; j++) {
        const w = WORDS[rnd(WORDS.length)];
        parts.push(w.charAt(0).toUpperCase() + w.slice(1));
      }
      pw = parts.join('-') + rnd(100);
    } else if (m === 'pin') {
      for (let k = 0; k < len; k++) pw += rnd(10);
    } else if (m === 'pronounce') {
      for (let p = 0; p < len; p++) pw += (p % 2 === 0) ? pick(CONS) : pick(VOW);
      pw = pw.charAt(0).toUpperCase() + pw.slice(1) + rnd(100);
    }
    $('#out').textContent = pw;
    rate(pw);
  }

  function rate(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (pw.length >= 20) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    const pct = Math.min(100, score * 17);
    const bar = $('#sbar');
    bar.style.width = pct + '%';
    let lab, col;
    if (score <= 2) { lab = 'Слаба'; col = 'var(--err)'; }
    else if (score <= 4) { lab = 'Средна'; col = 'var(--warn)'; }
    else { lab = 'Силна'; col = 'var(--ok)'; }
    bar.style.background = col;
    const sl = $('#slabel');
    sl.textContent = 'Сила: ' + lab;
    sl.style.color = col;
  }

  $('#genbtn').addEventListener('click', gen);
  $('#out').addEventListener('click', async () => {
    const t = $('#out').textContent;
    if (t && t !== '—') {
      const ok = await copyText(t);
      const o = $('#out'); const old = o.textContent;
      o.textContent = ok ? '✓ копирано' : 'не успя';
      setTimeout(() => { o.textContent = old; }, 800);
    }
  });

  onMethod();
  gen();
}
