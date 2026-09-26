// pro.js — PRO (freemium) мениджър за всички приложения. Управлява се от publish/monetization.json:
//   { "model":"free", "released":true, "pro": { "productId":"pro_unlock", "priceHint":"₽510",
//     "features":["..."], "removesAds":true } }
// Дава: isPro(), requirePro(featureKey, onOk), buyPro(), restore() + красив upsell модал (15 езика).
//
// Покупката минава през NATIVE моста window.Capacitor.Plugins.PupikesPurchases (RuStore Billing /
// HMS IAP — Фаза Б). Ако мостът липсва (браузър/още невключен SDK) → PRO се държи като „още не е
// наличен": upsell-ът се показва, но покупката учтиво казва „временно недостъпно" и НИЩО не се чупи.
// Веднъж купено/възстановено → пази се локално (pupikes.pro.owned) + се пита моста при старт.
import { MONETIZATION } from '../monetize.js';

const K_OWNED = 'pupikes.pro.owned';
function cfg() { const m = MONETIZATION || {}; return (m.pro && typeof m.pro === 'object') ? m.pro : null; }
function bridge() { try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PupikesPurchases) || null; } catch (_) { return null; } }
function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

let _owned = lsGet(K_OWNED) === '1';
const _listeners = [];
export function onProChange(fn) { if (typeof fn === 'function') _listeners.push(fn); }
function emit() { for (const f of _listeners) { try { f(_owned); } catch (_) {} } }
function setOwned(v) { _owned = !!v; lsSet(K_OWNED, _owned ? '1' : '0'); emit(); }

export function proEnabled() { return !!cfg(); }
export function isPro() { return _owned; }
// PRO функция ли е даденият ключ (в monetization.pro.features)?
export function isProFeature(key) { const p = cfg(); return !!(p && Array.isArray(p.features) && p.features.indexOf(key) >= 0); }
// PRO премахва ли рекламите?
export function proRemovesAds() { const p = cfg(); return !!(p && p.removesAds); }

// При старт: питай native моста дали PRO е вече собственост (възстановяване след преинсталация).
export async function initPro() {
  const b = bridge(); if (!b || !cfg()) return isPro();
  try { const r = await b.isPurchased({ productId: cfg().productId }); if (r && typeof r.purchased === 'boolean') setOwned(r.purchased || _owned); } catch (_) {}
  return isPro();
}

// Гейт: ако е PRO функция и потребителят НЕ е PRO → покажи upsell и върни false; иначе изпълни onOk.
export function requirePro(featureKey, onOk) {
  if (!cfg() || isPro() || !isProFeature(featureKey)) { if (typeof onOk === 'function') onOk(); return true; }
  openUpsell(featureKey); return false;
}

export async function buyPro() {
  const p = cfg(); const b = bridge();
  if (!p) return { ok: false, reason: 'no-config' };
  if (!b) { toast(T.unavailable); return { ok: false, reason: 'no-bridge' }; }
  try {
    const r = await b.purchase({ productId: p.productId });
    if (r && (r.ok || r.purchased || r.state === 'purchased')) { setOwned(true); closeUpsell(); toast(T.thanks); return { ok: true }; }
    toast(T.cancelled); return { ok: false, reason: 'cancelled' };
  } catch (e) { toast(T.unavailable); return { ok: false, reason: String((e && e.message) || e) }; }
}

export async function restore() {
  const p = cfg(); const b = bridge(); if (!p || !b) { toast(T.unavailable); return false; }
  try { const r = await b.restore({ productId: p.productId }); const ok = !!(r && (r.purchased || r.ok)); if (ok) { setOwned(true); toast(T.restored); } else toast(T.noRestore); return ok; }
  catch (_) { toast(T.unavailable); return false; }
}

