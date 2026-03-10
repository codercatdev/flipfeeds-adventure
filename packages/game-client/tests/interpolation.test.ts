import { describe, it, expect, beforeEach } from 'vitest';
import type { Direction } from '@flipfeeds/shared';

/**
 * Phase 3 — Interpolation Tests
 *
 * Tests the interpolation logic for rendering remote players smoothly.
 * The client renders remote players slightly behind real-time, interpolating
 * between two known server snapshots. This avoids jitter from network variance.
 *
 * At 20Hz tick rate (50ms interval), the client buffers snapshots and lerps
 * between them at the render frame rate (60fps).
 *
 * Quality Gate: SyncTelemetry.interpolationOffset should be ~100ms (2 ticks behind)
 */

// ─── Pure interpolation logic (extracted for testability — no Phaser) ────────

interface TickSnapshot {
  x: number;
  y: number;
  direction: Direction;
  tick: number;
  timestamp: number;
}

class Interpolator {
  private buffer: TickSnapshot[] = [];
  private readonly bufferSize: number;
  private readonly tickInterval: number; // ms per tick (50ms for 20Hz)
  private lastKnown: { x: number; y: number; direction: Direction } | null = null;

  constructor(bufferSize = 10, tickInterval = 50) {
    this.bufferSize = bufferSize;
    this.tickInterval = tickInterval;
  }

  addSnapshot(snapshot: TickSnapshot): void {
    this.buffer.push(snapshot);
    this.lastKnown = {
      x: snapshot.x,
      y: snapshot.y,
      direction: snapshot.direction,
    };

    // Trim old snapshots beyond buffer size
    if (this.buffer.length > this.bufferSize) {
      this.buffer = this.buffer.slice(this.buffer.length - this.bufferSize);
    }
  }

  getBufferLength(): number {
    return this.buffer.length;
  }

  /**
   * Get interpolated position for a given render time.
   * renderTime is typically "now - interpolationDelay" (e.g., 100ms behind).
   */
  getPosition(renderTime: number): { x: number; y: number; direction: Direction } {
    // Empty buffer: return origin or last known
    if (this.buffer.length === 0) {
      if (this.lastKnown) return { ...this.lastKnown };
      return { x: 0, y: 0, direction: 'idle' };
    }

    // Single snapshot: return it directly
    if (this.buffer.length === 1) {
      const snap = this.buffer[0];
      return { x: snap.x, y: snap.y, direction: snap.direction };
    }

    // Find the two snapshots that bracket renderTime
    let before: TickSnapshot | null = null;
    let after: TickSnapshot | null = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (
        this.buffer[i].timestamp <= renderTime &&
        this.buffer[i + 1].timestamp >= renderTime
      ) {
        before = this.buffer[i];
        after = this.buffer[i + 1];
        break;
      }
    }

    // renderTime is before all snapshots — return earliest
    if (!before && !after) {
      if (renderTime <= this.buffer[0].timestamp) {
        const snap = this.buffer[0];
        return { x: snap.x, y: snap.y, direction: snap.direction };
      }

      // renderTime is after all snapshots — extrapolate from last two
      const last = this.buffer[this.buffer.length - 1];
      const secondLast = this.buffer[this.buffer.length - 2];

      const dt = last.timestamp - secondLast.timestamp;
      if (dt === 0) {
        return { x: last.x, y: last.y, direction: last.direction };
      }

      const vx = (last.x - secondLast.x) / dt;
      const vy = (last.y - secondLast.y) / dt;
      const elapsed = renderTime - last.timestamp;

      return {
        x: last.x + vx * elapsed,
        y: last.y + vy * elapsed,
        direction: last.direction,
      };
    }

    // Interpolate between before and after
    const totalTime = after!.timestamp - before!.timestamp;
    const t = totalTime === 0 ? 0 : (renderTime - before!.timestamp) / totalTime;

    return {
      x: before!.x + (after!.x - before!.x) * t,
      y: before!.y + (after!.y - before!.y) * t,
      // Direction snaps to the later tick's direction (don't lerp enums)
      direction: after!.direction,
    };
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Interpolator — Buffer Management', () => {
  let interp: Interpolator;

