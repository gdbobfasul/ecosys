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
`;
  const el = document.createElement('style');
  el.id = 'cw-styles';
  el.textContent = css;
  document.head.appendChild(el);
}
