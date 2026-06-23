// language-picker.js — екран за избор на език (HTML overlay), подходящ за HMM.
// Играта рендерира през DOM/canvas, затова пикърът е обикновен HTML слой върху
// целия екран — решетка с родните имена на 15-те езика. Ползва се:
//   1) при ПЪРВО стартиране (преди менюто), ако hasLangChosen() е false;
//   2) от менюто през бутона 🌐 (смяна на език по всяко време).
//
// showLanguagePicker() връща Promise, който се разрешава СЛЕД като играчът
// избере език (изборът вече е записан в localStorage през setLang).
import { LANGUAGES } from './languages.js';
import { t, setLang, getLang, isRTL } from './i18n.js';

let cssInjected = false;

function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const css = document.createElement('style');
  css.id = 'hmm-langpicker-css';
  css.textContent = [
    '.hmm-lang-ov{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;',
    '  background:radial-gradient(ellipse at center,#241a1a 0%,#06060a 85%);',
    '  font-family:"Cormorant Garamond",Georgia,"Times New Roman",serif;color:#e8d6a5;',
    '  padding:env(safe-area-inset-top,16px) 12px env(safe-area-inset-bottom,16px);box-sizing:border-box;overflow:hidden;}',
    '.hmm-lang-globe{font-size:44px;margin:14px 0 4px;line-height:1;}',
    '.hmm-lang-title{font-family:"Cinzel",serif;font-size:30px;font-weight:700;color:#f8c450;',
    '  letter-spacing:1px;text-align:center;text-shadow:2px 2px 0 #000;margin:0 0 16px;}',
    '.hmm-lang-grid{flex:1 1 auto;width:100%;max-width:760px;overflow-y:auto;-webkit-overflow-scrolling:touch;',
    '  display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:4px 4px 12px;align-content:start;}',
    '.hmm-lang-btn{display:flex;align-items:center;justify-content:center;min-height:62px;',
    '  background:linear-gradient(180deg,#3a2a1a,#1a1208);color:#f0d896;border:2.5px solid #6a4a2a;',
    '  border-radius:14px;font-family:"Cinzel",serif;font-size:21px;font-weight:700;letter-spacing:.5px;',
    '  cursor:pointer;box-shadow:0 4px 0 #000,inset 0 1px 0 rgba(255,200,120,.18);',
    '  transition:transform .08s,background .15s;text-align:center;padding:8px 6px;}',
    '.hmm-lang-btn:hover{background:linear-gradient(180deg,#5a3a22,#2a1810);border-color:#b88a4a;color:#fff0c8;}',
    '.hmm-lang-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #000;}',
    '.hmm-lang-btn.cur{background:linear-gradient(180deg,#7a5a2a,#3a2810);border-color:#f8c450;color:#fff;',
    '  box-shadow:0 4px 0 #000,0 0 18px rgba(248,196,80,.45);}',
    '@media (min-width:560px){.hmm-lang-grid{grid-template-columns:repeat(3,1fr);}}'
  ].join('');
  document.head.appendChild(css);
}

// Показва пикъра. Резолвва Promise след избор. Ако title е true (по подразбиране)
// показва „Избери език" на текущия език.
export function showLanguagePicker() {
  injectCSS();
  return new Promise((resolve) => {
    const cur = getLang();
    const ov = document.createElement('div');
    ov.className = 'hmm-lang-ov';
    ov.dir = isRTL() ? 'rtl' : 'ltr';

    const globe = document.createElement('div');
    globe.className = 'hmm-lang-globe';
    globe.textContent = '🌐';
    ov.appendChild(globe);

    const title = document.createElement('div');
    title.className = 'hmm-lang-title';
    title.textContent = t('pick_lang');
    ov.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'hmm-lang-grid';
    ov.appendChild(grid);

    LANGUAGES.forEach((lang) => {
      const b = document.createElement('button');
      b.className = 'hmm-lang-btn' + (lang.code === cur ? ' cur' : '');
      b.type = 'button';
      b.textContent = lang.native;
      b.onclick = () => {
        setLang(lang.code);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        resolve(lang.code);
      };
      grid.appendChild(b);
    });

    document.body.appendChild(ov);
  });
}
