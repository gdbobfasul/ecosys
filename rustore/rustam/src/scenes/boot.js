// BootScene — генерира всички текстури процедурно, после към менюто.
import Phaser from 'phaser';
import { generateTextures } from '../gfx/textures.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // Всички текстури се правят в кода (без външни файлове).
    generateTextures(this);
    this.scene.start('Menu');
  }
}
