import mitt from 'mitt';
import type { GameEvents } from '@flipfeeds/shared';

export const eventBus = mitt<GameEvents>();
export default eventBus;

// Re-export the type from shared for convenience
export type { GameEvents } from '@flipfeeds/shared';
