// Version: 1.0001
// HMM — Ранг листа (leaderboard), локална, ТОП 100.
//
// ПОВЕРИТЕЛНОСТ: пази САМО { name, score } — нула контакти, нула id,
// нула телефони, нула лични данни извън свободно въведеното от играча име.
// Всичко е на устройството, СИНХРОННО през localStorage. БЕЗ мрежа, БЕЗ
// сървър, БЕЗ динамичен import('@capacitor/...') (той чупи boot-а в WebView).
//
// API (синхронно):
//   addScore(name, score) -> { rank, total }   // вмъква, сортира, реже до 100
//   getTop(n = 100)       -> [{ name, score }] // намаляващо по точки
//   lastName()            -> string            // последно използваното име
//   setLastName(name)     -> void              // запомня името за следващия път
//
// Излага се като window.HMMLeaderboard (vanilla — без bundler зависимости).
(function (global) {
'use strict';

var SCORES_KEY = 'hmm-leaderboard';   // localStorage ключ за резултатите
var NAME_KEY = 'hmm-last-name';       // localStorage ключ за последно име
var MAX_ROWS = 100;                   // ТОП 100 — режем над толкова

// чете масива от localStorage (синхронно). Връща [] при липса/повреда.
function _read() {
    try {
        var raw = global.localStorage.getItem(SCORES_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        // пречистваме до точно { name, score } — без чужди полета
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var r = arr[i] || {};
            out.push({
                name: String(r.name == null ? '' : r.name).slice(0, 24),
                score: Math.max(0, Math.round(Number(r.score) || 0))
            });
        }
        return out;
    } catch (e) {
        return [];
    }
}

// пише масива в localStorage (синхронно). Тих провал (напр. quota).
function _write(arr) {
    try {
        global.localStorage.setItem(SCORES_KEY, JSON.stringify(arr));
    } catch (e) { /* localStorage недостъпен/пълен — пропускаме тихо */ }
}

// сортира намаляващо по точки (стабилно: равни точки запазват реда на влизане)
function _sortDesc(arr) {
    return arr.slice().sort(function (a, b) { return b.score - a.score; });
}

// Вмъкване на резултат, преизчисляване на класирането, рязане до ТОП 100.
// Връща { rank, total }:
//   rank  — мястото (1-базирано) на ТОЗИ запис в подредената листа
//   total — общ брой записи (след рязане до 100)
function addScore(name, score) {
    var clean = String(name == null ? '' : name).slice(0, 24).trim() || 'Играч';
    var pts = Math.max(0, Math.round(Number(score) || 0));
    var entry = { name: clean, score: pts };

    var arr = _read();
    arr.push(entry);
    var sorted = _sortDesc(arr);
    if (sorted.length > MAX_ROWS) sorted = sorted.slice(0, MAX_ROWS);
    _write(sorted);

    // намери мястото на точно този запис (по референция след сортирането)
    var rank = sorted.indexOf(entry) + 1;
    if (rank < 1) {
        // записът е изпаднал извън ТОП 100 (по-слаб от 100-тия) —
        // мястото му е след последния запазен
        rank = sorted.length + 1;
    }
    return { rank: rank, total: sorted.length };
}

// ТОП-N (по подразбиране 100), сортиран намаляващо по точки.
function getTop(n) {
    if (n == null) n = MAX_ROWS;
    return _sortDesc(_read()).slice(0, n);
}

// Последно използваното име (за дефолт в полето за въвеждане).
function lastName() {
    try {
        return String(global.localStorage.getItem(NAME_KEY) || '').slice(0, 24);
    } catch (e) {
        return '';
    }
}

// Запомня името за следващия път.
function setLastName(name) {
    try {
        global.localStorage.setItem(NAME_KEY, String(name == null ? '' : name).slice(0, 24).trim());
    } catch (e) { /* тих провал */ }
}

global.HMMLeaderboard = {
    addScore: addScore,
    getTop: getTop,
    lastName: lastName,
    setLastName: setLastName
};

})(window);