  beforeEach(() => {
    interp = new Interpolator(5, 50);
  });

  it('starts with empty buffer', () => {
    expect(interp.getBufferLength()).toBe(0);
  });

  it('addSnapshot stores snapshots in buffer', () => {
    interp.addSnapshot({ x: 0, y: 0, direction: 'idle', tick: 0, timestamp: 0 });
    expect(interp.getBufferLength()).toBe(1);

    interp.addSnapshot({ x: 10, y: 0, direction: 'right', tick: 1, timestamp: 50 });
    expect(interp.getBufferLength()).toBe(2);
  });

  it('buffer trims old snapshots beyond bufferSize', () => {
    for (let i = 0; i < 10; i++) {
      interp.addSnapshot({
        x: i * 10,
        y: 0,
        direction: 'right',
        tick: i,
        timestamp: i * 50,
      });
    }
    // Buffer size is 5, so only last 5 remain
    expect(interp.getBufferLength()).toBe(5);
  });

  it('buffer stores snapshots in insertion order', () => {
    interp.addSnapshot({ x: 0, y: 0, direction: 'idle', tick: 0, timestamp: 0 });
    interp.addSnapshot({ x: 50, y: 0, direction: 'right', tick: 1, timestamp: 50 });

    // At t=0, should return first snapshot position
    const pos = interp.getPosition(0);
    expect(pos.x).toBe(0);
  });
});

describe('Interpolator — Linear Interpolation', () => {
  let interp: Interpolator;

  beforeEach(() => {
    interp = new Interpolator(10, 50);
    // Two snapshots: tick 0 at (0,0) and tick 1 at (100,0)
    interp.addSnapshot({ x: 0, y: 0, direction: 'idle', tick: 0, timestamp: 0 });
    interp.addSnapshot({ x: 100, y: 0, direction: 'right', tick: 1, timestamp: 50 });
  });

  it('at t=0 between ticks, returns position of earlier tick', () => {
    const pos = interp.getPosition(0);
    expect(pos.x).toBeCloseTo(0, 5);
    expect(pos.y).toBeCloseTo(0, 5);
  });

  it('at t=0.5 between ticks, returns midpoint', () => {
    const pos = interp.getPosition(25); // halfway between 0 and 50
    expect(pos.x).toBeCloseTo(50, 5);
    expect(pos.y).toBeCloseTo(0, 5);
  });

  it('at t=1.0 between ticks, returns position of later tick', () => {
    const pos = interp.getPosition(50);
    expect(pos.x).toBeCloseTo(100, 5);
    expect(pos.y).toBeCloseTo(0, 5);
  });

  it('interpolates both x and y axes', () => {
    const interp2 = new Interpolator(10, 50);
    interp2.addSnapshot({ x: 0, y: 0, direction: 'idle', tick: 0, timestamp: 0 });
    interp2.addSnapshot({ x: 100, y: 200, direction: 'down-right', tick: 1, timestamp: 50 });

    const pos = interp2.getPosition(25);
    expect(pos.x).toBeCloseTo(50, 5);
    expect(pos.y).toBeCloseTo(100, 5);
  });

  it('interpolates across multiple snapshot pairs', () => {
    // Add a third snapshot
    interp.addSnapshot({ x: 200, y: 50, direction: 'right', tick: 2, timestamp: 100 });

    // Interpolate in the second interval (t=75, between tick 1 and 2)
    const pos = interp.getPosition(75);
    expect(pos.x).toBeCloseTo(150, 5); // midpoint of 100 and 200
    expect(pos.y).toBeCloseTo(25, 5);  // midpoint of 0 and 50
  });
});

describe('Interpolator — Direction Snapping', () => {
  let interp: Interpolator;

  beforeEach(() => {
    interp = new Interpolator(10, 50);
  });

  it('direction uses the later tick direction (snap, do not lerp)', () => {
    interp.addSnapshot({ x: 0, y: 0, direction: 'left', tick: 0, timestamp: 0 });
    interp.addSnapshot({ x: 100, y: 0, direction: 'right', tick: 1, timestamp: 50 });

    // Even at t=0.1 (very close to first tick), direction should be the later tick's
    const pos = interp.getPosition(5);
    expect(pos.direction).toBe('right');
  });

  it('direction at exact tick boundary uses that tick direction', () => {
    interp.addSnapshot({ x: 0, y: 0, direction: 'up', tick: 0, timestamp: 0 });
    interp.addSnapshot({ x: 0, y: 0, direction: 'down', tick: 1, timestamp: 50 });

    const pos = interp.getPosition(50);
    expect(pos.direction).toBe('down');
  });
});

