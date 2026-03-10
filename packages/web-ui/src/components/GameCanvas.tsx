'use client';

import { useEffect, useRef, useState } from 'react';
import { createGame, eventBus } from '@flipfeeds/game-client';
import type Phaser from 'phaser';

export default function GameCanvas() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    console.log('[GameCanvas] Mounting Phaser game...');
    
    const game = createGame({
      parent: containerRef.current,
    });
    
    gameRef.current = game;

    // Listen for game ready
    const onReady = () => {
      console.log('[GameCanvas] Game is ready!');
      setIsReady(true);
    };
    
    eventBus.on('GAME_READY', onReady);

    // Cleanup on unmount (important for React strict mode / HMR)
    return () => {
      console.log('[GameCanvas] Destroying Phaser game...');
      eventBus.off('GAME_READY', onReady);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%' }}
      data-game-ready={isReady}
    />
  );
}
