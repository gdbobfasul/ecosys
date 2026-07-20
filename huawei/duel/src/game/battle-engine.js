/* Pupikes Portals — Battle Engine v2 (DOM + WebM с alpha)
   Version: 1.0001

   Походова битка с реални видео анимации (вместо canvas рисуване).

   Конфигурация:
     container     — DIV елементът, в който се рендерира играта (вместо canvas)
     slug          — за integrirana ranking система (ако липсва: standalone)
     title         — заглавие
     levels        — брой нива (default 10)
     teamSize      — 1 (дуел) или 3 (отбор)
     heroPool      — масив дефиниции (от BATTLE_HEROES)
     fieldWidth    — вътрешна координатна ширина (1280 за Duel, 1920 за HMM)
     fieldHeight   — вътрешна координатна височина (960 за Duel, 2560 за HMM)
     mode          — 'Duel' или 'HMM' (определя пътя към анимациите)
     assetsPath    — relative path към animations папката (default 'assets/animations/')
     standalone    — true → без API заявки за ranking

   Скалирането: вътрешното поле е с фиксирани размери; CSS transform: scale()
   го напасва в контейнера, запазвайки aspect ratio (letterbox).

   Правилата:
     V/B — обикновени удари (melee=0-10%, magic=10-20% от макс HP)
     Скрита 4-буквена комбинация (от q w e r a s) — специален удар (30-40%)
     Магьосникът има 2 комбинации (2 specials)
     Комбинациите се генерират ВЕДНЪЖ при старт на играта (не на ниво)
*/
(function (global) {
'use strict';

// ── Преводен слой ──
// main.js слага window.DuelI18n преди да зареди този модул. Тук използваме малки
// обвивки, които пращат към него; ако (по някаква причина) липсва, връщаме ключа.
function I18N() { return (typeof global !== 'undefined' && global.DuelI18n) || null; }
function t(key) { var i = I18N(); return i ? i.t(key) : key; }
function tf() { var i = I18N(); return i ? i.tf.apply(i, arguments) : (arguments[0] || ''); }
// Преведено име на герой (чете се от i18n, не от battle-heroes.js).
function heroName(unit) {
    var i = I18N();
    if (i && unit && unit.def) return i.t('hero_' + unit.def.id);
    return (unit && unit.name) || '';
}
// Преведено име на ход/специал по дефиниция на героя.
function moveName(def, move) {
    var i = I18N();
    if (i && def && move) return i.t('move_' + def.id + '_' + move.key);
    return (move && move.name) || '';
}
function specialName(def, idx) {
    var i = I18N();
    if (i && def) return i.t('spec_' + def.id + '_' + idx);
    var sp = (def && def.specials || [])[idx];
    return (sp && sp.name) || ('спец' + (idx + 1));
}

// Cache-busting за анимациите. Смяна на тази стойност = браузърите теглят
// видеата наново (без нужда от hard refresh). Бутай я при всяко ново качване на assets.
var ASSET_V = '?v=20260607';

var MOVE_KEYS = ['v', 'b'];
// щети, които ОБЕЗДВИЖВАТ целта за следващия ѝ ход (корени/лед/ток)
var IMMOBILIZE = ['roots', 'iceblocks', 'electricity'];
// 9 възможни клавиша; всеки герой получава СВОИ 6 (различни), а комбото е 4 от тях
var COMBO_ALPHABET = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f'];
var KEYS_PER_HERO = 6;
// физически клавиши → буква (за да работи при кирилица и всяка подредба)
var CODE_MAP = { KeyV: 'v', KeyB: 'b', KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r', KeyT: 't', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyF: 'f' };
// обратното — за да питаме коя буква стои на физическия клавиш в подредбата на играча
var LETTER_TO_CODE = { v: 'KeyV', b: 'KeyB', q: 'KeyQ', w: 'KeyW', e: 'KeyE', r: 'KeyR', t: 'KeyT', a: 'KeyA', s: 'KeyS', d: 'KeyD', f: 'KeyF' };

function pickRandom(arr, n) {
    var copy = arr.slice(), out = [];
    for (var i = 0; i < n && copy.length; i++) {
        out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
}

function rollDamage(target, kind) {
    var pct;
    if (kind === 'special') pct = 0.30 + Math.random() * 0.10;       // 30-40%
    else if (kind === 'magic') pct = 0.10 + Math.random() * 0.10;    // 10-20%
    else pct = 0.00 + Math.random() * 0.10;                          // 0-10% (melee)
    return Math.max(1, Math.round(target.maxHp * pct));
}

/* ── BattleEngine ── */
function BattleEngine(opts) {
    this.container = opts.container;
    this.slug = opts.slug || null;
    this.standalone = opts.standalone || !this.slug;
    this.title = opts.title || 'Битка';
    this.maxLevels = opts.levels || 10;
    this.teamSize = opts.teamSize || 1;
    this.heroPool = opts.heroPool;
    this.W = opts.fieldWidth || 1280;
    this.H = opts.fieldHeight || 960;
    this.mode = opts.mode || (this.teamSize === 1 ? 'Duel' : 'HMM');
    this.assetsPath = (opts.assetsPath || 'assets/animations/').replace(/\/+$/, '') + '/';
    this.bgImage = opts.bgImage || null;  // статичен JPEG постер на терена (instant + fallback)
    this.bgScene = opts.bgScene || null;  // жив анимиран терен: 1 = гора (duel), 2 = на терен

    this.state = 'menu';   // menu | playing | levelup | over
    this.level = 1;
    this.score = 0;
    this.bestLevel = 1;
    this.bestScore = 0;
    this.heroCombos = {};  // { heroId: [['q','w','e','r'], ...] }
    this.heroKeys = {};    // { heroId: [6 клавиша] } — различни за всеки герой
    this.comboInput = [];
    this.discovered = {};  // { heroId: {0:true} } — открити комбинации → бутони за спец удар
    this.turnOrder = [];
    this.turnIdx = 0;
    this.anim = null;
    this.msg = '';
    this.selTarget = 0;     // индекс на избрания противник (между живите)
    this._idleTimer = null;

    // admin debug (логовете отляво/отдясно + LOG): показва се при ?adm=bgmasters-set,
    // ?debug=1, opts.debug, ИЛИ когато сесията вече е разпозната като админска
    // (sessionStorage kcy-adm — слага се от navigation.js при админ IP). Допълнително
    // по-долу има async проверка по IP, която пали панелите дори без тези условия.
    this.debug = !!opts.debug || /[?&](adm=bgmasters-set|debug=1)\b/.test(
        (global.location && global.location.search) || '');
    if (!this.debug) {
        try { if (sessionStorage.getItem('kcy-adm') === 'bgmasters-set') this.debug = true; } catch (e) {}
    }
    this._logLines = [];
    this._idleLogged = {};   // idle файлове логнати веднъж за играта
    this._lastLogged = null; // последно логнат файл (за дедуп на последователни)

    this._buildDOM();
    this._fitArena();
    this._enableDebugIfAdmin(); // async: пали логовете за админ дори без URL параметър
    var self = this;
    global.addEventListener('resize', function () { self._fitArena(); });
}

/* ── DOM конструкция ── */
BattleEngine.prototype._buildDOM = function () {
    var c = this.container;
    c.innerHTML = '';
    c.classList.add('kcy-battle');

    // Inject CSS once
    if (!document.getElementById('kcy-battle-css')) {
        var css = document.createElement('style');
        css.id = 'kcy-battle-css';
        css.textContent = BATTLE_CSS;
        document.head.appendChild(css);
    }

    // wrapper за aspect ratio
    var wrap = document.createElement('div');
    wrap.className = 'kbb-wrap kbb-' + this.mode.toLowerCase();
    if (this.standalone) {
        // Самостоятелно приложение (телефон): ЦЯЛ ЕКРАН — без aspect-кутийка и без
        // max-width, за да не е дребно. Полето се мащабира с „cover" (виж _fitArena),
        // запълва екрана, реже само страничната растителност. Контролите са долу.
        wrap.style.width = '100%';
        wrap.style.height = '100%';
        wrap.style.maxWidth = 'none';
    } else {
        wrap.style.aspectRatio = this.W + '/' + this.H;
    }
    c.appendChild(wrap);

    var stage = document.createElement('div');
    stage.className = 'kbb-stage';
    stage.style.width = this.W + 'px';
    stage.style.height = this.H + 'px';
    wrap.appendChild(stage);

    // ground gradient + background slot (painterly терен ако е подаден bgImage)
    var bg = document.createElement('div');
    bg.className = 'kbb-bg';
    if (this.bgImage) {
        bg.style.backgroundImage = "url('" + this.bgImage + "')";
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundPosition = 'center';
        bg.style.backgroundRepeat = 'no-repeat';
    }
    stage.appendChild(bg);
    // Жив анимиран терен (листа се движат + животни се скитат и изчезват в гората).
    // Всяка игра зарежда своя модул (terrain-duel.js / terrain-fight.js), който
    // излага window.startTerrainBg и пуска СВОЯТА сцена. Без статичен фон.
    if (this.bgScene && typeof window !== 'undefined' && window.startTerrainBg) {
        bg.style.background = '#1a241a';  // тъмна основа докато живият терен се дорисува
        var bgCanvas = document.createElement('canvas');
        bgCanvas.width = this.W; bgCanvas.height = this.H;
        bgCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
        bg.appendChild(bgCanvas);
        try { window.startTerrainBg(bgCanvas); } catch (e) { /* остава тъмната основа */ }
    }

    // героите слой
    var heroes = document.createElement('div');
    heroes.className = 'kbb-heroes';
    stage.appendChild(heroes);

    // ефекти слой (projectiles, частици)
    var fx = document.createElement('div');
    fx.className = 'kbb-fx';
    stage.appendChild(fx);

    // HUD слой
    var hud = document.createElement('div');
    hud.className = 'kbb-hud';
    stage.appendChild(hud);

    // съобщения
    var msg = document.createElement('div');
    msg.className = 'kbb-msg';
    stage.appendChild(msg);

    // ляв горен индикатор (ниво / точки)
    var info = document.createElement('div');
    info.className = 'kbb-info';
    stage.appendChild(info);

    // контроли долу (V/B + комбо/специални клавиши)
    // ВАЖНО: контролите се КАЧВАТ върху wrap-а (НЕ върху stage), за да НЕ ги
    // мащабира transform:scale на полето. Така бутоните остават едри (реални
    // пиксели), независимо колко е смалено полето на малък телефонен екран.
    // Панелът е закотвен НАЙ-ОТДОЛУ, обособено меню, за да може играчът да
    // натиска буквите с палци — включително няколко ЕДНОВРЕМЕННО (multi-touch)
    // за специалните удари/комбинациите.
    var ctrl = document.createElement('div');
    ctrl.className = 'kbb-ctrl';
    wrap.appendChild(ctrl);

    // комбо индикатор (показва натиснатите букви) — също върху wrap, точно над панела
    var combo = document.createElement('div');
    combo.className = 'kbb-combo';
    wrap.appendChild(combo);

    // синя стрелка за избор на цел
    var arrow = document.createElement('div');
    arrow.className = 'kbb-target-arrow';
    arrow.style.display = 'none';
    arrow.innerHTML = '\u25B6';
    fx.appendChild(arrow);

    // overlay за menu/levelup/over
    var ov = document.createElement('div');
    ov.className = 'kbb-overlay';
    stage.appendChild(ov);

    this.els = {
        wrap: wrap, stage: stage, bg: bg, heroes: heroes, fx: fx,
        hud: hud, msg: msg, info: info, ctrl: ctrl, combo: combo, ov: ov,
        arrow: arrow
    };

    // ── admin debug панели ИЗВЪН полето (отляво=съюзници, отдясно=врагове) ──
    if (this.debug) this._buildDebugPanels();
};

// Строи debug панелите (съюзници/врагове/LOG). Изнесено, за да може да се пусне
// и по-късно (когато async проверката по IP разпознае админ след старта).
BattleEngine.prototype._buildDebugPanels = function () {
    if (this.dbg) return; // вече построени
    if (!document.getElementById('kbb-dbg-css')) {
        var dcss = document.createElement('style');
        dcss.id = 'kbb-dbg-css';
        dcss.textContent = BATTLE_DBG_CSS;
        document.head.appendChild(dcss);
    }
    var mkDbg = function (cls, title) {
        var d = document.createElement('div');
        d.className = 'kbb-dbg ' + cls;
        d.innerHTML = '<div class="kbb-dbg-title">' + title + '</div><div class="kbb-dbg-body"></div>';
        document.body.appendChild(d);
        return d;
    };
    var dl = mkDbg('kbb-dbg-left', 'DEBUG · съюзници');
    var dr = mkDbg('kbb-dbg-right', 'DEBUG · врагове');
    var dlog = document.createElement('div');
    dlog.className = 'kbb-dbg kbb-dbg-log';
    dlog.innerHTML = '<div class="kbb-dbg-title">LOG</div><div class="kbb-dbg-body"></div>';
    document.body.appendChild(dlog);
    this.dbg = { left: dl.querySelector('.kbb-dbg-body'),
                 right: dr.querySelector('.kbb-dbg-body'),
                 log: dlog.querySelector('.kbb-dbg-body') };
};

// Async: ако IP-то е админско (но debug още не е пуснат), пали панелите след старта.
// Така логовете се виждат за админ БЕЗ да е нужен URL параметър — както беше преди.
BattleEngine.prototype._enableDebugIfAdmin = function () {
    // Standalone mobile build: no portals backend, no IP-admin probe.
    // Debug panels remain available only via ?debug=1 (вж. конструктора).
    return;
};

/* ── скалиране на полето в контейнера ── */
BattleEngine.prototype._fitArena = function () {
    var w = this.els.wrap.clientWidth;
    var h = this.els.wrap.clientHeight;
    if (!w || !h) return;
    // И самостоятелно (телефон), и вграден в портал → „contain" (Math.min):
    // ЦЯЛОТО поле (1280×960) се побира в екрана, без нищо да се реже встрани или
    // отгоре/отдолу. На телефон в портретен режим това оставя черни ленти горе/долу
    // (letterbox), но боят НЕ излиза извън екрана — точно това искаше играчът.
    // (По-рано standalone ползваше „cover"/Math.max и режеше боя извън кадъра.)
    var s = Math.min(w / this.W, h / this.H);
    this.els.stage.style.setProperty('--s', s); this.els.stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
};

/* ── етикети на клавишите спрямо подредбата на играча (кирилица/китайска и т.н.) ── */
BattleEngine.prototype._loadKeyLabels = function () {
    var self = this;
    this.keyLabels = this.keyLabels || {};
    try {
        if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
            navigator.keyboard.getLayoutMap().then(function (map) {
                for (var letter in LETTER_TO_CODE) {
                    var lbl = map.get(LETTER_TO_CODE[letter]);
                    if (lbl) self.keyLabels[letter] = ('' + lbl).toUpperCase();
                }
                if (self.state === 'playing') self._renderHUD();
            }).catch(function () {});
        }
    } catch (e) {}
};
// какво да ПОКАЖЕМ на играча за даден вътрешен клавиш (спрямо неговата клавиатура)
BattleEngine.prototype._keyLabel = function (letter) {
    return (this.keyLabels && this.keyLabels[letter]) || letter.toUpperCase();
};

/* ── входни събития ── */
BattleEngine.prototype._bind = function () {
    var self = this;
    if (this._bound) return;
    this._bound = true;
    document.addEventListener('keydown', function (e) {
        // Когато фокусът е в текстово поле (напр. въвеждане на име за ранг листата),
        // НЕ прихващаме Space/Enter за старт на игра — оставяме входа да си работи.
        var tgt = e.target;
        if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
        if (self.state === 'menu' || self.state === 'over') {
            if (e.code === 'Space' || e.code === 'Enter') self.startGame();
            return;
        }
        if (self.state === 'levelup') {
            if (e.code === 'Space' || e.code === 'Enter') self.nextLevel();
            return;
        }
        if (self.state !== 'playing' || self.anim) return;
        var actor = self.turnOrder[self.turnIdx];
        if (!actor || actor.side !== 'ally' || !actor.alive) return;
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            self._cycleTarget(e.code === 'ArrowUp' ? -1 : 1);
            e.preventDefault();
            return;
        }
        var k = CODE_MAP[e.code] || (e.key || '').toLowerCase();
        if (MOVE_KEYS.indexOf(k) > -1 || COMBO_ALPHABET.indexOf(k) > -1) self.handleKey(actor, k);
    });
};

/* ── комбинации ── */
BattleEngine.prototype.genCombos = function () {
    this.heroCombos = {};
    this.heroKeys = {};
    this.discovered = {};  // нова игра — нищо още не е открито
    var pool = this.heroPool;
    var usedPools = {};
    function pickN(arr, n) {
        var cp = arr.slice(), out = [];
        for (var i = 0; i < n && cp.length; i++) out.push(cp.splice(Math.floor(Math.random() * cp.length), 1)[0]);
        return out;
    }
    for (var i = 0; i < pool.length; i++) {
        var def = pool[i];
        if (this.heroKeys[def.id]) continue;  // същият герой и в двата pool-а — едни и същи клавиши
        // 6 клавиша за този герой — различни от другите герои
        var keys, pk, tries = 0;
        do { keys = pickN(COMBO_ALPHABET, KEYS_PER_HERO).sort(); pk = keys.join(''); }
        while (usedPools[pk] && ++tries < 60);
        usedPools[pk] = true;
        this.heroKeys[def.id] = keys;
        // комбинации = 4 от тези 6, различни помежду си
        var n = (def.specials || []).length;
        var combos = [], used = {};
        for (var s = 0; s < n; s++) {
            var c, ck, t2 = 0;
            do { c = pickN(keys, 4).sort(); ck = c.join(''); }
            while (used[ck] && ++t2 < 60);
            used[ck] = true;
            combos.push(c);
        }
        this.heroCombos[def.id] = combos;
    }
};

/* ── lifecycle ── */
BattleEngine.prototype.start = function () {
    var self = this;
    this._bind();
    this._loadKeyLabels();
    this.genCombos();
    try {
        console.log('%cKCY Battle v2 (1.0095) — всеки герой: свои 6 клавиша, комбо 4 от тях (произволен ред)',
                    'color:#f8c450;font-weight:bold');
        var cs = {};
        for (var id in this.heroCombos) {
            cs[id] = {
                клавиши: (this.heroKeys[id] || []).join('').toUpperCase(),
                комбо: this.heroCombos[id].map(function (c) { return c.join('').toUpperCase(); })
            };
        }
        console.table ? console.table(cs) : console.log('Клавиши/комбинации:', cs);
    } catch (e) {}
    // Standalone mobile build: no portals backend. Best score is kept locally
    // (вж. saveScore/loadBest по-долу), без мрежови заявки.
    this.loadBest();
    this.drawMenu();
};

/* Local best-score persistence (replaces portals gms API).
   Стои локално на устройството — нула мрежа, нула събиране на данни. */
BattleEngine.prototype._bestKey = 'kcy-duel-best';
BattleEngine.prototype.loadBest = function () {
    try {
        var raw = localStorage.getItem(this._bestKey);
        if (raw) {
            var d = JSON.parse(raw);
            this.bestLevel = d.best_level || 1;
            this.bestScore = d.best_score || 0;
        }
    } catch (e) { /* първи старт / недостъпен storage */ }
};

BattleEngine.prototype.startGame = function () {
    this.level = 1; this.score = 0;
    this.setupLevel();
};

BattleEngine.prototype.nextLevel = function () {
    this.level++;
    if (this.level > this.maxLevels) { this.win(); return; }
    this.setupLevel();
};

BattleEngine.prototype.setupLevel = function () {
    this.comboInput = [];
    this._stopIdleWatch();                 // спри стария watchdog (сочи към изтрити герои)
    if (this.els.heroes) this.els.heroes.innerHTML = '';  // махни DOM-а на героите от предишното ниво
    var hpScale = 1 + (this.level - 1) * 0.18;
    var allyDefs = pickRandom(this.heroPool, this.teamSize);
    var foeDefs = pickRandom(this.heroPool, this.teamSize);

    // координати по teamSize
    var slots = this._slotPositions();
    this.ally = [];
    this.foe = [];
    for (var a = 0; a < allyDefs.length; a++) {
        this.ally.push(this._makeUnit(allyDefs[a], 'ally', slots.left[a], hpScale));
    }
    for (var f = 0; f < foeDefs.length; f++) {
        this.foe.push(this._makeUnit(foeDefs[f], 'foe', slots.right[f], hpScale));
    }

    this.rebuildTurnOrder();
    this.turnIdx = 0;
    this.anim = null;
    this.selTarget = 0;
    this.msg = tf('level_starts', this.level);
    this.state = 'playing';
    this._renderAll();
    this._startIdleWatch();
    if (this.debug) { this._renderDebug(); this._log('— ниво ' + this.level + ' старт —'); }
    var self = this;
    setTimeout(function () { self.advanceTurn(true); }, 600);
};

BattleEngine.prototype._slotPositions = function () {
    // Duel: ляв в (0.25W, 0.66H), десен в (0.75W, 0.66H)
    // HMM: 2 колони по 3 слота — изместени НАДОЛУ, за да не ги застъпват
    //      контролите/бутоните най-горе.
    if (this.teamSize === 1) {
        // 1v1 (Дуел): бойците са вдигнати (0.72 вместо 0.80), за да не ги крие
        // изнесеното най-долу меню с едрите бутони.
        return { left: [{ x: this.W * 0.25, y: this.H * 0.72 }],
                 right: [{ x: this.W * 0.75, y: this.H * 0.72 }] };
    }
    var left = [], right = [];
    var top = 0.46, bottom = 0.92;  // зоната за героите (под панела с бутони)
    for (var i = 0; i < this.teamSize; i++) {
        var t = this.teamSize > 1 ? top + (bottom - top) * (i / (this.teamSize - 1))
                                  : (top + bottom) / 2;
        var y = this.H * t;
        left.push({ x: this.W * 0.25, y: y });
        right.push({ x: this.W * 0.75, y: y });
    }
    return { left: left, right: right };
};

BattleEngine.prototype._makeUnit = function (def, side, pos, hpScale) {
    // широки герои (дракон) се изместват към противника, за да не се крият зад своите
    var shift = (def.slotShiftX || 0) * (side === 'ally' ? 1 : -1);
    var px = pos.x + shift;
    var unit = {
        def: def, side: side, name: def.name, id: def.id,
        x: px, y: pos.y, baseX: px, baseY: pos.y,
        hp: Math.round(def.hp * hpScale),
        maxHp: Math.round(def.hp * hpScale),
        alive: true, frozen: false,
        videoSide: side === 'ally' ? 'left' : 'right',
        animHistory: [],   // последни изпълнени анимации (за debug)
        diesPlayed: false, // die анимацията се пуска точно веднъж
        locked: false,     // в момента изпълнява движение/атака/реакция — да не се idle-ва
    };
    unit.dom = this._buildHeroDOM(unit);
    this._setHeroState(unit, 'idle');
    return unit;
};

/* ── DOM за герой ── */
BattleEngine.prototype._buildHeroDOM = function (unit) {
    var w = unit.def.video.size.width;
    var h = unit.def.video.size.height;

    var box = document.createElement('div');
    box.className = 'kbb-hero kbb-' + unit.side;
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    unit.homeLeft = unit.x - w / 2;
    unit.homeTop = unit.y - h;  // закотвен по подметката
    box.style.left = unit.homeLeft + 'px';
    box.style.top = unit.homeTop + 'px';
    box.dataset.heroId = unit.def.id;

    // два <video> елемента: единият тече, другият зарежда следващото
    var v1 = document.createElement('video');
    v1.className = 'kbb-vid kbb-vid-a';
    v1.muted = true; v1.playsInline = true; v1.preload = 'auto';
    box.appendChild(v1);

    var v2 = document.createElement('video');
    v2.className = 'kbb-vid kbb-vid-b';
    v2.muted = true; v2.playsInline = true; v2.preload = 'auto';
    v2.style.opacity = '0';
    box.appendChild(v2);

    // HP бар над героя
    var hp = document.createElement('div');
    hp.className = 'kbb-hpbar';
    hp.innerHTML = '<span class="kbb-hpfill"></span><span class="kbb-hpname">' + heroName(unit) + '</span>';
    box.appendChild(hp);

    this.els.heroes.appendChild(box);

    return { box: box, vidA: v1, vidB: v2, hp: hp, activeVid: 'a' };
};

/* ── разрешаване на видео файл ── */
BattleEngine.prototype._resolveVideoUrl = function (unit, action) {
    // action: 'idle' | 'walks' | 'attack:<animName>' | 'react:<damageType>'
    var def = unit.def;
    var v = def.video;
    var side = unit.videoSide;
    var prefix = side === 'left' ? 'left' : 'right';

    // папка
    var folder;
    if (action.indexOf('react:') === 0) {
        // damage folder — може да зависи от страната (snakewoman)
        if (typeof v.damageFolder === 'object') {
            folder = v.damageFolder[side] || v.damageFolder.left;
        } else {
            folder = v.damageFolder;
        }
    } else {
        // attack folder — може да зависи от страната (mage left/right)
        if (typeof v.attackFolder === 'object') {
            var key = side + (this.mode === 'HMM' ? '_HMM' : '');
            folder = v.attackFolder[key] || v.attackFolder[side] || v.attackFolder.left;
        } else {
            folder = v.attackFolder;
        }
    }
    folder = folder.replace('{side}', prefix);

    // file base name (може да е различен за damage)
    var fileBase;
    if (action.indexOf('react:') === 0 && typeof v.damageFileBase === 'object') {
        fileBase = v.damageFileBase[side] || v.damageFileBase.left;
    } else {
        fileBase = v.fileBase.replace('{side}', prefix);
    }

    // име на анимацията
    var candidates;
    if (action === 'idle') candidates = v.states.idle;
    else if (action === 'walks') candidates = v.states.walks;
    else if (action.indexOf('attack:') === 0) {
        // може да носи няколко имена (a|b|c) — опитват се по ред (fallback)
        candidates = action.slice(7).split('|');
    } else if (action.indexOf('react:') === 0) {
        var dtype = action.slice(6);
        var reactList = (dtype === 'hit') ? ['hit'] : (v.reactions[dtype] || ['bleeds']);
        candidates = reactList;
    } else {
        candidates = [action];
    }

    // предпазна мрежа: idle/walks никога да не остане празно (иначе героят е „невидим")
    if (action === 'idle' || action === 'walks') {
        var fm = def.moves && def.moves[0];
        if (fm) candidates = candidates.concat(this._resolveAttackAnim(fm.attackAnim, side));
    }

    // върни първия URL — fallback логика се хвърля при error event
    var mode = this.mode;
    var basePath = this.assetsPath;

    // "strange" анимациите се опитват ПОСЛЕДНИ — само ако липсва нормалната
    candidates = candidates.slice().sort(function (a, b) {
        return (a.indexOf('strange') > -1 ? 1 : 0) - (b.indexOf('strange') > -1 ? 1 : 0);
    });

    // ── РЕДУВАНЕ НА ВАРИАНТИ (70% основна / 30% случаен вариант) ──
    // Ако има повече от един вариант (без strange), от време на време пускаме
    // не основната, а друг вариант — за да не е монотонно.
    if (candidates.length > 1) {
        var nonStrange = candidates.filter(function (c) { return c.indexOf('strange') === -1; });
        if (nonStrange.length > 1 && Math.random() < 0.30) {
            var chosen = nonStrange[Math.floor(Math.random() * nonStrange.length)];
            candidates = [chosen].concat(candidates.filter(function (c) { return c !== chosen; }));
        }
    }

    var urls = candidates.map(function (name) {
        var topFolder = action.indexOf('react:') === 0 ? 'die-Damage' : 'Closes-Attacks';
        // ?v=ASSET_VERSION — cache-busting: при ново качване сменяш ASSET_VERSION
        // и браузърът тегли видеата наново (иначе кешира стари и refresh не помага).
        // Път: animations/<игра>/<действие>/<герой>/<файл>.webm  (игра ПРЕДИ действие)
        return basePath + mode + '/' + topFolder + '/' + folder + '/' + fileBase + '-' + name + '.webm' + ASSET_V;
    });

    return urls;  // масив, опитваме по ред
};

/* ── смяна на видео състояние ── */
BattleEngine.prototype._setHeroState = function (unit, action, opts) {
    opts = opts || {};
    var self = this;
    var urls = this._resolveVideoUrl(unit, action);
    var dom = unit.dom;

    // избор на следващото видео element (a/b switch)
    var activeKey = dom.activeVid;
    var nextKey = activeKey === 'a' ? 'b' : 'a';
    var curVid = dom['vid' + activeKey.toUpperCase()];
    var nextVid = dom['vid' + nextKey.toUpperCase()];

    // обърни ако е дясна страна (видеата са насочени към източника на спрайта,
    // а ние позиционираме left/right; правилни видеа са вече side-specific,
    // така че НЕ обръщаме)
    // (left- видеата гледат надясно, right- гледат наляво — точно както трябва)

    nextVid.loop = (action === 'idle' || action === 'walks');
    nextVid.muted = true;

    var tryIdx = 0;
    var tryNext = function () {
        if (tryIdx >= urls.length) {
            // fallback: остави старото видео
            if (opts.onEnd) opts.onEnd();
            return;
        }
        var url = urls[tryIdx++];
        nextVid.onerror = function () { tryNext(); };
        nextVid.oncanplay = function () {
            nextVid.oncanplay = null;
            nextVid.onerror = null;
            // crossfade
            nextVid.style.opacity = '1';
            curVid.style.opacity = '0';
            dom.activeVid = nextKey;

            // запиши в историята (за debug панела)
            var base = url.split('/').pop();
            unit.animHistory.unshift(base);
            if (unit.animHistory.length > 5) unit.animHistory.length = 5;
            unit.curAnim = base;
            // ЛОГ на реалния видео файл, който се изпълнява
            if (self.debug) {
                self._idleLogged = self._idleLogged || {};
                var isIdle = (action === 'idle');
                var isWalk = (action === 'walks');
                if (isIdle) {
                    // idle — само ВЕДНЪЖ за цялата игра, за всеки уникален файл
                    if (!self._idleLogged[base]) { self._idleLogged[base] = true; self._log(base); }
                } else if (isWalk) {
                    // придвижване — логва се ВИНАГИ (на 100%, без дедуп), с маркер 🚶
                    self._log('🚶 ' + base);
                } else if (self._lastLogged !== base) {
                    // останалите — без последователни дубли на същия файл
                    self._log(base);
                }
                if (!isIdle && !isWalk) self._lastLogged = base;
                self._renderDebug();
            }

            if (opts.onPlay) opts.onPlay(nextVid);

            if (!nextVid.loop && opts.onEnd) {
                nextVid.onended = function () { opts.onEnd(); };
            }
        };
        nextVid.src = url;
        nextVid.play().catch(function () { /* autoplay може да гръмне първия път */ });
    };
    tryNext();
};

/* ── ред на ходовете ── */
BattleEngine.prototype.rebuildTurnOrder = function () {
    // Разбъркваме всеки отбор поотделно, после ГИ ПРЕПЛИТАМЕ (ally, foe, ally, foe…),
    // за да не играе един и същи отбор два пъти подред (причина за "double turn" бъга).
    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
    }
    var allies = shuffle(this.ally.filter(function (u) { return u.alive; }));
    var foes = shuffle(this.foe.filter(function (u) { return u.alive; }));
    var order = [];
    var maxLen = Math.max(allies.length, foes.length);
    for (var k = 0; k < maxLen; k++) {
        if (k < allies.length) order.push(allies[k]);
        if (k < foes.length) order.push(foes[k]);
    }
    this.turnOrder = order;
};

BattleEngine.prototype.advanceTurn = function (first) {
    var self = this;
    if (this.checkEnd()) return;
    if (!first) this.turnIdx++;
    this._turnCounter = (this._turnCounter || 0) + 1; // глобален брояч на ходовете (за special cooldown)
    if (this.turnIdx >= this.turnOrder.length) {
        this.rebuildTurnOrder();
        this.turnIdx = 0;
    }
    var actor = this.turnOrder[this.turnIdx];
    if (!actor || !actor.alive) { this.advanceTurn(false); return; }

    // замразен пропуска
    if (actor.frozen) {
        actor.frozen = false;
        this.msg = tf('immobilized', heroName(actor));
        this._renderHUD();
        setTimeout(function () { self.advanceTurn(false); }, 1200);
        return;
    }

    this.comboInput = [];
    this._comboMiss = false;
    this._renderHUD();

    if (actor.side === 'foe') {
        // AI: случайно избира ход (V/B) или special с 25% шанс
        setTimeout(function () { self.foeAct(actor); }, 600);
    }
};

/* ── обработка на натискания ── */
BattleEngine.prototype.handleKey = function (actor, key) {
    if (MOVE_KEYS.indexOf(key) > -1) {
        var move = null;
        for (var i = 0; i < actor.def.moves.length; i++) {
            if (actor.def.moves[i].key === key) { move = actor.def.moves[i]; break; }
        }
        if (move) { this.doMove(actor, move); }
        return;
    }
    // combo — броим само клавишите от 6-те на този герой
    var myKeys = this.heroKeys[actor.id] || COMBO_ALPHABET;
    if (myKeys.indexOf(key) === -1) return;  // клавиш извън 6-те на героя — игнор
    this.comboInput.push(key);
    var combos = this.heroCombos[actor.id] || [];
    try {
        console.log('combo клавиш:', key.toUpperCase(),
                    '| буфер(посл.4):', this.comboInput.slice(-4).join('').toUpperCase(),
                    '| цел за', actor.name + ':', combos.map(function (c) { return c.join('').toUpperCase(); }).join(' или '));
    } catch (e) {}
    // проверка дали последните 4 съвпадат с някоя комбинация
    if (this.comboInput.length >= 4) {
        // редът на натискане НЯМА значение — сравняваме наборите (азбучно подредени)
        var last4 = this.comboInput.slice(-4).slice().sort().join('');
        for (var c = 0; c < combos.length; c++) {
            if (combos[c].slice().sort().join('') === last4) {
                this.comboInput = [];
                this._comboMiss = false;
                var first = !(this.discovered[actor.id] && this.discovered[actor.id][c]);
                (this.discovered[actor.id] = this.discovered[actor.id] || {})[c] = true;
                this._comboJustFound = c + 1;  // за съобщението долу
                try { console.log('%c✓ КОМБО ОТКРИТО! Спец ' + (c + 1) + ' — натисни бутона, за да удариш', 'color:#6ad06a;font-weight:bold'); } catch (e) {}
                // НЕ пускаме удара и НЕ крием менюто — само показваме бутона „⚡ Спец N"
                this._renderHUD();
                return;
            }
        }
        this._comboMiss = true;  // последните 4 не съвпадат — показва се в лентата
        // ограничи буфера
        if (this.comboInput.length > 12) this.comboInput = this.comboInput.slice(-12);
    }
    this._renderHUD();
};

/* ── избор на цел ── */
BattleEngine.prototype.targetsFor = function (actor, all) {
    var pool = actor.side === 'ally' ? this.foe : this.ally;
    var alive = pool.filter(function (u) { return u.alive; });
    if (all) return alive;
    if (!alive.length) return [];
    if (actor.side === 'ally') {
        var idx = Math.max(0, Math.min(this.selTarget, alive.length - 1));
        return [alive[idx]];
    }
    return [alive[Math.floor(Math.random() * alive.length)]];
};

BattleEngine.prototype._aliveFoes = function () {
    return (this.foe || []).filter(function (u) { return u.alive; });
};

/* смяна на избрана цел (стрелки нагоре/надолу) */
BattleEngine.prototype._cycleTarget = function (dir) {
    var foes = this._aliveFoes();
    if (foes.length < 2) { this._renderTargetArrow(); return; }
    this.selTarget = (this.selTarget + dir + foes.length) % foes.length;
    this._renderTargetArrow();
};

/* синя стрелка пред избрания противник */
BattleEngine.prototype._renderTargetArrow = function () {
    var a = this.els.arrow;
    if (!a) return;
    var actor = this.turnOrder[this.turnIdx];
    var foes = this._aliveFoes();
    var showable = this.state === 'playing' && !this.anim &&
                   actor && actor.side === 'ally' && foes.length > 1;
    // стрелка има смисъл само при избор между 2+ цели; при 1 враг (Дуел) няма какво да избираш
    if (!showable) { a.style.display = 'none'; return; }
    if (this.selTarget >= foes.length) this.selTarget = 0;
    var t = foes[this.selTarget];
    var w = t.def.video.size.width, h = t.def.video.size.height;
    // пред противника = откъм страната на съюзника (вляво от врага)
    a.style.display = '';
    a.style.left = (t.x - w / 2 - 64) + 'px';
    a.style.top = (t.y - h / 2 - 28) + 'px';
};

/* ── ход на враг ── */
BattleEngine.prototype.foeAct = function (actor) {
    var combos = this.heroCombos[actor.id] || [];
    if (combos.length && Math.random() < 0.25) {
        this.doSpecial(actor, Math.floor(Math.random() * combos.length));
        return;
    }
    var move = actor.def.moves[Math.floor(Math.random() * actor.def.moves.length)];
    this.doMove(actor, move);
};

/* ── изпълняване на ход ── */
BattleEngine.prototype.doMove = function (actor, move) {
    var self = this;
    var targets = this.targetsFor(actor, move.target === 'all');
    if (!targets.length) { this.advanceTurn(false); return; }

    var animList = this._shuffle(this._resolveAttackAnim(move.attackAnim, actor.videoSide));
    var animName = animList.join('|');  // целият списък — опитва се по ред (fallback)

    // damageType може да е обект (зависим от страната, за магьосника)
    var dtype = move.damageType;
    if (typeof dtype === 'object') dtype = dtype[actor.videoSide] || dtype.left;

    var kind = move.type === 'magic' ? 'magic' : 'melee';

    this.playAttack(actor, targets, animName, dtype, kind, false, function () {
        targets.forEach(function (t) {
            var dmg = rollDamage(t, kind);
            t.hp = Math.max(0, t.hp - dmg);
            if (t.hp <= 0) t.alive = false;
            else if (IMMOBILIZE.indexOf(dtype) > -1) {
                t.frozen = true;
            }
        });
        self.afterHit();
    });
};

/* ── специален удар ── */
BattleEngine.prototype.doSpecial = function (actor, idx) {
    var self = this;
    var sp = (actor.def.specials || [])[idx];
    if (!sp) { this.advanceTurn(false); return; }

    // ── Специалната атака не може 2 пъти ПОДРЕД от същия герой (а през ход) ──
    // Пазим брояча на хода, в който героят последно е ползвал special.
    // Ако се опита пак на следващия си ход — отказваме (прави обикновен ход).
    if (typeof actor._lastSpecialTurn === 'number' &&
        (this._turnCounter || 0) - actor._lastSpecialTurn < 2) {
        // твърде скоро — пропусни специалната, направи обикновен ход вместо това
        var mv = actor.def.moves && actor.def.moves[Math.floor(Math.random() * actor.def.moves.length)];
        if (mv) { this.doMove(actor, mv); return; }
        this.advanceTurn(false); return;
    }
    actor._lastSpecialTurn = (this._turnCounter || 0);

    var targets = this.targetsFor(actor, sp.target === 'all');
    if (!targets.length) { this.advanceTurn(false); return; }

    var animList = this._shuffle(this._resolveAttackAnim(sp.attackAnim, actor.videoSide));
    var animName = animList.join('|');  // целият списък — опитва се по ред (fallback)

    var dtype = sp.damageType;
    if (typeof dtype === 'object') dtype = dtype[actor.videoSide] || dtype.left;

    this.playAttack(actor, targets, animName, dtype, 'special', true, function () {
        targets.forEach(function (t) {
            if (sp.executeAt && t.hp / t.maxHp <= sp.executeAt) {
                t.hp = 0; t.alive = false;
            } else {
                var dmg = rollDamage(t, 'special');
                t.hp = Math.max(0, t.hp - dmg);
                if (t.hp <= 0) t.alive = false;
            }
            if (t.alive && (sp.freeze || IMMOBILIZE.indexOf(dtype) > -1)) {
                t.frozen = true;
            }
        });
        self.afterHit();
    });
};

BattleEngine.prototype._resolveAttackAnim = function (animDef, side) {
    if (Array.isArray(animDef)) return animDef;
    if (typeof animDef === 'object') return animDef[side] || animDef.left || [];
    return [animDef];
};

BattleEngine.prototype._shuffle = function (arr) {
    var a = (arr || []).slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
};

/* ── изпълняване на анимация на удар (DOM + video) ── */
BattleEngine.prototype.playAttack = function (actor, targets, animName, dtype, kind, isSpecial, onHit) {
    var self = this;
    this.anim = { actor: actor, targets: targets };
    actor.locked = true;  // докато тича→удря→връща се: да не го idle-ва watchdog-ът
    this.els.ctrl.innerHTML = '';      // скрий панела „избор на удар" докато тече анимацията
    this.els.combo.textContent = '';
    this._renderTargetArrow();  // скрива стрелката докато тече анимация

    var primary = targets[0];
    var isAll = targets.length > 1;

    var attackDuration = 3000;  // ms (резерв ако видеото няма onended)
    var moveDuration = 800;

    // всеки герой ПЪРВО тича/върви към противника (по-близо до центъра), после удря
    var approach = function (cb) {
        var aw = actor.dom.box.offsetWidth, ah = actor.dom.box.offsetHeight;
        var tx, ty;
        if (isAll) {
            // масова атака — застава към центъра, леко към враговете
            tx = self.W * (actor.side === 'ally' ? 0.42 : 0.58);
            ty = actor.baseY;
        } else {
            var gap = (primary.dom.box.offsetWidth / 2) + aw / 2 + 24;
            tx = primary.baseX + (actor.side === 'ally' ? -gap : gap);
            ty = primary.baseY;
        }
        // walk-анимацията тръгва ЕДНОВРЕМЕННО с движението
        self._setHeroState(actor, 'walks');
        actor.dom.box.style.transition = 'left ' + moveDuration + 'ms ease-out, top ' + moveDuration + 'ms ease-out';
        actor.dom.box.style.left = (tx - aw / 2) + 'px';
        actor.dom.box.style.top = (ty - ah) + 'px';
        setTimeout(cb, moveDuration);
    };

    var stationary = !!actor.def.stationary;  // магьосници: не сменят позиция

    // координатор: връщане/завършване СЛЕД като и атаката, и реакцията на целта свършат
    var attackEnded = false, hitDone = false, reactsLeft = 0, proceeded = false;
    var proceed = function () {
        if (proceeded || !attackEnded || !hitDone || reactsLeft > 0) return;
        proceeded = true;
        if (stationary) finishUp();        // магът не е мърдал — направо приключва
        else goBack(finishUp);             // движещият се връща обратно
    };

    var doAttackAnim = function () {
        var ended = false;
        // когато анимацията на АТАКУВАЩИЯ свърши → чак тогава пускаме реакцията на целта
        var onAtkEnd = function () {
            if (ended) return;
            ended = true; attackEnded = true;
            // прилагаме щетите и пускаме реакцията СЛЕД края на атаката
            targets.forEach(function (t) {
                if (!t.alive) return;
                t.locked = true; reactsLeft++;
                self._setHeroState(t, 'react:' + dtype, { onEnd: function () {
                    var after = function () { reactsLeft--; proceed(); };
                    if (t.alive && !t.diesPlayed) self._reactHitFollow(t, after);
                    else { t.locked = false; after(); }
                }});
            });
            onHit();
            self._renderHUD();
            self._screenShake(isSpecial ? 18 : 10);
            hitDone = true;
            proceed();
        };
        self._setHeroState(actor, 'attack:' + animName, { onEnd: onAtkEnd });
        setTimeout(onAtkEnd, attackDuration);  // предпазител, ако onended не гръмне
    };

    var goBack = function (cb) {
        // walk-анимацията тръгва едновременно с връщането, точно до home
        self._setHeroState(actor, 'walks');
        actor.dom.box.style.transition = 'left ' + moveDuration + 'ms ease-out, top ' + moveDuration + 'ms ease-out';
        actor.dom.box.style.left = actor.homeLeft + 'px';
        actor.dom.box.style.top = actor.homeTop + 'px';
        setTimeout(cb, moveDuration);
    };

    var finishUp = function () {
        // die анимация САМО ако героят наистина е умрял — и точно веднъж.
        targets.forEach(function (t) {
            if (!t.alive && !t.diesPlayed) {
                t.diesPlayed = true;
                self._setHeroState(t, 'react:dies', { onEnd: function () {
                    t.dom.box.style.transition = 'opacity 600ms';
                    t.dom.box.style.opacity = '0';
                }});
            }
        });
        self._setHeroState(actor, 'idle');
        // закотви точно вкъщи и махни transition — да не „пълзи" в idle
        actor.dom.box.style.transition = 'none';
        actor.dom.box.style.left = actor.homeLeft + 'px';
        actor.dom.box.style.top = actor.homeTop + 'px';
        actor.locked = false;
        self.anim = null;
        self._renderTargetArrow();
        setTimeout(function () { self.advanceTurn(false); }, 400);
    };

    if (stationary) doAttackAnim();              // маг: удря на място
    else approach(function () { doAttackAnim(); }); // останалите: тичат, удрят, после се връщат
};

BattleEngine.prototype._screenShake = function (mag) {
    var s = this.els.stage;
    s.style.animation = 'kbbShake ' + (mag > 14 ? 400 : 250) + 'ms';
    setTimeout(function () { s.style.animation = ''; }, 500);
};

/* ── idle watchdog: героите, които стоят, пускат idle от време на време ── */
BattleEngine.prototype._startIdleWatch = function () {
    var self = this;
    this._stopIdleWatch();
    this._idleTimer = setInterval(function () {
        if (self.state !== 'playing') return;
        var all = (self.ally || []).concat(self.foe || []);
        var actor = self.turnOrder[self.turnIdx];
        all.forEach(function (u) {
            if (!u.alive || u.diesPlayed || u.locked) return;
            if (self.anim && (self.anim.actor === u || self.anim.targets.indexOf(u) > -1)) return;
            if (u === actor) return;
            // bystander: трябва да е вкъщи. ако по някаква причина е изместен — върни го моментално
            var hl = (typeof u.homeLeft === 'number') ? u.homeLeft : (u.baseX - u.def.video.size.width / 2);
            var ht = (typeof u.homeTop === 'number') ? u.homeTop : (u.baseY - u.def.video.size.height);
            var cl = parseFloat(u.dom.box.style.left || '0');
            var ct = parseFloat(u.dom.box.style.top || '0');
            if (Math.abs(cl - hl) > 3 || Math.abs(ct - ht) > 3) {
                u.dom.box.style.transition = 'none';
                u.dom.box.style.left = hl + 'px';
                u.dom.box.style.top = ht + 'px';
            }
            var v = u.dom['vid' + u.dom.activeVid.toUpperCase()];
            // ако клипът е свършил (не е loop) — върни го в idle
            if (v && (v.ended || v.paused)) self._setHeroState(u, 'idle');
        });
    }, 1600);
};

BattleEngine.prototype._stopIdleWatch = function () {
    if (this._idleTimer) { clearInterval(this._idleTimer); this._idleTimer = null; }
};

/* след type-реакцията — пусни общата "hit" анимация (ако героят я има),
   иначе се връща в idle. Не прекъсва, ако междувременно е умрял. */
BattleEngine.prototype._reactHitFollow = function (t, onDone) {
    var self = this;
    onDone = onDone || function () {};
    if (!t.alive || t.diesPlayed) { t.locked = false; onDone(); return; }
    var done = function () {
        if (t.alive && !t.diesPlayed) self._setHeroState(t, 'idle');
        t.locked = false; onDone();
    };
    // ако type-реакцията вече е била самата "hit" — не я повтаряй
    if (/-hit\.webm$/i.test(t.animHistory[0] || '')) { done(); return; }
    this._setHeroState(t, 'react:hit', { onEnd: done });
};

/* ── debug панел (само админ) ── */
BattleEngine.prototype._renderDebug = function () {
    if (!this.debug || !this.dbg) return;
    var self = this;
    var rows = function (arr) {
        return (arr || []).map(function (u) {
            var hist = (u.animHistory || []).slice(1, 5).join(' · ') || '—';
            var combos = self.heroCombos[u.id] || [];
            var hkeys = (self.heroKeys[u.id] || []).join(' ').toUpperCase();
            var comboHtml = '';
            if (combos.length) {
                comboHtml = '<div class="kbb-dbg-combo">клавиши: ' + hkeys + '<br>' + combos.map(function (c, ci) {
                    var sp = (u.def.specials || [])[ci] || {};
                    return '⌨ ' + c.join('-').toUpperCase() + ' <i>' + (sp.name || ('спец' + (ci + 1))) + '</i>';
                }).join('<br>') + '</div>';
            }
            return '<div class="kbb-dbg-hero' + (u.alive ? '' : ' dead') + '">' +
                   '<div class="kbb-dbg-name">' + u.name + (u.alive ? '' : ' ☠') + '</div>' +
                   '<div class="kbb-dbg-cur">▶ ' + (u.curAnim || '—') + '</div>' +
                   '<div class="kbb-dbg-hist">' + hist + '</div>' +
                   comboHtml + '</div>';
        }).join('');
    };
    this.dbg.left.innerHTML = rows(this.ally);
    this.dbg.right.innerHTML = rows(this.foe);
};

BattleEngine.prototype._log = function (line) {
    if (!this.debug) return;
    this._logLines.unshift('· ' + line);
    if (this._logLines.length > 20) this._logLines.length = 20;
    if (this.dbg) this.dbg.log.innerHTML = this._logLines.join('<br>');
};

BattleEngine.prototype.afterHit = function () {
    this.ally.forEach(function (u) { if (u.hp <= 0) u.alive = false; });
    this.foe.forEach(function (u) { if (u.hp <= 0) u.alive = false; });
    this._renderHUD();
};

/* ── проверка край ── */
BattleEngine.prototype.checkEnd = function () {
    var allyAlive = this.ally && this.ally.some(function (u) { return u.alive; });
    var foeAlive = this.foe && this.foe.some(function (u) { return u.alive; });
    if (!this.ally) return false;
    if (!foeAlive) {
        this._stopIdleWatch();
        if (this.els.arrow) this.els.arrow.style.display = 'none';
        this.score += 200 * this.level;
        if (this.level >= this.maxLevels) { this.win(); }
        else { this.state = 'levelup'; this.saveScore(); this.drawLevelUp(); }
        return true;
    }
    if (!allyAlive) {
        this._stopIdleWatch();
        if (this.els.arrow) this.els.arrow.style.display = 'none';
        this.state = 'over'; this.saveScore(); this.drawOver(false);
        return true;
    }
    return false;
};

BattleEngine.prototype.win = function () {
    this.state = 'over'; this.saveScore(); this.drawOver(true);
};

BattleEngine.prototype.saveScore = function () {
    // Standalone mobile build: persist best locally, no network.
    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.level > this.bestLevel) this.bestLevel = this.level;
    try {
        localStorage.setItem(this._bestKey, JSON.stringify({
            best_level: this.bestLevel, best_score: this.bestScore
        }));
    } catch (e) { /* storage недостъпен — пропусни */ }
};

