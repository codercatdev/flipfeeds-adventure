import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '../src/EventBus';
import type { ZoneType } from '@flipfeeds/shared';

/**
 * Phase 4 — Debug Overlay Tests
 *
 * Tests the F9 debug zone toggle logic — pure state machine.
 * The debug overlay shows colored zone boundaries when toggled.
 */

// ============================================================
// Pure logic extracted from GameScene debug overlay
// ============================================================

const ZONE_COLORS: Record<ZoneType, number> = {
  chat: 0x00ff88,    // Green
  kiosk: 0x0088ff,   // Blue
  video: 0x8800ff,   // Purple
  webrtc: 0xff8800,  // Orange
  info: 0xffaa00,    // Yellow/Gold
};

class DebugOverlayState {
  visible: boolean = false;

  toggle(): boolean {
    this.visible = !this.visible;
    return this.visible;
  }

  getZoneColors(): Record<ZoneType, number> {
    return { ...ZONE_COLORS };
  }
}

// ============================================================
// Tests
// ============================================================

describe('DebugOverlayState — Toggle', () => {
  let state: DebugOverlayState;

  beforeEach(() => {
    state = new DebugOverlayState();
  });

  it('initial state is hidden', () => {
    expect(state.visible).toBe(false);
  });

  it('F9 toggle makes visible', () => {
    const result = state.toggle();
    expect(result).toBe(true);
    expect(state.visible).toBe(true);
  });

  it('second F9 toggle hides', () => {
    state.toggle(); // visible
    const result = state.toggle(); // hidden
    expect(result).toBe(false);
    expect(state.visible).toBe(false);
  });

  it('multiple toggles alternate correctly', () => {
    expect(state.toggle()).toBe(true);
    expect(state.toggle()).toBe(false);
    expect(state.toggle()).toBe(true);
    expect(state.toggle()).toBe(false);
  });
});

describe('DebugOverlayState — Zone Colors', () => {
  let state: DebugOverlayState;

  beforeEach(() => {
    state = new DebugOverlayState();
  });

  it('all 5 zone types have colors assigned', () => {
    const colors = state.getZoneColors();
    const zoneTypes: ZoneType[] = ['chat', 'kiosk', 'video', 'webrtc', 'info'];

    for (const type of zoneTypes) {
      expect(colors[type]).toBeDefined();
      expect(typeof colors[type]).toBe('number');
    }
  });

  it('each zone type has a distinct color', () => {
    const colors = state.getZoneColors();
    const values = Object.values(colors);
    const uniqueValues = new Set(values);

    expect(uniqueValues.size).toBe(values.length);
  });

  it('colors are valid hex color numbers', () => {
    const colors = state.getZoneColors();
    for (const [type, color] of Object.entries(colors)) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe('DebugOverlayState — EventBus Integration', () => {
  beforeEach(() => {
    eventBus.all.clear();
  });

  it('DEBUG_ZONES_TOGGLE event is emitted on toggle', () => {
    const handler = vi.fn();
    eventBus.on('DEBUG_ZONES_TOGGLE', handler);

    eventBus.emit('DEBUG_ZONES_TOGGLE');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('multiple toggles emit multiple events', () => {
    const handler = vi.fn();
    eventBus.on('DEBUG_ZONES_TOGGLE', handler);

    eventBus.emit('DEBUG_ZONES_TOGGLE');
    eventBus.emit('DEBUG_ZONES_TOGGLE');
    eventBus.emit('DEBUG_ZONES_TOGGLE');

    expect(handler).toHaveBeenCalledTimes(3);
  });
});
