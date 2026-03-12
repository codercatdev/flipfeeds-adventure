'use client';

import { useState, useEffect } from 'react';
import { eventBus } from '@flipfeeds/game-client/events';

const ROOM_NAMES: Record<string, string> = {
  'lobby': 'Lobby',
  'feed-maker': 'Maker Feed',
  'social': 'Social Hub',
  'feed-future': 'Future Feed',
  'edit-bay': 'Edit Bay',
};

export function RoomTransition() {
  const [roomName, setRoomName] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (data: { targetRoom: string; targetSpawn: string }) => {
      const name = ROOM_NAMES[data.targetRoom] || data.targetRoom;
      setRoomName(name);
      setVisible(true);

      // Auto-hide after transition completes
      setTimeout(() => setVisible(false), 1200);
      setTimeout(() => setRoomName(null), 1600);
    };

    eventBus.on('ROOM_CHANGE', handler);
    return () => { eventBus.off('ROOM_CHANGE', handler); };
  }, []);

  if (!roomName) return null;

  return (
    <div
      className={`fixed inset-0 z-[1500] flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: visible ? 'rgba(0, 0, 0, 0.7)' : 'transparent' }}
    >
      <div className="text-center">
        <p className="text-white/60 text-sm font-mono tracking-widest uppercase mb-2">
          Entering
        </p>
        <h2 className="text-white text-3xl font-bold font-mono">
          {roomName}
        </h2>
      </div>
    </div>
  );
}