/* ── рендериране ── */
BattleEngine.prototype._renderAll = function () {
    this._renderHUD();
    this.els.ov.style.display = 'none';
};

BattleEngine.prototype._renderHUD = function () {
    // HP barove на всеки герой
    var all = (this.ally || []).concat(this.foe || []);
    for (var i = 0; i < all.length; i++) {
        var u = all[i];
        if (!u.dom) continue;
        var pct = Math.max(0, u.hp / u.maxHp);
        var fill = u.dom.hp.querySelector('.kbb-hpfill');
        fill.style.width = (pct * 100) + '%';
        if (pct < 0.3) fill.classList.add('low');
        else fill.classList.remove('low');
    }
    // info
    this.els.info.innerHTML =
      '<span>' + tf('hud_level', this.level, this.maxLevels) + '</span>' +
      '<span>' + tf('hud_score', this.score) + '</span>';
    // msg
    this.els.msg.textContent = this.msg || '';
    // controls — за текущия actor
    var actor = this.turnOrder[this.turnIdx];
    if (actor && actor.side === 'ally' && this.state === 'playing' && !this.anim) {
        this._renderControls(actor);
    } else {
        // не е твой ход / тече анимация → скрий и затвори менюто
        this._ctrlOpen = false;
        this.els.ctrl.classList.remove('kbb-ctrl-open');
        this.els.ctrl.innerHTML = '';
        this.els.combo.innerHTML = '';
    }
    this._renderTargetArrow();
    if (this.debug) this._renderDebug();
};

