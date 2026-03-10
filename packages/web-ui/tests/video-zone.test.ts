import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase 4 — Video Zone Tests
 *
 * Tests the video zone proximity audio logic — pure functions.
 * Volume decreases as distance increases, with a minimum threshold
 * below which audio is muted entirely.
 *
 * NOTE: Uses a local mock EventBus to avoid importing from
 * @flipfeeds/game-client (which pulls in Phaser/navigator).
 */

// ============================================================
// Local mock EventBus (avoids Phaser import chain)
// ============================================================

type Handler = (...args: any[]) => void;

class MockEventBus {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const h of handlers) h(...args);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

const eventBus = new MockEventBus();

// ============================================================
// Pure logic extracted from VideoPanel component
// ============================================================

const MIN_VOLUME_THRESHOLD = 0.05;

/**
 * Calculate volume based on normalized distance from zone center.
 * normalizedDistance: 0 = at center, 1 = at edge
 * Returns 0 if below minThreshold.
 */
function calculateVolume(normalizedDistance: number, minThreshold: number = MIN_VOLUME_THRESHOLD): number {
  // Volume is inverse of distance: closer = louder
  const rawVolume = 1 - normalizedDistance;

  // Clamp between 0 and 1
  const clamped = Math.max(0, Math.min(1, rawVolume));

  // Below threshold = muted
  if (clamped < minThreshold) {
    return 0;
  }

  return clamped;
}

/**
 * Video zone state machine for auto-play/pause behavior.
 */
class VideoZoneController {
  private playing = false;
  private volume = 0;
  private zoneId: string;

  constructor(zoneId: string) {
    this.zoneId = zoneId;
  }

  onZoneEnter(): { autoPlay: boolean } {
    this.playing = true;
    this.volume = 0; // Will be set by proximity updates
    return { autoPlay: true };
  }

  onZoneExit(): { paused: boolean } {
    this.playing = false;
    this.volume = 0;
    return { paused: true };
  }

  updateProximity(normalizedDistance: number): number {
    this.volume = calculateVolume(normalizedDistance);
    return this.volume;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getVolume(): number {
    return this.volume;
  }

  getZoneId(): string {
    return this.zoneId;
  }
}

// ============================================================
// Tests
// ============================================================

describe('Video Zone — calculateVolume', () => {
  it('at center (distance=0), volume = 1.0', () => {
    expect(calculateVolume(0)).toBe(1.0);
  });

  it('at edge (distance=1), volume = 0.0', () => {
    expect(calculateVolume(1)).toBe(0.0);
  });

  it('at half distance, volume = 0.5', () => {
    expect(calculateVolume(0.5)).toBe(0.5);
  });

  it('below minVolumeThreshold (0.05), volume = 0 (muted)', () => {
    // normalizedDistance = 0.96 → rawVolume = 0.04 < 0.05
    expect(calculateVolume(0.96)).toBe(0);
  });

  it('at exactly minVolumeThreshold boundary, volume is not muted', () => {
    // normalizedDistance = 0.95 → rawVolume ≈ 0.05 = threshold
    // Use toBeCloseTo to handle floating point precision
    const vol = calculateVolume(0.95);
    expect(vol).toBeCloseTo(0.05, 10);
    expect(vol).toBeGreaterThanOrEqual(MIN_VOLUME_THRESHOLD);
  });

  it('volume is clamped between 0 and 1 — negative distance', () => {
    // normalizedDistance < 0 would give volume > 1, should clamp
    expect(calculateVolume(-0.5)).toBe(1);
  });

  it('volume is clamped between 0 and 1 — distance > 1', () => {
    // normalizedDistance > 1 would give negative volume, should clamp to 0
    expect(calculateVolume(1.5)).toBe(0);
  });

  it('custom minThreshold works', () => {
    // With threshold 0.1, volume of 0.08 should be muted
    expect(calculateVolume(0.92, 0.1)).toBe(0);
    // 1 - 0.9 = 0.09999... which is < 0.1 threshold, so also muted
    // Use 0.85 to get 0.15 which is clearly above 0.1
    const vol = calculateVolume(0.85, 0.1);
    expect(vol).toBeCloseTo(0.15, 10);
    expect(vol).toBeGreaterThanOrEqual(0.1);
  });
});

describe('Video Zone — VideoZoneController', () => {
  let controller: VideoZoneController;

  beforeEach(() => {
    controller = new VideoZoneController('stage-main');
  });

  it('auto-play on zone enter', () => {
    const result = controller.onZoneEnter();
    expect(result.autoPlay).toBe(true);
    expect(controller.isPlaying()).toBe(true);
  });

  it('pause on zone exit', () => {
    controller.onZoneEnter();
    const result = controller.onZoneExit();
    expect(result.paused).toBe(true);
    expect(controller.isPlaying()).toBe(false);
  });

  it('spatial audio: volume changes with proximity', () => {
    controller.onZoneEnter();

    // Close to center
    controller.updateProximity(0.1);
    expect(controller.getVolume()).toBe(0.9);

    // Moving away
    controller.updateProximity(0.5);
    expect(controller.getVolume()).toBe(0.5);

    // At edge
    controller.updateProximity(1.0);
    expect(controller.getVolume()).toBe(0);
  });

  it('volume is 0 after zone exit', () => {
    controller.onZoneEnter();
    controller.updateProximity(0.3);
    expect(controller.getVolume()).toBe(0.7);

    controller.onZoneExit();
    expect(controller.getVolume()).toBe(0);
  });

  it('tracks zone id', () => {
    expect(controller.getZoneId()).toBe('stage-main');
  });

  it('not playing initially', () => {
    expect(controller.isPlaying()).toBe(false);
    expect(controller.getVolume()).toBe(0);
  });
});

describe('Video Zone — EventBus Integration', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it('ZONE_PROXIMITY events update volume correctly', () => {
    const volumes: number[] = [];

    eventBus.on('ZONE_PROXIMITY', (data) => {
      if (data.zoneId === 'stage-main') {
        const vol = calculateVolume(data.normalizedDistance);
        volumes.push(vol);
      }
    });

    // Simulate approaching the stage
    eventBus.emit('ZONE_PROXIMITY', {
      zoneId: 'stage-main',
      distance: 3,
      maxDistance: 4,
      normalizedDistance: 0.75,
      zoneScreenPos: { x: 200, y: 200 },
    });

    eventBus.emit('ZONE_PROXIMITY', {
      zoneId: 'stage-main',
      distance: 1,
      maxDistance: 4,
      normalizedDistance: 0.25,
      zoneScreenPos: { x: 200, y: 200 },
    });

    expect(volumes).toHaveLength(2);
    expect(volumes[0]).toBe(0.25); // Far away
    expect(volumes[1]).toBe(0.75); // Closer
  });

  it('ignores proximity events for other zones', () => {
    const handler = vi.fn();

    eventBus.on('ZONE_PROXIMITY', (data) => {
      if (data.zoneId === 'stage-main') {
        handler(calculateVolume(data.normalizedDistance));
      }
    });

    // Event for a different zone
    eventBus.emit('ZONE_PROXIMITY', {
      zoneId: 'stage-side',
      distance: 1,
      maxDistance: 3,
      normalizedDistance: 0.33,
      zoneScreenPos: { x: 100, y: 100 },
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
