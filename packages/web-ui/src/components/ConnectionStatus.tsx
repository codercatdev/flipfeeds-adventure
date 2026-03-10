'use client';

import { useEffect, useState } from 'react';
import { eventBus } from '@flipfeeds/game-client/events';
import type { WebSocketStatus } from '../hooks/useWebSocket';

interface ConnectionStatusProps {
  wsStatus: WebSocketStatus;
  latency: number;
  playerId: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  connected: '#00ff88',
  connecting: '#ffaa00',
  disconnected: '#ff4444',
  loading: '#ffaa00',
  'game-ready': '#00ff88',
};

export function ConnectionStatus({ wsStatus, latency, playerId }: ConnectionStatusProps) {
  const [gameStatus, setGameStatus] = useState<'loading' | 'game-ready'>('loading');

  useEffect(() => {
    const onGameReady = () => {
      setGameStatus('game-ready');
      console.log('[ConnectionStatus] Game engine ready');
    };

    eventBus.on('GAME_READY', onGameReady);

    return () => {
      eventBus.off('GAME_READY', onGameReady);
    };
  }, []);

  const wsColor = STATUS_COLORS[wsStatus] ?? '#ff4444';
  const gameColor = STATUS_COLORS[gameStatus] ?? '#ffaa00';

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#aaa',
      background: 'rgba(0,0,0,0.6)',
      padding: '8px 12px',
      borderRadius: '8px',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
    }}>
      <div>
        <span style={{ color: gameColor }}>●</span>
        {' '}Phaser: {gameStatus === 'loading' ? 'Loading...' : 'Ready'}
      </div>
      <div>
        <span style={{ color: wsColor }}>●</span>
        {' '}WebSocket: {wsStatus}
      </div>
      {wsStatus === 'connected' && (
        <div>
          <span style={{ color: '#00ff88' }}>●</span>
          {' '}Latency: {latency}ms
        </div>
      )}
      {playerId && (
        <div style={{ color: '#666', fontSize: '10px' }}>
          ID: {playerId.slice(0, 8)}…
        </div>
      )}
    </div>
  );
}