BattleEngine.prototype._renderControls = function (actor) {
    var ctrl = this.els.ctrl;
    var self = this;
    var open = !!this._ctrlOpen;
    // Менюто с бутоните е ЦЯЛ ЕКРАН (overlay), за да избира играчът спокойно, и се
    // СКРИВА след избора. Докато е скрито, долу стои само един едър бутон-стартер
    // („⚔ Избери удар"), който отваря менюто. Класът kbb-ctrl-open пали overlay-я
    // (виж CSS), за да не закрива боя, когато е затворено.
    ctrl.className = 'kbb-ctrl' + (this.mode === 'Duel' ? ' kbb-ctrl-duel' : '') +
                     (open ? ' kbb-ctrl-open' : '');

    // ── ЗАТВОРЕНО: само бутонът-стартер (боят се вижда напълно) ──
    if (!open) {
        ctrl.innerHTML = '<button class="kbb-ctrl-launch">' + t('ctrl_launch') + '</button>';
        var launch = ctrl.querySelector('.kbb-ctrl-launch');
        var openDown = function (e) {
            e.preventDefault(); e.stopPropagation();
            if (self.anim || self.state !== 'playing') return;
            var cur = self.turnOrder[self.turnIdx];
            if (!cur || cur.side !== 'ally' || !cur.alive) return;
            self._ctrlOpen = true;
            self._renderHUD();
        };
        if ('PointerEvent' in window) launch.addEventListener('pointerdown', openDown);
        else launch.addEventListener('touchstart', openDown, { passive: false });
        launch.addEventListener('click', openDown);
        if (this.els.combo) this.els.combo.textContent = '';
        return;
    }

    var foes = this._aliveFoes();
    var tgt = foes[Math.min(this.selTarget, foes.length - 1)];
    // комбо-лентата седи НАЙ-ОТГОРЕ на панела (вътре в него), за да е точно над
    // буквените бутони и да се мащабира заедно с тях
    var html = '<button class="kbb-ctrl-close" data-close="1">' + t('ctrl_close') + '</button>';
    html += '<div class="kbb-combo-inline"></div>';
    html += '<div class="kbb-actor">' + t('your_turn') + '<b>' + heroName(actor) + '</b></div>';
    if (foes.length) {
        html += '<div class="kbb-target">' + t('target_label') + '<b>' + (tgt ? heroName(tgt) : '—') + '</b>' +
                (foes.length > 1 ? ' <span class="kbb-hint">' + t('target_switch') + '</span>' : '') + '</div>';
    }
    html += '<div class="kbb-btns">';
    for (var i = 0; i < actor.def.moves.length; i++) {
        var m = actor.def.moves[i];
        html += '<button data-k="' + m.key + '" class="kbb-btn"><b>' + this._keyLabel(m.key) + '</b> ' + moveName(actor.def, m) + '</button>';
    }
    html += '</div>';
    var hasSpecials = (actor.def.specials || []).length > 0;
    if (hasSpecials) {
        // открити специални → бутони „⚡ Спец N"
        var disc = this.discovered[actor.id] || {};
        var specials = actor.def.specials || [];
        var anyDisc = false;
        for (var d = 0; d < specials.length; d++) { if (disc[d]) { anyDisc = true; break; } }
        if (anyDisc) {
            html += '<div class="kbb-specrow">';
            for (var s = 0; s < specials.length; s++) {
                if (disc[s]) html += '<button data-sp="' + s + '" class="kbb-sp">' + tf('special_btn', (s + 1), specialName(actor.def, s)) + '</button>';
            }
            html += '</div>';
        }
        html += '<div class="kbb-comborow">';
        var myKeys = this.heroKeys[actor.id] || COMBO_ALPHABET;
        for (var k = 0; k < myKeys.length; k++) {
            html += '<button data-k="' + myKeys[k] + '" class="kbb-ck">' + this._keyLabel(myKeys[k]) + '</button>';
        }
        html += '</div>';
    }
    ctrl.innerHTML = html;
    // ── MULTI-TOUCH вход ──
    // НЕ ползваме 'click' (той не позволява няколко едновременни натискания и
    // изисква pointerdown+pointerup върху ЕДИН и същ елемент). Вместо това
    // слушаме 'pointerdown' на всеки бутон: всеки докоснат пръст пуска СВОЕТО
    // действие веднага. Така играчът може да натисне няколко букви наведнъж и
    // те всичките се регистрират → специалните удари/комбинациите минават при
    // едновременно натискане. setPointerCapture гарантира, че събитието
    // принадлежи на бутона дори ако пръстът леко се измести.
    var fire = function (b) {
        // бутонът „✕ Затвори" само скрива менюто (боят остава, без да е изигран ход)
        if (b.dataset.close != null) { self._ctrlOpen = false; self._renderHUD(); return; }
        if (self.anim || self.state !== 'playing') return;
        var cur = self.turnOrder[self.turnIdx];
        if (!cur || cur.side !== 'ally' || !cur.alive) return;
        if (b.dataset.sp != null) {
            // специален удар → ходът приключва → менюто се СКРИВА
            self._ctrlOpen = false;
            self.doSpecial(cur, parseInt(b.dataset.sp, 10)); self._renderHUD();
        } else if (b.dataset.k === 'v' || b.dataset.k === 'b') {
            // обикновен удар (V/B) → ходът приключва → менюто се СКРИВА
            self._ctrlOpen = false;
            self.handleKey(cur, b.dataset.k);
        } else {
            // буква от комбинацията → НЕ затваряме (играчът трупа 4-те букви);
            // менюто се скрива само когато комбинацията се изпълни като special.
            self.handleKey(cur, b.dataset.k);
        }
    };
    ctrl.querySelectorAll('button').forEach(function (b) {
        var onDown = function (e) {
            e.preventDefault();          // спира 300ms закъснение, двойно tap-зум, скрол
            e.stopPropagation();
            try { b.setPointerCapture && b.setPointerCapture(e.pointerId); } catch (_) {}
            b.classList.add('kbb-press');
            fire(b);
        };
        var unpress = function () { b.classList.remove('kbb-press'); };
        // pointerdown покрива touch + mouse + pen с ЕДИН модел и поддържа
        // няколко едновременни pointer-а (по един на пръст).
        b.addEventListener('pointerdown', onDown);
        b.addEventListener('pointerup', unpress);
        b.addEventListener('pointercancel', unpress);
        b.addEventListener('pointerleave', unpress);
        // Резервен път за стари WebView без Pointer Events: touchstart.
        if (!('PointerEvent' in window)) {
            b.addEventListener('touchstart', function (e) {
                e.preventDefault();
                b.classList.add('kbb-press');
                fire(b);
            }, { passive: false });
            b.addEventListener('touchend', unpress);
        }
    });
    // combo display — показва натиснатите клавиши + дали съвпадат.
    // Пишем го във вградената лента на панела (kbb-combo-inline). Външният
    // els.combo се изчиства, за да не дублира текста.
    var line = ctrl.querySelector('.kbb-combo-inline');
    if (this.els.combo) this.els.combo.textContent = '';
    if (this._comboJustFound) {
        if (line) line.textContent = tf('combo_found', this._comboJustFound);
        this._comboJustFound = 0;
    } else if (this.comboInput.length) {
        var self2 = this;
        var shown = this.comboInput.slice(-4).map(function (k) { return self2._keyLabel(k); }).join(' · ');
        var tail = (this.comboInput.length >= 4 && this._comboMiss) ? t('combo_nomatch') : '';
        if (line) line.textContent = tf('combo_label', shown) + tail;
    } else {
        var self3 = this;
        var hk = (this.heroKeys[actor.id] || COMBO_ALPHABET).map(function (x) { return self3._keyLabel(x); }).join(' ');
        if (line) line.textContent = tf('combo_hint', hk);
    }
};

