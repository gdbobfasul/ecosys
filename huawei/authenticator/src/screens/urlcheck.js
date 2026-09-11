// Version: 1.0025
// urlcheck.js (екран) — „Проверка на адрес": поставяш адрес от имейл/съобщение → присъда (твой сайт /
// няма признаци / подозрителен / ОПАСНО) + причини + записите за този сайт. Логиката е в
// core/urlcheck.js — изцяло офлайн. Бутонът „Постави" чете клипборда (ако е позволено).
import { h, mount, toast } from '../ui/dom.js';
import { t, tf } from '../core/i18n.js';
import { analyzeUrl } from '../core/urlcheck.js';

export function renderUrlCheck(root, nav, data) {
  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => nav.go('list', { main: 'security' }) }, '←'),
    h('h1', { text: t('url_title') }));
  const input = h('input', { type: 'text', id: 'urlInput', placeholder: t('url_ph'), autocapitalize: 'none', autocomplete: 'off', spellcheck: 'false', value: (data && data.url) || '' });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
  const result = h('div', {});
  const pasteBtn = h('button', { class: 'btn ghost', style: 'margin:0;flex:0 0 auto;width:auto;padding:0 14px', onclick: async () => {
    try { const txt = await navigator.clipboard.readText(); if (txt) { input.value = txt.trim(); check(); } } catch (_) { toast('📋'); }
  }, text: '📋 ' + t('url_paste') });
  const checkBtn = h('button', { class: 'btn accent', id: 'urlCheckBtn', style: 'margin-top:10px', onclick: check, text: '🔎 ' + t('url_check') });
  mount(root, topbar, h('div', { class: 'content' },
    h('p', { class: 'muted', text: t('url_hint') }),
    h('div', { style: 'display:flex;gap:8px;align-items:stretch' }, input, pasteBtn),
    checkBtn, result));
  if (data && data.url) check();

  const verdictStyle = { known: ['✅', 'var(--accent)', t('url_verdict_known')], ok: ['🟢', 'var(--accent)', t('url_verdict_ok')],
    suspicious: ['🟠', 'var(--warn)', t('url_verdict_suspicious')], danger: ['🔴', 'var(--danger)', t('url_verdict_danger')] };

  function reasonText(r) {
    const d = r.detail || '';
    const map = { invalid: t('url_r_invalid'), no_https: t('url_r_no_https'), ip: t('url_r_ip'), userinfo: t('url_r_userinfo'), port: t('url_r_port') + (d ? ' (' + d + ')' : ''),
      punycode: tf('url_r_punycode', d), mixed: t('url_r_mixed'), lookalike: tf('url_r_lookalike', d), similar: tf('url_r_similar', d),
      brand_sub: tf('url_r_brand_sub', d), brand_in: tf('url_r_brand_in', d), hyphens: t('url_r_hyphens'), long: t('url_r_long'), tld: tf('url_r_tld', d) };
    return map[r.code] || r.code;
  }

  function check() {
    const res = analyzeUrl(input.value);
    const vs = verdictStyle[res.verdict] || verdictStyle.ok;
    const head = h('div', { class: 'entry', style: 'flex-direction:column;align-items:center;gap:6px;padding:18px;border-color:' + vs[1] },
      h('div', { style: 'font-size:2.4em' }, vs[0]),
      h('div', { style: 'font-weight:800;font-size:1.1em;text-align:center;color:' + vs[1], text: vs[2] }),
      res.host ? h('div', { class: 'muted', style: 'font-size:.85em;word-break:break-all;text-align:center', text: t('url_domain') + ': ' + res.domain + (res.unicodeHost !== res.host ? ' (' + res.unicodeHost + ')' : '') }) : null);
    const reasons = res.reasons.map((r) => {
      const row = h('div', { class: 'entry', style: r.entry ? 'cursor:pointer' : '' },
        h('div', { style: 'font-size:1.2em' }, r.level >= 3 ? '🔴' : r.level === 2 ? '🟠' : '🟡'),
        h('div', { class: 'info' }, h('div', { class: 'issuer', style: 'white-space:normal', text: reasonText(r) }),
          r.entry ? h('div', { class: 'acct', text: r.entry.title || '' }) : null),
        r.entry ? h('div', { class: 'muted' }, '›') : null);
      if (r.entry) row.addEventListener('click', () => nav.go('password-edit', r.entry));
      return row;
    });
    const matches = res.matches.length ? [h('h1', { style: 'font-size:1em;margin:14px 0 8px', text: '🔑 ' + t('url_known_entries') }),
      ...res.matches.map((p) => {
        const row = h('div', { class: 'entry', style: 'cursor:pointer' },
          h('div', { class: 'badge' }, ((p.title || '?').trim().charAt(0) || '?').toUpperCase()),
          h('div', { class: 'info' }, h('div', { class: 'issuer', text: p.title || '—' }), h('div', { class: 'acct', text: p.login || '' })),
          h('div', { class: 'muted' }, '›'));
        row.addEventListener('click', () => nav.go('password-edit', p));
        return row;
      })] : [];
    const noVault = !res.vaultCount ? h('p', { class: 'muted', style: 'font-size:.85em', text: t('url_no_vault') }) : null;
    mount(result, h('div', { style: 'margin-top:14px' }, head, ...reasons, ...matches, noVault));
  }
}
