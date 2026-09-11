// Version: 1.0036
// advisor.js (екран) — „Съветник“: първият екран на приложението. Три под-таба:
//   Питай    — въпрос (текст/диктовка) → присъда „за/против/факти“, всяка точка сочи откъде идва;
//   Решения  — история + обратна връзка „как мина“ (подобрява следващите съвети);
//   За теб   — откъде черпя (памет, Спътник, Нотариус, научено, уроци) — прозрачност.
// Всичко е от локалните данни; нищо не се тегли от мрежата.
import { el, clear, toast } from '../ui/dom.js';
import { getState } from '../core/storage.js';
import { sttAvailable, startListening, stopListening } from '../core/voice.js';
import { advise, verdictText, fromLabel, listDecisions, setOutcome, deleteDecision, advisorStats, knowledgeOverview } from '../core/advisor.js';
import { isSetUp as notarySetUp } from '../core/notary.js';
import { t, tf } from '../core/i18n.js';

const TABS = [ ['ask', 'adv_tab_ask'], ['history', 'adv_tab_history'], ['about', 'adv_tab_about'] ];
let _tab = 'ask';
let _lastDecisionId = null;   // последната присъда — остава на екрана при повторно рисуване

const VERDICT_COLOR = { go: 'var(--ok)', wait: 'var(--warn)', no: 'var(--err)', unclear: 'var(--muted)' };
function fmtDate(ts) { try { return new Date(ts).toLocaleDateString(); } catch (_) { return String(ts); } }

export function renderAdvisor(root, { navigate }) {
  clear(root);
  root.appendChild(el('h2', {}, t('screen_advisor')));
  root.appendChild(el('p', { class: 'muted' }, t('adv_intro')));

  const strip = el('div', { class: 'row', style: 'gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;scrollbar-width:none' });
  const body = el('div', {});
  function paint() {
    clear(strip);
    for (const [id, key] of TABS) {
      strip.appendChild(el('button', { class: id === _tab ? '' : 'secondary', style: 'font-size:13px;padding:8px 12px;white-space:nowrap;flex:none', onclick: () => { _tab = id; paint(); } }, t(key)));
    }
    clear(body);
    ({ ask: renderAsk, history: renderHistory, about: renderAbout })[_tab](body, paint, navigate);
  }
  paint();
  root.appendChild(strip);
  root.appendChild(body);
}

// Карта с присъда: заглавие + обяснение + списъци „за“/„против“/„факти“ с източник.
function decisionCard(d, { compact = false } = {}) {
  const v = verdictText(d);
  const card = el('div', { class: 'card', style: `border-left:4px solid ${VERDICT_COLOR[d.verdict] || 'var(--muted)'}` });
  card.appendChild(el('div', { class: 'row spread', style: 'align-items:flex-start' }, [
    el('div', { style: 'font-weight:700;color:' + (VERDICT_COLOR[d.verdict] || 'var(--text)') }, v.title),
    el('span', { class: 'badge' }, t('adv_kind_' + d.kind))
  ]));
  if (!compact) card.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px' }, fmtDate(d.at)));
  card.appendChild(el('div', { style: 'margin-top:6px;white-space:pre-wrap' }, v.explain));
  const section = (title, arr, color) => {
    if (!arr.length) return null;
    return el('div', { style: 'margin-top:10px' }, [
      el('div', { style: `font-weight:600;color:${color}` }, title),
      ...arr.map((x) => el('div', { class: 'mem-item', style: 'margin:6px 0 0' }, [
        el('div', { style: 'white-space:pre-wrap' }, x.text),
        el('div', { class: 'muted', style: 'font-size:11px;margin-top:3px' }, '📎 ' + fromLabel(x) + (x.date ? ' · ' + x.date : ''))
      ]))
    ]);
  };
  card.appendChild(section(t('adv_pros'), d.pros, 'var(--ok)'));
  card.appendChild(section(t('adv_cons'), d.cons, 'var(--err)'));
  card.appendChild(section(t('adv_facts'), d.facts, 'var(--accent-2)'));
  if (d.notaryClosed && notarySetUp()) card.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:8px' }, '🔒 ' + t('adv_notary_locked')));
  return card;
}

