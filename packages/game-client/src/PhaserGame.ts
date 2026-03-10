import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import eventBus from './EventBus';

export interface PhaserGameConfig {
  parent: string | HTMLElement;
  width?: number;
  height?: number;
  debug?: boolean;
}

export function createGame(config: PhaserGameConfig): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,  // Force WebGL, not AUTO — we need it for performance
    parent: config.parent,
    width: config.width || window.innerWidth,
    height: config.height || window.innerHeight,
    backgroundColor: '#1a1a2e',
    pixelArt: true,  // Important for retro tilemap — no anti-aliasing on sprites
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },  // Top-down, no gravity
        debug: config.debug || false,
      },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: false,  // Pixel art style
      pixelArt: true,
      roundPixels: true,  // Prevent sub-pixel rendering artifacts
    },
    fps: {
      target: 60,
      forceSetTimeOut: false,
    },
    scene: [BootScene, GameScene],
    // Prevent right-click context menu on the canvas
    disableContextMenu: true,
    // Transparent canvas background so CSS background shows through if needed
    transparent: false,
    // Audio config placeholder
    audio: {
      disableWebAudio: false,
    },
  });

  return game;
}
