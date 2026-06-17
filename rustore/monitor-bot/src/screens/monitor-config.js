// Екран „Настройка на монитор" — добавяне/редакция на монитор + пресети.
import { el } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { PRESETS, newMonitorId, checkMonitor } from '../core/scheduler.js';

export function renderMonitorConfig(ctx) {
  const { state, go, params } = ctx;
  const editing = params && params.id ? state.monitors.find((m) => m.id === params.id) : null;

  // Работен черновик.
  const draft = editing
    ? { ...editing }
    : {
        id: newMonitorId(),
        name: '',
        sourceType: 'rss',
        url: '',
        jsonPath: '',
        idField: '',
        titleField: '',
        rule: 'new',
        keywords: '',
        freq: '1h',
        paused: false,
        lastCheck: null,
        lastMatch: null,
        lastStatus: 'нов'
      };

  const form = {};

  function field(label, key, attrs = {}) {
    const input = el('input', { value: draft[key] || '', ...attrs });
    form[key] = input;
    return el('div', {}, [el('label', {}, label), input]);
  }

  const jsonBlock = el('div', { style: draft.sourceType === 'json' ? '' : 'display:none' }, [
    field('JSON път до списъка (напр. data.children)', 'jsonPath'),
    field('Поле за уникален id (напр. data.id)', 'idField'),
    field('Поле за заглавие (напр. data.title)', 'titleField')
  ]);

  const typeSel = el('select', {
    onchange: (e) => {
      draft.sourceType = e.target.value;
      jsonBlock.style.display = draft.sourceType === 'json' ? '' : 'none';
    }
  }, [
    optionEl('rss', 'RSS / Atom емисия', draft.sourceType),
    optionEl('json', 'Публично JSON API', draft.sourceType)
  ]);
  form.sourceType = typeSel;

  const ruleSel = el('select', {}, [
    optionEl('new', 'Нов запис се появи', draft.rule),
    optionEl('keyword', 'Съдържа ключова дума', draft.rule),
    optionEl('new+keyword', 'Нов запис + ключова дума', draft.rule)
  ]);
  form.rule = ruleSel;

  const freqSel = el('select', {}, [
    optionEl('15min', 'На всеки 15 мин', draft.freq),
    optionEl('1h', 'На всеки час', draft.freq),
    optionEl('daily', 'Веднъж дневно', draft.freq)
  ]);
  form.freq = freqSel;

  const kwInput = el('input', { value: draft.keywords || '', placeholder: 'дума1, дума2' });
  form.keywords = kwInput;
  const nameInput = el('input', { value: draft.name || '', placeholder: 'Име на монитора' });
  form.name = nameInput;
  const urlInput = el('input', { value: draft.url || '', placeholder: 'https://...' });
  form.url = urlInput;

  function collect() {
    draft.name = nameInput.value.trim() || 'Монитор';
    draft.url = urlInput.value.trim();
    draft.sourceType = typeSel.value;
    draft.rule = ruleSel.value;
    draft.freq = freqSel.value;
    draft.keywords = kwInput.value.trim();
    draft.jsonPath = (form.jsonPath.value || '').trim();
    draft.idField = (form.idField.value || '').trim();
    draft.titleField = (form.titleField.value || '').trim();
  }

  async function save() {
    collect();
    if (!draft.url) { alert('Въведи адрес на източника.'); return; }
    if (editing) {
      Object.assign(editing, draft);
      pushLog(state, 'Мониторът „' + draft.name + '" е обновен.');
    } else {
      state.monitors.push(draft);
      pushLog(state, 'Добавен монитор „' + draft.name + '".');
    }
    await saveState(state);
    go('dashboard');
  }

  async function test() {
    collect();
    if (!draft.url) { alert('Въведи адрес на източника.'); return; }
    testBtn.textContent = 'Проверявам…';
    const r = await checkMonitor(state, draft, { force: true });
    testBtn.textContent = 'Тествай сега';
    if (r.ok) {
      alert('Връзката е ОК. Статус: ' + draft.lastStatus);
    } else {
      const e = r.error;
      alert('Грешка: ' + (e.kind === 'cors'
        ? 'CORS/мрежа. Този източник вероятно блокира браузърен fetch. Виж README за безплатен CORS прокси (Настройки → прокси).'
        : e.message));
    }
  }

  const testBtn = el('button', { class: 'btn', onclick: test }, 'Тествай сега');

  // Пресети
  const presetCards = PRESETS.map((p) =>
    el('button', {
      class: 'btn small',
      style: 'margin:4px 4px 0 0',
      onclick: () => {
        nameInput.value = p.name;
        urlInput.value = p.url;
        typeSel.value = p.sourceType;
        draft.sourceType = p.sourceType;
        jsonBlock.style.display = p.sourceType === 'json' ? '' : 'none';
        ruleSel.value = p.rule;
        freqSel.value = p.freq;
        kwInput.value = p.keywords;
        if (p.jsonPath) form.jsonPath.value = p.jsonPath;
        if (p.idField) form.idField.value = p.idField;
        if (p.titleField) form.titleField.value = p.titleField;
      }
    }, p.name)
  );

  return el('div', { class: 'content' }, [
    el('h2', {}, editing ? 'Редакция на монитор' : 'Нов монитор'),

    el('div', { class: 'card' }, [
      el('b', {}, 'Бързи пресети (безплатни)'),
      el('div', { class: 'row', style: 'flex-wrap:wrap; margin-top:6px' }, presetCards),
      el('p', { class: 'small', style: 'margin:8px 0 0' }, 'Дали минават директно зависи от CORS на източника в момента на теста.')
    ]),

    el('label', {}, 'Име'), nameInput,
    el('label', {}, 'Тип източник'), typeSel,
    el('label', {}, 'Адрес (URL)'), urlInput,
    jsonBlock,
    el('label', {}, 'Правило за съвпадение'), ruleSel,
    el('label', {}, 'Ключови думи (CSV, по желание)'), kwInput,
    el('label', {}, 'Честота на проверка'), freqSel,

    el('div', { class: 'gap' }),
    testBtn,
    el('div', { class: 'gap' }),
    el('button', { class: 'btn primary', onclick: save }, editing ? 'Запази промените' : 'Добави монитор'),
    el('div', { class: 'gap' }),
    el('button', { class: 'btn', onclick: () => go('dashboard') }, 'Отказ')
  ]);
}

function optionEl(value, label, current) {
  const o = el('option', { value }, label);
  if (value === current) o.setAttribute('selected', 'selected');
  return o;
}
