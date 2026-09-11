// Version: 1.0035
// study.js (екран) — „Учене“: пет под-таба, всички от ЛОКАЛНИТЕ данни (без мрежа):
//   Викторина — приятелят пита по наученото (избор, точки, серия);
//   Напредък  — табло: теми/бележки/памет/пакети/източници, по дни, най-силни теми;
//   Дневник   — какво научих по дни, откъде, бутон „Забрави“;
//   Учи ме    — собственикът пише/диктува урок → повтарям на мои думи → запомням;
//   Речник    — думите на собственика + какво знам за тях (той поправя обяснението).
import { el, clear, toast } from '../ui/dom.js';
import { getState } from '../core/storage.js';
import { sttAvailable, startListening, stopListening } from '../core/voice.js';
import {
  SRC_OWNER_TEACH, quizAvailable, nextQuestion, recordAnswer, quizStats, resetQuiz,
  progressStats, diaryDays, diaryFor, forgetEvent, forgetDay, dayKey,
  paraphrase, saveLesson, listLessons, deleteLesson,
  ownerWords, setWordExplain, removeWord
} from '../core/study.js';
import { t, tf } from '../core/i18n.js';

const TABS = [
  ['quiz', 'st_tab_quiz'],
  ['progress', 'st_tab_progress'],
  ['diary', 'st_tab_diary'],
  ['teach', 'st_tab_teach'],
  ['glossary', 'st_tab_glossary']
];
let _tab = 'quiz';   // запомнен под-таб за сесията

function srcLabel(src) {
  if (src === SRC_OWNER_TEACH) return t('st_src_owner');
  return src || '';
}
function fmtDate(ts) {
  try { return new Date(ts).toLocaleDateString(); } catch (_) { return String(ts); }
}
function dayLabel(k) {
  if (k === dayKey()) return t('st_d_today');
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (k === dayKey(y.getTime())) return t('st_d_yesterday');
  const [Y, M, D] = k.split('-').map(Number);
  return fmtDate(new Date(Y, M - 1, D).getTime());
}

export function renderStudy(root, { rerender }) {
  clear(root);
  root.appendChild(el('h2', {}, t('screen_study')));
  root.appendChild(el('p', { class: 'muted' }, t('st_intro')));

  const strip = el('div', { class: 'row', style: 'gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;scrollbar-width:none' });
  const body = el('div', {});
  function paint() {
    clear(strip);
    for (const [id, key] of TABS) {
      strip.appendChild(el('button', {
        class: id === _tab ? '' : 'secondary',
        style: 'font-size:13px;padding:8px 12px;white-space:nowrap;flex:none',
        onclick: () => { _tab = id; paint(); }
      }, t(key)));
    }
    clear(body);
    ({ quiz: renderQuiz, progress: renderProgress, diary: renderDiary, teach: renderTeach, glossary: renderGlossary })[_tab](body, paint);
  }
  paint();
  root.appendChild(strip);
  root.appendChild(body);
}

