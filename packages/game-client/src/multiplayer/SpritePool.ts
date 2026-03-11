import Phaser from 'phaser';
import eventBus from '../EventBus';
import type { AvatarConfig } from '@flipfeeds/shared';
import { getAvatarFrames, DEFAULT_AVATAR } from '@flipfeeds/shared';

interface PooledSprite {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  active: boolean;
  playerId: string | null;
  variant: number;
  avatarConfig: AvatarConfig;
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
  acquire(playerId: string, x: number, y: number, name?: string, avatarConfig?: AvatarConfig): PooledSprite {
    const existing = this.activeMap.get(playerId);
    if (existing) {
      // Update avatar if a new config was provided (sprite may have been
      // created with defaults before the real avatar data arrived)
      if (avatarConfig && JSON.stringify(avatarConfig) !== JSON.stringify(existing.avatarConfig)) {
        existing.avatarConfig = avatarConfig;
        const frames = getAvatarFrames(avatarConfig);
        existing.sprite.setFrame(frames.idleDown);
      }
      // Update name if provided
      if (name) {
        existing.label.setText(name);
      }
      return existing;
    }

    let entry = this.pool.find(s => !s.active);

    if (entry) {
      entry.active = true;
      entry.playerId = playerId;
      entry.sprite.setPosition(x, y);
      entry.sprite.setVisible(true);
      entry.sprite.setActive(true);
      entry.label.setText(name || playerId.slice(0, 6));
      entry.label.setPosition(x, y - 18);
      entry.label.setVisible(true);
      // Update avatar config and sprite frame for recycled sprites
      const config = avatarConfig || entry.avatarConfig || { characterType: 0, colorVariant: this.getVariantIndex(playerId) };
      entry.avatarConfig = config;
      const frames = getAvatarFrames(config);
      entry.sprite.setFrame(frames.idleDown);
      this.lifetimeRecycled++;
    } else {
      const config = avatarConfig || { characterType: 0, colorVariant: this.getVariantIndex(playerId) };
      const frames = getAvatarFrames(config);
      const sprite = this.scene.add.sprite(x, y, 'creatures', frames.idleDown);
      sprite.setDepth(3);
      this.scene.physics.add.existing(sprite);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(16, 16);
      body.setOffset(4, 8);

      const label = this.scene.add.text(x, y - 18, name || playerId.slice(0, 6), {
        fontSize: '9px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#1a1a2ecc',
        padding: { x: 4, y: 2 },
        shadow: {
          offsetX: 0,
          offsetY: 1,
          color: '#000000',
          blur: 2,
          fill: true,
        },
      }).setOrigin(0.5).setDepth(5);

      const variant = this.getVariantOffset(playerId);
      entry = { sprite, label, active: true, playerId, variant, avatarConfig: config };
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
    entry.label.setPosition(x, y - 18);
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

  /** Get variant index (0-3) from player ID hash — for fallback when no avatar config. */
  private getVariantIndex(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % PLAYER_VARIANTS.length;
  }
}
