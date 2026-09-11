// Version: 1.0025
// urlcheck.js — „Проверка на адрес" (фишинг), 11.09.2026. Изцяло ОФЛАЙН, на устройството:
//   • разбор на адреса (HTTPS, IP вместо име, „@" преди хоста, нестандартен порт);
//   • punycode (xn--) → декодира до Unicode и гледа за смесени азбуки (кирилица + латиница);
//   • „двойници" на ТВОИТЕ сайтове (домейните от записите с пароли): еднакъв „скелет" след замяна на
//     подобни знаци (о/0, l/1, rn/m, кирилско а/е/о/р/с/х/у…), разстояние на Левенщайн ≤1–2,
//     марката ти като поддомейн на чужд домейн (paypal.com.evil.net) или вградена в чуждо име;
//   • много тирета, много дълго име, често злоупотребявани домейни от първо ниво.
// Резултат: присъда known | ok | suspicious | danger + причини (кодове за i18n url_r_*).
import { session } from './storage.js';
import { siteOf } from './audit.js';

const BAD_TLD = ['zip', 'mov', 'top', 'xyz', 'tk', 'ml', 'ga', 'cf', 'gq', 'work', 'click', 'link', 'buzz', 'icu', 'cam', 'rest', 'monster', 'quest', 'cfd', 'sbs'];

// ---------- punycode (RFC 3492) — само декодиране ----------
function punyDecode(input) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128;
  let n = initialN, bias = initialBias, i = 0;
  const out = [];
  let basic = input.lastIndexOf('-'); if (basic < 0) basic = 0;
  for (let j = 0; j < basic; j++) out.push(input.charCodeAt(j));
  const digit = (c) => (c - 48 < 10) ? c - 22 : (c - 65 < 26) ? c - 65 : (c - 97 < 26) ? c - 97 : base;
  const adapt = (delta, num, first) => {
    delta = first ? Math.floor(delta / damp) : delta >> 1; delta += Math.floor(delta / num);
    let k = 0; while (delta > ((base - tMin) * tMax) >> 1) { delta = Math.floor(delta / (base - tMin)); k += base; }
    return k + Math.floor((base - tMin + 1) * delta / (delta + skew));
  };
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length;) {
    const oldi = i; let w = 1;
    for (let k = base; ; k += base) {
      if (idx >= input.length) throw new Error('bad');
      const d = digit(input.charCodeAt(idx++)); if (d >= base) throw new Error('bad');
      i += d * w; const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (d < t) break; w *= base - t;
    }
    bias = adapt(i - oldi, out.length + 1, oldi === 0);
    n += Math.floor(i / (out.length + 1)); i %= out.length + 1;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint.apply(null, out);
}
export function hostToUnicode(host) {
  return String(host || '').split('.').map((lb) => {
    if (/^xn--/i.test(lb)) { try { return punyDecode(lb.slice(4)); } catch (_) { return lb; } }
    return lb;
  }).join('.');
}

// ---------- скелет (подобни знаци → един и същ) ----------
const CONFUSABLE = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ԁ': 'd', 'ɡ': 'g', 'һ': 'h', 'ⅼ': 'l', 'ո': 'n', 'ѕ': 's', 'ԝ': 'w', 'ν': 'v', 'ο': 'o', 'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'ϲ': 'c', 'ı': 'i', 'ł': 'l', 'ö': 'o', 'ü': 'u', 'ä': 'a', 'é': 'e', 'è': 'e', 'ê': 'e', 'á': 'a', 'à': 'a', 'ó': 'o', 'ò': 'o', 'í': 'i', 'ú': 'u', 'ñ': 'n', 'ç': 'c' };
export function skeleton(label) {
  let s = String(label || '').toLowerCase().normalize('NFKC');
  s = s.split('').map((ch) => CONFUSABLE[ch] || ch).join('');
  s = s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/cl/g, 'd');
  s = s.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b').replace(/\|/g, 'l');
  return s.replace(/[^a-z]/g, '');
}
function levenshtein(a, b) {
  a = String(a); b = String(b);
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Регистрируем домейн: последните 2 етикета (или 3 при co.uk/com.br/…).
export function registrable(host) {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2];
  if (/^(co|com|org|net|gov|edu|ac)$/.test(sld) && parts[parts.length - 1].length === 2) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}
const hasCyr = (s) => /[Ѐ-ӿ]/.test(s);
const hasLat = (s) => /[a-z]/i.test(s);

// Домейните от сейфа: [{ domain, base, entry }]
export function vaultDomains() {
  const out = [];
  (session.passwords || []).forEach((p) => {
    const host = siteOf(p); if (!host || host.indexOf('.') < 0) return;
    const reg = registrable(host);
    out.push({ domain: reg, base: reg.split('.')[0], entry: p });
  });
  return out;
}

