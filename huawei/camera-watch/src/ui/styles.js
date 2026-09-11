// Version: 1.0021
// styles.js — инжектира CSS веднъж. Тъмна тема; акцентът е per-store (AppGallery = маджента).
// Без външни CSS файлове/шрифтове (offline-friendly).

const ACCENT = '#c83a7a'; // AppGallery акцент (маджента)

export function injectStyles() {
  if (document.getElementById('cw-styles')) return;
  const css = `
:root { --accent: ${ACCENT}; --accent2: #ff77b0; }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; }
body {
  background: #0b1020; color: #e8ecf5;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.45;
}
#app { max-width: 720px; margin: 0 auto; padding: 16px 16px 48px; }
h1 { font-size: 1.5rem; margin: 8px 0 4px; }
h2 { font-size: 1.15rem; margin: 18px 0 8px; }
p { color: #c4cce0; }
.muted { color: #9aa6c4; font-size: .9rem; }
.card {
  background: #131a30; border: 1px solid #1f2944; border-radius: 14px;
  padding: 16px; margin: 12px 0;
}
.btn {
  display: inline-block; border: 0; border-radius: 12px; cursor: pointer;
  padding: 12px 18px; font-size: 1rem; font-weight: 600;
  background: var(--accent); color: #04130f;
}
.btn:active { transform: translateY(1px); }
.btn.secondary { background: #233055; color: #e8ecf5; }
.btn.ghost { background: transparent; color: var(--accent); border: 1px solid #2a385e; }
.btn.danger { background: #4a1f2b; color: #ffd9df; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.row.between { justify-content: space-between; }
.grow { flex: 1; }
label { display: block; font-weight: 600; margin: 12px 0 4px; }
input[type="text"], input[type="url"], select {
  width: 100%; padding: 11px 12px; border-radius: 10px;
  background: #0e1426; border: 1px solid #2a385e; color: #e8ecf5; font-size: 1rem;
}
input[type="range"] { width: 100%; accent-color: var(--accent); }
.toggle { display: flex; align-items: center; gap: 10px; justify-content: space-between; padding: 8px 0; }
.toggle input { width: 22px; height: 22px; accent-color: var(--accent); }
.pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: .8rem; font-weight: 700; }
.pill.on { background: #133b32; color: var(--accent2); }
.pill.off { background: #3a2433; color: #ff9bb0; }
.stage {
  position: relative; width: 100%; background: #05080f; border-radius: 12px;
  overflow: hidden; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center;
}
.stage video, .stage img { width: 100%; height: 100%; object-fit: contain; display: block; }
.statusbar {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 12px;
  background: linear-gradient(transparent, rgba(0,0,0,.75)); font-weight: 600;
}
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
.dot.idle { background: #4a5578; }
.dot.motion { background: #ffcf5c; }
.dot.hit { background: #ff5c7a; }
.log-item { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid #1c2542; }
.log-item img { width: 56px; height: 42px; object-fit: cover; border-radius: 8px; background: #05080f; }
.log-item .meta { flex: 1; min-width: 0; }
.log-item .label { font-weight: 700; }
.log-item .time { font-size: .8rem; color: #9aa6c4; }
.steps { display: flex; gap: 6px; margin: 8px 0 16px; }
.steps .s { flex: 1; height: 6px; border-radius: 999px; background: #233055; }
.steps .s.active { background: var(--accent); }
.notice { font-size: .85rem; color: #c4cce0; background: #16203a; border-left: 3px solid var(--accent); padding: 10px 12px; border-radius: 8px; margin: 10px 0; }
.warn { border-left-color: #ffcf5c; }
.center { text-align: center; }
.spacer { height: 8px; }
.lang-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; max-width: 420px; margin: 12px auto 0; }
.lang-btn { padding: 14px; border-radius: 10px; background: #131a30; border: 1px solid #1f2944; color: #e8ecf5; cursor: pointer; font-weight: 600; font-size: 1em; }
.lang-btn.cur { background: var(--accent); color: #04130f; border-color: var(--accent); }
.lang-fab { position: fixed; top: 10px; inset-inline-end: 10px; z-index: 20; background: #131a30; border: 1px solid #2a385e; color: var(--accent); border-radius: 999px; padding: 6px 12px; font-size: .85rem; font-weight: 700; cursor: pointer; }

/* --- Табове на таблото --- */
.tabs { display: flex; gap: 6px; overflow-x: auto; padding: 4px 0; margin: 10px 0 4px; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab { flex: 0 0 auto; border: 1px solid #2a385e; background: #131a30; color: #c4cce0; border-radius: 999px; padding: 8px 14px; font-weight: 600; font-size: .9rem; cursor: pointer; white-space: nowrap; }
.tab.cur { background: var(--accent); color: #04130f; border-color: var(--accent); }
.panel { display: none; }
.panel.cur { display: block; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 10px; }
.chip { border: 1px solid #2a385e; background: #0e1426; color: #c4cce0; border-radius: 999px; padding: 5px 11px; font-size: .82rem; font-weight: 600; cursor: pointer; }
.chip.cur { background: #233055; color: #fff; border-color: #3b4c7a; }
.small-select { width: auto; padding: 7px 10px; border-radius: 10px; background: #0e1426; border: 1px solid #2a385e; color: #e8ecf5; font-size: .95rem; }

/* --- Зони върху кадъра --- */
.zone-canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
.zone-canvas.editing { pointer-events: auto; cursor: crosshair; }

/* --- Хронология --- */
.log-item.tap { cursor: pointer; }
.strength { height: 5px; border-radius: 999px; background: #233055; margin-top: 4px; overflow: hidden; }
.strength i { display: block; height: 100%; background: var(--accent2); }
.modal-bg { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.78); display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal { background: #131a30; border: 1px solid #2a385e; border-radius: 14px; padding: 14px; max-width: 560px; width: 100%; max-height: 92vh; overflow: auto; }
.modal img { width: 100%; border-radius: 10px; background: #05080f; }
.modal textarea { width: 100%; min-height: 160px; background: #0e1426; color: #e8ecf5; border: 1px solid #2a385e; border-radius: 10px; padding: 8px; font-size: .8rem; }

/* --- График по часове --- */
.hours { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin: 8px 0; }
.hour { border: 1px solid #2a385e; border-radius: 10px; padding: 9px 0; text-align: center; font-weight: 700; cursor: pointer; background: #0e1426; color: #c4cce0; font-size: .9rem; }
.hour.m1 { background: #2a2f4a; color: #9aa6c4; border-color: #3b4c7a; }
.hour.m2 { background: #4a1f2b; color: #ffd9df; border-color: #7a2f45; }
.hour.now { outline: 2px solid var(--accent2); }
.legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: .82rem; color: #9aa6c4; margin: 6px 0; }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-inline-end: 5px; vertical-align: -1px; }

/* --- Таймлапс --- */
.player { width: 100%; aspect-ratio: 4 / 3; background: #05080f; border-radius: 12px; display: block; }
.strip { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0; }
.strip img { width: 84px; height: 63px; object-fit: cover; border-radius: 6px; flex: 0 0 auto; border: 2px solid transparent; cursor: pointer; }
.strip img.cur { border-color: var(--accent2); }

/* --- Статистика --- */
.chart { width: 100%; height: 190px; display: block; background: #0e1426; border-radius: 10px; }

/* --- Аларма: светлинен сигнал + известие --- */
.flash-overlay { position: fixed; inset: 0; z-index: 90; background: rgba(255,60,90,.55); pointer-events: none; opacity: 0; transition: opacity .12s; }
.toast { position: fixed; left: 50%; bottom: 76px; transform: translateX(-50%); z-index: 95; background: #111826; color: #e6edf3; padding: 10px 16px; border-radius: 20px; font-weight: 600; font-size: .85rem; box-shadow: 0 6px 20px rgba(0,0,0,.35); max-width: 86%; text-align: center; opacity: 0; pointer-events: none; transition: opacity .2s; }
.toast.show { opacity: 1; }

/* --- Раздели „Хок" / „Камера" (най-отгоре) --- */
.sections { display: flex; gap: 6px; margin: 4px 0 10px; background: #0e1426; border: 1px solid #1f2944; border-radius: 12px; padding: 4px; }
.sec { flex: 1; border: 0; border-radius: 9px; padding: 9px 10px; background: transparent; color: #9aa6c4; font-weight: 700; font-size: .95rem; cursor: pointer; }
.sec.cur { background: var(--accent); color: #04130f; }

/* --- MotionSecurityHawk --- */
.lead { color: #e8ecf5; font-size: 1.02rem; margin: 2px 0 8px; }
.role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.role-card { text-align: start; border: 2px solid #2a385e; background: #131a30; color: #e8ecf5; border-radius: 14px; padding: 14px; cursor: pointer; font: inherit; }
.role-card.cur { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(200,58,122,.25); }
.role-ico { font-size: 2rem; line-height: 1; margin-bottom: 6px; }
.role-name { font-weight: 800; font-size: 1.05rem; margin-bottom: 4px; }
.how { padding-inline-start: 20px; color: #c4cce0; margin: 6px 0; }
.how li { margin: 4px 0; }
.code-input { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 1.3rem; letter-spacing: .15em; text-transform: uppercase; text-align: center; }
.code-big { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 2rem; letter-spacing: .2em; text-align: center; font-weight: 800; background: #0e1426; border: 1px dashed #3b4c7a; border-radius: 12px; padding: 12px; margin: 8px 0; color: var(--accent2); user-select: all; }
.consent { border-color: #7a2f45; }
.consent .toggle span { font-weight: 600; }
textarea { width: 100%; padding: 11px 12px; border-radius: 10px; background: #0e1426; border: 1px solid #2a385e; color: #e8ecf5; font-size: 1rem; font-family: inherit; resize: vertical; }
details summary { cursor: pointer; margin-top: 10px; }
.btn.help { display: block; width: 100%; padding: 22px 18px; font-size: 1.5rem; font-weight: 900; background: #d8323c; color: #fff; border-radius: 16px; box-shadow: 0 6px 24px rgba(216,50,60,.35); letter-spacing: .04em; }
.btn.help:active { transform: translateY(2px); }
.btn.small { padding: 7px 12px; font-size: .85rem; }
a.btn { text-decoration: none; }
.pill.live { animation: hk-pulse 1.6s ease-in-out infinite; }
@keyframes hk-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,119,176,.5); } 50% { box-shadow: 0 0 0 5px rgba(255,119,176,0); } }
.trail-map { width: 100%; height: 220px; display: block; border-radius: 12px; background: #0e1426; border: 1px solid #1f2944; }
.trail-map.big { height: 300px; }
.status-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; align-items: center; margin: 6px 0; }
.status-grid .pill { justify-self: start; }
.meter { height: 8px; border-radius: 999px; background: #233055; overflow: hidden; margin: 8px 0; }
.meter i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #3ddc84, #ffcf5c, #ff5c7a); transition: width .1s; }
.task { border-color: #3b4c7a; }
.task-name { font-weight: 800; font-size: 1.1rem; margin-top: 6px; }
.task-instr { color: #e8ecf5; margin: 4px 0 6px; white-space: pre-wrap; }
.task-nav { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.05rem; }
.task-nav .arrow { font-size: 2rem; line-height: 1; color: var(--accent2); }
.msg, .seg { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid #1c2542; flex-wrap: wrap; }
.msg .time, .alert .time { font-size: .8rem; color: #9aa6c4; }
.seg audio { max-width: 100%; height: 34px; }
.alert { padding: 10px; border-radius: 10px; border: 1px solid #1f2944; background: #0e1426; margin: 8px 0; }
.alert.crit { border-color: #7a2f45; background: #2a1520; }
.alert .label { font-weight: 800; }
.alert .words { color: #ffcf5c; font-weight: 700; margin-top: 4px; }
`;
  const el = document.createElement('style');
  el.id = 'cw-styles';
  el.textContent = css;
  document.head.appendChild(el);
}
