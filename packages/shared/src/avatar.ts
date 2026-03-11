/**
 * Avatar configuration — single source of truth.
 * Imported by @flipfeeds/auth, @flipfeeds/game-client, and @flipfeeds/web-ui.
 */

export const CHARACTER_TYPES = [
  { name: 'Scientist',  walkDownRow: 13 },
  { name: 'Engineer',   walkDownRow: 0 },
  { name: 'Medic',      walkDownRow: 9 },
  { name: 'Officer',    walkDownRow: 22 },
  { name: 'Operative',  walkDownRow: 4 },
] as const;

export const COLOR_VARIANTS = [0, 4, 8, 12] as const;

export interface AvatarConfig {
  characterType: number;  // 0-4 index into CHARACTER_TYPES
  colorVariant: number;   // 0-3 index into COLOR_VARIANTS
  accessories?: string[]; // Phase 7: layered accessories
  bodyColor?: string;     // Phase 7: hex color for programmatic recolor
}

/** Frame calculation helpers for Oryx creatures spritesheet (32 columns) */
export function getAvatarFrames(config: AvatarConfig) {
  const row = CHARACTER_TYPES[config.characterType].walkDownRow;
  const col = COLOR_VARIANTS[config.colorVariant];
  return {
    walkDown:  [0, 1, 2, 3].map(f => row * 32 + col + f),
    walkUp:    [0, 1, 2, 3].map(f => (row + 1) * 32 + col + f),
    walkLeft:  [0, 1, 2, 3].map(f => (row + 2) * 32 + col + f),
    idleDown:  row * 32 + col,
    idleUp:    (row + 1) * 32 + col,
    idleLeft:  (row + 2) * 32 + col,
  };
}
