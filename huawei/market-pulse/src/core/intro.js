// Version: 1.0003
// intro.js — брандова РЕКЛАМА при СТАРТ: лапата Pupikes + защо „Pupikes" (кучета: верни и
// обучаеми) + границата (искай само в разумни граници). 15 езика; докосване/~5.2s я затваря.
// Универсален DOM слой — еднакъв файл във всяко приложение.
const WHY = {"bg":"Pupikes — кучета: верни и обучаеми. Приложенията ти служат и се учат от теб.","ru":"Pupikes — собаки: верные и обучаемые. Приложения служат вам и учатся у вас.","uk":"Pupikes — собаки: вірні та навчувані. Застосунки служать тобі й вчаться від тебе.","en":"Pupikes — dogs: loyal and trainable. The apps serve you and learn from you.","de":"Pupikes — Hunde: treu und lernfähig. Die Apps dienen dir und lernen von dir.","fr":"Pupikes — des chiens : fidèles et dressables. Les apps te servent et apprennent de toi.","es":"Pupikes — perros: leales y adiestrables. Las apps te sirven y aprenden de ti.","es-MX":"Pupikes — perros: leales y adiestrables. Las apps te sirven y aprenden de ti.","it":"Pupikes — cani: fedeli e addestrabili. Le app ti servono e imparano da te.","pt":"Pupikes — cães: leais e treináveis. Os apps te servem e aprendem contigo.","ar":"Pupikes — كلاب: مخلصة وقابلة للتدريب. التطبيقات تخدمك وتتعلّم منك.","hi":"Pupikes — कुत्ते: वफ़ादार और सिखाने योग्य। ऐप्स आपकी सेवा करते हैं और आपसे सीखते हैं।","ja":"Pupikes — 犬：忠実で、しつけられる。アプリはあなたに仕え、あなたから学びます。","ky":"Pupikes — иттер: ишенимдүү жана үйрөтүүгө болот. Колдонмолор сага кызмат кылып, сенден үйрөнөт.","zh-Hant":"Pupikes — 狗：忠誠且可訓練。應用程式為你服務，並向你學習。"};
const LIMIT = {"bg":"Кажи какво липсва — подобряват се. Но както от кучето, искай само в разумни граници.","ru":"Скажи, чего не хватает — они улучшатся. Но как от собаки, проси лишь в разумных пределах.","uk":"Скажи, чого бракує — вони покращаться. Але як від собаки, проси лише в розумних межах.","en":"Tell them what's missing — they improve. But like a dog, ask only within reason.","de":"Sag, was fehlt — sie verbessern sich. Aber wie vom Hund: verlange nur im Rahmen.","fr":"Dis ce qui manque — elles s'améliorent. Mais comme un chien, demande raisonnablement.","es":"Di qué falta — mejoran. Pero como a un perro, pide solo dentro de lo razonable.","es-MX":"Di qué falta — mejoran. Pero como a un perro, pide solo dentro de lo razonable.","it":"Dì cosa manca — migliorano. Ma come a un cane, chiedi solo entro il ragionevole.","pt":"Diz o que falta — melhoram. Mas como a um cão, pede só dentro do razoável.","ar":"قل ما ينقص — تتحسّن. لكن كما من الكلب، اطلب ضمن حدود المعقول فقط.","hi":"बताएँ क्या कमी है — वे सुधरते हैं। पर कुत्ते की तरह, बस उचित सीमा में माँगें।","ja":"足りないものを伝えれば改善します。でも犬と同じく、無理のない範囲でお願いを。","ky":"Эмне жетишпейт — айт, жакшырышат. Бирок иттей эле, акылга сыярлык гана сура.","zh-Hant":"說出缺少什麼 — 它們會改進。但就像對狗，只在合理範圍內要求。"};
const LANGS = Object.keys(WHY);
function pickLang() {
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /\.lang$/.test(k)) { const v = localStorage.getItem(k); if (v && LANGS.indexOf(v) >= 0) return v; } } } catch (e) {}
  try { const h = document.documentElement.getAttribute('lang'); if (h && LANGS.indexOf(h) >= 0) return h; } catch (e) {}
  try { const n = (navigator.language || 'en').slice(0, 2); if (LANGS.indexOf(n) >= 0) return n; } catch (e) {}
  return 'en';
}
export function playIntro() {
  const build = () => {
    if (!document.body || document.getElementById('kcy-intro')) return;
    try { if (window.__KCY_INTRO_OFF__) return; } catch (e) {}   // изключено при правене на снимки
    const lg = pickLang();
    const ov = document.createElement('div');
    ov.id = 'kcy-intro';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:26px;background:radial-gradient(circle at 50% 40%,#2a1c10,#0a0704);transition:opacity .45s ease;cursor:pointer';
    ov.innerHTML =
      '<div style="max-width:420px;text-align:center;font-family:system-ui,Segoe UI,Roboto,sans-serif;transform:scale(.9);opacity:0;animation:kcyIntroIn .8s cubic-bezier(.2,.7,.3,1) forwards">' +
        '<div style="width:120px;height:120px;margin:0 auto 12px;filter:drop-shadow(0 6px 16px rgba(0,0,0,.45))"><svg width="100%" height="100%" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="padMain" cx="0.42" cy="0.35" r="0.85"><stop offset="0" stop-color="#B07A4E"/><stop offset="0.55" stop-color="#8A5A32"/><stop offset="1" stop-color="#5E3B20"/></radialGradient><radialGradient id="toe" cx="0.40" cy="0.32" r="0.9"><stop offset="0" stop-color="#C08A5A"/><stop offset="0.6" stop-color="#93613A"/><stop offset="1" stop-color="#603A1F"/></radialGradient><linearGradient id="claw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2414"/><stop offset="1" stop-color="#20140A"/></linearGradient></defs><g transform="translate(12 -12)"><g transform="translate(300 520) rotate(-64)"><path d="M0 -70 C 34 -70, 52 -34, 52 8 C 52 44, 30 66, 0 66 C -30 66, -52 44, -52 8 C -52 -34, -34 -70, 0 -70 Z" fill="url(#toe)"/><path d="M-6 -74 C -14 -96, -4 -112, 8 -104 C 2 -96, 0 -84, 4 -72 Z" fill="url(#claw)"/></g><g transform="translate(372 402) rotate(-42)"><path d="M0 -74 C 34 -74, 54 -36, 54 8 C 54 46, 30 70, 0 70 C -30 70, -54 46, -54 8 C -54 -36, -34 -74, 0 -74 Z" fill="url(#toe)"/><path d="M-5 -78 C -13 -101, -2 -117, 9 -108 C 3 -100, 1 -88, 5 -76 Z" fill="url(#claw)"/></g><g transform="translate(486 344) rotate(-20)"><path d="M0 -76 C 35 -76, 56 -37, 56 9 C 56 48, 31 72, 0 72 C -31 72, -56 48, -56 9 C -56 -37, -35 -76, 0 -76 Z" fill="url(#toe)"/><path d="M-4 -80 C -11 -104, 0 -120, 10 -110 C 4 -102, 3 -90, 6 -78 Z" fill="url(#claw)"/></g><g transform="translate(612 340) rotate(2)"><path d="M0 -74 C 34 -74, 54 -36, 54 8 C 54 46, 30 70, 0 70 C -30 70, -54 46, -54 8 C -54 -36, -34 -74, 0 -74 Z" fill="url(#toe)"/><path d="M-3 -78 C -9 -102, 2 -117, 12 -107 C 6 -99, 5 -87, 7 -76 Z" fill="url(#claw)"/></g><g transform="translate(590 610)"><path d="M0 -160 C -120 -160, -205 -92, -205 6 C -205 92, -150 168, -70 196 C -30 210, 30 210, 70 196 C 150 168, 205 92, 205 6 C 205 -92, 120 -160, 0 -160 Z" fill="url(#padMain)"/></g></g></svg></div>' +
        '<div style="font-size:40px;font-weight:800;letter-spacing:1px;color:#C6935F">Pupikes</div>' +
        '<div style="width:54px;height:3px;margin:14px auto 16px;border-radius:2px;background:linear-gradient(90deg,#C08A5A,#8A5A32);transform-origin:left;animation:kcyIntroBar 1.3s ease forwards"></div>' +
        '<div style="font-size:15px;line-height:1.5;color:#e7d6c4">' + (WHY[lg] || WHY.en) + '</div>' +
        '<div style="font-size:13px;line-height:1.5;color:#b79b82;margin-top:9px">' + (LIMIT[lg] || LIMIT.en) + '</div>' +
      '</div>' +
      '<style>@keyframes kcyIntroIn{to{transform:scale(1);opacity:1}}@keyframes kcyIntroBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}</style>';
    document.body.appendChild(ov);
    let gone = false;
    const close = () => { if (gone) return; gone = true; ov.style.opacity = '0'; setTimeout(() => { try { ov.remove(); } catch (e) {} }, 480); };
    ov.addEventListener('click', close);           // докосване → затваря веднага
    setTimeout(close, 5200);                        // иначе се затваря само (реклама, четима)
  };
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
}
