import eventBus from '../EventBus';

interface PooledSprite {
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  active: boolean;
  playerId: string | null;
}

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
    // Check if already active
    const existing = this.activeMap.get(playerId);
    if (existing) return existing;

    // Try to reuse from pool
    let sprite = this.pool.find((s) => !s.active);

    if (sprite) {
      // Recycle existing sprite
      sprite.active = true;
      sprite.playerId = playerId;
      sprite.circle.setPosition(x, y);
      sprite.circle.setVisible(true);
      sprite.circle.setActive(true);
      sprite.label.setText(name || playerId.slice(0, 6));
      sprite.label.setPosition(x, y - 16);
      sprite.label.setVisible(true);
      this.lifetimeRecycled++;
    } else {
      // Create new sprite
      const circle = this.scene.add.circle(
        x,
        y,
        8,
        this.getPlayerColor(playerId),
      );
      circle.setDepth(3);
      this.scene.physics.add.existing(circle);

      const label = this.scene.add
        .text(x, y - 16, name || playerId.slice(0, 6), {
          fontSize: '10px',
          color: '#ffffff',
          fontFamily: 'monospace',
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(5);

      sprite = { circle, label, active: true, playerId };
      this.pool.push(sprite);
      this.lifetimeCreated++;
    }

    this.activeMap.set(playerId, sprite);
    this.emitStats();
    return sprite;
  }

  /** Release a sprite back to the pool. */
  release(playerId: string): void {
    const sprite = this.activeMap.get(playerId);
    if (!sprite) return;

    sprite.active = false;
    sprite.playerId = null;
    sprite.circle.setVisible(false);
    sprite.circle.setActive(false);
    sprite.label.setVisible(false);

    this.activeMap.delete(playerId);
    this.emitStats();
  }

  /** Get the sprite for a player. */
  get(playerId: string): PooledSprite | undefined {
    return this.activeMap.get(playerId);
  }

  /** Update sprite position (for interpolation). */
  updatePosition(playerId: string, x: number, y: number): void {
    const sprite = this.activeMap.get(playerId);
    if (!sprite) return;
    sprite.circle.setPosition(x, y);
    sprite.label.setPosition(x, y - 16);
  }

  /** Get current pool stats. */
  getStats(): {
    active: number;
    idle: number;
    total: number;
    created: number;
    recycled: number;
  } {
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
    for (const sprite of this.pool) {
      sprite.circle.destroy();
      sprite.label.destroy();
    }
    this.pool = [];
    this.activeMap.clear();
  }

  private emitStats(): void {
    eventBus.emit('TELEMETRY:POOL', this.getStats());
  }

  private getPlayerColor(id: string): number {
    // Generate a consistent color from player ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    // Ensure bright, saturated colors (avoid dark/muddy)
    const hue = Math.abs(hash) % 360;
    return Phaser.Display.Color.HSLToColor(hue / 360, 0.7, 0.6).color;
  }
}
