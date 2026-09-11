// Version: 1.0023
// Стиловете се инжектират от JS, за да можем да вмъкнем акцентния цвят
// от config.js (единственото издателско различие).
import { APP_CONFIG } from '../config.js';

export function injectStyles() {
  const css = `
:root {
  --accent: ${APP_CONFIG.accent};
  --accent-dark: ${APP_CONFIG.accentDark};
  --accent-soft: ${APP_CONFIG.accentSoft};
  --bg: #0f172a;
  --card: #1e293b;
  --card2: #273449;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --line: #334155;
  --danger: #ef4444;
  --ok: #22c55e;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
#app { max-width: 560px; margin: 0 auto; padding: 16px 16px 96px; min-height: 100vh; }
h1 { font-size: 22px; margin: 8px 0 4px; }
h2 { font-size: 17px; margin: 18px 0 8px; }
p { line-height: 1.5; color: var(--text); }
.muted { color: var(--muted); font-size: 14px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px;
  padding: 16px; margin: 12px 0; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--accent); color: #fff; border: none; border-radius: 12px;
  padding: 13px 18px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; }
.btn:active { background: var(--accent-dark); }
.btn.secondary { background: var(--card2); color: var(--text); border: 1px solid var(--line); }
.btn.danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
.btn.small { width: auto; padding: 8px 12px; font-size: 14px; }
.field { margin: 12px 0; }
.field label { display: block; font-size: 14px; color: var(--muted); margin-bottom: 6px; }
input, select, textarea { width: 100%; background: var(--card2); color: var(--text);
  border: 1px solid var(--line); border-radius: 10px; padding: 12px; font-size: 16px; }
textarea { min-height: 64px; resize: vertical; }
.toggle { position: relative; width: 52px; height: 30px; flex: 0 0 auto; }
.toggle input { display: none; }
.toggle span { position: absolute; inset: 0; background: var(--card2); border: 1px solid var(--line);
  border-radius: 999px; transition: .2s; }
.toggle span::after { content: ''; position: absolute; width: 24px; height: 24px; left: 2px; top: 2px;
  background: #fff; border-radius: 50%; transition: .2s; }
.toggle input:checked + span { background: var(--accent); border-color: var(--accent); }
.toggle input:checked + span::after { transform: translateX(22px); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--card2); font-size: 14px; cursor: pointer; user-select: none; }
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px;
  background: var(--accent-soft); color: var(--accent); }
.pill.off { background: rgba(148,163,184,.15); color: var(--muted); }
.list-item { background: var(--card2); border: 1px solid var(--line); border-radius: 12px;
  padding: 12px; margin: 8px 0; }
.timeline-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  background: var(--accent); margin-right: 8px; }
.nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: var(--card);
  border-top: 1px solid var(--line); max-width: 560px; margin: 0 auto; }
.nav button { flex: 1; background: none; border: none; color: var(--muted); padding: 10px 4px;
  font-size: 11px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.nav button.active { color: var(--accent); }
.nav button .ico { font-size: 20px; }
.big-toggle { text-align: center; padding: 24px; }
.big-toggle .state { font-size: 28px; font-weight: 700; }
.steps { display: flex; gap: 6px; margin: 12px 0; }
.steps .s { flex: 1; height: 4px; border-radius: 2px; background: var(--line); }
.steps .s.on { background: var(--accent); }
.robot { font-size: 64px; text-align: center; margin: 12px 0; }
.center { text-align: center; }
.spacer { height: 8px; }
.toast { position: fixed; left: 50%; bottom: 80px; transform: translate(-50%, 20px);
  background: var(--card); border: 1px solid var(--accent); color: var(--text);
  padding: 12px 16px; border-radius: 12px; max-width: 90%; opacity: 0; transition: .35s;
  z-index: 999; box-shadow: 0 8px 30px rgba(0,0,0,.4); white-space: pre-line; }
.toast.show { opacity: 1; transform: translate(-50%, 0); }
.error { color: var(--danger); font-size: 14px; }
.ok { color: var(--ok); }
a { color: var(--accent); }
.lang-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
.lang-btn { background: var(--card); color: var(--text); border: 1px solid var(--line);
  border-radius: 12px; padding: 14px 10px; font-size: 16px; cursor: pointer; }
.lang-btn:active { background: var(--card2); }
.lang-btn.cur { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.lang-fab { position: fixed; top: 10px; right: 10px; z-index: 50; background: var(--card);
  color: var(--text); border: 1px solid var(--line); border-radius: 999px;
  padding: 6px 12px; font-size: 14px; cursor: pointer; }
[dir="rtl"] .lang-fab { right: auto; left: 10px; }
[dir="rtl"] .nav button { direction: rtl; }
/* --- „Денят на семейството" (1.0023) --- */
.fam-sub { margin-top: 0; }
.fam-tabs { display: flex; gap: 6px; overflow-x: auto; padding: 4px 0 8px; margin: 8px 0 4px; scrollbar-width: none; }
.fam-tabs::-webkit-scrollbar { display: none; }
.fam-tabs button { flex: 0 0 auto; background: var(--card2); color: var(--text); border: 1px solid var(--line);
  border-radius: 999px; padding: 8px 12px; font-size: 14px; cursor: pointer; white-space: nowrap; }
.fam-tabs button.on { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.fam h1 { padding-inline-end: 108px; }
.fam-banner { border-color: #f59e0b; background: rgba(245,158,11,.08); padding: 10px 12px; margin: 8px 0; }
.fam-banner p { margin: 0 0 6px; font-size: 12.5px; line-height: 1.35; }
.fam-setup { margin: 4px 0 8px; width: 100%; }
.fam-member-h { display: flex; align-items: center; gap: 10px; }
.fam-member-h .nm { font-weight: 700; font-size: 16px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  font-size: 22px; flex: 0 0 auto; }
.bar { height: 8px; border-radius: 4px; background: var(--card2); overflow: hidden; margin-top: 6px; }
.bar > i { display: block; height: 100%; background: var(--accent); border-radius: 4px; }
.fam-task { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; padding: 8px 0; border-top: 1px solid var(--line); }
.fam-task-t { flex: 1 1 150px; min-width: 0; overflow-wrap: break-word; }
.fam-task-t b { font-weight: 600; }
.fam-pts { display: inline-block; margin-inline-start: 6px; font-size: 12px; color: #fbbf24; font-weight: 600; }
.fam-task-a { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; margin-inline-start: auto; }
.fam-task-a .ok { font-size: 13px; }
.fam-task-a .pill, .fam-task .pill { font-size: 12px; white-space: nowrap; }
.btn.tiny { width: auto; padding: 6px 10px; font-size: 13px; border-radius: 10px; }
.btn[disabled] { opacity: .45; }
.fam-rank { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.fam-rank .medal { width: 28px; text-align: center; font-size: 20px; }
.fam-rank .grow { flex: 1; min-width: 0; }
.fam-day-h { font-weight: 700; margin: 14px 0 4px; color: var(--accent); }
.fam-x { background: none; border: none; color: var(--muted); font-size: 16px; cursor: pointer; padding: 4px 6px; }
.fam-reward { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
.fam-reward .em { font-size: 24px; }
.fam-row2 { display: flex; gap: 8px; }
.fam-row2 > * { flex: 1; min-width: 0; }
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
