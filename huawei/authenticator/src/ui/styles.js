// styles.js — инжектира CSS-а на приложението. Цветовете идват от THEME през
// CSS променливи (зададени на :root в main.js), за да съвпадат с магазина.
export const CSS = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg); color: var(--text);
  overscroll-behavior: none; user-select: none;
}
#app { max-width: 560px; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column; }

.topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; background: var(--bgCard); border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 5;
}
.topbar h1 { font-size: 1.1em; margin: 0; flex: 1; }
.topbar .icon-btn { font-size: 1.3em; }
.icon-btn { background: none; border: none; color: var(--text); cursor: pointer; padding: 6px; border-radius: 8px; }
.icon-btn:active { background: var(--bgInput); }

.content { flex: 1; padding: 16px; }
.center { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex: 1; gap: 14px; padding: 24px; }

label { display: block; font-weight: 600; margin: 14px 0 6px; font-size: .9em; color: var(--textDim); }
input, select {
  width: 100%; padding: 12px; font-size: 1em; color: var(--text);
  background: var(--bgInput); border: 1px solid var(--border); border-radius: 10px; outline: none;
}
input:focus, select:focus { border-color: var(--primary); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 13px 18px; font-size: 1em; font-weight: 700; cursor: pointer;
  background: var(--primary); color: #fff; border: none; border-radius: 10px; margin-top: 14px;
}
.btn:active { filter: brightness(.92); }
.btn.accent { background: var(--accent); }
.btn.ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn.danger { background: var(--danger); }

.err { color: var(--danger); font-size: .9em; margin-top: 8px; min-height: 1.1em; }
.muted { color: var(--textDim); font-size: .9em; line-height: 1.4; }

/* списък с акаунти */
.entry {
  display: flex; align-items: center; gap: 12px;
  background: var(--bgCard); border: 1px solid var(--border); border-radius: 12px;
  padding: 12px 14px; margin-bottom: 10px;
}
.entry .badge {
  width: 42px; height: 42px; border-radius: 10px; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 1.1em; color: #fff; background: var(--primary);
}
.entry .info { flex: 1; min-width: 0; }
.entry .issuer { font-weight: 700; font-size: .95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.entry .acct { color: var(--textDim); font-size: .82em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.entry .code { font-family: ui-monospace, monospace; font-size: 1.7em; letter-spacing: 3px; color: var(--accent); cursor: pointer; }
.entry .right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.ring { width: 26px; height: 26px; }
.hotp-next { background: var(--bgInput); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 6px 10px; cursor: pointer; }

.fab {
  position: fixed; right: calc(50% - 280px + 20px); bottom: 24px;
  width: 58px; height: 58px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--accent); color: #fff; font-size: 2em; line-height: 1;
  box-shadow: 0 6px 18px rgba(0,0,0,.4); z-index: 6;
}
@media (max-width: 600px) { .fab { right: 20px; } }

.row { display: flex; gap: 10px; }
.row > * { flex: 1; }

.lang-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; max-width: 420px; }
.lang-btn { padding: 14px; border-radius: 10px; background: var(--bgCard); border: 1px solid var(--border); color: var(--text); cursor: pointer; font-weight: 600; font-size: 1em; }
.lang-btn.cur { background: var(--accent); color: #fff; border-color: var(--accent); }

.setting { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--border); }
.setting .lbl { font-weight: 600; }
.switch { position: relative; width: 48px; height: 28px; flex: 0 0 auto; }
.switch input { display: none; }
.switch .track { position: absolute; inset: 0; background: var(--bgInput); border: 1px solid var(--border); border-radius: 999px; transition: .2s; }
.switch .knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; background: #fff; border-radius: 50%; transition: .2s; }
.switch input:checked + .track { background: var(--accent); border-color: var(--accent); }
.switch input:checked + .track .knob { transform: translateX(20px); }

#toast {
  position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%) translateY(20px);
  background: #000; color: #fff; padding: 10px 18px; border-radius: 999px; font-size: .9em;
  opacity: 0; pointer-events: none; transition: .25s; z-index: 50;
}
#toast.show { opacity: .95; transform: translateX(-50%) translateY(0); }

/* долна лента с табове */
.tabbar { position: sticky; bottom: 0; display: flex; background: var(--bgCard); border-top: 1px solid var(--border); }
.tab { flex: 1; background: none; border: none; color: var(--textDim); cursor: pointer; padding: 8px 4px 10px; font-size: 1.4em; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.tab .tablabel { font-size: .58em; font-weight: 600; }
.tab.on { color: var(--accent); }

/* поле с иконка за копиране (логин/парола) */
.copyfield { display: flex; gap: 8px; align-items: stretch; }
.copyfield input { flex: 1; }
.copy-btn { flex: 0 0 auto; width: 46px; background: var(--bgInput); border: 1px solid var(--border); color: var(--text); border-radius: 10px; cursor: pointer; font-size: 1.1em; }
.copy-btn:active { background: var(--primary); color: #fff; }

/* картинка на QR в колекцията */
.qrimg { width: 100%; max-width: 320px; display: block; margin: 12px auto; border-radius: 12px; background: #fff; padding: 8px; }
.charcount { font-size: .75em; color: var(--textDim); text-align: right; margin-top: 4px; }
textarea { width: 100%; padding: 12px; font-size: 1em; color: var(--text); background: var(--bgInput); border: 1px solid var(--border); border-radius: 10px; outline: none; resize: vertical; min-height: 70px; font-family: inherit; }
textarea:focus { border-color: var(--primary); }

#scanvideo { width: 100%; border-radius: 12px; background: #000; }
.seg { display: flex; gap: 8px; margin: 8px 0; }
.seg button { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--bgInput); color: var(--text); cursor: pointer; }
.seg button.on { background: var(--primary); color: #fff; border-color: var(--primary); }
`;
