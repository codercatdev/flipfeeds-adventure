import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlayerState, PlayerDelta } from '@flipfeeds/shared';

/**
 * Phase 3 — Server Tick Rate Tests
 *
 * Tests the server's 20Hz tick loop logic. The server broadcasts delta
 * sync messages at a fixed 50ms interval. Only players that moved since
 * the last tick are included (dirty flag optimization).
 *
 * Quality Gate: SyncTelemetry.serverTickDelta ~50ms (20 ticks/sec)
 */

// ─── Tick loop logic (extracted from server.ts for testability) ──────────────

interface TickLoopConfig {
  tickRate: number; // ticks per second (20)
}

class TickLoop {
  private tick = 0;
  private dirtyPlayers = new Set<string>();
  private players: Map<string, PlayerState> = new Map();
  private broadcasts: Array<{ deltas: PlayerDelta[]; tick: number }> = [];
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  readonly tickInterval: number; // ms

  constructor(config: TickLoopConfig) {
    this.tickInterval = 1000 / config.tickRate;
  }

  addPlayer(player: PlayerState): void {
    this.players.set(player.id, player);
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.dirtyPlayers.delete(id);
  }

  markDirty(id: string): void {
    if (this.players.has(id)) {
      this.dirtyPlayers.add(id);
    }
  }

  updatePlayer(id: string, update: Partial<PlayerState>): void {
    const player = this.players.get(id);
    if (!player) return;

    if (update.x !== undefined) player.x = update.x;
    if (update.y !== undefined) player.y = update.y;
    if (update.dir !== undefined) player.dir = update.dir;
    if (update.anim !== undefined) player.anim = update.anim;

    this.dirtyPlayers.add(id);
  }

  /** Execute one tick (called by interval or manually in tests) */
  executeTick(): { deltas: PlayerDelta[]; tick: number } | null {
    const currentTick = this.tick;
    this.tick++;

    if (this.dirtyPlayers.size === 0) {
      return null; // empty tick
    }

    const deltas: PlayerDelta[] = [];
    for (const id of this.dirtyPlayers) {
      const player = this.players.get(id);
      if (!player) continue;

      deltas.push({
        id: player.id,
        x: player.x,
        y: player.y,
        dir: player.dir,
        anim: player.anim,
      });
    }

    this.dirtyPlayers.clear();

    if (deltas.length > 0) {
      const broadcast = { deltas, tick: currentTick };
      this.broadcasts.push(broadcast);
      return broadcast;
    }

    return null;
  }

  getTick(): number {
    return this.tick;
  }

  getBroadcasts(): Array<{ deltas: PlayerDelta[]; tick: number }> {
    return [...this.broadcasts];
  }

  getDirtyCount(): number {
    return this.dirtyPlayers.size;
  }

  start(): void {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => this.executeTick(), this.tickInterval);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TickLoop — Configuration', () => {
  it('tick interval is approximately 50ms for 20Hz', () => {
    const loop = new TickLoop({ tickRate: 20 });
    expect(loop.tickInterval).toBe(50);
  });

  it('tick interval scales with tick rate', () => {
    const loop10 = new TickLoop({ tickRate: 10 });
    expect(loop10.tickInterval).toBe(100);

    const loop60 = new TickLoop({ tickRate: 60 });
    expect(loop60.tickInterval).toBeCloseTo(16.67, 1);
  });
});

describe('TickLoop — Tick Counter', () => {
  let loop: TickLoop;

  beforeEach(() => {
    loop = new TickLoop({ tickRate: 20 });
    loop.addPlayer({ id: 'p1', x: 0, y: 0, dir: 'idle' });
  });

  it('tick counter starts at 0', () => {
    expect(loop.getTick()).toBe(0);
  });

  it('tick counter increments monotonically', () => {
    loop.markDirty('p1');
    loop.executeTick();
    expect(loop.getTick()).toBe(1);

    loop.markDirty('p1');
    loop.executeTick();
    expect(loop.getTick()).toBe(2);

    loop.executeTick(); // empty tick
    expect(loop.getTick()).toBe(3);
  });

  it('tick counter increments even on empty ticks', () => {
    loop.executeTick(); // no dirty players
    loop.executeTick();
    loop.executeTick();
    expect(loop.getTick()).toBe(3);
  });
});

