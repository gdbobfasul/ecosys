// Version: 1.0025
// audit.js — „Одит на сигурността" (11.09.2026, Huawei 4.1). За ВСЯКА парола в сейфа:
//   • пробив — HIBP k-анонимност (навън отиват САМО 5 знака от SHA-1 хеша; отговорът е списък
//     със суфикси и се сравнява НА УСТРОЙСТВОТО). ВЕДНЪЖ на пускане на апа (кеш в паметта);
//     без връзка → „прескочена", одитът пак работи офлайн за всичко останало;
//   • сила — дължина, видове знаци, последователности/повторения, списък с чести пароли,
//     съдържа ли логина/сайта;
//   • повторена — същата парола в друг запис;
//   • има ли 2FA код за същия сайт (сравнение с таба „Authenticator");
//   • възраст — по at/pwAt на записа (над 365 дни = стара).
// Резултат: оценка на запис (0–100), обща оценка, план за действие (подредени поправки).
import { session } from './storage.js';
import { getText, isOnline } from './net.js';

// Най-честите пароли от публичните изтичания (малък вграден списък — офлайн проверка).
const COMMON = ['123456','password','12345678','qwerty','123456789','12345','1234','111111','1234567','dragon','123123',
  'baseball','abc123','football','monkey','letmein','shadow','master','666666','qwertyuiop','123321','mustang','1234567890',
  'michael','654321','superman','1qaz2wsx','7777777','121212','000000','qazwsx','123qwe','killer','trustno1','jordan',
  'jennifer','zxcvbnm','asdfgh','hunter','buster','soccer','harley','batman','andrew','tigger','sunshine','iloveyou',
  'charlie','robert','thomas','hockey','ranger','daniel','starwars','klaster','112233','george','computer','michelle',
  'jessica','pepper','1111','zxcvbn','555555','11111111','131313','freedom','777777','pass','maggie','159753','aaaaaa',
  'ginger','princess','joshua','cheese','amanda','summer','love','ashley','nicole','chelsea','biteme','matthew','access',
  'yankees','987654321','dallas','austin','thunder','taylor','matrix','welcome','admin','password1','qwerty123','parola',
  'пароль','123456a','a123456','secret','test','user','root','login','letmein1','welcome1','admin123','abcd1234','passw0rd',
  'p@ssw0rd','iloveyou1','sunshine1','princess1','football1','monkey1','qwerty1','password123','12341234','1q2w3e4r',
  'qwe123','asdf1234','zaq12wsx','1qazxsw2','q1w2e3r4','abc12345','password!','hello123','baseball1'];
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'abcdefghijklmnopqrstuvwxyz', 'йцукенгшщзхъ', 'фывапролджэ'];

// ---------- сила на паролата ----------
// Връща { level 0..4, bits, issues[] } — issues са кодове за i18n (audit_issue_*).
export function passwordStrength(pw, ctx) {
  const s = String(pw || '');
  const issues = [];
  if (!s) return { level: 0, bits: 0, issues: ['short'] };
  const lower = s.toLowerCase();
  if (s.length < 8) issues.push('short');
  const classes = [/[a-zа-яё]/i.test(s), /[A-ZА-ЯЁ]/.test(s) && /[a-zа-яё]/.test(s), /\d/.test(s), /[^\w\s]|_/.test(s)].filter(Boolean).length;
  if (classes <= 1) issues.push('classes');
  if (COMMON.indexOf(lower) > -1 || COMMON.indexOf(lower.replace(/[^a-zа-я0-9]/g, '')) > -1) issues.push('common');
  // последователности по клавиатурата/азбуката и повторения (aaa, abab)
  let seq = false;
  for (const row of KEY_ROWS) {
    for (let i = 0; i + 4 <= lower.length && !seq; i++) {
      const part = lower.slice(i, i + 4);
      if (row.indexOf(part) > -1 || row.split('').reverse().join('').indexOf(part) > -1) seq = true;
    }
    if (seq) break;
  }
  if (!seq && (/(.)\1\1/.test(lower) || /(..)\1\1/.test(lower))) seq = true;
  if (seq) issues.push('seq');
  // съдържа логина или името на сайта
  const hints = [];
  if (ctx && ctx.login) hints.push(String(ctx.login).split('@')[0]);
  if (ctx && ctx.site) hints.push(String(ctx.site).split('.')[0]);
  if (ctx && ctx.title) hints.push(String(ctx.title));
  for (const hnt of hints) { const x = String(hnt || '').toLowerCase().trim(); if (x.length >= 3 && lower.indexOf(x) > -1) { issues.push('login'); break; } }
  // ентропия (груба): дължина × log2(големина на азбуката)
  let alphabet = 0;
  if (/[a-z]/.test(s)) alphabet += 26; if (/[A-Z]/.test(s)) alphabet += 26; if (/\d/.test(s)) alphabet += 10;
  if (/[^\w\s]|_/.test(s)) alphabet += 33; if (/[а-яё]/i.test(s)) alphabet += 33; if (/[^\x00-\x7F]/.test(s) && !/[а-яё]/i.test(s)) alphabet += 50;
  let bits = Math.round(s.length * Math.log2(alphabet || 2));
  if (issues.indexOf('common') > -1) bits = Math.min(bits, 10);
  if (issues.indexOf('seq') > -1) bits = Math.round(bits * 0.6);
  if (issues.indexOf('login') > -1) bits = Math.round(bits * 0.7);
  let level = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  if (issues.indexOf('common') > -1) level = 0;
  return { level, bits, issues };
}

