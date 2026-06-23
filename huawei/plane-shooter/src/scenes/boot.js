// BootScene — генерира всички текстури процедурно, после към избор на език / менюто.
import Phaser from 'phaser';
import { generateTextures } from '../gfx/textures.js';
import { hasLangChosen } from '../core/i18n.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // Всички текстури се правят в кода (без външни файлове).
    generateTextures(this);
    // При първо стартиране показваме екрана за избор на език, после менюто.
    this.scene.start(hasLangChosen() ? 'Menu' : 'Language');
  }
}
