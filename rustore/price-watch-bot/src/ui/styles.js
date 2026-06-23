// Инжектира глобалните стилове. Акцентът идва от config.js (различен по магазин).
import { ACCENT, ACCENT2 } from '../config.js';

export function injectStyles() {
  const css = `
  :root{
    --accent:${ACCENT};
    --accent2:${ACCENT2};
    --bg:#0d1117;
    --card:#161b22;
    --line:#272e3a;
    --text:#e6edf3;
    --muted:#8b949e;
    --ok:#2ea043;
    --warn:#d29922;
    --hit:#f85149;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
    font-family:system-ui,'Segoe UI',Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
  #app{max-width:560px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
  .pad{padding:20px}
  .top{padding:18px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:5}
  .logo{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent2));flex:0 0 auto}
  h1{font-size:20px;margin:0}
  h2{font-size:17px;margin:0 0 10px}
  p{line-height:1.5;color:var(--muted)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
  .btn{display:block;width:100%;padding:14px;border:0;border-radius:12px;font-size:16px;font-weight:600;
    background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;cursor:pointer}
  .btn.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}
  .btn.sm{padding:9px 12px;font-size:13px;width:auto;display:inline-block}
  .btn:disabled{opacity:.5}
  .row{display:flex;gap:10px;align-items:center}
  .row.between{justify-content:space-between}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}
  select,input{width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:#0b0f15;color:var(--text);font-size:15px}
  .chip{padding:8px 10px;border:1px solid var(--line);border-radius:10px;cursor:pointer;text-align:center;font-size:14px;background:#0b0f15}
  .chip.on{border-color:var(--accent);color:var(--accent2);box-shadow:0 0 0 1px var(--accent)}
  .muted{color:var(--muted);font-size:13px}
  .badge{font-size:12px;padding:3px 8px;border-radius:20px;border:1px solid var(--line)}
  .badge.watching{color:var(--accent2)}
  .badge.hit{color:var(--hit);border-color:var(--hit)}
  .badge.paused{color:var(--muted)}
  .badge.err{color:var(--warn);border-color:var(--warn)}
  .switch{position:relative;width:54px;height:30px;flex:0 0 auto}
  .switch input{display:none}
  .slider{position:absolute;inset:0;background:#30363d;border-radius:30px;transition:.2s}
  .slider:before{content:'';position:absolute;width:24px;height:24px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
  .switch input:checked + .slider{background:linear-gradient(135deg,var(--accent),var(--accent2))}
  .switch input:checked + .slider:before{transform:translateX(24px)}
  .log{font-size:12.5px;color:var(--muted);border-bottom:1px dashed var(--line);padding:7px 0}
  .nav{margin-top:auto;display:flex;border-top:1px solid var(--line);background:var(--bg)}
  .nav button{flex:1;background:none;border:0;color:var(--muted);padding:12px;font-size:12px;cursor:pointer}
  .nav button.on{color:var(--accent2)}
  .center{text-align:center}
  .big{font-size:46px;line-height:1;margin:8px 0}
  .price{font-variant-numeric:tabular-nums;font-weight:600}
  .err-line{color:var(--warn);font-size:12px}
  .top .lang-toggle{margin-left:auto;background:transparent;border:1px solid var(--line);color:var(--text);
    border-radius:10px;padding:6px 10px;font-size:14px;cursor:pointer;flex:0 0 auto}
  .lang-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  .lang-btn{padding:14px 12px;border:1px solid var(--line);border-radius:12px;background:#0b0f15;
    color:var(--text);font-size:15px;cursor:pointer;text-align:center}
  .lang-btn.cur{border-color:var(--accent);color:var(--accent2);box-shadow:0 0 0 1px var(--accent)}
  [dir="rtl"] .row.between{flex-direction:row-reverse}
  [dir="rtl"] .top .lang-toggle{margin-left:0;margin-right:auto}
  `;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
}
