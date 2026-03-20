import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.on('progress', (value: number) => {
      const event = new CustomEvent('game:loading', { detail: { progress: value } });
      window.dispatchEvent(event);
    });

    this.load.on('complete', () => {
      const event = new CustomEvent('game:loaded');
      window.dispatchEvent(event);
    });

    // Generate tile textures programmatically
    this.generateTileTextures();
  }

  private generateTileTextures(): void {
    // We generate all tiles procedurally in code
    // No external assets needed for MVP
  }

  create(): void {
    this.scene.start('WorldScene');
  }
}
