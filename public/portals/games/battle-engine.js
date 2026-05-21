/* KCY Portals — Battle Engine (за двете битка-игри)
   Version: 1.0093
   Походова битка. Героите са статични — приближават се само при удар, после
   се връщат. Скрита 4-клавишна комбо последователност за специален удар,
   сменя се при всеки старт. Старт екран с правилата.

   Конфигурация:
     canvas, slug, title, levels
     heroPool   — масив дефиниции на герои (виж по-долу)
     teamSize   — 1 (дуел) или 3 (отбор)
   Дефиниция на герой:
     { id, name, draw(ctx,scale,facing), hp,
       moves:[{key:'1',name:'...',dmg:N,type:'melee|range|magic'}],
       special:{name:'...',apply(eng,attacker,foes)} или null }
*/
(function (global) {
'use strict';

// Клавиши за обикновени удари — v / b
var MOVE_KEYS = ['v', 'b'];
// Клавиши за скритата 4-буквена комбинация за специален удар.
// Нарочно НЕ включват v/b (за да не се бъркат с обикновените удари).
var COMBO_KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f'];

function pickRandom(arr, n) {
    var copy = arr.slice(), out = [];
    for (var i = 0; i < n && copy.length; i++) {
        out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
}

function BattleEngine(opts) {
    this.canvas = opts.canvas;
    this.ctx = opts.canvas.getContext('2d');
    this.W = opts.canvas.width;
    this.H = opts.canvas.height;
    this.slug = opts.slug;
    this.title = opts.title;
    this.maxLevels = opts.levels || 10;
    this.teamSize = opts.teamSize || 3;
    this.heroPool = opts.heroPool;

    this.state = 'menu';   // menu | playing | levelup | over
    this.level = 1;
    this.score = 0;
    this.bestLevel = 1;
    this.bestScore = 0;
    this.comboInput = [];
    this.turnOrder = [];
    this.turnIdx = 0;
    this.lastActor = null;
    this.lastActorCount = 0;
    this.anim = null;       // текуща анимация на удар
    this.msg = '';
    this.particles = [];

    // admin режим — ?adm=bgmasters-set в URL-а
    this.isAdmin = /[?&]adm=bgmasters-set/.test(global.location ? global.location.search : '');

    // Комбинациите се конфигурират ВЕДНЪЖ при зареждане на страницата.
    // Не се сменят между нивата — откриваш ги докато играеш.
    this.genCombos();
}

// генерира скритите 4-буквени комбинации — по 1 или 2 на герой (= specials.length)
BattleEngine.prototype.genCombos = function () {
    this.heroCombos = {};   // { heroId: [ ['q','w','e','r'], ... ] }
    var self = this;
    this.heroPool.forEach(function (def) {
        var n = (def.specials || []).length;
        var combos = [];
        for (var s = 0; s < n; s++) {
            var pool = COMBO_KEYS.slice();
            var c = [];
            for (var i = 0; i < 4 && pool.length; i++) {
                c.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
            }
            combos.push(c);
        }
        self.heroCombos[def.id] = combos;
    });
};

BattleEngine.prototype.start = function () {
    var self = this;
    this.bind();
    fetch('/api/portals/gms/progress/' + this.slug)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
            if (d) { self.bestLevel = d.best_level || 1; self.bestScore = d.best_score || 0; }
            self.drawMenu();
        }).catch(function () { self.drawMenu(); });
};

BattleEngine.prototype.bind = function () {
    var self = this;
    global.addEventListener('keydown', function (e) {
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
        var k = (e.key || '').toLowerCase();
        if (MOVE_KEYS.indexOf(k) > -1 || COMBO_KEYS.indexOf(k) > -1) self.handleKey(actor, k);
    });
    this.canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (self.state === 'menu' || self.state === 'over') { self.startGame(); return; }
        if (self.state === 'levelup') { self.nextLevel(); return; }
        // тъч — определя кой бутон от екранните е натиснат
        var r = self.canvas.getBoundingClientRect();
        var x = (e.touches[0].clientX - r.left) * (self.W / r.width);
        var y = (e.touches[0].clientY - r.top) * (self.H / r.height);
        self.handleTouch(x, y);
    }, { passive: false });
};

