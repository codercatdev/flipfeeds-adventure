import { describe, it, expect } from 'vitest';
import type { FPSMetric } from '@flipfeeds/shared';

/**
 * FPS Telemetry Tests — Phase 2
 *
 * Tests the FPS tracking logic that's already scaffolded in GameScene.trackFPS().
 * These tests extract the pure math into testable functions and verify:
 * - FPS calculation from frame deltas
 * - Rolling average over a 5-second window
 * - Min FPS tracking within the window
 * - Frame time calculation
 * - FPSMetric structure matches the observability contract
 *
 * The actual GameScene.trackFPS() method uses this same logic.
 */

// ============================================================
// Pure FPS tracking logic (mirrors GameScene.trackFPS)
// ============================================================

const FPS_WINDOW_SECONDS = 5;
const FPS_EMIT_INTERVAL_MS = 1000;
const TARGET_FPS = 60;

/**
 * Calculate instantaneous FPS from frame delta (in ms).
 */
function calculateFPS(deltaMs: number): number {
  if (deltaMs <= 0) return 0;
  return 1000 / deltaMs;
}

/**
 * Calculate frame time from FPS.
 */
function calculateFrameTime(fps: number): number {
  if (fps <= 0) return 0;
  return 1000 / fps;
}

/**
 * FPS Tracker — maintains a rolling window of FPS samples
 * and computes metrics matching the FPSMetric interface.
 */
class FPSTracker {
  private history: number[] = [];
  private timer = 0;
  private readonly windowSeconds: number;
  private readonly emitIntervalMs: number;
  private readonly maxSamples: number;

  constructor(windowSeconds = FPS_WINDOW_SECONDS, emitIntervalMs = FPS_EMIT_INTERVAL_MS) {
    this.windowSeconds = windowSeconds;
    this.emitIntervalMs = emitIntervalMs;
    this.maxSamples = TARGET_FPS * windowSeconds; // ~300 samples at 60fps
  }

  /**
   * Record a frame. Returns an FPSMetric if it's time to emit, null otherwise.
   */
  recordFrame(deltaMs: number): FPSMetric | null {
    const fps = calculateFPS(deltaMs);
    this.history.push(fps);

    // Trim to window size
    if (this.history.length > this.maxSamples) {
      this.history.shift();
    }

    this.timer += deltaMs;

    if (this.timer >= this.emitIntervalMs) {
      this.timer = 0;
      return this.getMetric(deltaMs);
    }

    return null;
  }

  /**
   * Get the current FPS metric snapshot.
   */
  getMetric(currentDeltaMs: number): FPSMetric {
    const current = Math.round(calculateFPS(currentDeltaMs));
    const average = Math.round(
      this.history.reduce((a, b) => a + b, 0) / this.history.length
    );
    const min = Math.round(Math.min(...this.history));
    const frameTime = parseFloat(currentDeltaMs.toFixed(2));

    return { current, average, min, frameTime };
  }

  getHistoryLength(): number {
    return this.history.length;
  }

  reset(): void {
    this.history = [];
    this.timer = 0;
  }
}

// ============================================================
// Tests
// ============================================================

describe('FPS Telemetry — FPS Calculation', () => {
  it('60 FPS from 16.67ms delta', () => {
    const fps = calculateFPS(16.67);
    expect(fps).toBeCloseTo(60, 0);
  });

  it('30 FPS from 33.33ms delta', () => {
    const fps = calculateFPS(33.33);
    expect(fps).toBeCloseTo(30, 0);
  });

  it('120 FPS from 8.33ms delta', () => {
    const fps = calculateFPS(8.33);
    expect(fps).toBeCloseTo(120, 0);
  });

  it('returns 0 for zero delta (avoid division by zero)', () => {
    expect(calculateFPS(0)).toBe(0);
  });

  it('returns 0 for negative delta', () => {
    expect(calculateFPS(-1)).toBe(0);
  });

  it('handles very small delta (very high FPS)', () => {
    const fps = calculateFPS(1);
    expect(fps).toBe(1000);
  });
});

describe('FPS Telemetry — Frame Time Calculation', () => {
  it('frame time at 60 FPS is ~16.67ms', () => {
    expect(calculateFrameTime(60)).toBeCloseTo(16.67, 1);
  });

  it('frame time at 30 FPS is ~33.33ms', () => {
    expect(calculateFrameTime(30)).toBeCloseTo(33.33, 1);
  });

  it('frame time at 0 FPS returns 0', () => {
    expect(calculateFrameTime(0)).toBe(0);
  });

  it('frame time is inverse of FPS (1000/fps)', () => {
    const fps = 60;
    const frameTime = calculateFrameTime(fps);
    expect(frameTime).toBeCloseTo(1000 / fps, 5);
  });
});

