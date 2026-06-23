// tasks.js (screen) — екран „Задачи“: дай задача, виж резултат, виж научените теми
// и потока „Какво уча сега“ + брояч на наученото.
import { el, clear, toast } from '../ui/dom.js';
import { parseTask, intakeAndRun } from '../core/tasks.js';
import { listTasks, removeTask, clearFinished, statusLabel } from '../core/tasklist.js';
import { listSubjects, deleteSubject, listInterests } from '../core/subjects.js';
import { learningFeed, learnedCount, currentlyLearning, learningEnabled, setLearningEnabled, tick } from '../core/learning-loop.js';
import { t, tf } from '../core/i18n.js';

export function renderTasks(root, { rerender }) {
  clear(root);

  root.appendChild(el('h2', {}, t('screen_tasks')));
  root.appendChild(el('p', { class: 'muted' }, t('tasks_intro')));

  // --- Поле за задача ---
  const taskInput = el('input', { type: 'text', placeholder: t('tasks_input_ph') });
  const result = el('div', { class: 'card', style: 'white-space:pre-wrap; display:none' });
  let busy = false;

  async function run(presetText) {
    if (busy) return;
    const text = (presetText != null ? presetText : taskInput.value).trim();
    if (!text) { toast(t('tasks_write_one')); return; }
    const task = parseTask(text);
    if (!task) { showResult(t('tasks_not_recognized')); return; }
    busy = true;
    showResult(t('tasks_working'));
    try {
      // intakeAndRun ВКАРВА задачата в постоянния списък (pending→running→done/failed).
      const { res } = await intakeAndRun(text);
      showResult(res.text);
      renderTaskList();
      if (res.learned) rerenderSubjects();
    } catch (_) {
      showResult(t('tasks_run_fail'));
    }
    busy = false;
  }
  function showResult(text) {
    result.style.display = 'block';
    result.textContent = text;
  }

  taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  const quickKeys = [
    ['tasks_q_crypto', t('tasks_q_crypto')],
    ['tasks_q_currencies', t('tasks_q_currencies')],
    ['tasks_q_news', t('tasks_q_news')],
    ['tasks_q_learn_space', t('tasks_q_learn_space')]
  ];
  root.appendChild(el('div', { class: 'card' }, [
    el('label', {}, t('tasks_give_label')),
    taskInput,
    el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
      el('button', { style: 'flex:1', onclick: () => run() }, t('tasks_run_btn')),
    ]),
    el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' },
      quickKeys.map(([, label]) =>
        el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px', onclick: () => run(label) }, label)
      )
    )
  ]));
  root.appendChild(result);

  // --- Списък със задачите (всяка дадена задача се записва тук) ---
  const taskListWrap = el('div', {});
  function renderTaskList() {
    clear(taskListWrap);
    const tasks = listTasks();
    const header = el('div', { class: 'row spread', style: 'align-items:center;margin-top:8px' }, [
      el('h3', { style: 'margin:0' }, tf('tasks_my_tasks', tasks.length)),
    ]);
    if (tasks.some((tk) => tk.status === 'done' || tk.status === 'failed')) {
      header.appendChild(el('button', {
        class: 'secondary', style: 'font-size:12px;padding:6px 10px',
        onclick: () => { clearFinished(); renderTaskList(); }
      }, t('tasks_clear_done')));
    }
    taskListWrap.appendChild(header);
    if (!tasks.length) {
      taskListWrap.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('tasks_empty_note')));
      return;
    }
    for (const tk of tasks) taskListWrap.appendChild(taskItem(tk, renderTaskList));
  }
  renderTaskList();
  root.appendChild(taskListWrap);

  // --- Непрекъснато учене: „Какво уча сега“ + брояч + пауза/продължи ---
  const learnCard = el('div', { class: 'card' });
  function renderLearnCard() {
    clear(learnCard);
    const on = learningEnabled();
    const cur = currentlyLearning();
    learnCard.appendChild(el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, t('tasks_learn_title')),
        el('div', { class: 'muted', style: 'font-size:13px' }, t('tasks_learn_desc'))
      ]),
      (() => {
        const sw = el('div', { class: 'switch' + (on ? ' on' : '') });
        sw.addEventListener('click', () => { setLearningEnabled(!on); renderLearnCard(); });
        return sw;
      })()
    ]));
    learnCard.appendChild(el('div', { class: 'row spread', style: 'margin-top:8px' }, [
      el('div', { class: 'muted' }, t('tasks_learned_total')),
      el('div', { style: 'font-weight:700;color:var(--accent-2)' }, String(learnedCount()))
    ]));
    learnCard.appendChild(el('div', { style: 'margin-top:8px' }, [
      el('div', { class: 'muted', style: 'font-size:13px' }, t('tasks_learning_now')),
      el('div', { style: 'font-weight:600' }, cur ? cur.note : (on ? t('tasks_preparing') : t('tasks_paused')))
    ]));
    if (on) {
      learnCard.appendChild(el('button', {
        class: 'secondary block', style: 'margin-top:10px',
        onclick: async () => { await tick(); renderLearnCard(); rerenderSubjects(); }
      }, t('tasks_learn_now_btn')));
    }
    // поток на активността
    const feed = learningFeed().slice(0, 8);
    if (feed.length) {
      learnCard.appendChild(el('div', { class: 'muted', style: 'font-size:13px;margin-top:10px' }, t('tasks_activity_flow')));
      const ul = el('div', {});
      for (const f of feed) {
        ul.appendChild(el('div', { class: 'muted', style: 'font-size:12px;padding:3px 0' },
          `• ${f.note}`));
      }
      learnCard.appendChild(ul);
    }
  }
  renderLearnCard();
  root.appendChild(learnCard);

  // --- Научени теми ---
  const subjWrap = el('div', {});
  function rerenderSubjects() {
    clear(subjWrap);
    renderLearnCard();
    const subjects = listSubjects().sort((a, b) => b.updated - a.updated);
    subjWrap.appendChild(el('h3', { style: 'margin-top:8px' }, tf('tasks_subjects_count', subjects.length)));
    if (!subjects.length) {
      subjWrap.appendChild(el('p', { class: 'muted' }, t('tasks_no_subjects')));
      subjWrap.appendChild(el('p', { class: 'muted', style: 'font-size:12px' },
        tf('tasks_rotating', listInterests().slice(0, 6).join(', '))));
      return;
    }
    for (const s of subjects) subjWrap.appendChild(subjectItem(s, rerenderSubjects));
  }
  rerenderSubjects();
  root.appendChild(subjWrap);
}

