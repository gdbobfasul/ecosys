// Version: 1.0019
// kcy-bar.js — ЕДИННА фиксирана лента НАЙ-ОТДОЛУ на всеки екран (универсален файл, еднакъв във
// всяко приложение). Носи бутоните „Pupikes", „Помощ", „Поверителност", „Условия" (+
// „Изтрий акаунта" при апове с акаунти) — покрива изискванията на Huawei/RuStore за правни
// линкове, достъпни ВЪТРЕ в приложението, на всяка страница. Лентата се пълни от ecosystem.js /
// help.js / legal.js чрез kcyBarButton() → main.js на приложенията НЕ се променя.
// При тесен екран лентата се скролва хоризонтално (без видим скролбар).
//
// Лентата НЕ закрива приложението:
//  (1) body получава padding-bottom с висината на лентата;
//  (2) елементи, залепени за дъното на екрана (fixed/sticky с bottom под висината на лентата —
//      долни навигации, композери), се повдигат с висината ѝ. MutationObserver ги хваща и след
//      пре-рисуване. Модали/цели екрани (височина ≥50% от прозореца) НЕ се пипат.

import { APP_VERSION } from '../version.js';

const BAR_H = 28; // px — дръж я малка: стои на ВСЕКИ екран

let mounted = false;
let pending = [];   // бутони, заявени преди document.body да съществува
const relabels = []; // функции за пре-етикетиране при смяна на езика

function injectStyle() {
  if (document.getElementById('kcy-bar-style')) return;
  const st = document.createElement('style'); st.id = 'kcy-bar-style';
  st.textContent =
    '#kcy-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483040;display:flex;gap:2px;align-items:center;' +
    'overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;' +
    'height:calc(' + BAR_H + 'px + env(safe-area-inset-bottom,0px));padding:0 6px env(safe-area-inset-bottom,0px);box-sizing:border-box;' +
    'background:rgba(10,14,21,.94);border-top:1px solid rgba(255,255,255,.09)}' +
    '#kcy-bar::-webkit-scrollbar{display:none}' +
    '#kcy-bar .kcy-bar-btn{flex:0 0 auto;white-space:nowrap;background:transparent;border:none;cursor:pointer;' +
    'color:#c7d2de;font:600 11px system-ui,Segoe UI,Roboto,sans-serif;padding:4px 7px;border-radius:9px;text-decoration:none;line-height:1.4}' +
    '#kcy-bar .kcy-bar-btn:active{background:rgba(255,255,255,.08)}' +
    '#kcy-bar .kcy-bar-btn.kcy-accent{color:#8bd450}' +
    '#kcy-bar-ver{flex:0 0 auto;margin-left:auto;color:#7f8c9b;font:600 10px system-ui,Segoe UI,Roboto,sans-serif;padding:4px 6px;white-space:nowrap}' +
    'body{padding-bottom:calc(' + BAR_H + 'px + env(safe-area-inset-bottom,0px)) !important}';
  (document.head || document.documentElement).appendChild(st);
}

// Повдига елементи, залепени за дъното (fixed/sticky, bottom < висината на лентата), за да не
// бъдат закрити. Оглежда само до 6 нива дълбочина (навигациите/композерите живеят плитко) и
// пропуска: самата лента, вече повдигнати елементи, „цял екран" елементи (модали).
function liftBottomPinned() {
  if (!document.body) return;
  let els;
  try {
    els = document.body.querySelectorAll(
      ':scope > *, :scope > * > *, :scope > * > * > *, :scope > * > * > * > *, :scope > * > * > * > * > *, :scope > * > * > * > * > * > *'
    );
  } catch (e) { return; }
  const vh = window.innerHeight || 800;
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (!el || el.id === 'kcy-bar' || el.dataset.kcyLift === '1') continue;
    let cs;
    try { cs = getComputedStyle(el); } catch (e) { continue; }
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const b = parseFloat(cs.bottom);
    if (!(b >= 0 && b < BAR_H)) continue;
    const r = el.getBoundingClientRect();
    if (!(r.height > 0 && r.height < vh * 0.5)) continue; // модал/цял екран → не пипай
    el.dataset.kcyLift = '1';
    try { el.style.setProperty('bottom', (b + BAR_H) + 'px', 'important'); } catch (e) {}
  }
}

let liftTimer = 0;
function scheduleLift() {
  if (liftTimer) return;
  liftTimer = setTimeout(() => { liftTimer = 0; liftBottomPinned(); }, 350);
}

function ensureBar() {
  if (!document.body) return null;
  let bar = document.getElementById('kcy-bar');
  if (bar) return bar;
  injectStyle();
  bar = document.createElement('div'); bar.id = 'kcy-bar';
  // ВЕРСИЯТА на приложението — винаги видима в края на лентата (изрично искане:
  // „нека всички приложения да им се вижда версията"). Числото идва от src/version.js,
  // който билдът генерира за всеки ап (= версията на APK-то).
  const ver = document.createElement('span');
  ver.id = 'kcy-bar-ver';
  ver.dataset.kcyOrder = '99';
  try { ver.textContent = 'v' + APP_VERSION; } catch (e) { ver.textContent = ''; }
  bar.appendChild(ver);
  document.body.appendChild(bar);
  liftBottomPinned();
  // пре-рисуванията на приложенията пресъздават навигациите → повдигай ги наново (отложено)
  try { new MutationObserver(scheduleLift).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  // смяна на езика → пре-етикетирай всички бутони
  try { new MutationObserver(() => { relabels.forEach((f) => { try { f(); } catch (e) {} }); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); } catch (e) {}
  window.addEventListener('resize', scheduleLift);
  return bar;
}

function insertSorted(bar, el, order) {
  el.dataset.kcyOrder = String(order);
  const kids = bar.children;
  for (let i = 0; i < kids.length; i++) {
    if (Number(kids[i].dataset.kcyOrder || 0) > order) { bar.insertBefore(el, kids[i]); return; }
  }
  bar.appendChild(el);
}

// Регистрира бутон в лентата. opts: { id, order, label: () => string, onClick, accent }.
// Може да се вика по всяко време (и преди body) — чака DOMContentLoaded при нужда.
export function kcyBarButton(opts) {
  function add() {
    const bar = ensureBar();
    if (!bar) return;
    if (document.getElementById(opts.id)) return;
    const b = document.createElement('button');
    b.id = opts.id;
    b.className = 'kcy-bar-btn' + (opts.accent ? ' kcy-accent' : '');
    const relabel = () => { try { if (opts.html) b.innerHTML = opts.label(); else b.textContent = opts.label(); } catch (e) {} };
    relabel();
    relabels.push(relabel);
    b.onclick = opts.onClick;
    insertSorted(bar, b, opts.order || 0);
  }
  if (document.body) add();
  else if (!mounted) {
    pending.push(add);
    mounted = true;
    document.addEventListener('DOMContentLoaded', () => { pending.forEach((f) => f()); pending = []; });
  } else pending.push(add);
}