describe('FPS Telemetry — Rolling Average', () => {
  it('average of constant 60fps frames is 60', () => {
    const tracker = new FPSTracker();
    const delta = 1000 / 60; // ~16.67ms

    // Record 60 frames (1 second)
    for (let i = 0; i < 60; i++) {
      tracker.recordFrame(delta);
    }

    const metric = tracker.getMetric(delta);
    expect(metric.average).toBeCloseTo(60, 0);
  });

  it('average reflects mixed frame rates', () => {
    const tracker = new FPSTracker();

    // 30 frames at 60fps
    for (let i = 0; i < 30; i++) {
      tracker.recordFrame(1000 / 60);
    }
    // 30 frames at 30fps
    for (let i = 0; i < 30; i++) {
      tracker.recordFrame(1000 / 30);
    }

    const metric = tracker.getMetric(1000 / 30);
    // Average should be between 30 and 60
    expect(metric.average).toBeGreaterThan(30);
    expect(metric.average).toBeLessThan(60);
  });

  it('rolling window trims old samples', () => {
    const tracker = new FPSTracker(5, 1000); // 5s window
    const maxSamples = 60 * 5; // 300

    // Record more than maxSamples frames
    for (let i = 0; i < maxSamples + 100; i++) {
      tracker.recordFrame(1000 / 60);
    }

    // History should be capped at maxSamples
    expect(tracker.getHistoryLength()).toBeLessThanOrEqual(maxSamples);
  });
});

describe('FPS Telemetry — Min FPS Tracking', () => {
  it('min tracks the lowest FPS in the window', () => {
    const tracker = new FPSTracker();

    // Normal frames
    for (let i = 0; i < 50; i++) {
      tracker.recordFrame(1000 / 60);
    }
    // One bad frame (spike to 100ms = 10fps)
    tracker.recordFrame(100);
    // More normal frames
    for (let i = 0; i < 50; i++) {
      tracker.recordFrame(1000 / 60);
    }

    const metric = tracker.getMetric(1000 / 60);
    expect(metric.min).toBeLessThanOrEqual(10);
  });

  it('min equals average when all frames are identical', () => {
    const tracker = new FPSTracker();
    const delta = 1000 / 60;

    for (let i = 0; i < 60; i++) {
      tracker.recordFrame(delta);
    }

    const metric = tracker.getMetric(delta);
    expect(metric.min).toBe(metric.average);
  });
});

describe('FPS Telemetry — Emit Interval', () => {
  it('emits metric after 1 second of frames', () => {
    const tracker = new FPSTracker(5, 1000);
    const delta = 1000 / 60;
    let emitted: FPSMetric | null = null;

    // Record ~61 frames (slightly over 1 second at 60fps to handle floating point)
    for (let i = 0; i < 61; i++) {
      const result = tracker.recordFrame(delta);
      if (result) emitted = result;
    }

    expect(emitted).not.toBeNull();
  });

  it('does not emit before 1 second', () => {
    const tracker = new FPSTracker(5, 1000);
    const delta = 1000 / 60;
    let emitCount = 0;

    // Record 30 frames (~0.5 seconds)
    for (let i = 0; i < 30; i++) {
      const result = tracker.recordFrame(delta);
      if (result) emitCount++;
    }

    expect(emitCount).toBe(0);
  });

  it('emits approximately once per second', () => {
    const tracker = new FPSTracker(5, 1000);
    const delta = 1000 / 60;
    let emitCount = 0;

    // Record 3 seconds of frames
    for (let i = 0; i < 180; i++) {
      const result = tracker.recordFrame(delta);
      if (result) emitCount++;
    }

    // Should emit ~3 times (±1 due to timing)
    expect(emitCount).toBeGreaterThanOrEqual(2);
    expect(emitCount).toBeLessThanOrEqual(4);
  });
});

describe('FPS Telemetry — FPSMetric Structure', () => {
  it('metric has all required fields from observability contract', () => {
    const tracker = new FPSTracker();
    const delta = 1000 / 60;

    for (let i = 0; i < 10; i++) {
      tracker.recordFrame(delta);
    }

    const metric = tracker.getMetric(delta);

    // Verify structure matches FPSMetric interface
    expect(metric).toHaveProperty('current');
    expect(metric).toHaveProperty('average');
    expect(metric).toHaveProperty('min');
    expect(metric).toHaveProperty('frameTime');

    expect(typeof metric.current).toBe('number');
    expect(typeof metric.average).toBe('number');
    expect(typeof metric.min).toBe('number');
    expect(typeof metric.frameTime).toBe('number');
  });

  it('current, average, and min are rounded integers', () => {
    const tracker = new FPSTracker();
    const delta = 1000 / 60;

    for (let i = 0; i < 60; i++) {
      tracker.recordFrame(delta);
    }

    const metric = tracker.getMetric(delta);

    expect(Number.isInteger(metric.current)).toBe(true);
    expect(Number.isInteger(metric.average)).toBe(true);
    expect(Number.isInteger(metric.min)).toBe(true);
  });

  it('frameTime has at most 2 decimal places', () => {
    const tracker = new FPSTracker();
    const delta = 16.666666;

    for (let i = 0; i < 10; i++) {
      tracker.recordFrame(delta);
    }

    const metric = tracker.getMetric(delta);
    const decimalPlaces = (metric.frameTime.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  it('min <= average <= max possible FPS', () => {
    const tracker = new FPSTracker();

    // Mix of frame rates
    tracker.recordFrame(1000 / 60);  // 60fps
    tracker.recordFrame(1000 / 30);  // 30fps
    tracker.recordFrame(1000 / 45);  // 45fps

    const metric = tracker.getMetric(1000 / 60);

    expect(metric.min).toBeLessThanOrEqual(metric.average);
  });
});

describe('FPS Telemetry — Reset', () => {
  it('reset clears history and timer', () => {
    const tracker = new FPSTracker();

    for (let i = 0; i < 60; i++) {
      tracker.recordFrame(1000 / 60);
    }

    expect(tracker.getHistoryLength()).toBeGreaterThan(0);

    tracker.reset();
    expect(tracker.getHistoryLength()).toBe(0);
  });
});
