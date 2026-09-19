// Version: 1.0001
// 🧰 Инструменти — напълно ОФЛАЙН помощни инструменти за документи:
//   1) Брояч и анализ на текст (символи/думи/редове/абзаци, страници, време за четене)
//   2) Почистване и форматиране на текст (интервали/празни редове/регистри/обръщане/номериране)
//   3) План за документ (секции {заглавие, бележка, страници}, пренареждане, общо страници, износ)
// БЕЗ мрежа, БЕЗ тежки библиотеки — работи изцяло на устройството.
// UI надписите са СТАТИЧНИ български текстови възли (runtime i18n ги превежда после);
// JS-ът само окабелява поведение + localStorage. Съобщенията за статус живеят като
// статични data-* атрибути, за да няма български низове, генерирани в JS.
import { copyText } from '../core/ui.js';

const CHARS_PER_PAGE = 1800;   // приблизителни знаци на страница
const WORDS_PER_MIN = 200;     // средна скорост на четене (думи/мин)
const LS_ANALYZE = 'pk_pdftk_analyze'; // последен текст в „Брояч и анализ"
const LS_FORMAT = 'pk_pdftk_format';   // последен текст във „Форматиране"
const LS_PLAN = 'pk_pdftk_plan';       // секции на „План за документ"

function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

