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

var COMBO_KEYS = ['1', '2', '3', '4'];

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
    this.combo = [];
    this.comboInput = [];
    this.turnOrder = [];
    this.turnIdx = 0;
    this.lastActor = null;
    this.lastActorCount = 0;
    this.anim = null;       // текуща анимация на удар
    this.msg = '';
    this.particles = [];
}

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
        var k = e.key;
        if (COMBO_KEYS.indexOf(k) > -1) self.handleKey(actor, k);
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
    this.setupLevel();
};

BattleEngine.prototype.nextLevel = function () {
    this.level++;
    if (this.level > this.maxLevels) { this.win(); return; }
    this.setupLevel();
};

BattleEngine.prototype.setupLevel = function () {
    // нова скрита комбинация при всеки старт на ниво
    this.combo = [];
    for (var i = 0; i < 4; i++) this.combo.push(COMBO_KEYS[Math.floor(Math.random() * COMBO_KEYS.length)]);
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
    // натрупване за комбо
    this.comboInput.push(key);
    if (this.comboInput.length > 4) this.comboInput.shift();
    // проверка за специален (точна 4-клавишна последователност)
    if (actor.def.special && this.comboInput.length === 4 &&
        this.comboInput.join('') === this.combo.join('')) {
        this.comboInput = [];
        this.doSpecial(actor);
        return;
    }
    // иначе — обикновен удар по клавиша (ако героят има такъв ход)
    var move = actor.def.moves.find(function (m) { return m.key === key; });
    if (move) {
        this.comboInput = [];
        this.doMove(actor, move);
    } else {
        // клавишът е само част от комбо опит — покажи прогрес
        this.render();
    }
};

BattleEngine.prototype.handleTouch = function (x, y) {
    var actor = this.turnOrder[this.turnIdx];
    if (this.state !== 'playing' || this.anim || !actor || actor.side !== 'ally') return;
    // екранните бутони са в долната лента — изчисли кой
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

BattleEngine.prototype.doMove = function (actor, move) {
    var targets = this.targetsFor(actor);
    if (!targets.length) return;
    var target = targets[Math.floor(Math.random() * targets.length)];
    this.playAttack(actor, target, function () {
        target.hp -= move.dmg;
        this.burst(target.x, target.y, '#ff6644', 18);
        if (actor.side === 'ally') this.score += move.dmg;
        this.afterHit(actor.name + ' → ' + move.name + ' (' + move.dmg + ' щети)');
    }.bind(this));
};

BattleEngine.prototype.doSpecial = function (actor) {
    var sp = actor.def.special;
    var foes = this.targetsFor(actor);
    if (!foes.length) return;
    this.playAttack(actor, foes[0], function () {
        sp.apply(this, actor, foes);
        if (actor.side === 'ally') this.score += 120;
        this.afterHit('СПЕЦИАЛЕН! ' + actor.name + ' → ' + sp.name);
    }.bind(this));
};

BattleEngine.prototype.foeAct = function (actor) {
    // прост AI — 30% специален ако има, иначе случаен ход
    if (actor.def.special && Math.random() < 0.3) {
        this.doSpecial(actor);
    } else {
        var mv = actor.def.moves[Math.floor(Math.random() * actor.def.moves.length)];
        this.doMove(actor, mv);
    }
};

BattleEngine.prototype.playAttack = function (actor, target, onHit) {
    var self = this;
    this.anim = { actor: actor, target: target, t: 0, onHit: onHit, hitDone: false };
    var step = function () {
        if (!self.anim) return;
        var a = self.anim;
        a.t += 0.06;
        // приближаване (0→0.5), удар, връщане (0.5→1)
        var dir = a.actor.side === 'ally' ? 1 : -1;
        var reach = (target.x - actor.baseX) * 0.62;
        if (a.t < 0.5) {
            actor.x = actor.baseX + reach * (a.t / 0.5);
        } else {
            if (!a.hitDone) { a.hitDone = true; a.onHit(); self.shake = 12; }
            actor.x = actor.baseX + reach * (1 - (a.t - 0.5) / 0.5);
        }
        self.render();
        if (a.t >= 1) {
            actor.x = actor.baseX;
            self.anim = null;
            setTimeout(function () { self.advanceTurn(false); }, 500);
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
    var y = this.H - 86, h = 40, pad = 8;
    var moves = actor.def.moves;
    var n = moves.length;
    var bw = (this.W - pad * (n + 1)) / n;
    ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
    for (var i = 0; i < n; i++) {
        var bx = pad + i * (bw + pad);
        ctx.fillStyle = '#2c4055';
        rr(ctx, bx, y, bw, h, 8); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText('[' + moves[i].key + '] ' + moves[i].name, bx + bw / 2, y + h / 2 + 4);
        this._buttons.push({ x: bx, y: y, w: bw, h: h, key: moves[i].key });
    }
    // ред с комбо подсказка
    var cy = this.H - 34;
    if (actor.def.special) {
        ctx.fillStyle = '#1a2330';
        rr(ctx, pad, cy - 14, this.W - 2 * pad, 28, 7); ctx.fill();
        ctx.fillStyle = '#ffd24a'; ctx.font = '11px system-ui';
        var prog = this.comboInput.join(' ');
        ctx.fillText('Специален (' + actor.def.special.name + '): скрита комбинация от 4 клавиша 1-4   ·   твой вход: ' + (prog || '—'),
            this.W / 2, cy + 3);
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
    this._panel([
        { text: this.title, font: 'bold 26px system-ui', color: a, gap: 28 },
        { text: 'ПРАВИЛА', font: 'bold 13px system-ui', color: '#ffd24a', gap: 20 },
        { text: 'Походова битка. Героите ти излизат ПРОИЗВОЛНО на всяко ниво — не ги избираш.', font: '13px system-ui', color: '#dfe7ee', lh: 18, gap: 22 },
        { text: 'На твой ход избираш удар с клавиш [1] / [2]. Героите се приближават само за удара и се връщат.', font: '13px system-ui', color: '#dfe7ee', lh: 18, gap: 22 },
        { text: 'СПЕЦИАЛЕН УДАР: всеки герой (освен рицар и джудже) има скрита комбинация от 4 клавиша (1-4). Тя се СМЕНЯ при всеки старт.', font: '13px system-ui', color: '#ffd24a', lh: 18, gap: 22 },
        { text: 'Уцелиш ли я почти винаги — минаваш всички нива с много точки. Ако не — слабо представяне.', font: '13px system-ui', color: '#dfe7ee', lh: 18, gap: 22 },
        { text: 'Един герой може да удари максимум 2 пъти подред. Редът е произволен.', font: '13px system-ui', color: '#dfe7ee', lh: 18, gap: 26 },
        { text: this.maxLevels + ' нива · рекорд: ниво ' + this.bestLevel + ', ' + this.bestScore + ' т.', font: '12px system-ui', color: '#8ba0b2', gap: 30 },
        { text: '▶  SPACE / тап за старт', font: 'bold 16px system-ui', color: a, gap: 0 },
    ], a);
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
