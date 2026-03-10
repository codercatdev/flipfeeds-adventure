import { describe, it, expect, beforeEach } from 'vitest';
import type { PoolStats } from '@flipfeeds/shared';

/**
 * Phase 3 — Object Pool Tests
 *
 * Tests the sprite object pool used to manage remote player sprites.
 * Instead of creating/destroying sprites on every join/leave, the pool
 * recycles them. This prevents GC pressure and Phaser texture thrashing.
 *
 * Quality Gates:
 *   - PoolStats.created plateaus after 10 join/leave cycles
 *   - PoolStats.recycled / created approaches 1.0
 */

// ─── Pure object pool logic (extracted for testability — no Phaser) ──────────

class ObjectPool<T> {
  private active: Map<string, T> = new Map();
  private idle: T[] = [];
  private _stats: PoolStats = {
    active: 0,
    idle: 0,
    total: 0,
    created: 0,
    recycled: 0,
  };

  constructor(private factory: () => T) {}

  acquire(id: string): T {
    // Double acquire: return existing
    if (this.active.has(id)) {
      return this.active.get(id)!;
    }

    let obj: T;
    if (this.idle.length > 0) {
      obj = this.idle.pop()!;
      this._stats.recycled++;
    } else {
      obj = this.factory();
      this._stats.created++;
    }

    this.active.set(id, obj);
    this.updateCounts();
    return obj;
  }

  release(id: string): void {
    const obj = this.active.get(id);
    if (!obj) return; // no-op for unknown id

    this.active.delete(id);
    this.idle.push(obj);
    this.updateCounts();
  }

  getStats(): PoolStats {
    return { ...this._stats };
  }

  has(id: string): boolean {
    return this.active.has(id);
  }

  getActive(): Map<string, T> {
    return new Map(this.active);
  }

  private updateCounts(): void {
    this._stats.active = this.active.size;
    this._stats.idle = this.idle.length;
    this._stats.total = this._stats.active + this._stats.idle;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ObjectPool — Acquire & Release', () => {
  let pool: ObjectPool<{ id: number }>;
  let createCount: number;

  beforeEach(() => {
    createCount = 0;
    pool = new ObjectPool(() => ({ id: ++createCount }));
  });

  it('acquire creates new object when pool is empty', () => {
    const obj = pool.acquire('player-1');
    expect(obj).toBeDefined();
    expect(obj.id).toBe(1);
    expect(pool.getStats().created).toBe(1);
  });

  it('acquire reuses idle object when available', () => {
    pool.acquire('player-1');
    pool.release('player-1');

    const obj = pool.acquire('player-2');
    expect(obj.id).toBe(1); // same object reused
    expect(pool.getStats().recycled).toBe(1);
    expect(pool.getStats().created).toBe(1); // no new creation
  });

  it('release moves object from active to idle', () => {
    pool.acquire('player-1');
    expect(pool.getStats().active).toBe(1);
    expect(pool.getStats().idle).toBe(0);

    pool.release('player-1');
    expect(pool.getStats().active).toBe(0);
    expect(pool.getStats().idle).toBe(1);
  });

  it('release of unknown id is a no-op (no crash)', () => {
    expect(() => pool.release('nonexistent')).not.toThrow();
    expect(pool.getStats().active).toBe(0);
    expect(pool.getStats().idle).toBe(0);
  });

  it('double acquire with same id returns existing (no duplicate)', () => {
    const obj1 = pool.acquire('player-1');
    const obj2 = pool.acquire('player-1');

    expect(obj1).toBe(obj2); // same reference
    expect(pool.getStats().active).toBe(1);
    expect(pool.getStats().created).toBe(1);
  });

  it('double release with same id is safe', () => {
    pool.acquire('player-1');
    pool.release('player-1');

    // Second release should be a no-op
    expect(() => pool.release('player-1')).not.toThrow();
    expect(pool.getStats().idle).toBe(1); // still just 1
  });
});

describe('ObjectPool — Stats Tracking', () => {
  let pool: ObjectPool<object>;

  beforeEach(() => {
    pool = new ObjectPool(() => ({}));
  });

  it('stats.active counts currently in-use objects', () => {
    pool.acquire('a');
    pool.acquire('b');
    pool.acquire('c');

    expect(pool.getStats().active).toBe(3);
  });

  it('stats.idle counts available objects', () => {
    pool.acquire('a');
    pool.acquire('b');
    pool.release('a');
    pool.release('b');

    expect(pool.getStats().idle).toBe(2);
  });

  it('stats.total = active + idle', () => {
    pool.acquire('a');
    pool.acquire('b');
    pool.acquire('c');
    pool.release('a');

    const stats = pool.getStats();
    expect(stats.total).toBe(stats.active + stats.idle);
    expect(stats.total).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.idle).toBe(1);
  });

  it('stats.created increments on new object creation', () => {
    pool.acquire('a');
    expect(pool.getStats().created).toBe(1);

    pool.acquire('b');
    expect(pool.getStats().created).toBe(2);

    pool.acquire('c');
    expect(pool.getStats().created).toBe(3);
  });

  it('stats.recycled increments on reuse from idle pool', () => {
    pool.acquire('a');
    pool.release('a');
    expect(pool.getStats().recycled).toBe(0);

    pool.acquire('b'); // reuses the idle object
    expect(pool.getStats().recycled).toBe(1);

    pool.release('b');
    pool.acquire('c'); // reuses again
    expect(pool.getStats().recycled).toBe(2);
  });
});