BattleEngine.prototype.startGame = function () {
    this.level = 1;
    this.score = 0;
    // Комбинациите НЕ се пипат — конфигурирани са веднъж в конструктора
    // (genCombos). Остават същите за цялата игра.
    this.setupLevel();
};

BattleEngine.prototype.nextLevel = function () {
    this.level++;
    if (this.level > this.maxLevels) { this.win(); return; }
    this.setupLevel();
};

BattleEngine.prototype.setupLevel = function () {
    // Комбинациите НЕ се пипат тук — генерирани са веднъж в startGame.
    this.comboInput = [];

    // произволни герои за двата отбора
    var allyDefs = pickRandom(this.heroPool, this.teamSize);
    var foeDefs = pickRandom(this.heroPool, this.teamSize);
    var hpScale = 1 + (this.level - 1) * 0.18;
    this.ally = [];
    this.foe = [];
    var slotY = this.teamSize === 1 ? [this.H * 0.6] :
                [this.H * 0.42, this.H * 0.6, this.H * 0.78];
    for (var a = 0; a < allyDefs.length; a++) {
        this.ally.push(this.makeUnit(allyDefs[a], 'ally', 70 + a * 6, slotY[a], hpScale));
    }
    for (var f = 0; f < foeDefs.length; f++) {
        this.foe.push(this.makeUnit(foeDefs[f], 'foe', this.W - 70 - f * 6, slotY[f], hpScale));
    }

    // ред — произволно разбъркани всички живи
    this.rebuildTurnOrder();
    this.turnIdx = 0;
    this.lastActor = null;
    this.lastActorCount = 0;
    this.anim = null;
    this.msg = 'Ниво ' + this.level + ' — битката започва!';
    this.state = 'playing';
    this.render();
    this.advanceTurn(true);
};

BattleEngine.prototype.makeUnit = function (def, side, x, y, hpScale) {
    return {
        def: def, side: side, name: def.name, id: def.id,
        x: x, baseX: x, y: y, hp: Math.round(def.hp * hpScale),
        maxHp: Math.round(def.hp * hpScale), alive: true,
        frozen: false, facing: side === 'ally' ? 1 : -1,
    };
};

BattleEngine.prototype.rebuildTurnOrder = function () {
    var all = this.ally.concat(this.foe).filter(function (u) { return u.alive; });
    // разбъркване
    for (var i = all.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = all[i]; all[i] = all[j]; all[j] = t;
    }
    this.turnOrder = all;
};

BattleEngine.prototype.advanceTurn = function (first) {
    var self = this;
    if (this.checkEnd()) return;
    if (!first) {
        this.turnIdx++;
    }
    if (this.turnIdx >= this.turnOrder.length) {
        this.rebuildTurnOrder();
        this.turnIdx = 0;
    }
    var actor = this.turnOrder[this.turnIdx];
    if (!actor || !actor.alive) { this.advanceTurn(false); return; }

    // един герой максимум 2 пъти подред
    if (actor === this.lastActor) {
        this.lastActorCount++;
        if (this.lastActorCount > 2) {
            this.advanceTurn(false);
            return;
        }
    } else {
        this.lastActor = actor;
        this.lastActorCount = 1;
    }

    if (actor.frozen) {
        actor.frozen = false;
        this.msg = actor.name + ' е вледенен — пропуска хода!';
        this.render();
        setTimeout(function () { self.advanceTurn(false); }, 1100);
        return;
    }

    if (actor.side === 'foe') {
        this.msg = 'Ход на противника: ' + actor.name;
        this.render();
        setTimeout(function () { self.foeAct(actor); }, 800);
    } else {
        this.comboInput = [];
        this.msg = 'Твой ход: ' + actor.name + ' — избери удар';
        this.render();
    }
};

