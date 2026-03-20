import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';

let gameInstance: Phaser.Game | null = null;

export function createGame(parent: HTMLElement): Phaser.Game {
  if (gameInstance) {
    gameInstance.destroy(true);
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0d0d1a',
    scene: [BootScene, WorldScene, UIScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    render: {
      antialias: false, // Pixel art style
      pixelArt: false,
      roundPixels: true,
      batchSize: 4096,
    },
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
        gravity: { x: 0, y: 0 },
      },
    },
    input: {
      mouse: { target: parent, preventDefaultWheel: true },
      touch: { target: parent, capture: false },
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
  };

  gameInstance = new Phaser.Game(config);
  return gameInstance;
}

export function destroyGame(): void {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }
}

export function getGame(): Phaser.Game | null {
  return gameInstance;
}
