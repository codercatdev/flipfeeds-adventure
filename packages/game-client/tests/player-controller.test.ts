import { describe, it, expect } from 'vitest';
import type { Direction } from '@flipfeeds/shared';

/**
 * Player Controller Tests — Phase 2
 *
 * Tests the pure logic for player movement direction calculation,
 * movement speed, and input pausing. These functions are extracted
 * from the Phaser-dependent PlayerController so they can be tested
 * in Node.js without a browser or Phaser runtime.
 *
 * The actual PlayerController in Phaser will import these helpers.
 */

// ============================================================
// Pure logic functions (extracted for testability)
// ============================================================

interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Calculate movement direction from key states.
 * Opposing keys cancel each other out (up+down = idle).
 */
function getDirection(keys: KeyState): Direction {
  const verticalAxis = (keys.up ? -1 : 0) + (keys.down ? 1 : 0);
  const horizontalAxis = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);

  if (verticalAxis === 0 && horizontalAxis === 0) return 'idle';

  if (verticalAxis === -1 && horizontalAxis === 0) return 'up';
  if (verticalAxis === 1 && horizontalAxis === 0) return 'down';
  if (verticalAxis === 0 && horizontalAxis === -1) return 'left';
  if (verticalAxis === 0 && horizontalAxis === 1) return 'right';

  if (verticalAxis === -1 && horizontalAxis === -1) return 'up-left';
  if (verticalAxis === -1 && horizontalAxis === 1) return 'up-right';
  if (verticalAxis === 1 && horizontalAxis === -1) return 'down-left';
  if (verticalAxis === 1 && horizontalAxis === 1) return 'down-right';

  return 'idle';
}

/** Movement speed in pixels per second (from map spec) */
const PLAYER_SPEED = 168;

/**
 * Calculate velocity vector from direction and speed.
 * Diagonal movement is normalized to maintain consistent speed.
 */
function getVelocity(direction: Direction, speed: number): { vx: number; vy: number } {
  const DIAG = Math.SQRT1_2; // ~0.7071 — normalize diagonal so total speed is consistent

  switch (direction) {
    case 'up':         return { vx: 0,             vy: -speed };
    case 'down':       return { vx: 0,             vy: speed };
    case 'left':       return { vx: -speed,        vy: 0 };
    case 'right':      return { vx: speed,         vy: 0 };
    case 'up-left':    return { vx: -speed * DIAG, vy: -speed * DIAG };
    case 'up-right':   return { vx: speed * DIAG,  vy: -speed * DIAG };
    case 'down-left':  return { vx: -speed * DIAG, vy: speed * DIAG };
    case 'down-right': return { vx: speed * DIAG,  vy: speed * DIAG };
    case 'idle':
    default:           return { vx: 0,             vy: 0 };
  }
}

/**
 * Simple input pause state machine.
 */
class InputPauseController {
  private paused = false;

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  isPaused(): boolean { return this.paused; }

  /** Returns the effective direction (idle if paused) */
  getEffectiveDirection(keys: KeyState): Direction {
    if (this.paused) return 'idle';
    return getDirection(keys);
  }
}

// ============================================================
// Tests
// ============================================================

describe('Player Controller — Direction Calculation', () => {
  const noKeys: KeyState = { up: false, down: false, left: false, right: false };

  it('no keys pressed → idle', () => {
    expect(getDirection(noKeys)).toBe('idle');
  });

  it('up only → up', () => {
    expect(getDirection({ ...noKeys, up: true })).toBe('up');
  });

  it('down only → down', () => {
    expect(getDirection({ ...noKeys, down: true })).toBe('down');
  });

  it('left only → left', () => {
    expect(getDirection({ ...noKeys, left: true })).toBe('left');
  });

  it('right only → right', () => {
    expect(getDirection({ ...noKeys, right: true })).toBe('right');
  });

  it('up + left → up-left', () => {
    expect(getDirection({ ...noKeys, up: true, left: true })).toBe('up-left');
  });

  it('up + right → up-right', () => {
    expect(getDirection({ ...noKeys, up: true, right: true })).toBe('up-right');
  });

  it('down + left → down-left', () => {
    expect(getDirection({ ...noKeys, down: true, left: true })).toBe('down-left');
  });

  it('down + right → down-right', () => {
    expect(getDirection({ ...noKeys, down: true, right: true })).toBe('down-right');
  });
});

describe('Player Controller — Opposing Keys Cancel', () => {
  const noKeys: KeyState = { up: false, down: false, left: false, right: false };

  it('up + down → idle (vertical cancel)', () => {
    expect(getDirection({ ...noKeys, up: true, down: true })).toBe('idle');
  });

  it('left + right → idle (horizontal cancel)', () => {
    expect(getDirection({ ...noKeys, left: true, right: true })).toBe('idle');
  });

  it('all four keys → idle (both axes cancel)', () => {
    expect(getDirection({ up: true, down: true, left: true, right: true })).toBe('idle');
  });

  it('up + down + left → left (vertical cancels, horizontal remains)', () => {
    expect(getDirection({ up: true, down: true, left: true, right: false })).toBe('left');
  });

  it('up + down + right → right (vertical cancels, horizontal remains)', () => {
    expect(getDirection({ up: true, down: true, left: false, right: true })).toBe('right');
  });

  it('left + right + up → up (horizontal cancels, vertical remains)', () => {
    expect(getDirection({ up: true, down: false, left: true, right: true })).toBe('up');
  });

  it('left + right + down → down (horizontal cancels, vertical remains)', () => {
    expect(getDirection({ up: false, down: true, left: true, right: true })).toBe('down');
  });
});