BattleEngine.prototype.handleKey = function (actor, key) {
    // v / b → обикновен удар
    if (MOVE_KEYS.indexOf(key) > -1) {
        var move = actor.def.moves.find(function (m) { return m.key === key; });
        if (move) {
            this.comboInput = [];
            this.doMove(actor, move);
        }
        return;
    }
    // combo клавиш — трупай за скритите комбинации
    this.comboInput.push(key);
    if (this.comboInput.length > 4) this.comboInput.shift();
    // провери срещу ВСЯКА комбинация на героя (някои имат 2)
    if (this.comboInput.length === 4) {
        var combos = this.heroCombos[actor.def.id] || [];
        for (var i = 0; i < combos.length; i++) {
            if (this.comboInput.join('') === combos[i].join('')) {
                this.comboInput = [];
                this.doSpecial(actor, i);   // i = индекс на специала
                return;
            }
        }
    }
    this.render();
};

BattleEngine.prototype.handleTouch = function (x, y) {
    var actor = this.turnOrder[this.turnIdx];
    if (this.state !== 'playing' || this.anim || !actor || actor.side !== 'ally') return;
    var btns = this._buttons || [];
    for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.handleKey(actor, b.key);
            return;
        }
    }
};

BattleEngine.prototype.targetsFor = function (actor) {
    var pool = actor.side === 'ally' ? this.foe : this.ally;
    return pool.filter(function (u) { return u.alive; });
};

// Damage по процент от МАКС HP на целта
//   melee  → 0-10%   ·   magic → 10-20%   ·   special → 30-40%
function rollDamage(target, kind) {
    var lo, hi;
    if (kind === 'melee') { lo = 0.00; hi = 0.10; }
    else if (kind === 'magic') { lo = 0.10; hi = 0.20; }
    else { lo = 0.30; hi = 0.40; }   // special
    var pct = lo + Math.random() * (hi - lo);
    return Math.max(1, Math.round(target.maxHp * pct));
}

BattleEngine.prototype.doMove = function (actor, move) {
    var targets = this.targetsFor(actor);
    if (!targets.length) return;
    var target = targets[Math.floor(Math.random() * targets.length)];
    var self = this;
    this.playAttack(actor, target, move.anim, false, function () {
        var dmg = rollDamage(target, move.type);
        target.hp -= dmg;
        self.burst(target.x, target.y, move.type === 'magic' ? '#7fb4ff' : '#ff6644', 20);
        if (actor.side === 'ally') self.score += dmg;
        self.afterHit(actor.name + ' → ' + move.name + ' (' + dmg + ' щети)');
    });
};

BattleEngine.prototype.doSpecial = function (actor, idx) {
    var sp = actor.def.specials[idx || 0];
    if (!sp) return;
    var foes = this.targetsFor(actor);
    if (!foes.length) return;
    var self = this;
    var multi = sp.target === 'all';
    this.playAttack(actor, foes[0], sp.anim, true, function () {
        var hitList = multi ? foes : [foes[0]];
        hitList.forEach(function (f) {
            if (sp.executeAt && (f.hp / f.maxHp) <= sp.executeAt) {
                // мечоносец — нарязва на салата: цел на ≤30% умира директно
                f.hp = 0;
                self.burst(f.x, f.y, '#ff3322', 34);
            } else {
                var dmg = rollDamage(f, 'special');
                f.hp -= dmg;
                self.burst(f.x, f.y, sp.color || '#ffd24a', 26);
            }
            if (sp.freeze) f.frozen = true;
        });
        if (actor.side === 'ally') self.score += 150;
        self.afterHit('СПЕЦИАЛЕН! ' + actor.name + ' → ' + sp.name);
    });
};