export function render(root) {
  root.innerHTML = `
    <div class="status" id="tkMsg"
         data-copied="Копирано."
         data-cleared="Изчистено."
         data-added="Секцията е добавена."
         data-removed="Секцията е премахната."
         data-empty="Няма нищо за копиране."
         data-need="Въведи заглавие на секцията."></div>

    <div class="tabs" id="tkTabs">
      <button class="tab active" data-tab="count">Брояч</button>
      <button class="tab" data-tab="clean">Форматиране</button>
      <button class="tab" data-tab="plan">План</button>
    </div>

    <!-- ============ 1) БРОЯЧ И АНАЛИЗ НА ТЕКСТ ============ -->
    <section data-panel="count">
      <div class="tool-card">
        <label>Текст за анализ</label>
        <div class="hint">Постави текста на документа — броячите се обновяват докато пишеш. Нищо не напуска устройството.</div>
        <textarea id="cntText" style="margin-top:12px" placeholder="Постави или напиши текста тук…"></textarea>
        <div class="cmp" style="margin-top:14px">
          <div><div class="sz" data-c="chars">0</div><div class="hint">символи</div></div>
          <div><div class="sz" data-c="charsNoSp">0</div><div class="hint">без интервали</div></div>
          <div><div class="sz" data-c="words">0</div><div class="hint">думи</div></div>
          <div><div class="sz" data-c="lines">0</div><div class="hint">редове</div></div>
          <div><div class="sz" data-c="paras">0</div><div class="hint">абзаци</div></div>
        </div>
        <div class="out-block" id="cntOut">
          <div class="line"><span>Приблизителни страници (1800 знака/стр)</span><span data-c="pages">0</span></div>
          <div class="line"><span>Изречения</span><span data-c="sentences">0</span></div>
          <div class="line"><span>Средна дължина на дума</span><span data-c="avgword">0</span></div>
          <div class="line"><span>Време за четене</span><span data-c="readtime">0 мин</span></div>
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn inline sec" data-act="cntClear">Изчисти</button>
        </div>
      </div>
    </section>

    <!-- ============ 2) ПОЧИСТВАНЕ И ФОРМАТИРАНЕ ============ -->
    <section data-panel="clean" hidden>
      <div class="tool-card">
        <label>Текст за почистване и форматиране</label>
        <textarea id="fmtText" placeholder="Постави текста, който да подредиш…"></textarea>
        <div class="hint" style="margin-top:6px">Всяко действие променя текста горе. Може да натиснеш няколко бутона последователно.</div>
        <div class="row" style="margin-top:14px">
          <button class="btn inline sec" data-fmt="spaces">Премахни двойни интервали</button>
          <button class="btn inline sec" data-fmt="blanks">Премахни празни редове</button>
          <button class="btn inline sec" data-fmt="trim">Изчисти краищата</button>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn inline" data-fmt="upper">ГЛАВНИ</button>
          <button class="btn inline" data-fmt="lower">малки</button>
          <button class="btn inline" data-fmt="title">Първа Главна</button>
          <button class="btn inline" data-fmt="sentence">Първа главна на изречение</button>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn inline sec" data-fmt="reverse">Обърни редовете</button>
          <button class="btn inline sec" data-fmt="number">Номерирай редовете</button>
          <button class="btn inline sec" data-fmt="dedupe">Премахни повтарящи се редове</button>
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn inline" data-fmt="copy">Копирай резултата</button>
          <button class="btn inline sec" data-fmt="clear">Изчисти</button>
        </div>
      </div>
    </section>

    <!-- ============ 3) ПЛАН ЗА ДОКУМЕНТ ============ -->
    <section data-panel="plan" hidden>
      <div class="tool-card">
        <label>Нова секция</label>
        <div class="hint">Изгради структурата на документа: заглавие, кратка бележка и брой страници. Пази се на устройството.</div>
        <div class="row" style="margin-top:12px">
          <div style="flex:2"><input id="planTitle" type="text" placeholder="Заглавие на секцията" autocomplete="off" /></div>
          <div style="flex:1"><input id="planPages" type="number" min="0" step="1" placeholder="Стр." autocomplete="off" /></div>
        </div>
        <textarea id="planNote" style="margin-top:10px" placeholder="Бележка (по избор)…"></textarea>
        <button class="btn" data-act="planAdd">Добави секция</button>
      </div>

      <div class="tool-card">
        <label>Структура на документа</label>
        <div id="planList"></div>
        <div class="empty" id="planEmpty">Още няма секции. Добави първата отгоре.</div>
        <div class="out-block" id="planTotals">
          <div class="line"><span>Брой секции</span><span data-p="count">0</span></div>
          <div class="line"><span>Общо страници</span><span data-p="pages">0</span></div>
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn inline" data-act="planCopy">Копирай плана</button>
          <button class="btn inline sec" data-act="planClear">Изчисти всичко</button>
        </div>
      </div>
    </section>
  `;

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => Array.from(root.querySelectorAll(s));
  const msgEl = $('#tkMsg');

  function toast(name) {
    const text = msgEl.dataset[name] || '';
    msgEl.className = 'status show ok';
    msgEl.textContent = text;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { msgEl.className = 'status'; }, 3000);
  }

  // ---- Превключване на подразделите ----
  $$('#tkTabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#tkTabs .tab').forEach((b) => b.classList.toggle('active', b === btn));
      const tab = btn.dataset.tab;
      $$('section[data-panel]').forEach((sec) => { sec.hidden = sec.dataset.panel !== tab; });
    });
  });

  // ================= 1) БРОЯЧ И АНАЛИЗ =================
  const cntText = $('#cntText');
  cntText.value = lsGet(LS_ANALYZE, '');

  function analyze() {
    const v = cntText.value;
    const chars = v.length;
    const charsNoSp = v.replace(/\s/g, '').length;
    const words = (v.trim().match(/\S+/g) || []).length;
    const lines = v ? v.split(/\n/).length : 0;
    const paras = v.trim() ? v.trim().split(/\n\s*\n+/).filter((p) => p.trim()).length : 0;
    const sentences = (v.match(/[^.!?…]+[.!?…]+/g) || []).length || (v.trim() ? 1 : 0);
    const pages = chars ? Math.max(1, Math.ceil(chars / CHARS_PER_PAGE)) : 0;
    const avgWord = words ? (charsNoSp / words).toFixed(1) : '0';
    const mins = Math.ceil(words / WORDS_PER_MIN);
    const readtime = words ? (mins <= 1 ? '≈ 1 мин' : '≈ ' + mins + ' мин') : '0 мин';

    $('[data-c="chars"]').textContent = chars;
    $('[data-c="charsNoSp"]').textContent = charsNoSp;
    $('[data-c="words"]').textContent = words;
    $('[data-c="lines"]').textContent = lines;
    $('[data-c="paras"]').textContent = paras;
    $('[data-c="pages"]').textContent = pages;
    $('[data-c="sentences"]').textContent = sentences;
    $('[data-c="avgword"]').textContent = avgWord;
    $('[data-c="readtime"]').textContent = readtime;

    lsSet(LS_ANALYZE, v);
  }
  cntText.addEventListener('input', analyze);
  $('[data-act="cntClear"]').addEventListener('click', () => { cntText.value = ''; analyze(); toast('cleared'); });
  analyze();

  // ================= 2) ПОЧИСТВАНЕ И ФОРМАТИРАНЕ =================
  const fmtText = $('#fmtText');
  fmtText.value = lsGet(LS_FORMAT, '');
  fmtText.addEventListener('input', () => lsSet(LS_FORMAT, fmtText.value));

  async function applyFmt(op) {
    let v = fmtText.value;
    if (op === 'copy') { if (v) { await copyText(v); toast('copied'); } else { toast('empty'); } return; }
    if (op === 'clear') { fmtText.value = ''; lsSet(LS_FORMAT, ''); toast('cleared'); return; }

    if (op === 'spaces') v = v.replace(/[^\S\n]{2,}/g, ' ').replace(/[ \t]+$/gm, '');
    else if (op === 'blanks') v = v.replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
    else if (op === 'trim') v = v.split('\n').map((l) => l.trim()).join('\n').replace(/^\n+|\n+$/g, '');
    else if (op === 'upper') v = v.toUpperCase();
    else if (op === 'lower') v = v.toLowerCase();
    else if (op === 'title') v = v.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    else if (op === 'sentence') v = v.toLowerCase().replace(/(^\s*\p{L}|[.!?…]\s+\p{L}|\n\s*\p{L})/gu, (m) => m.toUpperCase());
    else if (op === 'reverse') v = v.split('\n').reverse().join('\n');
    else if (op === 'number') {
      const arr = v.split('\n');
      const width = String(arr.length).length;
      v = arr.map((l, i) => String(i + 1).padStart(width, '0') + '. ' + l).join('\n');
    } else if (op === 'dedupe') {
      const seen = new Set();
      v = v.split('\n').filter((l) => { const k = l.trim(); if (k && seen.has(k)) return false; if (k) seen.add(k); return true; }).join('\n');
    }
    fmtText.value = v;
    lsSet(LS_FORMAT, v);
  }
  $$('[data-fmt]').forEach((b) => b.addEventListener('click', () => applyFmt(b.dataset.fmt)));

  // ================= 3) ПЛАН ЗА ДОКУМЕНТ =================
  const planList = $('#planList');
  const planEmpty = $('#planEmpty');
  const planTitle = $('#planTitle');
  const planPages = $('#planPages');
  const planNote = $('#planNote');

  function readPlan() {
    try { const a = JSON.parse(lsGet(LS_PLAN, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function writePlan(arr) { lsSet(LS_PLAN, JSON.stringify(arr)); }

  function drawPlan() {
    const arr = readPlan();
    planEmpty.style.display = arr.length ? 'none' : 'block';
    planList.innerHTML = '';
    let totalPages = 0;
    arr.forEach((sec, i) => {
      totalPages += Number(sec.pages) || 0;
      const card = document.createElement('div');
      card.className = 'out-block';
      card.style.marginTop = '12px';
      // Стойностите (заглавие/бележка) са потребителски вход → през textContent, не UI надписи.
      const head = document.createElement('div');
      head.className = 'line';
      const ttl = document.createElement('span');
      ttl.style.fontWeight = '700';
      ttl.textContent = (i + 1) + '. ' + sec.title;
      const pg = document.createElement('span');
      pg.textContent = (Number(sec.pages) || 0) + ' стр.';
      head.appendChild(ttl); head.appendChild(pg);
      card.appendChild(head);
      if (sec.note) {
        const note = document.createElement('div');
        note.className = 'hint';
        note.style.marginTop = '2px';
        note.textContent = sec.note;
        card.appendChild(note);
      }
      const ctrl = document.createElement('div');
      ctrl.className = 'row';
      ctrl.style.marginTop = '10px';
      const mkBtn = (label, act, disabled) => {
        const b = document.createElement('button');
        b.className = 'btn inline sec';
        b.textContent = label;         // ↑/↓/✕ — символи, не езиков текст
        if (disabled) b.disabled = true;
        else b.addEventListener('click', () => act());
        return b;
      };
      ctrl.appendChild(mkBtn('↑', () => moveSec(i, -1), i === 0));
      ctrl.appendChild(mkBtn('↓', () => moveSec(i, 1), i === arr.length - 1));
      ctrl.appendChild(mkBtn('✕', () => removeSec(i), false));
      card.appendChild(ctrl);
      planList.appendChild(card);
    });
    $('[data-p="count"]').textContent = arr.length;
    $('[data-p="pages"]').textContent = totalPages;
  }

  function moveSec(i, dir) {
    const arr = readPlan();
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    writePlan(arr); drawPlan();
  }
  function removeSec(i) {
    const arr = readPlan();
    arr.splice(i, 1);
    writePlan(arr); drawPlan(); toast('removed');
  }

  $('[data-act="planAdd"]').addEventListener('click', () => {
    const title = planTitle.value.trim();
    if (!title) { toast('need'); return; }
    const arr = readPlan();
    arr.push({ title, note: planNote.value.trim(), pages: Math.max(0, parseInt(planPages.value, 10) || 0) });
    writePlan(arr);
    planTitle.value = ''; planNote.value = ''; planPages.value = '';
    drawPlan();
    toast('added');
  });

  function planOutline() {
    const arr = readPlan();
    let total = 0;
    const lines = arr.map((s, i) => {
      const pg = Number(s.pages) || 0; total += pg;
      let ln = (i + 1) + '. ' + s.title + ' — ' + pg + ' стр.';
      if (s.note) ln += '\n   ' + s.note;
      return ln;
    });
    lines.push('');
    lines.push('Общо: ' + arr.length + ' секции, ' + total + ' стр.');
    return lines.join('\n');
  }

  $('[data-act="planCopy"]').addEventListener('click', async () => {
    const arr = readPlan();
    if (!arr.length) { toast('empty'); return; }
    await copyText(planOutline());
    toast('copied');
  });
  $('[data-act="planClear"]').addEventListener('click', () => { writePlan([]); drawPlan(); toast('cleared'); });

  drawPlan();
}