/* ── overlay screens ── */
BattleEngine.prototype.drawMenu = function () {
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card' + (this.mode === 'Duel' ? ' kbb-card-duel' : '') + '">' +
        '  <h1>' + t('game_title') + '</h1>' +
        '  <p class="kbb-rules">' +
        '   ' + t('rules_turnbased') + '<br>' +
        '   ' + t('rules_basic') + '<br>' +
        '   ' + t('rules_special') + '<br>' +
        '   ' + t('rules_discover') + '<br>' +
        '  </p>' +
        '  <p class="kbb-best">' + tf('best_record', this.bestLevel, this.bestScore) + '</p>' +
        '  <button class="kbb-go">' + t('menu_start') + '</button>' +
        '  <button class="kbb-lb-open">' + t('open_leaderboard') + '</button>' +
        '  <button class="kbb-go kbb-lang-btn">' + t('lang_btn') + '</button>' +
        '</div>';
    var self = this;
    this.els.ov.querySelector('.kbb-go').onclick = function () { self.startGame(); };
    var lbBtn = this.els.ov.querySelector('.kbb-lb-open');
    if (lbBtn) lbBtn.onclick = function () { self.drawLeaderboard(); };
    var langBtn = this.els.ov.querySelector('.kbb-lang-btn');
    if (langBtn) langBtn.onclick = function () {
        if (global.DuelOpenLangPicker) global.DuelOpenLangPicker();
    };
};

