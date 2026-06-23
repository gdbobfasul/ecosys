// BootScene — генерира всички текстури процедурно, после към избор на език (при
// първо стартиране) или направо към менюто (ако езикът вече е избран).
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
    // Първо стартиране → екран за избор на език; иначе направо менюто.
    this.scene.start(hasLangChosen() ? 'Menu' : 'Language');
  }
}
