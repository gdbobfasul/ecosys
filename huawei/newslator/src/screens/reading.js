// Version: 1.0025
// reading.js — раздел „📖 Четене" (обогатяване по Huawei 4.3). Три НАПЪЛНО ОФЛАЙН
// инструмента за работа с текст — без мрежа, без AI, без акаунти. Отличават апа от
// обикновените новинарски четци: тук читателят обработва текста, не само го чете.
//   1) Анализ на статия — брой думи/изречения, време за четене, средна дължина на
//      изречение и груба оценка за четимост (лесно/средно/трудно) по прости правила.
//   2) Конструктор на резюме/план — разбива текста на изречения, отмятат се ключовите,
//      сглобява се кратко резюме/план и се копира. Изцяло на устройството.
//   3) Личен речник/глосар — {термин → превод/значение}; търсене, изтриване, копиране/
//      износ. Пази се в localStorage (независимо от състоянието на приложението).
// ПОЛИТИКА: нищо тук не праща мрежови заявки — работи и в самолетен режим.
import { el, clear } from '../ui/dom.js';

// ── Статични надписи (български интерфейс) ──
const S = {
  tab_analyze: 'Анализ',
  tab_summary: 'Резюме',
  tab_glossary: 'Речник',
  offline_note: 'Всички инструменти тук работят изцяло на устройството — без интернет и без изпращане на данни.',
  paste_ph: 'Поставете или напишете текста тук…',
  analyze_note: 'Поставете текст на статия, за да видите бърза статистика и груба оценка за четимост.',
  analyze_btn: 'Анализирай',
  clear_btn: 'Изчисти',
  words: 'Думи',
  sentences: 'Изречения',
  chars: 'Знаци',
  read_time: 'Време за четене',
  avg_sentence: 'Средна дължина на изречение',
  avg_word: 'Средна дължина на дума',
  readability: 'Четимост',
  read_easy: 'лесно',
  read_medium: 'средно',
  read_hard: 'трудно',
  min_short: 'мин',
  under_min: 'под 1 мин',
  words_unit: 'думи',
  chars_unit: 'знака',
  empty_text: 'Няма текст за анализ.',
  summary_note: 'Отметнете ключовите изречения — от тях се сглобява кратко резюме/план, което можете да копирате.',
  split_btn: 'Раздели на изречения',
  build_hint: 'Изберете изреченията, които да влязат в резюмето.',
  no_sentences: 'Не бяха намерени изречения.',
  selected: 'Избрани',
  result: 'Резюме / план',
  copy_btn: 'Копирай',
  copied: 'Копирано!',
  select_some: 'Отметнете поне едно изречение.',
  glossary_note: 'Личен речник от термини и техните значения/преводи. Пази се само на това устройство.',
  term_ph: 'термин',
  meaning_ph: 'превод / значение',
  add_btn: 'Добави',
  search_ph: 'търсене в речника…',
  empty_glossary: 'Речникът е празен. Добавете първия термин.',
  no_match: 'Няма съвпадения.',
  delete_title: 'Изтрий',
  export_btn: 'Копирай/износ на речника',
  need_both: 'Попълнете и термин, и значение.'
};

// ── Помощни ──
// Разделяне на изречения (по препинателни знаци и нови редове). Изцяло офлайн.
function splitSentences(text) {
  const parts = String(text || '')
    .replace(/\s+/g, ' ')
    .match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}
function countWords(text) {
  const m = String(text || '').trim().match(/\S+/g);
  return m ? m.length : 0;
}
function copyText(str) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).catch(() => fallbackCopy(str));
      return true;
    }
  } catch (_) {}
  return fallbackCopy(str);
}
function fallbackCopy(str) {
  try {
    const ta = document.createElement('textarea');
    ta.value = str; ta.setAttribute('readonly', '');
    ta.style.position = 'absolute'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (_) { return false; }
}
function flash(btn, label) {
  const old = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { try { btn.textContent = old; } catch (_) {} }, 1400);
}