/* ── РАНГ ЛИСТА (leaderboard) ── */
/* Локален ТОП 100 — само име + точки (нула контакти). Синхронен localStorage. */

// Безопасен достъп до модула (зареден като side-effect върху window.DuelLeaderboard).
BattleEngine.prototype._lb = function () {
    return (typeof window !== 'undefined' && window.DuelLeaderboard) || null;
};

// HTML на таблицата с топ-100. highlightIdx = индекс (0-базиран) на реда за осветяване
// (или -1 за никакъв). meName/meScore — за да осветим точно нашия запис, когато има
// няколко еднакви имена/точки.
BattleEngine.prototype._leaderboardTableHTML = function (rows, highlightIdx) {
    if (!rows || !rows.length) {
        return '<p class="kbb-lb-empty">' + t('lb_empty') + '</p>';
    }
    var html = '<div class="kbb-lb-list">';
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var hl = (i === highlightIdx) ? ' kbb-lb-me' : '';
        var nameEsc = String(r.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += '<div class="kbb-lb-row' + hl + '">' +
                '<span class="kbb-lb-rank">' + (i + 1) + '</span>' +
                '<span class="kbb-lb-name">' + nameEsc + '</span>' +
                '<span class="kbb-lb-score">' + r.score + '</span>' +
                '</div>';
    }
    html += '</div>';
    return html;
};

