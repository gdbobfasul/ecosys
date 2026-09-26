// lite-gate.js — за БЕЗПЛАТНИТЕ „Lite" (демо) приложения. Заключените напреднали функции показват
// модал „Това е в пълната версия" + бутон „Свали пълната версия" (deep-link към платения ап в
// съответния магазин). БЕЗ IAP — ъпгрейдът = сваляне на отделния платен ап.
//
// Конфигурация: билдът вписва store-линковете на ПЪЛНИЯ ап в src/lite.js:
//   export const LITE = { full: { name:"MotionHawk", rustore:"<url>", huawei:"<pkg или url>" },
//                         locked: ["othercam","export",...] }
// Ако src/lite.js липсва (напр. пълният ап) → всичко е отключено (liteLocked() = false).
// СТАТИЧЕН import (без top-level await — TLA чупи es2017 таргета на vite). lite.js ВИНАГИ съществува
// в Lite билд (billдът/скелетът го създава); за не-Lite апове този модул изобщо не се копира.
import { LITE as _LITE } from '../lite.js';
const LITE = _LITE || null;

const CODES = ['bg','ru','uk','en','de','fr','es','es-MX','it','pt','ar','hi','ja','ky','zh-Hant'];
function lang() { try { for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)); if (v && CODES.indexOf(v) >= 0) return v; } } catch (_) {} return 'ru'; }
function tr(o) { const l = lang(); return o[l] || o.en || o.bg; }

export function isLite() { return !!(LITE && LITE.full); }
export function liteLocked(key) { return !!(LITE && Array.isArray(LITE.locked) && LITE.locked.indexOf(key) >= 0); }
// Гейт: заключена функция в Lite → покажи „пълна версия"; иначе изпълни onOk.
export function liteRequire(key, onOk) {
  if (!liteLocked(key)) { if (typeof onOk === 'function') onOk(); return true; }
  openFull(key); return false;
}

function storeUrl() {
  const f = (LITE && LITE.full) || {};
  const isHuawei = /huawei/i.test((f._store || '') ) || !!(f.huawei && !f.rustore);
  // билдът задава f._store = 'rustore' | 'huawei' според магазина на билда
  if (f._store === 'huawei') return f.huawei || '';
  if (f._store === 'rustore') return f.rustore || '';
  return f.rustore || f.huawei || '';
}
function openStore() {
  const u = storeUrl(); if (!u) return;
  try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) { window.Capacitor.Plugins.Browser.open({ url: u }); return; } } catch (_) {}
  try { window.open(u, '_blank'); } catch (_) {}
}