describe('ObjectPool — Pool Efficiency (Quality Gates)', () => {
  it('after 10 join/leave cycles with same count, created plateaus', () => {
    const pool = new ObjectPool<object>(() => ({}));
    const PLAYER_COUNT = 5;

    // First cycle: creates all new
    for (let i = 0; i < PLAYER_COUNT; i++) {
      pool.acquire(`player-${i}`);
    }
    const createdAfterFirstCycle = pool.getStats().created;
    expect(createdAfterFirstCycle).toBe(PLAYER_COUNT);

    // Release all
    for (let i = 0; i < PLAYER_COUNT; i++) {
      pool.release(`player-${i}`);
    }

    // Cycles 2-10: should reuse, not create
    for (let cycle = 2; cycle <= 10; cycle++) {
      for (let i = 0; i < PLAYER_COUNT; i++) {
        pool.acquire(`player-cycle${cycle}-${i}`);
      }
      for (let i = 0; i < PLAYER_COUNT; i++) {
        pool.release(`player-cycle${cycle}-${i}`);
      }
    }

    const finalStats = pool.getStats();
    // Created should still be PLAYER_COUNT (plateaued after first cycle)
    expect(finalStats.created).toBe(PLAYER_COUNT);
  });

  it('recycled/created ratio approaches 1.0 over time', () => {
    const pool = new ObjectPool<object>(() => ({}));
    const PLAYER_COUNT = 3;

    // First cycle: all new
    for (let i = 0; i < PLAYER_COUNT; i++) {
      pool.acquire(`p${i}`);
    }
    for (let i = 0; i < PLAYER_COUNT; i++) {
      pool.release(`p${i}`);
    }

    // 20 more cycles: all recycled
    for (let cycle = 0; cycle < 20; cycle++) {
      for (let i = 0; i < PLAYER_COUNT; i++) {
        pool.acquire(`p-${cycle}-${i}`);
      }
      for (let i = 0; i < PLAYER_COUNT; i++) {
        pool.release(`p-${cycle}-${i}`);
      }
    }

    const stats = pool.getStats();
    // created = 3, recycled = 20 * 3 = 60
    // ratio = 60 / 3 = 20 (well above 1.0)
    // The key insight: recycled >> created means pool is efficient
    const ratio = stats.recycled / stats.created;
    expect(ratio).toBeGreaterThan(1.0);
    expect(stats.created).toBe(PLAYER_COUNT); // no new allocations
  });

  it('pool handles rapid acquire/release without memory leak', () => {
    const pool = new ObjectPool<object>(() => ({}));

    // Rapid churn: 100 cycles of 10 players
    for (let cycle = 0; cycle < 100; cycle++) {
      for (let i = 0; i < 10; i++) {
        pool.acquire(`rapid-${cycle}-${i}`);
      }
      for (let i = 0; i < 10; i++) {
        pool.release(`rapid-${cycle}-${i}`);
      }
    }

    const stats = pool.getStats();
    // Only 10 objects ever created
    expect(stats.created).toBe(10);
    // All 10 are idle now
    expect(stats.idle).toBe(10);
    expect(stats.active).toBe(0);
    // Total never exceeds 10
    expect(stats.total).toBe(10);
  });
});

describe('ObjectPool — has() and getActive()', () => {
  let pool: ObjectPool<object>;

  beforeEach(() => {
    pool = new ObjectPool(() => ({}));
  });

  it('has() returns true for active objects', () => {
    pool.acquire('player-1');
    expect(pool.has('player-1')).toBe(true);
  });

  it('has() returns false for released objects', () => {
    pool.acquire('player-1');
    pool.release('player-1');
    expect(pool.has('player-1')).toBe(false);
  });

  it('has() returns false for unknown ids', () => {
    expect(pool.has('nonexistent')).toBe(false);
  });

  it('getActive() returns map of active objects', () => {
    pool.acquire('a');
    pool.acquire('b');

    const active = pool.getActive();
    expect(active.size).toBe(2);
    expect(active.has('a')).toBe(true);
    expect(active.has('b')).toBe(true);
  });

  it('getActive() returns a copy (not the internal map)', () => {
    pool.acquire('a');
    const active = pool.getActive();

    // Mutating the returned map should not affect the pool
    active.delete('a');
    expect(pool.has('a')).toBe(true);
  });
});