BattleEngine.prototype.foeAct = function (actor) {
    // прост AI — 30% специален ако има, иначе случаен ход
    var specs = actor.def.specials || [];
    if (specs.length && Math.random() < 0.3) {
        this.doSpecial(actor, Math.floor(Math.random() * specs.length));
    } else {
        var mv = actor.def.moves[Math.floor(Math.random() * actor.def.moves.length)];
        this.doMove(actor, mv);
    }
};

// Бавна анимация на удар: ~4 сек същинско действие + ~1 сек връщане.
// melee герои се приближават до целта; дистанционни (fire/magic) остават
// на място и пускат снаряд към целта.
BattleEngine.prototype.playAttack = function (actor, target, animKind, isSpecial, onHit) {
    var self = this;
    var ranged = /fire|ball|orb|snake|quake|root|light/.test(animKind || '');
    this.anim = {
        actor: actor, target: target, kind: animKind, special: isSpecial,
        ranged: ranged, t: 0, onHit: onHit, hitDone: false,
        startMs: performance.now(), durMs: 5000,
    };
    var step = function () {
        if (!self.anim) return;
        var a = self.anim;
        a.t = Math.min(1, (performance.now() - a.startMs) / a.durMs);
        if (ranged) {
            var lean = Math.sin(Math.min(a.t, 0.3) / 0.3 * Math.PI) * 14;
            actor.x = actor.baseX + (actor.side === 'ally' ? lean : -lean);
            if (a.t >= 0.72 && !a.hitDone) { a.hitDone = true; a.onHit(); self.shake = a.special ? 18 : 10; }
        } else {
            var reach = (target.x - actor.baseX) * 0.62;
            if (a.t < 0.45) {
                actor.x = actor.baseX + reach * (a.t / 0.45);
            } else if (a.t < 0.6) {
                actor.x = actor.baseX + reach;
                if (!a.hitDone) { a.hitDone = true; a.onHit(); self.shake = a.special ? 18 : 12; }
            } else {
                actor.x = actor.baseX + reach * (1 - (a.t - 0.6) / 0.4);
            }
        }
        self.render();
        if (a.t >= 1) {
            actor.x = actor.baseX;
            self.anim = null;
            setTimeout(function () { self.advanceTurn(false); }, 450);
        } else {
            global.requestAnimationFrame(step);
        }
    };
    step();
};

BattleEngine.prototype.afterHit = function (text) {
    this.msg = text;
    // махни мъртвите
    this.ally.forEach(function (u) { if (u.hp <= 0) u.alive = false; });
    this.foe.forEach(function (u) { if (u.hp <= 0) u.alive = false; });
    this.render();
};

BattleEngine.prototype.checkEnd = function () {
    var allyAlive = this.ally.some(function (u) { return u.alive; });
    var foeAlive = this.foe.some(function (u) { return u.alive; });
    if (!foeAlive) {
        this.score += 200 * this.level;
        if (this.level >= this.maxLevels) { this.win(); }
        else { this.state = 'levelup'; this.saveScore(); this.drawLevelUp(); }
        return true;
    }
    if (!allyAlive) {
        this.state = 'over';
        this.saveScore();
        this.drawOver(false);
        return true;
    }
    return false;
};

BattleEngine.prototype.win = function () {
    this.state = 'over';
    this.saveScore();
    this.drawOver(true);
};

BattleEngine.prototype.saveScore = function () {
    var self = this;
    fetch('/api/portals/gms/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_slug: this.slug, score: this.score, level: this.level })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) { self.bestLevel = d.best_level; self.bestScore = d.best_score; } })
      .catch(function () {});
};

/* ── частици ── */
BattleEngine.prototype.burst = function (x, y, color, n) {
    for (var i = 0; i < (n || 16); i++) {
        var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
        this.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, color: color, size: 2 + Math.random() * 3 });
    }
};