// Самостоятелен екран „Ранг листа" от главното меню (цял топ-100, без осветен ред).
BattleEngine.prototype.drawLeaderboard = function () {
    var lb = this._lb();
    var rows = lb ? lb.getTop(100) : [];
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card kbb-card-lb' + (this.mode === 'Duel' ? ' kbb-card-duel' : '') + '">' +
        '  <h1>🏆 ' + t('leaderboard') + '</h1>' +
        '  <p class="kbb-lb-sub">' + t('lb_subtitle') + '</p>' +
        this._leaderboardTableHTML(rows, -1) +
        '  <button class="kbb-go kbb-lb-back">' + t('back') + '</button>' +
        '</div>';
    var self = this;
    this.els.ov.querySelector('.kbb-lb-back').onclick = function () { self.drawMenu(); };
};

BattleEngine.prototype.drawLevelUp = function () {
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card' + (this.mode === 'Duel' ? ' kbb-card-duel' : '') + '">' +
        '  <h2>' + tf('level_passed', this.level) + '</h2>' +
        '  <p>' + tf('score_value', this.score) + '</p>' +
        '  <button class="kbb-go">' + tf('to_next_level', (this.level + 1)) + '</button>' +
        '</div>';
    var self = this;
    this.els.ov.querySelector('.kbb-go').onclick = function () { self.nextLevel(); };
};

