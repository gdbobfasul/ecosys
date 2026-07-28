// lang-gate.js — ЗАДЪЛЖИТЕЛЕН избор на език при СТАРТ (ВИНАГИ се показва).
// Пълноекранен избор с 15-те езика: маркиран е език по подразбиране (текущият/засеченият),
// потребителят натиска „Продължи" (приема маркирания) ИЛИ избира друг език. Едва тогава апът
// продължава (лого-интро → правен екран → приложението). Показва се на ВСЯКО пускане — НЕ се
// прескача, дори език вече да е избиран.
//
// Как работи: гейтът се качва НАЙ-ОТГОРЕ (над лого-интрото), а докато е активен спира интрото и
// рекламите (window.__PUPIKES_INTRO_OFF__). При „Продължи": записва езика през подадения setLang и
// ПРЕЗАРЕЖДА (location.reload) — така целият апп тръгва на верния език. Времеви печат в localStorage
// (оцелява презареждане, за разлика от sessionStorage в някои WebView-та) пази да НЕ се покаже пак
// веднага след reload → БЕЗ риск от цикъл. Печатът е валиден само ~4с → на следващо студено
// пускане е „изтекъл" и гейтът пак излиза (изискване: показва се на ВСЯКО пускане).
const RELOAD_FLAG = 'pupikes.langgate.reloaded_at';
const RELOAD_WINDOW_MS = 4000;
// Резерв, ако апът не подаде списък (същите 15 езика като навсякъде в екосистемата).
const FALLBACK = [
  { code: 'bg', native: 'Български' }, { code: 'ru', native: 'Русский' }, { code: 'uk', native: 'Українська' },
  { code: 'en', native: 'English' }, { code: 'de', native: 'Deutsch' }, { code: 'fr', native: 'Français' },
  { code: 'es', native: 'Español' }, { code: 'es-MX', native: 'Español (MX)' }, { code: 'it', native: 'Italiano' },
  { code: 'pt', native: 'Português' }, { code: 'ar', native: 'العربية' }, { code: 'hi', native: 'हिन्दी' },
  { code: 'ja', native: '日本語' }, { code: 'ky', native: 'Кыргызча' }, { code: 'zh-Hant', native: '繁體中文' }
];
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// opts = { languages:[{code,native}], current:'bg', setLang:fn }
export function mountLangGate(opts) {
  opts = opts || {};
  // Току-що презаредихме след избор (печат < 4с) → пропусни (остави апът да тръгне), изчисти печата.
  try {
    const at = parseInt(localStorage.getItem(RELOAD_FLAG) || '0', 10);
    if (at && (Date.now() - at) < RELOAD_WINDOW_MS) { localStorage.removeItem(RELOAD_FLAG); return; }
    if (at) localStorage.removeItem(RELOAD_FLAG);   // изтекъл печат → изчисти и покажи гейта
  } catch (e) {}
  // При правене на магазинни снимки гейтът пречи — уважаваме глобалния флаг за изключване.
  try { if (window.__PUPIKES_LANGGATE_OFF__) return; } catch (e) {}
  // Докато гейтът е активен — НЕ пускай лого-интрото/рекламите отдолу.
  try { window.__PUPIKES_INTRO_OFF__ = true; } catch (e) {}

  const langs = (Array.isArray(opts.languages) && opts.languages.length) ? opts.languages : FALLBACK;
  const setLang = typeof opts.setLang === 'function' ? opts.setLang : null;
  let selected = String(opts.current || '') || (langs[0] && langs[0].code) || 'en';
  // ако текущият не е в списъка → вземи първия
  if (!langs.some((l) => l && l.code === selected)) selected = (langs[0] && langs[0].code) || 'en';

  const build = () => {
    if (!document.body || document.getElementById('pupikes-langgate')) return;
    const ov = document.createElement('div');
    ov.id = 'pupikes-langgate';
    ov.setAttribute('dir', 'ltr');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#0b1220;color:#e6edf3;font-family:system-ui,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column';
    const btns = langs.map((l) =>
      '<button class="pupikes-lg-b" data-code="' + esc(l.code) + '" style="padding:14px 8px;border-radius:12px;border:2px solid #24314a;background:#111a2b;color:#e6edf3;font-size:16px;line-height:1.2;cursor:pointer;text-align:center">' + esc(l.native || l.code) + '</button>'
    ).join('');
    ov.innerHTML =
      '<div style="padding:22px 16px 10px;text-align:center;flex-shrink:0">' +
        '<div style="font-weight:800;font-size:22px;background:linear-gradient(90deg,#4a9eff,#8bd450);-webkit-background-clip:text;background-clip:text;color:transparent">Pupikes</div>' +
        '<div style="opacity:.85;font-size:15px;margin-top:8px">🌐 Избери език · Choose your language</div>' +
      '</div>' +
      '<div id="pupikes-lg-grid" style="flex:1;overflow:auto;padding:12px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;align-content:start">' + btns + '</div>' +
      '<div style="padding:12px 16px 22px;flex-shrink:0"><button id="pupikes-lg-go" style="width:100%;padding:16px;border:none;border-radius:12px;background:#2ea043;color:#fff;font-weight:800;font-size:17px;cursor:pointer">Продължи ▶ · Continue</button></div>';
    document.body.appendChild(ov);

    const mark = () => {
      ov.querySelectorAll('.pupikes-lg-b').forEach((b) => {
        const on = b.getAttribute('data-code') === selected;
        b.style.borderColor = on ? '#2ea043' : '#24314a';
        b.style.background = on ? '#12351f' : '#111a2b';
        b.style.fontWeight = on ? '800' : '400';
      });
    };
    mark();
    ov.querySelectorAll('.pupikes-lg-b').forEach((b) => b.addEventListener('click', () => {
      selected = b.getAttribute('data-code'); mark();
    }));

    let done = false;
    const proceed = () => {
      if (done) return; done = true;
      try { if (setLang) setLang(selected); } catch (e) {}
      try { localStorage.setItem(RELOAD_FLAG, String(Date.now())); } catch (e) {}
      // изчисти флага за интро — след reload апът тръгва нормално (интро/реклами разрешени)
      try { window.__PUPIKES_INTRO_OFF__ = false; } catch (e) {}
      try { location.reload(); } catch (e) { try { ov.remove(); } catch (_) {} }
    };
    document.getElementById('pupikes-lg-go').addEventListener('click', proceed);
  };
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
}
