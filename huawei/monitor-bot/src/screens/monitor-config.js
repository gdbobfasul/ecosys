// Version: 1.0013
// Екран „Настройка на монитор" — добавяне/редакция на монитор + пресети + попълване от каталога.
import { el } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { PRESETS, newMonitorId, checkMonitor } from '../core/scheduler.js';
import { t, tf } from '../core/i18n.js';

export function renderMonitorConfig(ctx) {
  const { state, go, params } = ctx;
  const editing = params && params.id ? state.monitors.find((m) => m.id === params.id) : null;
  // Предварително попълване от каталога (екран „Каталог" → „Добави").
  const prefill = (!editing && params && params.prefill) ? params.prefill : null;

  // Работен черновик.
  const draft = editing
    ? { ...editing }
    : {
        id: newMonitorId(),
        name: (prefill && prefill.name) || '',
        sourceType: (prefill && prefill.sourceType) || 'rss',
        url: (prefill && prefill.url) || '',
        jsonPath: '',
        idField: '',
        titleField: '',
        rule: 'new',
        keywords: '',
        freq: '1h',
        paused: false,
        lastCheck: null,
        lastMatch: null,
        lastStatus: t('status_new')
      };

  const form = {};

  function field(label, key, attrs = {}) {
    const input = el('input', { value: draft[key] || '', ...attrs });
    form[key] = input;
    return el('div', {}, [el('label', {}, label), input]);
  }

  const jsonBlock = el('div', { style: draft.sourceType === 'json' ? '' : 'display:none' }, [
    field(t('cfg_json_path'), 'jsonPath'),
    field(t('cfg_id_field'), 'idField'),
    field(t('cfg_title_field'), 'titleField')
  ]);

  const typeSel = el('select', {
    onchange: (e) => {
      draft.sourceType = e.target.value;
      jsonBlock.style.display = draft.sourceType === 'json' ? '' : 'none';
    }
  }, [
    optionEl('rss', t('cfg_src_rss'), draft.sourceType),
    optionEl('json', t('cfg_src_json'), draft.sourceType)
  ]);
  form.sourceType = typeSel;

  const ruleSel = el('select', {}, [
    optionEl('new', t('cfg_rule_new'), draft.rule),
    optionEl('keyword', t('cfg_rule_keyword'), draft.rule),
    optionEl('new+keyword', t('cfg_rule_both'), draft.rule)
  ]);
  form.rule = ruleSel;

  const freqSel = el('select', {}, [
    optionEl('15min', t('cfg_freq_15min'), draft.freq),
    optionEl('1h', t('cfg_freq_1h'), draft.freq),
    optionEl('daily', t('cfg_freq_daily'), draft.freq)
  ]);
  form.freq = freqSel;

  const kwInput = el('input', { value: draft.keywords || '', placeholder: t('cfg_keywords_ph') });
  form.keywords = kwInput;
  const nameInput = el('input', { value: draft.name || '', placeholder: t('cfg_name_ph') });
  form.name = nameInput;
  const urlInput = el('input', { value: draft.url || '', placeholder: 'https://...' });
  form.url = urlInput;

  function collect() {
    draft.name = nameInput.value.trim() || t('cfg_default_name');
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
    if (!draft.url) { alert(t('cfg_need_url')); return; }
    if (editing) {
      Object.assign(editing, draft);
      pushLog(state, tf('log_mon_updated', draft.name));
    } else {
      state.monitors.push(draft);
      pushLog(state, tf('log_mon_added', draft.name));
    }
    await saveState(state);
    go('dashboard');
  }

  async function test() {
    collect();
    if (!draft.url) { alert(t('cfg_need_url')); return; }
    testBtn.textContent = t('cfg_testing');
    const r = await checkMonitor(state, draft, { force: true });
    testBtn.textContent = t('cfg_test');
    if (r.ok) {
      alert(tf('cfg_conn_ok', draft.lastStatus));
    } else {
      const e = r.error;
      alert(tf('cfg_err_prefix', e.kind === 'cors' ? t('cfg_err_cors') : e.message));
    }
  }

  const testBtn = el('button', { class: 'btn', onclick: test }, t('cfg_test'));

  // Пресети
  const presetCards = PRESETS.map((p) =>
    el('button', {
      class: 'btn small',
      style: 'margin:4px 4px 0 0',
      onclick: () => {
        nameInput.value = p.labelKey ? t(p.labelKey) : p.name;
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
    }, p.labelKey ? t(p.labelKey) : p.name)
  );

  return el('div', { class: 'content' }, [
    el('h2', {}, editing ? t('cfg_edit_title') : t('cfg_new_title')),

    // Каталогът: голямият списък с готови емисии по държави (търсачка + категории).
    !editing
      ? el('button', { class: 'btn', style: 'margin-bottom:8px', onclick: () => go('directory') }, t('cfg_from_catalog'))
      : null,

    el('div', { class: 'card' }, [
      el('b', {}, t('cfg_presets_title')),
      el('div', { class: 'row', style: 'flex-wrap:wrap; margin-top:6px' }, presetCards),
      el('p', { class: 'small', style: 'margin:8px 0 0' }, t('cfg_presets_note'))
    ]),

    el('label', {}, t('cfg_name')), nameInput,
    el('label', {}, t('cfg_source_type')), typeSel,
    el('label', {}, t('cfg_url')), urlInput,
    jsonBlock,
    el('label', {}, t('cfg_rule')), ruleSel,
    el('label', {}, t('cfg_keywords')), kwInput,
    el('label', {}, t('cfg_freq')), freqSel,

    el('div', { class: 'gap' }),
    testBtn,
    el('div', { class: 'gap' }),
    el('button', { class: 'btn primary', onclick: save }, editing ? t('cfg_save_changes') : t('cfg_add_monitor')),
    el('div', { class: 'gap' }),
    el('button', { class: 'btn', onclick: () => go('dashboard') }, t('cancel'))
  ]);
}

function optionEl(value, label, current) {
  const o = el('option', { value }, label);
  if (value === current) o.setAttribute('selected', 'selected');
  return o;
}
