// Version: 1.0003
// license.js — ЛОКАЛНА проверка на източника (БЕЗ сървър/база/данни). Ако приложението НЕ е
// инсталирано от магазина (sideload/прехвърлено .apk копие), показва ПРЕДУПРЕЖДЕНИЕ „неоригинално
// копие" — но НЕ блокира и НЕ иска парола (засега). Проверката е СЛЕД избора на език (за да е на
// неговия език). Нищо не се праща навън → без данни; работи офлайн.
//
// Източникът идва от нативния мост window.PupikesNative.getInstaller() (инжектира се в MainActivity
// при билд). Пакет на магазина = ок; друго/празно = не-магазин → предупреждение.
import { hasLangChosen, getLang } from './i18n.js';

// Пакети-инсталатори на магазините (по подниз). Всичко друго = не е от магазина.
const STORE_INSTALLERS = ['huawei.appmarket', 'rustore', 'vk.store'];
const STORE_URLS = { rustore: 'https://www.rustore.ru/', huawei: 'https://appgallery.huawei.com/' };

// ЗА ПО-КЪСНО (блокиране с парола): раз-коментирай реда и логиката в showGate/run по-долу.
// const UNLOCK_PASS = 'Pup1kes.Paw.2026#Kq7mZ9x'; // = APK_GATE_PASS в private/configs/.env

const L = {
  title:   { bg:'Неоригинално копие', ru:'Неоригинальная копия', uk:'Неоригінальна копія', en:'Unofficial copy', de:'Inoffizielle Kopie', fr:'Copie non officielle', es:'Copia no oficial', 'es-MX':'Copia no oficial', it:'Copia non ufficiale', pt:'Cópia não oficial', ar:'نسخة غير رسمية', hi:'अनौपचारिक प्रति', ja:'非公式コピー', ky:'Расмий эмес көчүрмө', 'zh-Hant':'非官方複本' },
  intro:   { bg:'Това приложение изглежда не е изтеглено от официалния магазин (възможно споделено копие). Препоръчваме да го свалиш от RuStore или Huawei.', ru:'Похоже, это приложение установлено не из официального магазина (возможно, копия). Рекомендуем скачать его в RuStore или Huawei.', uk:'Схоже, застосунок встановлено не з офіційного магазину (можливо, копія). Рекомендуємо завантажити його в RuStore або Huawei.', en:'This app does not appear to be installed from the official store (possibly a shared copy). We recommend getting it from RuStore or Huawei.', de:'Diese App scheint nicht aus dem offiziellen Store installiert zu sein (evtl. eine Kopie). Wir empfehlen, sie bei RuStore oder Huawei zu laden.', fr:'Cette application ne semble pas installée depuis le store officiel (peut-être une copie). Nous recommandons de la télécharger sur RuStore ou Huawei.', es:'Esta app no parece instalada desde la tienda oficial (posible copia). Recomendamos descargarla en RuStore o Huawei.', 'es-MX':'Esta app no parece instalada desde la tienda oficial (posible copia). Recomendamos descargarla en RuStore o Huawei.', it:'Questa app non sembra installata dallo store ufficiale (forse una copia). Consigliamo di scaricarla su RuStore o Huawei.', pt:'Esta app não parece instalada pela loja oficial (possível cópia). Recomendamos instalá-la pela RuStore ou Huawei.', ar:'يبدو أن هذا التطبيق لم يُثبَّت من المتجر الرسمي (ربما نسخة). ننصح بتنزيله من RuStore أو Huawei.', hi:'यह ऐप आधिकारिक स्टोर से इंस्टॉल नहीं लगती (संभवतः कॉपी)। इसे RuStore या Huawei से लेने की सलाह है।', ja:'このアプリは公式ストアからインストールされていないようです（コピーの可能性）。RuStore または Huawei からの入手をおすすめします。', ky:'Бул колдонмо расмий дүкөндөн орнотулбаган окшойт (көчүрмө болушу мүмкүн). Аны RuStore же Huawei ден жүктөөнү сунуштайбыз.', 'zh-Hant':'此應用程式似乎不是從官方商店安裝的（可能是複本）。建議從 RuStore 或 Huawei 下載。' },
  cont:    { bg:'Продължи', ru:'Продолжить', uk:'Продовжити', en:'Continue', de:'Weiter', fr:'Continuer', es:'Continuar', 'es-MX':'Continuar', it:'Continua', pt:'Continuar', ar:'متابعة', hi:'जारी रखें', ja:'続ける', ky:'Улантуу', 'zh-Hant':'繼續' },
  buyRu:   { bg:'Отвори RuStore', ru:'Открыть RuStore', uk:'Відкрити RuStore', en:'Open RuStore', de:'RuStore öffnen', fr:'Ouvrir RuStore', es:'Abrir RuStore', 'es-MX':'Abrir RuStore', it:'Apri RuStore', pt:'Abrir RuStore', ar:'افتح RuStore', hi:'RuStore खोलें', ja:'RuStoreを開く', ky:'RuStore ачуу', 'zh-Hant':'開啟 RuStore' },
  buyHw:   { bg:'Отвори Huawei', ru:'Открыть Huawei', uk:'Відкрити Huawei', en:'Open Huawei', de:'Huawei öffnen', fr:'Ouvrir Huawei', es:'Abrir Huawei', 'es-MX':'Abrir Huawei', it:'Apri Huawei', pt:'Abrir Huawei', ar:'افتح Huawei', hi:'Huawei खोलें', ja:'Huaweiを開く', ky:'Huawei ачуу', 'zh-Hant':'開啟 Huawei' }
};
function lang() { try { const g = getLang && getLang(); if (g && L.title[g]) return g; } catch (e) {} try { const h = document.documentElement.getAttribute('lang'); if (h && L.title[h]) return h; } catch (e) {} return 'en'; }
function tr(k) { const m = L[k] || {}; return m[lang()] || m.en || m.bg || k; }