const T = {
  title: { bg:'Само в пълната версия', ru:'Только в полной версии', uk:'Лише в повній версії', en:'Full version only', de:'Nur in der Vollversion', fr:'Version complète uniquement', es:'Solo en la versión completa', 'es-MX':'Solo en la versión completa', it:'Solo nella versione completa', pt:'Apenas na versão completa', ar:'في النسخة الكاملة فقط', hi:'केवल पूर्ण संस्करण में', ja:'フル版のみ', ky:'Толук версияда гана', 'zh-Hant':'僅完整版' },
  body: { bg:'Това е демо (Lite). Тази функция и всички разширени възможности са в пълната версия.', ru:'Это демо (Lite). Эта функция и все расширенные возможности — в полной версии.', uk:'Це демо (Lite). Ця функція та всі розширені можливості — у повній версії.', en:'This is a Lite demo. This feature and all advanced capabilities are in the full version.', de:'Dies ist eine Lite-Demo. Diese Funktion und alle erweiterten Möglichkeiten sind in der Vollversion.', fr:'Ceci est une démo Lite. Cette fonction et toutes les options avancées sont dans la version complète.', es:'Esta es una demo Lite. Esta función y todo lo avanzado están en la versión completa.', 'es-MX':'Esta es una demo Lite. Esta función y todo lo avanzado están en la versión completa.', it:'Questa è una demo Lite. Questa funzione e tutte le opzioni avanzate sono nella versione completa.', pt:'Isto é uma demo Lite. Esta função e tudo o avançado estão na versão completa.', ar:'هذه نسخة تجريبية (Lite). هذه الميزة وكل الإمكانات المتقدمة في النسخة الكاملة.', hi:'यह एक Lite डेमो है। यह सुविधा और सभी उन्नत क्षमताएँ पूर्ण संस्करण में हैं।', ja:'これはLite（体験版）です。この機能と高度な機能はフル版にあります。', ky:'Бул Lite демо. Бул функция жана бардык кеңейтилген мүмкүнчүлүктөр толук версияда.', 'zh-Hant':'這是 Lite 體驗版。此功能與所有進階功能在完整版中。' },
  get: { bg:'Свали пълната версия', ru:'Скачать полную версию', uk:'Завантажити повну версію', en:'Get the full version', de:'Vollversion holen', fr:'Obtenir la version complète', es:'Obtener la versión completa', 'es-MX':'Obtener la versión completa', it:'Ottieni la versione completa', pt:'Obter a versão completa', ar:'احصل على النسخة الكاملة', hi:'पूर्ण संस्करण प्राप्त करें', ja:'フル版を入手', ky:'Толук версияны жүктөө', 'zh-Hant':'取得完整版' },
  later: { bg:'По-късно', ru:'Позже', uk:'Пізніше', en:'Later', de:'Später', fr:'Plus tard', es:'Más tarde', 'es-MX':'Más tarde', it:'Più tardi', pt:'Mais tarde', ar:'لاحقًا', hi:'बाद में', ja:'あとで', ky:'Кийин', 'zh-Hant':'稍後' }
};
// Кратък локализиран етикет за постоянния бутон „Пълна версия" (FAB долу вляво).
const FAB = { bg:'Пълна версия', ru:'Полная версия', uk:'Повна версія', en:'Full version', de:'Vollversion', fr:'Version complète', es:'Versión completa', 'es-MX':'Versión completa', it:'Versione completa', pt:'Versão completa', ar:'النسخة الكاملة', hi:'पूर्ण संस्करण', ja:'フル版', ky:'Толук версия', 'zh-Hant':'完整版' };
export function fullLabel() { return '⬆️ ' + tr(FAB); }
// Кратка локализирана бележка за демо-банер („безплатно демо; пълните функции са в платената версия").
const NOTE = { bg:'Безплатна демо версия. Пълните функции са в платената версия.', ru:'Бесплатная демо-версия. Все функции — в платной версии.', uk:'Безкоштовна демо-версія. Усі функції — у платній версії.', en:'Free demo version. All features are in the paid version.', de:'Kostenlose Demo. Alle Funktionen sind in der kostenpflichtigen Version.', fr:'Version démo gratuite. Toutes les fonctions sont dans la version payante.', es:'Versión demo gratuita. Todas las funciones están en la versión de pago.', 'es-MX':'Versión demo gratuita. Todas las funciones están en la versión de pago.', it:'Versione demo gratuita. Tutte le funzioni sono nella versione a pagamento.', pt:'Versão demo gratuita. Todas as funções estão na versão paga.', ar:'نسخة تجريبية مجانية. كل الميزات في النسخة المدفوعة.', hi:'मुफ़्त डेमो संस्करण। सभी सुविधाएँ सशुल्क संस्करण में हैं।', ja:'無料デモ版です。すべての機能は有料版にあります。', ky:'Акысыз демо версия. Бардык функциялар акы төлөнүүчү версияда.', 'zh-Hant':'免費體驗版。所有功能在付費版中。' };
export function demoNote() { return tr(NOTE); }

let _m = null;
export function openFull() {
  if (_m || !isLite()) return;
  const d = document.createElement('div');
  d.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif');
  const nm = (LITE.full && LITE.full.name) ? (' — ' + LITE.full.name) : '';
  d.innerHTML = '<div style="max-width:360px;width:100%;background:#fff;color:#1a1a2e;border-radius:16px;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.35)">'
    + '<div style="font-size:1.3em;font-weight:800;margin-bottom:8px">🔒 ' + esc(tr(T.title)) + '</div>'
    + '<div style="font-size:.97em;line-height:1.5;opacity:.85;margin-bottom:18px">' + esc(tr(T.body)) + '</div>'
    + '<button id="lg-get" style="width:100%;padding:13px;border:0;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;font-size:1.05em;font-weight:700;cursor:pointer">⬇️ ' + esc(tr(T.get)) + esc(nm) + '</button>'
    + '<button id="lg-later" style="width:100%;padding:10px;margin-top:8px;border:0;border-radius:10px;background:transparent;color:#888;font-size:.9em;cursor:pointer">' + esc(tr(T.later)) + '</button>'
    + '</div>';
  document.body.appendChild(d); _m = d;
  d.querySelector('#lg-get').onclick = () => { openStore(); closeFull(); };
  d.querySelector('#lg-later').onclick = () => closeFull();
  d.addEventListener('click', (e) => { if (e.target === d) closeFull(); });
}
export function closeFull() { if (_m && _m.parentNode) _m.parentNode.removeChild(_m); _m = null; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
