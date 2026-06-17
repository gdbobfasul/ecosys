// Текстови инструменти — брояч, форматиране, Base64.
import { copyText } from '../core/ui.js';

export const title = 'Текстови инструменти';

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <div class="status" id="msg"></div>
      <textarea id="txt" placeholder="Постави или въведи текст тук…"></textarea>
      <div class="cmp" style="margin-top:14px">
        <div><div class="sz" id="cWords">0</div><div class="hint">думи</div></div>
        <div><div class="sz" id="cChars">0</div><div class="hint">символи</div></div>
        <div><div class="sz" id="cCharsNS">0</div><div class="hint">без интервали</div></div>
        <div><div class="sz" id="cLines">0</div><div class="hint">редове</div></div>
        <div><div class="sz" id="cSent">0</div><div class="hint">изречения</div></div>
        <div><div class="sz" id="cRead">0</div><div class="hint">мин. четене</div></div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn inline" data-op="upper">ГЛАВНИ</button>
        <button class="btn inline" data-op="lower">малки</button>
        <button class="btn inline" data-op="title">Първа Главна</button>
        <button class="btn inline" data-op="sentence">Изречения</button>
        <button class="btn inline sec" data-op="trim">Махни празни редове</button>
        <button class="btn inline sec" data-op="spaces">Сбий интервалите</button>
        <button class="btn inline sec" data-op="reverse">Обърни</button>
        <button class="btn inline sec" data-op="b64enc">Base64 кодирай</button>
        <button class="btn inline sec" data-op="b64dec">Base64 декодирай</button>
        <button class="btn inline sec" data-op="copy">Копирай</button>
      </div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  const txt = $('#txt');

  function count() {
    const t = txt.value;
    const words = (t.trim().match(/\S+/g) || []).length;
    $('#cWords').textContent = words;
    $('#cChars').textContent = t.length;
    $('#cCharsNS').textContent = t.replace(/\s/g, '').length;
    $('#cLines').textContent = t ? t.split(/\n/).length : 0;
    $('#cSent').textContent = (t.match(/[.!?]+/g) || []).length;
    $('#cRead').textContent = Math.max(1, Math.ceil(words / 200));
  }
  function showMsg(text) {
    const m = $('#msg');
    m.className = 'status show ok';
    m.textContent = text;
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => { m.className = 'status'; }, 3500);
  }

  async function apply(op) {
    let t = txt.value;
    try {
      if (op === 'upper') t = t.toUpperCase();
      else if (op === 'lower') t = t.toLowerCase();
      else if (op === 'title') t = t.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      else if (op === 'sentence') t = t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());
      else if (op === 'trim') { t = t.split(/\n/).filter((l) => l.trim()).join('\n'); showMsg('Празните редове са премахнати.'); }
      else if (op === 'spaces') {
        t = t.replace(/[ 	   -   　]+/g, " ")
             .replace(/ *\n */g, '\n').replace(/[ \t]+$/gm, '');
        showMsg('Интервалите са сбити.');
      } else if (op === 'reverse') t = t.split('').reverse().join('');
      else if (op === 'b64enc') t = btoa(unescape(encodeURIComponent(t)));
      else if (op === 'b64dec') t = decodeURIComponent(escape(atob(t.trim())));
      else if (op === 'copy') { if (t) { await copyText(t); showMsg('Копирано.'); } return; }
    } catch (e) { showMsg('Грешка — невалиден вход за тази операция.'); return; }
    txt.value = t; count();
  }

  txt.addEventListener('input', count);
  root.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => apply(b.dataset.op)));
  count();
}
