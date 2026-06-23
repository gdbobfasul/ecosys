import Phaser from 'phaser';
import { generateTextures } from '../textures.js';
import { THEME } from '../theme.js';
import { hasLangChosen } from '../core/i18n.js';

// BootScene: генерира всички процедурни текстури веднъж, после към менюто.
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    generateTextures(this, THEME.heroBody, THEME.heroEdge);

    // Инициализираме прогреса (отключено ниво) в registry, пазим и в localStorage.
    let unlocked = 1;
    try {
      const saved = localStorage.getItem('tf_unlocked');
      if (saved) unlocked = Math.max(1, Math.min(10, parseInt(saved, 10) || 1));
    } catch (e) { /* localStorage може да липсва в някои WebView-та */ }
    this.registry.set('unlockedLevel', unlocked);
    this.registry.set('selectedWeapon', 'fists');

    // При първо стартиране показваме екрана за избор на език, после менюто.
    this.scene.start(hasLangChosen() ? 'menu' : 'language');
  }
}
