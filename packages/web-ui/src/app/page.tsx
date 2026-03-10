'use client';

import dynamic from 'next/dynamic';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { useWebSocket } from '../hooks/useWebSocket';

// Dynamic import Phaser (it needs window/document)
const GameCanvas = dynamic(() => import('../components/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: '#88ff88',
      fontSize: '18px',
      background: '#1a1a2e',
    }}>
      Loading game engine...
    </div>
  ),
});

const ZoneManager = dynamic(
  () => import('../components/overlays/ZoneManager').then(m => ({ default: m.ZoneManager })),
  { ssr: false }
);

export default function Home() {
  const { status: wsStatus, latency, playerId } = useWebSocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999',
    room: 'main',
  });

  return (
    <>
      <div id="game-container">
        <GameCanvas />
      </div>
      <div id="ui-overlay">
        <ZoneManager />
        <ConnectionStatus wsStatus={wsStatus} latency={latency} playerId={playerId} />
      </div>
    </>
  );
}