// ---------------- Викторина ----------------
function renderQuiz(root, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('st_q_intro')));
  const statsBox = el('div', { class: 'card' });
  function paintStats() {
    clear(statsBox);
    const s = quizStats();
    statsBox.appendChild(el('div', { class: 'row wrap', style: 'gap:6px' }, [
      el('span', { class: 'badge' }, tf('st_q_points', s.points)),
      el('span', { class: 'badge' }, tf('st_q_streak', s.streak)),
      el('span', { class: 'badge' }, tf('st_q_best', s.best))
    ]));
    statsBox.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, tf('st_q_total', s.answered, s.correct, s.pct)));
    if (s.answered) {
      statsBox.appendChild(el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px;margin-top:8px', onclick: () => {
        resetQuiz(); toast(t('st_q_reset_done')); paintStats();
      } }, t('st_q_reset')));
    }
  }
  paintStats();
  root.appendChild(statsBox);

  if (!quizAvailable()) {
    root.appendChild(el('div', { class: 'card' }, el('p', { class: 'muted' }, t('st_q_empty'))));
    return;
  }

  const qCard = el('div', { class: 'card' });
  let sessionN = 0, sessionOk = 0;
  function ask() {
    clear(qCard);
    const q = nextQuestion();
    if (!q) { qCard.appendChild(el('p', { class: 'muted' }, t('st_q_empty'))); return; }
    const title = q.kind === 'topic' ? t('st_q_type_topic') : q.kind === 'def' ? tf('st_q_type_def', q.prompt) : tf('st_q_type_mem', q.prompt);
    qCard.appendChild(el('div', { style: 'font-weight:700;margin-bottom:6px' }, title));
    if (q.text) qCard.appendChild(el('div', { class: 'mem-item', style: 'white-space:pre-wrap' }, q.text));
    const opts = el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:8px' });
    const fb = el('div', { style: 'margin-top:10px;font-weight:600;min-height:20px;white-space:pre-wrap' });
    const btns = [];
    function finish(idx) {
      for (const b of btns) b.disabled = true;
      sessionN++;
      const ok = idx === q.answer;
      const r = recordAnswer(idx == null ? null : ok);
      if (ok) { sessionOk++; fb.textContent = tf('st_q_correct', r.gained); fb.style.color = 'var(--ok)'; btns[idx].style.outline = '2px solid var(--ok)'; }
      else {
        fb.textContent = tf(idx == null ? 'st_q_skipped' : 'st_q_wrong', q.options[q.answer]);
        fb.style.color = 'var(--err)';
        btns[q.answer].style.outline = '2px solid var(--ok)';
        if (idx != null) btns[idx].style.outline = '2px solid var(--err)';
      }
      if (q.source) qCard.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-top:6px' }, '📎 ' + tf('st_q_source', srcLabel(q.source))));
      qCard.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, tf('st_q_session', sessionOk, sessionN)));
      qCard.appendChild(el('button', { class: 'block', style: 'margin-top:10px', onclick: ask }, t('st_q_next')));
      paintStats();
    }
    q.options.forEach((o, i) => {
      const b = el('button', { class: 'secondary', style: 'text-align:left;white-space:pre-wrap;font-weight:500', onclick: () => finish(i) }, o);
      btns.push(b); opts.appendChild(b);
    });
    qCard.appendChild(opts);
    qCard.appendChild(el('button', { class: 'ghost', style: 'margin-top:6px;padding:6px 10px;font-size:13px', onclick: () => finish(null) }, t('st_q_dontknow')));
    qCard.appendChild(fb);
  }
  qCard.appendChild(el('button', { class: 'block', onclick: ask }, t('st_q_start')));
  root.appendChild(qCard);
}