// ── Личен речник (localStorage, независимо от app state) ──
const GKEY = 'newslator.glossary.v1';
function loadGlossary() {
  try {
    const raw = localStorage.getItem(GKEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function saveGlossary(arr) {
  try { localStorage.setItem(GKEY, JSON.stringify(arr)); } catch (_) {}
}

// ── ЕКРАН ──
let active = 'analyze';
export function renderReading(root, app, nav) {
  clear(root);
  const tabs = ['analyze', 'summary', 'glossary'];
  const bar = el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;margin-bottom:8px' });
  const body = el('div', {});

  function drawBar() {
    clear(bar);
    tabs.forEach((k) => bar.appendChild(el('button', {
      class: 'btn sm' + (active === k ? '' : ' secondary'),
      style: 'white-space:nowrap',
      onclick: () => { active = k; drawBar(); draw(); }
    }, S['tab_' + k])));
  }
  function draw() {
    clear(body);
    body.appendChild(el('p', { class: 'muted', style: 'font-size:12px;margin:0 0 8px' }, S.offline_note));
    if (active === 'analyze') drawAnalyze();
    else if (active === 'summary') drawSummary();
    else drawGlossary();
  }

  // 1) Анализ на статия
  function drawAnalyze() {
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, S.analyze_note));
    const ta = el('textarea', {
      class: 'search',
      placeholder: S.paste_ph,
      style: 'min-height:130px;resize:vertical;line-height:1.4'
    });
    const out = el('div', {});
    body.appendChild(ta);
    body.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-bottom:10px' }, [
      el('button', { class: 'btn sm', onclick: () => run() }, S.analyze_btn),
      el('button', { class: 'btn sm secondary', onclick: () => { ta.value = ''; clear(out); } }, S.clear_btn)
    ]));
    body.appendChild(out);

    function stat(label, value) {
      return el('div', { class: 'row', style: 'justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px' }, [
        el('span', { class: 'muted' }, label),
        el('b', {}, value)
      ]);
    }
    function run() {
      clear(out);
      const text = ta.value || '';
      const words = countWords(text);
      if (!words) { out.appendChild(el('p', { class: 'muted' }, S.empty_text)); return; }
      const sentences = splitSentences(text);
      const nSent = sentences.length || 1;
      const chars = text.replace(/\s/g, '').length;
      const letters = (text.match(/[^\s\d.,!?…;:()"'«»\-–—]/g) || []).length;
      const avgSent = words / nSent;                 // думи на изречение
      const avgWord = letters / words;               // букви на дума
      const minutes = words / 200;                   // ~200 думи/мин
      const readTime = minutes < 1 ? S.under_min : (Math.round(minutes) + ' ' + S.min_short);

      // Груба оценка за четимост по прости правила (по-дълги изречения/думи = по-трудно).
      let read = S.read_medium;
      if (avgSent <= 14 && avgWord <= 5.5) read = S.read_easy;
      else if (avgSent >= 22 || avgWord >= 7) read = S.read_hard;
      const badge = read === S.read_easy ? 'official' : (read === S.read_hard ? 'unofficial' : 'tr');

      const card = el('div', { class: 'card' });
      card.appendChild(stat(S.words, String(words) + ' ' + S.words_unit));
      card.appendChild(stat(S.sentences, String(sentences.length)));
      card.appendChild(stat(S.chars, String(chars) + ' ' + S.chars_unit));
      card.appendChild(stat(S.read_time, readTime));
      card.appendChild(stat(S.avg_sentence, avgSent.toFixed(1) + ' ' + S.words_unit));
      card.appendChild(stat(S.avg_word, avgWord.toFixed(1) + ' ' + S.chars_unit));
      card.appendChild(el('div', { class: 'row', style: 'justify-content:space-between;padding:9px 0 2px;font-size:14px' }, [
        el('span', { class: 'muted' }, S.readability),
        el('span', { class: 'badge ' + badge, style: 'font-size:13px' }, read)
      ]));
      out.appendChild(card);
    }
  }

  // 2) Конструктор на резюме/план
  function drawSummary() {
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, S.summary_note));
    const ta = el('textarea', {
      class: 'search',
      placeholder: S.paste_ph,
      style: 'min-height:120px;resize:vertical;line-height:1.4'
    });
    const list = el('div', {});
    const result = el('div', {});
    body.appendChild(ta);
    body.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-bottom:10px' }, [
      el('button', { class: 'btn sm', onclick: () => split() }, S.split_btn),
      el('button', { class: 'btn sm secondary', onclick: () => { ta.value = ''; clear(list); clear(result); } }, S.clear_btn)
    ]));
    body.appendChild(list);
    body.appendChild(result);

    const chosen = new Set();
    let sents = [];
    function split() {
      clear(list); clear(result); chosen.clear();
      sents = splitSentences(ta.value || '');
      if (!sents.length) { list.appendChild(el('p', { class: 'muted' }, S.no_sentences)); return; }
      list.appendChild(el('p', { class: 'muted', style: 'font-size:12px;margin:0 0 6px' }, S.build_hint));
      sents.forEach((s, i) => {
        const cb = el('input', { type: 'checkbox', style: 'margin-top:3px;flex:none;width:18px;height:18px' });
        cb.addEventListener('change', () => { if (cb.checked) chosen.add(i); else chosen.delete(i); build(); });
        list.appendChild(el('label', {
          class: 'card',
          style: 'display:flex;gap:10px;align-items:flex-start;padding:10px;margin-bottom:8px;cursor:pointer;font-size:14px;line-height:1.35'
        }, [cb, el('span', {}, s)]));
      });
    }
    function build() {
      clear(result);
      if (!chosen.size) return;
      const picked = sents.filter((_, i) => chosen.has(i));
      const text = picked.map((s) => '• ' + s).join('\n');
      const area = el('textarea', {
        class: 'search',
        readonly: 'readonly',
        style: 'min-height:110px;resize:vertical;line-height:1.4;margin-top:6px'
      });
      area.value = text;
      const copyBtn = el('button', { class: 'btn sm', onclick: () => { copyText(text); flash(copyBtn, S.copied); } }, S.copy_btn);
      result.appendChild(el('div', { class: 'row', style: 'justify-content:space-between;margin:4px 0' }, [
        el('h3', { style: 'margin:0' }, S.result),
        el('span', { class: 'badge tr' }, S.selected + ': ' + chosen.size)
      ]));
      result.appendChild(area);
      result.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [copyBtn]));
    }
  }

  // 3) Личен речник/глосар
  function drawGlossary() {
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, S.glossary_note));
    const term = el('input', { class: 'search', type: 'text', placeholder: S.term_ph, style: 'flex:1;min-width:0;margin-bottom:0' });
    const mean = el('input', { class: 'search', type: 'text', placeholder: S.meaning_ph, style: 'flex:1;min-width:0;margin-bottom:0' });
    const search = el('input', { class: 'search', type: 'text', placeholder: S.search_ph, style: 'margin-bottom:8px' });
    const out = el('div', {});

    const add = () => {
      const t = term.value.trim(); const m = mean.value.trim();
      if (!t || !m) { flash(addBtn, S.need_both); return; }
      const arr = loadGlossary();
      arr.unshift({ t, m, at: Date.now() });
      saveGlossary(arr);
      term.value = ''; mean.value = '';
      term.focus();
      list();
    };
    const addBtn = el('button', { class: 'btn sm', onclick: add }, S.add_btn);
    mean.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    search.addEventListener('input', () => list());

    body.appendChild(el('div', { class: 'row', style: 'gap:6px;margin-bottom:8px;flex-wrap:wrap' }, [term, mean, addBtn]));
    body.appendChild(search);
    body.appendChild(out);

    function list() {
      clear(out);
      const all = loadGlossary();
      if (!all.length) { out.appendChild(el('p', { class: 'muted' }, S.empty_glossary)); return; }
      const q = search.value.trim().toLowerCase();
      const rows = q
        ? all.filter((e) => (e.t + ' ' + e.m).toLowerCase().indexOf(q) >= 0)
        : all;
      const expBtn = el('button', { class: 'btn sm secondary', style: 'margin-bottom:8px', onclick: () => { copyText(all.map((e) => e.t + ' — ' + e.m).join('\n')); flash(expBtn, S.copied); } }, S.export_btn);
      out.appendChild(expBtn);
      if (!rows.length) { out.appendChild(el('p', { class: 'muted' }, S.no_match)); return; }
      rows.forEach((e) => {
        const del = el('button', {
          class: 'icon-btn', title: S.delete_title, style: 'flex:none;padding:6px 9px',
          onclick: () => {
            const arr = loadGlossary().filter((x) => !(x.t === e.t && x.m === e.m && x.at === e.at));
            saveGlossary(arr); list();
          }
        }, '🗑');
        out.appendChild(el('div', { class: 'card', style: 'padding:11px;margin-bottom:8px' }, [
          el('div', { class: 'row', style: 'gap:10px;align-items:flex-start' }, [
            el('div', { style: 'flex:1;min-width:0' }, [
              el('div', { style: 'font-weight:600;font-size:15px' }, e.t),
              el('div', { class: 'muted', style: 'font-size:14px;margin-top:2px' }, e.m)
            ]),
            del
          ])
        ]));
      });
    }
    list();
  }

  root.appendChild(bar);
  root.appendChild(body);
  drawBar();
  draw();
}