/* ── render ── */
BattleEngine.prototype.render = function () {
    var ctx = this.ctx;
    // фон — бойно поле
    var g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#3a2c4e'); g.addColorStop(0.6, '#5a4a3a'); g.addColorStop(1, '#3a2e22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    // земя
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(0, this.H * 0.34, this.W, this.H * 0.55);

    // частици
    for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.04;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // герои
    this.drawUnits(ctx, this.foe);
    this.drawUnits(ctx, this.ally);

    // летящ снаряд при дистанционна атака (огън/сфери/змии)
    if (this.anim && this.anim.ranged) {
        var an = this.anim;
        // снарядът лети от 0.30 до 0.72 от анимацията
        var fp = (an.t - 0.30) / 0.42;
        if (fp > 0 && fp < 1.05) {
            var sx = an.actor.x + (an.actor.side === 'ally' ? 22 : -22);
            var sy = an.actor.y - 6;
            var ex = an.target.x, ey = an.target.y - 6;
            var px = sx + (ex - sx) * Math.min(1, fp);
            var py = sy + (ey - sy) * Math.min(1, fp);
            var col = (an.kind && /fire/.test(an.kind)) ? '#ff7b2a'
                    : (an.kind && /orb|light/.test(an.kind)) ? '#5b9bff'
                    : (an.kind && /snake/.test(an.kind)) ? '#3ad07a'
                    : (an.kind && /root/.test(an.kind)) ? '#6a8a3a' : '#ffd24a';
            ctx.save();
            ctx.shadowColor = col; ctx.shadowBlur = 18;
            ctx.fillStyle = col;
            var r = an.special ? 13 : 9;
            ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
            // ядро
            ctx.fillStyle = '#fff'; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(px, py, r * 0.4, 0, 7); ctx.fill();
            ctx.restore();
            // следа
            this.particles.push({ x: px, y: py, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5,
                life: 0.8, color: col, size: 3 + Math.random()*3 });
        }
    }

    // HUD горе
    ctx.fillStyle = 'rgba(8,8,14,.8)';
    ctx.fillRect(0, 0, this.W, 34);
    ctx.textAlign = 'left'; ctx.font = 'bold 14px system-ui';
    ctx.fillStyle = '#ffd24a'; ctx.fillText('Точки ' + this.score, 10, 22);
    ctx.textAlign = 'center'; ctx.fillStyle = '#46c8ff';
    ctx.fillText('Ниво ' + this.level + '/' + this.maxLevels, this.W / 2, 22);

    // съобщение
    ctx.textAlign = 'center'; ctx.font = '13px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(this.msg || '', this.W / 2, 52);

    // долна лента — бутоните за текущия герой
    this._buttons = [];
    var actor = this.turnOrder[this.turnIdx];
    if (this.state === 'playing' && actor && actor.side === 'ally' && !this.anim) {
        this.drawControls(ctx, actor);
    }

    if (this.particles.length) {
        var self = this;
        global.requestAnimationFrame(function () { if (self.state === 'playing' && !self.anim) self.render(); });
    }
};

BattleEngine.prototype.drawUnits = function (ctx, list) {
    for (var i = 0; i < list.length; i++) {
        var u = list[i];
        if (!u.alive) continue;
        ctx.save();
        ctx.translate(u.x, u.y);
        if (u.facing < 0) ctx.scale(-1, 1);
        u.def.draw(ctx);
        ctx.restore();
        // здраве
        var bw = 54, bx = u.x - bw / 2, by = u.y + 44;
        ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, 7);
        var hpPct = Math.max(0, u.hp / u.maxHp);
        ctx.fillStyle = hpPct > 0.5 ? '#5cd97a' : hpPct > 0.25 ? '#f0ad4e' : '#e8483c';
        ctx.fillRect(bx, by, bw * hpPct, 7);
        ctx.fillStyle = '#fff'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(u.name + (u.frozen ? ' ❄' : ''), u.x, by + 19);
        // индикатор за ред
        if (this.turnOrder[this.turnIdx] === u) {
            ctx.fillStyle = '#ffd24a'; ctx.beginPath();
            ctx.moveTo(u.x, u.y - 52); ctx.lineTo(u.x - 7, u.y - 62); ctx.lineTo(u.x + 7, u.y - 62);
            ctx.closePath(); ctx.fill();
        }
    }
};