/* ───────── UI: upsell модал + toast (15 езика) ───────── */
const CODES = ['bg','ru','uk','en','de','fr','es','es-MX','it','pt','ar','hi','ja','ky','zh-Hant'];
function lang() { try { for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)); if (v && CODES.indexOf(v) >= 0) return v; } } catch (_) {} return 'ru'; }
function tr(o) { const l = lang(); return o[l] || o.en || o.bg; }
const T = {
  title:   { bg:'Отключи PRO', ru:'Открой PRO', uk:'Розблокуй PRO', en:'Unlock PRO', de:'PRO freischalten', fr:'Débloquer PRO', es:'Desbloquear PRO', 'es-MX':'Desbloquear PRO', it:'Sblocca PRO', pt:'Desbloquear PRO', ar:'افتح PRO', hi:'PRO अनलॉक करें', ja:'PROを解除', ky:'PRO ачуу', 'zh-Hant':'解鎖 PRO' },
  body:    { bg:'Тази функция е в PRO. Еднократна покупка — маха рекламите и отключва всички PRO функции завинаги.', ru:'Эта функция в PRO. Разовая покупка — убирает рекламу и открывает все PRO-функции навсегда.', uk:'Ця функція в PRO. Разова покупка — прибирає рекламу та відкриває всі PRO-функції назавжди.', en:'This is a PRO feature. One-time purchase — removes ads and unlocks all PRO features forever.', de:'PRO-Funktion. Einmalkauf — entfernt Werbung und schaltet alle PRO-Funktionen dauerhaft frei.', fr:'Fonction PRO. Achat unique — supprime les pubs et débloque toutes les fonctions PRO pour toujours.', es:'Función PRO. Compra única — quita los anuncios y desbloquea todo PRO para siempre.', 'es-MX':'Función PRO. Compra única — quita los anuncios y desbloquea todo PRO para siempre.', it:'Funzione PRO. Acquisto unico — rimuove le pubblicità e sblocca tutto PRO per sempre.', pt:'Função PRO. Compra única — remove anúncios e desbloqueia tudo PRO para sempre.', ar:'ميزة PRO. شراء لمرة واحدة — يزيل الإعلانات ويفتح كل مزايا PRO للأبد.', hi:'यह PRO सुविधा है। एक बार खरीदें — विज्ञापन हटाएँ और सभी PRO सुविधाएँ हमेशा के लिए अनलॉक करें।', ja:'PRO機能です。買い切り — 広告を消し、すべてのPRO機能を永久に解放。', ky:'Бул PRO функция. Бир жолку сатып алуу — жарнаманы алып салат жана бардык PRO функцияларды ачат.', 'zh-Hant':'PRO 功能。一次購買 — 移除廣告並永久解鎖所有 PRO 功能。' },
  buy:     { bg:'Купи PRO', ru:'Купить PRO', uk:'Купити PRO', en:'Buy PRO', de:'PRO kaufen', fr:'Acheter PRO', es:'Comprar PRO', 'es-MX':'Comprar PRO', it:'Acquista PRO', pt:'Comprar PRO', ar:'اشترِ PRO', hi:'PRO खरीदें', ja:'PROを購入', ky:'PRO сатып алуу', 'zh-Hant':'購買 PRO' },
  restore: { bg:'Възстанови покупка', ru:'Восстановить покупку', uk:'Відновити покупку', en:'Restore purchase', de:'Kauf wiederherstellen', fr:'Restaurer l’achat', es:'Restaurar compra', 'es-MX':'Restaurar compra', it:'Ripristina acquisto', pt:'Restaurar compra', ar:'استعادة الشراء', hi:'खरीद पुनर्स्थापित करें', ja:'購入を復元', ky:'Сатып алууну калыбына келтирүү', 'zh-Hant':'恢復購買' },
  later:   { bg:'По-късно', ru:'Позже', uk:'Пізніше', en:'Later', de:'Später', fr:'Plus tard', es:'Más tarde', 'es-MX':'Más tarde', it:'Più tardi', pt:'Mais tarde', ar:'لاحقًا', hi:'बाद में', ja:'あとで', ky:'Кийин', 'zh-Hant':'稍後' },
  thanks:  { bg:'Благодарим! PRO е отключено ✨', ru:'Спасибо! PRO открыт ✨', uk:'Дякуємо! PRO відкрито ✨', en:'Thank you! PRO unlocked ✨', de:'Danke! PRO freigeschaltet ✨', fr:'Merci ! PRO débloqué ✨', es:'¡Gracias! PRO desbloqueado ✨', 'es-MX':'¡Gracias! PRO desbloqueado ✨', it:'Grazie! PRO sbloccato ✨', pt:'Obrigado! PRO desbloqueado ✨', ar:'شكرًا! تم فتح PRO ✨', hi:'धन्यवाद! PRO अनलॉक ✨', ja:'ありがとうございます！PRO解放 ✨', ky:'Рахмат! PRO ачылды ✨', 'zh-Hant':'感謝！已解鎖 PRO ✨' },
  restored:{ bg:'Покупката е възстановена ✨', ru:'Покупка восстановлена ✨', uk:'Покупку відновлено ✨', en:'Purchase restored ✨', de:'Kauf wiederhergestellt ✨', fr:'Achat restauré ✨', es:'Compra restaurada ✨', 'es-MX':'Compra restaurada ✨', it:'Acquisto ripristinato ✨', pt:'Compra restaurada ✨', ar:'تمت استعادة الشراء ✨', hi:'खरीद पुनर्स्थापित ✨', ja:'購入を復元 ✨', ky:'Сатып алуу калыбына келди ✨', 'zh-Hant':'已恢復購買 ✨' },
  noRestore:{ bg:'Няма покупка за възстановяване', ru:'Нет покупки для восстановления', uk:'Немає покупки для відновлення', en:'No purchase to restore', de:'Kein Kauf zum Wiederherstellen', fr:'Aucun achat à restaurer', es:'No hay compra que restaurar', 'es-MX':'No hay compra que restaurar', it:'Nessun acquisto da ripristinare', pt:'Nenhuma compra a restaurar', ar:'لا توجد عملية شراء للاستعادة', hi:'पुनर्स्थापित करने के लिए कोई खरीद नहीं', ja:'復元する購入がありません', ky:'Калыбына келтире турган сатып алуу жок', 'zh-Hant':'沒有可恢復的購買' },
  cancelled:{ bg:'Покупката е отказана', ru:'Покупка отменена', uk:'Покупку скасовано', en:'Purchase cancelled', de:'Kauf abgebrochen', fr:'Achat annulé', es:'Compra cancelada', 'es-MX':'Compra cancelada', it:'Acquisto annullato', pt:'Compra cancelada', ar:'أُلغيت عملية الشراء', hi:'खरीद रद्द', ja:'購入をキャンセル', ky:'Сатып алуу жокко чыгарылды', 'zh-Hant':'已取消購買' },
  unavailable:{ bg:'Покупките са временно недостъпни', ru:'Покупки временно недоступны', uk:'Покупки тимчасово недоступні', en:'Purchases are temporarily unavailable', de:'Käufe vorübergehend nicht verfügbar', fr:'Achats temporairement indisponibles', es:'Compras no disponibles por ahora', 'es-MX':'Compras no disponibles por ahora', it:'Acquisti temporaneamente non disponibili', pt:'Compras temporariamente indisponíveis', ar:'المشتريات غير متاحة مؤقتًا', hi:'खरीदारी अस्थायी रूप से अनुपलब्ध', ja:'購入は一時的に利用できません', ky:'Сатып алуулар убактылуу жеткиликсиз', 'zh-Hant':'購買暫時無法使用' }
};