BattleEngine.prototype.drawOver = function (won) {
    var lb = this._lb();
    var defName = (lb && lb.lastName()) || '';
    var defNameEsc = defName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    this._scoreSubmitted = false;  // този резултат още не е записан в листата
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card kbb-card-over' + (this.mode === 'Duel' ? ' kbb-card-duel' : '') + '">' +
        '  <h1>' + (won ? t('win_title') : t('lose_title')) + '</h1>' +
        '  <p>' + tf('reached_level', this.level) + '</p>' +
        '  <p>' + tf('score_value', '<b>' + this.score + '</b>') + '</p>' +
        '  <div class="kbb-lb-form">' +
        '    <label class="kbb-lb-label">' + t('name_label') + '</label>' +
        '    <input class="kbb-lb-input" type="text" maxlength="24" placeholder="' + t('default_name') + '" value="' + defNameEsc + '">' +
        '    <button class="kbb-go kbb-lb-save">' + t('save_score') + '</button>' +
        '  </div>' +
        '  <p class="kbb-best">' + tf('best_record', this.bestLevel, this.bestScore) + '</p>' +
        '  <button class="kbb-go kbb-lb-newgame">' + t('new_game') + '</button>' +
        '</div>';
    var self = this;
    var input = this.els.ov.querySelector('.kbb-lb-input');
    var saveBtn = this.els.ov.querySelector('.kbb-lb-save');
    if (saveBtn) saveBtn.onclick = function () { self._submitScore(input ? input.value : ''); };
    if (input) {
        input.onkeydown = function (e) {
            if (e.key === 'Enter') { e.preventDefault(); self._submitScore(input.value); }
        };
        // фокус, без да отваря клавиатурата прекалено агресивно
        try { input.focus(); input.select(); } catch (_) {}
    }
    var newBtn = this.els.ov.querySelector('.kbb-lb-newgame');
    if (newBtn) newBtn.onclick = function () { self.startGame(); };
};

// Записва текущия резултат с въведеното име, изчислява мястото и ВЕДНАГА показва
// листата с осветен ред + „Ти си #N от M".
BattleEngine.prototype._submitScore = function (name) {
    if (this._scoreSubmitted) return;  // пази от двоен запис на същия бой
    var lb = this._lb();
    var cleanName = String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, 24) || t('default_name');
    var res, rank, total;
    if (lb) {
        res = lb.addScore(cleanName, this.score);
        rank = res.rank; total = res.total;
    } else {
        rank = 1; total = 1;
    }
    this._scoreSubmitted = true;

    var rows = lb ? lb.getTop(100) : [{ name: cleanName, score: this.score }];
    // намери НАШИЯ ред сред показаните (име+точки), за да го осветим. Ако сме извън
    // топ-100, осветен ред няма, но текстът „Ти си #N от M" пак го казва.
    var highlightIdx = -1;
    for (var i = 0; i < rows.length; i++) {
        if (highlightIdx === -1 && rows[i].name === cleanName && rows[i].score === this.score) {
            highlightIdx = i;  // първият съвпадащ ред (ранг = това място)
            break;
        }
    }

    var self = this;
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card kbb-card-lb' + (this.mode === 'Duel' ? ' kbb-card-duel' : '') + '">' +
        '  <h1>🏆 ' + t('leaderboard') + '</h1>' +
        '  <p class="kbb-lb-you">' + tf('your_rank', '<b>' + rank + '</b>', '<b>' + total + '</b>') + '</p>' +
        this._leaderboardTableHTML(rows, highlightIdx) +
        '  <button class="kbb-go kbb-lb-newgame">' + t('new_game') + '</button>' +
        '</div>';
    var newBtn = this.els.ov.querySelector('.kbb-lb-newgame');
    if (newBtn) newBtn.onclick = function () { self.startGame(); };
};

