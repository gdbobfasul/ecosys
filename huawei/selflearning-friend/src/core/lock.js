// lock.js — ПРОБНО ЗАКЛЮЧВАНЕ за всички приложения.
// Поведение: при първото пускане се запомня времето. След 4 ДНИ приложението се самозаключва —
// покрива се с екран за парола и НЕ се ползва, докато не въведеш вярната парола. Веднъж
// отключено (вярна парола) → остава отключено завинаги на това устройство.
//
// Паролата е ЕДНА за ВСИЧКИ приложения. Сменя се САМО ТУК (PASSWORD) + ребилд на апповете.
//
// ВАЖНО: това е ПРОСТ гейт за тестовата екосистема, а не криптографска защита — логиката е на
// клиента. Триене на данните на приложението нулира 4-дневния брояч (дава нови 4 дни), но не
// „разбива" защитата. Достатъчно за целта (изтичащ пробен период).

const PASSWORD = 'кокошка';                       // ← СМЯНА НА ПАРОЛАТА СТАВА ТУК (+ ребилд)
const LOCK_AFTER_MS = 4 * 24 * 60 * 60 * 1000;     // 4 дни
const K_FIRST = 'kcy.lock.first';                  // времеви печат на първото пускане
const K_OK = 'kcy.lock.ok';                        // „1" = вече отключено (остава отключено)

// Само надписите, нужни за екрана за парола — на 15-те езика на екосистемата.
const T = {
  title: { bg:'Заключено', ru:'Заблокировано', uk:'Заблоковано', en:'Locked', de:'Gesperrt', fr:'Verrouillé', es:'Bloqueado', 'es-MX':'Bloqueado', it:'Bloccato', pt:'Bloqueado', ar:'مقفل', hi:'लॉक है', ja:'ロック中', ky:'Кулпуланган', 'zh-Hant':'已鎖定' },
  prompt: { bg:'Въведи паролата, за да продължиш', ru:'Введите пароль, чтобы продолжить', uk:'Введіть пароль, щоб продовжити', en:'Enter the password to continue', de:'Gib das Passwort ein, um fortzufahren', fr:'Saisis le mot de passe pour continuer', es:'Introduce la contraseña para continuar', 'es-MX':'Ingresa la contraseña para continuar', it:'Inserisci la password per continuare', pt:'Introduz a palavra-passe para continuar', ar:'أدخل كلمة المرور للمتابعة', hi:'जारी रखने के लिए पासवर्ड दर्ज करें', ja:'続けるにはパスワードを入力してください', ky:'Улантуу үчүн сырсөздү киргизиңиз', 'zh-Hant':'輸入密碼以繼續' },
  wrong: { bg:'Грешна парола', ru:'Неверный пароль', uk:'Невірний пароль', en:'Wrong password', de:'Falsches Passwort', fr:'Mot de passe incorrect', es:'Contraseña incorrecta', 'es-MX':'Contraseña incorrecta', it:'Password errata', pt:'Palavra-passe incorreta', ar:'كلمة المرور غير صحيحة', hi:'गलत पासवर्ड', ja:'パスワードが違います', ky:'Сырсөз туура эмес', 'zh-Hant':'密碼錯誤' },
  ok: { bg:'Отключи', ru:'Разблокировать', uk:'Розблокувати', en:'Unlock', de:'Entsperren', fr:'Déverrouiller', es:'Desbloquear', 'es-MX':'Desbloquear', it:'Sblocca', pt:'Desbloquear', ar:'فتح', hi:'अनलॉक करें', ja:'ロック解除', ky:'Кулпуну ачуу', 'zh-Hant':'解鎖' }
};

const CODES = ['bg','ru','uk','en','de','fr','es','es-MX','it','pt','ar','hi','ja','ky','zh-Hant'];

// Намира избрания език на приложението (всеки ап го пази под свой ключ) — обхождаме
// localStorage и взимаме първата стойност, която е валиден езиков код. Иначе руски.
function detectLang() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k);
      if (v && CODES.indexOf(v) > -1) return v;
    }
  } catch (e) {}
  return 'ru';
}

function tr(key, lang) { const row = T[key] || {}; return row[lang] || row.ru || row.en || key; }

// Заключено ли е? Първото пускане се записва тук (и НЕ заключва веднага).
function isLocked() {
  try {
    if (localStorage.getItem(K_OK) === '1') return false;
    let first = parseInt(localStorage.getItem(K_FIRST) || '0', 10);
    if (!first || isNaN(first)) {
      first = Date.now();
      try { localStorage.setItem(K_FIRST, String(first)); } catch (e) {}
      return false;
    }
    return (Date.now() - first) >= LOCK_AFTER_MS;
  } catch (e) { return false; }
}

function renderLockScreen() {
  const lang = detectLang();
  const host = document.body || document.documentElement;
  if (!host || document.getElementById('kcy-lock')) return;

  const ov = document.createElement('div');
  ov.id = 'kcy-lock';
  ov.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  ov.setAttribute('style', 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;' +
    'background:#0b1220;color:#eef2f8;display:flex;align-items:center;justify-content:center;' +
    'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;padding:24px');

  const box = document.createElement('div');
  box.setAttribute('style', 'max-width:360px;width:100%;text-align:center');

  const lock = document.createElement('div');
  lock.setAttribute('style', 'font-size:62px;line-height:1');
  lock.textContent = '🔒';

  const h = document.createElement('h1');
  h.setAttribute('style', 'font-size:22px;margin:12px 0 6px');
  h.textContent = tr('title', lang);

  const p = document.createElement('p');
  p.setAttribute('style', 'color:#9fb0c8;font-size:14px;margin:0 0 16px;line-height:1.5');
  p.textContent = tr('prompt', lang);

  const inp = document.createElement('input');
  inp.type = 'password'; inp.autocapitalize = 'none'; inp.autocomplete = 'off'; inp.autocorrect = 'off';
  inp.setAttribute('style', 'width:100%;padding:13px;border-radius:12px;border:1px solid #243049;' +
    'background:#141c2e;color:#fff;font-size:16px;text-align:center;outline:none');

  const msg = document.createElement('div');
  msg.setAttribute('style', 'color:#ff5b5b;font-size:13px;min-height:18px;margin:8px 0');

  const btn = document.createElement('button');
  btn.setAttribute('style', 'width:100%;padding:13px;border:none;border-radius:12px;background:#0a84ff;' +
    'color:#fff;font-size:15px;font-weight:600;cursor:pointer');
  btn.textContent = tr('ok', lang);

  function tryUnlock() {
    if (inp.value === PASSWORD) {
      try { localStorage.setItem(K_OK, '1'); } catch (e) {}
      try { location.reload(); } catch (e) { ov.remove(); }
    } else {
      msg.textContent = tr('wrong', lang);
      inp.value = ''; try { inp.focus(); } catch (e) {}
    }
  }
  btn.addEventListener('click', tryUnlock);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); });

  box.appendChild(lock); box.appendChild(h); box.appendChild(p);
  box.appendChild(inp); box.appendChild(msg); box.appendChild(btn);
  ov.appendChild(box);
  host.appendChild(ov);
  setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
}

// Извиква се НАЙ-ОТГОРЕ в main.js на всеки ап. Ако е заключено — рисува екрана за парола и
// СПИРА приложението (хвърля грешка, за да не продължи инициализацията под покривния екран).
export function enforceLock() {
  if (!isLocked()) return;
  renderLockScreen();
  throw new Error('kcy-locked');   // спира по-нататъшната инициализация на приложението
}
