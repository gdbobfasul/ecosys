// Version: 1.0001
// intro.js — кратко „KCY Ecosystem" интро при СТАРТ (~1.5–1.8 сек), като интро на филм.
// Показва се при ВСЯКО стартиране, за да свикнат потребителите да го виждат/търсят.
// Универсален DOM слой (като help.js) — еднакъв файл във всяко приложение.
// Забележка: за апове с `server.url` (обвивки към жив сайт) този локален слой НЕ се изпълнява на
// устройството — там интрото се прави през нативния splash (виж бележките в билд скрипта).
export function playIntro() {
  const build = () => {
    if (!document.body || document.getElementById('kcy-intro')) return;
    try { if (window.__KCY_INTRO_OFF__) return; } catch (e) {}   // изключено при правене на снимки
    const ov = document.createElement('div');
    ov.id = 'kcy-intro';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 42%,#14243b,#060a12);transition:opacity .45s ease';
    ov.innerHTML =
      '<div style="text-align:center;font-family:system-ui,Segoe UI,Roboto,sans-serif;transform:scale(.88);opacity:0;animation:kcyIntroIn .8s cubic-bezier(.2,.7,.3,1) forwards">' +
        '<div style="font-size:46px;font-weight:800;letter-spacing:3px;background:linear-gradient(90deg,#4a9eff,#8bd450);-webkit-background-clip:text;background-clip:text;color:transparent">KCY</div>' +
        '<div style="font-size:17px;font-weight:600;color:#cdd9e5;letter-spacing:7px;margin-top:6px">ECOSYSTEM</div>' +
        '<div style="width:54px;height:3px;margin:14px auto 0;border-radius:2px;background:linear-gradient(90deg,#4a9eff,#8bd450);transform-origin:left;animation:kcyIntroBar 1.3s ease forwards"></div>' +
      '</div>' +
      '<style>@keyframes kcyIntroIn{to{transform:scale(1);opacity:1}}@keyframes kcyIntroBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}</style>';
    document.body.appendChild(ov);
    // видимо ~1.3s, после плавно изчезва (~0.45s) → общо ~1.8s
    setTimeout(() => { ov.style.opacity = '0'; setTimeout(() => { try { ov.remove(); } catch (e) {} }, 480); }, 1300);
  };
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
}
