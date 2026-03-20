import Phaser from 'phaser';

/**
 * UIScene overlays the WorldScene with the minimap.
 * The main React UI is rendered outside Phaser entirely.
 */
export class UIScene extends Phaser.Scene {
  private miniMapGfx!: Phaser.GameObjects.Graphics;
  private miniMapBg!: Phaser.GameObjects.Graphics;
  private readonly mmW = 160;
  private readonly mmH = 120;
  private readonly mmPadding = 12;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Fixed camera (not affected by world scroll)
    this.cameras.main.setScroll(0, 0);

    const mmX = this.cameras.main.width - this.mmW - this.mmPadding;
    const mmY = this.cameras.main.height - this.mmH - this.mmPadding;

    // Minimap background
    this.miniMapBg = this.add.graphics();
    this.miniMapBg.fillStyle(0x0d0d1a, 0.85);
    this.miniMapBg.fillRoundedRect(mmX - 2, mmY - 2, this.mmW + 4, this.mmH + 4, 4);
    this.miniMapBg.lineStyle(1, 0x4c6ef5, 0.5);
    this.miniMapBg.strokeRoundedRect(mmX - 2, mmY - 2, this.mmW + 4, this.mmH + 4, 4);

    this.miniMapGfx = this.add.graphics();
    this.miniMapGfx.setPosition(mmX, mmY);

    this.time.addEvent({
      delay: 100,
      callback: this.updateMiniMap,
      callbackScope: this,
      loop: true,
    });
  }

  private updateMiniMap(): void {
    // Minimal minimap: just a placeholder (full impl would sample chunk colors)
    this.miniMapGfx.clear();
    this.miniMapGfx.fillStyle(0x111827, 1);
    this.miniMapGfx.fillRect(0, 0, this.mmW, this.mmH);

    // Draw viewport indicator
    this.miniMapGfx.lineStyle(1, 0x60a5fa, 0.8);
    this.miniMapGfx.strokeRect(
      this.mmW / 2 - 20,
      this.mmH / 2 - 15,
      40,
      30,
    );
  }
}
