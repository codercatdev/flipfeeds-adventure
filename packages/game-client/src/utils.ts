import type { Direction } from '@flipfeeds/shared';

/**
 * Pure function to determine direction from key states.
 * Extracted for unit testability — @qa can test all 9 combinations
 * without needing Phaser's input system.
 */
export function getDirectionFromInput(keys: {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}): Direction {
  const { up, down, left, right } = keys;

  // Cancel out opposing directions
  const vy = (up ? -1 : 0) + (down ? 1 : 0);
  const vx = (left ? -1 : 0) + (right ? 1 : 0);

  if (vx === 0 && vy === 0) return 'idle';
  if (vx === 0 && vy < 0) return 'up';
  if (vx === 0 && vy > 0) return 'down';
  if (vx < 0 && vy === 0) return 'left';
  if (vx > 0 && vy === 0) return 'right';
  if (vx < 0 && vy < 0) return 'up-left';
  if (vx > 0 && vy < 0) return 'up-right';
  if (vx < 0 && vy > 0) return 'down-left';
  if (vx > 0 && vy > 0) return 'down-right';

  return 'idle';
}

/** Movement speed constants */
export const PLAYER_SPEED = 168; // pixels per second (7 tiles/sec × 24px)
export const DIAGONAL_FACTOR = 1 / Math.SQRT2; // ~0.707 — normalize diagonal speed
export const TILE_SIZE = 24; // pixels per tile
