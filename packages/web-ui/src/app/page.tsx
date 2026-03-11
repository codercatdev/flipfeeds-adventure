'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import { AvatarPicker } from '../components/AvatarPicker';
import { eventBus } from '@flipfeeds/game-client/events';

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

/** Safe access to PartyKit host — works in both Vite and Next.js environments */
function getPartyKitHost(): string {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const host = (window as any).__VITE_PARTYKIT_HOST;
    if (host) return host as string;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    if (env?.VITE_PARTYKIT_HOST) return env.VITE_PARTYKIT_HOST as string;
  } catch {
    // import.meta.env not available
  }
  return 'localhost:1999';
}

export default function Home() {
  const { session, isPending, hasAvatar, updateAvatar } = useAuth();
  const [showPicker, setShowPicker] = useState(false);

  const { status: wsStatus, latency, playerId } = useWebSocket({
    host: getPartyKitHost(),
    room: 'main',
  });

  const handleAvatarSelect = useCallback(async (config: { characterType: number; colorVariant: number }) => {
    await updateAvatar(config);
    setShowPicker(false);
    // Notify the game engine about the avatar selection
    eventBus.emit('AVATAR_SELECTED', config);
  }, [updateAvatar]);

  // Show loading while checking auth
  if (isPending) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#88ff88',
        fontSize: '18px',
        background: '#1a1a2e',
      }}>
        Loading...
      </div>
    );
  }

  // Show avatar picker on first visit (no avatar saved) or when explicitly opened
  if (!hasAvatar || showPicker) {
    return (
      <AvatarPicker
        onSelect={handleAvatarSelect}
        initialType={session?.user?.avatarConfig?.characterType}
        initialVariant={session?.user?.avatarConfig?.colorVariant}
      />
    );
  }

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
