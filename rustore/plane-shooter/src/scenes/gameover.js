// GameOverScene — екран за победа или загуба + въвеждане на име, ранг листа и рестарт.
import Phaser from 'phaser';
import { THEME } from '../theme.js';
import Starfield from '../gfx/starfield.js';
import { addScore, getTop, lastName } from '../leaderboard.js';
import { showLeaderboardList } from '../gfx/leaderboard_view.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.won = !!data.won;
    this.finalScore = data.score || 0;
    this.saved = false;     // дали резултатът вече е записан
    this.nameInput = null;  // HTML input елемент (overlay)
    this.bodyObjects = [];  // обекти от динамичната част (за изчистване)
  }

  create() {
    const { width, height } = this.scale;
    this.stars = new Starfield(this);

    const title = this.add.text(width / 2, height * 0.10,
      this.won ? 'ПОБЕДА!' : 'КРАЙ НА ИГРАТА', {
        fontFamily: 'system-ui, sans-serif', fontSize: '34px', fontStyle: 'bold',
        color: this.won ? '#39d98a' : THEME.dangerHex
      }).setOrigin(0.5);
    title.setShadow(0, 0, this.won ? '#39d98a' : THEME.dangerHex, 18, true, true);

    this.add.text(width / 2, height * 0.10 + 40, 'Точки: ' + this.finalScore, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff'
    }).setOrigin(0.5);

    // Горна граница на динамичната част (вход за име ИЛИ ранг листа).
    this.bodyTop = height * 0.20;
    this.showNameEntry();

    // Чистим HTML overlay-а, ако сцената спре/се рестартира.
    this.events.once('shutdown', () => this.removeNameInput());
    this.events.once('destroy', () => this.removeNameInput());
  }

  // Маха текущите динамични обекти (за смяна на изглед).
  clearBody() {
    this.bodyObjects.forEach((o) => o.destroy());
    this.bodyObjects = [];
  }

  // --- Стъпка 1: въвеждане на име ---
  showNameEntry() {
    const { width } = this.scale;
    const y = this.bodyTop;

    const hint = this.add.text(width / 2, y, 'Въведи името си за ранг листата:', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#9fc8ff'
    }).setOrigin(0.5);
    this.bodyObjects.push(hint);

    // HTML input като overlay над платното (надеждно в Capacitor WebView).
    this.inputAnchorY = y + 44;
    this.createNameInput(lastName());

    const btn = this.makeButton(width / 2, y + 100, 'ЗАПАЗИ', () => this.saveScore());
    this.bodyObjects.push(btn.g, btn.txt, btn.zone);
  }

  // Създава HTML input, центриран над canvas-а (с отчитане на Phaser Scale).
  createNameInput(defaultName) {
    const canvas = this.game.canvas;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 24;
    input.value = defaultName || '';
    input.placeholder = 'Натисни тук и въведи името си';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'words');
    input.setAttribute('autofocus', '');
    Object.assign(input.style, {
      position: 'fixed',
      zIndex: '99999',          // над платното (избягваме скриване зад canvas)
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      padding: '10px 12px',
      borderRadius: '12px',
      border: '2px solid ' + THEME.accentHex,
      background: 'rgba(8,16,40,0.96)',
      color: '#ffffff',
      outline: 'none',
      boxSizing: 'border-box',
      boxShadow: '0 0 0 3px rgba(0,229,255,0.25)'
    });
    // ВАЖНО: към document.body (НЕ canvas.parent) — ако родител има CSS transform,
    // position:fixed се смята спрямо него и полето излиза извън екрана.
    document.body.appendChild(input);
    this.nameInput = input;
    this.positionNameInput();
    // Опит за фокус (на някои устройства клавиатурата изскача чак при тап — затова е едро и ярко).
    setTimeout(() => { try { input.focus(); input.select(); } catch (_) {} }, 60);

    // Enter запазва.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveScore();
      }
    });
  }

  // Преизчислява екранната позиция/размер на input-а спрямо canvas мащаба.
  positionNameInput() {
    if (!this.nameInput) return;
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / this.scale.width;   // мащаб платно → екран
    const sy = rect.height / this.scale.height;
    const fieldW = 220 * sx;
    const fieldH = 42 * sy;
    const cx = rect.left + (this.scale.width / 2) * sx;
    const cy = rect.top + this.inputAnchorY * sy;
    Object.assign(this.nameInput.style, {
      width: fieldW + 'px',
      height: fieldH + 'px',
      left: (cx - fieldW / 2) + 'px',
      top: (cy - fieldH / 2) + 'px'
    });
  }

  removeNameInput() {
    if (this.nameInput) {
      this.nameInput.remove();
      this.nameInput = null;
    }
  }

  // --- Записва точките и преминава към ранг листата ---
  saveScore() {
    if (this.saved) return;
    let name = this.nameInput ? String(this.nameInput.value || '').trim() : '';
    // Резервно: ако полето е празно (не се е видяло/фокусирало), питаме директно —
    // натискането на ЗАПАЗИ е жест → клавиатурата изскача надеждно.
    if (!name) {
      try { name = String(window.prompt('Въведи името си за ранг листата:', lastName() || '') || '').trim(); } catch (_) {}
    }
    this.saved = true;
    const res = addScore(name, this.finalScore);
    this.removeNameInput();
    this.clearBody();
    this.showResultList(res.rank, res.total);
  }

  // --- Стъпка 2: ранг листа с осветен ред + „Ти си #N от M" ---
  showResultList(rank, total) {
    const { width, height } = this.scale;

    const youText = `Ти си #${rank} от ${total}`;
    const you = this.add.text(width / 2, this.bodyTop, youText, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold',
      color: THEME.accentHex
    }).setOrigin(0.5);
    this.bodyObjects.push(you);

    const top = getTop(100);
    const listX = width * 0.08;
    const listY = this.bodyTop + 28;
    const listW = width * 0.84;
    // Оставяме място за бутоните долу.
    const listH = (height * 0.84) - listY;
    const highlightIndex = (rank >= 1 && rank <= top.length) ? (rank - 1) : -1;

    const list = showLeaderboardList(this, top, {
      x: listX, y: listY, width: listW, height: listH, highlightIndex
    });
    this.bodyObjects.push(list);

    // Бутони ОТНОВО / МЕНЮ долу.
    const againBtn = this.makeButton(width * 0.30, height * 0.92, 'ОТНОВО', () => {
      this.scene.start('Game', { level: 0, score: 0, lives: 3 });
    }, 130);
    const menuBtn = this.makeButton(width * 0.70, height * 0.92, 'МЕНЮ', () => {
      this.scene.start('Menu');
    }, 130);
    this.bodyObjects.push(againBtn.g, againBtn.txt, againBtn.zone);
    this.bodyObjects.push(menuBtn.g, menuBtn.txt, menuBtn.zone);
  }

  makeButton(x, y, label, onClick, w = 200) {
    const h = 52;
    const g = this.add.graphics();
    g.fillStyle(THEME.primary, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    g.lineStyle(2, 0xffffff, 0.6).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
    const txt = this.add.text(x, y, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#fff'
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: [g, txt], scaleX: 0.96, scaleY: 0.96, duration: 80, yoyo: true });
      this.time.delayedCall(90, onClick);
    });
    return { g, txt, zone };
  }

  update(time, delta) {
    this.stars.update(delta / 1000);
    // Държим input-а подравнен (напр. при поява на клавиатура/смяна на ориентация).
    if (this.nameInput) this.positionNameInput();
  }
}
