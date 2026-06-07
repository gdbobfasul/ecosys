// Генерира public/shared/js/app-domains.js от ЕДИНСТВЕНИЯ източник private/configs/domains.conf.
// Целта: кръстосаните линкове между апове (напр. бутон „Чат" на главния домейн) да сочат
// към ОТДЕЛНИЯ домейн на апа (gofor.dateeasily.com / find.jwork.ru / look.myhousesetup.com),
// а НЕ към <главен-домейн>/chat/. А когато сме ВЕЧЕ на домейна на апа — линковете към
// СЪЩИЯ ап остават недокоснати (релативни спрямо този домейн). Нула хардкоднат домейн.
//
// Пускане:  node scripts/build-app-domains.js
// ⚠️ Пусни го след всяка промяна на APP_*_PUBLIC / APP_*_DIR / APP_*_FS / APP_DOMAIN_MAP.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONF = path.join(ROOT, 'private', 'configs', 'domains.conf');
const OUT = path.join(ROOT, 'public', 'shared', 'js', 'app-domains.js');

const raw = fs.readFileSync(CONF, 'utf8');

function val(key) {
  const m = raw.match(new RegExp('^\\s*' + key + '="([^"]*)"', 'm'));
  return m ? m[1] : '';
}
function firstSeg(p) {
  const seg = String(p).replace(/^\/+/, '').split('/')[0];
  return seg ? '/' + seg + '/' : '';
}

// Всички домейни на всеки ключ (за да знаем „на кой ап сме").
//   APP_DOMAIN_MAP="\n<домейн> <ключ>\n..."
const hostsByKey = {};
String(val('APP_DOMAIN_MAP') || raw.match(/APP_DOMAIN_MAP="([\s\S]*?)"/)?.[1] || '')
  .split('\n').forEach(function (line) {
    const parts = line.trim().split(/\s+/);
    if (parts.length === 2 && parts[0] && parts[1]) {
      (hostsByKey[parts[1]] = hostsByKey[parts[1]] || []).push(parts[0]);
    }
  });

// Апове с КАНОНИЧЕН публичен домейн (APP_<key>_PUBLIC) → правим запис.
const KEYS = ['chat', 'wnb', 'hlb', 'eco3', 'portals'];
const apps = {};
for (const k of KEYS) {
  const domain = val('APP_' + k + '_PUBLIC');
  if (!domain) continue;
  const dir = val('APP_' + k + '_DIR');            // напр. /chat/public/  ·  /wherenobiz/
  const fsName = val('APP_' + k + '_FS');          // дискова папка: chat/public · WhereNoBiz
  const prefixes = [];
  const p1 = firstSeg(dir);   if (p1) prefixes.push(p1);                 // /chat/ · /wherenobiz/
  const p2 = firstSeg(fsName); if (p2 && p2 !== p1) prefixes.push(p2);   // алиас: /WhereNoBiz/
  apps[k] = {
    domain: domain,
    hosts: hostsByKey[k] || [],
    prefixes: prefixes,
    dir: dir || p1,                                  // уеб-коренът на апа (за махане на префикса)
    nested: /public\/?$/.test(dir)                   // chat: _DIR свършва на public/ → вложен
  };
}

const banner =
  '// ⚠️ АВТО-ГЕНЕРИРАН от private/configs/domains.conf чрез scripts/build-app-domains.js.\n' +
  '// НЕ редактирай ръчно — смени domains.conf и пусни генератора пак.\n';

const body = `${banner}(function () {
  'use strict';
  var APPS = ${JSON.stringify(apps, null, 2)};
  window.KCY_APP_DOMAINS = APPS;

  // На кой ап (ключ) принадлежи текущият домейн? null = главният (или непознат) домейн.
  var HOST = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '';
  var CURRENT = null;
  for (var k in APPS) { if (APPS[k].hosts.indexOf(HOST) !== -1) { CURRENT = k; break; } }

  function strip(p, pre) { var r = p.slice(pre.length - 1); return r.charAt(0) === '/' ? r : '/' + r; }

  // Връща пълен адрес към отделния домейн, ИЛИ null, ако пътят не е кръстосан линк
  // (т.е. сочи към ап без отделен домейн, или към СЪЩИЯ ап, на чийто домейн сме вече).
  function mapPath(p) {
    if (!p || p.charAt(0) !== '/') return null;
    for (var key in APPS) {
      var a = APPS[key];
      for (var i = 0; i < a.prefixes.length; i++) {
        var pre = a.prefixes[i];
        if (p !== pre && p.indexOf(pre) !== 0) continue;
        if (key === CURRENT) return null;            // същият ап, същият домейн → остави релативно
        if (a.nested) {
          // Вложен ап (chat): домейнът има същите alias-и (/chat/, /chat/public/),
          // затова пазим пътя — но входът (/chat/ или _DIR) сочи към корена на домейна.
          var noSlash = a.dir.replace(/\\/$/, '');
          if (p === pre || p === pre.replace(/\\/$/, '') || p === a.dir || p === noSlash) {
            return 'https://' + a.domain + '/';
          }
          if (p.indexOf(a.dir) === 0) return 'https://' + a.domain + '/' + p.slice(a.dir.length);
          return 'https://' + a.domain + p;
        }
        // Невложен ап (wnb/hlb): на отделния домейн е на КОРЕНА → махаме префикса.
        return 'https://' + a.domain + strip(p, pre);
      }
    }
    return null;
  }
  window.kcyAppUrl = mapPath;

  // Пренаписва наличните линкове (<a href> и <option value> в навигацията). Идемпотентно.
  function rewrite(rootEl) {
    var root = rootEl || document;
    var anchors = root.querySelectorAll('a[href^="/"]:not([data-xapp])');
    for (var i = 0; i < anchors.length; i++) {
      var u = mapPath(anchors[i].getAttribute('href'));
      if (u) { anchors[i].setAttribute('href', u); }
      anchors[i].setAttribute('data-xapp', '1');
    }
    var opts = root.querySelectorAll('option[value^="/"]:not([data-xapp])');
    for (var j = 0; j < opts.length; j++) {
      var v = mapPath(opts[j].getAttribute('value'));
      if (v) { opts[j].value = v; }
      opts[j].setAttribute('data-xapp', '1');
    }
  }
  window.kcyRewriteCrossAppLinks = rewrite;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { rewrite(); });
  } else { rewrite(); }
})();
`;

fs.writeFileSync(OUT, body, 'utf8');
console.log('✓ app-domains.js генериран. Апове с отделен домейн: ' +
  Object.keys(apps).map(function (k) {
    return k + '→' + apps[k].domain + (apps[k].nested ? ' (вложен)' : '');
  }).join(', '));
