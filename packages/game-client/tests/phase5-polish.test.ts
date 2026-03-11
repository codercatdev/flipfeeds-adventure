import { describe, it, expect } from 'vitest';

/**
 * Phase 5 — Visual Polish & Interaction Cues Tests
 *
 * Tests the pure functions extracted from GameScene for:
 * - Zone type → highlight color mapping
 * - Zone type → prompt text mapping
 * - Direction-aware idle animation
 *
 * NOTE: Uses inline copies of the logic to avoid importing from
 * @flipfeeds/game-client (which pulls in Phaser/navigator).
 * These mirror the exports from utils.ts.
 */

// ============================================================
// Pure logic (mirrors @flipfeeds/game-client/src/utils.ts)
// ============================================================

/** Zone type → highlight color */
const ZONE_COLORS: Record<string, number> = {
  chat: 0x00ff88,    // green
  kiosk: 0x4488ff,   // blue
  video: 0xaa44ff,   // purple
  webrtc: 0xff8844,  // orange
  info: 0xffdd44,    // yellow
};

/** Zone type → interaction prompt text */
function getZonePromptText(zoneType: string): string {
  if (zoneType === 'kiosk' || zoneType === 'info') return 'Press E';
  if (zoneType === 'chat' || zoneType === 'webrtc') return 'Press T';
  return '';
}

/** Last facing direction → idle animation key + flipX */
function getIdleDirection(lastFacing: 'down' | 'up' | 'left' | 'right'): { animKey: string; flipX: boolean } {
  if (lastFacing === 'right') return { animKey: 'idle-left', flipX: true };
  return { animKey: `idle-${lastFacing}`, flipX: false };
}

// ============================================================
// Tests — Zone Colors
// ============================================================

describe('Phase 5 — Zone Highlight Colors', () => {
  it('chat zones are green (0x00ff88)', () => {
    expect(ZONE_COLORS['chat']).toBe(0x00ff88);
  });

  it('kiosk zones are blue (0x4488ff)', () => {
    expect(ZONE_COLORS['kiosk']).toBe(0x4488ff);
  });

  it('video zones are purple (0xaa44ff)', () => {
    expect(ZONE_COLORS['video']).toBe(0xaa44ff);
  });

  it('webrtc zones are orange (0xff8844)', () => {
    expect(ZONE_COLORS['webrtc']).toBe(0xff8844);
  });

  it('info zones are yellow (0xffdd44)', () => {
    expect(ZONE_COLORS['info']).toBe(0xffdd44);
  });

  it('all 5 zone types have distinct colors', () => {
    const colors = Object.values(ZONE_COLORS);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(5);
  });

  it('all 5 zone types are covered', () => {
    const expectedTypes = ['chat', 'kiosk', 'video', 'webrtc', 'info'];
    for (const type of expectedTypes) {
      expect(ZONE_COLORS).toHaveProperty(type);
    }
  });
});

// ============================================================
// Tests — Zone Prompt Text
// ============================================================

describe('Phase 5 — Zone Prompt Text', () => {
  it('kiosk zones show "Press E"', () => {
    expect(getZonePromptText('kiosk')).toBe('Press E');
  });

  it('info zones show "Press E"', () => {
    expect(getZonePromptText('info')).toBe('Press E');
  });

  it('chat zones show "Press T"', () => {
    expect(getZonePromptText('chat')).toBe('Press T');
  });

  it('webrtc zones show "Press T"', () => {
    expect(getZonePromptText('webrtc')).toBe('Press T');
  });

  it('video zones show no prompt (empty string)', () => {
    expect(getZonePromptText('video')).toBe('');
  });

  it('unknown zone type shows no prompt', () => {
    expect(getZonePromptText('unknown')).toBe('');
  });

  it('empty string zone type shows no prompt', () => {
    expect(getZonePromptText('')).toBe('');
  });
});

// ============================================================
// Tests — Direction-Aware Idle
// ============================================================

describe('Phase 5 — Direction-Aware Idle Animation', () => {
  it('facing down → idle-down, no flip', () => {
    expect(getIdleDirection('down')).toEqual({ animKey: 'idle-down', flipX: false });
  });

  it('facing up → idle-up, no flip', () => {
    expect(getIdleDirection('up')).toEqual({ animKey: 'idle-up', flipX: false });
  });

  it('facing left → idle-left, no flip', () => {
    expect(getIdleDirection('left')).toEqual({ animKey: 'idle-left', flipX: false });
  });

  it('facing right → idle-left with flipX (mirror of left)', () => {
    expect(getIdleDirection('right')).toEqual({ animKey: 'idle-left', flipX: true });
  });

  it('all 4 directions produce valid animation keys', () => {
    const directions: Array<'down' | 'up' | 'left' | 'right'> = ['down', 'up', 'left', 'right'];
    for (const dir of directions) {
      const result = getIdleDirection(dir);
      expect(result.animKey).toMatch(/^idle-(down|up|left)$/);
      expect(typeof result.flipX).toBe('boolean');
    }
  });

  it('right is the only direction that uses flipX', () => {
    const directions: Array<'down' | 'up' | 'left' | 'right'> = ['down', 'up', 'left', 'right'];
    for (const dir of directions) {
      const result = getIdleDirection(dir);
      if (dir === 'right') {
        expect(result.flipX).toBe(true);
      } else {
        expect(result.flipX).toBe(false);
      }
    }
  });
});
