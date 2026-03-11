import { describe, it, expect } from 'vitest';

/**
 * Phase 6 — Avatar Configuration Tests
 *
 * Tests the pure avatar functions from @flipfeeds/shared/avatar.
 * Covers: AvatarConfig validation, frame calculation, pixel positions,
 * character types, color variants, and default fallbacks.
 *
 * Imports directly from shared (no Phaser dependency).
 */

import {
  CHARACTER_TYPES,
  COLOR_VARIANTS,
  SPRITE_COLS,
  DEFAULT_AVATAR,
  getAvatarFrames,
  getFramePixelPosition,
} from '@flipfeeds/shared';
import type { AvatarConfig } from '@flipfeeds/shared';

// ============================================================
// Tests — Character Types
// ============================================================

describe('Phase 6 — Character Types', () => {
  it('has exactly 5 character types', () => {
    expect(CHARACTER_TYPES).toHaveLength(5);
  });

  it('each type has a name and walkDownRow', () => {
    for (const type of CHARACTER_TYPES) {
      expect(typeof type.name).toBe('string');
      expect(type.name.length).toBeGreaterThan(0);
      expect(typeof type.walkDownRow).toBe('number');
      expect(type.walkDownRow).toBeGreaterThanOrEqual(0);
    }
  });

  it('character names are Scientist, Engineer, Medic, Officer, Operative', () => {
    const names = CHARACTER_TYPES.map(t => t.name);
    expect(names).toEqual(['Scientist', 'Engineer', 'Medic', 'Officer', 'Operative']);
  });

  it('walkDownRow values are unique', () => {
    const rows = CHARACTER_TYPES.map(t => t.walkDownRow);
    expect(new Set(rows).size).toBe(5);
  });

  it('walkDownRow values are within spritesheet bounds (0-40)', () => {
    for (const type of CHARACTER_TYPES) {
      expect(type.walkDownRow).toBeGreaterThanOrEqual(0);
      expect(type.walkDownRow).toBeLessThanOrEqual(40);
    }
  });
});

// ============================================================
// Tests — Color Variants
// ============================================================

describe('Phase 6 — Color Variants', () => {
  it('has exactly 4 color variants', () => {
    expect(COLOR_VARIANTS).toHaveLength(4);
  });

  it('color variants are column offsets [0, 4, 8, 12]', () => {
    expect([...COLOR_VARIANTS]).toEqual([0, 4, 8, 12]);
  });

  it('color variants are spaced 4 apart (4 frames per animation)', () => {
    for (let i = 1; i < COLOR_VARIANTS.length; i++) {
      expect(COLOR_VARIANTS[i] - COLOR_VARIANTS[i - 1]).toBe(4);
    }
  });
});

// ============================================================
// Tests — Sprite Constants
// ============================================================

describe('Phase 6 — Sprite Constants', () => {
  it('spritesheet has 32 columns', () => {
    expect(SPRITE_COLS).toBe(32);
  });

  it('default avatar is characterType 0, colorVariant 0', () => {
    expect(DEFAULT_AVATAR).toEqual({ characterType: 0, colorVariant: 0 });
  });
});

// ============================================================
// Tests — getAvatarFrames
// ============================================================