// Инсталатор от нативния мост. Празно = неизвестно (браузър/iOS/мостът не е готов).
function installer() {
  try { if (window.PupikesNative && typeof window.PupikesNative.getInstaller === 'function') return String(window.PupikesNative.getInstaller() || ''); } catch (e) {}
  try { if (window.__PUPIKES_INSTALLER__) return String(window.__PUPIKES_INSTALLER__); } catch (e) {}
  return '';
}
// Единствената проверка: инсталаторът пакет на магазин ли е. Всичко друго → не-магазин.
function isFromStore() {
  const i = installer().toLowerCase();
  return !!i && STORE_INSTALLERS.some((s) => i.indexOf(s) >= 0);
}

// ПРЕДУПРЕЖДЕНИЕ (не блокира): „неоригинално копие" + бутони към магазините + „Продължи".
function showWarning(store) {
  if (document.getElementById('pupikes-lic-ov')) return;
  const ov = document.createElement('div'); ov.id = 'pupikes-lic-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#0d1117;color:#e6edf3;display:flex;align-items:center;justify-content:center;padding:22px;font-family:system-ui,Segoe UI,Roboto,sans-serif';
  const box = document.createElement('div'); box.style.cssText = 'max-width:420px;width:100%;text-align:center';
  const h = document.createElement('div'); h.textContent = '⚠️ ' + tr('title'); h.style.cssText = 'font-weight:800;font-size:20px;margin-bottom:12px;color:#f0a020';
  const p = document.createElement('div'); p.textContent = tr('intro'); p.style.cssText = 'color:#9aa4b2;font-size:14px;line-height:1.5;margin-bottom:18px';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-bottom:10px';
  const mk = (label, href, primary) => { const a = document.createElement('a'); a.textContent = label; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.style.cssText = 'flex:1;text-align:center;text-decoration:none;padding:12px;border-radius:10px;font:700 14px system-ui;border:1px solid ' + (primary ? '#2ea043' : '#2a3550') + ';color:' + (primary ? '#7ee29a' : '#8ecae6'); return a; };
  const ru = mk(tr('buyRu'), STORE_URLS.rustore, store === 'rustore');
  const hw = mk(tr('buyHw'), STORE_URLS.huawei, store === 'huawei');
  if (store === 'huawei') row.append(hw, ru); else row.append(ru, hw);
  const cont = document.createElement('button'); cont.textContent = tr('cont');
  cont.style.cssText = 'width:100%;padding:12px;border:none;border-radius:10px;background:#30363d;color:#e6edf3;font:700 14px system-ui;cursor:pointer';
  cont.onclick = () => ov.remove();   // само предупреждение → потребителят продължава
  box.append(h, p, row, cont); ov.appendChild(box); document.body.appendChild(ov);
  // ЗА ПО-КЪСНО (блокиране с парола): вместо „Продължи" сложи поле за парола (UNLOCK_PASS) и махни dismiss-а.
}

// Извиква се от main.js. Изчаква избора на език, после проверява ЛОКАЛНО източника.
export function enforceLicense(app, store) {
  const run = () => {
    if (isFromStore()) return;          // от магазина → нищо
    showWarning(store);                 // не е от магазина → само предупреждение (не блокира)
  };
  if (hasLangChosen && hasLangChosen()) { run(); return; }
  const iv = setInterval(() => { try { if (hasLangChosen && hasLangChosen()) { clearInterval(iv); run(); } } catch (e) {} }, 300);
  setTimeout(() => { try { clearInterval(iv); } catch (e) {} run(); }, 60000);
}
