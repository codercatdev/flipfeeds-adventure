import Phaser from 'phaser';
import eventBus from '../EventBus';

interface PooledSprite {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  active: boolean;
  playerId: string | null;
  variant: number;
}

// Character color variant column offsets in the creatures spritesheet
const PLAYER_VARIANTS = [0, 4, 8, 12];

export class SpritePool {
  private pool: PooledSprite[] = [];
  private activeMap: Map<string, PooledSprite> = new Map();
  private scene: Phaser.Scene;

  // Lifetime counters for telemetry
  private lifetimeCreated = 0;
  private lifetimeRecycled = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Acquire a sprite for a player. Reuses from pool or creates new. */
  acquire(playerId: string, x: number, y: number, name?: string): PooledSprite {
    const existing = this.activeMap.get(playerId);
    if (existing) return existing;

    let entry = this.pool.find(s => !s.active);

    if (entry) {
      entry.active = true;
      entry.playerId = playerId;
      entry.sprite.setPosition(x, y);
      entry.sprite.setVisible(true);
      entry.sprite.setActive(true);
      entry.label.setText(name || playerId.slice(0, 6));
      entry.label.setPosition(x, y - 20);
      entry.label.setVisible(true);
      this.lifetimeRecycled++;
    } else {
      const variant = this.getVariantOffset(playerId);
      const sprite = this.scene.add.sprite(x, y, 'creatures', 416 + variant);
      sprite.setDepth(3);
      this.scene.physics.add.existing(sprite);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(16, 16);
      body.setOffset(4, 8);

      const label = this.scene.add.text(x, y - 20, name || playerId.slice(0, 6), {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#00000088',
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(5);

      entry = { sprite, label, active: true, playerId, variant };
      this.pool.push(entry);
      this.lifetimeCreated++;
    }

    this.activeMap.set(playerId, entry);
    this.emitStats();
    return entry;
  }

  /** Release a sprite back to the pool. */
  release(playerId: string): void {
    const entry = this.activeMap.get(playerId);
    if (!entry) return;

    entry.active = false;
    entry.playerId = null;
    entry.sprite.setVisible(false);
    entry.sprite.setActive(false);
    entry.label.setVisible(false);

    this.activeMap.delete(playerId);
    this.emitStats();
  }

  /** Get the sprite for a player. */
  get(playerId: string): PooledSprite | undefined {
    return this.activeMap.get(playerId);
  }

  /** Update sprite position (for interpolation). */
  updatePosition(playerId: string, x: number, y: number): void {
    const entry = this.activeMap.get(playerId);
    if (!entry) return;
    entry.sprite.setPosition(x, y);
    entry.label.setPosition(x, y - 20);
  }

  /** Get current pool stats. */
  getStats(): { active: number; idle: number; total: number; created: number; recycled: number } {
    const active = this.activeMap.size;
    const total = this.pool.length;
    return {
      active,
      idle: total - active,
      total,
      created: this.lifetimeCreated,
      recycled: this.lifetimeRecycled,
    };
  }

  /** Release all sprites and clean up. */
  destroy(): void {
    for (const entry of this.pool) {
      entry.sprite.destroy();
      entry.label.destroy();
    }
    this.pool = [];
    this.activeMap.clear();
  }

  private emitStats(): void {
    eventBus.emit('TELEMETRY:POOL', this.getStats());
  }

  private getVariantOffset(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    return PLAYER_VARIANTS[Math.abs(hash) % PLAYER_VARIANTS.length];
  }
}
