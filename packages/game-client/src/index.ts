// EventBus instance and types (safe for SSR — no Phaser dependency)
export { eventBus } from './EventBus';
export type { GameEvents } from '@flipfeeds/shared';

// Game factory (requires browser — use with dynamic import)
export { createGame, type PhaserGameConfig } from './PhaserGame';

// Utility functions (safe for SSR — no Phaser dependency)
export { getDirectionFromInput, PLAYER_SPEED, DIAGONAL_FACTOR } from './utils';

// Multiplayer modules (requires browser — use with dynamic import)
export { SpritePool } from './multiplayer/SpritePool';
export { InterpolationManager } from './multiplayer/InterpolationManager';
export { PredictionManager } from './multiplayer/PredictionManager';
export { NetworkManager } from './multiplayer/NetworkManager';