describe('Phase 6 — getAvatarFrames', () => {
  it('returns walkDown, walkUp, walkLeft, idleDown, idleUp, idleLeft', () => {
    const frames = getAvatarFrames(DEFAULT_AVATAR);
    expect(frames).toHaveProperty('walkDown');
    expect(frames).toHaveProperty('walkUp');
    expect(frames).toHaveProperty('walkLeft');
    expect(frames).toHaveProperty('idleDown');
    expect(frames).toHaveProperty('idleUp');
    expect(frames).toHaveProperty('idleLeft');
  });

  it('walk animations have 4 frames each', () => {
    const frames = getAvatarFrames(DEFAULT_AVATAR);
    expect(frames.walkDown).toHaveLength(4);
    expect(frames.walkUp).toHaveLength(4);
    expect(frames.walkLeft).toHaveLength(4);
  });

  it('idle frames are single numbers', () => {
    const frames = getAvatarFrames(DEFAULT_AVATAR);
    expect(typeof frames.idleDown).toBe('number');
    expect(typeof frames.idleUp).toBe('number');
    expect(typeof frames.idleLeft).toBe('number');
  });

  it('Scientist (type 0, color 0) uses row 13', () => {
    const frames = getAvatarFrames({ characterType: 0, colorVariant: 0 });
    // Row 13, col 0: walkDown starts at 13 * 32 + 0 = 416
    expect(frames.walkDown[0]).toBe(416);
    expect(frames.walkDown).toEqual([416, 417, 418, 419]);
    // All directions use the same row (Oryx sprites are front-facing only)
    expect(frames.walkUp).toEqual(frames.walkDown);
    expect(frames.walkLeft).toEqual(frames.walkDown);
  });

  it('Engineer (type 1, color 0) uses row 0', () => {
    const frames = getAvatarFrames({ characterType: 1, colorVariant: 0 });
    expect(frames.walkDown[0]).toBe(0);
    // All directions use the same row (front-facing only)
    expect(frames.walkUp[0]).toBe(0);
    expect(frames.walkLeft[0]).toBe(0);
  });

  it('color variant shifts column offset', () => {
    const color0 = getAvatarFrames({ characterType: 0, colorVariant: 0 });
    const color1 = getAvatarFrames({ characterType: 0, colorVariant: 1 });
    const color2 = getAvatarFrames({ characterType: 0, colorVariant: 2 });
    const color3 = getAvatarFrames({ characterType: 0, colorVariant: 3 });

    // Each color variant shifts by 4 columns
    expect(color1.walkDown[0] - color0.walkDown[0]).toBe(4);
    expect(color2.walkDown[0] - color0.walkDown[0]).toBe(8);
    expect(color3.walkDown[0] - color0.walkDown[0]).toBe(12);
  });

  it('all 20 type+color combinations produce valid frames', () => {
    for (let type = 0; type < 5; type++) {
      for (let color = 0; color < 4; color++) {
        const config: AvatarConfig = { characterType: type, colorVariant: color };
        const frames = getAvatarFrames(config);

        // All frames should be non-negative
        for (const f of frames.walkDown) expect(f).toBeGreaterThanOrEqual(0);
        for (const f of frames.walkUp) expect(f).toBeGreaterThanOrEqual(0);
        for (const f of frames.walkLeft) expect(f).toBeGreaterThanOrEqual(0);
        expect(frames.idleDown).toBeGreaterThanOrEqual(0);
        expect(frames.idleUp).toBeGreaterThanOrEqual(0);
        expect(frames.idleLeft).toBeGreaterThanOrEqual(0);

        // Walk frames should be consecutive
        for (let i = 1; i < 4; i++) {
          expect(frames.walkDown[i]).toBe(frames.walkDown[0] + i);
          expect(frames.walkUp[i]).toBe(frames.walkUp[0] + i);
          expect(frames.walkLeft[i]).toBe(frames.walkLeft[0] + i);
        }

        // Idle frame is first frame of walk animation
        expect(frames.idleDown).toBe(frames.walkDown[0]);
        expect(frames.idleUp).toBe(frames.walkUp[0]);
        expect(frames.idleLeft).toBe(frames.walkLeft[0]);
      }
    }
  });

  it('invalid characterType falls back to default avatar', () => {
    const frames = getAvatarFrames({ characterType: 99, colorVariant: 0 });
    const defaultFrames = getAvatarFrames(DEFAULT_AVATAR);
    expect(frames).toEqual(defaultFrames);
  });

  it('invalid colorVariant falls back to column 0', () => {
    const frames = getAvatarFrames({ characterType: 0, colorVariant: 99 });
    const col0Frames = getAvatarFrames({ characterType: 0, colorVariant: 0 });
    expect(frames).toEqual(col0Frames);
  });

  it('all directions use the same row (front-facing sprites)', () => {
    for (let type = 0; type < 5; type++) {
      const frames = getAvatarFrames({ characterType: type, colorVariant: 0 });
      // Oryx sci-fi creatures are all front-facing — no directional views
      expect(frames.walkUp).toEqual(frames.walkDown);
      expect(frames.walkLeft).toEqual(frames.walkDown);
      expect(frames.idleUp).toBe(frames.idleDown);
      expect(frames.idleLeft).toBe(frames.idleDown);
    }
  });

  it('idle frames equal first walk frame for all directions', () => {
    for (let type = 0; type < 5; type++) {
      const frames = getAvatarFrames({ characterType: type, colorVariant: 0 });
      expect(frames.idleDown).toBe(frames.walkDown[0]);
      expect(frames.idleUp).toBe(frames.walkUp[0]);
      expect(frames.idleLeft).toBe(frames.walkLeft[0]);
    }
  });
});

// ============================================================
// Tests — getFramePixelPosition
// ============================================================

describe('Phase 6 — getFramePixelPosition', () => {
  it('frame 0 is at pixel (0, 0)', () => {
    expect(getFramePixelPosition(0)).toEqual({ x: 0, y: 0 });
  });

  it('frame 1 is at pixel (24, 0)', () => {
    expect(getFramePixelPosition(1)).toEqual({ x: 24, y: 0 });
  });

  it('frame 32 (first of row 1) is at pixel (0, 24)', () => {
    expect(getFramePixelPosition(32)).toEqual({ x: 0, y: 24 });
  });

  it('frame 416 (Scientist walkDown start) is at correct position', () => {
    // Row 13, col 0: x = 0, y = 13 * 24 = 312
    expect(getFramePixelPosition(416)).toEqual({ x: 0, y: 312 });
  });

  it('pixel positions use 24px tile size', () => {
    const pos = getFramePixelPosition(5); // row 0, col 5
    expect(pos.x).toBe(5 * 24);
    expect(pos.y).toBe(0);
  });

  it('all 20 avatar idle frames have valid pixel positions', () => {
    for (let type = 0; type < 5; type++) {
      for (let color = 0; color < 4; color++) {
        const frames = getAvatarFrames({ characterType: type, colorVariant: color });
        const pos = getFramePixelPosition(frames.idleDown);
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.x % 24).toBe(0); // aligned to 24px grid
        expect(pos.y % 24).toBe(0);
      }
    }
  });
});
