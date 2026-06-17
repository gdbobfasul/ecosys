// tasks.js (screen) — екран „Задачи“: дай задача, виж резултат, виж научените теми
// и потока „Какво уча сега“ + брояч на наученото.
import { el, clear, toast } from '../ui/dom.js';
import { parseTask, runTask } from '../core/tasks.js';
import { listSubjects, deleteSubject, listInterests } from '../core/subjects.js';
import { learningFeed, learnedCount, currentlyLearning, learningEnabled, setLearningEnabled, tick } from '../core/learning-loop.js';

export function renderTasks(root, { rerender }) {
  clear(root);

  root.appendChild(el('h2', {}, 'Задачи'));
  root.appendChild(el('p', { class: 'muted' },
    'Дай ми задача: реши задача, научи тема, събери крипто/валути/новини. ' +
    'Пазя само проверим материал с източник — ако не намеря, казвам честно.'));

  // --- Поле за задача ---
  const taskInput = el('input', { type: 'text', placeholder: 'напр. „реши 2x+3=11“ или „научи за фотосинтеза“' });
  const result = el('div', { class: 'card', style: 'white-space:pre-wrap; display:none' });
  let busy = false;

  async function run(presetText) {
    if (busy) return;
    const text = (presetText != null ? presetText : taskInput.value).trim();
    if (!text) { toast('Напиши задача.'); return; }
    const task = parseTask(text);
    if (!task) { showResult('Не разпознах това като задача. Опитай „реши …“, „научи за …“, „крипто“, „валути“, „новини“.'); return; }
    busy = true;
    showResult('Работя по задачата…');
    try {
      const res = await runTask(task);
      showResult(res.text);
      if (res.learned) rerenderSubjects();
    } catch (_) {
      showResult('Нещо се обърка при изпълнението.');
    }
    busy = false;
  }
  function showResult(text) {
    result.style.display = 'block';
    result.textContent = text;
  }

  taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  root.appendChild(el('div', { class: 'card' }, [
    el('label', {}, 'Дай задача'),
    taskInput,
    el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
      el('button', { style: 'flex:1', onclick: () => run() }, 'Изпълни'),
    ]),
    el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' },
      ['крипто', 'валути', 'новини', 'научи за космос'].map((t) =>
        el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px', onclick: () => run(t) }, t)
      )
    )
  ]));
  root.appendChild(result);

  // --- Непрекъснато учене: „Какво уча сега“ + брояч + пауза/продължи ---
  const learnCard = el('div', { class: 'card' });
  function renderLearnCard() {
    clear(learnCard);
    const on = learningEnabled();
    const cur = currentlyLearning();
    learnCard.appendChild(el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, 'Непрекъснато учене („НЯМА спирка“)'),
        el('div', { class: 'muted', style: 'font-size:13px' },
          'Когато нямам задача, уча сам от безплатни източници.')
      ]),
      (() => {
        const sw = el('div', { class: 'switch' + (on ? ' on' : '') });
        sw.addEventListener('click', () => { setLearningEnabled(!on); renderLearnCard(); });
        return sw;
      })()
    ]));
    learnCard.appendChild(el('div', { class: 'row spread', style: 'margin-top:8px' }, [
      el('div', { class: 'muted' }, 'Научени неща общо:'),
      el('div', { style: 'font-weight:700;color:var(--accent-2)' }, String(learnedCount()))
    ]));
    learnCard.appendChild(el('div', { style: 'margin-top:8px' }, [
      el('div', { class: 'muted', style: 'font-size:13px' }, 'Какво уча сега:'),
      el('div', { style: 'font-weight:600' }, cur ? cur.note : (on ? 'Подготвям се…' : 'На пауза.'))
    ]));
    if (on) {
      learnCard.appendChild(el('button', {
        class: 'secondary block', style: 'margin-top:10px',
        onclick: async () => { await tick(); renderLearnCard(); rerenderSubjects(); }
      }, 'Научи нещо сега'));
    }
    // поток на активността
    const feed = learningFeed().slice(0, 8);
    if (feed.length) {
      learnCard.appendChild(el('div', { class: 'muted', style: 'font-size:13px;margin-top:10px' }, 'Поток на активността:'));
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
    subjWrap.appendChild(el('h3', { style: 'margin-top:8px' }, `Научени теми (${subjects.length})`));
    if (!subjects.length) {
      subjWrap.appendChild(el('p', { class: 'muted' },
        'Още нямам научени теми. Дай ми задача „научи за …“ или ме остави да уча сам.'));
      subjWrap.appendChild(el('p', { class: 'muted', style: 'font-size:12px' },
        'Ротирам интереси: ' + listInterests().slice(0, 6).join(', ') + '…'));
      return;
    }
    for (const s of subjects) subjWrap.appendChild(subjectItem(s, rerenderSubjects));
  }
  rerenderSubjects();
  root.appendChild(subjWrap);
}

function subjectItem(s, rerenderSubjects) {
  const wrap = el('div', { class: 'mem-item' });
  wrap.appendChild(el('div', {}, [
    el('span', { class: 'badge' }, `${s.notes.length} наставки`)
  ]));
  wrap.appendChild(el('div', { class: 'k' }, s.name));
  const latest = s.notes[0];
  if (latest) {
    wrap.appendChild(el('div', { class: 'v', style: 'white-space:pre-wrap' }, latest.text));
    wrap.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' }, '📎 ' + latest.source));
  }
  wrap.appendChild(el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
    el('button', { class: 'danger', style: 'flex:1', onclick: () => {
      deleteSubject(s.id); toast('Темата е изтрита.'); rerenderSubjects();
    } }, 'Изтрий темата')
  ]));
  return wrap;
}
