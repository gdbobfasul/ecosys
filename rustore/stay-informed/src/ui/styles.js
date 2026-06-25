// styles.js — стиловете на приложението (тъмна тема). Вкарват се веднъж при старт.
// Различава се между магазините само ако се наложи (тук е общ; цветовете идват от config).
const CSS = `
:root{
  --bg:#0b1220; --card:#141c2e; --card2:#1b2540; --fg:#eef2f8; --muted:#9fb0c8;
  --accent:#0a84ff; --accent2:#2dd4bf; --line:#243049; --bad:#ff5b5b; --ok:#34c759;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}
#app{max-width:720px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
.pad{padding:16px}
.center{text-align:center}
.big{font-size:54px;line-height:1}
h1{font-size:22px;margin:8px 0}
h2{font-size:19px;margin:6px 0 12px}
h3{font-size:16px;margin:0 0 6px}
.muted{color:var(--muted)}
.row{display:flex;align-items:center;gap:10px}
.spacer{flex:1}

/* Заглавна лента */
.top{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);
  position:sticky;top:0;background:var(--bg);z-index:5}
.top h1{font-size:18px;margin:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.logo{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,var(--accent),var(--accent2))}
.icon-btn{background:var(--card);border:1px solid var(--line);color:var(--fg);border-radius:10px;
  padding:8px 10px;font-size:16px;cursor:pointer}

/* Бутони */
button{font-family:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--accent);
  color:#fff;border:none;border-radius:12px;padding:13px 16px;font-size:15px;font-weight:600;cursor:pointer}
.btn.secondary{background:var(--card2);color:var(--fg);border:1px solid var(--line)}
.btn.block{width:100%}
.btn.sm{padding:8px 12px;font-size:13px;border-radius:9px}
.btn:disabled{opacity:.5}

/* Карти */
.content{flex:1;overflow:auto;padding:12px 16px 84px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.art{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 14px;margin-bottom:10px}
.art .title{font-size:15px;font-weight:600;line-height:1.35;margin:0 0 7px}
.art .meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.art .actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}

/* Значки */
.badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.badge.official{color:#bff7d0;border-color:#1f5135;background:#10341f}
.badge.unofficial{color:#cdd9ee;border-color:#2a3658;background:#1a2440}
.badge.aggregator{color:#bfe3ff;border-color:#1d3b59;background:#10283f}
.badge.tr{color:#ffe6a8;border-color:#5a4a1d;background:#352a10}

/* Език (решетка) */
.lang-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.lang-btn{background:var(--card);border:1px solid var(--line);color:var(--fg);border-radius:12px;
  padding:14px;font-size:15px;cursor:pointer}
.lang-btn.cur{border-color:var(--accent);background:var(--card2)}

/* Държави */
.search{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);
  background:var(--card);color:var(--fg);font-size:15px;margin-bottom:12px}
.region-h{font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:14px 2px 8px}
.country{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);
  border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer}
.country.cur{border-color:var(--accent)}
.country .flag{font-size:20px}
.country .nm{flex:1}
.country .tag{font-size:11px;color:var(--muted)}

/* Долна навигация */
.tabbar{position:fixed;bottom:0;left:0;right:0;max-width:720px;margin:0 auto;display:flex;
  background:var(--card);border-top:1px solid var(--line)}
.tab{flex:1;background:none;border:none;color:var(--muted);padding:11px 6px;font-size:12px;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;gap:3px}
.tab .ic{font-size:19px}
.tab.active{color:var(--accent)}

/* Превключвател */
.toggle{display:flex;align-items:center;gap:12px;justify-content:space-between}
.switch{width:46px;height:28px;border-radius:999px;background:var(--card2);border:1px solid var(--line);
  position:relative;flex:none;cursor:pointer;transition:background .15s}
.switch:after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;
  background:#8aa0c0;transition:left .15s,background .15s}
.switch.on{background:var(--accent);border-color:var(--accent)}
.switch.on:after{left:21px;background:#fff}

.note{font-size:12px;color:var(--muted);margin-top:10px;line-height:1.5}
[dir="rtl"] .art .meta,[dir="rtl"] .row{direction:rtl}
`;

export function injectStyles() {
  try {
    if (document.getElementById('si-styles')) return;
    const s = document.createElement('style');
    s.id = 'si-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  } catch (_) {}
}