BattleEngine.prototype.drawControls = function (ctx, actor) {
    var y = this.H - 86, h = 44, pad = 8;
    var moves = actor.def.moves;
    var n = moves.length;
    var bw = (this.W - pad * (n + 1)) / n;
    ctx.textAlign = 'center';
    for (var i = 0; i < n; i++) {
        var bx = pad + i * (bw + pad);
        // бутон
        ctx.fillStyle = '#2c4055';
        rr(ctx, bx, y, bw, h, 8); ctx.fill();
        // иконка на клавиатурен клавиш (с релеф)
        var keySize = 26, kx = bx + 10, ky = y + (h - keySize) / 2;
        ctx.fillStyle = '#11181f';
        rr(ctx, kx + 2, ky + 3, keySize, keySize, 5); ctx.fill();   // сянка
        ctx.fillStyle = '#e8edf2';
        rr(ctx, kx, ky, keySize, keySize, 5); ctx.fill();
        ctx.fillStyle = '#c4ccd4';
        rr(ctx, kx + 2, ky + keySize - 7, keySize - 4, 5, 2); ctx.fill();  // долен ръб
        ctx.fillStyle = '#1c2733';
        ctx.font = 'bold 14px system-ui';
        ctx.fillText(moves[i].key.toUpperCase(), kx + keySize / 2, ky + keySize / 2 + 5);
        // име на удара
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px system-ui';
        ctx.fillText(moves[i].name, bx + (keySize + 14) + (bw - keySize - 18) / 2, y + h / 2 + 4);
        this._buttons.push({ x: bx, y: y, w: bw, h: h, key: moves[i].key });
    }
    // ред с комбо подсказка
    var cy = this.H - 32;
    var specs = actor.def.specials || [];
    if (specs.length) {
        ctx.fillStyle = '#1a2330';
        rr(ctx, pad, cy - 13, this.W - 2 * pad, 26, 7); ctx.fill();
        ctx.fillStyle = '#ffd24a'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
        var prog = this.comboInput.map(function (k) { return k.toUpperCase(); }).join(' ');
        var label = specs.length > 1
            ? actor.name + ' има ' + specs.length + ' скрити 4-буквени комбинации'
            : 'Специален: скрита 4-буквена комбинация';
        ctx.fillText(label + ' (букви, не V/B)  ·  твой вход: ' + (prog || '—'), this.W / 2, cy + 2);
    }
};

function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ── екрани ── */
BattleEngine.prototype._panel = function (lines, accent) {
    var ctx = this.ctx;
    ctx.fillStyle = '#0a0e16'; ctx.fillRect(0, 0, this.W, this.H);
    var g = ctx.createRadialGradient(this.W / 2, this.H * 0.32, 30, this.W / 2, this.H * 0.32, this.H * 0.7);
    g.addColorStop(0, accent + '33'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    var y = this.H * 0.13;
    for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        ctx.fillStyle = L.color || '#fff';
        ctx.font = L.font || '14px system-ui';
        var words = L.text.split(' '), line = '', yy = y, maxW = this.W - 50;
        for (var w = 0; w < words.length; w++) {
            var test = line + words[w] + ' ';
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line.trim(), this.W / 2, yy); line = words[w] + ' '; yy += (L.lh || 19);
            } else line = test;
        }
        ctx.fillText(line.trim(), this.W / 2, yy);
        y = yy + (L.gap || 24);
    }
};