// Хост без протокол/www от запис-парола (за 2FA съпоставка и адресната проверка).
export function siteOf(p) {
  const u = String((p && (p.url || p.title)) || '');
  try { return new URL(/^[a-z]+:\/\//i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (_) { return u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase(); }
}
function baseLabel(host) {
  const parts = String(host || '').split('.').filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  const sld = parts[parts.length - 2];
  if (parts.length >= 3 && /^(co|com|org|net|gov|edu|ac)$/.test(sld) && parts[parts.length - 1].length === 2) return parts[parts.length - 3];
  return sld;
}

// Има ли 2FA запис за същия сайт/услуга (по издател/акаунт срещу домейна или заглавието).
export function has2FAFor(p) {
  const site = siteOf(p);
  const base = baseLabel(site);
  const title = String((p && p.title) || '').toLowerCase().replace(/^пример:\s*|^sample:\s*/i, '').trim();
  return (session.entries || []).some((e) => {
    const iss = String(e.issuer || '').toLowerCase().replace(/\s+/g, '');
    const acc = String(e.account || '').toLowerCase();
    if (base && base.length >= 3 && (iss.indexOf(base) > -1 || acc.indexOf(site) > -1)) return true;
    if (title && title.length >= 3 && iss && (iss.indexOf(title.replace(/\s+/g, '')) > -1 || title.replace(/\s+/g, '').indexOf(iss) > -1)) return true;
    return false;
  });
}

// ---------- HIBP k-анонимност (ВЕДНЪЖ на пускане) ----------
const rangeCache = new Map();      // префикс(5) → Map(суфикс → брой)   (живее до затваряне на апа)
let breachMode = null;             // 'online' | 'offline' — състоянието от последното пускане
export function breachStatus() { return breachMode; }

async function sha1Hex(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
async function fetchRange(prefix) {
  if (rangeCache.has(prefix)) return rangeCache.get(prefix);
  const txt = await getText('https://api.pwnedpasswords.com/range/' + prefix, 12000);
  const map = new Map();
  String(txt || '').split(/\r?\n/).forEach((line) => {
    const i = line.indexOf(':'); if (i > 0) map.set(line.slice(0, i).trim().toUpperCase(), parseInt(line.slice(i + 1), 10) || 0);
  });
  rangeCache.set(prefix, map);
  return map;
}
// Проверява списък пароли; връща Map(парола → брой пробиви) или null-стойности при липса на връзка.
async function checkBreaches(passwords) {
  const out = new Map();
  const uniq = Array.from(new Set(passwords.filter(Boolean)));
  if (!uniq.length) return out;
  const hashes = new Map();
  for (const pw of uniq) hashes.set(pw, await sha1Hex(pw));
  const prefixes = Array.from(new Set(Array.from(hashes.values()).map((hx) => hx.slice(0, 5))));
  let anyOk = false, anyFail = false;
  // по 3 паралелни заявки
  for (let i = 0; i < prefixes.length; i += 3) {
    await Promise.all(prefixes.slice(i, i + 3).map(async (pref) => {
      try { await fetchRange(pref); anyOk = true; } catch (_) { anyFail = true; }
    }));
  }
  for (const pw of uniq) {
    const hx = hashes.get(pw); const map = rangeCache.get(hx.slice(0, 5));
    out.set(pw, map ? (map.get(hx.slice(5)) || 0) : null);
  }
  breachMode = anyOk && !anyFail ? 'online' : anyOk ? 'partial' : 'offline';
  return out;
}

// ---------- одитът ----------
let lastResult = null;             // последният резултат (за таблото „Защита")
export function lastAudit() { return lastResult; }

const DAY = 86400000;
export async function runAudit(opts) {
  const pwds = (session.passwords || []).slice();
  const withBreach = !(opts && opts.offline) && isOnline();
  let breaches = new Map();
  if (withBreach && pwds.length) { try { breaches = await checkBreaches(pwds.map((p) => p.password)); } catch (_) { breachMode = 'offline'; } }
  else if (pwds.length) breachMode = 'offline';
  // повторени
  const byPw = new Map();
  pwds.forEach((p) => { if (p.password) byPw.set(p.password, (byPw.get(p.password) || 0) + 1); });
  const now = Date.now();
  const items = pwds.map((p) => {
    const site = siteOf(p);
    const str = passwordStrength(p.password, { login: p.login, site, title: p.title });
    const breached = p.password ? breaches.get(p.password) : 0;   // число | null (непроверено) | undefined
    const breachCount = typeof breached === 'number' ? breached : null;
    const reused = p.password ? (byPw.get(p.password) || 0) : 0;
    const twofa = has2FAFor(p);
    const stamp = p.pwAt || p.at || null;
    const ageDays = stamp ? Math.floor((now - stamp) / DAY) : null;
    const problems = [];
    if (breachCount) problems.push({ code: 'breached', level: 3, n: breachCount });
    if (reused > 1) problems.push({ code: 'reused', level: 2, n: reused });
    if (str.level <= 1) problems.push({ code: 'weak', level: 2, n: str.level });
    if (ageDays != null && ageDays > 365) problems.push({ code: 'old', level: 1, n: ageDays });
    if (!twofa) problems.push({ code: 'no2fa', level: 1 });
    let score = 100;
    if (breachCount) score -= 60;
    if (reused > 1) score -= 20;
    score -= [40, 25, 10, 0, 0][str.level] || 0;
    if (ageDays != null && ageDays > 365) score -= 10;
    if (!twofa) score -= 10;
    score = Math.max(0, Math.min(100, score));
    return { entry: p, site, strength: str, breachCount, reused, twofa, ageDays, problems, score };
  });
  const sum = { breached: 0, weak: 0, reused: 0, no2fa: 0, old: 0 };
  items.forEach((it) => { if (it.breachCount) sum.breached++; if (it.strength.level <= 1) sum.weak++; if (it.reused > 1) sum.reused++; if (!it.twofa) sum.no2fa++; if (it.ageDays != null && it.ageDays > 365) sum.old++; });
  const overall = items.length ? Math.round(items.reduce((a, it) => a + it.score, 0) / items.length) : null;
  // план: най-тежкото първо (пробив → повторена → слаба → стара → без 2FA)
  const plan = [];
  items.forEach((it) => it.problems.forEach((pr) => plan.push({ item: it, code: pr.code, level: pr.level, n: pr.n })));
  plan.sort((a, b) => b.level - a.level || a.item.score - b.item.score);
  const seedsWithPhrase = (session.seeds || []).filter((s) => s.seedPhrase).length;
  lastResult = { at: now, items, overall, sum, plan, breachMode, seedsWithPhrase, twofaCount: (session.entries || []).length };
  return lastResult;
}

export function gradeOf(score) { return score == null ? null : score >= 85 ? 'good' : score >= 60 ? 'mid' : 'bad'; }
