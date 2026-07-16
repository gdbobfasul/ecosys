// Version: 1.0001
/* KCY Ring Clash — локална РАНГ ЛИСТА (leaderboard).
   ВЕРСИЯ: 1.0001

   ПОВЕРИТЕЛНОСТ: пази САМО { name, score } — нула контакти, нула идентификатори,
   нула телефонни номера, нула връзки/релации. Свободно въведено име + точки.
   Изцяло на устройството: БЕЗ сървър, БЕЗ мрежа, БЕЗ събиране на данни.

   СЪХРАНЕНИЕ: СИНХРОННО през localStorage (НЕ IndexedDB, НЕ sql.js, НЕ динамичен
   import('@capacitor/...') — динамичните импорти чупят boot-а в WebView).

   Записва се ТОП 100 (повече от 100 реда се отрязват при запис).

   Излага (side-effect върху window.DuelLeaderboard):
     addScore(name, score) -> { rank, total }   // вмъква, връща мястото (1-базирано) и общия брой
     getTop(n = 100)       -> [{ name, score }] // подреден по точки (намаляващо), първите n
     lastName()            -> string            // последно използваното име (дефолт за полето)
     setLastName(name)     -> void              // запомня името за следващия път
*/
(function (global) {
'use strict';

var SCORES_KEY = 'duel-leaderboard';        // масив [{name, score}]
var NAME_KEY = 'duel-leaderboard-lastname'; // последно използваното име
var MAX_ROWS = 100;

function cleanName(name) {
    var s = String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, 24);
    return s || 'Играч';
}

function cleanScore(score) {
    var n = Math.round(Number(score));
    if (!isFinite(n) || n < 0) n = 0;
    return n;
}

function load() {
    try {
        var raw = localStorage.getItem(SCORES_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        // подсигуряване на формата: само { name, score }
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            if (!r) continue;
            out.push({ name: cleanName(r.name), score: cleanScore(r.score) });
        }
        return out;
    } catch (e) {
        return [];
    }
}

function save(arr) {
    try {
        localStorage.setItem(SCORES_KEY, JSON.stringify(arr));
    } catch (e) { /* storage недостъпен / пълен — просто пропускаме */ }
}

function sortDesc(arr) {
    // по точки намаляващо; стабилно подреждане не е критично за равни резултати
    arr.sort(function (a, b) { return b.score - a.score; });
    return arr;
}

// Вмъква резултат, отрязва до ТОП 100, запазва и връща мястото на ИМЕННО ТОЗИ запис.
function addScore(name, score) {
    var entry = { name: cleanName(name), score: cleanScore(score) };
    var arr = load();
    arr.push(entry);
    sortDesc(arr);
    // отрежи до ТОП 100; ако новият е извън 100, остава с реален ранг (виж по-долу),
    // но в съхранението пазим само първите 100
    var stored = arr.slice(0, MAX_ROWS);
    save(stored);
    setLastName(entry.name);

    // ранг (1-базиран): колко записа имат СТРОГО повече точки + 1
    var better = 0;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i].score > entry.score) better++;
    }
    return { rank: better + 1, total: arr.length };
}

function getTop(n) {
    var limit = (typeof n === 'number' && n > 0) ? n : MAX_ROWS;
    var arr = sortDesc(load());
    return arr.slice(0, limit);
}

function lastName() {
    try {
        var v = localStorage.getItem(NAME_KEY);
        return v ? cleanName(v) : '';
    } catch (e) {
        return '';
    }
}

function setLastName(name) {
    try {
        localStorage.setItem(NAME_KEY, cleanName(name));
    } catch (e) { /* пропускаме */ }
}

global.DuelLeaderboard = {
    addScore: addScore,
    getTop: getTop,
    lastName: lastName,
    setLastName: setLastName
};

})(window);