let _modal = null;
export function openUpsell() {
  if (_modal) return; const p = cfg(); if (!p) return;
  const price = p.priceHint ? (' — ' + p.priceHint) : '';
  const d = document.createElement('div');
  d.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif');
  d.innerHTML = '<div style="max-width:360px;width:100%;background:#fff;color:#1a1a2e;border-radius:16px;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.35)">'
    + '<div style="font-size:1.35em;font-weight:800;margin-bottom:8px">✨ ' + esc(tr(T.title)) + '</div>'
    + '<div style="font-size:.98em;line-height:1.5;opacity:.85;margin-bottom:18px">' + esc(tr(T.body)) + '</div>'
    + '<button id="pk-buy" style="width:100%;padding:13px;border:0;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:1.05em;font-weight:700;cursor:pointer">' + esc(tr(T.buy)) + esc(price) + '</button>'
    + '<button id="pk-restore" style="width:100%;padding:10px;margin-top:8px;border:0;border-radius:10px;background:#f0f0f5;color:#333;font-size:.92em;cursor:pointer">' + esc(tr(T.restore)) + '</button>'
    + '<button id="pk-later" style="width:100%;padding:10px;margin-top:6px;border:0;border-radius:10px;background:transparent;color:#888;font-size:.9em;cursor:pointer">' + esc(tr(T.later)) + '</button>'
    + '</div>';
  document.body.appendChild(d); _modal = d;
  d.querySelector('#pk-buy').onclick = () => buyPro();
  d.querySelector('#pk-restore').onclick = () => restore();
  d.querySelector('#pk-later').onclick = () => closeUpsell();
  d.addEventListener('click', (e) => { if (e.target === d) closeUpsell(); });
}
export function closeUpsell() { if (_modal && _modal.parentNode) _modal.parentNode.removeChild(_modal); _modal = null; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function toast(o) {
  try { const t = document.createElement('div'); t.textContent = tr(o);
    t.setAttribute('style', 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:2147483001;background:#1a1a2e;color:#fff;padding:11px 18px;border-radius:22px;font:600 14px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.3);max-width:88vw;text-align:center');
    document.body.appendChild(t); setTimeout(() => { try { t.remove(); } catch (_) {} }, 2600);
  } catch (_) {}
}
