/**
 * Avatar configuration types and constants.
 * Canonical source — imported by game-client, web-ui, and auth packages.
 */

/** Avatar configuration stored per user. */
export interface AvatarConfig {
  characterType: number;  // 0-4 index into CHARACTER_TYPES
  colorVariant: number;   // 0-3 index into COLOR_VARIANTS
}

/** Character type definitions with spritesheet row mapping. */
export const CHARACTER_TYPES = [
  { name: 'Scientist',  walkDownRow: 13 },  // frames 416+ (gold/brown uniform)
  { name: 'Engineer',   walkDownRow: 0 },   // frames 0+   (green-gray uniform)
  { name: 'Medic',      walkDownRow: 9 },   // frames 288+ (red uniform)
  { name: 'Officer',    walkDownRow: 22 },   // frames 704+ (blue/cyan uniform)
  { name: 'Operative',  walkDownRow: 4 },    // frames 128+ (dark green + gold)
] as const;

/** Color variant column offsets in the creatures spritesheet. */
export const COLOR_VARIANTS = [0, 4, 8, 12] as const;

/** Spritesheet grid: 32 columns × 41 rows of 24×24px frames. */
export const SPRITE_COLS = 32;

/** Default avatar for new players. */
export const DEFAULT_AVATAR: AvatarConfig = { characterType: 0, colorVariant: 0 };

/**
 * Calculate all animation frame indices for a given avatar config.
 * Pure function — used by game engine to build animations and by
 * the picker UI to render previews.
 */
export function getAvatarFrames(config: AvatarConfig) {
  const type = CHARACTER_TYPES[config.characterType];
  if (!type) return getAvatarFrames(DEFAULT_AVATAR);

  const row = type.walkDownRow;
  const col = COLOR_VARIANTS[config.colorVariant] ?? 0;

  return {
    walkDown:  [0, 1, 2, 3].map(f => row * SPRITE_COLS + col + f),
    walkUp:    [0, 1, 2, 3].map(f => (row + 1) * SPRITE_COLS + col + f),
    walkLeft:  [0, 1, 2, 3].map(f => (row + 2) * SPRITE_COLS + col + f),
    idleDown:  row * SPRITE_COLS + col,
    idleUp:    (row + 1) * SPRITE_COLS + col,
    idleLeft:  (row + 2) * SPRITE_COLS + col,
  };
}

/**
 * Get the pixel position of a frame in the spritesheet.
 * Used by the picker UI for CSS background-position.
 */
export function getFramePixelPosition(frame: number): { x: number; y: number } {
  return {
    x: (frame % SPRITE_COLS) * 24,
    y: Math.floor(frame / SPRITE_COLS) * 24,
  };
}