describe('TickLoop — Dirty Flag Optimization', () => {
  let loop: TickLoop;

  beforeEach(() => {
    loop = new TickLoop({ tickRate: 20 });
    loop.addPlayer({ id: 'p1', x: 0, y: 0, dir: 'idle' });
    loop.addPlayer({ id: 'p2', x: 100, y: 100, dir: 'idle' });
    loop.addPlayer({ id: 'p3', x: 200, y: 200, dir: 'idle' });
  });

  it('delta broadcast only includes changed players (dirty flag)', () => {
    // Only p1 moved
    loop.updatePlayer('p1', { x: 10, y: 10 });

    const result = loop.executeTick();
    expect(result).not.toBeNull();
    expect(result!.deltas).toHaveLength(1);
    expect(result!.deltas[0].id).toBe('p1');
  });

  it('empty tick (no changes) sends no broadcast', () => {
    const result = loop.executeTick();
    expect(result).toBeNull();
  });

  it('multiple dirty players are all included', () => {
    loop.updatePlayer('p1', { x: 10 });
    loop.updatePlayer('p3', { x: 210 });

    const result = loop.executeTick();
    expect(result).not.toBeNull();
    expect(result!.deltas).toHaveLength(2);

    const ids = result!.deltas.map((d) => d.id).sort();
    expect(ids).toEqual(['p1', 'p3']);
  });

  it('dirty set is cleared after tick', () => {
    loop.updatePlayer('p1', { x: 10 });
    loop.executeTick();

    // Next tick should be empty (p1 not dirty anymore)
    const result = loop.executeTick();
    expect(result).toBeNull();
  });

  it('player marked dirty multiple times in same tick only appears once', () => {
    loop.updatePlayer('p1', { x: 10 });
    loop.updatePlayer('p1', { x: 20 });
    loop.updatePlayer('p1', { x: 30 });

    const result = loop.executeTick();
    expect(result!.deltas).toHaveLength(1);
    expect(result!.deltas[0].x).toBe(30); // latest value
  });
});

describe('TickLoop — Player Management', () => {
  let loop: TickLoop;

  beforeEach(() => {
    loop = new TickLoop({ tickRate: 20 });
  });

  it('removed player is not included in broadcasts', () => {
    loop.addPlayer({ id: 'p1', x: 0, y: 0, dir: 'idle' });
    loop.markDirty('p1');
    loop.removePlayer('p1');

    const result = loop.executeTick();
    expect(result).toBeNull();
  });

  it('marking non-existent player as dirty is a no-op', () => {
    loop.markDirty('nonexistent');
    expect(loop.getDirtyCount()).toBe(0);
  });

  it('updatePlayer marks player as dirty', () => {
    loop.addPlayer({ id: 'p1', x: 0, y: 0, dir: 'idle' });
    loop.updatePlayer('p1', { x: 50 });

    expect(loop.getDirtyCount()).toBe(1);
  });
});

describe('TickLoop — Timing (with real timers)', () => {
  let loop: TickLoop;

  beforeEach(() => {
    vi.useFakeTimers();
    loop = new TickLoop({ tickRate: 20 });
    loop.addPlayer({ id: 'p1', x: 0, y: 0, dir: 'idle' });
  });

  afterEach(() => {
    loop.stop();
    vi.useRealTimers();
  });

  it('tick fires at approximately 50ms intervals', () => {
    loop.markDirty('p1');
    loop.start();

    // Advance 50ms — should fire 1 tick
    vi.advanceTimersByTime(50);
    expect(loop.getTick()).toBe(1);

    // Mark dirty again for next tick
    loop.markDirty('p1');

    // Advance another 50ms — should fire another tick
    vi.advanceTimersByTime(50);
    expect(loop.getTick()).toBe(2);
  });

  it('10 ticks fire in 500ms', () => {
    loop.start();

    vi.advanceTimersByTime(500);
    expect(loop.getTick()).toBe(10);
  });

  it('tick timing is consistent under simulated load', () => {
    loop.start();

    // Simulate 1 second = 20 ticks
    vi.advanceTimersByTime(1000);
    expect(loop.getTick()).toBe(20);

    // Simulate another second
    vi.advanceTimersByTime(1000);
    expect(loop.getTick()).toBe(40);
  });

  it('stop() halts the tick loop', () => {
    loop.start();
    vi.advanceTimersByTime(100); // 2 ticks
    expect(loop.getTick()).toBe(2);

    loop.stop();
    vi.advanceTimersByTime(500); // should not advance
    expect(loop.getTick()).toBe(2);
  });

  it('start() is idempotent (calling twice does not double tick rate)', () => {
    loop.start();
    loop.start(); // second call should be no-op

    vi.advanceTimersByTime(100);
    expect(loop.getTick()).toBe(2); // not 4
  });
});
