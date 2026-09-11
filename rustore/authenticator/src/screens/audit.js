// Version: 1.0025
// audit.js (екран) — „Одит на сигурността": обща оценка, обобщение (пробити/слаби/повторени/без 2FA/
// стари), план за действие (най-тежкото първо, всеки ред отваря записа за смяна на паролата) и
// списък на всички пароли с оценка. Логиката е в core/audit.js. Пробивите се проверяват ВЕДНЪЖ на
// пускане (кеш); без връзка одитът работи офлайн за всичко останало.
import { h, mount, toast } from '../ui/dom.js';
import { t, tf } from '../core/i18n.js';
import { session } from '../core/storage.js';
import { runAudit, lastAudit, gradeOf } from '../core/audit.js';
import { addSamples, hasSamples, removeSamples } from '../core/samples.js';

export function renderAudit(root, nav) {
  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list', { main: 'security' }) }, '←'),
    h('h1', { text: t('audit_title') }));
  const body = h('div', { class: 'content' });
  mount(root, topbar, body);

  const colorOf = (g) => g === 'good' ? 'var(--accent)' : g === 'mid' ? 'var(--warn)' : 'var(--danger)';
  const gradeText = (g) => g === 'good' ? t('audit_grade_good') : g === 'mid' ? t('audit_grade_mid') : t('audit_grade_bad');

  async function start() {
    if (!(session.passwords || []).length) {
      mount(body, h('div', { class: 'center' },
        h('div', { style: 'font-size:2.6em' }, '🩺'),
        h('p', { class: 'muted', text: t('audit_no_passwords') }),
        h('button', { class: 'btn accent', id: 'auditSamples', onclick: async () => { const n = await addSamples(); toast(tf('samples_added', n)); start(); }, text: '🧪 ' + t('samples_try') }),
        h('p', { class: 'muted', style: 'font-size:.82em', text: t('samples_note') })));
      return;
    }
    mount(body, h('div', { class: 'center' }, h('div', { style: 'font-size:2.2em' }, '⏳'), h('p', { class: 'muted', text: t('audit_running') })));
    let res;
    try { res = await runAudit(); } catch (e) { res = lastAudit(); }
    draw(res);
  }

  function problemText(pr) {
    if (pr.code === 'breached') return tf('audit_breached', pr.n);
    if (pr.code === 'reused') return tf('audit_reused', pr.n);
    if (pr.code === 'weak') return t('audit_weak') + ' (' + t('audit_strength_' + (pr.n == null ? 0 : pr.n)) + ')';
    if (pr.code === 'old') return tf('audit_old', pr.n);
    if (pr.code === 'no2fa') return t('audit_no2fa');
    return pr.code;
  }
  const levelIcon = (lv) => lv >= 3 ? '🔴' : lv === 2 ? '🟠' : '🟡';

  function draw(res) {
    const grade = gradeOf(res.overall);
    // Обща оценка (кръг с число + етикет)
    const gauge = h('div', { class: 'entry', style: 'flex-direction:column;align-items:center;gap:6px;padding:18px' },
      h('div', { class: 'muted', text: t('audit_score') }),
      h('div', { style: 'width:110px;height:110px;border-radius:50%;border:8px solid ' + colorOf(grade) + ';display:flex;align-items:center;justify-content:center;font-size:2.2em;font-weight:800;color:' + colorOf(grade) }, String(res.overall == null ? '—' : res.overall)),
      h('div', { style: 'font-weight:700;color:' + colorOf(grade), text: gradeText(grade) }),
      h('div', { class: 'muted', style: 'font-size:.8em;text-align:center', text: res.breachMode === 'offline' ? t('audit_breach_offline') : t('audit_breach_online') }));
    // Обобщение — 5 плочки
    const tile = (n, label, bad) => h('div', { class: 'entry', style: 'flex-direction:column;gap:2px;padding:10px;margin:0;align-items:center' },
      h('div', { style: 'font-size:1.4em;font-weight:800;color:' + (n && bad ? 'var(--danger)' : 'var(--text)') }, String(n)),
      h('div', { class: 'muted', style: 'font-size:.75em;text-align:center', text: label }));
    const sums = h('div', { style: 'display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0' },
      tile(res.sum.breached, t('audit_sum_breached'), true), tile(res.sum.weak, t('audit_sum_weak'), true), tile(res.sum.reused, t('audit_sum_reused'), true),
      tile(res.sum.no2fa, t('audit_sum_no2fa'), true), tile(res.sum.old, t('audit_sum_old'), true));
    const extra = h('p', { class: 'muted', style: 'font-size:.85em', text: tf('audit_2fa_count', res.twofaCount) + (res.seedsWithPhrase ? ' · ' + tf('audit_wallets_note', res.seedsWithPhrase) : '') });
    // План за действие
    const planHead = h('h1', { style: 'font-size:1em;margin:16px 0 8px', text: '📋 ' + t('audit_plan') });
    const planRows = res.plan.length ? res.plan.slice(0, 40).map((pr) => {
      const p = pr.item.entry;
      const row = h('div', { class: 'entry', style: 'cursor:pointer' },
        h('div', { style: 'font-size:1.3em' }, levelIcon(pr.level)),
        h('div', { class: 'info' }, h('div', { class: 'issuer', text: p.title || pr.item.site || '—' }), h('div', { class: 'acct', text: problemText(pr) })),
        h('div', { class: 'muted', style: 'font-size:.8em;white-space:nowrap', text: pr.code === 'no2fa' ? t('audit_fix_add2fa') : t('audit_fix_change') }),
        h('div', { class: 'muted' }, '›'));
      row.addEventListener('click', () => { if (pr.code === 'no2fa') nav.go('add'); else nav.go('password-edit', p); });
      return row;
    }) : [h('p', { class: 'muted', text: '✅ ' + t('audit_plan_empty') })];
    // Всички пароли с оценка
    const allHead = h('h1', { style: 'font-size:1em;margin:16px 0 8px', text: '🔑 ' + t('audit_all_entries') });
    const allRows = res.items.slice().sort((a, b) => a.score - b.score).map((it) => {
      const g = gradeOf(it.score);
      const sub = [t('audit_strength_' + it.strength.level), it.twofa ? '2FA ✓' : null, it.ageDays == null ? t('audit_age_unknown') : (it.ageDays + ' d')].filter(Boolean).join(' · ');
      const row = h('div', { class: 'entry', style: 'cursor:pointer' },
        h('div', { class: 'badge', style: 'background:' + colorOf(g) }, String(it.score)),
        h('div', { class: 'info' }, h('div', { class: 'issuer', text: it.entry.title || it.site || '—' }), h('div', { class: 'acct', text: sub })),
        h('div', { class: 'muted' }, it.problems.length ? '›' : '✓'));
      row.addEventListener('click', () => nav.go('password-edit', it.entry));
      return row;
    });
    const samplesBtn = hasSamples()
      ? h('button', { class: 'btn ghost', style: 'margin-top:16px', onclick: async () => { const n = await removeSamples(); toast(t('samples_removed')); start(); }, text: '🧹 ' + t('samples_remove') })
      : null;
    mount(body, gauge, sums, extra, planHead, ...planRows, allHead, ...allRows, samplesBtn);
  }

  start();
}