/* ── CSS ── */
var BATTLE_CSS = [
'@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap");',
'.kcy-battle{font-family:"Cormorant Garamond",Georgia,serif;color:#e8d6a5;}',
'.kbb-wrap{position:relative;width:100%;max-width:1280px;margin:0 auto;background:radial-gradient(ellipse at center,#241a1a 0%,#0a0708 80%);border:2px solid #5a3a1e;border-radius:8px;box-shadow:0 0 60px rgba(0,0,0,.8),inset 0 0 80px rgba(0,0,0,.6);overflow:hidden;}',
'.kbb-hmm{max-width:720px;}',  // portrait по-малък на screen
'.kbb-stage{position:absolute;left:50%;top:50%;transform-origin:center center;}',
'.kbb-bg{position:absolute;inset:0;background:#00ad34;}',
'.kbb-bg::before{content:none;}',
'.kbb-bg::after{content:none;}',
'.kbb-heroes,.kbb-fx,.kbb-hud{position:absolute;inset:0;}',
'.kbb-hero{position:absolute;transition:left .8s ease-out,top .8s ease-out,opacity .6s;}',
/* foe видеата са already right-* (вече гледат наляво), не трябва flip */
'.kbb-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transition:opacity .25s;}',
'.kbb-hpbar{position:absolute;top:-30px;left:10%;right:10%;height:14px;background:#1a1218;border:1.5px solid #6a4a2a;border-radius:6px;overflow:hidden;box-shadow:0 0 6px rgba(0,0,0,.7);}',
'.kbb-hpfill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(180deg,#9a3030,#5a1a1a);transition:width .4s;}',
'.kbb-hpfill.low{background:linear-gradient(180deg,#c97030,#7a3010);}',
'.kbb-hpname{position:absolute;inset:0;text-align:center;color:#f0d896;font-family:"Cinzel",serif;font-weight:600;font-size:10px;letter-spacing:1px;line-height:14px;text-shadow:1px 1px 1px #000;}',
'.kbb-info{position:absolute;top:18px;left:18px;display:flex;gap:18px;font-family:"Cinzel",serif;font-size:18px;color:#c9a35d;text-shadow:1px 1px 0 #000;letter-spacing:2px;}',
'.kbb-msg{position:absolute;top:60px;left:50%;transform:translateX(-50%);font-family:"Cinzel",serif;font-size:22px;color:#e8d6a5;text-shadow:2px 2px 0 #000,0 0 12px rgba(0,0,0,.8);letter-spacing:1px;}',
/* ── ДОЛНО ОБОСОБЕНО МЕНЮ С КОНТРОЛИ ──
   Качено е върху .kbb-wrap (НЕ върху мащабираното поле), затова размерите тук
   са в РЕАЛНИ пиксели и бутоните остават едри на телефон. Закотвено е най-долу,
   разпростряно по цялата ширина, за да се натискат буквите/специалните с палци.
   touch-action:none + user-select:none → позволяват ЕДНОВРЕМЕННИ натискания
   (multi-touch) без скрол/зум/селекция, които иначе ги отменят. */
/* ЗАТВОРЕНО състояние: само лента долу с бутона-стартер (боят се вижда напълно). */
'.kbb-ctrl{position:absolute;left:0;right:0;bottom:0;top:auto;transform:none;box-sizing:border-box;text-align:center;color:#d8c08c;background:transparent;border:none;padding:0 12px calc(12px + env(safe-area-inset-bottom,0px));margin:0 auto;z-index:42;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;}',
/* ── ОТВОРЕНО: ЦЯЛ ЕКРАН (overlay) за спокоен избор; крие се след избора ──
   Покрива целия екран над боя, центрира едрите бутони, скролва при нужда.
   touch-action:none + user-select:none → позволяват ЕДНОВРЕМЕННИ натискания
   (multi-touch) без скрол/зум/селекция, които иначе ги отменят. */
'.kbb-ctrl.kbb-ctrl-open{position:fixed;inset:0;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;overflow-y:auto;background:linear-gradient(180deg,rgba(8,5,8,.94),rgba(8,5,8,.98));border:none;border-radius:0;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(18px + env(safe-area-inset-bottom,0px));max-width:none;backdrop-filter:blur(6px);z-index:60;}',
/* бутонът-стартер (видим, когато менюто е затворено) */
'.kbb-ctrl-launch{width:100%;max-width:640px;min-height:72px;background:linear-gradient(180deg,#7a3a1a,#3a1a08);color:#f8e0a8;border:3px solid #b88a4a;border-radius:16px;font-family:"Cinzel",serif;font-size:26px;font-weight:700;letter-spacing:2px;cursor:pointer;text-shadow:1px 1px 0 #000;box-shadow:0 6px 0 #000,inset 0 1px 0 rgba(255,220,160,.3);}',
'.kbb-ctrl-launch:active{transform:translateY(2px);box-shadow:0 2px 0 #000;}',
/* бутонът „✕ Затвори" в горния десен ъгъл на overlay-я */
'.kbb-ctrl-close{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:14px;min-height:48px;background:linear-gradient(180deg,#3a2a1a,#1a1208);color:#f0d896;border:2px solid #8a5a2a;border-radius:12px;padding:8px 18px;font-family:"Cinzel",serif;font-size:18px;letter-spacing:1px;cursor:pointer;box-shadow:0 3px 0 #000;}',
'.kbb-ctrl-close:active{transform:translateY(2px);box-shadow:0 1px 0 #000;}',
/* Duel: НЕ смаляваме менюто (старият scale(0.4) го правеше дребно) — едри бутони като при отбора */
'.kbb-ctrl-duel{transform:none;transform-origin:bottom center;}',
'.kbb-ctrl button{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;}',
'.kbb-actor{font-family:"Cinzel",serif;font-size:18px;letter-spacing:1px;margin-bottom:4px;color:#f0d896;}',
'.kbb-target{font-family:"Cinzel",serif;font-size:17px;color:#8fd0ff;margin-bottom:8px;letter-spacing:.5px;}',
'.kbb-target b{color:#cfe9ff;}',
'.kbb-hint{font-size:13px;color:#7a90a4;}',
'.kbb-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}',
'.kbb-btn{min-width:120px;min-height:64px;background:linear-gradient(180deg,#3a2a1a,#1a1208);color:#e8d6a5;border:3px solid #6a4a2a;border-radius:14px;padding:10px 18px;font-family:"Cinzel",serif;font-size:22px;letter-spacing:1px;cursor:pointer;box-shadow:0 4px 0 #000,inset 0 1px 0 rgba(255,200,120,.2);transition:transform .08s,background .2s;}',
'.kbb-btn b{color:#f8c450;display:inline-block;background:#1a0e06;border:2px solid #8a5a2a;padding:1px 12px;border-radius:8px;margin-right:8px;font-family:"Cinzel",serif;}',
'.kbb-btn:hover{background:linear-gradient(180deg,#5a3a22,#2a1810);}',
'.kbb-btn.kbb-press,.kbb-btn:active{transform:translateY(2px);background:linear-gradient(180deg,#6a4a2a,#3a2010);}',
'.kbb-comborow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}',
'.kbb-specrow{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}',
'.kbb-sp{min-height:64px;background:linear-gradient(180deg,#2a5a2a,#103010);color:#d8ffd8;border:3px solid #6ad06a;border-radius:14px;padding:12px 22px;font-family:"Cinzel",serif;font-size:20px;font-weight:700;cursor:pointer;letter-spacing:.5px;box-shadow:0 4px 0 #000,0 0 18px rgba(120,255,120,.35);}',
'.kbb-sp:hover{background:linear-gradient(180deg,#357035,#154015);}',
'.kbb-sp.kbb-press,.kbb-sp:active{transform:translateY(2px);box-shadow:0 2px 0 #000;}',
/* буквените бутони за специалните удари — едри (мин. 64px), светли и четливи, за палец */
'.kbb-ck{background:linear-gradient(180deg,#3a2a1a,#1a1208);color:#f0d896;border:2px solid #8a5a2a;border-radius:14px;min-width:64px;width:64px;height:64px;font-family:"Cinzel",serif;font-size:30px;font-weight:700;cursor:pointer;letter-spacing:1px;box-shadow:0 4px 0 #000,inset 0 1px 0 rgba(255,200,120,.2);transition:transform .08s,background .12s;}',
'.kbb-ck:hover{background:linear-gradient(180deg,#5a3a22,#2a1810);color:#fff0c8;border-color:#b88a4a;}',
'.kbb-ck.kbb-press,.kbb-ck:active{transform:translateY(2px);background:linear-gradient(180deg,#8a5a2a,#4a2810);color:#fff;box-shadow:0 1px 0 #000;}',
/* вградената комбо-лента в горната част на долното меню */
'.kbb-combo-inline{font-family:"Cinzel",serif;font-size:15px;color:#f8c450;letter-spacing:1px;text-shadow:0 0 8px rgba(248,196,80,.5);min-height:18px;margin-bottom:6px;line-height:1.3;}',
/* старият плаващ индикатор вече не се ползва (текстът е в менюто) — скрит */
'.kbb-combo{display:none;}',
'.kbb-target-arrow{position:absolute;color:#3aa0ff;font-size:90px;line-height:1;text-shadow:0 0 18px rgba(58,160,255,.9),0 0 4px #000;pointer-events:none;z-index:41;animation:kbbArrow 0.8s ease-in-out infinite;}',
'@keyframes kbbArrow{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}',
'.kbb-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,5,8,.85);backdrop-filter:blur(6px);z-index:50;}',
'.kbb-card{max-width:80%;transform:translateY(-400px);background:linear-gradient(180deg,#1a1208,#0a0608);border:3px solid #6a4a2a;border-radius:16px;padding:65px 75px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.9),inset 0 0 40px rgba(0,0,0,.5);}',
'.kbb-card-duel{transform:translateY(-150px) scale(0.4);}',
'.kbb-card h1{font-family:"Cinzel",serif;font-weight:900;font-size:84px;color:#f8c450;letter-spacing:3px;margin:0 0 28px;text-shadow:2px 2px 0 #000,0 0 30px rgba(248,196,80,.4);}',
'.kbb-card h2{font-family:"Cinzel",serif;font-weight:700;font-size:64px;color:#f0d896;letter-spacing:2px;margin:0 0 28px;}',
'.kbb-card p{font-size:31px;line-height:1.55;color:#d8c08c;margin:15px 0;font-style:italic;}',
'.kbb-rules{font-style:normal !important;text-align:left;}',
'.kbb-rules kbd{font-family:"Cinzel",serif;background:#1a0e06;border:1.5px solid #8a5a2a;padding:3px 13px;border-radius:5px;color:#f8c450;font-size:25px;}',
'.kbb-best{color:#c9a35d;font-family:"Cinzel",serif;letter-spacing:1px;margin-top:32px !important;}',
'.kbb-go{background:linear-gradient(180deg,#7a3a1a,#3a1a08);color:#f8e0a8;border:2.5px solid #b88a4a;border-radius:11px;padding:25px 55px;font-family:"Cinzel",serif;font-size:35px;font-weight:700;letter-spacing:2px;cursor:pointer;margin-top:32px;text-shadow:1px 1px 0 #000;box-shadow:0 6px 0 #000,inset 0 1px 0 rgba(255,220,160,.3);}',
'.kbb-go:hover{background:linear-gradient(180deg,#9a4a20,#5a2a10);}',
'.kbb-go:active{transform:translateY(2px);box-shadow:0 2px 0 #000;}',
/* ── РАНГ ЛИСТА (leaderboard) ── стил kbb-* ── */
/* Картите с листа са по-широки и с ограничена височина (скролваема таблица). */
'.kbb-card-lb,.kbb-card-over{max-width:92%;}',
'.kbb-lb-sub{font-size:26px !important;color:#c9a35d !important;margin:0 0 18px !important;}',
'.kbb-lb-you{font-size:34px !important;color:#f0d896 !important;margin:6px 0 20px !important;font-style:normal !important;}',
'.kbb-lb-you b{color:#f8c450;}',
'.kbb-lb-list{max-height:560px;overflow-y:auto;border:2px solid #6a4a2a;border-radius:12px;background:rgba(10,8,10,.6);padding:6px;margin:0 0 26px;-webkit-overflow-scrolling:touch;}',
'.kbb-lb-row{display:flex;align-items:center;gap:14px;padding:10px 16px;border-radius:8px;font-family:"Cinzel",serif;font-size:28px;color:#e8d6a5;border-bottom:1px solid rgba(106,74,42,.35);}',
'.kbb-lb-row:last-child{border-bottom:none;}',
'.kbb-lb-row:nth-child(even){background:rgba(255,255,255,.03);}',
'.kbb-lb-rank{flex:0 0 auto;min-width:70px;text-align:right;color:#c9a35d;font-weight:700;}',
'.kbb-lb-name{flex:1 1 auto;text-align:left;color:#f0d896;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
'.kbb-lb-score{flex:0 0 auto;color:#f8c450;font-weight:700;text-align:right;min-width:120px;}',
/* осветеният ред = твоят запис */
'.kbb-lb-me{background:linear-gradient(180deg,rgba(248,196,80,.30),rgba(248,196,80,.12)) !important;border:2px solid #f8c450;box-shadow:0 0 18px rgba(248,196,80,.45);}',
'.kbb-lb-me .kbb-lb-name,.kbb-lb-me .kbb-lb-rank,.kbb-lb-me .kbb-lb-score{color:#fff0c8;}',
'.kbb-lb-empty{font-size:30px !important;color:#c9a35d !important;margin:30px 0 26px !important;}',
/* формата за въвеждане на име на края на боя */
'.kbb-lb-form{display:flex;flex-direction:column;align-items:center;gap:16px;margin:24px 0;}',
'.kbb-lb-label{font-family:"Cinzel",serif;font-size:26px;color:#c9a35d;letter-spacing:1px;}',
'.kbb-lb-input{width:80%;max-width:560px;box-sizing:border-box;background:#1a0e06;border:3px solid #8a5a2a;border-radius:12px;padding:18px 22px;font-family:"Cinzel",serif;font-size:32px;color:#f8e0a8;text-align:center;letter-spacing:1px;outline:none;}',
'.kbb-lb-input:focus{border-color:#f8c450;box-shadow:0 0 16px rgba(248,196,80,.4);}',
'.kbb-card .kbb-go.kbb-lb-open{background:linear-gradient(180deg,#3a2a5a,#1a1030);border-color:#8a6ad0;margin-top:18px;}',
'.kbb-card .kbb-go.kbb-lb-open:hover{background:linear-gradient(180deg,#4a3a72,#2a2050);}',
'@keyframes kbbShake{0%,100%{transform:translate(-50%,-50%) scale(var(--s,1))}25%{transform:translate(calc(-50% - 8px),calc(-50% - 4px)) scale(var(--s,1))}50%{transform:translate(calc(-50% + 6px),calc(-50% + 6px)) scale(var(--s,1))}75%{transform:translate(calc(-50% - 4px),calc(-50% - 6px)) scale(var(--s,1))}}',
].join('\n');

/* ── debug панел CSS (само админ) ── */
var BATTLE_DBG_CSS = [
'.kbb-dbg{position:fixed;top:80px;width:230px;max-height:46vh;overflow:auto;background:rgba(6,8,12,.92);border:1px solid #2a4a6a;border-radius:8px;padding:8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#bcd;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.6);}',
'.kbb-dbg-left{left:8px;}',
'.kbb-dbg-right{right:8px;}',
'.kbb-dbg-log{left:8px;bottom:8px;top:auto;width:240px;max-height:26vh;border-color:#4a3a1e;color:#d8c08c;line-height:1.4;font-size:.78em;}',
'.kbb-dbg-title{font-weight:700;color:#5fb0ff;letter-spacing:1px;margin-bottom:6px;border-bottom:1px solid #234;padding-bottom:4px;}',
'.kbb-dbg-log .kbb-dbg-title{color:#f8c450;border-color:#432;}',
'.kbb-dbg-hero{margin-bottom:8px;padding:5px 6px;background:rgba(255,255,255,.03);border-radius:5px;border-left:3px solid #2a6;}',
'.kbb-dbg-hero.dead{border-left-color:#a33;opacity:.6;}',
'.kbb-dbg-name{color:#f0d896;font-weight:700;}',
'.kbb-dbg-cur{color:#7fe0a0;word-break:break-all;}',
'.kbb-dbg-hist{color:#789;font-size:10px;word-break:break-all;margin-top:2px;}',
'.kbb-dbg-combo{color:#f8c450;font-size:11px;margin-top:4px;border-top:1px dashed #443;padding-top:3px;}',
'.kbb-dbg-combo i{color:#9a8862;font-style:normal;font-size:10px;}',
].join('\n');

global.BattleEngine = BattleEngine;
})(window);