BattleEngine.prototype.drawMenu = function () {
    var a = '#ff7b54';
    var rows = [
        { text: this.title, font: 'bold 26px system-ui', color: a, gap: 28 },
        { text: 'ПРАВИЛА', font: 'bold 13px system-ui', color: '#ffd24a', gap: 20 },
        { text: 'Походова битка. Героите ти излизат ПРОИЗВОЛНО на всяко ниво — не ги избираш.', font: '13px system-ui', color: '#dfe7ee', lh: 18, gap: 22 },
        { text: 'ОБИКНОВЕНИ УДАРИ: на твой ход натискаш клавиш V или B. Удар = 0-10% щети, магия = 10-20% от здравето на целта.', font: '13px system-ui', color: '#dfe7ee', lh: 18, gap: 22 },
        { text: 'СПЕЦИАЛЕН УДАР: скрита 4-БУКВЕНА комбинация (букви, не V/B). Някои герои имат по 2. Прави 30-40% щети. Конфигурира се при зареждане и НЕ се сменя цяла игра.', font: '13px system-ui', color: '#ffd24a', lh: 18, gap: 22 },
        { text: 'Трикът е да откриеш комбинациите докато играеш. Уцелиш ли ги — помиташ враговете.', font: '13px system-ui', color: '#dfe7ee', lh: 18, gap: 26 },
        { text: this.maxLevels + ' нива · рекорд: ниво ' + this.bestLevel + ', ' + this.bestScore + ' т.', font: '12px system-ui', color: '#8ba0b2', gap: 30 },
    ];
    // ADMIN — показва скритите комбинации за тестване
    if (this.isAdmin) {
        rows.push({ text: '🔧 ADMIN — скрити комбинации (видими само за теб):', font: 'bold 12px system-ui', color: '#46c8ff', gap: 18 });
        var self = this;
        this.heroPool.forEach(function (def) {
            var combos = self.heroCombos[def.id] || [];
            if (!combos.length) return;
            var txt = def.name + ': ' + combos.map(function (c) {
                return c.map(function (k) { return k.toUpperCase(); }).join('-');
            }).join('   |   ');
            rows.push({ text: txt, font: '12px monospace', color: '#9fd8ff', lh: 16, gap: 16 });
        });
        rows.push({ text: '', font: '1px system-ui', gap: 10 });
    }
    rows.push({ text: '▶  SPACE / тап за старт', font: 'bold 16px system-ui', color: a, gap: 0 });
    this._panel(rows, a);
};

BattleEngine.prototype.drawLevelUp = function () {
    var a = '#5cd97a';
    this._panel([
        { text: 'НИВО ' + this.level + ' спечелено!', font: 'bold 24px system-ui', color: a, gap: 30 },
        { text: 'Точки: ' + this.score, font: 'bold 20px system-ui', color: '#fff', gap: 26 },
        { text: 'Следва ниво ' + (this.level + 1) + ' — нови произволни герои и нова скрита комбинация.', font: '13px system-ui', color: '#dfe7ee', lh: 18, gap: 30 },
        { text: '▶  SPACE / тап за продължаване', font: 'bold 15px system-ui', color: a, gap: 0 },
    ], a);
};

BattleEngine.prototype.drawOver = function (won) {
    var a = won ? '#ffd24a' : '#ff6b6b';
    this._panel([
        { text: won ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ', font: 'bold 28px system-ui', color: a, gap: 32 },
        { text: won ? 'Премина всичките ' + this.maxLevels + ' нива!' : 'Стигна до ниво ' + this.level, font: '15px system-ui', color: '#dfe7ee', gap: 26 },
        { text: 'Точки: ' + this.score, font: 'bold 22px system-ui', color: '#fff', gap: 24 },
        { text: 'Рекорд: ниво ' + this.bestLevel + ' · ' + this.bestScore + ' точки', font: '13px system-ui', color: '#8ba0b2', gap: 32 },
        { text: '▶  SPACE / тап за нова игра', font: 'bold 15px system-ui', color: a, gap: 0 },
    ], a);
};

global.BattleEngine = BattleEngine;
global.BattleEngine.rr = rr;

})(window);