// ---------------- Питай ----------------
function renderAsk(root, repaint, navigate) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('adv_ask_intro')));
  const input = el('textarea', { placeholder: t('adv_ask_ph'), style: 'min-height:80px' });
  const chips = el('div', { class: 'row wrap', style: 'gap:6px;margin:6px 0' });
  for (const k of ['buy', 'learn', 'sell', 'do']) {
    chips.appendChild(el('button', { class: 'ghost', style: 'font-size:12px;padding:5px 9px', onclick: () => { input.value = t('adv_ex_' + k) + ' '; input.focus(); } }, t('adv_ex_' + k)));
  }
  let listening = false;
  const micBtn = el('button', { class: 'secondary', style: 'flex:none', onclick: async () => {
    if (listening) { stopListening(); return; }
    if (!sttAvailable()) { toast(t('adv_stt_fail')); return; }
    listening = true; micBtn.textContent = t('st_t_mic_stop'); micBtn.classList.add('mic-btn', 'on');
    const prefix = input.value.trim();
    const join = (a, b) => (a ? a + ' ' + b : b);
    try {
      const st = getState();
      const tx = await startListening({ lang: (st.settings.voice && st.settings.voice.lang) || 'bg-BG', manualStop: true, onInterim: (x) => { if (x) input.value = join(prefix, x); } });
      if (tx) input.value = join(prefix, tx);
    } catch (_) { toast(t('adv_stt_fail')); }
    finally { listening = false; micBtn.textContent = t('st_t_mic'); micBtn.classList.remove('on'); }
  } }, t('st_t_mic'));

  const result = el('div', {});
  function ask() {
    const q = input.value.trim();
    if (!q) { toast(t('adv_need_text')); return; }
    const d = advise(q);
    _lastDecisionId = d.id;
    clear(result);
    result.appendChild(decisionCard(d));
    result.appendChild(el('div', { class: 'muted', style: 'font-size:12px' }, t('adv_saved')));
    if (d.verdict === 'unclear') {
      result.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
        el('button', { class: 'secondary grow', onclick: () => navigate('companion') }, t('nav_companion')),
        el('button', { class: 'secondary grow', onclick: () => navigate('notary') }, t('nav_notary'))
      ]));
    }
  }
  root.appendChild(el('div', { class: 'card' }, [
    el('label', {}, t('adv_ask_label')), input, chips,
    el('div', { class: 'row', style: 'gap:8px;margin-top:6px' }, [ sttAvailable() ? micBtn : null, el('button', { class: 'grow', onclick: ask }, t('adv_ask_btn')) ])
  ]));
  root.appendChild(result);
  // последната присъда остава видима (напр. след смяна на под-таб)
  if (_lastDecisionId) { const d = listDecisions().find((x) => x.id === _lastDecisionId); if (d) result.appendChild(decisionCard(d)); }
}