// ---------------- Напредък ----------------
function renderProgress(root) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('st_p_intro')));
  const p = progressStats();
  if (!p.notes && !p.memory) {
    root.appendChild(el('div', { class: 'card' }, el('p', { class: 'muted' }, t('st_p_nothing'))));
    return;
  }
  const tile = (label, val) => el('div', { class: 'mem-item', style: 'flex:1 1 30%;text-align:center;margin:0' }, [
    el('div', { style: 'font-size:22px;font-weight:700;color:var(--accent-2)' }, String(val)),
    el('div', { class: 'muted', style: 'font-size:12px' }, label)
  ]);
  root.appendChild(el('div', { class: 'row wrap', style: 'gap:8px;margin-bottom:14px' }, [
    tile(t('st_p_topics'), p.topics), tile(t('st_p_notes'), p.notes), tile(t('st_p_memory'), p.memory),
    tile(t('st_p_packs'), p.packs), tile(t('st_p_sources'), p.sources), tile(t('st_p_days'), p.days)
  ]));

  // По дни (14 дни) — стълбчета от натрупаното, чист DOM.
  const max = Math.max(1, ...p.byDay.map((d) => d.count));
  const bars = el('div', { style: 'display:flex;align-items:flex-end;gap:4px;height:90px;margin-top:8px' });
  const labels = el('div', { style: 'display:flex;gap:4px;margin-top:4px' });
  p.byDay.forEach((d, i) => {
    const h = Math.max(2, Math.round((d.count / max) * 80));
    const last = i === p.byDay.length - 1;
    bars.appendChild(el('div', { title: d.key + ': ' + d.count, style: `flex:1;height:${h}px;border-radius:4px 4px 0 0;background:${last ? 'var(--accent)' : 'var(--accent-2)'};opacity:${d.count ? 1 : .25}` }));
    labels.appendChild(el('div', { class: 'muted', style: 'flex:1;text-align:center;font-size:9px' }, last ? t('st_p_today') : String(d.day)));
  });
  root.appendChild(el('div', { class: 'card' }, [ el('h3', {}, t('st_p_last14')), bars, labels ]));

  if (p.top.length) {
    const tmax = p.top[0].count;
    root.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, t('st_p_top')),
      ...p.top.map((s) => el('div', { style: 'margin-bottom:8px' }, [
        el('div', { class: 'row spread', style: 'font-size:13px' }, [ el('span', {}, s.name), el('span', { class: 'muted' }, String(s.count)) ]),
        el('div', { style: 'height:6px;border-radius:3px;background:var(--bg-2);overflow:hidden' },
          el('div', { style: `height:100%;width:${Math.round((s.count / tmax) * 100)}%;background:var(--accent)` }))
      ]))
    ]));
  }
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'muted', style: 'font-size:13px' }, tf('st_p_quiz', p.quiz.answered, p.quiz.pct, p.quiz.best)),
    el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px' }, tf('st_p_lessons', p.lessons)),
    p.first ? el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px' }, tf('st_p_first', fmtDate(p.first))) : null
  ]));
}

// ---------------- Дневник ----------------
let _diaryDay = null;
function renderDiary(root, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('st_d_intro')));
  const days = diaryDays();
  if (!days.length) { root.appendChild(el('div', { class: 'card' }, el('p', { class: 'muted' }, t('st_d_none')))); return; }
  if (!_diaryDay || !days.some((d) => d.key === _diaryDay)) _diaryDay = days[0].key;
  root.appendChild(el('div', { class: 'row', style: 'gap:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none' },
    days.slice(0, 14).map((d) => el('button', {
      class: d.key === _diaryDay ? '' : 'secondary', style: 'font-size:12px;padding:6px 10px;white-space:nowrap;flex:none',
      onclick: () => { _diaryDay = d.key; repaint(); }
    }, dayLabel(d.key) + ' · ' + d.count))));

  const list = el('div', {});
  function paintList() {
    clear(list);
    const items = diaryFor(_diaryDay);
    list.appendChild(el('h3', { style: 'margin-top:8px' }, dayLabel(_diaryDay) + ' — ' + tf('st_d_count', items.length)));
    if (!items.length) { list.appendChild(el('p', { class: 'muted' }, t('st_d_empty'))); return; }
    if (items.length > 1) {
      list.appendChild(el('button', { class: 'danger', style: 'font-size:12px;padding:6px 10px;margin-bottom:8px', onclick: () => {
        if (!confirm(tf('st_d_forget_day_q', items.length))) return;
        const n = forgetDay(_diaryDay); toast(tf('st_d_forgot_n', n)); repaint();
      } }, tf('st_d_forget_day', dayLabel(_diaryDay))));
    }
    for (const e of items.slice(0, 60)) {
      const wrap = el('div', { class: 'mem-item' });
      wrap.appendChild(el('div', {}, [
        el('span', { class: 'badge' }, e.kind === 'mem' ? t('st_d_kind_mem') : tf('st_d_kind_note', e.subject)),
        el('span', { class: 'muted', style: 'font-size:11px' }, new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      ]));
      wrap.appendChild(el('div', { class: 'v', style: 'white-space:pre-wrap;color:var(--text)' }, e.text.length > 400 ? e.text.slice(0, 399) + '…' : e.text));
      wrap.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' }, '📎 ' + (e.kind === 'mem' ? t('st_src_memory') : srcLabel(e.source))));
      wrap.appendChild(el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px;margin-top:8px', onclick: () => {
        forgetEvent(e); toast(t('st_d_forgot')); repaint();
      } }, t('st_d_forget')));
      list.appendChild(wrap);
    }
    if (items.length > 60) list.appendChild(el('p', { class: 'muted', style: 'font-size:12px' }, tf('st_d_count', items.length)));
  }
  paintList();
  root.appendChild(list);
}

