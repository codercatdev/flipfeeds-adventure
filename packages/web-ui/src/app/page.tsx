'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect } from 'react';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import { AvatarPicker } from '../components/AvatarPicker';
import { ChatSheet } from '../components/ChatSheet';
import { VideoDialog } from '../components/VideoDialog';
import { UserInfoHUD } from '../components/UserInfoHUD';
import { LoginScreen } from '../components/LoginScreen';
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
  // Deployed app: use same origin so PartyKit can be reached (e.g. same domain or proxy)
  if (typeof window !== 'undefined' && window.location?.hostname !== 'localhost') {
    return window.location.host;
  }
  return 'localhost:1999';
}

export default function Home() {
  const { session, sessionToken, isPending, isAuthenticated, hasAvatar, updateAvatar, signIn, signOut } = useAuth();
  const [showPicker, setShowPicker] = useState(false);

  const { status: wsStatus, latency, playerId } = useWebSocket({
    host: getPartyKitHost(),
    room: 'main',
    playerName: session?.user?.name || 'Player',
    token: sessionToken ?? undefined,
  });

  const handleAvatarSelect = useCallback(async (config: { characterType: number; colorVariant: number }) => {
    await updateAvatar(config);
    setShowPicker(false);
    // Note: Don't emit AVATAR_SELECTED here — GameCanvas isn't mounted yet on first pick.
    // The useEffect below handles emitting after GAME_READY.
  }, [updateAvatar]);

  // Emit saved avatar config once the game engine is ready.
  // Fixes race condition: on first pick, GameCanvas mounts AFTER the picker closes,
  // so we wait for GAME_READY then send the config.
  useEffect(() => {
    if (hasAvatar && session?.user?.avatarConfig) {
      const config = session.user.avatarConfig;
      const handler = () => {
        eventBus.emit('AVATAR_SELECTED', config);
      };
      eventBus.on('GAME_READY', handler);
      return () => { eventBus.off('GAME_READY', handler); };
    }
  }, [hasAvatar, session?.user?.avatarConfig]);

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

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onSignIn={signIn} />;
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
        <ChatSheet playerName={session?.user?.name || 'Player'} />
        <VideoDialog />
        <UserInfoHUD
          userName={session?.user?.name || 'Player'}
          avatarConfig={session?.user?.avatarConfig || { characterType: 0, colorVariant: 0 }}
          onChangeAvatar={() => setShowPicker(true)}
          onSignOut={signOut}
        />
        <ConnectionStatus wsStatus={wsStatus} latency={latency} playerId={playerId} />
      </div>
    </>
  );
}