// ---------------- Решения ----------------
let _open = null;
function renderHistory(root, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('adv_h_intro')));
  const s = advisorStats();
  root.appendChild(el('div', { class: 'row wrap', style: 'gap:6px;margin-bottom:8px' }, [
    el('span', { class: 'badge' }, tf('adv_a_stats', s.total, s.good, s.mixed, s.bad))
  ]));
  const list = listDecisions();
  if (!list.length) { root.appendChild(el('div', { class: 'card' }, el('p', { class: 'muted' }, t('adv_h_empty')))); return; }
  for (const d of list.slice(0, 80)) {
    const v = verdictText(d);
    const wrap = el('div', { class: 'mem-item', style: `border-left:3px solid ${VERDICT_COLOR[d.verdict] || 'var(--muted)'}` });
    wrap.appendChild(el('div', { class: 'row spread' }, [
      el('span', { style: 'font-weight:600;color:' + (VERDICT_COLOR[d.verdict] || 'var(--text)') }, v.title),
      el('span', { class: 'muted', style: 'font-size:11px' }, fmtDate(d.at))
    ]));
    wrap.appendChild(el('div', { class: 'v', style: 'white-space:pre-wrap;color:var(--text)' }, d.question));
    const oc = d.outcome;
    const ocLabel = oc ? t('adv_o_' + oc.rating) + (oc.note ? ' — ' + oc.note : '') : t('adv_o_pending');
    wrap.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, t('adv_h_outcome') + ' ' + ocLabel));
    const btns = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' });
    const note = el('input', { type: 'text', placeholder: t('adv_o_note_ph'), style: 'margin-top:6px' });
    for (const r of ['good', 'mixed', 'bad']) {
      btns.appendChild(el('button', { class: (oc && oc.rating === r) ? '' : 'secondary', style: 'font-size:12px;padding:6px 10px;flex:1', onclick: () => {
        setOutcome(d.id, r, note.value); toast(t('adv_o_saved')); repaint();
      } }, t('adv_o_' + r)));
    }
    wrap.appendChild(btns);
    wrap.appendChild(note);
    const det = el('div', { style: 'margin-top:8px' });
    const toggle = el('button', { class: 'ghost', style: 'font-size:12px;padding:5px 9px;margin-top:6px', onclick: () => {
      _open = _open === d.id ? null : d.id; paintDet();
    } }, '');
    function paintDet() {
      clear(det);
      toggle.textContent = _open === d.id ? t('adv_h_hide') : t('adv_h_details');
      if (_open === d.id) {
        det.appendChild(decisionCard(d, { compact: true }));
        det.appendChild(el('button', { class: 'danger', style: 'font-size:12px;padding:6px 10px', onclick: () => { deleteDecision(d.id); toast(t('deleted')); repaint(); } }, t('delete')));
      }
    }
    paintDet();
    wrap.appendChild(toggle);
    wrap.appendChild(det);
    root.appendChild(wrap);
  }
}

// ---------------- За теб ----------------
function renderAbout(root, repaint, navigate) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('adv_a_intro')));
  const o = knowledgeOverview();
  const tile = (label, val, route) => el('div', { class: 'mem-item', style: 'flex:1 1 30%;text-align:center;margin:0;cursor:pointer', onclick: () => route && navigate(route) }, [
    el('div', { style: 'font-size:22px;font-weight:700;color:var(--accent-2)' }, String(val)),
    el('div', { class: 'muted', style: 'font-size:12px' }, label)
  ]);
  root.appendChild(el('div', { class: 'row wrap', style: 'gap:8px;margin-bottom:12px' }, [
    tile(t('adv_a_memory'), o.memory, 'memory'), tile(t('adv_a_bio'), o.bio, 'companion'), tile(t('adv_a_work'), o.work, 'companion'),
    tile(t('adv_a_life'), o.life, 'companion'), tile(t('adv_a_learned'), o.learned, 'study'), tile(t('adv_a_lessons'), o.lessons, 'study')
  ]));
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row spread' }, [ el('b', {}, t('adv_a_notary')), el('span', { class: 'badge' }, o.notaryOpen ? tf('adv_a_notary_n', o.notary) : '🔒') ]),
    el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, o.notaryOpen ? t('adv_a_notary_on') : t('adv_a_notary_off')),
    el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px;margin-top:8px', onclick: () => navigate('notary') }, t('nav_notary'))
  ]));
  const s = o.decisions;
  root.appendChild(el('div', { class: 'card' }, [
    el('div', {}, tf('adv_a_stats', s.total, s.good, s.mixed, s.bad)),
    el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, t('adv_a_tip'))
  ]));
}