function taskItem(tk, rerenderList) {
  const wrap = el('div', { class: 'mem-item' });
  const color = tk.status === 'done' ? 'var(--accent-2)'
    : tk.status === 'failed' ? 'var(--err)'
    : tk.status === 'running' ? 'var(--accent)' : 'var(--muted)';
  wrap.appendChild(el('div', { class: 'row spread' }, [
    el('span', { class: 'badge', style: `color:${color}` }, statusLabel(tk.status)),
    el('span', { class: 'muted', style: 'font-size:11px' }, kindLabel(tk.kind))
  ]));
  wrap.appendChild(el('div', { class: 'k' }, tk.text));
  if (tk.result) {
    wrap.appendChild(el('div', { class: 'v', style: 'white-space:pre-wrap;font-size:13px' }, tk.result));
  }
  if (tk.citation) {
    wrap.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' }, '📎 ' + tk.citation));
  }
  wrap.appendChild(el('button', {
    class: 'secondary', style: 'font-size:12px;padding:6px 10px;margin-top:8px',
    onclick: () => { removeTask(tk.id); rerenderList(); }
  }, t('tasks_remove_btn')));
  return wrap;
}

function kindLabel(kind) {
  return ({
    solve: t('tasks_kind_solve'), learn: t('tasks_kind_learn'), read: t('tasks_kind_read'),
    crypto: t('tasks_kind_crypto'), finance: t('tasks_kind_finance'), news: t('tasks_kind_news')
  })[kind] || kind || '';
}

function subjectItem(s, rerenderSubjects) {
  const wrap = el('div', { class: 'mem-item' });
  wrap.appendChild(el('div', {}, [
    el('span', { class: 'badge' }, tf('tasks_notes_count', s.notes.length))
  ]));
  wrap.appendChild(el('div', { class: 'k' }, s.name));
  const latest = s.notes[0];
  if (latest) {
    wrap.appendChild(el('div', { class: 'v', style: 'white-space:pre-wrap' }, latest.text));
    wrap.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' }, '📎 ' + latest.source));
  }
  wrap.appendChild(el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
    el('button', { class: 'danger', style: 'flex:1', onclick: () => {
      deleteSubject(s.id); toast(t('tasks_subject_deleted')); rerenderSubjects();
    } }, t('tasks_delete_subject'))
  ]));
  return wrap;
}