// ---------------- Учи ме ----------------
function renderTeach(root, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('st_t_intro')));
  const topicIn = el('input', { type: 'text', placeholder: t('st_t_topic_ph') });
  const textIn = el('textarea', { placeholder: t('st_t_text_ph'), style: 'min-height:110px' });
  const echo = el('div', { class: 'mem-item', style: 'display:none;white-space:pre-wrap' });
  let listening = false;
  const micBtn = el('button', { class: 'secondary', style: 'flex:none', onclick: async () => {
    if (listening) { stopListening(); return; }
    if (!sttAvailable()) { toast(t('st_t_stt_fail')); return; }
    listening = true; micBtn.textContent = t('st_t_mic_stop'); micBtn.classList.add('mic-btn', 'on');
    const prefix = textIn.value.trim();
    const join = (a, b) => (a ? a + ' ' + b : b);
    try {
      const st = getState();
      const tx = await startListening({ lang: (st.settings.voice && st.settings.voice.lang) || 'bg-BG', manualStop: true,
        onInterim: (x) => { if (x) textIn.value = join(prefix, x); } });
      if (tx) textIn.value = join(prefix, tx);
    } catch (_) { toast(t('st_t_stt_fail')); }
    finally { listening = false; micBtn.textContent = t('st_t_mic'); micBtn.classList.remove('on'); }
  } }, t('st_t_mic'));

  function doEcho() {
    const txt = textIn.value.trim();
    if (!txt) { toast(t('st_t_need_text')); return null; }
    const p = paraphrase(txt, topicIn.value.trim());
    clear(echo); echo.style.display = 'block';
    echo.appendChild(el('div', {}, tf('st_t_echo', p.topic, p.summary)));
    if (p.keywords.length) echo.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, tf('st_t_keywords', p.keywords.join(', '))));
    echo.appendChild(el('div', { class: 'muted', style: 'font-size:12px' }, tf('st_t_sentences', p.sentences, p.words)));
    return p;
  }
  root.appendChild(el('div', { class: 'card' }, [
    el('label', {}, t('st_t_topic')), topicIn,
    el('label', {}, t('st_t_text')), textIn,
    el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [
      sttAvailable() ? micBtn : null,
      el('button', { class: 'secondary grow', onclick: doEcho }, t('st_t_echo_btn')),
      el('button', { class: 'grow', onclick: () => {
        const p = doEcho(); if (!p) return;
        const r = saveLesson(p.topic, textIn.value);
        if (r.dup) { toast(t('st_t_dup')); return; }
        if (r.ok) { toast(tf('st_t_saved', r.topic)); textIn.value = ''; paintLessons(); }
      } }, t('st_t_save_btn'))
    ]),
    echo
  ]));

  const lessonsBox = el('div', {});
  function paintLessons() {
    clear(lessonsBox);
    const ls = listLessons();
    lessonsBox.appendChild(el('h3', { style: 'margin-top:8px' }, tf('st_t_lessons', ls.length)));
    if (!ls.length) { lessonsBox.appendChild(el('p', { class: 'muted' }, t('st_t_no_lessons'))); return; }
    for (const l of ls.slice(0, 40)) {
      lessonsBox.appendChild(el('div', { class: 'mem-item' }, [
        el('div', {}, [ el('span', { class: 'badge' }, l.topic), el('span', { class: 'muted', style: 'font-size:11px' }, fmtDate(l.at)) ]),
        el('div', { class: 'v', style: 'white-space:pre-wrap' }, l.text.length > 300 ? l.text.slice(0, 299) + '…' : l.text),
        el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px;margin-top:8px', onclick: () => {
          deleteLesson(l.id); toast(t('st_d_forgot')); paintLessons();
        } }, t('st_d_forget'))
      ]));
    }
  }
  paintLessons();
  root.appendChild(lessonsBox);
}