export function analyzeUrl(input) {
  const raw = String(input || '').trim();
  const reasons = [];
  const res = { input: raw, url: null, host: '', unicodeHost: '', domain: '', verdict: 'ok', reasons, matches: [] };
  if (!raw) { reasons.push({ code: 'invalid', level: 2 }); res.verdict = 'suspicious'; return res; }
  let u;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw); } catch (_) { reasons.push({ code: 'invalid', level: 2 }); res.verdict = 'suspicious'; return res; }
  res.url = u.href;
  const host = String(u.hostname || '').toLowerCase().replace(/\.$/, '');
  res.host = host;
  res.unicodeHost = hostToUnicode(host);
  res.domain = registrable(host);
  if (!host) { reasons.push({ code: 'invalid', level: 2 }); res.verdict = 'suspicious'; return res; }
  if (u.protocol === 'http:') reasons.push({ code: 'no_https', level: 1 });
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[/.test(host)) reasons.push({ code: 'ip', level: 3 });
  if (u.username || u.password || /@/.test(raw.replace(/^[a-z]+:\/\//i, '').split('/')[0])) reasons.push({ code: 'userinfo', level: 3 });
  if (u.port && u.port !== '80' && u.port !== '443') reasons.push({ code: 'port', level: 1, detail: u.port });
  if (/(^|\.)xn--/.test(host)) {
    reasons.push({ code: 'punycode', level: 2, detail: res.unicodeHost });
    if (hasCyr(res.unicodeHost) && hasLat(res.unicodeHost)) reasons.push({ code: 'mixed', level: 3 });
  } else if (hasCyr(host) && hasLat(host)) reasons.push({ code: 'mixed', level: 3 });
  if ((res.unicodeHost.match(/-/g) || []).length >= 3) reasons.push({ code: 'hyphens', level: 1 });   // по Unicode името (xn-- не се брои)
  if (host.length > 40) reasons.push({ code: 'long', level: 1 });
  const tld = host.split('.').pop();
  if (BAD_TLD.indexOf(tld) > -1) reasons.push({ code: 'tld', level: 1, detail: tld });

  // сравнение с ТВОИТЕ сайтове
  const mine = vaultDomains();
  const myDomain = res.domain;
  const myName = hostToUnicode(myDomain).split('.').slice(0, -1).join('');
  const mySkel = skeleton(myName);
  const seen = new Set();
  const known = mine.some((d) => d.domain === myDomain);   // точно твой сайт → не може да е двойник
  for (const d of mine) {
    if (d.domain === myDomain) { res.matches.push(d.entry); continue; }
    if (known) continue;
    if (seen.has(d.domain)) continue; seen.add(d.domain);
    const theirName = d.domain.split('.').slice(0, -1).join('');
    const theirSkel = skeleton(theirName);
    const base = d.base;
    if (base.length < 3) continue;
    if (theirSkel && theirSkel === mySkel) {
      // същото име, друг домейн от първо ниво (paypal.co) = „много прилича"; различни знаци със същия скелет = двойник
      reasons.push({ code: theirName === myName ? 'similar' : 'lookalike', level: theirName === myName ? 2 : 3, detail: d.domain, entry: d.entry });
      continue;
    }
    const dist = levenshtein(theirSkel, mySkel);
    if (theirSkel.length >= 5 && (dist === 1 || (theirSkel.length >= 9 && dist === 2))) { reasons.push({ code: 'similar', level: 2, detail: d.domain, entry: d.entry }); continue; }
    // марката като поддомейн на чужд домейн: paypal.com.evil.net / paypal.evil.net
    const labels = host.split('.');
    const regLabels = myDomain.split('.').length;
    const subLabels = labels.slice(0, labels.length - regLabels);
    if (subLabels.some((lb) => skeleton(lb) === skeleton(base))) { reasons.push({ code: 'brand_sub', level: 3, detail: d.domain, entry: d.entry }); continue; }
    // марката вградена в чуждо име: paypal-login.net, secure-paypal.com
    if (mySkel.indexOf(skeleton(base)) > -1 && skeleton(base).length >= 4) reasons.push({ code: 'brand_in', level: 2, detail: d.domain, entry: d.entry });
  }
  const maxLevel = reasons.reduce((m, r) => Math.max(m, r.level), 0);
  res.verdict = maxLevel >= 3 ? 'danger' : maxLevel >= 2 ? 'suspicious' : known ? 'known' : maxLevel === 1 ? 'suspicious' : 'ok';
  res.known = known;
  res.vaultCount = mine.length;
  return res;
}
