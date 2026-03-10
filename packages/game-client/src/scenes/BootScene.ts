import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.cameras.main;

    // Loading bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222244, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    const loadingText = this.add
      .text(width / 2, height / 2 - 35, 'Loading FlipFeeds...', {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ff88, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      console.log('[BootScene] All assets loaded');
    });

    // Load tilemap and tileset
    this.load.tilemapTiledJSON('conference-map', 'assets/maps/conference-map.json');
    this.load.image('conference-tiles', 'assets/tilesets/conference-tiles.png');
  }

  create(): void {
    console.log('[BootScene] Boot complete, starting GameScene');
    this.scene.start('GameScene');
  }
}
