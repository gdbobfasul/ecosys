// Version: 1.0001
// Стилове, инжектирани от код (без отделен CSS файл; акцентът идва от config).
import { ACCENT, ACCENT2 } from '../config.js';

export function injectStyles() {
  if (document.getElementById('mob-styles')) return;
  const css = `
  :root { --accent:${ACCENT}; --accent2:${ACCENT2}; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
         background:#0c0f14; color:#e8ecf2; }
  #app { max-width:560px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; }
  .topbar { display:flex; align-items:center; gap:10px; padding:14px 16px;
            position:sticky; top:0; background:#10141b; border-bottom:1px solid #1e2530; z-index:5; }
  .topbar .logo { width:30px; height:30px; border-radius:8px;
                  background:linear-gradient(135deg,var(--accent),var(--accent2)); }
  .topbar h1 { font-size:17px; margin:0; font-weight:700; flex:1; }
  .content { padding:16px; flex:1; }
  h2 { font-size:19px; margin:4px 0 10px; }
  p.muted, .muted { color:#9aa6b5; font-size:14px; line-height:1.5; }
  .card { background:#141a23; border:1px solid #1e2530; border-radius:14px; padding:14px; margin:10px 0; }
  .row { display:flex; gap:10px; align-items:center; }
  .row.between { justify-content:space-between; }
  label { display:block; font-size:13px; color:#aeb8c6; margin:10px 0 4px; }
  input, select, textarea {
    width:100%; padding:11px 12px; border-radius:10px; border:1px solid #2a3340;
    background:#0e131a; color:#e8ecf2; font-size:15px; }
  textarea { min-height:60px; resize:vertical; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px;
         padding:12px 16px; border-radius:12px; border:0; font-size:15px; font-weight:600;
         cursor:pointer; background:#1e2733; color:#e8ecf2; width:100%; }
  .btn.primary { background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#04121f; }
  .btn.danger { background:#3a1d22; color:#ff9a9a; }
  .btn.small { width:auto; padding:8px 12px; font-size:13px; }
  .btn:active { transform:translateY(1px); }
  .pill { font-size:12px; padding:3px 9px; border-radius:999px; background:#1e2733; color:#9aa6b5; }
  .pill.on { background:rgba(48,209,88,.15); color:#5be584; }
  .pill.off { background:#2a2230; color:#caa0b0; }
  .pill.err { background:#3a1d22; color:#ff9a9a; }
  .pill.match { background:rgba(10,132,255,.18); color:var(--accent2); }
  .switch { position:relative; width:52px; height:30px; flex:0 0 auto; }
  .switch input { display:none; }
  .switch .track { position:absolute; inset:0; background:#2a3340; border-radius:999px; transition:.2s; }
  .switch input:checked + .track { background:var(--accent); }
  .switch .knob { position:absolute; top:3px; left:3px; width:24px; height:24px;
                  background:#fff; border-radius:50%; transition:.2s; }
  .switch input:checked + .track .knob { transform:translateX(22px); }
  .nav { display:flex; border-top:1px solid #1e2530; background:#10141b; position:sticky; bottom:0; }
  .nav button { flex:1; background:none; border:0; color:#8a95a5; padding:10px 4px; font-size:12px; cursor:pointer; }
  .nav button.active { color:var(--accent2); }
  .nav .ic { display:block; font-size:18px; margin-bottom:2px; }
  .list-item { padding:12px 0; border-bottom:1px solid #1e2530; }
  .list-item:last-child { border-bottom:0; }
  .small { font-size:12px; color:#8a95a5; }
  .log-entry { font-size:13px; padding:7px 0; border-bottom:1px solid #161c25; }
  .log-entry.match { color:#5be584; }
  .log-entry.error { color:#ff9a9a; }
  .badge { font-size:11px; color:#7e8a99; }
  .warn { background:#2a2010; border:1px solid #4a3a14; color:#f0d39a; border-radius:10px; padding:10px 12px; font-size:13px; }
  .ok { color:#5be584; }
  .center { text-align:center; }
  .gap { height:8px; }
  .lang-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; max-width:420px; margin:0 auto; }
  .lang-btn { padding:14px; border-radius:10px; background:#141a23; border:1px solid #1e2530;
              color:#e8ecf2; cursor:pointer; font-weight:600; font-size:15px; }
  .lang-btn.cur { background:var(--accent); color:#04121f; border-color:var(--accent); }
  .topbar .lang { background:none; border:0; color:#9aa6b5; font-size:14px; cursor:pointer; padding:6px 8px; }
  `;
  const el = document.createElement('style');
  el.id = 'mob-styles';
  el.textContent = css;
  document.head.appendChild(el);
}

// Дребни помощници за елементи.
export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

export function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('bg-BG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}