// ---------------- Речник на моите думи ----------------
function renderGlossary(root, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('st_g_intro')));
  const wordIn = el('input', { type: 'text', placeholder: t('st_g_add_word') });
  const exIn = el('textarea', { placeholder: t('st_g_add_explain'), style: 'min-height:60px' });
  root.appendChild(el('div', { class: 'card' }, [
    el('label', {}, t('st_g_add_word')), wordIn,
    el('label', {}, t('st_g_add_explain')), exIn,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: () => {
      const w = wordIn.value.trim(), x = exIn.value.trim();
      if (!w || !x) { toast(t('mem_fill_both')); return; }
      setWordExplain(w, x); toast(t('st_g_saved')); repaint();
    } }, t('st_g_add_btn'))
  ]));

  const search = el('input', { type: 'text', placeholder: t('st_g_search_ph') });
  const list = el('div', { style: 'margin-top:10px' });
  const all = ownerWords();
  function paintList() {
    clear(list);
    const q = search.value.trim().toLowerCase();
    const items = q ? all.filter((w) => w.word.includes(q)) : all;
    if (!items.length) { list.appendChild(el('p', { class: 'muted' }, t('st_g_empty'))); return; }
    for (const w of items) list.appendChild(wordItem(w, repaint));
  }
  search.addEventListener('input', paintList);
  root.appendChild(search);
  paintList();
  root.appendChild(list);
}

function wordItem(w, repaint) {
  const wrap = el('div', { class: 'mem-item' });
  function view() {
    clear(wrap);
    const fromTxt = w.from === 'you' ? t('st_g_from_you') : w.from === 'memory' ? t('st_g_from_memory') : w.from === 'topic' ? tf('st_g_from_topic', w.topic || '') : '';
    wrap.appendChild(el('div', {}, [
      el('span', { class: 'badge' }, tf('st_g_uses', w.count)),
      w.first ? el('span', { class: 'muted', style: 'font-size:11px' }, fmtDate(w.first)) : null
    ]));
    wrap.appendChild(el('div', { class: 'k' }, w.word));
    wrap.appendChild(el('div', { class: 'v', style: w.explain ? '' : 'font-style:italic' }, w.explain || t('st_g_unknown')));
    if (fromTxt) wrap.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' }, '📎 ' + fromTxt));
    wrap.appendChild(el('div', { class: 'row', style: 'margin-top:8px;gap:8px' }, [
      el('button', { class: 'secondary', style: 'flex:1;font-size:12px;padding:6px 10px', onclick: edit }, t('st_g_explain_btn')),
      w.from === 'you' ? el('button', { class: 'secondary', style: 'flex:1;font-size:12px;padding:6px 10px', onclick: () => {
        removeWord(w.word); toast(t('deleted')); repaint();
      } }, t('st_g_remove')) : null
    ]));
  }
  function edit() {
    clear(wrap);
    const x = el('textarea', {}, w.from === 'you' ? w.explain : '');
    wrap.appendChild(el('div', { class: 'k' }, w.word));
    wrap.appendChild(el('label', {}, t('st_g_add_explain')));
    wrap.appendChild(x);
    wrap.appendChild(el('div', { class: 'row', style: 'margin-top:8px;gap:8px' }, [
      el('button', { style: 'flex:1', onclick: () => {
        const v = x.value.trim(); if (!v) { toast(t('mem_fill_both')); return; }
        setWordExplain(w.word, v); toast(t('st_g_saved')); repaint();
      } }, t('save')),
      el('button', { class: 'secondary', style: 'flex:1', onclick: view }, t('cancel'))
    ]));
  }
  view();
  return wrap;
}