describe('Player Controller — Movement Speed', () => {
  it('movement speed is 168 px/sec', () => {
    expect(PLAYER_SPEED).toBe(168);
  });

  it('cardinal direction velocity magnitude equals speed', () => {
    const cardinals: Direction[] = ['up', 'down', 'left', 'right'];
    for (const dir of cardinals) {
      const { vx, vy } = getVelocity(dir, PLAYER_SPEED);
      const magnitude = Math.sqrt(vx * vx + vy * vy);
      expect(magnitude).toBeCloseTo(PLAYER_SPEED, 5);
    }
  });

  it('diagonal velocity magnitude equals speed (normalized)', () => {
    const diagonals: Direction[] = ['up-left', 'up-right', 'down-left', 'down-right'];
    for (const dir of diagonals) {
      const { vx, vy } = getVelocity(dir, PLAYER_SPEED);
      const magnitude = Math.sqrt(vx * vx + vy * vy);
      expect(magnitude).toBeCloseTo(PLAYER_SPEED, 5);
    }
  });

  it('idle velocity is zero', () => {
    const { vx, vy } = getVelocity('idle', PLAYER_SPEED);
    expect(vx).toBe(0);
    expect(vy).toBe(0);
  });

  it('up velocity has negative vy (screen coordinates)', () => {
    const { vx, vy } = getVelocity('up', PLAYER_SPEED);
    expect(vx).toBe(0);
    expect(vy).toBeLessThan(0);
  });

  it('right velocity has positive vx', () => {
    const { vx, vy } = getVelocity('right', PLAYER_SPEED);
    expect(vx).toBeGreaterThan(0);
    expect(vy).toBe(0);
  });

  it('diagonal speed is same as cardinal speed (no faster diagonals)', () => {
    const cardinalVel = getVelocity('right', PLAYER_SPEED);
    const diagonalVel = getVelocity('up-right', PLAYER_SPEED);

    const cardinalMag = Math.sqrt(cardinalVel.vx ** 2 + cardinalVel.vy ** 2);
    const diagonalMag = Math.sqrt(diagonalVel.vx ** 2 + diagonalVel.vy ** 2);

    expect(diagonalMag).toBeCloseTo(cardinalMag, 5);
  });
});

describe('Player Controller — Input Pausing', () => {
  const noKeys: KeyState = { up: false, down: false, left: false, right: false };

  it('starts unpaused', () => {
    const controller = new InputPauseController();
    expect(controller.isPaused()).toBe(false);
  });

  it('PAUSE_INPUT stops movement', () => {
    const controller = new InputPauseController();
    controller.pause();
    expect(controller.isPaused()).toBe(true);

    // Even with keys pressed, direction should be idle
    const dir = controller.getEffectiveDirection({ ...noKeys, up: true, right: true });
    expect(dir).toBe('idle');
  });

  it('RESUME_INPUT resumes movement', () => {
    const controller = new InputPauseController();
    controller.pause();
    controller.resume();
    expect(controller.isPaused()).toBe(false);

    const dir = controller.getEffectiveDirection({ ...noKeys, up: true });
    expect(dir).toBe('up');
  });

  it('multiple pause/resume cycles work correctly', () => {
    const controller = new InputPauseController();

    controller.pause();
    expect(controller.getEffectiveDirection({ ...noKeys, right: true })).toBe('idle');

    controller.resume();
    expect(controller.getEffectiveDirection({ ...noKeys, right: true })).toBe('right');

    controller.pause();
    expect(controller.getEffectiveDirection({ ...noKeys, right: true })).toBe('idle');

    controller.resume();
    expect(controller.getEffectiveDirection({ ...noKeys, down: true, left: true })).toBe('down-left');
  });

  it('resume when already unpaused is a no-op', () => {
    const controller = new InputPauseController();
    controller.resume(); // already unpaused
    expect(controller.isPaused()).toBe(false);
    expect(controller.getEffectiveDirection({ ...noKeys, left: true })).toBe('left');
  });
});

describe('Player Controller — Direction Type Safety', () => {
  it('getDirection returns a valid Direction type', () => {
    const validDirections: Direction[] = [
      'up', 'down', 'left', 'right',
      'up-left', 'up-right', 'down-left', 'down-right',
      'idle',
    ];

    // Test all 16 possible key combinations
    const bools = [false, true];
    for (const up of bools) {
      for (const down of bools) {
        for (const left of bools) {
          for (const right of bools) {
            const dir = getDirection({ up, down, left, right });
            expect(validDirections).toContain(dir);
          }
        }
      }
    }
  });

  it('all 16 key combinations produce deterministic results', () => {
    const bools = [false, true];
    for (const up of bools) {
      for (const down of bools) {
        for (const left of bools) {
          for (const right of bools) {
            const keys = { up, down, left, right };
            const dir1 = getDirection(keys);
            const dir2 = getDirection(keys);
            expect(dir1).toBe(dir2);
          }
        }
      }
    }
  });
});
