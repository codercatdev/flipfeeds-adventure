import { useEffect } from 'react';
// Import from /events subpath to avoid pulling in Phaser during SSR
import { eventBus, type GameEvents } from '@flipfeeds/game-client/events';

/**
 * React hook to listen for game events from the Phaser engine.
 * Automatically subscribes on mount and unsubscribes on unmount.
 */
export function useGameEvent<K extends keyof GameEvents>(
  event: K,
  handler: (data: GameEvents[K]) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    eventBus.on(event, handler);
    return () => {
      eventBus.off(event, handler);
    };
  }, [event, ...deps]);
}

/**
 * Emit a game event from React to Phaser.
 */
export function emitGameEvent<K extends keyof GameEvents>(
  event: K,
  data: GameEvents[K]
) {
  eventBus.emit(event, data);
}