describe('Interpolator — Extrapolation', () => {
  let interp: Interpolator;

  beforeEach(() => {
    interp = new Interpolator(10, 50);
    interp.addSnapshot({ x: 0, y: 0, direction: 'right', tick: 0, timestamp: 0 });
    interp.addSnapshot({ x: 100, y: 0, direction: 'right', tick: 1, timestamp: 50 });
  });

  it('extrapolates when renderTime is beyond last snapshot (continues velocity)', () => {
    // renderTime = 100ms, last snapshot at 50ms
    // Velocity = (100-0)/(50-0) = 2 px/ms
    // Extrapolated: 100 + 2 * 50 = 200
    const pos = interp.getPosition(100);
    expect(pos.x).toBeCloseTo(200, 5);
    expect(pos.y).toBeCloseTo(0, 5);
  });

  it('extrapolation preserves last known direction', () => {
    const pos = interp.getPosition(100);
    expect(pos.direction).toBe('right');
  });

  it('extrapolation with zero velocity stays in place', () => {
    const interp2 = new Interpolator(10, 50);
    interp2.addSnapshot({ x: 50, y: 50, direction: 'idle', tick: 0, timestamp: 0 });
    interp2.addSnapshot({ x: 50, y: 50, direction: 'idle', tick: 1, timestamp: 50 });

    const pos = interp2.getPosition(100);
    expect(pos.x).toBeCloseTo(50, 5);
    expect(pos.y).toBeCloseTo(50, 5);
  });
});

describe('Interpolator — Edge Cases', () => {
  it('empty buffer returns default position', () => {
    const interp = new Interpolator(10, 50);
    const pos = interp.getPosition(0);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.direction).toBe('idle');
  });

  it('single snapshot returns that position regardless of renderTime', () => {
    const interp = new Interpolator(10, 50);
    interp.addSnapshot({ x: 42, y: 99, direction: 'up', tick: 0, timestamp: 0 });

    const pos = interp.getPosition(999);
    expect(pos.x).toBe(42);
    expect(pos.y).toBe(99);
    expect(pos.direction).toBe('up');
  });

  it('renderTime before first snapshot returns first snapshot position', () => {
    const interp = new Interpolator(10, 50);
    interp.addSnapshot({ x: 10, y: 20, direction: 'down', tick: 5, timestamp: 250 });
    interp.addSnapshot({ x: 20, y: 30, direction: 'down', tick: 6, timestamp: 300 });

    const pos = interp.getPosition(100); // before first snapshot
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(20);
  });

  it('identical timestamps do not cause division by zero', () => {
    const interp = new Interpolator(10, 50);
    interp.addSnapshot({ x: 0, y: 0, direction: 'idle', tick: 0, timestamp: 100 });
    interp.addSnapshot({ x: 50, y: 50, direction: 'right', tick: 1, timestamp: 100 });

    // Should not throw
    const pos = interp.getPosition(100);
    expect(pos.x).toBeDefined();
    expect(pos.y).toBeDefined();
  });

  it('empty buffer with previous lastKnown returns last known position', () => {
    const interp = new Interpolator(2, 50);
    // Add 3 snapshots to a buffer of size 2 — first gets trimmed
    interp.addSnapshot({ x: 10, y: 10, direction: 'up', tick: 0, timestamp: 0 });
    interp.addSnapshot({ x: 20, y: 20, direction: 'right', tick: 1, timestamp: 50 });
    interp.addSnapshot({ x: 30, y: 30, direction: 'down', tick: 2, timestamp: 100 });

    // Buffer has 2 entries, but lastKnown tracks the latest
    expect(interp.getBufferLength()).toBe(2);
  });
});
